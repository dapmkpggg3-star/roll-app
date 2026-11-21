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
