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

test('undo recovers the independent originals from installations using separate storage keys', () => {
  const { context, storage } = harness();
  const originalRoles = [{ id: 'old', memo: 'before-recovery' }];
  storage.set('roles', JSON.stringify(originalRoles));
  storage.set('roles_original_local_before_sync', JSON.stringify(local));
  storage.set('roles_original_remote_before_sync', JSON.stringify(remote));

  const pkg = context.buildOfflineRecoveryPackage({ roles: [], localOriginal: [], remoteOriginal: [] });
  const result = context.applyOfflineRecoveryPackage(context.localStorage, pkg, { confirmed: true, rollbackAcknowledged: true });
  assert.equal(result.applied, true);
  const rollback = JSON.parse(storage.get('roles_offline_recovery_rollback_v1'));
  assert.deepEqual(rollback.localOriginal, local);
  assert.deepEqual(rollback.remoteOriginal, remote);
  assert.equal(context.rollbackOfflineRecovery(context.localStorage, { confirmed: true }).applied, true);
  assert.deepEqual(JSON.parse(storage.get('roles')), originalRoles);
  assert.deepEqual(JSON.parse(storage.get('roles_original_local_before_sync')), local);
  assert.deepEqual(JSON.parse(storage.get('roles_original_remote_before_sync')), remote);
});

test('an unreadable available original blocks recovery before any stored data changes', () => {
  for (const [key, raw] of [
    ['roles_original_local_before_sync', '{broken'],
    ['roles_original_remote_before_sync', '{}'],
    ['roles_sync_original_pair_v1', '{"localOriginal":[]}']
  ]) {
    const { context, storage } = harness();
    storage.set(key, raw);
    storage.set('roles', JSON.stringify(local));
    const before = [...storage];
    const pkg = context.buildOfflineRecoveryPackage({ roles: [], localOriginal: [], remoteOriginal: [] });
    const result = context.applyOfflineRecoveryPackage(context.localStorage, pkg, { confirmed: true, rollbackAcknowledged: true });
    assert.equal(result.applied, false, key);
    assert.deepEqual([...storage], before);
  }
});

test('a valid paired snapshot takes precedence over stale separate keys', () => {
  const { context, storage } = harness();
  storage.set('roles_sync_original_pair_v1', JSON.stringify({ localOriginal: local, remoteOriginal: remote }));
  storage.set('roles_original_local_before_sync', '{bad');
  const rollback = context.buildRollbackFromStorage(context.localStorage);
  assert.equal(rollback.ok, true);
  const saved = JSON.parse(JSON.stringify(rollback.package));
  assert.deepEqual(saved.localOriginal, local);
  assert.deepEqual(saved.remoteOriginal, remote);
});


test('partial legacy originals block recovery instead of silently replacing a missing side with empty', () => {
  const { context, storage } = harness();
  storage.set('roles', JSON.stringify([{ id: 'current' }]));
  storage.set('roles_original_local_before_sync', JSON.stringify([{ id: 'local-preserve' }]));
  const pkg = context.buildOfflineRecoveryPackage({ roles: [], localOriginal: [], remoteOriginal: [] });
  const result = context.applyOfflineRecoveryPackage(context.localStorage, pkg, { confirmed: true, rollbackAcknowledged: true });
  assert.equal(result.applied, false);
  assert.equal(JSON.parse(storage.get('roles'))[0].id, 'current');
  assert.equal(storage.has('roles_offline_recovery_rollback_v1'), false);
});


test('present but empty legacy original refuses recovery before any write', () => {
  for (const emptyKey of ['roles_original_local_before_sync', 'roles_original_remote_before_sync']) {
    const { context, storage } = harness();
    storage.set('roles', JSON.stringify([{ id: 'keep' }]));
    storage.set('roles_original_local_before_sync', JSON.stringify([{ id: 'local' }]));
    storage.set('roles_original_remote_before_sync', JSON.stringify([{ id: 'remote' }]));
    storage.set(emptyKey, '');
    const before = [...storage];
    const pkg = context.buildOfflineRecoveryPackage({ roles: [], localOriginal: [], remoteOriginal: [] });
    const result = context.applyOfflineRecoveryPackage(context.localStorage, pkg, { confirmed: true, rollbackAcknowledged: true });
    assert.equal(result.applied, false, emptyKey);
    assert.deepEqual([...storage], before, emptyKey);
  }
});

test('undo preserves absence of original keys on a fresh anonymous device', () => {
  const { context, storage } = harness();
  const originalRoles = Array.from({ length: 60 }, (_, i) => ({
    id: 'anon-' + i, status: '予備', memo: 'memo-' + i,
    startDate: '2026-11-01', diameter: 200 + i
  }));
  storage.set('roles', JSON.stringify(originalRoles));
  storage.set('unrelated', 'keep');
  const before = [...storage];
  const pkg = context.buildOfflineRecoveryPackage({
    roles: originalRoles.map(item => ({ ...item, memo: 'changed' })),
    localOriginal: [], remoteOriginal: [], generations: [],
    savedAt: '2026-11-22T10:28:00Z'
  });
  assert.equal(context.applyOfflineRecoveryPackage(context.localStorage, pkg, {
    confirmed: true, rollbackAcknowledged: true
  }).applied, true);
  assert.equal(context.rollbackOfflineRecovery(context.localStorage, { confirmed: true }).applied, true);
  assert.deepEqual([...storage], before);
});

