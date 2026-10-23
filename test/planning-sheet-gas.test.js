const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGasFunctions() {
    const context = vm.createContext({ console });
    const source = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8');
    vm.runInContext(source, context);
    return context;
}

test('monthly plan sheet names use the existing workbook naming convention', () => {
    const gas = loadGasFunctions();
    assert.equal(gas.planningSheetName_({ year: 2031, month: 10 }), '2031.10 ロールカリバ替予定');
    assert.deepEqual(
        JSON.parse(JSON.stringify(gas.parsePlanningSheetPeriod_('2031.10 ロールカリバ替予定'))),
        { year: 2031, month: 10 }
    );
});

test('only the three calendar work columns are accepted for generated suggestions', () => {
    const gas = loadGasFunctions();
    const grouped = gas.normalizePlanningSuggestions_([
        { date: '2031-10-02', column: 'E', text: 'サイズ替（自動案）' },
        { date: '2031-10-02', column: 'E', text: 'サイズ替（自動案）' },
        { date: '2031-10-02', column: 'A', text: '上書きしてはいけない' },
        { date: '2031-11-02', column: 'H', text: '別月' }
    ], { year: 2031, month: 10 });
    assert.deepEqual(JSON.parse(JSON.stringify(grouped)), {
        E6: ['サイズ替（自動案）']
    });
});

test('generated-note metadata can be recognized without treating normal notes as owned', () => {
    const gas = loadGasFunctions();
    assert.equal(gas.decodePlanningGeneratedNote_('通常メモ'), null);
    assert.deepEqual(
        JSON.parse(JSON.stringify(gas.decodePlanningGeneratedNote_('ROLL_PLANNING_GENERATED|{"generatedValue":"案"}'))),
        { generatedValue: '案' }
    );
});

test('Apps Script exposes idempotent monthly export and status actions', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8');
    assert.match(source, /action === 'writeplanningdraft'/);
    assert.match(source, /action === 'fetchplanningexportstatus'/);
    assert.match(source, /同名シートが既にあり、自動計画案ではないため上書きしません/);
    assert.match(source, /clearGeneratedPlanningSuggestions_/);
});

test('recognizes original prefix, suffix and date-only month tab names', () => {
    const gas = loadGasFunctions();
    for (const name of ['2031.10 ロールカリバ替予定', 'ロール・カリバ替予定2031.10 ', '2031.10', '２０３１年１０月 ロール･カリバー替予定']) {
        assert.deepEqual(JSON.parse(JSON.stringify(gas.parsePlanningSheetPeriod_(name))), { year: 2031, month: 10 });
    }
    for (const name of ['2031.13', '2031年度ロール(計画)', '生産予定31.10']) assert.equal(gas.parsePlanningSheetPeriod_(name), null);
});

function template(name, valid = true) {
    return { getName: () => name, getRange: () => ({ getDisplayValues: () => [valid
        ? ['日付', '曜日', 'サイズ', '操業A', '', '', '操業B', '', '', '常昼', '', 'CS']
        : ['日付', '曜日', '別の表']] }) };
}

test('template selection validates layout and prefers destination for an equal month', () => {
    const gas = loadGasFunctions();
    const local = template('2031.9');
    const source = template('ロール・カリバ替予定2031.9 ');
    gas.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'valid_source_identifier_1234567890' }) };
    gas.SpreadsheetApp = { openById: () => ({ getSheets: () => [source] }) };
    const destination = { getId: () => 'destination', getSheets: () => [template('2031.10', false), local] };
    assert.equal(gas.findPlanningTemplateSheet_(destination, { year: 2031, month: 11 }).sheet, local);
    destination.getSheets = () => [template('2031.10', false)];
    assert.equal(gas.findPlanningTemplateSheet_(destination, { year: 2031, month: 11 }).sheet, source);
});

test('invalid dates cannot create work outside February or the target month', () => {
    const gas = loadGasFunctions(), period = { year: 2031, month: 2 };
    assert.deepEqual(JSON.parse(JSON.stringify(gas.normalizePlanningSuggestions_([
        { date: '2031-02-28', column: 'K', text: 'valid' },
        { date: '2031-02-29', column: 'K', text: 'invalid' },
        { date: '2031-03-01', column: 'K', text: 'other month' }
    ], period))), { K32: ['valid'] });
    assert.deepEqual(Object.keys(gas.normalizePlanningCalendarRows_([{ date: '2031-02-30', size: 'D10' }], period)), []);
});

