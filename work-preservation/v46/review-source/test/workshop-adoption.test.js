const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const adoption = require('../js/workshop-adoption');
const domain = require('../js/workshop-instructions');
const link = require('../js/workshop-plan-link');
const bridge = require('../js/workshop-status-bridge');
const clone = x => JSON.parse(JSON.stringify(x));
const code = expected => error => error.code === expected;
function fixture() {
    let count = 0;
    return { actor: { id: 'fixture-user', role: 'editor' }, now: '2031-01-20T00:00:00Z', today: '2031-01-20',
        makeId: () => 'generated-' + (++count) };
}
const item = () => ({ standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2031-01-21' });
const cmd = (record, requestId, kind, payload) => ({ planId: 'fixture-month-plan', requestId,
    expectedRevision: record ? record.revision : 0, kind, payload });
function draft(ctx = fixture()) {
    return adoption.apply(null, cmd(null, 'draft-1', 'save_draft', { items: [item()], reason: '原案の取込み' }), ctx).record;
}
function adopt(record, ctx = fixture()) {
    return adoption.apply(record, cmd(record, 'adopt-1', 'adopt', { planVersionId: adoption.project(record).draft.planVersionId }), ctx).record;
}
function editItem(record) {
    const value = clone(adoption.project(record).draft.items[0]); delete value.cycleId; return value;
}
test('saving a draft allocates stable IDs but does not adopt or issue instructions', () => {
    const record = draft(), view = adoption.project(record);
    assert.equal(view.adoption, null); assert.equal(view.draft.items[0].id, 'generated-1');
    assert.equal(view.draft.items[0].cycleId, 'generated-2');
    assert.throws(() => link.prepare([], { requestId: 'issue' }, { ...fixture(), adoption: view.adoption }), code('NOT_ADOPTED'));
});
test('explicit adoption refers to the exact reviewed draft version', () => {
    const record = draft();
    assert.throws(() => adoption.apply(record, cmd(record, 'bad', 'adopt', { planVersionId: 'old-version' }), fixture()), code('WRONG_PLAN_VERSION'));
    const result = adoption.project(adopt(record));
    assert.equal(result.adoption.status, 'adopted'); assert.equal(result.adoption.adoptedBy, 'fixture-user');
    assert.equal(result.adoption.planVersionId, result.draft.planVersionId);
});
test('editing an adopted plan preserves the last adoption and the same cycle ID until re-adopted', () => {
    const ctx = fixture(); const first = adopt(draft(ctx), ctx), old = adoption.project(first).adoption;
    const edited = editItem(first); edited.readyBy = '2031-01-19';
    const next = adoption.apply(first, cmd(first, 'draft-2', 'save_draft', { items: [edited], reason: '前倒し案' }), ctx).record;
    const view = adoption.project(next);
    assert.deepEqual(view.adoption, old); assert.equal(view.draft.items[0].cycleId, old.items[0].cycleId);
    assert.equal(view.draft.items[0].readyBy, '2031-01-19');
    const accepted = adoption.apply(next, cmd(next, 'adopt-2', 'adopt', { planVersionId: view.draft.planVersionId }), ctx).record;
    assert.equal(adoption.project(accepted).adoption.items[0].readyBy, '2031-01-19');
    assert.equal(accepted.events[1].kind, 'adopted'); // Original adoption remains in audit.
});
test('retrying creation keeps allocated IDs and does not call the ID generator again', () => {
    const ctx = fixture(), request = cmd(null, 'draft-1', 'save_draft', { items: [item()], reason: '原案の取込み' });
    const first = adoption.apply(null, request, ctx).record;
    ctx.makeId = () => { throw new Error('must not allocate on replay'); };
    const retry = adoption.apply(first, request, ctx);
    assert.equal(retry.replayed, true); assert.deepEqual(retry.record, first);
    assert.throws(() => adoption.apply(first, { ...request, payload: { ...request.payload, reason: 'different' } }, ctx), code('REQUEST_REUSED'));
});
test('concurrent old edits cannot erase a newly adopted version', () => {
    const ctx = fixture(), initial = draft(ctx), accepted = adopt(initial, ctx);
    const oldEdit = cmd(initial, 'stale', 'save_draft', { items: [editItem(initial)], reason: '古い端末' });
    assert.throws(() => adoption.apply(accepted, oldEdit, ctx), code('CONFLICT'));
    assert.equal(adoption.project(accepted).adoption.planVersionId, adoption.project(initial).draft.planVersionId);
});
test('client-supplied cycle IDs, unknown item IDs, duplicate items and duplicate generated IDs are rejected', () => {
    const ctx = fixture(), record = draft(ctx), edit = editItem(record);
    for (const items of [[{ ...edit, cycleId: 'replace-cycle' }], [{ ...edit, id: 'unknown' }], [edit, edit]]) {
        assert.throws(() => adoption.apply(record, cmd(record, 'bad', 'save_draft', { items, reason: '変更' }), ctx));
    }
    ctx.makeId = () => 'generated-1';
    assert.throws(() => adoption.apply(record, cmd(record, 'duplicate', 'save_draft', { items: [item()], reason: '追加' }), ctx), code('DUPLICATE_ID'));
});
test('unknown readiness information stays unknown and cannot produce a formal instruction', () => {
    const ctx = fixture(); const record = adoption.apply(null, cmd(null, 'draft', 'save_draft', {
        items: [{ standId: '14' }], reason: '不足情報を含む原案' }), ctx).record;
    assert.equal(adoption.project(record).draft.items[0].readyBy, null);
    const accepted = adoption.project(adopt(record, ctx)).adoption;
    assert.throws(() => link.prepare([], { requestId: 'issue' }, { ...ctx, adoption: accepted }));
});
test('reader identities and foreign plan IDs cannot alter stored adoption', () => {
    const record = draft();
    assert.throws(() => adoption.apply(record, cmd(record, 'x', 'adopt', { planVersionId: 'x' }), { ...fixture(), actor: { id: 'reader', role: 'reader' } }), code('FORBIDDEN'));
    assert.throws(() => adoption.apply(record, { ...cmd(record, 'x', 'adopt', { planVersionId: 'x' }), planId: 'other-plan' }, fixture()), code('WRONG_PLAN'));
});
function stores() {
    const state = { held: false, fail: false, corruptReadback: false, planWrites: 0 };
    const lock = { tryLock() { if (state.held) return false; state.held = true; return true; }, releaseLock() { state.held = false; } };
    const sheet = (name, header) => {
        const rows = [header];
        return { getName: () => name, getLastRow: () => rows.length, getDataRange: () => ({ getValues: () => clone(rows) }),
            getRange: row => ({ setValues(values) { rows[row - 1] = clone(values[0]); if (name === '_WorkshopPlans_v1') state.planWrites++; },
                getValues: () => [state.corruptReadback ? ['wrong', '{}'] : clone(rows[row - 1])] }) };
    };
    const box = vm.createContext({});
    for (const path of ['../gas/workshop-plan-store.gs', '../gas/workshop-instruction-store.gs']) vm.runInContext(fs.readFileSync(require.resolve(path), 'utf8'), box);
    const plan = box.createWorkshopPlanStore_(sheet('_WorkshopPlans_v1', ['planId', 'recordJson']), adoption, lock, () => { if (state.fail) throw new Error('lost response'); });
    const instructions = box.createWorkshopInstructionStore_(sheet('_WorkshopInstructions_v1', ['instructionId', 'recordJson']), domain, lock, () => {});
    return { state, plan, instructions };
}
test('shared plan → explicit adoption → formal instruction → one status change works end to end', () => {
    const h = stores(), ctx = fixture();
    const resolve = () => { assert.equal(h.state.held, true); return ctx; };
    const initial = h.plan.execute(cmd(null, 'draft', 'save_draft', { items: [item()], reason: '原案取込み' }), resolve).record;
    assert.equal(h.plan.readAdoption(initial.id), null);
    h.plan.execute(cmd(initial, 'adopt', 'adopt', { planVersionId: adoption.project(initial).draft.planVersionId }), resolve);
    const issued = h.instructions.issueAdoptedPlan({ requestId: 'issue' }, () => ({ ...resolve(), adoption: h.plan.readAdoption(initial.id) }), link);
    assert.equal(issued.records.length, 1);
    const instruction = issued.records[0], definition = domain.project(instruction).definition;
    const result = bridge.prepare([{ id: 'A', name: '#14-901', status: '中古予備（バラシ前）' },
        { id: 'B', name: '#14-902', status: 'オンライン' }, { id: 'C', name: '#14-903', status: '新品予備（組替可能）' }], instruction,
        { instructionId: instruction.id, cycleId: definition.cycleId, recipientRoleId: 'C', operatorId: 'fixture-op',
            requestId: 'status', expectedInstructionRevision: 1, expectedRolesRevision: 'r1', fromStatus: '新品予備（組替可能）',
            toStatus: '新品予備（組込完了）', on: '2031-01-20' },
        { ...ctx, rolesRevision: 'r1', operators: [{ id: 'fixture-op', name: '試験担当' }] });
    assert.equal(result.roles[1].status, 'オンライン'); assert.equal(domain.project(result.instruction).progress, 'prepared');
    assert.equal(domain.taskView(result.instruction, result.instruction, ctx.today).assemblyTask, 'pending_confirmation');
});
test('shared plan lost response retries preserve IDs and avoid duplicate drafts', () => {
    const h = stores(), ctx = fixture(), request = cmd(null, 'draft', 'save_draft', { items: [item()], reason: '原案' });
    h.state.fail = true; assert.throws(() => h.plan.execute(request, () => ctx), /lost response/);
    assert.equal(h.state.held, false); h.state.fail = false;
    const retry = h.plan.execute(request, () => ctx);
    assert.equal(retry.record.revision, 1); assert.equal(h.state.planWrites, 1);
});
test('shared plan readback mismatch or lock contention never reports save success', () => {
    const h = stores(), ctx = fixture(), request = cmd(null, 'draft', 'save_draft', { items: [item()], reason: '原案' });
    h.state.held = true; assert.throws(() => h.plan.execute(request, () => ctx), /更新処理中/);
    assert.equal(h.state.planWrites, 0); h.state.held = false; h.state.corruptReadback = true;
    assert.throws(() => h.plan.execute(request, () => ctx), /反映を確認できません/);
    assert.equal(h.state.held, false);
});
