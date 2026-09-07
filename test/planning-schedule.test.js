const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../js/planning-rules');
const schedule = require('../js/planning-schedule');

const { WORK_TYPES, SLOT_TYPES } = api;
const rules = api.createPlanningRules({
    afterProductionAllowedWorkTypes: [WORK_TYPES.CALIBER_CHANGE],
    preferStoppedShift: true,
    preferSameTeam: true,
    stoppedShiftWeight: 1,
    sameTeamWeight: 2,
    jointMaintenanceWeight: 3
});

test('available slots are built only for assigned teams without production', () => {
    const slots = schedule.buildAvailableSlots({
        date: 'sample-1',
        shift1Team: 'A',
        shift3Team: 'B',
        productionByTeam: { A: 1, B: 0 }
    }, SLOT_TYPES);
    assert.deepEqual(slots.map(slot => slot.id), ['sample-1|shift3|B']);
});

test('explicit day-maintenance availability works without a shift team', () => {
    const slots = schedule.buildAvailableSlots({
        date: 'sample-1',
        shift1Team: '',
        shift3Team: 'A',
        productionByTeam: { A: 1, B: 0 },
        dayMaintenanceAvailable: true
    }, SLOT_TYPES);
    assert.equal(slots[0].id, 'sample-1|dayMaintenance');
});

test('first production team follows shift order', () => {
    assert.equal(schedule.firstProductionTeam({
        shift1Team: 'B',
        shift3Team: 'A',
        productionByTeam: { A: 1, B: 1 }
    }), 'B');
});

test('recommendation prefers the next production team when configured', () => {
    const result = schedule.recommendSizeChanges([
        {
            date: 'sample-1', size: 'D1', productionAmount: 1,
            shift1Team: 'B', shift3Team: 'A', productionByTeam: { A: 0, B: 1 }
        },
        {
            date: 'sample-2', size: 'STOP', productionAmount: 0,
            shift1Team: 'B', shift3Team: '', productionByTeam: { A: 0, B: 0 }
        },
        {
            date: 'sample-3', size: 'D2', productionAmount: 1,
            shift1Team: 'B', shift3Team: '', productionByTeam: { A: 0, B: 1 }
        }
    ], rules, SLOT_TYPES)[0];
    assert.equal(result.recommendation.slot.id, 'sample-2|shift1|B');
});

test('joint maintenance can raise a slot with required companion work', () => {
    const result = schedule.recommendSizeChanges([
        {
            date: 'sample-1', size: 'D1', productionAmount: 1,
            shift1Team: 'A', shift3Team: '', productionByTeam: { A: 1, B: 0 }
        },
        {
            date: 'sample-2', size: 'STOP', productionAmount: 0,
            shift1Team: 'B', shift3Team: '', productionByTeam: { A: 0, B: 0 },
            jointMaintenance: true,
            requiredWorks: [{ type: WORK_TYPES.ROLL_CHANGE }]
        },
        {
            date: 'sample-3', size: 'STOP', productionAmount: 0,
            shift1Team: '', shift3Team: 'B', productionByTeam: { A: 0, B: 0 }
        },
        {
            date: 'sample-4', size: 'D2', productionAmount: 1,
            shift1Team: 'A', shift3Team: '', productionByTeam: { A: 1, B: 0 }
        }
    ], rules, SLOT_TYPES)[0];
    assert.equal(result.recommendation.slot.id, 'sample-2|shift1|B');
});
