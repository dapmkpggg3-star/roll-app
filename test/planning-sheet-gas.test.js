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
