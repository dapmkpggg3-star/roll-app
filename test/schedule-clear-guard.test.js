const test = require('node:test');
const assert = require('node:assert/strict');
const importer = require('../js/planning-import');

const DRAFT_CLEAR_RANGES = ['B5:M35', 'B38:M68'];

function expandRange(range) {
    const match = String(range).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    const cells = [];
    for (let code = match[1].charCodeAt(0); code <= match[3].charCodeAt(0); code += 1) {
        const column = String.fromCharCode(code);
        for (let row = Number(match[2]); row <= Number(match[4]); row += 1) cells.push(column + row);
    }
    return cells;
}

function anonymousSheet() {
    return {
        E5: 'A班',
        H5: 'B班',
        K5: 'カリバ替',
        E38: 'A班',
        H40: 'B班',
        K42: 'ロール替',
        D5: '1'
    };
}

test('clearing the draft ranges erases team columns and the work column', () => {
    const layout = importer.confirmedMaintenanceLayout(2026, 10);
    assert.deepEqual(layout.team, ['E', 'H']);
    assert.deepEqual(layout.workText, ['K']);
    const covered = new Set(DRAFT_CLEAR_RANGES.flatMap(expandRange));
    ['E5', 'H5', 'K5', 'E38', 'H40', 'K42'].forEach(cell => {
        assert.equal(covered.has(cell), true, cell);
    });
    assert.equal(covered.has('D5'), true);

    const sheet = anonymousSheet();
    covered.forEach(cell => { delete sheet[cell]; });
    assert.equal(sheet.E5, undefined);
    assert.equal(sheet.H5, undefined);
    assert.equal(sheet.K5, undefined);
    assert.equal(sheet.E38, undefined);
    assert.equal(sheet.K42, undefined);
});

test('the write-back gate does not clear team or work cells', () => {
    const sheet = anonymousSheet();
    const clears = [];
    const gate = importer.planningWriteBackGate();
    function attemptDraftClear() {
        if (!gate.allowed) return;
        DRAFT_CLEAR_RANGES.forEach(range => {
            clears.push(range);
            expandRange(range).forEach(cell => { delete sheet[cell]; });
        });
    }
    attemptDraftClear();
    assert.equal(gate.allowed, false);
    assert.match(gate.reason, /E・H班欄/);
    assert.match(gate.reason, /K作業欄/);
    assert.deepEqual(clears, []);
    assert.equal(sheet.E5, 'A班');
    assert.equal(sheet.H5, 'B班');
    assert.equal(sheet.K5, 'カリバ替');
    assert.equal(sheet.K42, 'ロール替');
    assert.equal(sheet.D5, '1');
});


test('real draft builder on a copied mock sheet exposes the destructive range and carry-forward behavior', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../google-apps-script.gs'), 'utf8'), context);
    const original = anonymousSheet();
    original.K38 = '持越し';
    const draft = { ...original };
    const ranges = [];
    const copy = {
        setName() {},
        getRange(ref) {
            return {
                getNote: () => '',
                setValue: value => { draft[ref] = value; },
                clearContent() {
                    ranges.push(ref);
                    for (const cell of expandRange(ref)) delete draft[cell];
                }
            };
        }
    };
    const template = {
        getName: () => '匿名ひな形',
        copyTo: () => copy,
        getRange: ref => ({ getValues: () => expandRange(ref).map(cell => [original[cell] ?? '']) })
    };
    context.findPlanningTemplateSheet_ = () => ({ sheet: template, period: { year: 2031, month: 10 } });
    context.createPlanningDraftSheet_({}, { year: 2031, month: 11 });
    assert.deepEqual(ranges, DRAFT_CLEAR_RANGES);
    assert.equal(original.K5, 'カリバ替');
    assert.equal(draft.K5, '持越し');
    assert.equal(draft.H5, undefined);
    assert.equal(draft.D5, undefined);
    // This characterizes the blocked server path. Revisit this test when the mapping is approved.
    assert.equal(importer.planningWriteBackGate().allowed, false);
});


function existingDraftFixture() {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const path = require('node:path');
    const gas = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../google-apps-script.gs'), 'utf8'), gas);
    const cells = new Map();
    const writes = [];
    function cell(a1) {
        if (!cells.has(a1)) cells.set(a1, { value: '', formula: '', note: '' });
        return cells.get(a1);
    }
    function range(ref) {
        const keys = ref.includes(':') ? expandRange(ref) : [ref];
        const rows = new Map();
        for (const key of keys) {
            const row = Number(key.slice(1));
            if (!rows.has(row)) rows.set(row, []);
            rows.get(row).push(key);
        }
        const grid = [...rows.values()];
        const read = field => grid.map(row => row.map(key => cell(key)[field]));
        function set(key, value) {
            cell(key).value = value;
            cell(key).formula = '';
            writes.push(key);
        }
        return {
            getValues: () => read('value'),
            getFormulas: () => read('formula'),
            getNote: () => cell(ref).note,
            setNote(value) { cell(ref).note = value; writes.push(ref); return this; },
            setValue(value) { set(ref, value); return this; },
            setValues(values) {
                grid.forEach((row, i) => row.forEach((key, j) => set(key, values[i][j])));
                return this;
            },
            setFontColor() { return this; },
            setBackground() { return this; },
            setFontWeight() { return this; }
        };
    }
    const sheet = { getRange: range, getSheetId: () => 1 };
    const plan = {
        year: 2032, month: 1,
        calendarRows: [{ date: '2032-01-01', weekday: '木', size: 'D13', operationAShift: 'Ⅰ', operationBShift: 'Ⅲ' }],
        suggestions: []
    };
    gas.openRollManagementSpreadsheet_ = () => ({ getSheetByName: () => sheet, getUrl: () => 'mock' });
    gas.SpreadsheetApp = { flush() {} };
    gas.writePlanningCalendar_(sheet, plan.calendarRows, plan);
    cell('A1').note = 'ROLL_PLANNING_DRAFT|' + JSON.stringify({ calendarSnapshot: gas.planningCalendarSnapshot_(sheet) });
    writes.length = 0;
    return { cell, writes, reExport: () => gas.writePlanningDraftUnlocked_(plan, 'planning-anonymous') };
}

test('re-export of an existing draft preserves team entries and manual work across two refreshes', () => {
    const { cell, reExport } = existingDraftFixture();
    const inputs = { E5: 'A班', H5: 'B班', K5: 'カリバ替', K38: '翌月の手入力' };
    for (const [key, value] of Object.entries(inputs)) cell(key).value = value;
    cell('K5').note = '引継ぎメモ';
    for (let i = 0; i < 2; i++) {
        assert.equal(reExport().created, false);
        for (const [key, value] of Object.entries(inputs)) assert.equal(cell(key).value, value, key);
        assert.equal(cell('K5').note, '引継ぎメモ');
    }
});

test('re-export after a manual size change stops before the first write', () => {
    const { cell, writes, reExport } = existingDraftFixture();
    cell('D5').value = 'D10';
    assert.throws(reExport, /手修正/);
    assert.deepEqual(writes, []);
    assert.equal(cell('D5').value, 'D10');
});

test('re-export should preserve a manually entered formula with the same displayed result', {
    todo: 'The blocked draft writer snapshots values only. Keep write-back disabled pending a server fix.'
}, () => {
    const { cell, reExport } = existingDraftFixture();
    cell('D5').formula = '="D13"';
    try { reExport(); } catch (error) { assert.match(error.message, /手修正/); }
    assert.equal(cell('D5').formula, '="D13"');
});
