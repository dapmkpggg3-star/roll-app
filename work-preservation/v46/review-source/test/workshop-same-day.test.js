const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/workshop-api-fixture.cjs');
const board = require('../js/workshop-board');
const domain = require('../js/workshop-instructions');
const schedule = (overrides = {}) => ({ workDate: '2026-10-25', nightProduction: 'operating', source: '架空の採用計画・夜勤予定', ...overrides });
function setup(overrides = {}) {
    const h = fixture(), issued = h.issue({ assemblySchedule: schedule(overrides) });
    const snapshot = () => ({ ...h.ok({ action: 'fetchworkshop' }), checkedAt: '2026-10-25T09:00:00Z' });
    return { h, issued, snapshot, row: () => board.model(snapshot()).items[0] };
}
test('adopted schedule reaches issued board without equating readyBy and workDate or changing roll state', () => {
    const x = setup(), item = x.row();
    assert.deepEqual(item.assemblySchedule, schedule());
    assert.equal(item.readyBy, '2026-10-30'); assert.equal(item.workSchedule.workDate, '2026-10-25');
    assert.equal(item.deadline.state, 'upcoming'); assert.equal(item.deadline.basis, 'adopted_instruction');
    assert.equal(item.workSchedule.state, 'planned_today'); assert.equal(item.workSchedule.readinessAssessed, false);
    assert.equal(x.h.state.roles[2].status, '新品予備（組替可能）');
    const count = x.h.state.writes;
    x.h.ok({ action: 'issueworkshopplan', planId: x.issued.adopted.id, request: { requestId: 'repeat' } });
    assert.equal(x.h.state.writes, count);
});
test('verified same-day completion moves to history without switching to online or adding use start', () => {
    const x = setup(), online = structuredClone(x.h.state.roles[1]);
    x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    const model = board.model(x.snapshot());
    assert.equal(model.items[0].deadline.state, 'completed_in_time');
    assert.equal(model.items[0].workSchedule.sameDayMet, null); // Actual start is not recorded.
    assert.equal(board.select(model).length, 0); assert.equal(board.select(model, { completed: true }).length, 1);
    assert.equal(x.h.state.roles[2].status, '新品予備（組込完了）');
    assert.equal(x.h.state.roles[2].useStartDate, ''); assert.deepEqual(x.h.state.roles[1], online);
    x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    assert.equal(x.h.state.roles[2].history.length, 1);
});
test('partial reflection retains same-day warning until retry verifies both destinations', () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const row = x.row(); assert.equal(row.completed, false); assert.equal(row.label, '反映確認待ち');
    assert.equal(row.assemblyVerified, false);
    x.h.state.stale = false;
    x.h.ok({ action: 'resumeworkshop', operationId: row.pending[0].id });
    assert.equal(x.row().completed, true);
});
test('unscheduled, rescheduled and earlier work can complete within the adopted deadline', () => {
    for (const workDate of ['2026-10-24', '2026-10-26', null]) {
        const x = setup({ workDate }); x.h.ok({ action: 'completeworkshop', request: x.issued.request });
        const item = x.row(); assert.equal(item.completed, true);
        assert.equal(item.deadline.state, 'completed_in_time');
        assert.equal(item.workSchedule.sameDayMet, null);
        assert.equal(item.workSchedule.actualStartKnown, false);
        assert.equal(item.workSchedule.readinessAssessed, false);
    }
});
test('unknown night stays unknown but is not an incomplete assembly task after verified completion', () => {
    for (const nightProduction of ['unknown', 'stopped']) {
        const x = setup({ nightProduction });
        x.h.ok({ action: 'completeworkshop', request: x.issued.request });
        assert.equal(x.row().completed, true);
        assert.equal(x.row().workSchedule.nightProduction, nightProduction);
        assert.equal(x.row().workSchedule.sameDayMet, null);
    }
});
test('deadline uses snapshot Japan day even without a workday; planned day passing is separate', () => {
    const x = setup({ workDate: null }), s = x.snapshot();
    s.checkedAt = '2026-10-30T14:59:59Z';
    assert.equal(board.model(s).items[0].deadline.state, 'due_today');
    s.checkedAt = '2026-10-30T15:00:00Z';
    assert.equal(board.model(s).asOf, '2026-10-31');
    assert.equal(board.model(s).items[0].deadline.state, 'overdue_unconfirmed');
    const planned = setup().snapshot(); planned.checkedAt = '2026-10-26T00:00:00Z';
    assert.equal(board.model(planned).items[0].workSchedule.state, 'past_plan');
    assert.equal(board.model(planned).items[0].deadline.state, 'upcoming');
});
test('true deadline overrun remains for impact review regardless of optional scheduling', () => {
    for (const assemblySchedule of [undefined, schedule({ workDate: null }), schedule()]) {
        const h = fixture(), issued = h.issue({ readyBy: '2026-10-24', ...(assemblySchedule ? { assemblySchedule } : {}) });
        const snapshot = () => ({ ...h.ok({ action: 'fetchworkshop' }), checkedAt: '2026-10-25T09:00:00Z' });
        assert.equal(board.model(snapshot()).items[0].deadline.state, 'overdue_unconfirmed');
        h.ok({ action: 'completeworkshop', request: issued.request });
        const model = board.model(snapshot());
        assert.equal(model.items[0].deadline.state, 'completed_late');
        assert.equal(model.items[0].assemblyVerified, true);
        assert.equal(board.select(model).length, 1);
        assert.equal(board.select(model, { completed: true }).length, 0);
        assert.equal(h.state.roles[2].history.length, 1);
    }
});
test('absent workday never hides partial reflection, missing roles or inconsistent future actuals', () => {
    const x = setup({ workDate: null, nightProduction: 'unknown' }); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    assert.equal(x.row().completed, false);
    const pending = x.row(); x.h.state.stale = false;
    x.h.ok({ action: 'resumeworkshop', operationId: pending.pending[0].id });
    assert.equal(x.row().completed, true);
    const missing = x.snapshot(); missing.roles = missing.roles.filter(r => r.id !== 'C');
    assert.equal(board.model(missing).items[0].completed, false);
    const future = x.snapshot(); future.checkedAt = '2026-10-24T09:00:00Z';
    const item = board.model(future).items[0];
    assert.equal(item.completed, false); assert.equal(item.deadline.state, 'invalid_actual');
    assert.match(item.blockers.join(), /未来/);
});
test('legacy instructions remain usable without inventing an assembly day from their deadline', () => {
    const h = fixture(), issued = h.issue(); let item = board.model(h.ok({ action: 'fetchworkshop' })).items[0];
    assert.equal(item.workSchedule.state, 'unscheduled'); assert.equal(item.assemblySchedule, null);
    h.ok({ action: 'completeworkshop', request: issued.request });
    item = board.model(h.ok({ action: 'fetchworkshop' })).items[0]; assert.equal(item.completed, true); assert.equal(item.workSchedule.sameDayMet, null);
});
test('malformed schedules are rejected before shared writes; unknown values must be explicit', () => {
    for (const bad of [null, {}, schedule({ workDate: '2026-02-30' }), schedule({ nightProduction: '' }),
        schedule({ source: '' }), { ...schedule(), completionReflected: true }]) {
        const h = fixture();
        assert.equal(h.post(h.plan(null, 'bad', 'save_draft', { items: [{ standId: '14', assemblySchedule: bad }], reason: 'fixture' })).success, false);
        assert.equal(h.state.writes, 0);
    }
});
test('schedule revision needs adoption and reviewed instruction revision; an old editor cannot erase schedule', () => {
    const x = setup(), h = x.h;
    const def = domain.project(x.issued.instruction).definition;
    const item = { id: def.planItemId, standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2026-10-30' };
    const before = h.state.writes;
    assert.equal(h.post(h.plan(x.issued.adopted, 'omitted', 'save_draft', { items: [item], reason: 'old client' })).success, false);
    assert.equal(h.state.writes, before);
    const changed = { ...item, assemblySchedule: schedule({ workDate: '2026-10-26' }) };
    const draft = h.ok(h.plan(x.issued.adopted, 'new-draft', 'save_draft', { items: [changed], reason: '日程調整' })).record;
    assert.equal(x.row().workSchedule.workDate, '2026-10-25');
    const adopted = h.ok(h.plan(draft, 'new-adopt', 'adopt', { planVersionId: h.gas.RollWorkshopAdoption.project(draft).draft.planVersionId })).record;
    assert.equal(h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const blocked = h.ok({ action: 'issueworkshopplan', planId: adopted.id, request: { requestId: 'revise-without-review' } });
    assert.equal(blocked.ready, false); assert.equal(x.row().workSchedule.workDate, '2026-10-25');
    const result = h.ok({ action: 'issueworkshopplan', planId: adopted.id, request: { requestId: 'reviewed', revisionReason: '作業日調整', expectedRevisions: { [x.issued.instruction.id]: 1 } } });
    assert.equal(result.ready, true); assert.equal(x.row().workSchedule.workDate, '2026-10-26');
    assert.equal(result.records[0].id, x.issued.instruction.id);
    assert.equal(domain.project(result.records[0]).actuals.prepared, null);
});
test('browser globals load in page order and evaluate a scheduled instruction', () => {
    const fs = require('node:fs'), vm = require('node:vm');
    const sandbox = vm.createContext({});
    for (const name of ['workshop-instructions', 'preparation-forecast', 'workshop-board']) {
        vm.runInContext(fs.readFileSync(require.resolve('../js/' + name), 'utf8'), sandbox);
    }
    assert.equal(sandbox.RollWorkshopBoard.model(setup().snapshot()).items[0].workSchedule.state, 'planned_today');
});
