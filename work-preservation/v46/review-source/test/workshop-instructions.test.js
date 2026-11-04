const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = require('../js/workshop-instructions');

const clone = v => JSON.parse(JSON.stringify(v));
const code = value => error => error.code === value;
let sequence = 0;
function context() {
    return { actor: { id: 'fixture-editor', role: 'editor' }, today: '2031-01-20', now: '2031-01-20T04:00:00Z',
        adoption: { id: 'adoption-1', status: 'adopted', planVersionId: 'plan-v1', items: [{
            id: 'item-1', cycleId: 'fixture-cycle', standId: '99', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2031-01-10'
        }] } };
}
function command(record, kind, payload, patch = {}) {
    return { instructionId: api.instructionIdFor('fixture-cycle'), requestId: 'request-' + (++sequence),
        expectedRevision: record ? record.revision : 0, kind, payload, ...patch };
}
function issued(ctx = context()) {
    const cmd = command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' });
    return { ctx, cmd, record: api.apply(null, cmd, ctx).record };
}
function act(record, kind, payload, ctx = context()) { return api.apply(record, command(record, kind, payload), ctx).record; }
function prepared() { return act(issued().record, 'record_actual', { stage: 'prepared', on: '2031-01-10' }); }
function receipts(record) {
    return ['roles', 'rollHistory'].map(target => ({ target, instructionId: record.id,
        instructionRevision: record.revision, state: 'verified' }));
}

