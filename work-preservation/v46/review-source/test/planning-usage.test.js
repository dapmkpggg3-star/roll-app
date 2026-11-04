const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizePlan } = require('../js/planning-usage');
const caliber = (id, extra = {}) => ({ id, size: 'D1', maxRuns: 6, openingUsedRuns: null, ...extra });
const period = (id, caliberIds, runs, extra = {}) => ({
    id, caliberIds, runs, size: 'D1', recordType: 'plan', quantityKind: 'incremental', certainty: 'reference', ...extra
});

test('simultaneous pair use counts each caliber fully but production only once', () => {
    const result = summarizePlan({ calibers: [caliber('a'), caliber('b')], periods: [period('p', ['a', 'b'], 5)] });
    assert.equal(result.plannedOperatingRuns, 5);
    assert.deepEqual(result.calibers.map(c => c.plannedRuns), [5, 5]);
    assert.deepEqual(result.calibers.map(c => c.usageStatus), ['unknown', 'unknown']);
    assert.deepEqual(result.calibers.map(c => c.remainingRuns), [null, null]);
    assert.equal(result.readinessAssessed, false);
});

test('reuse adds incremental periods to the same caliber without resetting or double-adding a total', () => {
    const result = summarizePlan({ calibers: [caliber('a', { openingUsedRuns: 1 })], periods: [period('p1', ['a'], 3), period('p2', ['a'], 1)] });
    assert.equal(result.calibers[0].plannedRuns, 4);
    assert.equal(result.calibers[0].projectedUsedRuns, 5);
    assert.equal(result.calibers[0].remainingRuns, 1);
    assert.equal(result.calibers[0].usageStatus, 'withinRecordedLimit');
    assert.throws(() => summarizePlan({ calibers: [caliber('a')], periods: [period('p', ['a'], 4, { quantityKind: 'cumulative' })] }), /追加分/);
});

test('no planned use does not prove unused stock and missing baselines remain unknown', () => {
    for (const openingUsedRuns of [undefined, null, '', ' ', false, [], 'unknown', -1]) {
        const c = summarizePlan({ calibers: [caliber('a', { openingUsedRuns })], periods: [] }).calibers[0];
        assert.equal(c.plannedRuns, 0);
        assert.equal(c.openingUsedRuns, null);
        assert.equal(c.remainingRuns, null);
        assert.equal(c.usageStatus, 'unknown');
    }
});

test('tentative production is separate and unknown charge duration is not one shift', () => {
    const result = summarizePlan({ calibers: [caliber('a', { openingUsedRuns: 0 })], periods: [period('p1', ['a'], 4), period('p2', ['a'], null, { certainty: 'tentative' })] });
    assert.equal(result.plannedOperatingRuns, 4);
    assert.equal(result.tentativeOperatingRuns, null);
    assert.equal(result.calibers[0].plannedRuns, 4);
    assert.equal(result.calibers[0].tentativeRuns, null);
    assert.equal(result.calibers[0].tentativeUsageStatus, 'unknown');
    const exceeded = summarizePlan({ calibers: [caliber('a', { openingUsedRuns: 0 })], periods: [period('p1', ['a'], 4), period('p2', ['a'], 3, { certainty: 'tentative' })] });
    assert.equal(exceeded.calibers[0].usageStatus, 'withinRecordedLimit');
    assert.equal(exceeded.calibers[0].tentativeUsageStatus, 'exceeded');
});

test('an unknown period keeps its subtotal separate and cannot produce a healthy remaining value', () => {
    const result = summarizePlan({ calibers: [caliber('a', { openingUsedRuns: 0 })], periods: [period('p1', ['a'], 3), period('p2', ['a'], '')] });
    assert.equal(result.plannedOperatingRuns, null);
    assert.equal(result.knownPlannedOperatingRuns, 3);
    assert.equal(result.calibers[0].plannedRuns, null);
    assert.equal(result.calibers[0].knownPlannedRuns, 3);
    assert.equal(result.calibers[0].usageStatus, 'unknown');
});

test('a known subtotal above the maximum remains an exceedance despite other missing quantities', () => {
    const result = summarizePlan({ calibers: [caliber('a')], periods: [period('p1', ['a'], 7), period('p2', ['a'], null)] });
    assert.equal(result.calibers[0].usageStatus, 'exceeded');
    assert.equal(result.calibers[0].remainingRuns, null);
    assert.deepEqual(result.calibers[0].missingInformation, ['openingUsedRuns', 'plannedRuns']);
});

test('ambiguous identities, repeated pair members, wrong sizes and actuals are rejected', () => {
    const one = [caliber('a')];
    assert.throws(() => summarizePlan({ calibers: [...one, ...one], periods: [] }), /ID/);
    assert.throws(() => summarizePlan({ calibers: one, periods: [period('p', ['a'], 1), period('p', ['a'], 1)] }), /ID/);
    assert.throws(() => summarizePlan({ calibers: one, periods: [period('p', ['b'], 1)] }), /対応/);
    assert.throws(() => summarizePlan({ calibers: one, periods: [period('p', ['a', 'a'], 1)] }), /対応/);
    assert.throws(() => summarizePlan({ calibers: one, periods: [period('p', ['a'], 1, { size: 'D2' })] }), /サイズ/);
    assert.throws(() => summarizePlan({ calibers: one, periods: [period('p', ['a'], 1, { recordType: 'actual' })] }), /実績/);
    assert.throws(() => summarizePlan({ calibers: one, periods: [period('p', ['a'], 1, { certainty: undefined })] }), /確定区分/);
});

test('separate cycle identities stay separate and input ordering or repeats do not alter stored inputs', () => {
    const input = { calibers: [caliber('cycle-one:A'), caliber('cycle-two:A', { openingUsedRuns: 0 })], periods: [period('p', ['cycle-one:A'], 6)] };
    const before = JSON.stringify(input);
    const result = summarizePlan(input);
    assert.equal(result.calibers[1].plannedRuns, 0);
    assert.equal(result.calibers[1].remainingRuns, 6);
    assert.deepEqual(summarizePlan(input), result);
    assert.equal(JSON.stringify(input), before);
});
