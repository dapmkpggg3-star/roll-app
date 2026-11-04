(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./workshop-instructions'));
    else root.RollWorkshopBoard = factory(root.RollWorkshopInstructions);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(domain) {
    'use strict';
    const copy = value => JSON.parse(JSON.stringify(value));
    const fail = () => { throw new Error('工作指示の確認情報が不足・不整合です。0件とは扱わず、再取得してください。'); };
    function unique(rows, key) {
        const map = new Map();
        for (const row of rows) {
            if (!row || row[key] == null || !String(row[key]) || map.has(String(row[key]))) fail();
            map.set(String(row[key]), row);
        }
        return map;
    }
    function model(snapshot) {
        if (!snapshot || !['instructions', 'tasks', 'roles', 'pendingOperations'].every(key => Array.isArray(snapshot[key]))
            || !snapshot.rolesRevision || !snapshot.checkedAt || !Number.isFinite(Date.parse(snapshot.checkedAt))) fail();
        const asOf = new Date(Date.parse(snapshot.checkedAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const records = unique(snapshot.instructions, 'id'), tasks = unique(snapshot.tasks, 'instructionId');
        const roles = unique(snapshot.roles, 'id'), operations = unique(snapshot.pendingOperations, 'id');
        if (records.size !== tasks.size) fail();
        for (const op of operations.values()) {
            if (!records.has(op.instructionId) || !['pending', 'blocked'].includes(op.status)) fail();
        }
        const items = [...records.values()].map(record => {
            const projected = domain.project(record), task = tasks.get(record.id);
            if (!task || task.revision !== record.revision
                || !['active', 'pending_confirmation', 'completed'].includes(task.assemblyTask)
                || !['verified', 'partial', 'unconfirmed'].includes(task.reflection)) fail();
            const pending = [...operations.values()].filter(op => op.instructionId === record.id);
            const blockers = Object.values(projected.blockers);
            // Never allow an inconsistent completion classification to hide a task.
            if (task.assemblyTask === 'completed' && (!projected.actuals.prepared || blockers.length || task.reflection !== 'verified')) fail();
            if (task.assemblyTask === 'pending_confirmation' && (!projected.actuals.prepared || blockers.length)) fail();
            const def = projected.definition;
            const missingRole = !roles.has(def.donorRoleId) || !roles.has(def.recipientRoleId);
            if (missingRole) blockers.push('指示対象のロール情報が不足しています。');
            const schedule = def.assemblySchedule;
            const prepared = projected.actuals.prepared;
            const invalidActual = Boolean(prepared && prepared > asOf);
            if (invalidActual) blockers.push('組込完了日が確認時点より未来です。実績日を確認してください。');
            const assemblyVerified = Boolean(prepared && !invalidActual && task.reflection === 'verified'
                && pending.length === 0 && !missingRole);
            // readyBy is the adopted instruction deadline. A tentative workDate
            // is neither an actual start nor a deadline; moving it is not lateness.
            const deadline = { basis: 'adopted_instruction', on: def.readyBy,
                state: invalidActual ? 'invalid_actual' : assemblyVerified
                    ? prepared > def.readyBy ? 'completed_late' : 'completed_in_time'
                    : def.readyBy < asOf ? 'overdue_unconfirmed' : def.readyBy === asOf ? 'due_today' : 'upcoming' };
            const deadlineReview = projected.deadlineReview;
            const impactReviewed = Boolean(deadlineReview && deadlineReview.on <= asOf);
            const deadlineNeedsAttention = deadline.state === 'completed_late' ? !impactReviewed
                : ['overdue_unconfirmed', 'invalid_actual'].includes(deadline.state);
            const workSchedule = { workDate: schedule?.workDate || null, nightProduction: schedule?.nightProduction || 'unknown',
                state: !schedule?.workDate ? 'unscheduled' : prepared ? 'recorded'
                    : schedule.workDate < asOf ? 'past_plan' : schedule.workDate === asOf ? 'planned_today' : 'planned',
                actualStartKnown: false, sameDayMet: null, readinessAssessed: false };
            const roleLabel = id => roles.get(id)?.name || 'ロール情報未取得（' + id + '）';
            return { id: record.id, revision: record.revision, standId: def.standId,
                donor: roleLabel(def.donorRoleId), recipient: roleLabel(def.recipientRoleId), recipientRoleId: def.recipientRoleId,
                readyBy: def.readyBy, deadline, deadlineReview, impactReviewed, workSchedule, assemblyVerified,
                canReviewDeadline: deadline.state === 'completed_late' && assemblyVerified && !blockers.length && !impactReviewed,
                assemblySchedule: schedule ? copy(schedule) : null, prepared, blockers, pending: copy(pending),
                completed: task.assemblyTask === 'completed' && assemblyVerified && !blockers.length && !deadlineNeedsAttention,
                label: pending.length ? '反映確認待ち' : blockers.length ? '要対応'
                    : deadline.state === 'completed_late' ? impactReviewed ? '組込完了・期限超過の対応記録済み' : '組込完了・期限超過の影響要確認'
                    : deadline.state === 'overdue_unconfirmed' ? '準備期限超過・完了未確認' : task.assemblyTask === 'completed'
                    ? '組込完了・反映確認済み' : task.assemblyTask === 'pending_confirmation' ? '反映確認待ち' : '組替待ち' };
        });
        return { checkedAt: snapshot.checkedAt, asOf, items };
    }
    function select(model, { standId = 'all', completed = false } = {}) {
        return model.items.filter(item => (standId === 'all' || item.standId === standId) && item.completed === completed)
            .sort((a, b) => a.readyBy.localeCompare(b.readyBy) || a.id.localeCompare(b.id));
    }
    // This controller never replaces local roll data or clears durable completion
    // requests. Recovery reuses the server journal and requires explicit action.
    function create(ports) {
        let state = { phase: 'idle', model: null, error: '' }, busy = false;
        const reviewRequests = new Map();
        const session = ports.captureSession();
        const publish = () => { session.assertCurrent(); ports.publish(copy(state)); };
        async function run(operationId, reviewRequest) {
            session.assertCurrent();
            if (busy) throw new Error('工作指示を確認中です。少し待ってください。');
            if (operationId) {
                if (!['editor', 'admin'].includes(ports.role())) throw new Error('反映の再確認には編集権限が必要です。');
                if (state.phase !== 'ready' || !state.model.items.some(item => item.pending.some(op => op.id === operationId))) {
                    throw new Error('最新の未反映操作を取得してから再確認してください。');
                }
            }
            if (reviewRequest) {
                if (!['editor', 'admin'].includes(ports.role())) throw new Error('対応記録には編集権限が必要です。');
                if (state.phase !== 'ready' || !state.model.items.some(item => item.id === reviewRequest.instructionId
                    && item.revision === reviewRequest.expectedRevision && item.canReviewDeadline)) {
                    throw new Error('最新の指示と期限超過を取得してから記録してください。');
                }
            }
            busy = true;
            const previousModel = state.model;
            state = { ...state, phase: 'loading', error: '' }; publish();
            try {
                let receipt;
                if (operationId) {
                    receipt = await ports.call({ action: 'resumeworkshop', operationId });
                    session.assertCurrent();
                }
                if (reviewRequest) {
                    receipt = await ports.call({ action: 'reviewworkshopdeadline', request: reviewRequest });
                    session.assertCurrent();
                }
                const snapshot = await ports.call({ action: 'fetchworkshop' });
                const next = model(snapshot);
                session.assertCurrent();
                state = { phase: 'ready', model: next, error: '' };
                if (operationId) {
                    const stillPending = next.items.some(item => item.pending.some(op => op.id === operationId));
                    if (stillPending) state.error = 'まだ反映が完了していません。対象の指示を残しています。';
                    else if (!receipt || receipt.operationId !== operationId || receipt.status !== 'complete'
                        || !receipt.instruction || !next.items.some(item => item.id === receipt.instruction.id
                            && item.revision >= receipt.instruction.revision)
                        || !['roles', 'rollHistory'].every(target => receipt.effectReceipts?.some(effect =>
                            effect.target === target && effect.state === 'verified' && effect.operationId === operationId
                            && effect.instructionId === receipt.instruction.id && effect.instructionRevision === domain.reflectionRevision(receipt.instruction)))) {
                        throw new Error('再確認の結果を照合できません。最新状態を再取得してください。');
                    }
                }
                if (reviewRequest) {
                    const record = snapshot.instructions.find(item => item.id === reviewRequest.instructionId);
                    const event = record?.events.find(item => item.requestId === reviewRequest.requestId
                        && item.kind === 'deadline_impact_reviewed' && item.reason === reviewRequest.reason);
                    if (!receipt?.record || receipt.record.id !== reviewRequest.instructionId || !event
                        || record.revision < receipt.record.revision) {
                        throw new Error('対応記録の保存結果を確認できません。最新の指示を再取得してください。');
                    }
                    reviewRequests.delete(reviewRequest.instructionId);
                }
                publish(); return copy(state);
            } catch (error) {
                if (session.isCurrent()) { state = { model: previousModel, phase: 'error', error: error.message }; publish(); }
                throw error;
            } finally { busy = false; }
        }
        return { refresh: () => run(), resume: id => run(id), isCurrent: session.isCurrent,
            reviewDeadline(id, reason) {
                session.assertCurrent();
                const row = state.model?.items.find(item => item.id === id);
                reason = typeof reason === 'string' ? reason.trim() : '';
                if (!reason || reason.length > 700) return Promise.reject(new Error('影響確認・対応内容を1〜700文字で入力してください。'));
                const saved = reviewRequests.get(id);
                const request = saved && saved.expectedRevision === row?.revision && saved.reason === reason ? saved : {
                    instructionId: id, requestId: ports.makeId(), expectedRevision: row?.revision, reason };
                reviewRequests.set(id, request);
                return run(null, request);
            } };
    }
    return { model, select, create };
});