test('only adopted items and server editor/admin identities can issue instructions', () => {
    for (const role of ['reader', '', 'workshop']) {
        const ctx = context(); ctx.actor.role = role;
        assert.throws(() => issued(ctx), code('FORBIDDEN'));
    }
    for (const status of ['draft', 'proposed', 'cancelled']) {
        const ctx = context(); ctx.adoption.status = status;
        assert.throws(() => issued(ctx), code('NOT_ADOPTED'));
    }
    const ctx = context(); ctx.actor.role = 'admin';
    assert.equal(issued(ctx).record.revision, 1);
});
test('missing/ambiguous plan items, same donor/recipient and invalid dates stop issuance', () => {
    for (const items of [[], [context().adoption.items[0], context().adoption.items[0]]]) {
        const ctx = context(); ctx.adoption.items = items;
        assert.throws(() => issued(ctx), code('INVALID_PLAN'));
    }
    const same = context(); same.adoption.items[0].recipientRoleId = 'A';
    assert.throws(() => issued(same), code('INVALID_PAIR'));
    for (const value of [null, '', '2031-02-30']) {
        const ctx = context(); ctx.adoption.items[0].readyBy = value;
        assert.throws(() => issued(ctx), code('INVALID_DATE'));
    }
});
test('same request replay returns latest record without duplicated events', () => {
    const { record, cmd, ctx } = issued();
    const newer = act(record, 'acknowledge', {});
    const result = api.apply(newer, cmd, ctx);
    assert.equal(result.changed, false);
    assert.equal(result.record.revision, 2);
    assert.equal(result.record.events.length, 2);
});
test('re-exporting the adopted item with a new request ID reuses one instruction', () => {
    const { record, ctx } = issued();
    const retry = command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' });
    const result = api.apply(record, retry, ctx);
    assert.equal(result.changed, false);
    assert.deepEqual(result.record, record);
});
test('one request ID cannot be reused for another value or another actor', () => {
    const { record, cmd, ctx } = issued();
    assert.throws(() => api.apply(record, { ...cmd, kind: 'acknowledge', payload: {} }, ctx), code('REQUEST_REUSED'));
    assert.throws(() => api.apply(record, cmd, { ...ctx, actor: { id: 'other', role: 'editor' } }), code('REQUEST_REUSED'));
});
test('stale revisions reject edits rather than silently overwriting another person', () => {
    const record = prepared();
    const stale = command(record, 'record_actual', { stage: 'installed', on: '2031-01-12' });
    const newer = act(record, 'acknowledge', {});
    assert.throws(() => api.apply(newer, stale, context()), code('CONFLICT'));
    assert.equal(api.project(newer).actuals.installed, null);
});
test('preparation, rolling replacement and actual use remain three distinct events', () => {
    const ctx = context(); ctx.roles = [{ id: 'B', status: 'オンライン' }, { id: 'C', status: '新品予備（組替可能）' }];
    const before = clone(ctx);
    let record = act(issued().record, 'record_actual', { stage: 'prepared', on: '2031-01-10' }, ctx);
    assert.equal(api.project(record).progress, 'prepared');
    assert.equal(api.project(record).actuals.use_started, null);
    record = act(record, 'record_actual', { stage: 'installed', on: '2031-01-12' }, ctx);
    assert.equal(api.project(record).progress, 'installed');
    assert.equal(api.project(record).actuals.use_started, null);
    record = act(record, 'record_actual', { stage: 'use_started', on: '2031-01-15' }, ctx);
    assert.equal(api.project(record).progress, 'in_use');
    assert.deepEqual(ctx, before); // No automatic mutation of existing Roles.
});
test('future actuals, reversed dates and missing prerequisite actuals are rejected', () => {
    const record = issued().record;
    assert.throws(() => act(record, 'record_actual', { stage: 'prepared', on: '2031-01-21' }), code('FUTURE_ACTUAL'));
    assert.throws(() => act(record, 'record_actual', { stage: 'installed', on: '2031-01-10' }), code('INVALID_SEQUENCE'));
    assert.throws(() => act(prepared(), 'record_actual', { stage: 'installed', on: '2031-01-09' }), code('INVALID_SEQUENCE'));
    assert.throws(() => act(prepared(), 'record_actual', { stage: 'use_started', on: '2031-01-15' }), code('INVALID_SEQUENCE'));
});
test('correction keeps the original actual ID and original audit entry', () => {
    const record = prepared(), original = clone(record);
    const targetEventId = api.project(record).actualEventIds.prepared;
    const corrected = act(record, 'correct_actual', { targetEventId, on: '2031-01-11', reason: '入力日訂正' });
    assert.equal(api.project(corrected).actuals.prepared, '2031-01-11');
    assert.equal(api.project(corrected).actualEventIds.prepared, targetEventId);
    assert.equal(corrected.events.filter(e => e.kind === 'actual_recorded').length, 1);
    assert.equal(corrected.events[1].on, '2031-01-10');
    assert.deepEqual(record, original);
});
test('blank correction reopens preparation, while downstream actuals prevent inconsistent clearing', () => {
    const record = prepared(), targetEventId = api.project(record).actualEventIds.prepared;
    const clear = { targetEventId, on: null, reason: '完了入力を取り消す' };
    const reopened = act(record, 'correct_actual', clear);
    assert.equal(api.taskView(reopened, reopened, '2031-01-20').assemblyTask, 'active');
    assert.equal(api.project(reopened).actualEventIds.prepared, targetEventId);
    const installed = act(record, 'record_actual', { stage: 'installed', on: '2031-01-12' });
    assert.throws(() => act(installed, 'correct_actual', clear), code('INVALID_SEQUENCE'));
});
test('a completed actual is corrected explicitly rather than entered twice', () => {
    const record = prepared();
    assert.throws(() => act(record, 'record_actual', { stage: 'prepared', on: '2031-01-11' }), code('ALREADY_RECORDED'));
    assert.throws(() => act(record, 'correct_actual', { targetEventId: api.project(record).actualEventIds.prepared, on: '2031-01-11', reason: '' }), code('INVALID_INPUT'));
});
test('acknowledgement, pending confirmation and different saved content never hide work', () => {
    const acknowledged = act(issued().record, 'acknowledge', {});
    assert.equal(api.taskView(acknowledged, acknowledged, '2031-01-20').assemblyTask, 'active');
    const record = prepared();
    assert.equal(api.taskView(record, null, '2031-01-20').assemblyTask, 'pending_confirmation');
    const mismatch = clone(record); mismatch.events[1].on = '2031-01-11';
    assert.equal(api.taskView(record, mismatch, '2031-01-20').assemblyTask, 'pending_confirmation');
    assert.equal(api.taskView(record, record, '2031-01-20', receipts(record)).assemblyTask, 'completed');
});
test('instruction-only save, partial effects and old receipts keep completion pending', () => {
    const record = prepared();
    for (const evidence of [[], receipts(record).slice(0, 1),
        receipts(record).map(r => ({ ...r, state: 'failed' })),
        receipts(record).map(r => ({ ...r, instructionRevision: record.revision - 1 })),
        receipts(record).map(r => ({ ...r, instructionId: 'other' }))]) {
        const view = api.taskView(record, record, '2031-01-20', evidence);
        assert.equal(view.assemblyTask, 'pending_confirmation');
        assert.equal(view.reflection, 'partial');
    }
});
test('unresolved problems remain visible and can recur without losing completion history', () => {
    let record = prepared();
    const initialId = record.id;
    record = act(record, 'block', { blockerId: 'chock-check', reason: '再点検が必要' });
    assert.equal(api.taskView(record, record, '2031-01-20').assemblyTask, 'active');
    assert.throws(() => act(record, 'record_actual', { stage: 'installed', on: '2031-01-12' }), code('UNRESOLVED'));
    record = act(record, 'acknowledge', {});
    assert.equal(Object.keys(api.project(record).blockers).length, 1);
    record = act(record, 'resolve_blocker', { blockerId: 'chock-check', reason: '再点検済み' });
    assert.equal(api.taskView(record, record, '2031-01-20', receipts(record)).assemblyTask, 'completed');
    record = act(record, 'block', { blockerId: 'chock-check', reason: '再び要確認' });
    assert.equal(api.taskView(record, record, '2031-01-20').assemblyTask, 'active');
    assert.equal(record.id, initialId);
    assert.equal(api.project(record).actuals.prepared, '2031-01-10');
});
test('special problem IDs cannot disappear into object prototypes', () => {
    const record = act(prepared(), 'block', { blockerId: '__proto__', reason: '要確認' });
    assert.equal(api.taskView(record, record, '2031-01-20').assemblyTask, 'active');
    assert.equal(Object.keys(api.project(record).blockers).length, 1);
});
test('changed plans do not silently update instructions; explicit revisions retain their source', () => {
    const { record, ctx } = issued();
    ctx.adoption.planVersionId = 'plan-v2'; ctx.adoption.id = 'adoption-2'; ctx.adoption.items[0].readyBy = '2031-01-08';
    assert.throws(() => api.apply(record, command(record, 'issue', { adoptionId: 'adoption-2', planItemId: 'item-1' }), ctx), code('ALREADY_ISSUED'));
    const revised = act(record, 'revise_plan', { adoptionId: 'adoption-2', planItemId: 'item-1', reason: '予定前倒しを採用' }, ctx);
    assert.equal(api.project(revised).definition.readyBy, '2031-01-08');
    assert.equal(revised.events[0].definition.planVersionId, 'plan-v1');
    ctx.adoption.items[0].recipientRoleId = 'D';
    assert.throws(() => act(revised, 'revise_plan', { adoptionId: 'adoption-2', planItemId: 'item-1', reason: '対象変更' }, ctx), code('PAIR_CHANGE'));
});
test('unknown commands and extra fields cannot silently change roll status', () => {
    assert.throws(() => act(prepared(), 'online', {}), code('INVALID_INPUT'));
    assert.throws(() => act(prepared(), 'acknowledge', { status: 'オンライン' }), code('INVALID_INPUT'));
});

