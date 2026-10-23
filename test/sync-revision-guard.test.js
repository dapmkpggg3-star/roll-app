const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');

const sample = () => [{ id: 1, name: '#99-1', status: '改削中', updatedAt: '2031-01-01T00:00:00Z', memo: '', history: [] }];
function harness() {
    let current = sample();
    const writes = [], cache = new Map();
    let held = false, releases = 0;
    const context = vm.createContext({
        console, Logger: { log() {} },
        Utilities: {
            DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
            computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()],
            base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url')
        },
        LockService: { getScriptLock: () => ({ waitLock() { assert.equal(held, false); held = true; }, hasLock: () => held, releaseLock() { held = false; releases++; } }) },
        CacheService: { getScriptCache: () => ({ put: (key, value) => cache.set(key, value), get: key => cache.get(key) || null }) },
        ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ value, setMimeType() { return JSON.parse(value); } }) }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8'), context);
    context.fetchRoles = () => current;
    context.writeRoles = roles => { assert.equal(held, true); writes.push(roles); current = roles; return roles.length; };
    context.storeLastSaveDebugState = () => {};
    return { context, writes, setCurrent: value => { current = value; }, getCurrent: () => current, releases: () => releases };
}

test('revision changes for direct sheet edits even before timestamp trigger executes', () => {
    const { context: gas } = harness();
    const before = sample();
    const after = sample(); after[0].memo = 'sheet edit';
    assert.notEqual(gas.rolesRevision_(before), gas.rolesRevision_(after));
    assert.equal(gas.rolesRevision_(before), gas.rolesRevision_(JSON.parse(JSON.stringify(before))));
});

test('a sheet update between GET and POST is preserved and zero writes occur', () => {
    const h = harness(), gas = h.context;
    const revision = gas.rolesRevision_(h.getCurrent());
    const sheetEdit = sample(); sheetEdit[0].useStartDate = '2031-01-05'; h.setCurrent(sheetEdit);
    assert.throws(() => gas.saveRolesWithRevision_(sample(), revision), /取得後にスプレッドシートが更新/);
    assert.equal(h.writes.length, 0);
    assert.equal(h.getCurrent()[0].useStartDate, '2031-01-05');
    assert.equal(h.releases(), 1);
});

test('two app saves sharing one revision cannot overwrite each other', () => {
    const h = harness(), gas = h.context;
    const revision = gas.rolesRevision_(h.getCurrent());
    const first = sample(); first[0].memo = 'first edit';
    assert.equal(gas.saveRolesWithRevision_(first, revision), 1);
    const second = sample(); second[0].memo = 'second edit';
    assert.throws(() => gas.saveRolesWithRevision_(second, revision), /上書きせず停止/);
    assert.equal(h.writes.length, 1);
    assert.equal(h.getCurrent()[0].memo, 'first edit');
});

test('missing revision, empty list, duplicate IDs or names never write', () => {
    const h = harness(), gas = h.context, row = sample()[0];
    for (const rows of [[], [null], [row, { ...row, name: '#99-2' }], [row, { ...row, id: 2 }]]) {
        assert.throws(() => gas.saveRolesWithRevision_(rows, 'revision'));
    }
    assert.throws(() => gas.saveRolesWithRevision_(sample(), ''), /再読み込み/);
    assert.equal(h.writes.length, 0);
});

test('no-cors POST stores a correlated conflict result for the caller', () => {
    const h = harness(), gas = h.context;
    const requestId = 'roles-test-00000001';
    const response = gas.doPost({ postData: { contents: JSON.stringify({ action: 'save', roles: sample(), expectedRevision: 'stale', requestId }) } });
    assert.equal(response.success, false);
    const status = gas.doGet({ parameter: { action: 'fetchSaveStatus', requestId } });
    assert.equal(status.status.requestId, requestId);
    assert.equal(status.status.state, 'error');
    assert.match(status.status.error, /上書きせず停止/);
    assert.equal(h.writes.length, 0);
});

test('successful POST status belongs to that request; another request stays pending', () => {
    const h = harness(), gas = h.context;
    const requestId = 'roles-test-00000002';
    const response = gas.doPost({ postData: { contents: JSON.stringify({ action: 'save', roles: sample(), expectedRevision: gas.rolesRevision_(h.getCurrent()), requestId }) } });
    assert.equal(response.success, true);
    assert.equal(gas.doGet({ parameter: { action: 'fetchSaveStatus', requestId } }).status.state, 'complete');
    assert.equal(gas.doGet({ parameter: { action: 'fetchSaveStatus', requestId: 'roles-other-00000001' } }).pending, true);
});

test('legacy GET saves also require a matching revision', () => {
    const h = harness();
    const response = h.context.doGet({ parameter: { action: 'save', roles: encodeURIComponent(JSON.stringify(sample())) } });
    assert.equal(response.success, false);
    assert.equal(h.writes.length, 0);
});

test('write failure releases the shared lock', () => {
    const h = harness();
    h.context.writeRoles = () => { throw new Error('write failed'); };
    assert.throws(() => h.context.saveRolesWithRevision_(sample(), h.context.rolesRevision_(sample())), /write failed/);
    assert.equal(h.releases(), 1);
});

function client() {
    const context = vm.createContext({ console, window: {}, document: { addEventListener() {} }, localStorage: { getItem() { return null; } } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8'), context);
    return context;
}

test('client never treats a different request, conflict, or pending response as saved', () => {
    const c = client(), requestId = 'roles-client-00000001';
    assert.equal(c.validateRolesSaveStatus({ success: true, pending: true }, requestId), null);
    assert.throws(() => c.validateRolesSaveStatus({ success: true, status: { requestId: 'other', state: 'complete' } }, requestId), /一致しません/);
    assert.throws(() => c.validateRolesSaveStatus({ success: true, status: { requestId, state: 'error', error: '競合' } }, requestId), /競合/);
    assert.equal(c.validateRolesSaveStatus({ success: true, status: { requestId, state: 'complete' } }, requestId).state, 'complete');
});

test('Roles writes preserve unrelated columns and clear only surplus managed rows', () => {
    const h = harness(), gas = h.context, calls = [];
    // Reload the real writeRoles after the race-test stub.
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8').match(/function writeRoles\(roles\) \{[\s\S]*?\n\}\n\nfunction buildRoleRowForSheet/)[0].replace(/\nfunction buildRoleRowForSheet$/, ''), gas);
    gas.getSheet = () => ({
        getLastRow: () => 5,
        getRange: (...args) => ({ setValues: values => calls.push({ kind: 'set', args, values }), clearContent: () => calls.push({ kind: 'clear', args }) }),
        clearContents: () => { throw new Error('whole-sheet clear is forbidden'); }
    });
    gas.ensureRolesColumnCapacity = () => {};
    gas.applyStatusDropdowns = () => {};
    gas.applySheetFormatting = () => {};
    gas.SpreadsheetApp = { flush() {} };
    gas.refreshRollManagementView = () => ({});
    gas.refreshFieldRollManagementView = () => ({});
    assert.equal(gas.writeRoles(sample()), 1);
    assert.deepEqual(calls.map(({ kind, args }) => ({ kind, args })), [
        { kind: 'set', args: [1, 1, 2, 16] },
        { kind: 'clear', args: [3, 1, 3, 16] }
    ]);
    calls.length = 0;
    const bad = sample(); const circular = {}; circular.self = circular; bad[0].history = [circular];
    assert.throws(() => gas.writeRoles(bad), /circular/i);
    assert.equal(calls.length, 0);
});
