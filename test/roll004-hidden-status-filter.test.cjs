const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing ' + name);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const appSource = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const context = vm.createContext({
  statusFilter: 'all',
  searchQuery: '',
  watchStandFilter: null,
  memoOnlyFilter: false,
  roles: []
});
vm.runInContext([
  "const ALLOWED_STATUSES = ['オンライン','中古予備（バラシ前）','新品予備保管','発注済み（納入待ち）','廃却待ち（ラック保管）','廃棄'];",
  "const LEGACY_SCRAP_WAITING_STATUS = '廃却待ち';",
  "const SCRAP_WAITING_STATUS = '廃却待ち（ラック保管）';",
  "const DISCARDED_STATUS = '廃棄';",
  "const NEW_STORAGE_STATUS = '新品予備保管';",
  "const ORDERED_WAITING_STATUS = '発注済み（納入待ち）';",
  extractFunction(appSource, 'normalizeRoleStatusValue'),
  extractFunction(appSource, 'hasMemoText'),
  extractFunction(appSource, 'isStatusMatched'),
  extractFunction(appSource, 'isWatchStandMatched'),
  extractFunction(appSource, 'getFilteredRoles')
].join('\n'), context);

function names() {
  return context.getFilteredRoles().map(role => role.name);
}

test('legacy scrap-waiting cards stay hidden with the default list', () => {
  context.statusFilter = 'all';
  context.searchQuery = '';
  context.roles = [
    { id: 'a', name: '#10-A', status: 'オンライン', memo: '' },
    { id: 'b', name: '#10-B', status: '廃却待ち（ラック保管）', memo: '' },
    { id: 'c', name: '#10-C', status: '廃却待ち', memo: '' },
    { id: 'd', name: '#10-D', status: '発注済み（納入待ち）', memo: '' }
  ];
  assert.deepEqual(names(), ['#10-A']);
});

test('explicit scrap filter shows both canonical and legacy scrap cards only', () => {
  context.statusFilter = '廃却待ち（ラック保管）';
  context.searchQuery = '';
  assert.deepEqual(names(), ['#10-B', '#10-C']);
});
