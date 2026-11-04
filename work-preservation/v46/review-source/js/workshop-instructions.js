(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RollWorkshopInstructions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    // Domain only. The server must supply its authenticated actor and adopted plan.
    // Never use a browser-supplied actor/adoption as authorization.
    const stages = ['prepared', 'installed', 'use_started'];
    function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
    function text(value, label, max = 180) {
        if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) {
            fail('INVALID_INPUT', label + 'を確認してください。');
        }
        return value;
    }
    function date(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
            || !Number.isFinite(Date.parse(value + 'T00:00:00Z'))
            || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
            fail('INVALID_DATE', '日付を確認してください。');
        }
        return value;
    }
    function assemblySchedule(value) {
        fields(value, ['workDate', 'nightProduction', 'source']);
        if (!['operating', 'stopped', 'unknown'].includes(value.nightProduction)) {
            fail('INVALID_INPUT', '組替日の夜勤操業予定を確認してください。');
        }
        return { workDate: value.workDate === null ? null : date(value.workDate),
            nightProduction: value.nightProduction, source: text(value.source, '組替予定の根拠', 700) };
    }
    function stable(value) {
        if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
        if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
            .map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
        return JSON.stringify(value);
    }
    function copy(value) { return JSON.parse(JSON.stringify(value)); }
    function fields(payload, allowed) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
            || Object.keys(payload).some(k => !allowed.includes(k))) fail('INVALID_INPUT', '指示の入力項目を確認してください。');
    }
    function instructionIdFor(cycleId) { return 'assembly:' + encodeURIComponent(text(cycleId, '準備サイクルID', 100)); }
    function adoptedDefinition(payload, context) {
        const adopted = context.adoption;
        if (!adopted || adopted.status !== 'adopted' || adopted.id !== payload.adoptionId
            || !Array.isArray(adopted.items)) fail('NOT_ADOPTED', '採用済みの計画を確認できません。');
        const matches = adopted.items.filter(item => item.id === payload.planItemId);
        if (matches.length !== 1) fail('INVALID_PLAN', '採用計画の対象が一意に決まりません。');
        const item = matches[0];
        const result = {
            adoptionId: text(adopted.id, '採用ID'), planVersionId: text(adopted.planVersionId, '計画版ID'),
            planItemId: text(item.id, '計画項目ID'), cycleId: text(item.cycleId, '準備サイクルID', 100),
            standId: text(item.standId, 'スタンドID'), donorRoleId: text(item.donorRoleId, '組替元ID'),
            recipientRoleId: text(item.recipientRoleId, '組替先ID'), readyBy: date(item.readyBy)
        };
        if (item.assemblySchedule !== undefined) result.assemblySchedule = assemblySchedule(item.assemblySchedule);
        if (adopted.planId !== undefined) result.planId = text(adopted.planId, '計画ID');
        if (result.donorRoleId === result.recipientRoleId) fail('INVALID_PAIR', '組替元と組替先は別のロールです。');
        return result;
    }
    function project(record) {
        if (!record || record.schemaVersion !== 1 || !Array.isArray(record.events)
            || record.events.length === 0 || record.revision !== record.events.length
            || record.events[0].kind !== 'issued') fail('INVALID_RECORD', '指示記録が不正です。保存を停止しました。');
        const view = { definition: null, actuals: { prepared: null, installed: null, use_started: null },
            actualEventIds: {}, blockers: Object.create(null), acknowledgedBy: Object.create(null), deadlineReview: null };
        const ids = new Set(), requests = new Set();
        for (const [index, event] of record.events.entries()) {
            if (!event.id || !event.requestId || ids.has(event.id) || requests.has(event.requestId)) {
                fail('INVALID_RECORD', '指示の履歴IDが重複しています。');
            }
            ids.add(event.id); requests.add(event.requestId);
            // Any subsequent business change requires a fresh impact review.
            // Reviews never change deadlines, actual dates, or roll status.
            if (!['deadline_impact_reviewed', 'acknowledged'].includes(event.kind)) view.deadlineReview = null;
            if (event.kind === 'issued' || event.kind === 'plan_revised') {
                view.definition = copy(event.definition);
                if (view.definition.assemblySchedule !== undefined) assemblySchedule(view.definition.assemblySchedule);
            }
            else if (event.kind === 'actual_recorded') {
                if (!stages.includes(event.stage) || view.actualEventIds[event.stage]) fail('INVALID_RECORD', '実績の重複があります。');
                view.actuals[event.stage] = event.on;
                view.actualEventIds[event.stage] = event.id;
            } else if (event.kind === 'actual_corrected') {
                const stage = stages.find(s => view.actualEventIds[s] === event.targetEventId);
                if (!stage) fail('INVALID_RECORD', '訂正対象の実績が見つかりません。');
                view.actuals[stage] = event.on;
            } else if (event.kind === 'deadline_impact_reviewed') {
                if (event.basisRevision !== index || !view.definition || !view.actuals.prepared
                    || event.readyBy !== view.definition.readyBy || event.preparedOn !== view.actuals.prepared
                    || event.preparedEventId !== view.actualEventIds.prepared || event.preparedOn <= event.readyBy
                    || Object.keys(view.blockers).length || date(event.on) < event.preparedOn) {
                    fail('INVALID_RECORD', '期限超過の対応記録と対象の期限・実績が一致しません。');
                }
                text(event.reason, '影響確認・対応内容', 700); text(event.actorId, '確認者');
                view.deadlineReview = copy(event);
            } else if (event.kind === 'acknowledged') view.acknowledgedBy[event.actorId] = event.recordedAt;
            else if (event.kind === 'blocked') view.blockers[event.blockerId] = event.reason;
            else if (event.kind === 'blocker_resolved') delete view.blockers[event.blockerId];
            else fail('INVALID_RECORD', '未対応の指示履歴です。');
        }
        if (!view.definition || record.id !== instructionIdFor(view.definition.cycleId)) fail('INVALID_RECORD', '指示IDとサイクルが一致しません。');
        for (let i = 0; i < stages.length; i++) {
            const on = view.actuals[stages[i]];
            if (on !== null) {
                date(on);
                if (i && (!view.actuals[stages[i - 1]] || on < view.actuals[stages[i - 1]])) {
                    fail('INVALID_SEQUENCE', '準備完了・ロール替・使用開始の日付と順序を確認してください。');
                }
            }
        }
        view.progress = view.actuals.use_started ? 'in_use' : view.actuals.installed ? 'installed'
            : view.actuals.prepared ? 'prepared' : 'issued';
        return view;
    }
    function apply(record, command, context) {
        if (!context || !context.actor || !['editor', 'admin'].includes(context.actor.role)) fail('FORBIDDEN', '編集権限がありません。');
        const actorId = text(context.actor.id, '利用者ID');
        const today = date(context.today); // Server business date, explicitly supplied (Japan).
        if (typeof context.now !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(context.now)
            || !Number.isFinite(Date.parse(context.now))) fail('INVALID_INPUT', '記録日時が不正です。');
        text(command.requestId, '要求ID', 100);
        text(command.instructionId, '指示ID', 400);
        const payload = command.payload;
        const fingerprint = stable({ actorId, kind: command.kind, payload });
        const view = record ? project(record) : null;
        if (record && record.id !== command.instructionId) fail('WRONG_INSTRUCTION', '指示IDが一致しません。');
        const previous = record && record.events.find(e => e.requestId === command.requestId);
        if (previous) {
            if (previous.fingerprint !== fingerprint) fail('REQUEST_REUSED', '同じ要求IDに別の操作が指定されています。');
            return { record: copy(record), changed: false, replayed: true };
        }
        // Re-exporting the same adopted item with a new request ID must reuse
        // the existing instruction, even if the caller still has revision 0.
        if (record && command.kind === 'issue') {
            fields(payload, ['adoptionId', 'planItemId']);
            const definition = adoptedDefinition(payload, context);
            if (stable(view.definition) === stable(definition)) return { record: copy(record), changed: false, replayed: true };
            fail('ALREADY_ISSUED', 'このサイクルは指示済みです。計画変更として確認してください。');
        }
        if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== (record ? record.revision : 0)) {
            fail('CONFLICT', '別の更新があります。最新の指示を確認してから操作してください。');
        }
        const event = { id: command.instructionId + ':event:' + command.requestId, requestId: command.requestId,
            fingerprint, actorId, recordedAt: context.now };
        if (command.kind === 'issue' || command.kind === 'revise_plan') {
            fields(payload, command.kind === 'issue' ? ['adoptionId', 'planItemId'] : ['adoptionId', 'planItemId', 'reason']);
            const definition = adoptedDefinition(payload, context);
            if (command.instructionId !== instructionIdFor(definition.cycleId)) fail('WRONG_INSTRUCTION', '対象サイクルが一致しません。');
            if (command.kind === 'issue') {
                event.kind = 'issued';
            } else {
                if (!record) fail('NOT_FOUND', '変更する指示がありません。');
                for (const key of ['planId', 'cycleId', 'standId', 'donorRoleId', 'recipientRoleId']) {
                    if (view.definition[key] !== definition[key]) fail('PAIR_CHANGE', '組替対象の変更は既存指示へ自動適用できません。');
                }
                if (view.definition.assemblySchedule !== undefined && definition.assemblySchedule === undefined) {
                    fail('INVALID_PLAN', '組替作業日・夜勤予定を省略せず、変更内容を確認してください。');
                }
                event.kind = 'plan_revised'; event.reason = text(payload.reason, '変更理由', 700);
            }
            event.definition = definition;
        } else {
            if (!record) fail('NOT_FOUND', '対象の指示がありません。');
            if (command.kind === 'record_actual') {
                fields(payload, ['stage', 'on', 'source']);
                if (!stages.includes(payload.stage)) fail('INVALID_INPUT', '作業区分を確認してください。');
                if (view.actualEventIds[payload.stage]) fail('ALREADY_RECORDED', '記録済みの実績です。同じ実績の訂正を使用してください。');
                if (Object.keys(view.blockers).length) fail('UNRESOLVED', '未解決の問題があります。先に対応結果を記録してください。');
                event.kind = 'actual_recorded'; event.stage = payload.stage; event.on = date(payload.on);
                if (payload.source !== undefined) {
                    const source = payload.source;
                    fields(source, ['kind', 'cycleId', 'donorRoleId', 'recipientRoleId', 'fromStatus', 'toStatus',
                        'rolesRevision', 'operatorId', 'operatorName']);
                    if (payload.stage !== 'prepared' || source.kind !== 'roll_status'
                        || !['新品予備（組替可能）', '新品予備保管'].includes(source.fromStatus)
                        || source.toStatus !== '新品予備（組込完了）') fail('INVALID_INPUT', '工作完了の状態変更が不正です。');
                    for (const key of ['cycleId', 'donorRoleId', 'recipientRoleId']) {
                        if (source[key] !== view.definition[key]) fail('WRONG_INSTRUCTION', '状態変更と組替指示の対象が一致しません。');
                    }
                    text(source.rolesRevision, 'ロール取得版', 1000);
                    text(source.operatorId, '担当者ID'); text(source.operatorName, '担当者名');
                    event.source = copy(source);
                }
            } else if (command.kind === 'correct_actual') {
                fields(payload, ['targetEventId', 'on', 'reason']);
                if (!stages.some(s => view.actualEventIds[s] === payload.targetEventId)) fail('NOT_FOUND', '訂正対象の実績がありません。');
                event.kind = 'actual_corrected'; event.targetEventId = payload.targetEventId;
                event.on = payload.on === null ? null : date(payload.on);
                event.reason = text(payload.reason, '訂正理由', 700);
            } else if (command.kind === 'review_deadline_impact') {
                fields(payload, ['reason']);
                const verified = taskView(record, record, today, context.effectReceipts || []);
                if (verified.assemblyTask !== 'completed' || !view.actuals.prepared || view.actuals.prepared > today) {
                    fail('UNCONFIRMED', '組込完了・反映確認と未解決事項の対応が必要です。');
                }
                if (view.actuals.prepared <= view.definition.readyBy) fail('NOT_LATE', '期限超過の完了ではありません。');
                if (view.deadlineReview) fail('ALREADY_REVIEWED', 'この期限超過は対応記録済みです。最新状態を取得してください。');
                event.kind = 'deadline_impact_reviewed'; event.on = today;
                event.reason = text(payload.reason, '影響確認・対応内容', 700);
                event.basisRevision = record.revision; event.readyBy = view.definition.readyBy;
                event.preparedOn = view.actuals.prepared; event.preparedEventId = view.actualEventIds.prepared;
            } else if (command.kind === 'acknowledge') {
                fields(payload, []); event.kind = 'acknowledged';
            } else if (command.kind === 'block' || command.kind === 'resolve_blocker') {
                fields(payload, ['blockerId', 'reason']);
                event.blockerId = text(payload.blockerId, '問題ID');
                event.reason = text(payload.reason, '理由', 700);
                if (command.kind === 'resolve_blocker' && !Object.prototype.hasOwnProperty.call(view.blockers, event.blockerId)) {
                    fail('NOT_FOUND', '未解決の対象がありません。');
                }
                event.kind = command.kind === 'block' ? 'blocked' : 'blocker_resolved';
            } else fail('INVALID_INPUT', '未対応の操作です。');
            if (event.on && event.on > today) fail('FUTURE_ACTUAL', '未来の日付は実績として記録できません。');
        }
        const next = record ? copy(record) : { schemaVersion: 1, id: command.instructionId, revision: 0, events: [] };
        next.events.push(event); next.revision += 1;
        project(next); // Validate chronology after corrections, including blank corrections.
        return { record: next, changed: true, replayed: false };
    }
    function reflectionRevision(record) {
        // Only this metadata-only event can inherit the prior reflection proof.
        // Plan edits, corrections and blockers must not inherit old receipts.
        let revision = record.revision;
        while (revision > 0 && record.events[revision - 1].kind === 'deadline_impact_reviewed') revision--;
        return revision;
    }
    function taskView(record, confirmedRecord, asOf, effectReceipts = []) {
        date(asOf);
        const view = project(record);
        const recordVerified = Boolean(confirmedRecord && stable(record) === stable(confirmedRecord));
        // Receipts must be supplied by the server after verifying each projection.
        // Saving this instruction alone does not prove Roles/history-sheet reflection.
        const effectsVerified = ['roles', 'rollHistory'].every(target => {
            const matches = effectReceipts.filter(receipt => receipt.target === target);
            return matches.length === 1 && matches[0].instructionId === record.id
                && matches[0].instructionRevision === reflectionRevision(record) && matches[0].state === 'verified';
        });
        const reflected = recordVerified && effectsVerified;
        const unresolved = Object.keys(view.blockers).length > 0;
        const done = Boolean(view.actuals.prepared) && !unresolved;
        return { instructionId: record.id, revision: record.revision, ...view,
            reflection: reflected ? 'verified' : recordVerified ? 'partial' : 'unconfirmed',
            assemblyTask: done && reflected ? 'completed' : done ? 'pending_confirmation' : 'active',
            overdue: !view.actuals.prepared && view.definition.readyBy < asOf,
            preparedLate: Boolean(view.actuals.prepared && view.actuals.prepared > view.definition.readyBy) };
    }
    return { instructionIdFor, assemblySchedule, apply, project, taskView, reflectionRevision };
});
