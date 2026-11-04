const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/workshop-api-fixture.cjs');
const board = require('../js/workshop-board');
const { createSessionFence } = require('../js/identity');
const clone = value => JSON.parse(JSON.stringify(value));
function setup() {
    const h = fixture(), issued = h.issue(), fence = createSessionFence();
    const states = [], sent = [];
    const ports = { captureSession: fence.capture, role: () => h.state.principal.role,
        publish: state => states.push(state), call: async payload => {
            sent.push(clone(payload)); const response = h.post(payload);
            if (!response.success) throw new Error(response.error); return response.result;
        } };
    return { h, issued, fence, states, sent, ports, create: () => board.create(ports),
        snapshot: () => h.ok({ action: 'fetchworkshop' }) };
}
test('formal board reads issued instructions, preserving candidate-independent counts and stand filter', () => {
    const x = setup(), model = board.model(x.snapshot());
    assert.equal(model.items[0].label, '組替待ち');
    assert.equal(model.items[0].donor, '#14-901');
    assert.equal(model.items[0].recipient, '#14-903');
    assert.equal(board.select(model).length, 1);
    assert.equal(board.select(model, { standId: '15' }).length, 0);
    assert.equal(board.select(model, { completed: true }).length, 0);
});
test('partial history reflection stays active; explicit journal retry moves only verified work to completed', async () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const controller = x.create(), state = await controller.refresh();
    const operationId = state.model.items[0].pending[0].id;
    assert.equal(board.select(state.model).length, 1);
    const online = clone(x.h.state.roles[1]);
    await assert.rejects(controller.resume(operationId), /履歴表/);
    assert.equal(x.states.at(-1).model.items[0].completed, false);
    await controller.refresh();
    x.h.state.stale = false;
    const result = await controller.resume(operationId);
    assert.equal(board.select(result.model).length, 0);
    assert.equal(board.select(result.model, { completed: true }).length, 1);
    assert.deepEqual(x.h.state.roles[1], online);
    assert.equal(x.h.state.roles[0].history.length, 1); assert.equal(x.h.state.roles[2].history.length, 1);
    assert.deepEqual(x.sent.filter(p => p.action === 'resumeworkshop').map(p => p.operationId), [operationId, operationId]);
});
test('read failure retains previous pending instruction and is never represented as zero', async () => {
    const x = setup(), controller = x.create(); await controller.refresh();
    x.ports.call = async () => { throw new Error('通信切断'); };
    await assert.rejects(controller.refresh(), /通信切断/);
    const last = x.states.at(-1); assert.equal(last.phase, 'error'); assert.equal(last.model.items.length, 1);
});
test('logout fences all late responses; a new controller can start a fresh session', async () => {
    const x = setup(), call = x.ports.call;
    x.ports.call = async payload => { const response = await call(payload); x.fence.invalidate(); return response; };
    await assert.rejects(x.create().refresh(), e => e.code === 'AUTH_SESSION_CHANGED');
    assert.equal(x.states.filter(s => s.phase === 'ready').length, 0);
    x.ports.call = call; assert.equal((await x.create().refresh()).phase, 'ready');
});
test('reader may fetch but cannot resume; unknown operation is rejected before sending', async () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const controller = x.create(), state = await controller.refresh(), id = state.model.items[0].pending[0].id;
    x.h.state.principal.role = 'reader'; await assert.rejects(controller.resume(id), /編集権限/);
    x.h.state.principal.role = 'editor'; await assert.rejects(controller.resume('unknown'), /最新/);
    assert.equal(x.sent.filter(p => p.action === 'resumeworkshop').length, 0);
});
test('missing, duplicate, stale and inconsistent task data fail closed instead of hiding work', () => {
    const x = setup(), source = x.snapshot();
    for (const mutate of [s => s.tasks.pop(), s => s.tasks.push(s.tasks[0]), s => s.tasks[0].revision++,
        s => s.tasks[0].assemblyTask = 'completed', s => s.tasks[0].assemblyTask = 'unknown',
        s => s.pendingOperations.push({ id: 'op', instructionId: 'missing', status: 'pending' }),
        s => s.roles.push(s.roles[0]), s => s.checkedAt = 'invalid']) {
        const value = clone(source); mutate(value); assert.throws(() => board.model(value), /不足・不整合/);
    }
});
test('lost recovery response retains pending evidence; readback discovers server completion without new history', async () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const controller = x.create(), initial = await controller.refresh(), id = initial.model.items[0].pending[0].id;
    x.h.state.stale = false; const call = x.ports.call;
    x.ports.call = async payload => { const value = await call(payload); if (payload.action === 'resumeworkshop') throw new Error('応答消失'); return value; };
    await assert.rejects(controller.resume(id), /応答消失/);
    assert.equal(x.states.at(-1).model.items[0].pending[0].id, id);
    const writes = x.h.state.writes;
    assert.equal((await controller.refresh()).model.items[0].completed, true);
    assert.equal(x.h.state.writes, writes); assert.equal(x.h.state.roles[2].history.length, 1);
});
test('invalid recovery receipt preserves previous pending model even when readback is complete', async () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const controller = x.create(), initial = await controller.refresh(), id = initial.model.items[0].pending[0].id;
    const call = x.ports.call; x.h.state.stale = false;
    x.ports.call = async payload => { const response = await call(payload); if (payload.action === 'resumeworkshop') response.effectReceipts = []; return response; };
    await assert.rejects(controller.resume(id), /照合できません/);
    assert.equal(x.states.at(-1).model.items[0].pending[0].id, id);
});

test('missing roll information cannot hide a previously completed instruction', () => {
    const x = setup(); x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    const snapshot = x.snapshot(); snapshot.roles = snapshot.roles.filter(role => role.id !== 'C');
    const model = board.model(snapshot);
    assert.equal(board.select(model).length, 1);
    assert.equal(model.items[0].label, '要対応');
    assert.match(model.items[0].blockers[0], /情報が不足/);
});

test('a concurrent roll change blocks recovery and retains the instruction without overwriting the change', async () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const controller = x.create(), state = await controller.refresh(), id = state.model.items[0].pending[0].id;
    x.h.state.roles[2].memo = '他の担当者の変更'; x.h.state.stale = false;
    const result = await controller.resume(id);
    assert.equal(result.model.items[0].completed, false);
    assert.equal(result.model.items[0].pending[0].status, 'blocked');
    assert.equal(x.h.state.roles[2].memo, '他の担当者の変更');
});
