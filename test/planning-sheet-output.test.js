const test = require('node:test');
const assert = require('node:assert/strict');
const output = require('../js/planning-sheet-output');

const schedule = [
    {
        date: '2031-09-30', size: 'D10', shift1Team: 'A', shift3Team: 'B',
        productionAmount: 100, productionByTeam: { A: 50, B: 50 }
    },
    {
        date: '2031-10-01', size: 'STOP', shift1Team: 'B', shift3Team: 'A',
        productionAmount: 0, productionByTeam: { A: 0, B: 0 }
    },
    {
        date: '2031-10-02', size: 'D13', shift1Team: 'B', shift3Team: 'A',
        productionAmount: 100, productionByTeam: { A: 50, B: 50 }
    }
];

test('the latest imported production month becomes the output month', () => {
    assert.deepEqual(output.latestPeriod(schedule), { year: 2031, month: 10 });
});

test('a blank future placeholder month does not replace the latest active production month', () => {
    assert.deepEqual(output.latestPeriod(schedule.concat([{
        date: '2031-11-01', size: 'STOP', productionAmount: 0
    }])), { year: 2031, month: 10 });
});

test('calendar output contains no production amounts', () => {
    const rows = output.buildCalendarRows(schedule, { year: 2031, month: 10 });
    assert.deepEqual(rows[0], {
        date: '2031-10-01', day: 1, weekday: '水', size: '休止',
        operationAShift: 'Ⅲ', operationBShift: 'Ⅰ'
    });
    assert.equal(JSON.stringify(rows).includes('productionAmount'), false);
    assert.equal(JSON.stringify(rows).includes('productionByTeam'), false);
});

test('size-change suggestions are routed to the assigned operation column', () => {
    const suggestions = output.buildSizeChangeSuggestions([{
        change: { fromDate: '2031-09-30', toDate: '2031-10-02', fromSize: 'D10', toSize: 'D13' },
        recommendation: { slot: { date: '2031-10-01', team: 'B', shift: 'shift1' } }
    }], { year: 2031, month: 10 });
    assert.deepEqual(suggestions[0], {
        kind: 'sizeChange', date: '2031-10-01', column: 'H',
        text: 'サイズ替（自動案）', status: 'candidate', fromSize: 'D10', toSize: 'D13'
    });
});

test('export payload targets one idempotent monthly sheet', () => {
    const payload = output.buildExportPayload({
        schedule,
        importedSheets: ['31.09 生産予定', '31.10 生産予定'],
        planning: {
            generatedAt: '2031-09-25T00:00:00.000Z',
            caliberConnected: false,
            sizeChanges: [{
                change: { fromDate: '2031-09-30', toDate: '2031-10-02', fromSize: 'D10', toSize: 'D13' },
                recommendation: { slot: { date: '2031-10-01', team: 'B', shift: 'shift1' } }
            }]
        }
    }, { now: 1234, random: 0 });
    assert.equal(payload.sheetName, '2031.10 ロールカリバ替予定');
    assert.equal(payload.requestId, 'planning-1234-000000');
    assert.equal(payload.calendarRows.length, 2);
    assert.equal(payload.suggestions.length, 1);
    assert.deepEqual(payload.capabilities, { sizeChangeConnected: true, caliberConnected: false });
});
