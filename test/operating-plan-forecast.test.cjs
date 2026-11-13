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
  assert.equal(notThree.shortage, 'unknown');
  assert.equal(notThree.purchase, 'unknown');
  assert.match(notThree.reason, /3セットはロール3本のことではありません/);
  assert.equal(notThree.reason.includes('対象本数が3本'), false);
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
  assert.match(maximumTons.reason, /固定最大にはしません/);
  assert.match(maximumTons.reason, /旧参照/);
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
  assert.match(unknownTons.reason, /0直にはしません/);
  const passed = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33, openingUsedTons: 12000,
    days: [day('2027-04-01', 8, 'A', 1000), day('2027-04-02', 0, 'B', 0), day('2027-04-03', 8, 'A', 1000), day('2027-04-04', 8, 'A', 1000)]
  });
  assert.equal(passed.exchangeDate, null);
  assert.equal(passed.exceedsOnDate, null);
  assert.equal(passed.shiftReachDate, '2027-04-03');
  assert.equal(passed.tonReachDate, '2027-04-03');
  assert.match(passed.reason, /交換作業枠未確認/);
  assert.equal(passed.reason.includes('参考候補は2027-04-02'), false);
  assert.equal(passed.reason.includes('超えます'), false);
  const work = (overrides) => ({
    date: '2027-04-02', period: 'day', reservedHours: 5, workType: 'rollChange', requiredHours: 5, people: 1,
    continuous: 'no', changeover: 'yes', threeSet: 'yes', ...overrides
  });
  const schedule = [day('2027-04-01', 8, 'A', 1000), day('2027-04-02', 0, 'B', 0), day('2027-04-03', 8, 'A', 1000), day('2027-04-04', 8, 'A', 1000)];
  const confirmed = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33, openingUsedTons: 12000,
    workConfirmation: work(), days: schedule
  });
  assert.equal(confirmed.shiftReachDate, '2027-04-03');
  assert.match(confirmed.reason, /規定到達の参考候補は2027-04-02/);
  assert.match(confirmed.reason, /トン数到達の参考候補は2027-04-02/);
  const nightOnly = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33, openingUsedTons: 12000,
    workConfirmation: work({ period: 'night' }), days: schedule
  });
  assert.equal(nightOnly.referenceCandidates.length, 0);
  const shortWork = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33,
    workConfirmation: work({ reservedHours: 3, requiredHours: 5 }), days: schedule
  });
  assert.equal(shortWork.shiftReachDate, '2027-04-03');
  assert.match(shortWork.reason, /交換作業枠未確認/);
  const wrongType = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33,
    workConfirmation: work({ workType: 'caliberChange' }), days: schedule
  });
  assert.match(wrongType.reason, /交換作業枠未確認/);
  const missingThreeSet = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33,
    workConfirmation: work({ threeSet: '' }), days: schedule
  });
  assert.equal(missingThreeSet.shiftReachDate, '2027-04-03');
  assert.equal(missingThreeSet.referenceCandidates.length, 0);
  assert.match(missingThreeSet.reason, /交換作業枠未確認/);
  const missingPeople = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33,
    workConfirmation: work({ people: undefined }), days: schedule
  });
  assert.equal(missingPeople.shiftReachDate, '2027-04-03');
  assert.equal(missingPeople.referenceCandidates.length, 0);
  assert.match(missingPeople.reason, /交換作業枠未確認/);
  const current = context.projectCaliberReplacement({
    standKey: '6', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 13,
    workConfirmation: work({ workType: 'caliberChange' }), days: schedule
  });
  assert.equal(current.shiftReachDate, '2027-04-03');
  assert.equal(current.tonReachDate, null);
  assert.match(current.reason, /現行使用直数は15直/);
  assert.match(current.reason, /旧参照/);
  assert.match(current.reason, /現行到達の参考候補は2027-04-02/);
  assert.match(current.reason, /6番から9番へ広げません/);
  const conflict = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33,
    workConfirmation: work({ date: '2027-04-01' }), days: schedule
  });
  assert.equal(conflict.shiftReachDate, '2027-04-03');
  assert.equal(conflict.referenceCandidates.length, 0);
  assert.match(conflict.reason, /操業と重なる/);
  const pastWork = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'pass', openingUsedRuns: 33,
    workConfirmation: work({ date: '2026-04-02' }), days: schedule
  });
  assert.match(pastWork.reason, /基準日より前/);
  assert.equal(pastWork.referenceCandidates.length, 0);
  const caliberEffort = context.knownWorkEffort('10', 'caliberChange');
  assert.equal(caliberEffort.people, 3);
  assert.equal(caliberEffort.hours, 1);
  assert.match(caliberEffort.text, /3時間にはしません/);
  assert.equal(context.knownWorkEffort('6', 'caliberChange').hours, null);
  assert.match(current.reason, /固定最大にはしません/);
  const skipped = context.projectCaliberReplacement({
    standKey: '2', referenceDate: '2026-11-13', standPass: 'skip', openingUsedRuns: 33,
    days: [day('2027-04-01', 8, 'A', 1000)]
  });
  assert.equal(skipped.shiftReachDate, null);
  assert.match(skipped.reason, /飛ばす/);
  assert.match(short.reason, /提案のまま/);
});

