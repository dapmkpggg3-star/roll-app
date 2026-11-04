(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./workshop-instructions'));
    else root.RollWorkshopPlanLink = factory(root.RollWorkshopInstructions);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (domain) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
        : value && typeof value === 'object' ? '{' + Object.keys(value).sort()
            .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}' : JSON.stringify(value);
    function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
    function id(value) { return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 180; }

    // A pure server-side preparation step. Adoption MUST come from the shared
    // adopted-plan source under the save lock, never from request.adoption.
    // No row number, date, roll number or output timestamp is used as cycle ID.
    function prepare(records, request, context) {
        if (!context || !context.actor || !['editor', 'admin'].includes(context.actor.role)) {
            fail('FORBIDDEN', '編集権限がありません。');
        }
        const adoption = context && context.adoption;
        if (!adoption || adoption.status !== 'adopted' || !id(adoption.planId)
            || !Array.isArray(adoption.items)) fail('NOT_ADOPTED', '共有の採用計画と計画IDが必要です。');
        if (!Array.isArray(records) || !request || !id(request.requestId) || request.requestId.length > 70) {
            fail('INVALID_INPUT', '指示生成の入力を確認してください。');
        }
        const byId = new Map(), items = new Set(), cycles = new Set();
        for (const record of records) {
            domain.project(record);
            if (byId.has(record.id)) fail('DUPLICATE_INSTRUCTION', '共有指示IDが重複しています。');
            byId.set(record.id, record);
        }
        // Prevalidate the ENTIRE adopted set before producing any executable commands.
        const proposed = adoption.items.map((item, index) => {
            if (!item || !id(item.id) || !id(item.cycleId) || items.has(item.id) || cycles.has(item.cycleId)) {
                fail('INVALID_PLAN', '計画項目ID・準備サイクルIDが不足または重複しています。');
            }
            items.add(item.id); cycles.add(item.cycleId);
            const command = { instructionId: domain.instructionIdFor(item.cycleId), requestId: request.requestId + ':' + index,
                expectedRevision: 0, kind: 'issue', payload: { adoptionId: adoption.id, planItemId: item.id } };
            const record = domain.apply(null, command, context).record;
            return { command, record, definition: domain.project(record).definition };
        });
        const actions = [], problems = [], commands = [], replacements = new Map();
        for (const item of proposed) {
            const existing = byId.get(item.record.id);
            if (!existing) {
                actions.push({ instructionId: item.record.id, action: 'issue' });
                commands.push(item.command); replacements.set(item.record.id, item.record); continue;
            }
            const view = domain.project(existing);
            if (stable(view.definition) === stable(item.definition)) {
                actions.push({ instructionId: existing.id, action: 'unchanged' }); continue;
            }
            const identityKeys = ['planId', 'cycleId', 'standId', 'donorRoleId', 'recipientRoleId'];
            if (identityKeys.some(key => view.definition[key] !== item.definition[key])) {
                problems.push({ instructionId: existing.id, code: 'PAIR_CHANGE', message: '組替対象の差替え・取消しを確認してください。' });
                continue;
            }
            const reason = request.revisionReason;
            const expected = request.expectedRevisions && request.expectedRevisions[existing.id];
            if (typeof reason !== 'string' || !reason.trim() || expected !== existing.revision) {
                problems.push({ instructionId: existing.id, code: 'REVISION_REVIEW', message: '最新の指示版と計画変更理由の確認が必要です。' });
                continue;
            }
            const command = { ...item.command, kind: 'revise_plan', expectedRevision: expected,
                payload: { ...item.command.payload, reason } };
            const next = domain.apply(existing, command, context).record;
            commands.push(command); replacements.set(existing.id, next);
            actions.push({ instructionId: existing.id, action: 'revise' });
        }
        for (const record of records) {
            const view = domain.project(record);
            if (view.definition.planId === adoption.planId && !cycles.has(view.definition.cycleId)
                && (!view.actuals.prepared || Object.keys(view.blockers).length)) {
                problems.push({ instructionId: record.id, code: 'REMOVED_ACTIVE_INSTRUCTION',
                    message: '採用予定から外れた未完了指示があります。自動削除せず取消し・継続を確認してください。' });
            }
        }
        // A single invalid item blocks the whole batch before any shared write.
        if (problems.length) return { ready: false, actions, problems, commands: [], records: clone(records) };
        const nextRecords = records.map(record => replacements.get(record.id) || record);
        for (const [key, record] of replacements) if (!byId.has(key)) nextRecords.push(record);
        return { ready: true, actions, problems: [], commands, records: clone(nextRecords) };
    }
    return { prepare };
});
