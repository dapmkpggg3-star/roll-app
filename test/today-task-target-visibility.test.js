const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Runs the *real* app.js target-selection functions with mock inputs, never the
// production app or its remote endpoints. Deliberately no DOM or network access.
const appSource = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const begin = appSource.indexOf('function getTodayTaskTargetRole(task)');
const end = appSource.indexOf('function getWatchStandItems(allRoles)', begin);
assert.ok(begin >= 0 && end > begin, 'today-task functions must be present');
const selectionSource = appSource.slice(begin, end);

const USED = '中古予備（バラシ前）';
const NEW = '新品予備（組替可能）';
const ONLINE = 'オンライン';
const STORED = '新品予備（組込完了）';
const SCRAP = '廃却待ち';
const roles = [
  { id: '10-A', name: '#10-A', status: USED, updatedAt: 10 },
  { id: '10-B', name: '#10-B', status: NEW, updatedAt: 30 },
  { id: '10-C', name: '#10-C', status: ONLINE, updatedAt: 50 },
  { id: '11-A', name: '#11-A', status: USED, updatedAt: 70 },
  { id: '11-B', name: '#11-B', status: NEW, updatedAt: 20 },
  { id: '11-C', name: '#11-C', status: ONLINE, updatedAt: 40 }
];

function makeTargetLookup(visibleIds) {
  const visible = new Set(visibleIds);
  const context = vm.createContext({
    roles: roles.map(role => ({ ...role })),
    getFilteredRoles: () => roles.filter(role => visible.has(role.id)),
    getStandKey: name => String(name).match(/#(\d+)/)?.[1] || '',
    compareUpdatedAt: (a, b, order) => order === 'desc'
      ? Number(b.updatedAt) - Number(a.updatedAt)
      : Number(a.updatedAt) - Number(b.updatedAt),
    USED_STANDBY_STATUS: USED,
    NEW_READY_STATUS: NEW,
    NEW_STORAGE_STATUS: STORED,
    ORDERED_WAITING_STATUS: '発注待ち',
    SCRAP_WAITING_STATUS: SCRAP,
    DISCARDED_STATUS: '廃却済',
    ALLOWED_STATUSES: [USED, NEW, ONLINE, STORED, '発注待ち', SCRAP, '廃却済']
  });
  vm.runInContext(selectionSource + '\nthis.selectTarget = getTodayTaskTargetRole;', context, { timeout: 1000 });
  return { selectTarget: context.selectTarget, context };
}

const assembly10 = { id: 'assembly-10', standKey: '10' };

test('hidden first-priority roll never redirects to the next visible roll', () => {
  const { selectTarget } = makeTargetLookup(['10-B', '10-C', '11-A', '11-B', '11-C']);
  assert.equal(selectTarget(assembly10), null);
});

test('visible first-priority roll remains the target', () => {
  const { selectTarget } = makeTargetLookup(roles.map(role => role.id));
  assert.equal(selectTarget(assembly10).id, '10-A');
});

test('direct rework task does not point to a hidden roll', () => {
  const { selectTarget } = makeTargetLookup(['10-B', '10-C']);
  assert.equal(selectTarget({ id: 'rework-ready-10-A' }), null);
});

test('direct rework task still points to a visible roll', () => {
  const { selectTarget } = makeTargetLookup(['10-A']);
  assert.equal(selectTarget({ id: 'rework-ready-10-A' }).id, '10-A');
});

test('direct confirmation task checks visibility too', () => {
  const { selectTarget } = makeTargetLookup(['10-B', '10-C']);
  assert.equal(selectTarget({ id: 'reworking-confirm-10-A' }), null);
});

test('stand selection remains scoped to the requested stand', () => {
  const { selectTarget } = makeTargetLookup(roles.map(role => role.id));
  assert.equal(selectTarget({ id: 'assembly-11', standKey: '11' }).id, '11-A');
});

test('missing task and unavailable stand return null', () => {
  const { selectTarget } = makeTargetLookup(roles.map(role => role.id));
  assert.equal(selectTarget(null), null);
  assert.equal(selectTarget({ id: 'assembly-12', standKey: '12' }), null);
});

test('target lookup does not change roll order or statuses', () => {
  const { selectTarget, context } = makeTargetLookup(roles.map(role => role.id));
  const before = JSON.stringify(context.roles);
  selectTarget(assembly10);
  assert.equal(JSON.stringify(context.roles), before);
});

test('reserve shortage never chooses an excluded hidden status', () => {
  const { selectTarget } = makeTargetLookup(roles.map(role => role.id));
  const result = selectTarget({ id: 'reserve-shortage-10', standKey: '10' });
  assert.ok(result);
  assert.notEqual(result.status, SCRAP);
  assert.notEqual(result.status, STORED);
  assert.equal(result.id, '10-C');
});

test('generic stand task stops rather than redirecting past a hidden newest roll', () => {
  const { selectTarget } = makeTargetLookup(['10-A', '10-B']);
  assert.equal(selectTarget({ id: 'watch-10', standKey: '10' }), null);
});
