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

function checkedDayRoll(workPatch, dayPatch) {
  const fixture = context.anonymousDashboardFixture();
  const roll = JSON.parse(JSON.stringify(fixture.rolls[0]));
  roll.workConfirmation = Object.assign({
    date: '2027-04-02', period: 'day', workType: 'caliberChange', requiredHours: 1, reservedHours: 1, people: 3,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  }, workPatch || {});
  roll.days = roll.days.map(item => item.date === '2027-04-02'
    ? Object.assign({}, item, { shift1Team: 'A', shift3Team: '', productionAmount: 0, operatingHours: 0 }, dayPatch || {})
    : item);
  return context.buildDashboardRow(roll, fixture.revisions[0], fixture.referenceAt, null);
}

test('daytime work, continuous running, spare shortage, and missing conditions stay distinct', () => {
  const ready = checkedDayRoll();
  assert.equal(ready.auto.exchangeDate, '2027-04-02');
  assert.equal(ready.manual.useEnd, '2027-02-15');
  assert.equal(ready.warningLabel, '');
  const blocked = [
    ['continuous', { continuous: 'yes' }, {}],
    ['changeover', { changeover: 'no' }, {}],
    ['threeSet', { threeSet: '' }, {}],
    ['people', { people: undefined }, {}],
    ['short reserve', { reservedHours: 0 }, {}],
    ['night period', { period: 'night' }, {}],
    ['producing', {}, { productionAmount: 10, operatingHours: 8 }]
  ];
  blocked.forEach(([name, workPatch, dayPatch]) => {
    const row = checkedDayRoll(workPatch, dayPatch);
    assert.equal(row.auto.exchangeDate, null, name);
    assert.equal(row.auto.exchange, '作業枠未確認', name);
    assert.match(row.auto.limitText, /上限到達の見込み/, name);
    assert.equal(row.manual.useEnd, '2027-02-15', name);
  });
  const short = checkedDayRoll();
  short.warningLabel = '予備0本';
  const fixture = context.anonymousDashboardFixture();
  const scarce = JSON.parse(JSON.stringify(fixture.rolls[0]));
  scarce.spareCount = 0;
  scarce.workConfirmation = {
    date: '2027-04-02', period: 'day', workType: 'caliberChange', requiredHours: 1, reservedHours: 1, people: 3,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  };
  scarce.days = scarce.days.map(item => item.date === '2027-04-02'
    ? Object.assign({}, item, { shift1Team: 'A', shift3Team: '', productionAmount: 0, operatingHours: 0 })
    : item);
  const scarceRow = context.buildDashboardRow(scarce, fixture.revisions[0], fixture.referenceAt, null);
  assert.equal(scarceRow.auto.exchangeDate, '2027-04-02');
  assert.equal(scarceRow.warningLabel, '予備0本');
  assert.match(scarceRow.warning, /不足の確定にはしません/);
  const unverifiedSpare = context.buildRollDashboard();
  const stand16 = unverifiedSpare.rows.find(row => row.rollId === '#16-ANON-3');
  assert.equal(stand16.auto.exchangeDate, null);
  assert.equal(stand16.warningLabel, '予備0本');
  assert.equal(short.auto.exchangeDate, '2027-04-02');
});

test('the anonymous sheet repeats the dashboard values in separate kinds', () => {
  const model = context.buildRollDashboard();
  const before = JSON.stringify(model);
  const sheet = context.buildAnonymousManagementSheet(model);
  assert.equal(JSON.stringify(model), before);
  assert.deepEqual(Array.from(sheet.headers), ['区分', 'スタンド', 'ロール', '項目', '値']);
  const kinds = Array.from(new Set(Array.from(sheet.rows, row => row.kind)));
  assert.deepEqual(kinds, ['手入力予定', '予測', '確定・実績', '根拠', '警告']);
  const cell = (rollId, kind, item) => sheet.rows.find(row => row.rollId === rollId && row.kind === kind && row.item === item);
  assert.equal(cell('#10-ANON-1', '手入力予定', '使用終了').value, '2027-02-15');
  assert.equal(cell('#10-ANON-1', '予測', '確認済み交換候補').value, '作業枠未確認');
  assert.equal(cell('#10-ANON-1', '予測', '購入').value, '判定不能');
  assert.equal(cell('#10-ANON-1', '予測', '使用回数').value, '24');
  assert.equal(cell('#10-ANON-1', '確定・実績', '使用終了').value, '2026-08-20');
  assert.match(cell('#10-ANON-1', '根拠', '計算式').value, /交換候補は、昼の停止/);
  assert.equal(cell('#10-ANON-1', '予測', '確認済み交換候補').value.includes('2027-04-02'), false);
  assert.equal(cell('#16-ANON-3', '警告', '表示').value, '予備0本');
  assert.equal(cell('#16-ANON-3', '予測', '確認済み交換候補').value, '作業枠未確認');
  const tsv = context.anonymousManagementSheetTsv(sheet);
  assert.match(tsv, /手入力予定\t#10\t#10-ANON-1\t使用終了\t2027-02-15/);
  assert.match(tsv, /手入力予定\t#10\t#10-ANON-1\t改削\t2027-01-20/);
  assert.match(tsv, /予測\t#10\t#10-ANON-1\t確認済み交換候補\t作業枠未確認/);
  assert.match(tsv, /予測\t#10\t#10-ANON-1\t購入\t判定不能/);
  assert.match(tsv, /確定・実績\t#10\t#10-ANON-1\t使用終了\t2026-08-20/);
  assert.match(tsv, /警告\t#16\t#16-ANON-3\t表示\t予備0本/);
  assert.match(tsv, /#11-ANON-2/);
  assert.equal(tsv.includes('googleapis'), false);
  assert.equal(tsv.includes('不足なし。'), false);
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
