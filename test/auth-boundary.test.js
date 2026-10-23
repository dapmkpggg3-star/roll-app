const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRollApiClient } = require('../js/identity.js');

function gasHarness() {
    const now = Math.floor(Date.now() / 1000);
    const props = { ROLL_AUTH_PROJECT_ID: 'test-project', ROLL_AUTH_WEB_API_KEY: 'fixture', ROLL_AUTH_USERS: '{"fixture-user":"editor"}' };
    const claims = { aud: 'test-project', iss: 'https://securetoken.google.com/test-project', sub: 'fixture-user',
        exp: now + 3600, iat: now, auth_time: now, email: 'user@example.test', firebase: { sign_in_provider: 'google.com' } };
    let account = { localId: 'fixture-user', email: 'user@example.test', emailVerified: true, validSince: String(now - 10) };
    let code = 200, lookups = 0, writes = 0;
    const c = vm.createContext({ console, Logger: { log() {} },
        PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] }) },
        Utilities: { base64DecodeWebSafe: s => Buffer.from(s, 'base64url'), newBlob: b => ({ getDataAsString: () => b.toString() }) },
        UrlFetchApp: { fetch: (url, options) => {
            assert.equal(new URL(url).hostname, 'identitytoolkit.googleapis.com');
            assert.ok(JSON.parse(options.payload).idToken); lookups++;
            return { getResponseCode: () => code, getContentText: () => JSON.stringify({ users: [account] }) };
        } },
        ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) },
        CacheService: { getScriptCache: () => ({ get: () => JSON.stringify({ actorId: 'google:someone-else' }) }) }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8'), c);
    c.handleWriteRequest_ = () => { writes++; return { success: true }; };
    const token = () => 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
    const post = action => c.doPost({ postData: { contents: JSON.stringify({ action, authToken: token(), requestId: 'roles-test-00000001' }) } });
    return { c, claims, props, token, post, setAccount: value => { account = { ...account, ...value }; },
        setCode: value => { code = value; }, lookups: () => lookups, writes: () => writes };
}

test('anonymous GET and POST never reach business reads or writes', () => {
    const h = gasHarness();
    h.c.handleReadRequest_ = () => { throw Error('must not read'); };
    assert.equal(h.c.doGet({ parameter: { action: 'fetch' } }).success, false);
    assert.equal(h.c.doPost({ postData: { contents: '{"action":"save"}' } }).success, false);
    assert.equal(h.writes(), 0);
});
test('unconfigured authentication denies access before provider or business calls', () => {
    const h = gasHarness(); delete h.props.ROLL_AUTH_USERS;
    assert.equal(h.post('save').success, false); assert.equal(h.lookups(), 0); assert.equal(h.writes(), 0);
});
test('a decoded token never authorizes when the provider rejects its signature', () => {
    const h = gasHarness(); h.setCode(400);
    assert.equal(h.post('save').success, false); assert.equal(h.writes(), 0);
});
test('wrong audience, issuer, expired token and wrong identity provider are rejected', () => {
    for (const change of [{ aud: 'other' }, { iss: 'https://bad.example' }, { exp: 1 }, { firebase: { sign_in_provider: 'password' } }]) {
        const h = gasHarness(); Object.assign(h.claims, change);
        assert.equal(h.post('save').success, false); assert.equal(h.lookups(), 0); assert.equal(h.writes(), 0);
    }
});
test('disabled, revoked, unverified and mismatched accounts cannot write', () => {
    for (const change of [{ disabled: true }, { validSince: String(Math.floor(Date.now() / 1000) + 1) }, { emailVerified: false }, { localId: 'different-user' }]) {
        const h = gasHarness(); h.setAccount(change);
        assert.equal(h.post('save').success, false); assert.equal(h.writes(), 0);
    }
});
test('allowlist and server-side role enforce access independently of UI flags', () => {
    const h = gasHarness(); h.props.ROLL_AUTH_USERS = '{}'; assert.equal(h.post('save').success, false);
    h.props.ROLL_AUTH_USERS = '{"fixture-user":"reader"}';
    assert.equal(h.post('whoami').user.role, 'reader'); assert.equal(h.post('save').success, false);
    h.props.ROLL_AUTH_USERS = '{"fixture-user":"editor"}';
    assert.equal(h.post('save').success, true); assert.equal(h.writes(), 1);
    assert.equal(h.post('debug-sort-roles').success, false);
});
test('one user cannot poll another users save result', () => {
    assert.equal(gasHarness().post('fetchSaveStatus').success, false);
});
test('authenticated transport uses POST body and never puts a token in the URL', async () => {
    const calls = [];
    const client = createRollApiClient({ endpoint: 'https://example.test/api', getToken: async () => 'fixture-token',
        fetchImpl: async (...args) => { calls.push(args); return new Response('{"success":true}'); } });
    await client('https://example.test/api?action=fetch&t=1', { mode: 'no-cors' });
    assert.equal(calls[0][0], 'https://example.test/api');
    assert.equal(calls[0][1].mode, 'cors');
    assert.deepEqual(JSON.parse(calls[0][1].body), { action: 'fetch', authToken: 'fixture-token' });
    await assert.rejects(client('https://other.test/api?action=fetch'), /接続先/);
    assert.equal(calls.length, 1);
});
test('authentication failures and opaque responses never count as successful saves', async () => {
    const failure = createRollApiClient({ endpoint: 'https://example.test/api', getToken: async () => 'fixture',
        fetchImpl: async () => new Response('{"success":false,"code":"REQUEST_DENIED","error":"denied"}') });
    await assert.rejects(failure('https://example.test/api'), /denied/);
    const opaque = createRollApiClient({ endpoint: 'https://example.test/api', getToken: async () => 'fixture', fetchImpl: async () => ({ ok: true, type: 'opaque' }) });
    await assert.rejects(opaque('https://example.test/api'), /接続結果/);
});
