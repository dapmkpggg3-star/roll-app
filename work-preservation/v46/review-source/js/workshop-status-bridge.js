(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./workshop-instructions'), require('./online-safety'));
    else root.RollWorkshopStatusBridge = factory(root.RollWorkshopInstructions, root.RollOnlineSafety);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (domain, safety) {
    'use strict';
    const READY = '新品予備（組替可能）', STORAGE = '新品予備保管', DONE = '新品予備（組込完了）';
    const USED = '中古予備（バラシ前）', OUTBOUND = '改削行き（搬出可能）';
    const copy = value => JSON.parse(JSON.stringify(value));
    function fail(code, message) { const e = new Error(message); e.code = code; throw e; }

    // Prepare one existing status-edit operation and its instruction completion.
    // No extra status / second completion button. No persistence or success receipt.
    // context.actor, operators and rolesRevision must be resolved on the SERVER.
    function prepare(roles, instruction, request, context) {
        if (!request || !context || !Array.isArray(context.operators)) fail('INVALID_INPUT', '担当者マスタを確認してください。');
        const operators = context.operators.filter(item => item.id === request.operatorId);
        if (operators.length !== 1) fail('INVALID_OPERATOR', '担当者を選択してください。');
        const view = domain.project(instruction), definition = view.definition;
        if (request.instructionId !== instruction.id || request.cycleId !== definition.cycleId
            || String(request.recipientRoleId) !== definition.recipientRoleId) {
            fail('WRONG_INSTRUCTION', '更新するロールと今回の組替指示が一致しません。');
        }
        if (request.toStatus !== DONE || ![READY, STORAGE].includes(request.fromStatus)) {
            fail('INVALID_STATUS_CHANGE', '組替可能なロールを組込完了にする更新だけが対象です。');
        }
        const source = { kind: 'roll_status', cycleId: definition.cycleId, donorRoleId: definition.donorRoleId,
            recipientRoleId: definition.recipientRoleId, fromStatus: request.fromStatus, toStatus: request.toStatus,
            rolesRevision: request.expectedRolesRevision, operatorId: operators[0].id, operatorName: operators[0].name };
        const command = { instructionId: instruction.id, requestId: request.requestId,
            expectedRevision: request.expectedInstructionRevision, kind: 'record_actual',
            payload: { stage: 'prepared', on: request.on, source } };
        const result = domain.apply(instruction, command, context);
        if (result.replayed) {
            // Never replay stale roll snapshots after the next rotation.
            // Pending projections must be recovered from the durable operation log.
            return { instruction: result.record, replayed: true, roleChanges: [], requiresReflectionCheck: true };
        }
        if (!request.expectedRolesRevision || request.expectedRolesRevision !== context.rolesRevision) {
            fail('CONFLICT', 'ロール一覧が取得後に更新されています。上書きせず最新状態を確認してください。');
        }
        if (!Array.isArray(roles)) fail('INVALID_ROLES', 'ロール一覧がありません。');
        const byId = new Map();
        for (const role of roles) {
            const id = role && role.id !== undefined && role.id !== null ? String(role.id) : '';
            if (!id || byId.has(id)) fail('INVALID_ROLES', 'ロールIDが不足または重複しています。');
            byId.set(id, role);
        }
        const donor = byId.get(definition.donorRoleId), recipient = byId.get(definition.recipientRoleId);
        if (!donor || !recipient || donor === recipient) fail('INVALID_PAIR', '指示の組替元・先が見つかりません。');
        if ([donor, recipient].some(role => safety.getStandKey(role.name) !== definition.standId)) {
            fail('WRONG_STAND', '指示と実ロールのスタンドが一致しません。');
        }
        if (donor.status !== USED || recipient.status !== request.fromStatus) {
            fail('STATUS_CHANGED', '指示の組替元・先の現在状態を確認してください。');
        }
        const stand = Number(definition.standId);
        if (recipient.status === STORAGE && stand >= 2 && stand <= 11 && recipient.coatingStatus !== 'coated') {
            fail('COATING_NOT_READY', '新品予備保管の溶射状態を確認してください。');
        }
        const event = result.record.events[result.record.events.length - 1];
        const roleChanges = [[donor, OUTBOUND], [recipient, DONE]].map(([before, status]) => {
            if (before.history !== undefined && !Array.isArray(before.history)) fail('INVALID_HISTORY', '履歴の形式を確認してください。');
            const after = copy(before);
            const entry = { id: event.id + ':role:' + String(before.id), at: event.recordedAt,
                roleName: before.name, type: 'status', label: 'ステータス変更', before: before.status, after: status,
                operator: { id: operators[0].id, name: operators[0].name }, authenticatedActorId: event.actorId,
                instructionId: instruction.id, cycleId: definition.cycleId, actualEventId: event.id };
            after.status = status; after.updatedAt = event.recordedAt;
            after.history = [...(after.history || []), entry];
            return { roleId: String(before.id), before: copy(before), after, historyEntry: entry };
        });
        return { instruction: result.record, replayed: false, roleChanges,
            roles: roles.map(role => copy(roleChanges.find(change => change.roleId === String(role.id))?.after || role)),
            requiresReflectionCheck: true };
    }
    return { prepare };
});
