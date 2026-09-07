const test = require('node:test');
const assert = require('node:assert/strict');
const rulesApi = require('../js/planning-rules');
const scheduleApi = require('../js/planning-schedule');
const caliberApi = require('../js/planning-calibers');

const { WORK_TYPES, SLOT_TYPES } = rulesApi;
const ruleEngine = rulesApi.createPlanningRules({
    afterProductionAllowedWorkTypes: [WORK_TYPES.CALIBER_CHANGE],
    afterProductionCaliberStands: ['L2', 'L3']
});
const dependencies = { ruleEngine, scheduleApi, slotTypes: SLOT_TYPES, workTypes: WORK_TYPES };

test('production runs follow the assigned team in shift order', () => {
    const runs = caliberApi.buildProductionRuns([{
        date: 'sample-1',
        shift1Team: 'A',
        shift3Team: 'B',
        productionByTeam: { A: 1, B: 1 }
    }], scheduleApi);
    assert.deepEqual(runs.map(run => run.shift), ['shift1', 'shift3']);
});

test('next caliber is configurable and wraps around', () => {
    assert.equal(caliberApi.nextCaliber('C', ['A', 'B', 'C']), 'A');
    assert.equal(caliberApi.nextCaliber('X', ['A', 'B', 'C']), null);
});

test('latest safe stopped slot is selected before the first over-limit run', () => {
    const schedule = [
        { date: 'sample-1', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1, B: 0 } },
        { date: 'sample-2', shift1Team: '', shift3Team: 'B', productionByTeam: { A: 0, B: 0 } },
        { date: 'sample-3', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1, B: 0 } },
        { date: 'sample-4', shift1Team: '', shift3Team: 'B', productionByTeam: { A: 0, B: 1 } }
    ];
    const result = caliberApi.projectCaliberChange(schedule, {
        equipmentId: 'line-pair', stands: ['L2', 'L3'], maxRuns: 3, usedRuns: 1,
        currentCaliber: 'A', caliberSequence: ['A', 'B', 'C']
    }, dependencies);
    assert.equal(result.firstOverLimitRun.date, 'sample-4');
    assert.equal(result.recommendation.id, 'sample-2|shift3|B');
    assert.equal(result.nextCaliber, 'B');
    assert.equal(result.status, 'slotFound');
});

test('day maintenance can be a safe slot before night production', () => {
    const schedule = [
        {
            date: 'sample-1', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1, B: 0 },
            dayMaintenanceAvailable: true
        },
        { date: 'sample-2', shift1Team: '', shift3Team: 'B', productionByTeam: { A: 0, B: 1 } }
    ];
    const result = caliberApi.projectCaliberChange(schedule, {
        equipmentId: 'line-pair', stands: ['L2', 'L3'], maxRuns: 1, usedRuns: 1
    }, dependencies);
    assert.equal(result.firstOverLimitRun.date, 'sample-1');
    assert.equal(result.recommendation.id, 'sample-1|dayMaintenance');
});

test('a missing safe slot is reported without inventing a schedule', () => {
    const result = caliberApi.projectCaliberChange([{
        date: 'sample-1', shift1Team: 'A', shift3Team: '', productionByTeam: { A: 1, B: 0 }
    }], {
        equipmentId: 'line-pair', stands: ['L2', 'L3'], maxRuns: 1, usedRuns: 1
    }, dependencies);
    assert.equal(result.status, 'noSafeSlot');
    assert.equal(result.recommendation, null);
});

test('a distant limit is left unscheduled inside a short planning horizon', () => {
    const result = caliberApi.projectCaliberChange([{
        date: 'sample-1', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1, B: 0 }
    }], {
        equipmentId: 'line-pair', stands: ['L2', 'L3'], maxRuns: 5, usedRuns: 0
    }, dependencies);
    assert.equal(result.status, 'notDueWithinHorizon');
    assert.equal(result.recommendation, null);
});
