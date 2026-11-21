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

test('an explicit output month still stops when a later amount is unknown or negative', () => {
    const laterNull = schedule.concat([{ date: '2031-11-01', size: '', productionAmount: null }]);
    const laterNegative = schedule.concat([{ date: '2031-11-01', size: 'D1', productionAmount: -1 }]);
    assert.equal(output.latestPeriod(laterNegative), null);
    assert.equal(output.laterAmountUnconfirmed(laterNull, { year: 2031, month: 10 }), true);
    assert.throws(() => output.buildExportPayload({ schedule: laterNull }, {
        period: { year: 2031, month: 10 }, now: 1, random: 0
    }), /後の月の生産量が未確認/);
    assert.throws(() => output.buildExportPayload({ schedule: laterNegative }, {
        period: { year: 2031, month: 10 }, now: 1, random: 0
    }), /後の月の生産量が未確認/);
    const payload = output.buildExportPayload({ schedule: schedule.concat([{
        date: '2031-11-01', size: 'STOP', productionAmount: 0
    }]) }, { period: { year: 2031, month: 10 }, now: 1, random: 0 });
    assert.equal(payload.year, 2031);
    assert.equal(payload.month, 10);
    assert.deepEqual(payload.suggestions, []);
});

test('an unknown amount in a later month does not keep the earlier month as confirmed output', () => {
    assert.equal(output.latestPeriod(schedule.concat([{
        date: '2031-11-01', size: '', productionAmount: null
    }])), null);
    assert.throws(() => output.buildExportPayload({
        schedule: schedule.concat([{ date: '2031-11-01', size: 'D1', productionAmount: null }])
    }, { now: 1, random: 0 }), /年月を確認できません/);
});

