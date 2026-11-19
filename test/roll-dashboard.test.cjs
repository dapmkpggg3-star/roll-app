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
  assert.equal(stand10.auto.exchange, '作業枠未確認');
  assert.equal(stand10.auto.exchangeDate, null);
  assert.equal(stand10.manualSummary, '改削 2027-01-20');
  assert.equal(stand10.auto.purchase, '判定不能');
  assert.equal(stand10.auto.totalUseCount, 24);
  assert.match(stand10.diff.manualVersusAuto, /使用終了予定と交換候補は種類が違うので、日数差は出しません/);
  assert.equal(/交換は同じ種類[\s\S]*日違います/.test(stand10.diff.manualVersusAuto), false);
  assert.match(stand10.diff.manualVersusConfirmed, /使用終了は同じ種類の日付で179日違います/);
  assert.match(stand10.basis.steps.join('\n'), /上限到達の見込み/);
  assert.match(stand10.basis.steps.join('\n'), /2027-04-02/);
  assert.match(stand10.basis.steps.join('\n'), /交換候補にはしません/);
  assert.equal(stand10.auto.exchange.includes('2027-04-02'), false);
  assert.match(stand10.auto.lead, /暫定6か月/);
  assert.equal(stand10.auto.orderStatus, '発注済みは未確認です。');
  assert.match(stand10.diff.planRevision, /比較する前の計画版はありません/);
  assert.match(stand10.threeSet, /不足なしとは判定しません/);
});

test('missing diameters and a confirmed lead time stay unverified', () => {
  const model = context.buildRollDashboard();
  const missing = rowOf(model, '#11-ANON-2');
  assert.equal(missing.auto.exchange, '作業枠未確認');
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
  assert.equal(confirmedLead.manualSummary, '改削 2027-03-01');
  assert.match(confirmedLead.diff.manualVersusAuto, /種類が違う/);
  assert.equal(confirmedLead.warningLabel, '予備0本');
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

test('a night-only stop is not an exchange date, and a checked daytime stop can be', () => {
  const fixture = context.anonymousDashboardFixture();
  const night = fixture.rolls[0];
  night.workConfirmation = {
    date: '2027-04-02', period: 'day', workType: 'caliberChange', requiredHours: 1, reservedHours: 1, people: 3,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  };
  const rejected = context.buildDashboardRow(night, fixture.revisions[0], fixture.referenceAt, null);
  assert.equal(rejected.auto.exchangeDate, null);
  assert.equal(rejected.auto.exchange, '作業枠未確認');
  assert.match(rejected.auto.limitText, /2027-04-04は上限到達の見込み/);
  const day = Object.assign({}, night, {
    days: night.days.map(item => item.date === '2027-04-02'
      ? Object.assign({}, item, { shift1Team: 'A', shift3Team: '', productionAmount: 0, operatingHours: 0 })
      : item)
  });
  const accepted = context.buildDashboardRow(day, fixture.revisions[0], fixture.referenceAt, null);
  assert.equal(accepted.auto.exchangeDate, '2027-04-02');
  assert.match(accepted.basis.steps.join('\n'), /作業枠を確認した交換候補は2027-04-02/);
  assert.equal(accepted.manual.useEnd, '2027-02-15');
  assert.equal(accepted.diff.manualVersusAuto.includes('使用終了予定と交換候補は種類が違う'), true);
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
