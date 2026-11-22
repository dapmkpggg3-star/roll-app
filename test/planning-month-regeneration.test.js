const test = require('node:test');
const assert = require('node:assert/strict');
function expandRange(range) {
    const match = String(range).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    const cells = [];
    for (let code = match[1].charCodeAt(0); code <= match[3].charCodeAt(0); code += 1) {
        const column = String.fromCharCode(code);
        for (let row = Number(match[2]); row <= Number(match[4]); row += 1) cells.push(column + row);
    }
    return cells;
}

function mockPlanningMonth(period = { year: 2032, month: 1 }) {
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
            clearContent() { keys.forEach(key => set(key, '')); return this; },
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
    const sheet = { getRange: range, getSheetId: () => 1, setName(name) { this.name = name; } };
    const plan = {
        ...period,
        calendarRows: [{ date: `${period.year}-${String(period.month).padStart(2, '0')}-01`, weekday: '日月火水木金土'[new Date(Date.UTC(period.year, period.month - 1, 1)).getUTCDay()], size: 'D13', operationAShift: 'Ⅰ', operationBShift: 'Ⅲ' }],
        suggestions: []
    };
    gas.openRollManagementSpreadsheet_ = () => ({ getSheetByName: () => sheet, getUrl: () => 'mock' });
    gas.SpreadsheetApp = { flush() {} };
    gas.writePlanningCalendar_(sheet, plan.calendarRows, plan);
    cell('A1').note = 'ROLL_PLANNING_DRAFT|' + JSON.stringify({ calendarSnapshot: gas.planningCalendarSnapshot_(sheet) });
    writes.length = 0;
    return { gas, sheet, cells, plan, cell, writes, reExport: () => gas.writePlanningDraftUnlocked_(plan, 'planning-anonymous') };
}

test('create February from January carry-forward, change work, and regenerate twice', () => {
    const january = mockPlanningMonth();
    const february = mockPlanningMonth({ year: 2032, month: 2 });
    const { gas, sheet, cell, writes, reExport } = february;
    const source = { E38: 'A班', H38: 'B班', K38: 'カリバ替', K39: 'ロール替', K66: '月末の作業', K67: '対象月外' };
    for (const [key, value] of Object.entries(source)) january.cell(key).value = value;
    let copies = 0;
    january.sheet.getName = () => '匿名1月';
    january.sheet.copyTo = () => {
        copies++;
        february.cells.clear();
        for (const [key, item] of january.cells) Object.assign(cell(key), item);
        return sheet;
    };
    gas.findPlanningTemplateSheet_ = () => ({ sheet: january.sheet, period: { year: 2032, month: 1 } });
    gas.openRollManagementSpreadsheet_ = () => ({
        getSheetByName: name => sheet.name === name ? sheet : null,
        getUrl: () => 'mock'
    });
    assert.equal(reExport().created, true);
    assert.equal(cell('K5').value, 'カリバ替');
    assert.equal(cell('K6').value, 'ロール替');
    assert.equal(cell('K33').value, '月末の作業');
    assert.equal(cell('K34').value, '');
    cell('K5').value = '日程変更・点検';
    cell('K5').note = '現場確認済み';
    cell('K6').value = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        assert.equal(reExport().created, false);
        assert.equal(cell('K5').value, '日程変更・点検');
        assert.equal(cell('K5').note, '現場確認済み');
        assert.equal(cell('K6').value, '');
        assert.equal(cell('E5').value, 'A班');
        assert.equal(cell('H5').value, 'B班');
        assert.equal(cell('K33').value, '月末の作業');
    }
    assert.equal(copies, 1);
    cell('D5').value = 'D10';
    writes.length = 0;
    assert.throws(reExport, /手修正/);
    assert.deepEqual(writes, []);
    for (const [key, value] of Object.entries(source)) assert.equal(january.cell(key).value, value);
});
