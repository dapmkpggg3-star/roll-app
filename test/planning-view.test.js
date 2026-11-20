const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../js/planning-view');

test('view model summarizes size and caliber recommendations', () => {
    const model = view.buildPlanningViewModel({
        sizeChanges: [{
            change: { fromSize: 'D1', toSize: 'D2', toDate: 'sample-3' },
            recommendation: { slot: { date: 'sample-2', shift: 'shift3', requiredCompanionWorkCount: 0 } }
        }],
        caliberChanges: [{
            equipmentId: 'line-pair', size: 'D2', status: 'slotFound',
            firstOverLimitRun: { date: 'sample-5' },
            recommendation: { date: 'sample-4', shift: 'dayMaintenance', requiredCompanionWorkCount: 0 }
        }]
    });
    assert.deepEqual(model.summary, { sizeChangeCount: 1, caliberChangeCount: 1, riskCount: 0 });
    assert.equal(model.items[0].statusLabel, '候補あり');
    assert.equal(model.items[1].slotLabel, 'sample-4 常昼');
});

test('internal shift names are shown as workplace labels', () => {
    assert.equal(view.displayShift('shift1'), 'Ⅰ勤');
    assert.equal(view.displayShift('shift3'), 'Ⅲ勤');
    assert.equal(view.displayShift('dayMaintenance'), '常昼');
});

test('missing safe slots are counted as risks', () => {
    const model = view.buildPlanningViewModel({
        caliberChanges: [{
            equipmentId: 'line-pair', status: 'noSafeSlot',
            firstOverLimitRun: { date: 'sample-1' }
        }]
    });
    assert.equal(model.summary.riskCount, 1);
    assert.equal(model.items[0].statusLabel, '安全枠なし');
});

test('empty input produces a stable empty model', () => {
    const model = view.buildPlanningViewModel();
    assert.equal(model.items.length, 0);
    assert.equal(model.summary.riskCount, 0);
});

test('caliber slotFound without recommendation is not a candidate', () => {
    const model = view.buildPlanningViewModel({ caliberChanges: [{ status: 'slotFound', equipmentId: 'anonymous' }] });
    assert.equal(model.items[0].statusLabel, '経過観察');
    assert.equal(model.items[0].slotLabel, '候補枠なし');
    assert.equal(model.summary.caliberChangeCount, 0);
});

test('unknown companion work cannot produce a visible candidate', () => {
    const model = view.buildPlanningViewModel({
        sizeChanges: [{ recommendation: { slot: { date: 'sample', shift: 'shift1', requiredCompanionWorkCount: null } } }],
        caliberChanges: [{ status: 'slotFound', recommendation: { date: 'sample', shift: 'shift1', requiredCompanionWorkCount: null } }]
    });
    assert.equal(model.items[0].statusLabel, '要確認');
    assert.equal(model.items[1].statusLabel, '経過観察');
    assert.equal(model.summary.caliberChangeCount, 0);
});

test('undefined companion count is unconfirmed, not zero', () => {
    const model = view.buildPlanningViewModel({
        sizeChanges: [{ recommendation: { slot: { date: 'sample', shift: 'shift1' } } }],
        caliberChanges: [{ status: 'slotFound', recommendation: { date: 'sample', shift: 'shift1' } }]
    });
    assert.equal(model.items[0].statusLabel, '要確認');
    assert.equal(model.items[1].statusLabel, '経過観察');
    assert.equal(model.summary.caliberChangeCount, 0);
});