test('future operation reaches remaining caliber, rework count, and spare readiness without a purchase date', () => {
  const summary = context.summarizeMonthlyProductionSchedule([
    { date: '2027-04-01', size: 'D10', productionAmount: 100, shift1Team: 'A', shift3Team: 'B', operatingHours: 8 },
    { date: '2027-04-02', size: 'D10', productionAmount: 0, shift1Team: 'A', shift3Team: '', operatingHours: 0 }
  ], '2026-11-13');
  const life = context.describeLifeChain({
    standKey: '10', size: 'D10', openingUsedRuns: 6,
    currentDiameter: 80, scrapDiameter: 70, cutMm: 4, spareCount: 0,
    schedule: summary, caliber: { exchangeDate: null, referenceCandidates: [] }
  });
  assert.match(life, /3セットはロール3本のことではありません/);
  assert.match(life, /あと2直/);
  assert.match(life, /改削残回数は2回/);
  assert.match(life, /予備は0本/);
  assert.match(life, /12か月以上の廃却需要と購入需要は判定不能/);
  assert.match(life, /暫定6か月/);
  assert.equal(life.includes('不足なしです'), false);
  const blank = context.describeLifeChain({ standKey: '10', size: 'D10', schedule: summary, caliber: {} });
  assert.match(blank, /0回にしません/);
  assert.match(blank, /開始直数が未確認/);
});