test('an incomplete output month does not look like a finished plan', () => {
    const day = (date, extra = {}) => ({
        date, size: 'D13', shift1Team: 'B', shift3Team: 'A', productionAmount: 100, ...extra
    });
    const options = { period: { year: 2031, month: 10 }, now: 1, random: 0 };
    assert.throws(() => output.buildExportPayload({
        schedule: [day('2031-10-01'), day('2031-10-03')]
    }, options), /日付行が抜けている/);
    assert.throws(() => output.buildExportPayload({
        schedule: [day('2031-10-01'), day('2031-10-01')]
    }, options), /同じ日付が重なっている/);
    assert.throws(() => output.buildExportPayload({
        schedule: [day('2031-10-01'), day('2031-10-02', { date: '2031-10-02 ' })]
    }, options), /日付を確認できない/);
    for (const period of [{ year: 2031, month: 13 }, { year: 2031, month: 0 }, { year: '2031', month: '10' }, { year: 2031, month: 10.5 }]) {
        assert.throws(() => output.buildExportPayload({ schedule: [day('2031-10-01'), day('2031-10-02')] }, {
            period, now: 1, random: 0
        }), /年月の指定が不正/);
    }
    for (const extra of [
        { productionAmount: null },
        { productionAmount: -1 },
        { productionAmount: Number.NaN },
        { productionAmount: '100' },
        { size: '' },
        { size: 'D' },
        { shift1Team: '', shift3Team: '' },
        { shift1Team: 'C', shift3Team: ' ' }
    ]) {
        assert.throws(() => output.buildExportPayload({
            schedule: [day('2031-10-01'), day('2031-10-02', extra)]
        }, options), /未確認/);
    }
    const nightOnly = output.buildExportPayload({
        schedule: [day('2031-10-01', { shift1Team: '', shift3Team: 'A', productionAmount: 0, size: 'STOP' })]
    }, options);
    assert.equal(nightOnly.month, 10);
    assert.equal(nightOnly.calendarRows[0].operationAShift, 'Ⅲ');
    assert.deepEqual(nightOnly.suggestions, []);
    const middle = output.buildExportPayload({
        schedule: [day('2031-10-15', { size: 'STOP', productionAmount: 0 }), day('2031-10-16')]
    }, options);
    assert.equal(middle.calendarRows.length, 2);
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

test('direct suggestion builder never emits unapproved E/H/K column writes', () => {
    const change = { fromDate: '2031-09-30', toDate: '2031-10-02', fromSize: 'D10', toSize: 'D13' };
    for (const team of ['A', 'B', undefined]) {
        const input = [{ change, recommendation: { slot: { date: '2031-10-01', team, shift: 'shift1' } } }];
        assert.deepEqual(output.buildSizeChangeSuggestions(input, { year: 2031, month: 10 }), []);
    }
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
    assert.deepEqual(payload.suggestions, []);
    assert.deepEqual(payload.capabilities, { sizeChangeConnected: true, caliberConnected: false });
});


test('missing or out-of-month work slots never create a K-column review suggestion', () => {
    const change = { fromDate: '2031-09-30', toDate: '2031-10-02', fromSize: 'D10', toSize: 'D13' };
    const period = { year: 2031, month: 10 };
    assert.deepEqual(output.buildSizeChangeSuggestions([{ change, recommendation: null }], period), []);
    assert.deepEqual(output.buildSizeChangeSuggestions([{ change, recommendation: { slot: null } }], period), []);
    assert.deepEqual(output.buildSizeChangeSuggestions([{
        change, recommendation: { slot: { date: '2031-11-02', team: 'A', shift: 'shift1' } }
    }], period), []);
});


test('export payload never proposes writes to E/H team or K work cells', () => {
    for (const team of ['A', 'B', undefined]) {
        const payload = output.buildExportPayload({ schedule, planning: {
            sizeChanges: [{ change: { toDate: '2031-10-02', fromSize: 'D10', toSize: 'D13' },
                recommendation: { slot: { date: '2031-10-01', shift: 'shift1', team, requiredCompanionWorkCount: 0 } } }]
        } }, { now: 1234, random: 0 });
        assert.deepEqual(payload.suggestions, []);
    }
});


test('a nested date value cannot be exported as a calendar date', () => {
    const invalid = schedule.map(row => ({ ...row, date: [row.date] }));
    assert.equal(output.dateParts(invalid[0].date), null);
    assert.throws(() => output.buildExportPayload({ schedule: invalid }, {
        period: { year: 2031, month: 10 }
    }), /日付を確認できない/);
});

test('an array is not a confirmed shift team even when it contains a single team name', () => {
    const row = { ...schedule[2], shift3Team: '' };
    const payload = input => output.buildExportPayload({ schedule: [{ ...row, shift1Team: input }] });
    assert.throws(() => payload(['A']), /班が未確認/);
    assert.equal(payload('Ａ').calendarRows[0].operationAShift, 'Ⅰ');
});


test('malformed future-month dates cannot hide unconfirmed production', () => {
    const current = { date: '2031-11-01', size: 'D10', shift1Team: 'A', productionAmount: 400 };
    const period = { year: 2031, month: 11 };
    for (const date of ['2031-12-02', '2031-12-02INVALID', '2031-12-02T99:99']) {
        const later = { date, size: 'D13', shift1Team: 'B', productionAmount: null };
        assert.throws(() => output.buildExportPayload({ schedule: [current, later] }, { period }), /後の月の生産量が未確認/);
    }
});


test('unparseable later dates with unknown amounts fail closed instead of bypassing month guard', () => {
    const current = { date: '2031-11-01', size: 'D10', shift1Team: 'A', productionAmount: 400 };
    const period = { year: 2031, month: 11 };
    for (const date of ['2032/01/02', '2032-01', '2032.01.02']) {
        const later = { date, size: 'D13', shift1Team: 'B', productionAmount: null };
        assert.throws(() => output.buildExportPayload({ schedule: [current, later] }, { period }), /後の月の生産量が未確認/);
    }
});


test('only exact confirmed stop tokens are exported as shutdown days', () => {
    for (const token of ['STOP', '休止', '休み']) {
        assert.equal(output.displaySize(token), '休止', token);
    }
    for (const token of ['DSTOP', '休止日', '前日休止', '休み予定']) {
        assert.equal(output.displaySize(token), '', token);
    }
    assert.equal(output.displaySize('D13'), 'D13');
});


test('malformed same-month date rows must not silently disappear from the exported calendar', () => {
    const day = date => ({ date, size: 'D13', productionAmount: 400, shift1Team: 'A' });
    const options = { period: { year: 2032, month: 1 }, now: 1, random: 0 };
    const normal = output.buildExportPayload({ schedule: [day('2032-01-02'), day('2032-01-03')] }, options);
    assert.deepEqual(normal.calendarRows.map(row => row.date), ['2032-01-02', '2032-01-03']);
    for (const malformed of ['2032/01/03', '2032.01.03', '2032-1-03']) {
        assert.throws(() => output.buildExportPayload({ schedule: [day('2032-01-02'), day(malformed)] }, options), /日付を確認できない/, malformed);
    }
    const otherMonth = output.buildExportPayload({ schedule: [day('2032-01-02'), day('2031/12/03')] }, options);
    assert.deepEqual(otherMonth.calendarRows.map(row => row.date), ['2032-01-02']);
});