test('carry forward does not fill nonexistent days of a shorter month', () => {
    const gas = loadGasFunctions();
    const sheet = { getRange: () => ({ getValues: () => Array.from({ length: 31 }, (_, i) => [i >= 27 ? 'work' : '']) }) };
    const result = gas.readPlanningCarryForward_(sheet, { year: 2031, month: 1 }, { year: 2031, month: 2 });
    assert.equal(result.E32, 'work');
    assert.equal(result.E33, undefined);
    assert.equal(result.M35, undefined);
});

test('calendar edits stop re-export before overwriting user changes', () => {
    const gas = loadGasFunctions();
    let changed = false, note = '';
    const sheet = { getRange: range => ({ getNote: () => note, getValues: () => [[changed && range === 'G5:G35' ? 'Ⅲ' : 'original']] }) };
    note = 'ROLL_PLANNING_DRAFT|' + JSON.stringify({ calendarSnapshot: gas.planningCalendarSnapshot_(sheet) });
    assert.doesNotThrow(() => gas.assertPlanningCalendarUnchanged_(sheet));
    changed = true;
    assert.throws(() => gas.assertPlanningCalendarUnchanged_(sheet), /手修正/);
    note = 'ROLL_PLANNING_DRAFT|{}';
    assert.throws(() => gas.assertPlanningCalendarUnchanged_(sheet), /旧方式/);
});

function calendarGeometry(extraMerge) {
    const calls = [], merges = new Map();
    const pairs = row => ['E' + row + ':F' + row, 'H' + row + ':I' + row, 'K' + row + ':L' + row];
    const sheet = {
        getRange: a1 => ({
            getMergedRanges: () => {
                const row = Number(a1.match(/\d+/)[0]);
                const found = a1.startsWith('B')
                    ? (row <= 34 ? pairs(row) : extraMerge ? [extraMerge] : [])
                    : (merges.has(a1) ? [a1] : []);
                return found.map(value => ({ getA1Notation: () => value }));
            },
            copyFormatToRange: (destination, ...args) => { assert.equal(destination, sheet); calls.push(['format', a1, ...args]); },
            merge: () => { merges.set(a1, true); calls.push(['merge', a1]); },
            setBorder: (...args) => calls.push(['border', a1, ...args])
        }),
        getRowHeight: () => 36,
        setRowHeight: (...args) => calls.push(['height', ...args])
    };
    return { sheet, calls };
}

test('a 31-day draft gains the missing last day formatting and paired work cells', () => {
    const gas = loadGasFunctions(), h = calendarGeometry();
    assert.equal(gas.extendPlanningCalendarRows_(h.sheet, { year: 2031, month: 9 }, { year: 2031, month: 10 }), 1);
    assert.deepEqual(h.calls, [
        ['format', 'B34:M34', 2, 13, 35, 35],
        ['merge', 'E35:F35'], ['merge', 'H35:I35'], ['merge', 'K35:L35'], ['height', 35, 36],
        ['border', 'B35:M35', null, null, true, null, null, null]
    ]);
});

test('a shorter or equal month does not rewrite existing calendar formatting', () => {
    const gas = loadGasFunctions(), h = calendarGeometry();
    assert.equal(gas.extendPlanningCalendarRows_(h.sheet, { year: 2031, month: 10 }, { year: 2031, month: 11 }), 0);
    assert.equal(gas.extendPlanningCalendarRows_(h.sheet, { year: 2031, month: 10 }, { year: 2031, month: 12 }), 0);
    assert.equal(h.calls.length, 0);
});

test('unexpected note-area merges stop calendar expansion before any format write', () => {
    const gas = loadGasFunctions(), h = calendarGeometry('E35:M35');
    assert.throws(() => gas.extendPlanningCalendarRows_(h.sheet, { year: 2031, month: 9 }, { year: 2031, month: 10 }), /別用途の結合/);
    assert.equal(h.calls.length, 0);
});

test('February expansion preflights without edits then formats three missing days', () => {
    const gas = loadGasFunctions(), h = calendarGeometry();
    const from = { year: 2031, month: 2 }, to = { year: 2031, month: 3 };
    assert.equal(gas.extendPlanningCalendarRows_(h.sheet, from, to, { dryRun: true }), 3);
    assert.equal(h.calls.length, 0);
    assert.equal(gas.extendPlanningCalendarRows_(h.sheet, from, to), 3);
    assert.deepEqual(h.calls.filter(call => call[0] === 'format').map(call => call.slice(1)), [
        ['B32:M32', 2, 13, 33, 33], ['B32:M32', 2, 13, 34, 34], ['B32:M32', 2, 13, 35, 35]
    ]);
});
