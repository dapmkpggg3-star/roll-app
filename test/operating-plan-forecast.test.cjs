const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/operating-plan.js'), 'utf8');
const context = vm.createContext({
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById() { return null; }, readyState: 'complete', addEventListener() {} },
  RollPlanningRules: require('../js/planning-rules'),
  RollPlanningSchedule: require('../js/planning-schedule'),
  RollPlanningCalibers: require('../js/planning-calibers')
});
context.globalThis = context;
vm.runInContext(source, context);

function months(count, startYear = 2026) {
  return Array.from({ length: count }, (_, index) => {
    const month = index + 4;
    const year = startYear + Math.floor((month - 1) / 12);
    const monthNumber = ((month - 1) % 12) + 1;
    return `${year}-${String(monthNumber).padStart(2, '0')}`;
  });
}

function revision(targetMonths, rows, updatedAt = '2026-11-13T00:00:00.000Z') {
  const created = context.createOperatingPlanRevision({ id: updatedAt, label: 'anon', updatedAt, targetMonths, rows });
  assert.equal(created.ok, true, created.reason);
  return created.revision;
}

test('a revised operating plan keeps the old version and does not change roll status', () => {
  const roles = [{ id: 'anon', status: 'オンライン' }];
  const before = revision(['2026-04'], [{ standKey: '10', month: '2026-04', plannedUseCount: 2, actualUseCount: null }]);
  const after = revision(['2026-04'], [{ standKey: '10', month: '2026-04', plannedUseCount: 4, actualUseCount: 1 }], '2026-12-01T00:00:00.000Z');
  const stored = context.saveOperatingPlanRevision(context.saveOperatingPlanRevision([], before), after);
  assert.equal(stored.length, 2);
  assert.equal(stored[0].rows[0].plannedUseCount, 2);
  const diff = context.diffOperatingPlanRevisions(stored[0], stored[1]);
  assert.equal(diff.changed.length, 2);
  assert.deepEqual(roles, [{ id: 'anon', status: 'オンライン' }]);
  assert.equal(source.includes('saveLocalRoles'), false);
});

test('actual use replaces the plan for the latest exchange month', () => {
  const targetMonths = months(12);
  const rows = targetMonths.map(month => ({ standKey: '10', month, plannedUseCount: 5, actualUseCount: month === '2026-04' ? 1 : null }));
  const plan = revision(targetMonths, rows);
  const forecast = context.forecastThreeSetFromPlan({
    standKey: '10', revision: plan, remainingCutCount: 3, activeThreeSetCount: 3,
    leadTime: { months: 6, status: 'provisional' }
  });
  assert.equal(forecast.totalUseCount, 5 * 11 + 1);
  assert.equal(forecast.purchase, 'unknown');
  assert.equal(forecast.shortage, 'unknown');
  assert.equal(forecast.reason.includes('確定判定はしません'), true);
});

test('missing plan, remaining cuts, or a provisional lead time stays unverified', () => {
  const incomplete = context.forecastThreeSetFromPlan({ standKey: '10', revision: null, remainingCutCount: 2, activeThreeSetCount: 3, leadTime: { status: 'confirmed', months: 6 } });
  assert.equal(incomplete.shortage, 'unknown');
  assert.equal(incomplete.totalUseCount, null);
  const targetMonths = months(12);
  const rows = targetMonths.map(month => ({ standKey: '10', month, plannedUseCount: 1, actualUseCount: null }));
  const plan = revision(targetMonths, rows);
  const provisional = context.forecastThreeSetFromPlan({ standKey: '10', revision: plan, remainingCutCount: 2, activeThreeSetCount: 3, leadTime: context.defaultStandLeadTime('10') });
  assert.equal(provisional.purchase, 'unknown');
  assert.match(provisional.reason, /暫定/);
  const notThree = context.forecastThreeSetFromPlan({ standKey: '10', revision: plan, remainingCutCount: 2, activeThreeSetCount: 2, leadTime: { status: 'confirmed', months: 6 } });
  assert.match(notThree.reason, /固定3セット/);
});

