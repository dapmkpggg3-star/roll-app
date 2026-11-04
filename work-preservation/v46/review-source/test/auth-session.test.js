const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRollApiClient, createSessionFence } = require('../js/identity.js');

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
const changed = error => error.code === 'AUTH_SESSION_CHANGED';
const endpoint = 'https://example.test/api';
function client(fence, overrides = {}) {
    return createRollApiClient({ endpoint, captureSession: fence.capture,
        getToken: async () => 'fixture', fetchImpl: async () => new Response('{"success":true}'), ...overrides });
}

test('renewing even the same account invalidates the previous session', () => {
    const fence = createSessionFence();
    const old = fence.capture();
    fence.invalidate();
    assert.equal(old.isCurrent(), false);
    assert.throws(old.assertCurrent, changed);
    assert.equal(fence.capture().isCurrent(), true);
});

test('logout while obtaining a token prevents the write from being sent', async () => {
    const fence = createSessionFence(), token = deferred();
    let sends = 0;
    const request = client(fence, { getToken: () => token.promise, fetchImpl: async () => { sends++; } });
    const pending = request(endpoint, { body: '{"action":"save"}' });
    fence.invalidate();
    token.resolve('old-session-token');
    await assert.rejects(pending, changed);
    assert.equal(sends, 0);
});

test('an already sent write is not reported successful after logout', async () => {
    const fence = createSessionFence(), received = deferred(), started = deferred();
    const request = client(fence, { fetchImpl: () => { started.resolve(); return received.promise; } });
    const pending = request(endpoint, { body: '{"action":"save"}' });
    await started.promise;
    fence.invalidate();
    received.resolve(new Response('{"success":true}'));
    await assert.rejects(pending, changed);
});

test('logout while checking the response body rejects the result', async () => {
    const fence = createSessionFence(), body = deferred(), started = deferred();
    const request = client(fence, { fetchImpl: async () => ({ ok: true, type: 'basic',
        clone: () => ({ json: () => { started.resolve(); return body.promise; } }) }) });
    const pending = request(endpoint);
    await started.promise;
    fence.invalidate(); body.resolve({ success: true });
    await assert.rejects(pending, changed);
});

test('delayed JSON/text reads and response clones cannot cross a login boundary', async () => {
    for (const method of ['json', 'text']) {
        const fence = createSessionFence();
        const response = await client(fence)(endpoint);
        const copy = response.clone();
        fence.invalidate();
        await assert.rejects(response[method](), changed);
        await assert.rejects(copy[method](), changed);
        assert.throws(() => response.clone(), changed);
    }
});

test('an unchanged session preserves normal Response behaviour', async () => {
    const response = await client(createSessionFence())(endpoint);
    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.clone().json(), { success: true });
    assert.equal(await response.text(), '{"success":true}');
    assert.equal(response.bodyUsed, true);
});

