const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const domain = require('../js/workshop-instructions');
const link = require('../js/workshop-plan-link');
const bridge = require('../js/workshop-status-bridge');
const clone = value => JSON.parse(JSON.stringify(value));
const code = expected => error => error.code === expected;
function fixture() {
    const ctx = { actor: { id: 'fixture-auth-user', role: 'editor' }, today: '2031-01-20', now: '2031-01-20T01:00:00Z',
        rolesRevision: 'roles-before', operators: [{ id: 'fixture-operator', name: '試験担当' }],
        adoption: { id: 'adopted-v1', planId: 'monthly-plan-fixture', planVersionId: 'v1', status: 'adopted', items: [
            { id: 'item-1', cycleId: 'stable-cycle-1', standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2031-01-21' }
        ] } };
    const roles = [
        { id: 'A', name: '#14-901', status: '中古予備（バラシ前）', history: [], useStartDate: '2030-10-01', useEndDate: '2031-01-01' },
        { id: 'B', name: '#14-902', status: 'オンライン', useStartDate: '2031-01-02' },
        { id: 'C', name: '#14-903', status: '新品予備（組替可能）', history: [], useStartDate: '', memo: '保持する手修正' },
        { id: 'D', name: '#14-904', status: '中古予備（バラシ前）', memo: '指示対象外' }
    ];
    const record = link.prepare([], { requestId: 'issue-fixture' }, ctx).records[0];
    const request = { instructionId: record.id, cycleId: 'stable-cycle-1', recipientRoleId: 'C',
        operatorId: 'fixture-operator', requestId: 'status-save-1', expectedInstructionRevision: 1,
        expectedRolesRevision: 'roles-before', fromStatus: '新品予備（組替可能）', toStatus: '新品予備（組込完了）', on: '2031-01-20' };
    return { ctx, roles, record, request };
}
function secondItem(ctx) {
    ctx.adoption.items.push({ id: 'item-2', cycleId: 'stable-cycle-2', standId: '15', donorRoleId: 'E', recipientRoleId: 'F', readyBy: '2031-01-22' });
}

test('adopted plan generates one instruction per stable cycle without changing the source', () => {
    const { ctx } = fixture(); secondItem(ctx); const before = clone(ctx);
    const result = link.prepare([], { requestId: 'batch-1' }, ctx);
    assert.equal(result.ready, true); assert.equal(result.commands.length, 2);
    assert.equal(result.records[0].events[0].definition.planId, ctx.adoption.planId);
    assert.deepEqual(ctx, before);
});
test('reordered sheet rows and regenerated export request do not duplicate instructions', () => {
    const { ctx } = fixture(); secondItem(ctx);
    const first = link.prepare([], { requestId: 'first' }, ctx);
    ctx.adoption.items.reverse();
    const second = link.prepare(first.records, { requestId: 'reexport' }, ctx);
    assert.equal(second.commands.length, 0); assert.deepEqual(second.records, first.records);
    assert.ok(second.actions.every(item => item.action === 'unchanged'));
});
test('draft plans, missing stable plan IDs and read-only actors cannot issue', () => {
    for (const status of ['draft', 'proposed', 'cancelled']) {
        const { ctx } = fixture(); ctx.adoption.status = status;
        assert.throws(() => link.prepare([], { requestId: 'x' }, ctx), code('NOT_ADOPTED'));
    }
    const { ctx } = fixture(); delete ctx.adoption.planId;
    assert.throws(() => link.prepare([], { requestId: 'x' }, ctx), code('NOT_ADOPTED'));
    ctx.actor.role = 'reader'; ctx.adoption.items = [];
    assert.throws(() => link.prepare([], { requestId: 'x' }, ctx), code('FORBIDDEN'));
});
test('duplicate or missing item/cycle IDs and malformed dates reject the whole plan', () => {
    for (const mutate of [ctx => ctx.adoption.items.push(clone(ctx.adoption.items[0])),
        ctx => { delete ctx.adoption.items[0].cycleId; }, ctx => { ctx.adoption.items[0].readyBy = '2031-02-30'; }]) {
        const { ctx } = fixture(); mutate(ctx);
        assert.throws(() => link.prepare([], { requestId: 'x' }, ctx));
    }
});
test('date change requires reviewed current revision and keeps the original instruction ID', () => {
    const { ctx, record } = fixture();
    ctx.adoption.id = 'adopted-v2'; ctx.adoption.planVersionId = 'v2'; ctx.adoption.items[0].readyBy = '2031-01-19';
    const blocked = link.prepare([record], { requestId: 'revision' }, ctx);
    assert.equal(blocked.ready, false); assert.equal(blocked.commands.length, 0);
    assert.equal(blocked.problems[0].code, 'REVISION_REVIEW');
    const next = link.prepare([record], { requestId: 'revision', revisionReason: '前倒しを採用', expectedRevisions: { [record.id]: 1 } }, ctx);
    assert.equal(next.ready, true); assert.equal(next.records[0].id, record.id);
    assert.equal(domain.project(next.records[0]).definition.readyBy, '2031-01-19');
    assert.equal(next.records[0].events[0].definition.readyBy, '2031-01-21');
    const retry = link.prepare(next.records, { requestId: 'revision', revisionReason: '前倒しを採用', expectedRevisions: { [record.id]: 1 } }, ctx);
    assert.equal(retry.commands.length, 0);
});
test('target changes, regenerated cycle IDs and removed active instructions block silent replacements', () => {
    const { ctx, record } = fixture(); ctx.adoption.items[0].recipientRoleId = 'D';
    let result = link.prepare([record], { requestId: 'x' }, ctx);
    assert.equal(result.problems[0].code, 'PAIR_CHANGE');
    ctx.adoption.items[0].cycleId = 'accidentally-regenerated';
    result = link.prepare([record], { requestId: 'x' }, ctx);
    assert.equal(result.ready, false); assert.equal(result.commands.length, 0);
    assert.equal(result.problems[0].code, 'REMOVED_ACTIVE_INSTRUCTION');
    ctx.adoption.items = []; result = link.prepare([record], { requestId: 'x' }, ctx);
    assert.equal(result.ready, false); assert.deepEqual(result.records, [record]);
});
test('instructions from unrelated plans are retained without being cancelled', () => {
    const { ctx, record } = fixture(); ctx.adoption.planId = 'other-month'; ctx.adoption.items = [];
    const result = link.prepare([record], { requestId: 'x' }, ctx);
    assert.equal(result.ready, true); assert.deepEqual(result.records, [record]);
});
test('one existing status edit prepares exactly the selected pair and records completion', () => {
    const { ctx, roles, record, request } = fixture(); const before = clone(roles);
    const result = bridge.prepare(roles, record, request, ctx);
    assert.equal(result.roleChanges.length, 2);
    assert.equal(result.roles[0].status, '改削行き（搬出可能）');
    assert.equal(result.roles[2].status, '新品予備（組込完了）');
    assert.deepEqual(result.roles[1], roles[1]); assert.deepEqual(result.roles[3], roles[3]);
    assert.equal(result.roles[2].memo, roles[2].memo); assert.equal(result.roles[2].useStartDate, '');
    assert.equal(result.roles[0].useEndDate, roles[0].useEndDate);
    assert.equal(domain.project(result.instruction).actuals.prepared, '2031-01-20');
    assert.equal(domain.project(result.instruction).actuals.installed, null);
    assert.equal(domain.project(result.instruction).actuals.use_started, null);
    assert.deepEqual(roles, before); assert.equal(record.revision, 1);
});
test('status histories retain the human operator and authenticated actor separately', () => {
    const { ctx, roles, record, request } = fixture();
    const result = bridge.prepare(roles, record, request, ctx), actual = result.instruction.events[1];
    for (const change of result.roleChanges) {
        const history = change.after.history[0];
        assert.equal(history.actualEventId, actual.id); assert.equal(history.cycleId, request.cycleId);
        assert.equal(history.operator.name, '試験担当'); assert.equal(history.authenticatedActorId, 'fixture-auth-user');
    }
    assert.equal(actual.source.operatorId, 'fixture-operator');
});
test('old instruction, wrong cycle or wrong recipient cannot claim the completion', () => {
    for (const patch of [{ cycleId: 'previous-cycle' }, { instructionId: 'other' }, { recipientRoleId: 'D' }]) {
        const { ctx, roles, record, request } = fixture();
        assert.throws(() => bridge.prepare(roles, record, { ...request, ...patch }, ctx), code('WRONG_INSTRUCTION'));
    }
});
test('stale role or instruction versions reject the whole combined preparation', () => {
    for (const patch of [{ expectedRolesRevision: 'old' }, { expectedInstructionRevision: 0 }]) {
        const { ctx, roles, record, request } = fixture(); const before = clone(roles);
        assert.throws(() => bridge.prepare(roles, record, { ...request, ...patch }, ctx), code('CONFLICT'));
        assert.deepEqual(roles, before); assert.equal(record.revision, 1);
    }
});
test('already-complete snapshots or changed donor states do not invent a new actual', () => {
    for (const mutate of [roles => roles[2].status = '新品予備（組込完了）', roles => roles[0].status = '改削中']) {
        const { ctx, roles, record, request } = fixture(); mutate(roles);
        assert.throws(() => bridge.prepare(roles, record, request, ctx), code('STATUS_CHANGED'));
    }
});
test('unresolved problems and future dates prevent completion without mutating rolls', () => {
    const { ctx, roles, record, request } = fixture();
    const blocked = domain.apply(record, { instructionId: record.id, requestId: 'block', expectedRevision: 1,
        kind: 'block', payload: { blockerId: 'check', reason: '再点検' } }, ctx).record;
    assert.throws(() => bridge.prepare(roles, blocked, { ...request, expectedInstructionRevision: 2 }, ctx), code('UNRESOLVED'));
    assert.throws(() => bridge.prepare(roles, record, { ...request, on: '2031-01-21' }, ctx), code('FUTURE_ACTUAL'));
});
test('retry returns the same actual and never reapplies old roll states after another rotation', () => {
    const { ctx, roles, record, request } = fixture();
    const first = bridge.prepare(roles, record, request, ctx);
    const laterRoles = clone(first.roles); laterRoles[2].status = 'オンライン'; ctx.rolesRevision = 'newer';
    const retry = bridge.prepare(laterRoles, first.instruction, request, ctx);
    assert.equal(retry.replayed, true); assert.equal(retry.roleChanges.length, 0);
    assert.equal(retry.instruction.events.length, 2); assert.equal(retry.requiresReflectionCheck, true);
    assert.equal(laterRoles[2].status, 'オンライン');
    assert.throws(() => bridge.prepare(laterRoles, first.instruction, { ...request, on: '2031-01-19' }, ctx), code('REQUEST_REUSED'));
});
test('completion record alone cannot hide a task before all side effects are verified', () => {
    const { ctx, roles, record, request } = fixture();
    const result = bridge.prepare(roles, record, request, ctx);
    assert.equal(domain.taskView(result.instruction, result.instruction, ctx.today).assemblyTask, 'pending_confirmation');
});
test('missing operators, wrong stands, duplicate IDs and malformed histories stop preparation', () => {
    for (const mutate of [f => { f.request.operatorId = 'unknown'; }, f => { f.roles[0].name = '#15-901'; },
        f => { f.roles.push(clone(f.roles[0])); }, f => { f.roles[0].history = 'broken'; }]) {
        const f = fixture(); mutate(f);
        assert.throws(() => bridge.prepare(f.roles, f.record, f.request, f.ctx));
    }
});
test('new stored rolls enforce coating only at stands 2–11, preserving the existing rule', () => {
    for (const [stand, coating, allowed] of [['11', '', false], ['11', 'uncoated', false], ['11', 'coated', true], ['12', '', true]]) {
        const f = fixture(); f.ctx.adoption.items[0].standId = stand;
        f.record = link.prepare([], { requestId: 'fixture' }, f.ctx).records[0];
        f.roles[0].name = '#' + stand + '-901'; f.roles[2].name = '#' + stand + '-903';
        f.roles[2].status = '新品予備保管'; f.roles[2].coatingStatus = coating; f.request.fromStatus = '新品予備保管';
        if (allowed) assert.equal(bridge.prepare(f.roles, f.record, f.request, f.ctx).roleChanges.length, 2);
        else assert.throws(() => bridge.prepare(f.roles, f.record, f.request, f.ctx), code('COATING_NOT_READY'));
    }
});
test('a corrected completion retains the link to the original status change', () => {
    const { ctx, roles, record, request } = fixture();
    const result = bridge.prepare(roles, record, request, ctx), eventId = domain.project(result.instruction).actualEventIds.prepared;
    const corrected = domain.apply(result.instruction, { instructionId: record.id, requestId: 'correction', expectedRevision: 2,
        kind: 'correct_actual', payload: { targetEventId: eventId, on: '2031-01-19', reason: '作業日訂正' } }, ctx).record;
    assert.equal(domain.project(corrected).actualEventIds.prepared, eventId);
    assert.deepEqual(corrected.events[1].source, result.instruction.events[1].source);
});

function harness() {
    const state = { rows: [['instructionId', 'recordJson']], writes: 0, held: false, failAt: 0 };
    const sheet = { getName: () => '_WorkshopInstructions_v1', getLastRow: () => state.rows.length,
        getDataRange: () => ({ getValues: () => clone(state.rows) }),
        getRange: row => ({ setValues(values) { state.writes++; state.rows[row - 1] = clone(values[0]); },
            getValues: () => [clone(state.rows[row - 1])] }) };
    const lock = { tryLock() { if (state.held) return false; state.held = true; return true; }, releaseLock() { state.held = false; } };
    const sandbox = vm.createContext({});
    vm.runInContext(fs.readFileSync(require.resolve('../gas/workshop-instruction-store.gs'), 'utf8'), sandbox);
    return { state, store: sandbox.createWorkshopInstructionStore_(sheet, domain, lock, () => {
        if (state.writes === state.failAt) throw new Error('lost response');
    }) };
}
test('shared store resolves adoption under lock and persists a generated batch once', () => {
    const h = harness(), { ctx } = fixture(); secondItem(ctx);
    const resolve = () => { assert.equal(h.state.held, true); return ctx; };
    const result = h.store.issueAdoptedPlan({ requestId: 'batch' }, resolve, link);
    assert.equal(result.ready, true); assert.equal(h.state.writes, 2);
    h.store.issueAdoptedPlan({ requestId: 'reexport' }, resolve, link);
    assert.equal(h.state.writes, 2); assert.equal(h.store.list().length, 2); assert.equal(h.state.held, false);
});
test('partial batch storage failure resumes remaining instructions without duplicates', () => {
    const h = harness(), { ctx } = fixture(); secondItem(ctx); h.state.failAt = 1;
    assert.throws(() => h.store.issueAdoptedPlan({ requestId: 'batch' }, () => ctx, link), /lost response/);
    assert.equal(h.store.list().length, 1); assert.equal(h.state.held, false);
    h.state.failAt = 0;
    h.store.issueAdoptedPlan({ requestId: 'batch' }, () => ctx, link);
    assert.equal(h.store.list().length, 2); assert.equal(h.state.writes, 2);
    assert.ok(h.store.list().every(record => record.events.length === 1));
});
test('an invalid later item or unreviewed revision causes no shared writes', () => {
    const h = harness(), { ctx } = fixture(); secondItem(ctx); ctx.adoption.items[1].readyBy = '';
    assert.throws(() => h.store.issueAdoptedPlan({ requestId: 'batch' }, () => ctx, link));
    assert.equal(h.state.writes, 0);
    ctx.adoption.items.pop(); h.store.issueAdoptedPlan({ requestId: 'good' }, () => ctx, link);
    ctx.adoption.items[0].readyBy = '2031-01-19';
    const result = h.store.issueAdoptedPlan({ requestId: 'changed' }, () => ctx, link);
    assert.equal(result.ready, false); assert.equal(h.state.writes, 1);
});
