const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/workshop-api-fixture.cjs');
const domain = require('../js/workshop-instructions');
const board = require('../js/workshop-board');
const { createSessionFence } = require('../js/identity');
function setup({ complete = true, readyBy = '2026-10-24' } = {}) {
    const h = fixture(), issued = h.issue({ readyBy });
    if (complete) h.ok({ action: 'completeworkshop', request: issued.request });
    const snapshot = () => h.ok({ action: 'fetchworkshop' });
    const request = () => ({ instructionId: issued.instruction.id, requestId: 'impact-1',
        expectedRevision: snapshot().instructions[0].revision, reason: '予備の使用可否を確認し、工作と準備完了を確認した。' });
    const review = req => h.post({ action: 'reviewworkshopdeadline', request: req || request() });
    return { h, issued, snapshot, request, review };
}
function replaceRecord(h, record) {
    h.state.tables.get('_WorkshopInstructions_v1').rows[1] = [record.id, JSON.stringify(record)];
}
test('late impact review stores actor/date/reason, preserves roll history and closes only the reviewed warning', () => {
    const x = setup(), before = structuredClone(x.h.state.roles), request = x.request();
    assert.equal(board.select(board.model(x.snapshot())).length, 1);
    const result = x.review(request); assert.equal(result.success, true, result.error);
    const snapshot = x.snapshot(), view = domain.project(snapshot.instructions[0]);
    assert.equal(view.deadlineReview.actorId, 'google:fixture');
    assert.equal(view.deadlineReview.on, '2026-10-25');
    assert.equal(view.deadlineReview.reason, request.reason);
    assert.equal(view.definition.readyBy, '2026-10-24'); assert.equal(view.actuals.prepared, '2026-10-25');
    assert.equal(snapshot.tasks[0].reflection, 'verified');
    assert.equal(board.select(board.model(snapshot)).length, 0);
    assert.equal(board.select(board.model(snapshot), { completed: true }).length, 1);
    assert.deepEqual(x.h.state.roles, before);
    const writes = x.h.state.writes;
    assert.equal(x.review(request).success, true); assert.equal(x.h.state.writes, writes);
    assert.equal(x.snapshot().instructions[0].events.length, 3);
});
test('reader, extra fields, empty reason, stale revision and not-late work cannot close a warning', () => {
    for (const bad of [r => ({ ...r, reason: '' }), r => ({ ...r, reason: ' '.repeat(5) }),
        r => ({ ...r, reason: 'x'.repeat(701) }), r => ({ ...r, actorId: 'forged' }),
        r => ({ ...r, expectedRevision: 1 })]) {
        const x = setup(), req = bad(x.request()), writes = x.h.state.writes;
        assert.equal(x.review(req).success, false); assert.equal(x.h.state.writes, writes);
    }
    const x = setup(), req = x.request(); x.h.state.principal.role = 'reader';
    assert.equal(x.review(req).success, false);
    const onTime = setup({ readyBy: '2026-10-30' }); assert.equal(onTime.review().success, false);
});
test('uncompleted, pending reflection and missing roll data refuse a review without hiding work', () => {
    const x = setup({ complete: false }); assert.equal(x.review().success, false);
    x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    assert.equal(x.review().success, false);
    assert.equal(board.select(board.model(x.snapshot())).length, 1);
    const missing = setup(); missing.h.state.roles = missing.h.state.roles.filter(r => r.id !== 'C');
    assert.equal(missing.review().success, false);
});
test('only a review-only suffix inherits matching immutable completion receipts', () => {
    const x = setup(); assert.equal(x.review().success, true);
    const snapshot = x.snapshot(), record = snapshot.instructions[0];
    record.events[0].definition.readyBy = '2026-10-23';
    record.events[2].readyBy = '2026-10-23'; // Valid review shape, but receipt prefix differs.
    replaceRecord(x.h, record);
    const changed = x.snapshot();
    assert.equal(changed.tasks[0].reflection, 'partial');
    assert.equal(board.model(changed).items[0].completed, false);
});
test('later actual corrections, deadline changes and new problems invalidate the review and reopen work', () => {
    for (const kind of ['correct_actual', 'revise_plan', 'block']) {
        const x = setup(); assert.equal(x.review().success, true);
        const record = x.snapshot().instructions[0], view = domain.project(record);
        const context = { actor: { id: 'other-editor', role: 'editor' }, today: '2026-10-25', now: '2026-10-25T10:00:00Z' };
        let payload;
        if (kind === 'correct_actual') payload = { targetEventId: view.actualEventIds.prepared, on: '2026-10-25', reason: '実績の再確認' };
        if (kind === 'block') payload = { blockerId: 'new-check', reason: '追加点検が必要' };
        if (kind === 'revise_plan') {
            context.adoption = { id: 'revised', status: 'adopted', planId: view.definition.planId,
                planVersionId: 'v2', items: [{ ...view.definition, id: view.definition.planItemId, readyBy: '2026-10-23' }] };
            payload = { adoptionId: 'revised', planItemId: view.definition.planItemId, reason: '期限を訂正' };
        }
        const next = domain.apply(record, { instructionId: record.id, requestId: 'change', expectedRevision: record.revision, kind, payload }, context).record;
        replaceRecord(x.h, next);
        assert.equal(domain.project(next).deadlineReview, null);
        assert.equal(next.events.filter(e => e.kind === 'deadline_impact_reviewed').length, 1);
        assert.equal(board.model(x.snapshot()).items[0].completed, false);
        assert.equal(x.review({ ...x.request(), requestId: 'impact-2' }).success, false); // New reflection must be checked.
    }
});
test('acknowledgement is not an impact review; malformed review basis is rejected', () => {
    const x = setup(), record = x.snapshot().instructions[0];
    const ctx = { actor: { id: 'fixture', role: 'editor' }, today: '2026-10-25', now: '2026-10-25T10:00:00Z' };
    const acknowledged = domain.apply(record, { instructionId: record.id, requestId: 'read', expectedRevision: record.revision,
        kind: 'acknowledge', payload: {} }, ctx).record;
    assert.equal(domain.project(acknowledged).deadlineReview, null);
    assert.equal(x.review().success, true);
    const reviewed = x.snapshot().instructions[0]; reviewed.events.at(-1).basisRevision = 99;
    assert.throws(() => domain.project(reviewed), /一致しません/);
});
test('lost write response is recovered by the same request without duplicate reviews', () => {
    const x = setup(), req = x.request();
    const table = x.h.state.tables.get('_WorkshopInstructions_v1'), original = table.getRange;
    let once = true;
    table.getRange = (...args) => { const range = original(...args); return { ...range, setValues(values) {
        range.setValues(values); if (once) { once = false; throw new Error('saved then disconnected'); }
    } }; };
    assert.equal(x.review(req).success, false);
    assert.equal(x.review(req).success, true);
    assert.equal(x.snapshot().instructions[0].events.filter(e => e.kind === 'deadline_impact_reviewed').length, 1);
});
test('controller preserves evidence on lost response and fetch discovers the saved review', async () => {
    const x = setup(), fence = createSessionFence(), states = [], sent = [];
    let lose = true;
    const ports = { captureSession: fence.capture, role: () => 'editor', makeId: () => 'client-impact',
        publish: s => states.push(s), call: async payload => {
            sent.push(payload); const result = x.h.post(payload);
            if (!result.success) throw new Error(result.error);
            if (payload.action === 'reviewworkshopdeadline' && lose) { lose = false; throw new Error('応答消失'); }
            return result.result;
        } };
    const controller = board.create(ports); await controller.refresh();
    await assert.rejects(controller.reviewDeadline(x.issued.instruction.id, '予備確保と対応完了を確認'), /応答消失/);
    assert.equal(states.at(-1).model.items[0].completed, false);
    assert.equal((await controller.refresh()).model.items[0].completed, true);
    assert.equal(sent.filter(s => s.action === 'reviewworkshopdeadline').length, 1);
});
test('old completion retry after a review returns current instruction without rewriting any rolls', () => {
    const x = setup(); assert.equal(x.review().success, true);
    const writes = x.h.state.writes, roles = structuredClone(x.h.state.roles);
    const result = x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    assert.equal(result.instruction.revision, 3);
    assert.equal(x.h.state.writes, writes); assert.deepEqual(x.h.state.roles, roles);
    assert.equal(board.model(x.snapshot()).items[0].completed, true);
});
test('server refuses a changed reason with the same request ID and refuses a second review', () => {
    const x = setup(), req = x.request(); assert.equal(x.review(req).success, true);
    const writes = x.h.state.writes;
    assert.equal(x.review({ ...req, reason: '別の内容' }).success, false);
    assert.equal(x.review({ ...x.request(), requestId: 'duplicate' }).success, false);
    assert.equal(x.h.state.writes, writes);
});
test('controller retries the same unsaved request after refresh and fences responses after logout', async () => {
    const x = setup(), fence = createSessionFence(), states = [], ids = [];
    let failBeforeSave = true, serial = 0;
    const ports = { captureSession: fence.capture, role: () => 'editor', makeId: () => 'retry-' + ++serial,
        publish: s => states.push(s), call: async payload => {
            if (payload.action === 'reviewworkshopdeadline') {
                ids.push(payload.request.requestId);
                if (failBeforeSave) { failBeforeSave = false; throw new Error('未送信'); }
            }
            const r = x.h.post(payload); if (!r.success) throw new Error(r.error); return r.result;
        } };
    const controller = board.create(ports); await controller.refresh();
    await assert.rejects(controller.reviewDeadline(x.issued.instruction.id, '予備の影響を確認した'), /未送信/);
    await controller.refresh();
    assert.equal((await controller.reviewDeadline(x.issued.instruction.id, '予備の影響を確認した')).model.items[0].completed, true);
    assert.deepEqual(ids, ['retry-1', 'retry-1']);
    const y = setup();
    ports.call = async payload => { const r = y.h.post(payload); fence.invalidate(); return r.result; };
    const count = states.length;
    await assert.rejects(board.create(ports).refresh(), e => e.code === 'AUTH_SESSION_CHANGED');
    assert.equal(states.slice(count).some(s => s.phase === 'ready'), false);
});
