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

test('production runs can be counted separately by product size', () => {
    const runs = caliberApi.buildProductionRuns([
        { date: 'sample-1', size: 'D1', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1 } },
        { date: 'sample-2', size: 'D2', shift1Team: '', shift3Team: 'B', productionByTeam: { B: 1 } },
        { date: 'sample-3', size: 'D1', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1 } }
    ], scheduleApi, { size: 'D1' });
    assert.deepEqual(runs.map(run => run.date), ['sample-1', 'sample-3']);
});

test('size activation starts a new production campaign', () => {
    const schedule = [
        { date: 'sample-1', size: 'D1', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1 } },
        { date: 'sample-2', size: 'D1', shift1Team: '', shift3Team: 'B', productionByTeam: { B: 1 } },
        { date: 'sample-3', size: 'STOP', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 0 } },
        { date: 'sample-4', size: 'D2', shift1Team: '', shift3Team: 'A', productionByTeam: { A: 1 } },
        { date: 'sample-5', size: 'D1', shift1Team: '', shift3Team: 'B', productionByTeam: { B: 1 } }
    ];
    const campaigns = caliberApi.buildProductionCampaigns(schedule, scheduleApi);
    assert.deepEqual(campaigns.map(item => [item.size, item.runs.length]), [
        ['D1', 2], ['D2', 1], ['D1', 1]
    ]);
});

test('long same-size campaigns produce mid-campaign caliber deadlines', () => {
    const schedule = [1, 2, 3, 4, 5].map(index => ({
        date: `sample-${index}`,
        size: 'D1',
        shift1Team: '',
        shift3Team: index % 2 ? 'A' : 'B',
        productionByTeam: { A: 1, B: 1 }
    }));
    const requirements = caliberApi.detectCampaignCaliberRequirements(schedule, {
        equipmentId: 'line-pair', stands: ['L2', 'L3'], maxRunsBySize: { D1: 2 }
    }, dependencies);
    assert.deepEqual(requirements.map(item => item.firstOverLimitRun.date), ['sample-3', 'sample-5']);
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
        equipmentId: 'line-pair', stands: ['L4'], maxRuns: 3, usedRuns: 1,
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

test('an allowed after-production slot can protect the next shift', () => {
    const result = caliberApi.projectCaliberChange([{
        date: 'sample-1',
        shift1Team: 'A',
        shift3Team: 'B',
        productionByTeam: { A: 1, B: 1 }
    }], {
        equipmentId: 'line-pair', stands: ['L2', 'L3'], maxRuns: 1, usedRuns: 0
    }, dependencies);
    assert.equal(result.firstOverLimitRun.shift, 'shift3');
    assert.equal(result.recommendation.id, 'sample-1|afterShift1|A');
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
