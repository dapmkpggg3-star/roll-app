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
