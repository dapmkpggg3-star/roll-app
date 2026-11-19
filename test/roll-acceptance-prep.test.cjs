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

test('the field map keeps handwritten plans, forecasts, and confirmed dates apart', () => {
  assert.equal(item('手入力の使用終了').state, '未確認');
  assert.match(item('手入力の使用終了').roles, /useEndDateには入れない/);
  assert.equal(item('確定の使用終了').roles, 'useEndDate');
  assert.match(item('確認済み交換候補').sheet, /使用終了日とは別/);
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
  assert.deepEqual(Array.from(traces, trace => trace.value), ['確認済み交換候補', '上限到達の見込み', '使用回数', '改削残回数', '購入', '予備']);
  traces.forEach(trace => {
    assert.ok(trace.sources.length > 0);
    assert.ok(trace.adopted);
    assert.ok(trace.formula);
    assert.ok(trace.revision);
    assert.ok(trace.unresolved.length > 0);
  });
  const exchange = traces[0];
  assert.match(exchange.formula, /夜勤|昼の停止/);
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
    ? Object.assign({}, item, { shift1Team: 'A', shift3Team: '', productionAmount: 0, operatingHours: 0 })
    : item);
  const ready = context.evaluateAcceptance(day, fixture.revisions[0], fixture.referenceAt);
  assert.equal(ready.checks.find(check => check.id === 'exchange-time').result, '一致');
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
