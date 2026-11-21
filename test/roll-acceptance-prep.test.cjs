const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = vm.createContext({ console, URL, TextEncoder, TextDecoder });
context.globalThis = context;
for (const file of ['js/planning-rules.js', 'js/planning-schedule.js', 'js/planning-calibers.js', 'js/operating-plan.js', 'js/roll-dashboard.js', 'js/roll-acceptance-prep.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

function item(name) {
  return context.acceptanceFieldMap().find(row => row.item === name);
}

test('saved code separates the six open items and stops a forecast that lacks them', () => {
  const findings = context.acceptanceSourceFindings();
  assert.equal(findings.length, 8);
  findings.forEach(item => {
    assert.ok(item.resolved);
    assert.ok(item.unresolved);
    assert.ok(item.impact);
  });
  const hours = findings.find(item => item.id === 'stand-10-hours');
  assert.match(hours.resolved, /カリバ替だけ/);
  assert.match(hours.resolved, /ロール替は3人・経過6時間/);
  assert.match(hours.resolved, /サイズ替と組替にはこの時間の定義がありません/);
  const gas = fs.readFileSync(path.join(root, 'google-apps-script.gs'), 'utf8');
  assert.match(gas, /ROLL_HISTORY_PLANNED_FONT_COLORS = \['#ff0000'/);
  assert.match(gas, /useEndDate: \{ offset: 14/);
  assert.match(gas, /!useEndField\.planned/);
  assert.equal(context.knownWorkEffort('10', 'caliberChange').hours, 1);
  assert.equal(context.knownWorkEffort('10', 'rollChange').hours, 6);
  assert.equal(context.knownWorkEffort('10', 'sizeChange'), null);
  assert.equal(context.knownWorkEffort('10', 'assembly'), null);
  assert.equal(context.knownWorkEffort('6', 'caliberChange').kind, '対象外');
  const oneHour = { date: '2027-04-02', period: 'day', workType: 'caliberChange', requiredHours: 1, reservedHours: 1, people: 3, continuous: 'no', changeover: 'yes', threeSet: 'yes' };
  assert.equal(context.dashboardConfirmedEffort('10', oneHour).ok, false);
  assert.match(context.dashboardConfirmedEffort('10', oneHour).note, /補助情報/);
  assert.equal(context.dashboardConfirmedEffort('10', Object.assign({}, oneHour, { workType: 'rollChange', requiredHours: 6, reservedHours: 6 })).ok, false);
  assert.equal(context.dashboardConfirmedEffort('10', Object.assign({}, oneHour, { requiredHours: 6, reservedHours: 6 })).ok, false);
  assert.equal(context.dashboardConfirmedEffort('10', Object.assign({}, oneHour, { workType: 'sizeChange' })).ok, false);
  assert.equal(context.dashboardConfirmedEffort('6', oneHour).ok, false);
  assert.equal(context.dashboardConfirmedEffort('16', Object.assign({}, oneHour, { people: 4, requiredHours: 6, reservedHours: 6 })).ok, false);
  const fixture = context.anonymousDashboardFixture();
  const missing = JSON.parse(JSON.stringify(fixture.rolls[0]));
  missing.scrapDiameter = '';
  missing.cutMm = '';
  missing.spareCount = null;
  missing.leadTime = { months: 6, status: 'provisional' };
  delete missing.workConfirmation;
  const row = context.buildDashboardRow(missing, fixture.revisions[0], fixture.referenceAt, null);
  assert.match(row.auto.rework, /0回にしません/);
  assert.match(row.spareText, /不足なしにはしません/);
  assert.equal(row.auto.purchase, '判定不能');
  assert.equal(row.auto.exchangeDate, null);
  const wrongType = JSON.parse(JSON.stringify(fixture.rolls[0]));
  wrongType.workConfirmation = { date: '2027-04-02', period: 'day', workType: 'rollChange', requiredHours: 6, reservedHours: 6, people: 3, continuous: 'no', changeover: 'yes', threeSet: 'yes' };
  wrongType.days = wrongType.days.map(item => item.date === '2027-04-02'
    ? Object.assign({}, item, { shift1Team: 'A', shift3Team: '', productionAmount: 0, operatingHours: 0 })
    : item);
  assert.equal(context.buildDashboardRow(wrongType, fixture.revisions[0], fixture.referenceAt, null).auto.exchangeDate, null);
});

test('the field map keeps handwritten plans, forecasts, and confirmed dates apart', () => {
  const record = context.sourceColumnMap().find(item => item.item === 'recordKind');
  const teams = context.sourceColumnMap().find(item => item.item === 'productionByTeam');
  assert.equal(record.state, '未確認');
  assert.match(record.column, /保存列は見当たりません/);
  assert.match(teams.column, /L14が操業A/);
  assert.match(teams.column, /6月の同じセルは未確認/);
  assert.match(teams.read, /0にはしません/);
  const work = context.sourceColumnMap().find(item => item.item === '作業予定');
  assert.match(work.column, /作業文言はK/);
  assert.match(work.column, /EとHは班/);
  assert.match(work.column, /Nは作業欄として確認できません/);
  assert.match(work.column, /6月の作業欄の列記号は未確認/);
  assert.equal(item('手入力の使用終了').state, '未確認');
  assert.match(item('手入力の使用終了').roles, /useEndDateには入れない/);
  assert.equal(item('確定の使用終了').roles, 'useEndDate');
  assert.match(item('予定表上の交換候補日').sheet, /使用終了日とは別/);
  assert.match(item('確認済み交換可能日').sheet, /予定表の日付だけでは確定しない/);
  assert.match(item('購入').roles, /購入予測日ではない/);
  assert.match(item('使用回数').production, /実績があれば実績/);
  assert.match(item('固定3セット').roles, /ロール3本ではない/);
  assert.match(item('上限到達の見込み').caliber, /開始直数/);
  const page = fs.readFileSync(path.join(root, 'js/roll-acceptance-prep.js'), 'utf8');
  assert.equal(page.includes('fetch('), false);
  assert.equal(page.includes('googleapis'), false);
  assert.equal(page.includes('insertSheet'), false);
});

test('each forecast records its source, adopted value, formula, revision, and open gaps', () => {
  const traces = context.acceptanceForecastTrace();
  assert.deepEqual(Array.from(traces, trace => trace.value), ['予定表上の交換候補日', '確認済み交換可能日', '上限到達の見込み', '使用回数', '改削残回数', '購入', '予備']);
  traces.forEach(trace => {
    assert.ok(trace.sources.length > 0);
    assert.ok(trace.adopted);
    assert.ok(trace.formula);
    assert.ok(trace.revision);
    assert.ok(trace.unresolved.length > 0);
  });
  const exchange = traces.find(trace => trace.value === '確認済み交換可能日');
  assert.match(exchange.formula, /夜勤|昼間の停止枠/);
  assert.match(exchange.unresolved.join('\n'), /未確認|保存する列/);
});

test('a read-only probe stops on permission, missing sources, mismatch, and writes', () => {
  const blocked = context.assessReadOnlyConnection({});
  assert.equal(blocked.liveConnected, false);
  assert.equal(blocked.ready, false);
  assert.match(blocked.stops.join('\n'), /権限不足/);
  assert.match(blocked.stops.join('\n'), /Rolesが無い/);
  assert.match(blocked.stops.join('\n'), /同期不一致/);
  const mismatch = context.assessReadOnlyConnection({
    permission: 'reader', rolesSheet: 'present', managementSheet: 'present',
    productionSchedule: 'present', caliberPlan: 'present', revisionMatch: false,
    writeCount: 0, endpointConfigured: true
  });
  assert.equal(mismatch.ready, false);
  assert.match(mismatch.stops.join('\n'), /同期不一致/);
  const write = context.assessReadOnlyConnection({
    permission: 'reader', rolesSheet: 'present', managementSheet: 'present',
    productionSchedule: 'present', caliberPlan: 'present', revisionMatch: true,
    writeCount: 1, endpointConfigured: true
  });
  assert.match(write.stops.join('\n'), /書込み/);
  const tons = context.assessReadOnlyConnection({
    permission: 'reader', rolesSheet: 'present', managementSheet: 'present',
    productionSchedule: 'present', caliberPlan: 'present', revisionMatch: true,
    writeCount: 0, productionMeasure: 'tons', endpointConfigured: true
  });
  assert.match(tons.stops.join('\n'), /トン数なので/);
  const ready = context.assessReadOnlyConnection({
    permission: 'reader', rolesSheet: 'present', managementSheet: 'present',
    productionSchedule: 'present', caliberPlan: 'present', revisionMatch: true,
    writeCount: 0, endpointConfigured: true
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.liveConnected, false);
  const verifiedRead = {
    permission: 'reader', rolesSheet: 'present', managementSheet: 'present',
    productionSchedule: 'present', caliberPlan: 'present', revisionMatch: true, endpointConfigured: true
  };
  for (const writeCount of [undefined, null, '', '0', false, -1, NaN]) {
    const result = context.assessReadOnlyConnection({ ...verifiedRead, writeCount });
    assert.equal(result.ready, false);
    assert.match(result.stops.join('\n'), /書込み.*未確認/);
  }

});

test('acceptance checks separate daytime work, continuous running, three-set, and spare shortage', () => {
  const fixture = context.anonymousDashboardFixture('2026-11-19T06:00:00.000Z');
  const night = context.evaluateAcceptance(fixture.rolls[0], fixture.revisions[0], fixture.referenceAt);
  assert.equal(night.checks.find(check => check.id === 'day-slot').result, '作業枠未確認');
  assert.equal(night.checks.find(check => check.id === 'day-slot').date, null);
  assert.equal(night.checks.find(check => check.id === 'continuous').result, '未確認');
  assert.match(night.checks.find(check => check.id === 'spare').detail, /不足なしにはしません/);
  const day = JSON.parse(JSON.stringify(fixture.rolls[0]));
  day.workConfirmation = {
    date: '2027-04-02', period: 'day', workType: 'caliberChange', requiredHours: 1, reservedHours: 1, people: 3,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  };
  day.days = day.days.map(item => item.date === '2027-04-02'
    ? Object.assign({}, item, { shift1Team: 'A', shift3Team: '', productionAmount: 0, operatingHours: 0, daytimeStop: 'yes' })
    : item);
  const hoursReady = context.evaluateAcceptance(day, fixture.revisions[0], fixture.referenceAt);
  assert.equal(hoursReady.checks.find(check => check.id === 'exchange-time').result, '未確認');
  assert.equal(hoursReady.checks.find(check => check.id === 'day-slot').date, null);
  day.replacementPlan = [{
    standKey: '10', date: '2027-04-02', workType: 'caliberChange', kind: 'plan',
    withinShift: 'yes', constraintsKnown: 'yes', setsWritten: 1
  }];
  const ready = context.evaluateAcceptance(day, fixture.revisions[0], fixture.referenceAt);
  assert.equal(ready.checks.find(check => check.id === 'day-slot').date, '2027-04-02');
  assert.equal(ready.checks.find(check => check.id === 'continuous').result, '連続操業ではない');
  assert.match(ready.checks.find(check => check.id === 'three-set').detail, /ロール本数ではありません/);
  const running = JSON.parse(JSON.stringify(day));
  running.workConfirmation.continuous = 'yes';
  const blocked = context.evaluateAcceptance(running, fixture.revisions[0], fixture.referenceAt);
  assert.equal(blocked.checks.find(check => check.id === 'continuous').result, '停止');
  assert.equal(blocked.checks.find(check => check.id === 'day-slot').date, null);
  const stand16 = context.evaluateAcceptance(fixture.rolls[2], fixture.revisions[0], fixture.referenceAt);
  assert.equal(stand16.checks.find(check => check.id === 'exchange-time').result, '未確認');
  assert.equal(stand16.checks.find(check => check.id === 'spare').result, '警告');
  assert.match(stand16.checks.find(check => check.id === 'spare').detail, /不足の確定にはしません/);
  const stand11 = context.evaluateAcceptance(fixture.rolls[1], fixture.revisions[0], fixture.referenceAt);
  assert.equal(stand11.checks.find(check => check.id === 'spare').result, '未確認');
});
