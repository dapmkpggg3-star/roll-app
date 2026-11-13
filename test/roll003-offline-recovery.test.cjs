const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const storage = new Map();
  const downloads = [];
  const context = vm.createContext({
    console,
    document: {
      createElement() {
        return { click() {}, href: '', download: '' };
      },
      body: { appendChild() {}, removeChild() {} }
    },
    URL: {
      createObjectURL() { return 'blob:anonymous'; },
      revokeObjectURL() {}
    },
    Blob,
    alert() {},
    confirm() { return false; },
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(String(key), String(value)),
      removeItem: key => storage.delete(key)
    }
  });
  context.window = context;
  context.downloadRecoveryJson = value => downloads.push(value);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/offline-recovery.js'), 'utf8'), context);
  return { context, storage, downloads };
}

const local = [{ id: 'anon-1', name: '#99-ANON', status: 'オンライン', memo: 'local-anon', updatedAt: '2026-11-13T00:00:00.000Z' }];
const remote = [{ id: 'anon-1', name: '#99-ANON', status: 'オンライン', memo: 'remote-anon', updatedAt: '2026-11-01T00:00:00.000Z' }];

test('recovery package round-trips anonymous roles and rejects a changed byte', () => {
  const { context } = harness();
  const pkg = context.buildOfflineRecoveryPackage({
    roles: local,
    localOriginal: local,
    remoteOriginal: remote,
    savedAt: '2026-11-13T00:00:00.000Z'
  });
  assert.equal(context.verifyOfflineRecoveryPackage(pkg).ok, true);
  const tampered = { ...pkg, roles: [{ ...local[0], memo: 'changed' }] };
  assert.equal(context.verifyOfflineRecoveryPackage(tampered).ok, false);
});

test('preview and unconfirmed apply do not change stored roles', () => {
  const { context, storage } = harness();
  storage.set('roles', JSON.stringify([{ id: 'keep', memo: 'current' }]));
  const pkg = context.buildOfflineRecoveryPackage({ roles: local, localOriginal: local, remoteOriginal: remote, savedAt: '2026-11-13T00:00:00.000Z' });
  assert.equal(context.verifyOfflineRecoveryPackage(pkg).roleCount, 1);
  const refused = context.applyOfflineRecoveryPackage(storage, pkg, { confirmed: false, rollbackAcknowledged: false });
  assert.equal(refused.applied, false);
  assert.equal(JSON.parse(storage.get('roles'))[0].memo, 'current');
  assert.equal(storage.has('roles_offline_recovery_rollback_v1'), false);
});

test('browser storage loss can be restored from the file and then rolled back', () => {
  const { context, storage } = harness();
  storage.set('roles', JSON.stringify([{ id: 'keep', memo: 'before-wipe' }]));
  const pkg = context.buildOfflineRecoveryPackage({ roles: local, localOriginal: local, remoteOriginal: remote, savedAt: '2026-11-13T00:00:00.000Z' });
  const file = JSON.parse(JSON.stringify(pkg));
  storage.clear();
  assert.equal(storage.get('roles'), undefined);
  const applied = context.applyOfflineRecoveryPackage(context.localStorage, file, { confirmed: true, rollbackAcknowledged: true });
  assert.equal(applied.applied, true);
  assert.equal(JSON.parse(storage.get('roles'))[0].memo, 'local-anon');
  assert.equal(JSON.parse(storage.get('roles_sync_original_pair_v1')).remoteOriginal[0].memo, 'remote-anon');
  const undone = context.rollbackOfflineRecovery(context.localStorage, { confirmed: true });
  assert.equal(undone.applied, true);
  assert.equal(JSON.parse(storage.get('roles')).length, 0);
  assert.equal(context.rollbackOfflineRecovery(context.localStorage, { confirmed: false }).applied, false);
});

test('corrupt current storage blocks apply instead of discarding it', () => {
  const { context, storage } = harness();
  storage.set('roles', '{not-json');
  const pkg = context.buildOfflineRecoveryPackage({ roles: local, localOriginal: [], remoteOriginal: [], savedAt: '2026-11-13T00:00:00.000Z' });
  const result = context.applyOfflineRecoveryPackage(context.localStorage, pkg, { confirmed: true, rollbackAcknowledged: true });
  assert.equal(result.applied, false);
  assert.equal(storage.get('roles'), '{not-json');
});

test('two original generations survive browser storage loss through the recovery file', () => {
  const { context, storage } = harness();
  const generations = [
    { savedAt: '2026-11-13T02:00:00.000Z', localOriginal: [{ id: 'anon-1', memo: 'newer' }], remoteOriginal: [{ id: 'anon-1', memo: 'remote-newer' }] },
    { savedAt: '2026-11-13T01:00:00.000Z', localOriginal: [{ id: 'anon-1', memo: 'older' }], remoteOriginal: [{ id: 'anon-1', memo: 'remote-older' }] }
  ];
  const pkg = context.buildOfflineRecoveryPackage({ roles: local, localOriginal: generations[0].localOriginal, remoteOriginal: generations[0].remoteOriginal, generations, savedAt: '2026-11-13T02:00:00.000Z' });
  storage.clear();
  const applied = context.applyOfflineRecoveryPackage(context.localStorage, pkg, { confirmed: true, rollbackAcknowledged: true });
  assert.equal(applied.applied, true);
  const restored = JSON.parse(storage.get('roles_sync_original_generations_v1'));
  assert.equal(restored[1].localOriginal[0].memo, 'older');
});

test('recovery module does not call the network', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/offline-recovery.js'), 'utf8');
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('apiEndpoint'), false);
  assert.equal(source.includes('saveData('), false);
});
