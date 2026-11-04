const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { fixture } = require('./helpers/workshop-api-fixture.cjs');
function setup(complete = true) {
    const h = fixture(), issued = h.issue();
    if (complete) h.ok({ action: 'completeworkshop', request: issued.request });
    h.gas.workshopValidationEnvironment_ = h.gas.openRollManagementSpreadsheet_;
    h.gas.console = { log() {} };
    vm.runInContext(fs.readFileSync(require.resolve('./manual-workshop-preflight.gs'), 'utf8'), h.gas);
    return h;
}
test('live preflight verifies durable evidence against current rows without writing', () => {
    const h = setup(), writes = h.state.writes;
    const result = h.gas.runWorkshopValidationPreflight();
    assert.equal(result.ready, true); assert.equal(result.verifiedCompletions, 1);
    assert.equal(result.firebaseBrowserTest, false);
    assert.equal(h.state.writes, writes); assert.equal(h.state.held, false);
});
test('later role changes and formula display drift are reported without repair', () => {
    for (const type of ['role', 'history']) {
        const h = setup(), writes = h.state.writes;
        if (type === 'role') h.state.roles[0].memo = 'later legitimate edit';
        else h.state.stale = true;
        const result = h.gas.runWorkshopValidationPreflight();
        assert.equal(result.ready, false); assert.equal(result.verifiedCompletions, 0);
        assert.equal(result.issues[0].kind, type === 'role' ? 'roles_changed' : 'history_changed');
        assert.equal(h.state.writes, writes); assert.equal(h.state.held, false);
    }
});
test('unfinished operation and invalid record cannot pass preflight or trigger recovery', () => {
    const h = setup(false), before = h.ok({ action: 'fetchworkshop' });
    const issued = before.instructions[0], def = h.gas.RollWorkshopInstructions.project(issued).definition;
    h.state.stale = true;
    h.post({ action: 'completeworkshop', request: { instructionId: issued.id, cycleId: def.cycleId,
        recipientRoleId: 'C', operatorId: 'fixture-op', requestId: 'pending-check', expectedInstructionRevision: issued.revision,
        expectedRolesRevision: before.rolesRevision, fromStatus: '新品予備（組替可能）', toStatus: '新品予備（組込完了）', on: '2026-10-25' } });
    const writes = h.state.writes;
    const result = h.gas.runWorkshopValidationPreflight();
    assert.equal(result.ready, false); assert.equal(result.issues[0].kind, 'pending');
    assert.equal(h.state.writes, writes);
    h.state.tables.get('_WorkshopOperations_v1').rows[1][1] = '{broken';
    assert.throws(() => h.gas.runWorkshopValidationPreflight());
    assert.equal(h.state.held, false); assert.equal(h.state.writes, writes);
});
