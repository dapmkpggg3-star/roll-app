const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = vm.createContext({ console, URL, TextEncoder, TextDecoder });
context.globalThis = context;
for (const file of ['js/planning-rules.js', 'js/planning-schedule.js', 'js/planning-calibers.js', 'js/operating-plan.js', 'js/roll-dashboard.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

function rowOf(model, rollId) {
  return model.rows.find(row => row.rollId === rollId);
}

test('anonymous dashboard keeps manual plans and does not invent a purchase date', () => {
  const fixture = context.anonymousDashboardFixture('2026-11-19T06:00:00.000Z');
  const before = JSON.stringify(fixture.rolls);
  const model = context.buildRollDashboard(fixture);
  assert.equal(JSON.stringify(fixture.rolls), before);
  assert.equal(model.rows.length, 3);
  const stand10 = rowOf(model, '#10-ANON-1');
  assert.equal(stand10.manual.useEnd, '2027-02-15');
  assert.equal(stand10.manual.rework, '2027-01-20');
  assert.equal(stand10.manual.operator, '匿名担当');
  assert.equal(stand10.auto.useEnd, '判定不能');
  assert.equal(stand10.auto.exchange, '2027-04-02');
  assert.equal(stand10.auto.purchase, '判定不能');
  assert.equal(stand10.auto.totalUseCount, 24);
  assert.match(stand10.diff.manualVersusAuto, /2027-02-15/);
  assert.match(stand10.diff.manualVersusAuto, /2027-04-02/);
  assert.match(stand10.diff.manualVersusAuto, /上書きしません/);
  assert.match(stand10.basis.steps.join('\n'), /改削日でも購入日でもありません/);
  assert.match(stand10.auto.lead, /暫定6か月/);
  assert.equal(stand10.auto.orderStatus, '発注済みは未確認です。');
  assert.match(stand10.diff.planRevision, /比較する前の計画版はありません/);
  assert.match(stand10.threeSet, /不足なしとは判定しません/);
});

test('missing diameters and a confirmed lead time stay unverified', () => {
  const model = context.buildRollDashboard();
  const missing = rowOf(model, '#11-ANON-2');
  assert.equal(missing.auto.exchange, '判定不能');
  assert.equal(missing.auto.purchase, '判定不能');
  assert.equal(missing.auto.totalUseCount, null);
  assert.match(missing.auto.rework, /未確認/);
  assert.match(missing.auto.rework, /0回にしません/);
  assert.equal(missing.warning, '');
  const confirmedLead = rowOf(model, '#16-ANON-3');
  assert.equal(confirmedLead.auto.purchase, '判定不能');
  assert.equal(confirmedLead.auto.totalUseCount, 12);
  assert.match(confirmedLead.basis.unverified, /換算は未確定/);
  assert.match(confirmedLead.warning, /予備は0本/);
  assert.match(confirmedLead.diff.manualVersusAuto, /2027-03-01/);
  assert.match(confirmedLead.diff.manualVersusAuto, /判定不能/);
  assert.equal(confirmedLead.manual.rework, '2027-03-01');
});

test('search, revision difference, and frozen numbers stay separate', () => {
  const fixture = context.anonymousDashboardFixture();
  const first = context.buildRollDashboardWithRevision(fixture, 'anon-plan-a');
  const revised = context.buildRollDashboardWithRevision(fixture, 'anon-plan-b');
  const ids = (model, query) => Array.from(context.filterDashboardRows(model.rows, query), row => row.rollId);
  assert.deepEqual(ids(first, { stand: '#10' }), ['#10-ANON-1']);
  assert.deepEqual(ids(first, { roll: 'ANON-2' }), ['#11-ANON-2']);
  assert.deepEqual(ids(first, { month: '2027-04' }), ['#10-ANON-1']);
  assert.deepEqual(ids(first, { month: '2027-03' }), ['#16-ANON-3']);
  assert.equal(context.filterDashboardRows(first.rows, { month: '2026-04' }).length, 0);
  assert.deepEqual(ids(revised, { month: '2026-04' }), ['#10-ANON-1']);
  assert.equal(rowOf(revised, '#10-ANON-1').auto.totalUseCount, 48);
  assert.match(rowOf(revised, '#10-ANON-1').diff.planRevision, /12か月/);
  assert.match(rowOf(revised, '#16-ANON-3').diff.planRevision, /変わっていません/);
  assert.equal(rowOf(revised, '#10-ANON-1').manual.useEnd, '2027-02-15');
  const frozen = context.freezeDashboardSnapshot(first);
  assert.equal(frozen.frozenAt, first.referenceAt);
  assert.equal(frozen.revisionId, 'anon-plan-a');
  assert.deepEqual(JSON.parse(JSON.stringify(frozen.numbers)), JSON.parse(JSON.stringify(context.dashboardComparableNumbers(first))));
  assert.notDeepEqual(JSON.parse(JSON.stringify(frozen.numbers)), JSON.parse(JSON.stringify(context.dashboardComparableNumbers(revised))));
  assert.deepEqual(ids(first, {}), ['#16-ANON-3', '#10-ANON-1', '#11-ANON-2']);
});

test('dashboard files are wired without a ledger write, and CI names the same tests', () => {
  const dashboard = fs.readFileSync(path.join(root, 'js/roll-dashboard.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'roll-dashboard.html'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/roll001-isolated-test.yml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(dashboard.includes('localStorage'), false);
  assert.equal(dashboard.includes('insertSheet'), false);
  assert.equal(dashboard.includes('google'), false);
  assert.match(page, /根拠を見る/);
  assert.match(page, /手入力予定/);
  assert.match(page, /js\/roll-dashboard\.js/);
  assert.match(index, /roll-dashboard\.html/);
  assert.match(workflow, /test\/roll-dashboard\.test\.cjs/);
  assert.match(workflow, /test\/roll-dashboard-browser\.cjs/);
  assert.equal(fs.existsSync(path.join(root, 'test/roll-dashboard-browser.cjs')), true);
});