const rollbackKey = 'roles_offline_recovery_rollback_v1';
const oldPresenceKey = 'roles_offline_recovery_original_keys_v1';
const confirmed = { confirmed: true, rollbackAcknowledged: true };

function samplePackage(context, id) {
  return context.buildOfflineRecoveryPackage({
    roles: [{ id }], localOriginal: [{ id: id + '-local' }], remoteOriginal: [{ id: id + '-remote' }]
  });
}

test('failed second apply keeps the first recovery and its undo record together', () => {
  for (const failKey of [rollbackKey, 'roles', 'roles_original_remote_before_sync']) {
    const { context, storage } = harness();
    storage.set('roles', '[{"id":"initial"}]');
    const initial = new Map(storage);
    const device = context.localStorage;
    assert.equal(context.applyOfflineRecoveryPackage(device, samplePackage(context, 'first'), confirmed).applied, true);
    const beforeSecond = new Map(storage);
    const write = device.setItem;
    let failed = false;
    device.setItem = (k, v) => {
      if (k === failKey && !failed) { failed = true; throw Error('quota'); }
      return write(k, v);
    };
    const second = context.applyOfflineRecoveryPackage(device, samplePackage(context, 'second'), confirmed);
    assert.equal(second.applied, false, failKey);
    assert.deepEqual(storage, beforeSecond, failKey);
    assert.equal(context.rollbackOfflineRecovery(device, confirmed).applied, true);
    assert.deepEqual(storage, initial);
  }
});

test('undo rejects a changed raw original inside the saved record before writing', () => {
  const { context, storage } = harness();
  storage.set('roles_original_local_before_sync', '[{"id":"AAA"}]');
  storage.set('roles_original_remote_before_sync', '[{"id":"RRR"}]');
  context.applyOfflineRecoveryPackage(context.localStorage, samplePackage(context, 'first'), confirmed);
  const key = storage.has(oldPresenceKey) ? oldPresenceKey : rollbackKey;
  const raw = storage.get(key);
  const altered = raw.replace(/AAA(?![\s\S]*AAA)/, 'BBB');
  assert.notEqual(raw, altered);
  storage.set(key, altered);
  const before = new Map(storage);
  assert.equal(context.rollbackOfflineRecovery(context.localStorage, confirmed).applied, false);
  assert.deepEqual(storage, before);
});

test('undo reads earlier standalone and paired records, and refuses mismatched legacy raw data', () => {
  const slots = [
    'roles_sync_original_pair_v1', 'roles_original_local_before_sync', 'roles_original_remote_before_sync',
    'roles_original_local_before_sync_saved_at', 'roles_original_remote_before_sync_saved_at',
    'roles_sync_original_generations_v1'
  ];
  for (const shape of ['standalone', 'separate', 'different']) {
    const { context, storage } = harness();
    const pkg = samplePackage(context, 'old');
    storage.set(rollbackKey, JSON.stringify(pkg));
    storage.set('roles', '[{"id":"current"}]');
    if (shape !== 'standalone') {
      const raws = [null, JSON.stringify(pkg.localOriginal, null, 2), JSON.stringify(pkg.remoteOriginal), null, null, null];
      if (shape === 'different') raws[1] = '[{"id":"other"}]';
      storage.set(oldPresenceKey, JSON.stringify(slots.map((key, i) => [key, raws[i]])));
    }
    const before = new Map(storage);
    const result = context.rollbackOfflineRecovery(context.localStorage, confirmed);
    if (shape === 'different') {
      assert.equal(result.applied, false);
      assert.deepEqual(storage, before);
    } else {
      assert.equal(result.applied, true);
      assert.equal(JSON.parse(storage.get('roles'))[0].id, 'old');
      assert.equal(storage.has(rollbackKey), false);
      assert.equal(storage.has(oldPresenceKey), false);
      if (shape === 'separate') {
        assert.equal(storage.has(slots[0]), false);
        assert.equal(storage.get(slots[1]), JSON.stringify(pkg.localOriginal, null, 2));
      }
    }
  }
});

test('interrupted undo retains the checked record and can finish on retry', () => {
  const { context, storage } = harness();
  storage.set('roles', '[{"id":"initial"}]');
  const before = new Map(storage);
  const device = context.localStorage;
  context.applyOfflineRecoveryPackage(device, samplePackage(context, 'first'), confirmed);
  const write = device.setItem;
  device.setItem = () => { throw Error('quota'); };
  assert.equal(context.rollbackOfflineRecovery(device, confirmed).applied, false);
  assert.equal(storage.has(rollbackKey), true);
  device.setItem = write;
  assert.equal(context.rollbackOfflineRecovery(device, confirmed).applied, true);
  assert.deepEqual(storage, before);
});
