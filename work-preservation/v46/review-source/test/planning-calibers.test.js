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

test('unknown or invalid usage cannot be treated as an unused caliber', () => {
    const rows = [{ date: 'sample-1', size: 'D1', shift3Team: 'A', productionByTeam: { A: 1 } }];
    for (const usedRuns of [undefined, null, '', '  ', false, true, [], {}, NaN, Infinity, -1, 1.5, '不明']) {
        const result = caliberApi.projectCaliberChange(rows, {
            maxRuns: 5, usedRuns, currentCaliber: 'A', caliberSequence: ['A', 'B'], nextCaliber: 'B'
        }, dependencies);
        assert.equal(result.status, 'insufficientInformation', String(usedRuns));
        assert.equal(result.usedRuns, null);
        assert.equal(result.remainingRuns, null);
        assert.deepEqual(result.missingInformation, ['usedRuns']);
        assert.deepEqual(result.candidateSlots, []);
        assert.equal(result.recommendation, null);
        assert.equal(result.firstOverLimitRun, null);
        assert.equal(result.nextCaliber, null);
    }
});

test('a missing or invalid maximum is unknown rather than an immediate replacement deadline', () => {
    const rows = [{ date: 'sample-1', size: 'D1', shift3Team: 'A', productionByTeam: { A: 1 } }];
    for (const maxRuns of [undefined, null, '', ' ', false, true, [], {}, NaN, Infinity, -1, 0, 1.5]) {
        const result = caliberApi.projectCaliberChange(rows, { maxRuns, usedRuns: 0 }, dependencies);
        assert.equal(result.status, 'insufficientInformation', String(maxRuns));
        assert.equal(result.maxRuns, null);
        assert.equal(result.usedRuns, 0);
        assert.deepEqual(result.missingInformation, ['maxRuns']);
        assert.equal(result.recommendation, null);
    }
    const missingBoth = caliberApi.projectCaliberChange(rows, {}, dependencies);
    assert.deepEqual(missingBoth.missingInformation, ['maxRuns', 'usedRuns']);
});

test('explicit zero and numeric text remain usable and accumulated usage stays exhausted', () => {
    const rows = [{ date: 'sample-1', size: 'D1', shift3Team: 'A', productionByTeam: { A: 1 } }];
    for (const usedRuns of [0, '0']) {
        const result = caliberApi.projectCaliberChange(rows, { maxRuns: '5', usedRuns }, dependencies);
        assert.equal(result.status, 'notDueWithinHorizon');
        assert.equal(result.remainingRuns, 5);
    }
    const exhausted = caliberApi.projectCaliberChange(rows, { maxRuns: 5, usedRuns: 7 }, dependencies);
    assert.equal(exhausted.usedRuns, 7);
    assert.equal(exhausted.remainingRuns, 0);
    assert.equal(exhausted.firstOverLimitRun.date, 'sample-1');
    assert.equal(exhausted.status, 'noSafeSlot');
});

test('one unknown caliber does not suppress independent known results or mutate inputs', () => {
    const states = [{ equipmentId: 'one', maxRuns: 5 }, { equipmentId: 'two', maxRuns: 5, usedRuns: 0 }];
    const before = JSON.stringify(states);
    const results = caliberApi.projectCaliberChanges([
        { date: 'sample-1', size: 'D1', shift3Team: 'A', productionByTeam: { A: 1 } }
    ], states, dependencies);
    assert.deepEqual(results.map(item => item.status), ['insufficientInformation', 'notDueWithinHorizon']);
    assert.equal(JSON.stringify(states), before);
});

test('an unknown future production amount cannot be counted as no usage', () => {
    const rows=[{date:'sample-1',size:'D1',shift3Team:'A',productionByTeam:{A:null}}];
    const result=caliberApi.projectCaliberChange(rows,{maxRuns:5,usedRuns:0},dependencies);
    assert.equal(result.status,'insufficientInformation');
    assert.deepEqual(result.missingInformation,['productionByTeam']);
    assert.equal(result.remainingRuns,null);
    assert.throws(()=>caliberApi.buildProductionRuns(rows,scheduleApi),/生産量が不明/);
});
