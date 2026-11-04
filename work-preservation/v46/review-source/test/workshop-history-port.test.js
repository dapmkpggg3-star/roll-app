const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const clone = value => JSON.parse(JSON.stringify(value));

function fixture() {
    const gas = vm.createContext({});
    for (const file of ['google-apps-script.gs', 'gas/workshop-history-port.gs']) {
        vm.runInContext(fs.readFileSync(require.resolve('../' + file), 'utf8'), gas);
    }
    const state = { held: true, sheetId: 123, flushes: 0, cells: new Map(), missing: false };
    // Same layout contract as the inspected copy: stand header followed by
    // upper/lower roll markers, status formula one row above the header.
    // Invented roll numbers and inventory throughout.
    const rows = Array.from({ length: 40 }, () => Array(36).fill(''));
    const changes = [
        { roleId: 'A', before: { id: 'A', name: '#14-901', status: '中古予備（バラシ前）' },
            after: { id: 'A', name: '#14-901', status: '改削行き（搬出可能）' } },
        { roleId: 'C', before: { id: 'C', name: '#14-903', status: '新品予備（組替可能）' },
            after: { id: 'C', name: '#14-903', status: '新品予備（組込完了）' } }
    ];
    changes.forEach((change, i) => {
        const row = 2 + i * 16;
        rows[row][0] = '#14st'; rows[row + 2][0] = change.before.name.replace('#14-', '14-上-');
        rows[row + 3][0] = change.before.name.replace('#14-', '14-下-');
        state.cells.set(`${row},1`, { formula: gas.buildRollHistoryStatusFormula(change.before.name),
            note: 'ROLL_STATUS_SYNC|' + change.before.name,
            display: gas.buildRollHistoryStatusDisplay(change.before.name, change.before.status) });
    });
    const sheet = { getSheetId: () => state.sheetId, getLastRow: () => rows.length, getLastColumn: () => 36,
        getRange(row, column, height) {
            if (height) return { getDisplayValues: () => clone(rows) };
            const cell = state.cells.get(`${row},${column}`);
            assert.ok(cell, 'resolved an existing status cell');
            // No setValues/setFormula/format methods: any write fails this test.
            return { getFormula: () => cell.formula, getNote: () => cell.note, getDisplayValue: () => cell.display };
        } };
    const port = gas.createWorkshopHistoryPort_({ getSheetByName: name => !state.missing && name === '14,15' ? sheet : null },
        { hasLock: () => state.held }, () => { state.flushes++; state.onFlush?.(); });
    const reflect = () => changes.forEach((change, i) => {
        state.cells.get(`${2 + i * 16},1`).display = gas.buildRollHistoryStatusDisplay(change.after.name, change.after.status);
    });
    return { state, rows, gas, port, changes, reflect };
}

test('resolves existing block positions and verifies formula-driven reflection without writing cells', () => {
    const h = fixture(), projection = h.port.prepare(h.changes);
    assert.equal(projection.before.length, 2);
    assert.deepEqual(JSON.parse(projection.before[0].bindingId), ['history-status-v1', 123, 2, 1, '#14-901']);
    h.reflect();
    h.port.compareAndSet(projection.before, projection.after);
    assert.deepEqual(clone(h.port.read(projection.after)), clone(projection.after));
});

for (const field of ['formula', 'note', 'display']) {
    test('rejects ' + field + ' mismatch before any roll save', () => {
        const h = fixture(); h.state.cells.get('2,1')[field] = '手修正';
        assert.throws(() => h.port.prepare(h.changes), /ロール更新前に停止/);
        assert.equal(h.state.cells.get('2,1')[field], '手修正');
    });
}

test('missing or duplicate blocks and missing sheets cannot produce a projection', () => {
    const missing = fixture(); missing.rows[4][0] = ''; missing.rows[5][0] = '';
    assert.throws(() => missing.port.prepare(missing.changes), /不足・重複/);
    const duplicate = fixture(); duplicate.rows[34][0] = '#14st'; duplicate.rows[36][0] = '14-上-901';
    assert.throws(() => duplicate.port.prepare(duplicate.changes), /不足・重複/);
    const sheet = fixture(); sheet.state.missing = true;
    assert.throws(() => sheet.port.prepare(sheet.changes), /履歴表がありません/);
});

test('a later sheet replacement or moved block is not treated as the original binding', () => {
    const h = fixture(), projection = h.port.prepare(h.changes);
    h.state.sheetId++;
    assert.throws(() => h.port.read(projection.after), /位置が変更/);
});

test('stale calculations stay pending; retry succeeds when Sheets reflects Roles', () => {
    const h = fixture(), projection = h.port.prepare(h.changes);
    assert.throws(() => h.port.compareAndSet(projection.before, projection.after), /未反映のまま/);
    h.reflect();
    assert.doesNotThrow(() => h.port.compareAndSet(projection.before, projection.after));
});

test('a formula overwritten after prepare is preserved and cannot count as reflected', () => {
    const h = fixture(), projection = h.port.prepare(h.changes);
    h.reflect(); h.state.cells.get('2,1').formula = '';
    assert.throws(() => h.port.compareAndSet(projection.before, projection.after), /上書きせず停止/);
    assert.equal(h.state.cells.get('2,1').formula, '');
});

test('every read and verification requires the shared lock', () => {
    const h = fixture(), projection = h.port.prepare(h.changes); h.state.held = false;
    assert.throws(() => h.port.prepare(h.changes), /ロック/);
    assert.throws(() => h.port.read(projection.after), /ロック/);
    assert.throws(() => h.port.compareAndSet(projection.before, projection.after), /ロック/);
});

test('recipient and donor cannot bind to the same history block', () => {
    const h = fixture();
    assert.throws(() => h.port.prepare([h.changes[0], h.changes[0]]), /重複/);
});

test('a new duplicate after prepare invalidates readback even when the original cell is unchanged', () => {
    const h = fixture(), projection = h.port.prepare(h.changes);
    h.rows[34][0] = '#14st'; h.rows[36][0] = '14-上-901';
    assert.throws(() => h.port.read(projection.after), /不足・重複/);
});