test('a past monthly schedule stays in tons and is not an annual plan or actual use', () => {
  const summary = context.summarizeMonthlyProductionSchedule([
    { date: '2025-04-01', size: 'D10', productionAmount: 120, shift1Team: 'A', shift3Team: 'B', operatingHours: 8 },
    { date: '2025-04-02', size: 'D13', productionAmount: 80, shift1Team: 'B', shift3Team: 'A' }
  ], '2026-11-13');
  assert.equal(summary.kind, 'monthly-production-schedule');
  assert.equal(summary.acceptedAsActual, false);
  assert.equal(summary.acceptedAsAnnual, false);
  assert.equal(summary.usableForShortage, false);
  assert.equal(summary.months[0].classification, 'past');
  assert.equal(summary.months[0].productionTons, 200);
  assert.equal(summary.months[0].measure, 'tons');
  assert.equal(summary.months[0].sizes.join(','), 'D10,D13');
  assert.equal(summary.months[0].operatingHours, null);
  const forecast = context.forecastThreeSetFromPlan({
    standKey: '10', revision: summary, remainingCutCount: 3, activeThreeSetCount: 3,
    leadTime: { months: 6, status: 'confirmed' }
  });
  assert.equal(forecast.shortage, 'unknown');
  assert.equal(forecast.totalUseCount, null);
  assert.match(forecast.reason, /不足なしとは判定しません/);
  const rejected = context.createOperatingPlanRevision({
    updatedAt: '2026-11-13T00:00:00.000Z', targetMonths: ['2026-04'],
    rows: [{ standKey: '10', month: '2026-04', plannedUseCount: 1, actualUseCount: null, productionTons: 200 }]
  });
  assert.equal(rejected.ok, false);
});

test('rolling hours stay hours and are not added when a day is missing', () => {
  const complete = context.summarizeMonthlyProductionSchedule([
    { date: '2026-10-01', size: 'D10', productionAmount: 10, shift1Team: 'A', shift3Team: 'B', operatingHours: 7 },
    { date: '2026-10-02', size: 'STOP', productionAmount: 0, shift1Team: '', shift3Team: '', operatingHours: 0 }
  ], '2026-11-13');
  assert.equal(complete.months[0].operatingHours, 7);
  assert.equal(complete.months[0].classification, 'past');
  assert.equal(complete.acceptedAsActual, false);
});

