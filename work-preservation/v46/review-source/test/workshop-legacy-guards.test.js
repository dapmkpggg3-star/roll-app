const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('both existing Roles writers call pending guard before any cell write', () => {
    const calls = [], gas = vm.createContext({});
    vm.runInContext(fs.readFileSync(require.resolve('../google-apps-script.gs'), 'utf8'), gas);
    gas.getSheet = () => ({});
    gas.fetchRoles = () => [{ id: 'A' }];
    gas.assertWorkshopRolesWriteAllowed_ = (...args) => { calls.push(args); throw new Error('pending guard'); };
    const after = [{ id: 'A', status: 'new' }];
    assert.throws(() => gas.writeRoles(after, 'internal-operation'), /pending guard/);
    assert.equal(calls[0][2], 'internal-operation');
    assert.throws(() => gas.updateChangedRolesRows(after, ['#14-901']), /pending guard/);
    assert.equal(calls[1][3][0], '#14-901');
});

test('manual bulk history import holds the same lock across read and write and releases on error', () => {
    let held = false;
    const gas = vm.createContext({ LockService: { getScriptLock: () => ({
        waitLock() { assert.equal(held, false); held = true; }, hasLock: () => held,
        releaseLock() { held = false; }
    }) } });
    vm.runInContext(fs.readFileSync(require.resolve('../google-apps-script.gs'), 'utf8'), gas);
    gas.syncRollHistoryActualsToRolesAllLocked_ = names => {
        assert.equal(held, true); assert.deepEqual(names, ['14,15']); throw new Error('import conflict');
    };
    assert.throws(() => gas.syncRollHistoryActualsToRolesAll(['14,15']), /import conflict/);
    assert.equal(held, false);
});
