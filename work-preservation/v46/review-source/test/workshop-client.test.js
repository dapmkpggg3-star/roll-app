const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/workshop-api-fixture.cjs');
const client = require('../js/workshop-client');
const { createSessionFence } = require('../js/identity');
const clone = x => JSON.parse(JSON.stringify(x));
function setup() {
    const h = fixture(), issued = h.issue(), storage = new Map(), fence = createSessionFence();
    const state = { local: clone(h.state.roles), accepted: 0, serial: 0, sent: [], lost: false, owner: 'google:fixture' };
    const ports = { owner: () => state.owner, captureSession: fence.capture,
        storage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
        localSnapshot: () => JSON.stringify(state.local), snapshot: JSON.stringify,
        makeId: () => 'client-' + ++state.serial,
        accept: snapshot => { state.local = clone(snapshot.roles); state.accepted++; },
        call: async payload => {
            state.sent.push(clone(payload));
            const response = h.post(payload);
            if (payload.action === 'completeworkshop' && state.lost) { state.lost = false; throw new Error('lost response'); }
            if (!response.success) { const e = new Error(response.error); e.workshopRejectedRequestId = response.workshopRejectedRequestId; throw e; }
            return response.result;
        } };
    const input = { roleId: 'C', fromStatus: '新品予備（組替可能）', operatorId: 'fixture-op', on: '2026-10-25' };
    return { h, issued, storage, fence, state, ports, input, make: () => client.create(ports) };
}

test('existing status edit reaches authenticated GAS, explicit pair and verified completion without a second entry', async () => {
    const x = setup(), online = clone(x.state.local[1]);
    const result = await x.make().complete(x.input);
    assert.equal(result.handled, true); assert.equal(result.task.assemblyTask, 'completed');
    assert.equal(x.state.local[0].status, '改削行き（搬出可能）');
    assert.equal(x.state.local[2].status, '新品予備（組込完了）');
    assert.deepEqual(x.state.local[1], online); assert.equal(x.state.accepted, 1);
    assert.equal(x.storage.size, 0);
});

test('lost completion response survives controller reload and repeats exactly one request without duplicate history', async () => {
    const x = setup(); x.state.lost = true;
    await assert.rejects(x.make().complete(x.input), /lost response/);
    assert.equal(x.state.accepted, 0); assert.equal(x.storage.size, 1);
    const writes = x.h.state.writes;
    assert.equal((await x.make().complete(x.input)).task.assemblyTask, 'completed');
    assert.equal(x.h.state.writes, writes);
    const posts = x.state.sent.filter(p => p.action === 'completeworkshop');
    assert.deepEqual(posts[0], posts[1]); assert.equal(x.state.serial, 1);
    assert.equal(x.state.local[2].history.length, 1);
});

test('formula delay never signals success and retry completes the same journal', async () => {
    const x = setup(); x.h.state.stale = true;
    await assert.rejects(x.make().complete(x.input));
    assert.equal(x.state.accepted, 0); assert.equal(x.storage.size, 1);
    x.h.state.stale = false;
    assert.equal((await x.make().complete(x.input)).task.assemblyTask, 'completed');
    assert.equal(x.state.local[2].history.length, 1);
});

test('a definite pre-write conflict releases only that request; next edit checks fresh state', async () => {
    const x = setup(), call = x.ports.call;
    let changed = false;
    x.ports.call = async payload => {
        if (payload.action === 'completeworkshop' && !changed) { changed = true; x.h.state.roles[1].memo = '他者変更'; }
        return call(payload);
    };
    await assert.rejects(x.make().complete(x.input), /取得後に更新/);
    assert.equal(x.storage.size, 0); assert.equal(x.h.state.roles[2].history.length, 0);
    x.state.local = clone(x.h.state.roles);
    assert.equal((await x.make().complete(x.input)).task.assemblyTask, 'completed');
    assert.equal(x.state.serial, 2);
});

test('logout during an already applied request keeps pending evidence and prevents UI success', async () => {
    const x = setup(), call = x.ports.call;
    x.ports.call = async payload => { const result = await call(payload);
        if (payload.action === 'completeworkshop') x.fence.invalidate(); return result; };
    await assert.rejects(x.make().complete(x.input), e => e.code === 'AUTH_SESSION_CHANGED');
    assert.equal(x.state.accepted, 0); assert.equal(x.storage.size, 1);
    x.ports.call = call;
    assert.equal((await x.make().complete(x.input)).handled, true);
});

test('local edits made during a save are never overwritten and can be reconciled before retry', async () => {
    const x = setup(), call = x.ports.call;
    x.ports.call = async payload => { const result = await call(payload);
        if (payload.action === 'completeworkshop') x.state.local[1].memo = '端末入力'; return result; };
    await assert.rejects(x.make().complete(x.input), /端末の内容が変わり/);
    assert.equal(x.state.local[1].memo, '端末入力'); assert.equal(x.state.accepted, 0); assert.equal(x.storage.size, 1);
    x.ports.call = call;
    await assert.rejects(x.make().complete(x.input), /前回送信後の端末変更/);
    assert.equal(x.state.local[1].memo, '端末入力'); assert.equal(x.state.accepted, 0);
});

test('combined form changes and unsynced local values stop before durable request or server writes', async () => {
    for (const kind of ['form', 'local']) {
        const x = setup(), writes = x.h.state.writes;
        if (kind === 'local') x.state.local[1].memo = '未同期';
        await assert.rejects(x.make().complete({ ...x.input, hasOtherChanges: kind === 'form' }), /同時には保存|先に同期/);
        assert.equal(x.h.state.writes, writes); assert.equal(x.storage.size, 0);
    }
});

test('missing instruction falls back without changes, but duplicate instructions never choose arbitrarily', async () => {
    const x = setup(); x.input.roleId = 'B';
    assert.equal((await x.make().complete(x.input)).handled, false);
    const call = x.ports.call; x.input.roleId = 'C';
    x.ports.call = async payload => { const result = await call(payload);
        if (payload.action === 'fetchworkshop') result.instructions.push(clone(result.instructions[0])); return result; };
    await assert.rejects(x.make().complete(x.input), /複数の工作指示/);
    assert.equal(x.storage.size, 0);
});

test('storage failure, corrupt request and another account stop before completion POST', async () => {
    for (const kind of ['quota', 'corrupt', 'owner']) {
        const x = setup();
        if (kind === 'quota') x.ports.storage.setItem = () => { throw new Error('quota'); };
        if (kind === 'corrupt') x.storage.set(client.storageKey, '{bad');
        if (kind === 'owner') x.storage.set(client.storageKey, JSON.stringify({ owner: 'someone-else', request: x.issued.request }));
        await assert.rejects(x.make().complete(x.input));
        assert.equal(x.state.sent.filter(p => p.action === 'completeworkshop').length, 0);
        assert.equal(x.state.accepted, 0);
    }
});

test('partial receipts are not accepted even when response status says complete', async () => {
    const x = setup(), call = x.ports.call;
    x.ports.call = async payload => { const result = await call(payload);
        if (payload.action === 'completeworkshop') result.effectReceipts.pop(); return result; };
    await assert.rejects(x.make().complete(x.input), /反映確認が不足/);
    assert.equal(x.state.accepted, 0); assert.equal(x.storage.size, 1);
});

test('double click makes only one server completion request', async () => {
    const x = setup(), controller = x.make();
    const first = controller.complete(x.input);
    await assert.rejects(controller.complete(x.input), /確認中/);
    await first;
    assert.equal(x.state.sent.filter(p => p.action === 'completeworkshop').length, 1);
});
