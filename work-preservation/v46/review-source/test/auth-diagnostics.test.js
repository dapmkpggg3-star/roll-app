const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness(options = {}) {
    const nodes = { 'login-status': {}, 'auth-diagnostics': {} }, timers = new Map(), calls = [];
    let timerId = 0;
    const authSdk = { getAuth: () => ({ currentUser: { getIdToken: () => options.token || Promise.resolve('secret-token') } }),
        setPersistence: async () => {}, inMemoryPersistence: {}, GoogleAuthProvider: function () {},
        signInWithPopup: () => { calls.push('popup'); return options.popup || Promise.resolve(); },
        signOut: async () => { calls.push('signout'); } };
    const storage = new Map();
    const c = vm.createContext({ URL, Proxy, Set, module: { exports: {} },
        fixtureApp: { initializeApp: () => ({}) }, fixtureAuth: authSdk,
        ROLL_APP_CONFIG: { authenticationDiagnostics: options.enabled !== false, apiEndpoint: 'https://example.test/api',
            firebase: { apiKey: 'fixture', projectId: 'test', authDomain: 'test.example' } },
        document: { getElementById: id => nodes[id] },
        localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
        setTimeout: f => { timers.set(++timerId,f); return timerId; }, clearTimeout: id => timers.delete(id),
        fetch: async () => { calls.push('gas'); return new Response(JSON.stringify(options.result || { success: true, user: { id: 'private-user' } })); }
    });
    const source = fs.readFileSync(path.join(__dirname,'../js/identity.js'),'utf8')
        .replace("import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js')",'Promise.resolve(fixtureApp)')
        .replace("import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js')",'Promise.resolve(fixtureAuth)');
    vm.runInContext(source,c);
    return { c, nodes, timers, calls, storage };
}
async function settle() { for (let i=0;i<12;i++) await Promise.resolve(); }
test('diagnostics follow full login and contain no identity or token', async () => {
    const h=harness(); await h.c.RollAuth.signIn();
    assert.deepEqual(h.calls,['popup','gas']);
    assert.equal(h.c.RollAuth.currentUser().id,'private-user');
    const text=h.nodes['auth-diagnostics'].textContent;
    assert.match(text,/設定確認.*Firebase SDK読込.*Google認証復帰.*GAS応答待ち.*利用者確認完了.*端末内データ所有者確認.*ログイン完了/);
    assert.doesNotMatch(text,/secret-token|private-user|https:/);
    assert.equal(h.timers.size,0);
});
test('pending popup is observational only, does not call GAS or unlock login', async () => {
    const d=deferred(),h=harness({popup:d.promise}); const pending=h.c.RollAuth.signIn(); await settle();
    assert.match(h.nodes['login-status'].textContent,/Google認証の応答待ち/);
    for (const fn of [...h.timers.values()]) fn();
    assert.match(h.nodes['login-status'].textContent,/20秒以上.*追加クリックは不要/);
    assert.deepEqual(h.calls,['popup']); assert.equal(h.c.RollAuth.currentUser(),null);
    await assert.rejects(h.c.RollAuth.signIn(),/確認中/);
    d.resolve(); await pending; assert.equal(h.c.RollAuth.currentUser().id,'private-user');
});
test('token wait is distinguishable from GAS response wait and sends nothing early', async () => {
    const d=deferred(),h=harness({token:d.promise}); const pending=h.c.RollAuth.signIn(); await settle();
    assert.match(h.nodes['login-status'].textContent,/認証証明の取得/); assert.deepEqual(h.calls,['popup']);
    d.resolve('secret-token'); await pending; assert.deepEqual(h.calls,['popup','gas']);
});
test('denied identity never logs in and diagnostic excludes raw error payload', async () => {
    const h=harness({result:{success:false,error:'private@example.test secret-token',code:'secret-code'}});
    await assert.rejects(h.c.RollAuth.signIn());
    assert.equal(h.c.RollAuth.currentUser(),null); assert.equal(h.storage.size,0);
    assert.match(h.nodes['auth-diagnostics'].textContent,/UNCLASSIFIED_ERROR.*認証の後片付け.*ログイン失敗/);
    assert.doesNotMatch(h.nodes['auth-diagnostics'].textContent,/private@|secret/); assert.equal(h.timers.size,0);
});
test('diagnostics remain disabled unless explicitly configured', async () => {
    const h=harness({enabled:false}); await h.c.RollAuth.signIn();
    assert.equal(h.nodes['auth-diagnostics'].hidden,true);
    assert.equal(h.nodes['auth-diagnostics'].textContent,''); assert.equal(h.timers.size,0);
});
