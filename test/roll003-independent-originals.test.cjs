const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const storage = new Map();
  const context = vm.createContext({
    console,
    document: { addEventListener() {}, getElementById() { return null; } },
    navigator: { onLine: true },
    alert() {},
    ALLOWED_STATUSES: ['オンライン', '中古予備（バラシ前）', '新品予備保管', '発注済み（納入待ち）', '廃却待ち（ラック保管）', '廃棄'],
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(String(key), String(value)),
      removeItem: key => storage.delete(key)
    }
  });
  context.ROLL_APP_CONFIG = { apiEndpoint: 'https://fixture.invalid/gas' };
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/sync.js'), 'utf8'), context);
  context.saveLocalRoles = () => {};
  context.renderRoles = () => {};
  return { context, storage };
}

function remoteWithRevision(roles, revision) {
  const copy = roles.map(role => ({ ...role }));
  Object.defineProperty(copy, 'syncRevision', { value: revision });
  return copy;
}

test('failed remote save keeps independent local and remote originals', async () => {
  const { context, storage } = harness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-only', updatedAt: '2026-11-12T00:00:00.000Z', history: [] }];
  const remote = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-only', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  const previous = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'previous-success', updatedAt: '2026-10-01T00:00:00.000Z', history: [] }];
  storage.set('roles', JSON.stringify(local));
  storage.set('roles_backup_before_sync', JSON.stringify(previous));
  context.fetchRemoteRolesForGuard = async () => remoteWithRevision(remote, 'rev-1');
  context.saveData = async () => false;

  const result = await context.syncRoles();
  assert.notEqual(result, true);
  const originals = context.readIndependentSyncOriginals();
  assert.equal(originals.localOriginal[0].memo, 'local-only');
  assert.equal(originals.remoteOriginal[0].memo, 'remote-only');
  assert.equal(JSON.parse(storage.get('roles_backup_before_sync'))[0].memo, 'previous-success');
  assert.notEqual(originals.localOriginal[0].memo, originals.remoteOriginal[0].memo);
});

test('successful verification readback does not replace originals with the merged payload', async () => {
  const { context, storage } = harness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-newer', updatedAt: '2026-11-12T00:00:00.000Z', history: [] }];
  const remote = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-older', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  storage.set('roles', JSON.stringify(local));
  storage.set('roles_backup_before_sync', JSON.stringify(remote));
  let fetches = 0;
  context.fetchRemoteRolesForGuard = async () => {
    fetches += 1;
    if (fetches === 1) return remoteWithRevision(remote, 'rev-1');
    // Simulate the remote readback of the submitted payload, not local UI state.
    return remoteWithRevision(local, 'rev-2');
  };
  context.saveData = async () => true;

  assert.equal(await context.syncRoles(), true);
  const originals = context.readIndependentSyncOriginals();
  assert.equal(originals.localOriginal[0].memo, 'local-newer');
  assert.equal(originals.remoteOriginal[0].memo, 'remote-older');
  const confirmed = JSON.parse(storage.get('roles_backup_before_sync'));
  assert.equal(confirmed[0].memo, 'local-newer');
  assert.equal(originals.remoteOriginal[0].memo, 'remote-older');
});

test('repeated capture overwrites the prior originals: not a durable restore point', () => {
  const { context, storage } = harness();
  const local1 = [{ id: '1', name: '#99-1', memo: 'local-before-first-sync' }];
  const remote1 = [{ id: '1', name: '#99-1', memo: 'remote-before-first-sync' }];
  const local2 = [{ id: '1', name: '#99-1', memo: 'local-before-second-sync' }];
  const remote2 = [{ id: '1', name: '#99-1', memo: 'remote-before-second-sync' }];
  context.storeIndependentSyncOriginals(local1, remote1);
  assert.equal(context.readIndependentSyncOriginals().remoteOriginal[0].memo, 'remote-before-first-sync');
  context.storeIndependentSyncOriginals(local2, remote2);
  assert.equal(context.readIndependentSyncOriginals().localOriginal[0].memo, 'local-before-second-sync');
  assert.equal(context.readIndependentSyncOriginals().remoteOriginal[0].memo, 'remote-before-second-sync');
  assert.equal([...storage.keys()].filter(key => key.startsWith('roles_original_remote_before_sync') && !key.endsWith('_saved_at')).length, 1);
});

test('browser storage loss leaves no independently recoverable original', () => {
  const { context, storage } = harness();
  context.storeIndependentSyncOriginals([{ id: '1', memo: 'local' }], [{ id: '1', memo: 'remote' }]);
  assert.equal(context.readIndependentSyncOriginals().remoteOriginal.length, 1);
  storage.clear();
  assert.equal(context.readIndependentSyncOriginals().localOriginal.length, 0);
  assert.equal(context.readIndependentSyncOriginals().remoteOriginal.length, 0);
});

