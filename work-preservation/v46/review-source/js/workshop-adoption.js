(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./workshop-instructions'));
    else root.RollWorkshopAdoption = factory(root.RollWorkshopInstructions);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (instructions) {
    'use strict';
    const copy = value => JSON.parse(JSON.stringify(value));
    const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
        : value && typeof value === 'object' ? '{' + Object.keys(value).sort()
            .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}' : JSON.stringify(value);
    function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
    function text(value, label, max = 100) {
        if (typeof value !== 'string' || !value || value !== value.trim() || value.length > max) fail('INVALID_INPUT', label + 'を確認してください。');
        return value;
    }
    function fields(value, allowed) {
        if (!value || typeof value !== 'object' || Array.isArray(value)
            || Object.keys(value).some(key => !allowed.includes(key))) fail('INVALID_INPUT', '計画の入力項目を確認してください。');
    }
    function project(record) {
        if (!record || record.schemaVersion !== 1 || !Array.isArray(record.events) || !record.events.length
            || record.revision !== record.events.length || record.events[0].kind !== 'draft_saved') {
            fail('INVALID_RECORD', '採用計画の記録が不正です。');
        }
        const view = { draft: null, adoption: null, knownItems: new Map() }, ids = new Set(), requests = new Set();
        for (const event of record.events) {
            if (!event.id || ids.has(event.id) || !event.requestId || requests.has(event.requestId)) fail('INVALID_RECORD', '計画履歴IDが不正です。');
            ids.add(event.id); requests.add(event.requestId);
            if (event.kind === 'draft_saved') {
                if (!Array.isArray(event.items) || !event.planVersionId) fail('INVALID_RECORD', '計画原案が不正です。');
                const itemIds = new Set(), cycles = new Set();
                for (const item of event.items) {
                    if (!item.id || !item.cycleId || itemIds.has(item.id) || cycles.has(item.cycleId)) fail('INVALID_RECORD', '計画項目が重複しています。');
                    const known = view.knownItems.get(item.id);
                    if (known && known.cycleId !== item.cycleId) fail('INVALID_RECORD', '準備サイクルが変わっています。');
                    itemIds.add(item.id); cycles.add(item.cycleId); view.knownItems.set(item.id, copy(item));
                }
                view.draft = { planId: record.id, planVersionId: event.planVersionId, items: copy(event.items) };
            } else if (event.kind === 'adopted') {
                if (!view.draft || event.planVersionId !== view.draft.planVersionId) fail('INVALID_RECORD', '採用版が原案と一致しません。');
                view.adoption = { ...copy(view.draft), id: event.adoptionId, status: 'adopted', adoptedBy: event.actorId, adoptedAt: event.recordedAt };
            } else fail('INVALID_RECORD', '未対応の計画履歴です。');
        }
        return view;
    }
    function apply(record, command, context) {
        if (!context || !context.actor || !['editor', 'admin'].includes(context.actor.role)) fail('FORBIDDEN', '編集権限がありません。');
        text(context.actor.id, '認証利用者ID', 180);
        if (typeof context.now !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(context.now) || !Number.isFinite(Date.parse(context.now))) fail('INVALID_INPUT', '記録日時が不正です。');
        text(command.planId, '計画ID'); text(command.requestId, '要求ID');
        const fingerprint = stable({ actorId: context.actor.id, kind: command.kind, payload: command.payload });
        const view = record ? project(record) : { draft: null, adoption: null, knownItems: new Map() };
        if (record && record.id !== command.planId) fail('WRONG_PLAN', '計画IDが一致しません。');
        const previous = record && record.events.find(event => event.requestId === command.requestId);
        if (previous) {
            if (previous.fingerprint !== fingerprint) fail('REQUEST_REUSED', '同じ要求IDに別の変更が指定されています。');
            return { record: copy(record), changed: false, replayed: true };
        }
        if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== (record ? record.revision : 0)) {
            fail('CONFLICT', '計画が更新されています。最新の内容を確認してください。');
        }
        const revision = (record ? record.revision : 0) + 1;
        const event = { id: command.planId + ':event:' + command.requestId, requestId: command.requestId,
            fingerprint, actorId: context.actor.id, recordedAt: context.now };
        if (command.kind === 'save_draft') {
            fields(command.payload, ['items', 'reason']);
            if (!Array.isArray(command.payload.items)) fail('INVALID_INPUT', '原案の項目を確認してください。');
            event.reason = text(command.payload.reason, '変更理由', 700);
            const seen = new Set(), allIds = new Set(view.knownItems.keys());
            const allCycles = new Set([...view.knownItems.values()].map(item => item.cycleId));
            event.items = command.payload.items.map(item => {
                fields(item, ['id', 'standId', 'donorRoleId', 'recipientRoleId', 'readyBy', 'assemblySchedule']);
                let itemId = item.id, cycleId;
                if (itemId !== undefined) {
                    const known = view.knownItems.get(text(itemId, '計画項目ID'));
                    if (!known) fail('UNKNOWN_ITEM', '既存の計画項目IDを確認してください。');
                    cycleId = known.cycleId;
                } else {
                    if (typeof context.makeId !== 'function') fail('INVALID_INPUT', 'サーバー側のID生成が必要です。');
                    itemId = text(context.makeId(), '生成項目ID'); cycleId = text(context.makeId(), '生成サイクルID');
                    if (allIds.has(itemId) || allCycles.has(cycleId)) fail('DUPLICATE_ID', '生成IDが重複しています。');
                    allIds.add(itemId); allCycles.add(cycleId);
                }
                if (seen.has(itemId)) fail('INVALID_INPUT', '計画項目が重複しています。');
                seen.add(itemId);
                // Missing information stays null in drafts. Issuance validates
                // complete dates/pairs; never replace unknown duration/date with 0.
                const result = { id: itemId, cycleId, standId: item.standId ?? null, donorRoleId: item.donorRoleId ?? null,
                    recipientRoleId: item.recipientRoleId ?? null, readyBy: item.readyBy ?? null };
                if (item.assemblySchedule !== undefined) result.assemblySchedule = instructions.assemblySchedule(item.assemblySchedule);
                else if (item.id !== undefined && view.knownItems.get(item.id).assemblySchedule !== undefined) {
                    fail('INVALID_INPUT', '既存の組替作業日・夜勤予定を省略できません。未確認への変更も根拠とともに記録してください。');
                }
                return result;
            });
            event.kind = 'draft_saved'; event.planVersionId = command.planId + ':v' + revision;
        } else if (command.kind === 'adopt') {
            fields(command.payload, ['planVersionId']);
            if (!view.draft || command.payload.planVersionId !== view.draft.planVersionId) fail('WRONG_PLAN_VERSION', '採用する原案の版が一致しません。');
            if (view.adoption && view.adoption.planVersionId === view.draft.planVersionId) {
                return { record: copy(record), changed: false, replayed: true };
            }
            event.kind = 'adopted'; event.planVersionId = view.draft.planVersionId;
            event.adoptionId = command.planId + ':adoption:' + revision;
        } else fail('INVALID_INPUT', '未対応の計画操作です。');
        const next = record ? copy(record) : { schemaVersion: 1, id: command.planId, revision: 0, events: [] };
        next.events.push(event); next.revision = revision; project(next);
        return { record: next, changed: true, replayed: false };
    }
    return { apply, project };
});