function syncHarness() {
    const fence = createSessionFence(), storage = new Map(), calls = { rendered: 0, messages: [] };
    const c = vm.createContext({ console: { log() {}, warn() {}, error() {} }, URL, AbortController,
        setTimeout, clearTimeout,
        ROLL_APP_CONFIG: { apiEndpoint: endpoint },
        RollAuth: { captureSession: fence.capture, currentUser: () => ({ id: 'fixture' }) },
        roles: [{ id: '1', name: '#99-1', memo: 'unsent local edit' }],
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        document: { addEventListener() {}, getElementById() { return null; } }, window: {},
        navigator: { onLine: true }, alert() {}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/sync.js'), 'utf8'), c);
    c.normalizeRole = row => ({ currentDiameter: '', ...row });
    c.setSyncMessage = message => calls.messages.push(message);
    c.renderRoles = () => { calls.rendered++; };
    c.saveLocalRoles = () => { throw Error('stale read must not save'); };
    return { c, fence, calls, storage };
}

test('a late remote read cannot replace local edits or mark a new session verified', async () => {
    const { c, fence, calls } = syncHarness();
    const received = deferred();
    c.rollApiFetch = () => received.promise;
    const pending = c.fetchData();
    fence.invalidate(); c.setSyncContentPhase('unknown');
    received.resolve(new Response('{"success":true,"roles":[{"id":"1","name":"#99-1","memo":"remote"}]}'));
    await pending;
    assert.equal(c.roles[0].memo, 'unsent local edit');
    assert.equal(c.getSyncContentState().phase, 'unknown');
    assert.equal(calls.rendered, 0);
    assert.deepEqual(calls.messages, []);
});

test('a late network failure cannot overwrite the renewed session status', async () => {
    const { c, fence, calls } = syncHarness();
    const received = deferred();
    c.rollApiFetch = async () => { await received.promise; throw Error('old network failure'); };
    const pending = c.fetchData();
    fence.invalidate(); c.markSyncContentVerified(c.roles);
    received.resolve(); await pending;
    assert.equal(c.getSyncContentState().verified, true);
    assert.deepEqual(calls.messages, []);
});

test('save-status polling stops before contacting the server after a login change', async () => {
    const { c, fence } = syncHarness();
    const timer = deferred();
    c.setTimeout = callback => { timer.promise.then(callback); };
    let requests = 0;
    c.rollApiFetch = () => { requests++; throw Error('must not poll'); };
    const pending = c.waitForRolesSaveStatus('fixture-save');
    fence.invalidate(); timer.resolve();
    await assert.rejects(pending, changed);
    assert.equal(requests, 0);
});

test('a stale queued sync is discarded and only a fresh login read is allowed', async () => {
    const { c, fence } = syncHarness();
    const received = deferred(), started = deferred();
    c.localStorage.setItem('roles', JSON.stringify(c.roles));
    c.findRollDebugIndex = () => -1;
    c.getRollDebugSlice = () => [];
    c.fetchRemoteRolesForGuard = () => { started.resolve(); return received.promise; };
    let writes = 0, reads = 0;
    c.saveData = () => { writes++; };
    c.loadRemoteRoles = () => { reads++; };
    const pending = c.syncRoles();
    await started.promise;
    await c.syncRoles(); // Queued under the old login.
    fence.invalidate();
    received.resolve([]);
    await pending;
    assert.equal(writes, 0);
    assert.equal(reads, 1);
    assert.equal(c.roles[0].memo, 'unsent local edit');
    assert.equal(vm.runInContext('isSyncQueued', c), false);
});

test('logout hides the app before provider completion and retains pending local edits', async () => {
    const provider = deferred(), events = [];
    const source = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
    const start = source.indexOf('async function performLogout()');
    const end = source.indexOf("document.addEventListener('DOMContentLoaded'", start);
    let authorized = true;
    const storage = new Map([['roles', 'pending local edits'], ['isLoggedIn', 'true']]);
    const c = vm.createContext({
        console: { warn() {} }, confirm: () => true,
        getSyncContentState: () => ({ pendingCount: 1 }),
        RollAuth: { signOut() {
            authorized = false;
            return provider.promise.then(() => { throw Error('provider unavailable'); });
        } },
        document: { querySelectorAll: () => [] },
        localStorage: { removeItem: key => storage.delete(key) },
        setSyncContentPhase: phase => events.push(phase),
        checkLoginStatus() { events.push(authorized ? 'visible' : 'hidden'); }
    });
    vm.runInContext(source.slice(start, end), c);
    const pending = c.performLogout();
    assert.deepEqual(events, ['unknown', 'hidden']);
    assert.equal(storage.get('roles'), 'pending local edits');
    provider.resolve();
    await pending;
    assert.equal(authorized, false);
    assert.equal(storage.get('roles'), 'pending local edits');
});

test('app logout confirmation supports cancel, repeated opening and explicit approval without window.confirm', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
    let mounted = false, signedOut = 0, shown = 0;
    const message = {}, handlers = {};
    const dialog = { open: false, returnValue: '', setAttribute() {},
        querySelector: () => message,
        addEventListener: (name, fn) => { handlers[name] = fn; },
        showModal() { this.open = true; shown++; } };
    const c = vm.createContext({
        document: { getElementById: () => mounted ? dialog : null,
            createElement: () => dialog, body: { appendChild() { mounted = true; } } },
        getSyncContentState: () => ({ pendingCount: 1 }),
        performLogout: () => { signedOut++; },
        confirm: () => { throw Error('browser confirm must not be called'); }
    });
    vm.runInContext(source.slice(source.indexOf('function logout()'), source.indexOf('async function performLogout()')), c);
    c.logout(); c.logout();
    assert.equal(shown, 1);
    assert.match(message.textContent, /未反映の変更/);
    assert.equal(signedOut, 0);
    dialog.open = false; dialog.returnValue = 'cancel'; handlers.close();
    assert.equal(signedOut, 0);
    c.logout(); dialog.open = false; dialog.returnValue = 'logout'; handlers.close();
    assert.equal(signedOut, 1);
    c.logout(); assert.equal(dialog.returnValue, '');
    dialog.open = false; handlers.close();
    assert.equal(signedOut, 1);
});