test('remote save rejection preserves the local working copy before confirmation', async () => {
  const { context, storage } = harness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-old', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  const remote = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-new', updatedAt: '2026-11-12T00:00:00.000Z', history: [] }];
  storage.set('roles', JSON.stringify(local));
  context.saveLocalRoles = () => storage.set('roles', JSON.stringify(context.roles));
  context.fetchRemoteRolesForGuard = async () => remoteWithRevision(remote, 'rev-1');
  context.saveData = async () => false;
  const result = await context.syncRoles();
  assert.notEqual(result, true);
  assert.equal(context.readIndependentSyncOriginals().localOriginal[0].memo, 'local-old');
  assert.equal(context.readIndependentSyncOriginals().remoteOriginal[0].memo, 'remote-new');
  assert.equal(JSON.parse(storage.get('roles'))[0].memo, 'local-old',
    'rejected remote save must not replace the local working copy');
});

test('concurrent local edit during remote save is never overwritten on verified readback', async () => {
  const { context, storage } = harness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-before', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  const remote = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-before', updatedAt: '2026-10-01T00:00:00.000Z', history: [] }];
  const operatorEdit = [{ ...local[0], memo: 'operator-edited-during-request' }];
  storage.set('roles', JSON.stringify(local));
  let writes = 0;
  context.saveLocalRoles = () => { writes++; storage.set('roles', JSON.stringify(context.roles)); };
  let submitted;
  let fetchCount = 0;
  context.fetchRemoteRolesForGuard = async () => {
    fetchCount++;
    return fetchCount === 1 ? remoteWithRevision(remote, 'rev-1') : remoteWithRevision(submitted, 'rev-2');
  };
  context.saveData = async submittedRoles => {
    submitted = submittedRoles;
    storage.set('roles', JSON.stringify(operatorEdit));
    return true;
  };
  const result = await context.syncRoles();
  assert.notEqual(result, true);
  assert.equal(writes, 0, 'verified remote must not force a local commit over an operator edit');
  assert.equal(JSON.parse(storage.get('roles'))[0].memo, 'operator-edited-during-request');
  assert.equal(context.readIndependentSyncOriginals().localOriginal[0].memo, 'local-before');
  assert.equal(context.readIndependentSyncOriginals().remoteOriginal[0].memo, 'remote-before');
});

test('queued sync is suppressed when remote saved but concurrent local edit blocks commit', async () => {
  const { context, storage } = harness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-before', updatedAt: '2026-11-12T00:00:00.000Z', history: [] }];
  const remote = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-before', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  storage.set('roles', JSON.stringify(local));
  let calls = 0;
  let submitted;
  context.fetchRemoteRolesForGuard = async () => ++calls === 1 ? remoteWithRevision(remote, 'rev-1') : remoteWithRevision(submitted, 'rev-2');
  let posts = 0;
  context.saveData = async rolesToSend => {
    posts++;
    submitted = rolesToSend;
    storage.set('roles', JSON.stringify([{ ...local[0], memo: 'operator-edit' }]));
    await context.syncRoles(); // second click while first POST is in flight
    return true;
  };
  const result = await context.syncRoles();
  assert.notEqual(result, true);
  assert.equal(posts, 1, 'must not auto-post again after remote/local divergence');
  assert.equal(calls, 2, 'must not automatically fetch for a second sync');
  assert.equal(JSON.parse(storage.get('roles'))[0].memo, 'operator-edit');
});

test('corrupt stored roles or deletion JSON stops before remote read and POST', async () => {
  for (const [key, value] of [['roles', '{bad'], ['roles', '{}'], ['deletedRoleIds', '{bad'], ['deletedRoleIds', '{}']]) {
    const { context, storage } = harness();
    storage.set('roles', JSON.stringify([{ id: '1', name: '#99-1', status: 'オンライン', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }]));
    storage.set(key, value);
    let reads = 0;
    let posts = 0;
    context.fetchRemoteRolesForGuard = async () => { reads++; throw Error('must not fetch'); };
    context.saveData = async () => { posts++; throw Error('must not post'); };
    const result = await context.syncRoles();
    assert.notEqual(result, true, key + ': corrupt input must stop sync');
    assert.equal(reads, 0, key + ': remote read must not begin');
    assert.equal(posts, 0, key + ': remote write must not begin');
    assert.equal(storage.get(key), value, key + ': preserve original bytes for investigation');
  }
});

