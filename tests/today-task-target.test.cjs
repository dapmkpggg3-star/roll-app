// Run: node --test tests/today-task-target.test.cjs
// Isolated source-level regression test: never writes app data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const start = source.indexOf('function getTodayTaskStandTargetRole(');
const end = source.indexOf('\nfunction ', start + 10);
assert.ok(start >= 0 && end > start, 'target function must exist');
const fnSource = source.slice(start, end);
function select(all, visibleIds, statuses) {
  const context = {
    roles: all,
    getFilteredRoles: () => all.filter(r => visibleIds.includes(r.id)),
    getStandKey: name => String(name).replace(/[^0-9]/g, ''),
    compareUpdatedAt: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))
  };
  vm.createContext(context);
  vm.runInContext(fnSource, context);
  const result = context.getTodayTaskStandTargetRole({standKey: '10'}, statuses);
  return result && result.id;
}
const all = [
  {id: 'used', name: '#10', status: 'used', updatedAt: '2026-11-10'},
  {id: 'ready', name: '#10', status: 'ready', updatedAt: '2026-11-12'},
  {id: 'other', name: '#11', status: 'used', updatedAt: '2026-11-12'}
];
test('hidden top-priority roll must not redirect to visible lower-priority roll', () => {
  assert.equal(select(all, ['ready'], ['used', 'ready']), null);
});
test('visible top-priority roll is selected', () => {
  assert.equal(select(all, ['used', 'ready'], ['used', 'ready']), 'used');
});
test('stand is not crossed', () => {
  assert.equal(select(all, ['other'], ['used', 'ready']), null);
});
test('no matching status returns null', () => {
  assert.equal(select(all, ['used', 'ready'], ['online']), null);
});
test('without status priority latest matching roll wins when visible', () => {
  assert.equal(select(all, ['used', 'ready'], null), 'ready');
});
test('without status priority hidden latest roll must not redirect', () => {
  assert.equal(select(all, ['used'], null), null);
});