function sheetHarness() {
    const state = { rows: [['instructionId', 'recordJson']], writes: 0, held: false, flushFails: false, readbackMismatch: false, name: '_WorkshopInstructions_v1' };
    const sheet = {
        getName: () => state.name, getDataRange: () => ({ getValues: () => clone(state.rows) }),
        getLastRow: () => state.rows.length,
        getRange: row => ({ setValues(values) { state.writes++; state.rows[row - 1] = clone(values[0]); },
            getValues: () => [state.readbackMismatch ? ['mismatch', ''] : clone(state.rows[row - 1])] })
    };
    const lock = { tryLock() { if (state.held) return false; state.held = true; return true; }, releaseLock() { state.held = false; } };
    const c = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../gas/workshop-instruction-store.gs'), 'utf8'), c);
    const store = () => c.createWorkshopInstructionStore_(sheet, api, lock, () => { if (state.flushFails) throw Error('flush failed after write'); });
    return { state, store, resolve: () => { assert.equal(state.held, true); return context(); } };
}
test('two store clients share a stable record and stale edits are rejected under lock', () => {
    const h = sheetHarness(), first = h.store(), second = h.store();
    const cmd = command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' });
    const a = first.execute(cmd, h.resolve).record;
    const b = second.read(a.id);
    first.execute(command(a, 'record_actual', { stage: 'prepared', on: '2031-01-10' }), h.resolve);
    assert.throws(() => second.execute(command(b, 'acknowledge', {}), h.resolve), code('CONFLICT'));
    assert.equal(api.project(second.read(a.id)).progress, 'prepared');
    assert.equal(h.state.writes, 2);
    assert.equal(h.state.held, false);
});
test('a write followed by lost confirmation can be retried without a duplicate instruction', () => {
    const h = sheetHarness(), store = h.store();
    const cmd = command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' });
    h.state.flushFails = true;
    assert.throws(() => store.execute(cmd, h.resolve), /flush failed/);
    assert.equal(h.state.held, false);
    h.state.flushFails = false;
    const retry = h.store().execute(cmd, h.resolve);
    assert.equal(retry.changed, false);
    assert.equal(retry.record.events.length, 1);
    assert.equal(h.state.writes, 1);
    assert.equal(h.state.rows.length, 2);
});
test('same preparation completion retried after lost confirmation keeps one actual', () => {
    const h = sheetHarness(), store = h.store();
    const created = store.execute(command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' }), h.resolve).record;
    const cmd = command(created, 'record_actual', { stage: 'prepared', on: '2031-01-10' });
    h.state.flushFails = true;
    assert.throws(() => store.execute(cmd, h.resolve));
    h.state.flushFails = false;
    const result = store.execute(cmd, h.resolve);
    assert.equal(result.record.events.filter(e => e.kind === 'actual_recorded').length, 1);
    assert.equal(h.state.writes, 2);
});
test('wrong destination/schema and corrupted records never get overwritten', () => {
    const h = sheetHarness(); h.state.name = 'Roles';
    assert.throws(() => h.store(), /専用シート/);
    h.state.name = '_WorkshopInstructions_v1'; h.state.rows[0][0] = 'wrong';
    assert.throws(() => h.store().read('x'), /構成/);
    h.state.rows = [['instructionId', 'recordJson'], ['x', '{bad json']];
    assert.throws(() => h.store().execute(command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' }), h.resolve), /読めません/);
    assert.equal(h.state.writes, 0);
    assert.equal(h.state.held, false);
});
test('duplicate record IDs stop the whole write instead of choosing a random row', () => {
    const h = sheetHarness(), record = issued().record;
    h.state.rows.push([record.id, JSON.stringify(record)], [record.id, JSON.stringify(record)]);
    assert.throws(() => h.store().execute(command(record, 'acknowledge', {}), h.resolve), /重複/);
    assert.equal(h.state.writes, 0);
});
test('readback mismatch never produces a confirmed result', () => {
    const h = sheetHarness(); h.state.readbackMismatch = true;
    assert.throws(() => h.store().execute(command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' }), h.resolve), /反映を確認できません/);
    assert.equal(h.state.held, false);
});
test('busy lock and browser-supplied context cannot start writes', () => {
    const h = sheetHarness(); h.state.held = true;
    const cmd = command(null, 'issue', { adoptionId: 'adoption-1', planItemId: 'item-1' });
    assert.throws(() => h.store().execute(cmd, h.resolve), /他の更新/);
    assert.throws(() => h.store().execute(cmd, context()), /サーバー側/);
    assert.equal(h.state.writes, 0);
});
test('history capacity is checked before writing and never trims audit history', () => {
    const h = sheetHarness(); let record = issued().record;
    while (JSON.stringify(record).length < 43000) record = act(record, 'block', { blockerId: 'capacity', reason: 'a'.repeat(700) });
    h.state.rows.push([record.id, JSON.stringify(record)]);
    const snapshot = clone(h.state.rows);
    const cmd = command(record, 'block', { blockerId: 'capacity', reason: 'b'.repeat(700) });
    const next = api.apply(record, cmd, context()).record;
    if (JSON.stringify(next).length <= 45000) {
        h.state.rows[1][1] = JSON.stringify(next); record = next;
    }
    const before = clone(h.state.rows);
    assert.throws(() => h.store().execute(command(record, 'block', { blockerId: 'capacity', reason: 'c'.repeat(700) }), h.resolve), /保存上限/);
    assert.deepEqual(h.state.rows, before);
    assert.equal(h.state.writes, 0);
    assert.ok(snapshot[1][1].length > 43000);
});
