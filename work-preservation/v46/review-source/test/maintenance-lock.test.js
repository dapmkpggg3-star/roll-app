const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture() {
    const state = { held: false, acquires: 0, releases: 0, flushes: 0 };
    const gas = vm.createContext({
        LockService: { getScriptLock: () => ({ waitLock() { assert.equal(state.held, false, 'no nested lock acquisition'); state.held = true; state.acquires++; },
            hasLock: () => state.held, releaseLock() { state.held = false; state.releases++; } }) },
        SpreadsheetApp: { flush() { assert.equal(state.held, true); state.flushes++; } }
    });
    vm.runInContext(fs.readFileSync(require.resolve('../google-apps-script.gs'), 'utf8'), gas);
    gas.assertWorkshopMaintenanceAllowed_ = () => { assert.equal(state.held, true); };
    return { gas, state };
}

test('actual sort preserves all row columns and runs the entire read/write under one lock', () => {
    const { gas, state } = fixture();
    let rows = [[9, '#16-903', 'オンライン', 'extra-1'], [7, '#14-902', '組替', 'extra-2'], [8, '#14-901', '改削', 'extra-3']];
    const sheet = { getLastRow: () => 4, getLastColumn: () => 20, getRange() {
        assert.equal(state.held, true);
        return { getValues: () => rows.map(row => [...row]), setValues(values) { assert.equal(state.held, true); rows = values; } };
    } };
    gas.getSheet = () => sheet;
    gas.applySheetFormatting = (_, count) => { assert.equal(state.held, true); assert.equal(count, 3); };
    assert.equal(gas.sortRolesSheet(), 3);
    assert.deepEqual(Array.from(rows, row => row[0]), [8, 7, 9]);
    assert.deepEqual(Array.from(rows, row => row[3]), ['extra-3', 'extra-2', 'extra-1']);
    assert.equal(state.acquires, 1); assert.equal(state.releases, 1); assert.equal(state.flushes, 1);
});

test('maintenance write and guard errors release the lock and do not report success', () => {
    for (const stage of ['guard', 'write']) {
        const { gas, state } = fixture(); let writes = 0;
        gas.assertWorkshopMaintenanceAllowed_ = () => { if (stage === 'guard') throw new Error('pending'); };
        gas.updateRolesHeaderLocked_ = () => { writes++; throw new Error('write failed'); };
        assert.throws(() => gas.updateRolesHeader(), stage === 'guard' ? /pending/ : /write failed/);
        assert.equal(writes, stage === 'guard' ? 0 : 1); assert.equal(state.held, false); assert.equal(state.flushes, 0);
    }
});

test('history import and status initialization share the original maintenance lock', () => {
    const { gas, state } = fixture(); let copies = 0, configured = 0;
    const sheet = { getMaxRows: () => 100, getMaxColumns: () => 36,
        copyTo() { assert.equal(state.held, true); copies++; return { setName() {} }; } };
    gas.previewRollHistoryMigration = () => { assert.equal(state.held, true); return { missingSheets: [], sourceSpreadsheetId: 'fixture' }; };
    gas.SpreadsheetApp.openById = () => ({ getSheetByName: () => sheet, getName: () => 'source' });
    gas.openRollManagementSpreadsheet_ = () => ({ getSheetByName: () => null, getName: () => 'destination' });
    gas.initializeRollHistoryStatusSyncLocked_ = () => { assert.equal(state.held, true); configured++; return { success: true }; };
    const result = gas.importRollHistorySheetsFromSource();
    assert.equal(result.success, true); assert.equal(copies, 8); assert.equal(configured, 1);
    assert.equal(state.acquires, 1); assert.equal(state.releases, 1);
});