test('a corrupt generation log is left untouched while the current pair is stored', () => {
  const { context, storage } = harness();
  storage.set('roles_sync_original_generations_v1', '{not-json');
  context.storeIndependentSyncOriginals([{ id: '1', memo: 'current-local' }], [{ id: '1', memo: 'current-remote' }]);
  assert.equal(storage.get('roles_sync_original_generations_v1'), '{not-json');
  assert.equal(context.readIndependentSyncOriginals().localOriginal[0].memo, 'current-local');
  assert.equal(context.readIndependentSyncOriginals().remoteOriginal[0].memo, 'current-remote');
});

test('original generations keep only the newest five pairs', () => {
  const { context, storage } = harness();
  for (let index = 1; index <= 6; index += 1) {
    context.storeIndependentSyncOriginals([{ id: '1', memo: `local-${index}` }], [{ id: '1', memo: `remote-${index}` }]);
  }
  const generations = JSON.parse(storage.get('roles_sync_original_generations_v1'));
  assert.equal(generations.length, 5);
  assert.equal(generations[0].localOriginal[0].memo, 'local-6');
  assert.equal(generations[4].localOriginal[0].memo, 'local-2');
});

test('a second capture keeps the previous original generation', () => {
  const { context, storage } = harness();
  context.storeIndependentSyncOriginals([{ id: '1', memo: 'generation-1' }], [{ id: '1', memo: 'remote-1' }]);
  context.storeIndependentSyncOriginals([{ id: '1', memo: 'generation-2' }], [{ id: '1', memo: 'remote-2' }]);
  const generations = JSON.parse(storage.get('roles_sync_original_generations_v1'));
  assert.equal(generations.length, 2);
  assert.equal(generations[0].localOriginal[0].memo, 'generation-2');
  assert.equal(generations[1].remoteOriginal[0].memo, 'remote-1');
  assert.equal(context.readIndependentSyncOriginals().localOriginal[0].memo, 'generation-2');
});

test('a thrown remote save does not replace the local working copy', async () => {
  const { context, storage } = harness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-kept', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  storage.set('roles', JSON.stringify(local));
  let writes = 0;
  context.saveLocalRoles = () => { writes += 1; storage.set('roles', JSON.stringify(context.roles)); };
  context.fetchRemoteRolesForGuard = async () => remoteWithRevision(local, 'rev-1');
  context.saveData = async () => { throw new Error('一部未反映'); };
  const result = await context.syncRoles();
  assert.notEqual(result, true);
  assert.equal(writes, 0);
  assert.equal(JSON.parse(storage.get('roles'))[0].memo, 'local-kept');
});

test('paired originals survive a failure while writing legacy keys', () => {
  const { context, storage } = harness();
  const local = [{ id: '1', memo: 'operator-before-sync' }];
  const remote = [{ id: '1', memo: 'sheet-before-sync' }];
  const originalSetItem = context.localStorage.setItem;
  context.localStorage.setItem = (key, value) => {
    if (key === 'roles_original_remote_before_sync') throw Error('simulated quota failure');
    return originalSetItem(key, value);
  };
  assert.throws(() => context.storeIndependentSyncOriginals(local, remote), /simulated quota failure/);
  const pair = context.readIndependentSyncOriginals();
  assert.equal(pair.localOriginal[0].memo, 'operator-before-sync');
  assert.equal(pair.remoteOriginal[0].memo, 'sheet-before-sync');
  assert.ok(storage.has('roles_sync_original_pair_v1'));
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); }
  };
}

function liveHarness() {
  const base = harness();
  base.context.AbortController = class {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  };
  base.context.setTimeout = (fn, delay) => {
    if (delay >= 30000) return 0;
    Promise.resolve().then(fn);
    return 1;
  };
  base.context.clearTimeout = () => {};
  base.context.roles = [];
  return base;
}

async function runUnverifiedStop(statusFor) {
  const { context, storage } = liveHarness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-kept', updatedAt: '2026-11-12T00:00:00.000Z', history: [] }];
  const remote = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-kept', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  storage.set('roles', JSON.stringify(local));
  storage.set('roles_backup_before_sync', JSON.stringify([{ id: '1', memo: 'previous-success' }]));
  let writes = 0;
  const calls = [];
  context.saveLocalRoles = () => { writes += 1; storage.set('roles', JSON.stringify(context.roles)); };
  context.rollApiFetch = async (url, options = {}) => {
    const href = String(url);
    assert.equal(new URL(href).hostname, 'fixture.invalid');
    const action = new URL(href).searchParams.get('action');
    calls.push({ method: options.method || 'GET', href, action, body: options.body || '' });
    if (options.method === 'POST') return jsonResponse({ success: true, accepted: true });
    if (action === 'fetch') return jsonResponse({ success: true, revision: 'rev-remote', roles: remote });
    if (action === 'fetchSaveStatus') {
      return jsonResponse(statusFor(new URL(href).searchParams.get('requestId'), calls));
    }
    throw new Error('unexpected request ' + href);
  };
  const result = await context.syncRoles();
  const originals = context.readIndependentSyncOriginals();
  const posts = calls.filter(call => call.method === 'POST');
  return { result, writes, storage, context, originals, posts, calls };
}

