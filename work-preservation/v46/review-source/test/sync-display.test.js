const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function harness() {
    const storage = new Map();
    const c = vm.createContext({ console, roles: [{ id: '1', name: '#99-1', useStartDate: '2031-01-01' }],
        localStorage: { getItem: key => storage.get(key) || null, setItem: (k, v) => storage.set(k, v) },
        document: { addEventListener() {}, getElementById: () => null }, window: {} });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8'), c);
    c.normalizeRole = row => ({ currentDiameter: '', ...row });
    const status = () => c.getSyncDiagnosticStatus({ local: 1, remote: 1, merged: 1, hasRemote: true, lastSuccessful: 1 });
    return { c, status };
}
test('equal counts alone never produce a normal badge', () => {
    assert.equal(harness().status().level, 'warning');
});
test('same-count date, status and history edits invalidate a verified result', () => {
    for (const change of [{ useStartDate: '2031-01-02' }, { status: '改削中' }, { history: [{ type: 'correction' }] }]) {
        const { c, status } = harness(); c.markSyncContentVerified(c.roles);
        assert.equal(status().level, 'normal'); Object.assign(c.roles[0], change);
        assert.equal(c.getSyncContentState().pendingCount, 1); assert.equal(status().level, 'warning');
    }
});
test('partial failure and checking stay non-normal even when content matches', () => {
    const { c, status } = harness(); c.markSyncContentVerified(c.roles);
    c.setSyncContentPhase('error', '一部未反映'); assert.equal(status().level, 'danger');
    c.setSyncContentPhase('checking'); assert.equal(status().level, 'warning');
});
test('an edit made during save confirmation is not marked reflected', () => {
    const { c, status } = harness(); const sent = JSON.parse(JSON.stringify(c.roles));
    c.roles[0].memo = 'next edit'; c.markSyncContentVerified(sent);
    assert.equal(c.getSyncContentState().pendingCount, 1); assert.equal(status().level, 'warning');
});
test('a pending delete remains unreflected until its confirmation', () => {
    const { c, status } = harness(); c.markSyncContentVerified(c.roles);
    c.getDeletedRoleIds = () => ['1'];
    assert.equal(c.getSyncContentState().pendingCount, 1); assert.equal(status().level, 'warning');
});
