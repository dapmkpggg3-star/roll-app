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
    return remoteWithRevision(context.roles, 'rev-2');
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