function assertOriginalsKept(outcome) {
  assert.notEqual(outcome.result, true);
  assert.equal(outcome.writes, 0);
  assert.equal(JSON.parse(outcome.storage.get('roles'))[0].memo, 'local-kept');
  assert.equal(outcome.originals.localOriginal[0].memo, 'local-kept');
  assert.equal(outcome.originals.remoteOriginal[0].memo, 'remote-kept');
  assert.equal(JSON.parse(outcome.storage.get('roles_backup_before_sync'))[0].memo, 'previous-success');
  assert.equal(outcome.storage.get('lastSyncAt') || null, null);
  assert.notEqual(outcome.context.getSyncContentState().phase, 'verified');
  assert.equal(outcome.posts.length, 1);
  assert.match(outcome.posts[0].body, /"expectedRevision":"rev-remote"/);
}

test('a remote revision conflict stops before the local copy is replaced', async () => {
  const outcome = await runUnverifiedStop(requestId => ({
    success: true,
    status: { requestId, state: 'error', error: '取得後にスプレッドシートが更新されたため上書きせず停止しました。' }
  }));
  assertOriginalsKept(outcome);
  assert.match(outcome.context.getSyncContentState().error, /上書きせず停止/);
  assert.equal(outcome.calls.filter(call => call.action === 'fetchSaveStatus').length, 1);
});

test('partial reflection is not a completed save and keeps both originals', async () => {
  const outcome = await runUnverifiedStop(requestId => ({
    success: true,
    status: {
      requestId,
      state: 'partial',
      rolesSaved: true,
      error: '管理データは保存済みですが履歴表が未反映です。'
    }
  }));
  assertOriginalsKept(outcome);
  assert.match(outcome.context.getSyncContentState().error, /一部未反映/);
  assert.equal(outcome.calls.filter(call => call.action === 'fetch').length, 1);
});

test('an unfinished save status stays unknown and does not commit either original', async () => {
  const pending = await runUnverifiedStop(() => ({ success: true, pending: true }));
  assertOriginalsKept(pending);
  assert.match(pending.context.getSyncContentState().error, /時間内に終わりませんでした/);
  assert.equal(pending.calls.filter(call => call.action === 'fetchSaveStatus').length, 12);

  const unknown = await runUnverifiedStop(requestId => ({
    success: true,
    status: { requestId, state: 'accepted' }
  }));
  assertOriginalsKept(unknown);
  assert.match(unknown.context.getSyncContentState().error, /保存結果が未確定です/);

  const dropped = await runUnverifiedStop(() => { throw new Error('status unread'); });
  assertOriginalsKept(dropped);
  assert.match(dropped.context.getSyncContentState().error, /status unread/);
});

test('a failed send leaves no confirmed result and keeps the independent originals', async () => {
  const { context, storage } = liveHarness();
  const local = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-kept', updatedAt: '2026-11-12T00:00:00.000Z', history: [] }];
  const remote = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-kept', updatedAt: '2026-11-01T00:00:00.000Z', history: [] }];
  storage.set('roles', JSON.stringify(local));
  let posts = 0;
  let statusReads = 0;
  context.saveLocalRoles = () => { throw new Error('local commit is forbidden'); };
  context.rollApiFetch = async (url, options = {}) => {
    assert.equal(new URL(String(url)).hostname, 'fixture.invalid');
    if (options.method === 'POST') {
      posts += 1;
      throw new Error('network down');
    }
    const action = new URL(String(url)).searchParams.get('action');
    if (action === 'fetch') return jsonResponse({ success: true, revision: 'rev-remote', roles: remote });
    statusReads += 1;
    throw new Error('must not read a save status');
  };
  const result = await context.syncRoles();
  assert.notEqual(result, true);
  assert.equal(posts, 1);
  assert.equal(statusReads, 0);
  assert.equal(JSON.parse(storage.get('roles'))[0].memo, 'local-kept');
  const originals = context.readIndependentSyncOriginals();
  assert.equal(originals.localOriginal[0].memo, 'local-kept');
  assert.equal(originals.remoteOriginal[0].memo, 'remote-kept');
  assert.match(context.getSyncContentState().error, /network down/);
  assert.notEqual(context.getSyncContentState().phase, 'verified');
});
