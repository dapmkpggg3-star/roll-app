(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./workshop-status-bridge'), require('./workshop-instructions'));
    else root.RollWorkshopRecovery = factory(root.RollWorkshopStatusBridge, root.RollWorkshopInstructions);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (bridge, domain) {
    'use strict';
    const copy = value => JSON.parse(JSON.stringify(value));
    const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
        : value && typeof value === 'object' ? '{' + Object.keys(value).sort()
            .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}' : JSON.stringify(value);
    const same = (left, right) => stable(left) === stable(right);
    function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
    function auth(context) {
        if (!context || !context.actor || !['editor', 'admin'].includes(context.actor.role)
            || typeof context.actor.id !== 'string' || !context.actor.id || context.actor.id.length > 180) {
            fail('FORBIDDEN', '編集権限がありません。');
        }
        if (typeof context.now !== 'string' || context.now.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(context.now)
            || !Number.isFinite(Date.parse(context.now))) fail('INVALID_INPUT', 'サーバーの確認日時が不正です。');
    }
    function operationIdFor(requestId) {
        if (typeof requestId !== 'string' || !requestId || requestId.trim() !== requestId || requestId.length > 100) {
            fail('INVALID_INPUT', '保存要求IDを確認してください。');
        }
        return 'assembly-save:' + encodeURIComponent(requestId);
    }
    function validateProjection(projection) {
        if (!projection || !Array.isArray(projection.before) || !projection.before.length || !Array.isArray(projection.after)
            || projection.before.length !== projection.after.length) fail('MISSING_PROJECTION', '履歴表の反映対象が確認できません。');
        const ids = new Set();
        projection.before.forEach((entry, index) => {
            const after = projection.after[index];
            if (!entry || typeof entry.bindingId !== 'string' || !entry.bindingId || entry.bindingId.length > 180 || ids.has(entry.bindingId)
                || !after || entry.bindingId !== after.bindingId
                || !Object.prototype.hasOwnProperty.call(entry, 'value') || !Object.prototype.hasOwnProperty.call(after, 'value')
                || [entry.value, after.value].some(value => (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
                    || (typeof value === 'number' && !Number.isFinite(value)))) {
                fail('INVALID_PROJECTION', '履歴表の対応先が不足・重複しています。');
            }
            ids.add(entry.bindingId);
        });
    }
    function validate(record) {
        if (!record || record.schemaVersion !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 1
            || !['pending', 'blocked', 'complete'].includes(record.status) || !record.intent || !Array.isArray(record.checks)) {
            fail('INVALID_OPERATION', '未反映操作の記録が不正です。');
        }
        const intent = record.intent;
        if (!intent.request || record.id !== operationIdFor(intent.request.requestId)
            || intent.fingerprint !== stable({ actorId: intent.actorId, request: intent.request })
            || !Array.isArray(intent.roleChanges) || intent.roleChanges.length !== 2) {
            fail('INVALID_OPERATION', '保存要求と未反映記録が一致しません。');
        }
        // Recompute the immutable intent from its original inputs. This rejects
        // corrupted snapshots that would otherwise overwrite unrelated fields.
        const events = intent.instructionAfter && intent.instructionAfter.events;
        const actual = events && events[events.length - 1];
        if (!actual || !actual.source) fail('INVALID_OPERATION', '工作実績との対応がありません。');
        const recomputed = bridge.prepare(intent.roleChanges.map(change => change.before), intent.instructionBefore,
            intent.request, { actor: { id: intent.actorId, role: 'editor' }, today: intent.today, now: intent.createdAt,
                rolesRevision: intent.request.expectedRolesRevision,
                operators: [{ id: actual.source.operatorId, name: actual.source.operatorName }] });
        if (recomputed.replayed || !same(recomputed.instruction, intent.instructionAfter)
            || !same(recomputed.roleChanges, intent.roleChanges)) fail('INVALID_OPERATION', '未反映記録の更新前後が一致しません。');
        validateProjection(intent.historyProjection);
        const keys = effects(record).map(effect => effect.key);
        if (new Set(record.checks).size !== record.checks.length || record.checks.some(key => !keys.includes(key))
            || (record.status === 'complete' && (record.checks.length !== keys.length
                || typeof record.verifiedAt !== 'string' || !Number.isFinite(Date.parse(record.verifiedAt)) || record.problem))) {
            fail('INVALID_OPERATION', '反映確認記録が不正です。');
        }
        return record;
    }
    function effects(record) {
        const intent = record.intent;
        return intent.roleChanges.map(change => ({ key: 'role:' + change.roleId, type: 'role', id: change.roleId,
            before: change.before, after: change.after })).concat(
            intent.historyProjection.after.map((entry, index) => ({ key: 'history:' + entry.bindingId, type: 'history',
                id: entry.bindingId, before: [intent.historyProjection.before[index]], after: [entry] })), [
            { key: 'instruction', type: 'instruction', id: intent.instructionAfter.id,
                before: intent.instructionBefore, after: intent.instructionAfter }
        ]);
    }
    function receipt(record) {
        validate(record);
        return { operationId: record.id, status: record.status, verifiedAt: record.verifiedAt || null,
            problem: record.problem || null, instruction: copy(record.intent.instructionAfter),
            effectReceipts: record.status === 'complete' ? ['roles', 'rollHistory'].map(target => ({
                target, instructionId: record.intent.instructionAfter.id,
                instructionRevision: record.intent.instructionAfter.revision, state: 'verified',
                operationId: record.id, verifiedAt: record.verifiedAt
            })) : [] };
    }

    // All ports are synchronous server adapters. The caller must use one shared
    // lock for *every* legacy/new writer touching these rolls or instructions.
    // journal.put(expected, next) and each effect port.compareAndSet must verify
    // preconditions and read back; they must never be blind replacement writes.
    function createCoordinator(ports) {
        const { journal, lock } = ports;
        function withLock(resolveContext, action) {
            if (typeof resolveContext !== 'function') fail('FORBIDDEN', 'サーバーの認証確認が必要です。');
            if (!lock.tryLock(10000)) fail('BUSY', '他の更新処理中です。');
            try { const context = resolveContext(); auth(context); return action(context); }
            finally { lock.releaseLock(); }
        }
        function put(current, patch) {
            const next = { ...copy(current), ...patch, revision: current.revision + 1 };
            validate(next); journal.put(current, next); return next;
        }
        function pendingFor(targets, excludeId) {
            return journal.list().filter(record => {
                validate(record);
                return record.id !== excludeId && record.status !== 'complete'
                    && (targets.instructionId === record.intent.instructionAfter.id
                        || record.intent.roleChanges.some(change => (targets.roleIds || []).map(String).includes(change.roleId)));
            });
        }
        function read(effect) {
            if (effect.type === 'role') return ports.roles.read(effect.id);
            if (effect.type === 'history') return ports.history.read(effect.after);
            return ports.instructions.read(effect.id);
        }
        function write(effect, operationId) {
            if (effect.type === 'role') ports.roles.compareAndSet(effect.id, copy(effect.before), copy(effect.after), operationId);
            else if (effect.type === 'history') ports.history.compareAndSet(copy(effect.before), copy(effect.after));
            else ports.instructions.compareAndSet(effect.id, copy(effect.before), copy(effect.after));
        }
        function blocked(record, key, actorId) {
            return put(record, { status: 'blocked', problem: { code: 'REFLECTION_CONFLICT', target: key }, lastAttemptBy: actorId });
        }
        function run(record, context) {
            validate(record);
            // Completed receipts are historical evidence. A later legitimate
            // rotation must never cause this old operation to rewrite roll state.
            if (record.status === 'complete') {
                const result = receipt(record), current = ports.instructions.read(record.intent.instructionAfter.id);
                if (!current) fail('NOT_FOUND', '完了した工作指示の現在記録がありません。');
                domain.project(current);
                // Return current instruction data alongside the historical receipt.
                // Later revisions must not be overwritten by an old retry response.
                result.instruction = copy(current);
                return result;
            }
            const steps = effects(record);
            // Preflight ALL destinations before resuming any side effect.
            for (const step of steps) {
                const value = read(step);
                if (!same(value, step.before) && !same(value, step.after)) return receipt(blocked(record, step.key, context.actor.id));
            }
            for (const step of steps) {
                const value = read(step);
                if (same(value, step.after)) {
                    // Includes a write that succeeded before its response was lost.
                } else if (same(value, step.before)) write(step, record.id);
                else return receipt(blocked(record, step.key, context.actor.id));
                if (!same(read(step), step.after)) fail('UNCONFIRMED', '保存後の内容を確認できません。同じ操作から再確認してください。');
                if (!record.checks.includes(step.key)) record = put(record, {
                    checks: [...record.checks, step.key], status: 'pending', problem: null, lastAttemptBy: context.actor.id
                });
            }
            // Cached per-step flags never substitute for final content reads.
            for (const step of steps) if (!same(read(step), step.after)) return receipt(blocked(record, step.key, context.actor.id));
            record = put(record, { status: 'complete', problem: null, verifiedAt: context.now, lastAttemptBy: context.actor.id });
            return receipt(record);
        }
        return {
            execute(request, resolveContext) {
                return withLock(resolveContext, context => {
                    const allowed = ['requestId', 'instructionId', 'cycleId', 'recipientRoleId', 'operatorId',
                        'expectedInstructionRevision', 'expectedRolesRevision', 'fromStatus', 'toStatus', 'on'];
                    if (!request || Object.keys(request).some(key => !allowed.includes(key))) fail('INVALID_INPUT', '保存要求の項目を確認してください。');
                    const id = operationIdFor(request.requestId), existing = journal.read(id);
                    const fingerprint = stable({ actorId: context.actor.id, request });
                    if (existing) {
                        validate(existing);
                        if (existing.intent.fingerprint !== fingerprint) fail('REQUEST_REUSED', '同じ要求IDに別の操作が指定されています。');
                        return run(existing, context);
                    }
                    const instruction = ports.instructions.read(request.instructionId);
                    if (!instruction) fail('NOT_FOUND', '対象の工作指示がありません。');
                    const definition = domain.project(instruction).definition;
                    if (pendingFor({ instructionId: instruction.id, roleIds: [definition.donorRoleId, definition.recipientRoleId] }).length) {
                        fail('PENDING_OPERATION', 'このロールには未反映の操作があります。先に復旧してください。');
                    }
                    const roles = ports.roles.list();
                    const prepared = bridge.prepare(roles, instruction, request, { ...context, rolesRevision: ports.roles.revision(roles) });
                    if (prepared.replayed) fail('MISSING_OPERATION', '実績はありますが反映操作の記録がありません。自動で書き直さず確認してください。');
                    const historyProjection = ports.history.prepare(prepared.roleChanges, instruction, prepared.instruction);
                    validateProjection(historyProjection);
                    const record = { schemaVersion: 1, id, revision: 1, status: 'pending', checks: [],
                        intent: { actorId: context.actor.id, today: context.today, createdAt: context.now,
                            request: copy(request), fingerprint, instructionBefore: copy(instruction),
                            instructionAfter: prepared.instruction, roleChanges: prepared.roleChanges, historyProjection } };
                    validate(record);
                    // The complete recovery intent MUST be durable before rolls change.
                    journal.put(null, record);
                    return run(record, context);
                });
            },
            resume(operationId, resolveContext) {
                return withLock(resolveContext, context => {
                    const record = journal.read(operationId);
                    if (!record) fail('NOT_FOUND', '復旧する操作がありません。');
                    return run(record, context);
                });
            },
            assertNoPending(targets) {
                if (!lock.hasLock()) fail('LOCK_REQUIRED', '保存ロック内で未反映操作を確認してください。');
                if (pendingFor(targets).length) fail('PENDING_OPERATION', '関連する未反映操作があります。先に復旧してください。');
            }
        };
    }
    return { createCoordinator, operationIdFor, validate, same, receipt,
        requiredChecks: record => effects(record).map(effect => effect.key) };
});
