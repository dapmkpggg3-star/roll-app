const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../js/planning-view');

test('view model summarizes size and caliber recommendations', () => {
    const model = view.buildPlanningViewModel({
        sizeChanges: [{
            change: { fromSize: 'D1', toSize: 'D2', toDate: 'sample-3' },
            recommendation: { slot: { date: 'sample-2', shift: 'shift3' } }
        }],
        caliberChanges: [{
            equipmentId: 'line-pair', size: 'D2', status: 'slotFound',
            firstOverLimitRun: { date: 'sample-5' },
            recommendation: { date: 'sample-4', shift: 'dayMaintenance' }
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