test('past production tons do not become a future rework or purchase date', () => {
  const past = context.summarizeMonthlyProductionSchedule([
    { date: '2026-09-01', size: 'D10', productionAmount: 100, shift1Team: 'A', shift3Team: 'B', operatingHours: 8 }
  ], '2026-11-13');
  const linked = context.linkProductionToConsumption({ schedule: past, standKey: '10' });
  assert.equal(linked.reworkTiming, 'unknown');
  assert.equal(linked.purchaseTiming, 'unknown');
  assert.equal(linked.rollUseCount, null);
  assert.equal(linked.statusChanged, false);
  assert.match(linked.reason, /過去の月/);
  const future = context.summarizeMonthlyProductionSchedule([
    { date: '2027-04-01', size: 'D10', productionAmount: 100, shift1Team: 'A', shift3Team: 'B', operatingHours: 8 },
    { date: '2027-04-02', size: 'D13', productionAmount: 50, shift1Team: 'B', shift3Team: 'A', operatingHours: 4 }
  ], '2026-11-13');
  const missing = context.linkProductionToConsumption({ schedule: future, standKey: '10' });
  assert.equal(missing.rollUseCount, null);
  assert.equal(missing.gaps.includes('スタンドごとの使用トン数'), true);
  assert.equal(missing.gaps.includes('10番と11番の8直までの上限'), false);
  assert.equal(missing.gaps.includes('サイズごとの専用カリバ'), true);
  assert.equal(source.includes('405'), false);
  const estimated = context.linkProductionToConsumption({
    schedule: context.summarizeMonthlyProductionSchedule([
      { date: '2027-04-01', size: 'D1', productionAmount: 100, shift1Team: 'A', shift3Team: 'B', operatingHours: 8 }
    ], '2026-11-13'),
    standKey: '4',
    standTons: { confirmed: true, tons: 100 },
    conversion: { confirmed: true, tonsPerRollUse: 50 },
    shortHoursConfirmed: true
  });
  assert.equal(estimated.rollUseCount, 2);
  assert.equal(estimated.reworkTiming, 'unknown');
  assert.equal(estimated.purchaseTiming, 'unknown');
  const day = (date, hours, team, amount) => ({
    date, size: 'D1', operatingHours: hours, productionAmount: amount,
    shift1Team: '', shift3Team: team || '', productionByTeam: { A: team === 'A' ? amount : 0, B: team === 'B' ? amount : 0 }
  });
  const replacement = context.projectCaliberReplacement({
    standKey: '10', referenceDate: '2026-11-13', currentCaliber: 'anon-1', openingUsedRuns: 6, size: 'D1',
    days: [day('2027-04-01', 8, 'A', 10), day('2027-04-02', 0, 'B', 0), day('2027-04-03', 8, 'A', 10), day('2027-04-04', 5, 'A', 10)]
  });
  assert.equal(replacement.exchangeDate, '2027-04-02');
  assert.equal(replacement.exceedsOnDate, '2027-04-04');
  assert.equal(replacement.reworkTiming, 'unknown');
  assert.equal(replacement.statusChanged, false);
  const short = context.projectCaliberReplacement({
    standKey: '11', referenceDate: '2026-11-13', currentCaliber: 'anon-1', openingUsedRuns: 7, size: 'D1',
    days: [day('2027-04-01', 3, 'A', 10), day('2027-04-02', 8, 'A', 10)]
  });
  assert.equal(short.exchangeDate, null);
  assert.equal(short.exceedsOnDate, null);
  assert.equal(short.reason.includes('超えません'), false);
  assert.match(short.reason, /確定しません/);
  const noSlot = context.projectCaliberReplacement({
    standKey: '10', referenceDate: '2026-11-13', currentCaliber: 'anon-1', openingUsedRuns: 7, size: 'D1',
    days: [day('2027-04-01', 8, 'A', 10), day('2027-04-02', 8, 'A', 10)]
  });
  assert.equal(noSlot.exchangeDate, null);
  assert.equal(noSlot.lastAllowedDate, '2027-04-01');
  assert.equal(noSlot.exceedsOnDate, '2027-04-02');
  assert.match(noSlot.reason, /交換候補日は出しません/);
  assert.equal(context.knownCaliberLimit('12', 'D10').runs, 11);
  assert.equal(context.knownCaliberLimit('12', 'D10').kind, '通常');
  assert.equal(context.knownCaliberLimit('13', 'D10').runs, 6);
  assert.equal(context.knownCaliberLimit('13', 'D13').runs, 12);
  assert.equal(context.knownCaliberLimit('16', 'D13').runs, 14);
  assert.equal(context.knownCaliberLimit('17', 'D10').runs, 6);
  assert.equal(context.knownCaliberLimit('6', 'D10'), null);
  const normalGuide = context.projectCaliberReplacement({
    standKey: '12', referenceDate: '2026-11-13', currentCaliber: 'anon-1', openingUsedRuns: 11, size: 'D10',
    days: [day('2027-04-01', 8, 'A', 10)]
  });
  assert.equal(normalGuide.exchangeDate, null);
  assert.equal(normalGuide.exceedsOnDate, null);
  assert.equal(normalGuide.lastAllowedDate, null);
  assert.match(normalGuide.reason, /通常11直の目安/);
  assert.match(normalGuide.reason, /確定最大は未確認/);
  assert.equal(normalGuide.reason.includes('超えます'), false);
  const confirmedMax = context.projectCaliberReplacement({
    standKey: '13', referenceDate: '2026-11-13', currentCaliber: 'anon-1', openingUsedRuns: 11, size: 'D13',
    days: [
      { ...day('2027-04-01', 8, 'A', 10), size: 'D13' },
      { ...day('2027-04-02', 0, 'B', 0), size: 'D13' },
      { ...day('2027-04-03', 8, 'A', 10), size: 'D13' }
    ]
  });
  assert.equal(confirmedMax.exchangeDate, '2027-04-02');
  assert.equal(confirmedMax.exceedsOnDate, '2027-04-03');
  assert.match(confirmedMax.reason, /最大12直を超えます/);
  const maximumTons = context.projectCaliberReplacement({
    standKey: '6', referenceDate: '2026-11-13', openingUsedTons: 1000,
    days: [day('2027-04-01', 8, 'A', 10000)]
  });
  assert.equal(maximumTons.exchangeDate, null);
  assert.match(maximumTons.reason, /15直/);
  assert.match(maximumTons.reason, /19直/);
  assert.match(maximumTons.reason, /6,075t/);
  assert.match(maximumTons.reason, /7,695t/);
  assert.match(maximumTons.reason, /7,600t/);
  assert.match(maximumTons.reason, /現行最大にしません/);
  assert.equal(maximumTons.reason.includes('10000'), false);
  const roughTons = context.projectCaliberReplacement({
    standKey: '8', referenceDate: '2026-11-13', openingUsedTons: 5000
  });
  assert.equal(roughTons.exchangeDate, null);
  assert.equal(roughTons.exceedsOnDate, null);
  assert.match(roughTons.reason, /13直/);
  assert.match(roughTons.reason, /5,265t/);
  assert.match(roughTons.reason, /5,000t/);
  assert.equal(roughTons.reason.includes('超えます'), false);
  const rollGuide = context.projectCaliberReplacement({
    standKey: '4', referenceDate: '2026-11-13', openingUsedTons: 13000,
    days: [day('2027-04-01', 8, 'A', 10000)]
  });
  assert.equal(rollGuide.exchangeDate, null);
  assert.equal(rollGuide.exceedsOnDate, null);
  assert.match(rollGuide.reason, /規定37直/);
  assert.match(rollGuide.reason, /基準15,000tより前/);
  assert.match(rollGuide.reason, /0直にはしません/);
  assert.match(rollGuide.reason, /開始時は13,000t/);
  assert.equal(rollGuide.reason.includes('試算'), false);
  assert.equal(rollGuide.reason.includes('10000'), false);
  const atReference = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', openingUsedTons: 14000, openingUsedRuns: 35
  });
  assert.equal(atReference.exchangeDate, null);
  assert.match(atReference.reason, /基準14,000tに達して/);
  assert.match(atReference.reason, /規定35直に達して/);
  assert.equal(atReference.reason.includes('超えます'), false);
  const standFive = context.projectCaliberReplacement({
    standKey: '5', referenceDate: '2026-11-13', openingUsedRuns: 10
  });
  assert.match(standFive.reason, /規定31直より前/);
  assert.match(standFive.reason, /12,500t/);
  assert.match(standFive.reason, /0tにはしません/);
  const unknownTons = context.projectCaliberReplacement({ standKey: '7', referenceDate: '2026-11-13' });
  assert.match(unknownTons.reason, /15直/);
  assert.match(unknownTons.reason, /19直/);
  assert.match(unknownTons.reason, /0tにはせず/);
  const passed = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33, openingUsedTons: 12000,
    days: [day('2027-04-01', 8, 'A', 1000), day('2027-04-02', 0, 'B', 0), day('2027-04-03', 8, 'A', 1000), day('2027-04-04', 8, 'A', 1000)]
  });
  assert.equal(passed.exchangeDate, null);
  assert.equal(passed.exceedsOnDate, null);
  assert.equal(passed.shiftReachDate, '2027-04-03');
  assert.equal(passed.tonReachDate, '2027-04-03');
  assert.match(passed.reason, /規定到達の参考候補は2027-04-02/);
  assert.match(passed.reason, /トン数到達の参考候補は2027-04-02/);
  assert.equal(passed.reason.includes('超えます'), false);
  const skipped = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'skip', openingUsedRuns: 33,
    days: [day('2027-04-01', 8, 'A', 1000)]
  });
  assert.equal(skipped.shiftReachDate, null);
  assert.match(skipped.reason, /飛ばす/);
  assert.match(short.reason, /提案のまま/);
});

test('lead time defaults to provisional six months and confirmed is explicit', () => {
  const fallback = context.defaultStandLeadTime('10');
  assert.equal(fallback.standKey, '10');
  assert.equal(fallback.months, 6);
  assert.equal(fallback.status, 'provisional');
  const implied = context.normalizeStandLeadTime({ standKey: '10', months: 6 });
  assert.equal(implied.value.status, 'provisional');
  const confirmed = context.normalizeStandLeadTime({ standKey: '10', months: 9, status: 'confirmed' });
  assert.equal(confirmed.value.status, 'confirmed');
  assert.equal(confirmed.value.months, 9);
  const rejected = context.createOperatingPlanRevision({ updatedAt: '2026-11-13T00:00:00.000Z', targetMonths: ['2026-04'], rows: [{ standKey: '10', month: '2026-04', plannedUseCount: 1, actualUseCount: null, status: 'オンライン' }] });
  assert.equal(rejected.ok, false);
});
