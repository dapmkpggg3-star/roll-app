const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../js/planning-rules');

const { WORK_TYPES, SLOT_TYPES } = api;
const rules = api.createPlanningRules({
    afterProductionAllowedWorkTypes: [WORK_TYPES.CALIBER_CHANGE],
    afterProductionCaliberStands: ['L3', 'L4'],
    sizeChangeStands: ['L3', 'L4', 'L5'],
    singleCrewSizeChangeAddOnStands: ['L5']
});

test('production-active slots reject maintenance work', () => {
    const result = rules.validateWorkForSlot(
        { type: WORK_TYPES.CALIBER_CHANGE, stands: ['L3'] },
        { type: SLOT_TYPES.STOPPED_SHIFT, productionActive: true }
    );
    assert.equal(result.allowed, false);
});

test('after-production work follows configurable work types and equipment', () => {
    const slot = { type: SLOT_TYPES.AFTER_PRODUCTION, productionActive: false };
    assert.equal(rules.validateWorkForSlot({ type: WORK_TYPES.SIZE_CHANGE }, slot).allowed, false);
    assert.equal(rules.validateWorkForSlot({ type: WORK_TYPES.CALIBER_CHANGE, stands: ['L3'] }, slot).allowed, true);
    assert.equal(rules.validateWorkForSlot({ type: WORK_TYPES.CALIBER_CHANGE, stands: ['L2'] }, slot).allowed, false);
});

test('single-crew add-on limits are configurable', () => {
    const slot = { type: SLOT_TYPES.STOPPED_SHIFT, productionActive: false };
    const sizeChange = { type: WORK_TYPES.SIZE_CHANGE, stands: ['L3', 'L4', 'L5'] };
    assert.equal(rules.validateWorkBundle([sizeChange, { type: WORK_TYPES.ROLL_CHANGE, stands: ['L5'] }], slot).allowed, true);
    assert.equal(rules.validateWorkBundle([sizeChange, { type: WORK_TYPES.ROLL_CHANGE, stands: ['L4'] }], slot).allowed, false);
});

test('joint maintenance can accept a larger bundle', () => {
    const result = rules.validateWorkBundle([
        { type: WORK_TYPES.SIZE_CHANGE, stands: ['L3', 'L4', 'L5'] },
        { type: WORK_TYPES.ROLL_CHANGE, stands: ['L4', 'L5'] }
    ], {
        type: SLOT_TYPES.DAY_MAINTENANCE,
        productionActive: false,
        jointMaintenance: true
    });
    assert.equal(result.allowed, true);
});

test('stopped shift with the next production team ranks first', () => {
    const chosen = rules.chooseSizeChangeSlot([
        { id: 'day', type: SLOT_TYPES.DAY_MAINTENANCE, team: 'A', productionActive: false },
        { id: 'other', type: SLOT_TYPES.STOPPED_SHIFT, team: 'B', productionActive: false },
        { id: 'same', type: SLOT_TYPES.STOPPED_SHIFT, team: 'A', productionActive: false }
    ], 'A');
    assert.equal(chosen.slot.id, 'same');
});

test('a different team remains eligible with a warning', () => {
    const result = rules.scoreSizeChangeSlot({
        type: SLOT_TYPES.STOPPED_SHIFT,
        team: 'B',
        productionActive: false
    }, 'A');
    assert.equal(result.eligible, true);
    assert.match(result.warnings.join(' '), /再確認/);
});

test('size changes are detected without exposing source production amounts', () => {
    const changes = rules.detectProductionSizeChanges([
        { date: 'sample-1', size: 'D1', productionAmount: 1 },
        { date: 'sample-2', size: 'STOP', productionAmount: 0 },
        { date: 'sample-3', size: 'D2', productionAmount: 1 }
    ]);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].fromSize, 'D1');
    assert.equal(changes[0].toSize, 'D2');
});