test('an anonymous cycle changes the caliber before rework and does not change the ledger', () => {
  const roles = [{ id: 'anon', status: 'オンライン' }];
  const spare = ['anon-2'];
  const slot = (date, workType) => ({
    date, period: 'day', workType, requiredHours: 5, reservedHours: 5, people: 1,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  });
  const cycle = context.simulateExchangeCycle({
    maxRuns: 8, openingRuns: 6, currentCaliberId: 'anon-1', spareCaliberIds: spare,
    currentDiameter: 80, scrapDiameter: 70, adoptedCutMm: 4, installedSpare: 0, reworkDays: 0,
    workConfirmation: slot('2027-04-03', 'caliberChange'),
    days: [
      { date: '2027-04-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-04-02', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-04-03', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' },
      { date: '2027-04-04', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' }
    ]
  });
  assert.equal(spare.length, 1);
  assert.equal(cycle.statusChanged, false);
  assert.deepEqual(roles, [{ id: 'anon', status: 'オンライン' }]);
  const change = cycle.events.find(item => item.kind === 'カリバ替');
  assert.equal(change.caliberRuns, 0);
  assert.equal(change.diameter, 80);
  const nextUse = cycle.events.find(item => item.date === '2027-04-04' && item.kind === '操業');
  assert.equal(nextUse.caliberId, 'anon-2');
  assert.equal(nextUse.caliberRuns, 1);
  const nightOnly = context.simulateExchangeCycle({
    maxRuns: 2, openingRuns: 1, currentCaliberId: 'anon-1', spareCaliberIds: ['anon-2'],
    days: [
      { date: '2027-04-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-04-02', productionAmount: 0, operatingHours: 0, shift1Team: '', shift3Team: 'B' }
    ]
  });
  assert.equal(nightOnly.events.some(item => item.kind === 'カリバ替'), false);
  assert.match(nightOnly.events.map(item => item.note).join('\n'), /夜間/);
  const shortUse = context.simulateExchangeCycle({
    maxRuns: 8, openingRuns: 0, currentCaliberId: 'anon-1', spareCaliberIds: [],
    days: [
      { date: '2027-04-01', productionAmount: 10, operatingHours: 3, shift1Team: 'A', shift3Team: '' },
      { date: '2027-04-02', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' }
    ]
  });
  assert.equal(shortUse.events.some(item => item.date === '2027-04-02'), false);
  assert.match(shortUse.events[0].note, /後続の直数は確定しません/);
  const rolls = context.simulateExchangeCycle({
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'anon-1', spareCaliberIds: [],
    currentDiameter: 80, scrapDiameter: 70, adoptedCutMm: 4, installedSpare: 1, reworkDays: 1,
    workConfirmation: slot('2027-05-02', 'rollChange'),
    days: [
      { date: '2027-05-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-03', productionAmount: 0, operatingHours: 0, shift1Team: '', shift3Team: 'B' },
      { date: '2027-05-04', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' }
    ]
  });
  const replaced = rolls.events.find(item => item.kind === 'ロール替');
  const assembled = rolls.events.find(item => item.kind === '昼間組替');
  assert.equal(replaced.installedSpare, 0);
  assert.equal(assembled.installedSpare, 1);
  assert.equal(rolls.events.some(item => item.installedSpare === 2), false);
  assert.ok(rolls.events.find(item => item.kind === '夜勤予備不足').date < assembled.date);
  const unknownCut = context.simulateExchangeCycle({
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'anon-1', spareCaliberIds: [],
    currentDiameter: 80, scrapDiameter: 70, installedSpare: 1, reworkDays: 0,
    workConfirmation: slot('2027-05-02', 'rollChange'),
    days: [
      { date: '2027-05-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' }
    ]
  });
  assert.equal(unknownCut.events.some(item => item.kind === '昼間組替'), false);
  assert.match(unknownCut.events.map(item => item.note).join('\n'), /予備へも戻しません/);
  assert.equal(unknownCut.events.some(item => item.installedSpare === 2), false);
  const blank = context.simulateExchangeCycle({ maxRuns: 8, currentCaliberId: 'anon-1', days: [] });
  assert.equal(blank.annualRollCount, null);
  assert.match(blank.reason, /0直にはしません/);
  const year = context.simulateExchangeCycle({
    maxRuns: 2, openingRuns: 0, currentCaliberId: 'anon-1', spareCaliberIds: ['anon-2'],
    currentDiameter: 80, scrapDiameter: 70, adoptedCutMm: 4, installedSpare: 1, reworkDays: 0,
    workConfirmation: {
      repeatOnStops: true, workTypes: ['caliberChange', 'rollChange'], period: 'day',
      requiredHours: 5, reservedHours: 5, people: 1, continuous: 'no', changeover: 'yes', threeSet: 'yes'
    },
    days: context.anonymousOperatingDays('2027-04-01', 400)
  });
  assert.ok(year.rollChangeCount > 1);
  assert.ok(year.scrapCount >= 1);
  assert.equal(year.annualRollCount, year.rollChangeCount);
  assert.notEqual(year.annualRollCount, 10 * 267);
  assert.match(year.reason, /新規購入の本数にはしません/);
  assert.match(year.events.find(item => item.kind === '廃却需要').note, /確定の購入日ではありません/);
});

test('different diameters stay with their own roll through rework', () => {
  const original = [
    { id: 'roll-online', frame: 'online', diameter: 81, caliberId: 'cal-1', runs: 1 },
    { id: 'roll-ready', frame: 'installedSpare', diameter: 93 },
    { id: 'roll-used', frame: 'usedSpare', diameter: 74 }
  ];
  const slot = {
    date: '2027-05-02', period: 'day', workType: 'rollChange', requiredHours: 5, reservedHours: 5, people: 1,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  };
  const once = context.simulateExchangeCycle({
    maxRuns: 1, adoptedCutMm: 4, scrapDiameter: 70, reworkDays: 0, workConfirmation: slot, resources: original,
    days: [
      { date: '2027-05-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' }
    ]
  });
  assert.deepEqual(original.map(item => item.diameter), [81, 93, 74]);
  const byId = Object.fromEntries(once.resources.map(item => [item.id, item]));
  assert.equal(byId['roll-online'].diameter, 77);
  assert.equal(byId['roll-online'].frame, 'installedSpare');
  assert.equal(byId['roll-ready'].diameter, 93);
  assert.equal(byId['roll-ready'].frame, 'online');
  assert.equal(byId['roll-used'].diameter, 74);
  assert.equal(byId['roll-used'].frame, 'usedSpare');
  assert.match(once.events.find(item => item.kind === '改削完了').note, /再生対象はroll-online/);
  const blankDiameter = context.readLedgerResources([{ id: 'plain', status: 'オンライン', currentDiameter: '' }]);
  assert.equal(blankDiameter[0].diameter, null);
  const year = context.simulateExchangeCycle({
    maxRuns: 2, adoptedCutMm: 4, scrapDiameter: 70, reworkDays: 0, resources: original.map(item => Object.assign({}, item, { runs: 0 })),
    workConfirmation: {
      repeatOnStops: true, workTypes: ['caliberChange', 'rollChange'], period: 'day',
      requiredHours: 5, reservedHours: 5, people: 1, continuous: 'no', changeover: 'yes', threeSet: 'yes'
    },
    spareCaliberIds: ['cal-2'],
    days: context.anonymousOperatingDays('2027-04-01', 400)
  });
  assert.ok(year.rollChangeCount > 1);
  assert.deepEqual(year.resources.map(item => item.id).sort(), ['roll-online', 'roll-ready', 'roll-used']);
  assert.equal(year.resources.find(item => item.id === 'roll-used').diameter, 74);
});

test('a selected stand keeps its pair and a late schedule read cannot return', () => {
  const roles = [
    { id: 's2', name: '#2-A', status: 'オンライン', currentDiameter: 50 },
    { id: 's10', name: '#10-A', status: '新品予備（組込完了）', currentDiameter: 81 },
    { id: 's11', name: '#11-B', status: 'オンライン', currentDiameter: 66 },
    { id: 's13', name: '#13-A', status: 'オンライン', currentDiameter: 40 }
  ];
  const reordered = [roles[3], roles[0], roles[2], roles[1]];
  const stand10 = context.readLedgerResources(reordered, { standKey: '10', size: 'D10' });
  assert.deepEqual(stand10.map(item => item.id), ['s11', 's10']);
  assert.equal(stand10.find(item => item.frame === 'online').id, 's11');
  assert.equal(stand10.some(item => item.diameter === 50), false);
  const only12 = context.readLedgerResources([
    { id: 'a', name: '#12-A', status: 'オンライン', currentDiameter: 1 },
    { id: 'b', name: '#13-A', status: 'オンライン', currentDiameter: 2 }
  ], { standKey: '12', size: 'D10' });
  assert.deepEqual(only12.map(item => item.id), ['a']);
  const with13 = context.readLedgerResources([
    { id: 'b', name: '#13-A', status: 'オンライン', currentDiameter: 2 },
    { id: 'a', name: '#12-A', status: 'オンライン', currentDiameter: 1 }
  ], { standKey: '12', size: 'D13' });
  assert.deepEqual(with13.map(item => item.id), ['b', 'a']);
  const eastWest = context.readLedgerResources([
    { id: 'e', name: '#17-A', status: 'オンライン', currentDiameter: 4 },
    { id: 'w', name: '#16-A', status: 'オンライン', currentDiameter: 3 }
  ], { standKey: '16', size: 'D10' });
  assert.deepEqual(eastWest.map(item => item.id), ['e', 'w']);
  const separate = context.readLedgerResources([
    { id: 'e', name: '#17-A', status: 'オンライン', currentDiameter: 4 },
    { id: 'w', name: '#16-A', status: 'オンライン', currentDiameter: 3 }
  ], { standKey: '16', size: 'D13' });
  assert.deepEqual(separate.map(item => item.id), ['w']);
  assert.equal(context.readLedgerResources(roles, { standKey: '', size: 'D10' }).length, 0);
  const first = context.beginScheduleRead();
  const second = context.beginScheduleRead();
  assert.equal(context.finishScheduleRead(first, { ok: true, months: [{ month: '2027-04' }], sourceName: 'A', days: [{}] }), false);
  assert.equal(context.currentMonthlySummary(), null);
  assert.equal(context.finishScheduleRead(second, { ok: true, months: [{ month: '2027-04' }], sourceName: 'B', days: [{}] }), true);
  assert.equal(context.currentMonthlySummary().sourceName, 'B');
  assert.equal(context.finishScheduleRead(first, null), false);
  assert.equal(context.currentMonthlySummary().sourceName, 'B');
  const cleared = context.beginScheduleRead();
  assert.equal(context.finishScheduleRead(second, { ok: true, months: [{ month: '2027-04' }], sourceName: 'A', days: [{}] }), false);
  assert.equal(context.finishScheduleRead(cleared, null), true);
  assert.equal(context.currentMonthlySummary(), null);
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
