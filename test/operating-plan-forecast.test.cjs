const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/operating-plan.js'), 'utf8');
const memoryStore = new Map();
const context = vm.createContext({
  localStorage: {
    getItem(key) { return memoryStore.has(key) ? memoryStore.get(key) : null; },
    setItem(key, value) { memoryStore.set(key, String(value)); }
  },
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
  const namedRolls = [
    { id: 'roll-a', frame: 'online', diameter: 80, caliberId: 'anon-1', runs: 1 },
    { id: 'roll-b', frame: 'installedSpare', diameter: 90, caliberId: 'anon-b', runs: 0 }
  ];
  const rolls = context.simulateExchangeCycle({
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'anon-1', spareCaliberIds: [],
    currentDiameter: 80, scrapDiameter: 70, adoptedCutMm: 4, reworkDays: 1, resources: namedRolls,
    workConfirmation: slot('2027-05-02', 'rollChange'),
    assemblyConfirmation: { date: '2027-05-04', period: 'day', requiredHours: 5, reservedHours: 5, people: 1, prepared: 'reworkInbound', preparedTarget: 'roll-a', preparedOn: '2027-04-01' },
    days: [
      { date: '2027-05-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-03', productionAmount: 0, operatingHours: 0, shift1Team: '', shift3Team: 'B' },
      { date: '2027-05-04', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' }
    ]
  });
  const replaced = rolls.events.find(item => item.kind === 'ロール替');
  const assembled = rolls.events.find(item => item.kind === '使用可能予備');
  assert.equal(replaced.installedSpare, 0);
  assert.equal(assembled.installedSpare, 1);
  assert.equal(rolls.events.some(item => item.installedSpare === 2), false);
  assert.ok(rolls.events.find(item => item.kind === '夜勤予備不足').date < assembled.date);
  const unknownCut = context.simulateExchangeCycle({
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'anon-1', spareCaliberIds: [],
    currentDiameter: 80, scrapDiameter: 70, reworkDays: 0,
    resources: namedRolls.map(item => Object.assign({}, item)),
    workConfirmation: slot('2027-05-02', 'rollChange'),
    days: [
      { date: '2027-05-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' }
    ]
  });
  assert.equal(unknownCut.events.some(item => item.kind === '組替完了'), false);
  assert.match(unknownCut.events.map(item => item.note).join('\n'), /予備へも戻しません/);
  assert.equal(unknownCut.events.some(item => item.installedSpare === 2), false);
  const blank = context.simulateExchangeCycle({ maxRuns: 8, currentCaliberId: 'anon-1', days: [] });
  assert.equal(blank.annualRollCount, null);
  assert.match(blank.reason, /0直にはしません/);
  const counted = context.simulateExchangeCycle({
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'anon-1', installedSpare: 2, reworkDays: 0,
    workConfirmation: slot('2027-05-02', 'rollChange'),
    days: [
      { date: '2027-05-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' }
    ]
  });
  assert.equal(counted.events.some(item => item.kind === 'ロール替'), false);
  assert.match(counted.events.map(item => item.note).join('\n'), /架空のIDは作りません/);
  const year = context.simulateExchangeCycle({
    maxRuns: 2, openingRuns: 0, currentCaliberId: 'anon-1', spareCaliberIds: ['anon-2'],
    scrapDiameter: 70, adoptedCutMm: 4, reworkDays: 0,
    resources: [
      { id: 'roll-a', frame: 'online', diameter: 80, caliberId: 'anon-1', runs: 0 },
      { id: 'roll-b', frame: 'installedSpare', diameter: 76, caliberId: 'anon-b', runs: 0 }
    ],
    workConfirmation: {
      repeatOnStops: true, workTypes: ['caliberChange', 'rollChange'], period: 'day',
      requiredHours: 5, reservedHours: 5, people: 1,       continuous: 'no', changeover: 'yes', threeSet: 'yes'
    },
    assemblyConfirmation: { repeatOnStops: true, period: 'day', requiredHours: 5, reservedHours: 5, people: 1, prepared: 'reworkInbound', preparedTarget: 'roll-a', preparedOn: '2027-04-01' },
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
    { id: 'roll-ready', frame: 'installedSpare', diameter: 93, caliberId: 'cal-ready', runs: 0 },
    { id: 'roll-used', frame: 'usedSpare', diameter: 74, caliberId: 'cal-used' }
  ];
  const slot = {
    date: '2027-05-02', period: 'day', workType: 'rollChange', requiredHours: 5, reservedHours: 5, people: 1,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  };
  const once = context.simulateExchangeCycle({
    maxRuns: 1, adoptedCutMm: 4, scrapDiameter: 70, reworkDays: 0, workConfirmation: slot, resources: original,
    assemblyConfirmation: { date: '2027-05-02', period: 'day', requiredHours: 5, reservedHours: 5, people: 1, prepared: 'reworkInbound', preparedTarget: 'roll-a', preparedOn: '2027-04-01' },
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
  assert.equal(once.events.find(item => item.kind === 'ロール替').caliberId, 'cal-ready');
  assert.match(once.events.find(item => item.kind === '改削完了').note, /再生対象はroll-online/);
  const missingCaliber = context.simulateExchangeCycle({
    maxRuns: 1, adoptedCutMm: 4, scrapDiameter: 70, reworkDays: 0, workConfirmation: slot,
    resources: [
      { id: 'roll-online', frame: 'online', diameter: 81, caliberId: 'cal-1', runs: 1 },
      { id: 'roll-ready', frame: 'installedSpare', diameter: 93 }
    ],
    days: [
      { date: '2027-05-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' },
      { date: '2027-05-03', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' }
    ]
  });
  assert.equal(missingCaliber.events.some(item => item.kind === 'ロール替'), false);
  assert.match(missingCaliber.events.find(item => item.kind === 'ロール替需要').note, /前のカリバは使いません/);
  assert.equal(missingCaliber.events.some(item => item.date === '2027-05-03'), false);
  assert.equal(missingCaliber.resources.find(item => item.id === 'roll-online').frame, 'online');
  assert.equal(missingCaliber.resources.find(item => item.id === 'roll-ready').frame, 'installedSpare');
  const blankDiameter = context.readLedgerResources([{ id: 'plain', status: 'オンライン', currentDiameter: '' }]);
  assert.equal(blankDiameter[0].diameter, null);
  const year = context.simulateExchangeCycle({
    maxRuns: 2, adoptedCutMm: 4, scrapDiameter: 70, reworkDays: 0, resources: original.map(item => Object.assign({}, item, { runs: 0 })),
    workConfirmation: {
      repeatOnStops: true, workTypes: ['caliberChange', 'rollChange'], period: 'day',
      requiredHours: 5, reservedHours: 5, people: 1, continuous: 'no', changeover: 'yes', threeSet: 'yes'
    },
    spareCaliberIds: ['cal-2'],
    assemblyConfirmation: { repeatOnStops: true, period: 'day', requiredHours: 5, reservedHours: 5, people: 1, prepared: 'reworkInbound', preparedTarget: 'roll-a', preparedOn: '2027-04-01' },
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

test('forecast settings stay with one roll, stand, size, and reference point', () => {
  const stand10 = { rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2026-11-01', caliberId: 'anon-10', openingRuns: 6, openingTons: '' };
  context.rememberForecastSetting(stand10);
  const restored = context.recallForecastSetting(stand10);
  assert.equal(restored.value.caliberId, 'anon-10');
  assert.equal(restored.value.openingRuns, 6);
  assert.equal(restored.value.openingTons, null);
  assert.equal(context.recallForecastSetting({ rollId: 'roll-10', standKey: '11', size: 'D10', referenceAt: '2026-11-01' }).value, null);
  assert.equal(context.recallForecastSetting({ rollId: 'roll-11', standKey: '10', size: 'D10', referenceAt: '2026-11-01' }).value, null);
  assert.equal(context.recallForecastSetting({ rollId: 'roll-10', standKey: '10', size: 'D13', referenceAt: '2026-11-01' }).value, null);
  assert.equal(context.recallForecastSetting({ rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2027-04-01' }).value, null);
  context.rememberForecastSetting({ rollId: 'roll-10', standKey: '11', size: 'D10', referenceAt: '2026-11-01', caliberId: 'anon-11', openingRuns: 3, openingTons: 12 });
  assert.equal(context.recallForecastSetting(stand10).value.caliberId, 'anon-10');
  assert.equal(context.recallForecastSetting(stand10).value.openingRuns, 6);
  assert.equal(context.recallForecastSetting({ rollId: 'roll-10', standKey: '11', size: 'D10', referenceAt: '2026-11-01' }).value.openingTons, 12);
  assert.equal(context.forecastSettingKey(stand10).includes('ロール未選択'), false);
  const dateA = { rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2026-11-01' };
  const dateB = { rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2026-12-01' };
  const dateC = { rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2027-01-01' };
  context.rememberForecastSetting(Object.assign({}, dateA, { caliberId: 'anon-A', openingRuns: 6, openingTons: '' }));
  context.rememberForecastSetting(Object.assign({}, dateB, { caliberId: 'anon-B', openingRuns: 2, openingTons: '' }));
  const toB = context.applyForecastContextChange(dateA, dateB, { caliberId: 'anon-A', openingRuns: 6, openingTons: '' });
  assert.equal(toB.value.caliberId, 'anon-B');
  assert.equal(toB.value.openingRuns, 2);
  assert.equal(context.recallForecastSetting(dateA).value.caliberId, 'anon-A');
  assert.equal(context.recallForecastSetting(dateA).value.openingRuns, 6);
  const toC = context.applyForecastContextChange(dateB, dateC, { caliberId: 'anon-B', openingRuns: 2, openingTons: '' });
  assert.equal(toC.value, null);
  assert.equal(context.recallForecastSetting(dateB).value.openingRuns, 2);
  const backToA = context.applyForecastContextChange(dateC, dateA, { caliberId: '', openingRuns: '', openingTons: '' });
  assert.equal(backToA.value.caliberId, 'anon-A');
  assert.equal(backToA.value.openingRuns, 6);
});

test('a spare roll continues from its own saved opening', () => {
  context.rememberForecastSetting({ rollId: 'roll-b', standKey: '10', size: 'D10', referenceAt: '2027-04-01', caliberId: 'cal-b', openingRuns: 2, openingTons: '' });
  const prepared = context.withSavedOpenings([
    { id: 'roll-a', frame: 'online', diameter: 81, caliberId: null, runs: null },
    { id: 'roll-b', frame: 'installedSpare', diameter: 93, caliberId: null, runs: null }
  ], '10', 'D10', '2027-04-01');
  assert.equal(prepared[0].caliberId, null);
  assert.equal(prepared[1].caliberId, 'cal-b');
  assert.equal(prepared[1].runs, 2);
  const slot = {
    date: '2027-04-02', period: 'day', workType: 'rollChange', requiredHours: 5, reservedHours: 5, people: 1,
    continuous: 'no', changeover: 'yes', threeSet: 'yes'
  };
  const days = [
    { date: '2027-04-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
    { date: '2027-04-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' },
    { date: '2027-04-03', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' }
  ];
  const changed = context.simulateExchangeCycle({
    maxRuns: 8, openingRuns: 7, currentCaliberId: 'cal-a', reworkDays: 0, workConfirmation: slot,
    resources: [
      { id: 'roll-a', frame: 'online', diameter: 81, caliberId: 'cal-a', runs: 7 },
      { id: 'roll-b', frame: 'installedSpare', diameter: 93, caliberId: 'cal-b', runs: 2 }
    ],
    days
  });
  const next = changed.events.find(item => item.date === '2027-04-03' && item.kind === '操業');
  assert.equal(next.caliberId, 'cal-b');
  assert.equal(next.caliberRuns, 3);
  const unknown = context.simulateExchangeCycle({
    maxRuns: 8, openingRuns: 7, currentCaliberId: 'cal-a', reworkDays: 0, workConfirmation: slot,
    resources: [
      { id: 'roll-a', frame: 'online', diameter: 81, caliberId: 'cal-a', runs: 7 },
      { id: 'roll-b', frame: 'installedSpare', diameter: 93, caliberId: 'cal-b', runs: null }
    ],
    days
  });
  assert.equal(unknown.events.some(item => item.kind === 'ロール替'), false);
  assert.match(unknown.events.map(item => item.note).join('\n'), /0直にはしません/);
  assert.equal(unknown.events.some(item => item.date === '2027-04-03'), false);
  assert.equal(unknown.resources.find(item => item.id === 'roll-a').frame, 'online');
  const horizon = context.simulateExchangeCycle({
    maxRuns: 8, openingRuns: 7, currentCaliberId: 'cal-a', reworkDays: 0,
    workConfirmation: Object.assign({ repeatOnStops: true, workTypes: ['rollChange'] }, slot),
    spareCaliberIds: null,
    resources: [
      { id: 'roll-a', frame: 'online', diameter: 81, caliberId: 'cal-a', runs: 7 },
      { id: 'roll-b', frame: 'installedSpare', diameter: 93, caliberId: 'cal-b', runs: 2 }
    ],
    days: context.anonymousOperatingDays('2027-04-01', 400)
  });
  assert.match(horizon.reason, /13か月の範囲まで/);
  assert.match(horizon.reason, /不足なしとは判定しません/);
  assert.match(horizon.reason, /対象期間は/);
  assert.match(horizon.reason, /確定して計算できた最終日は/);
  assert.equal(horizon.events.find(item => item.kind === 'ロール替').caliberId, 'cal-b');
  const overlapped = context.simulateExchangeCycle({
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'cal-a', reworkDays: 9, adoptedCutMm: 4, scrapDiameter: 70,
    workConfirmation: Object.assign({ repeatOnStops: true, workTypes: ['rollChange'] }, slot),
    assemblyConfirmation: { date: '2027-04-11', period: 'day', requiredHours: 5, reservedHours: 5, people: 1, prepared: 'reworkInbound', preparedTarget: 'roll-a', preparedOn: '2027-04-01' },
    resources: [
      { id: 'roll-a', frame: 'online', diameter: 80, caliberId: 'cal-a', runs: 1 },
      { id: 'roll-b', frame: 'installedSpare', diameter: 90, caliberId: 'cal-b', runs: 0 },
      { id: 'roll-c', frame: 'installedSpare', diameter: 88, caliberId: 'cal-c', runs: 0 }
    ],
    days: Array.from({ length: 13 }, (_, index) => {
      const day = index + 1;
      const stop = day === 2 || day === 4 || day === 11 || day === 13;
      return {
        date: `2027-04-${String(day).padStart(2, '0')}`,
        productionAmount: stop ? 0 : 10,
        operatingHours: stop ? 0 : 8,
        shift1Team: 'A',
        shift3Team: ''
      };
    })
  });
  assert.equal(overlapped.events.some(item => item.date === '2027-04-04' && item.kind === 'ロール替'), false);
  assert.match(overlapped.events.find(item => item.date === '2027-04-04').note, /roll-a/);
  assert.match(overlapped.events.find(item => item.date === '2027-04-04').note, /成立させません/);
  const finishedA = overlapped.events.find(item => item.kind === '改削完了' && item.note.includes('roll-a'));
  assert.equal(finishedA.date, '2027-04-11');
  assert.equal(overlapped.resources.find(item => item.id === 'roll-a').diameter, 76);
  assert.notEqual(overlapped.resources.find(item => item.id === 'roll-a').frame, 'rework');
  const earlyStop = context.anonymousOperatingDays('2027-04-01', 400);
  earlyStop[0].operatingHours = 3;
  const halted = context.simulateExchangeCycle({
    maxRuns: 8, openingRuns: 0, currentCaliberId: 'cal-a', reworkDays: 0,
    resources: [
      { id: 'roll-a', frame: 'online', diameter: 81, caliberId: 'cal-a', runs: 0 },
      { id: 'roll-b', frame: 'installedSpare', diameter: 93, caliberId: 'cal-b', runs: 2 }
    ],
    days: earlyStop
  });
  assert.equal(halted.events[0].kind, '保留');
  assert.equal(halted.events.some(item => item.date !== '2027-04-01'), false);
  assert.doesNotMatch(halted.reason, /13か月の範囲まで同じ計算を繰り返しました/);
  assert.match(halted.reason, /対象期間は2027-04-01から/);
  assert.match(halted.reason, /確定して計算できた最終日はありません/);
  assert.match(halted.reason, /2027-04-01にroll-aを止めました/);
  assert.match(halted.reason, /4時間未満/);
  const haltedText = context.describeCycleTimeline(halted);
  assert.match(haltedText, /保留/);
  assert.match(haltedText, /このあとは未確認です/);
  assert.match(haltedText, /期間全体の回数にはしません/);
  const both = context.simulateExchangeCycle({
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'cal-a', reworkDays: 9, adoptedCutMm: 4, scrapDiameter: 70,
    workConfirmation: Object.assign({ repeatOnStops: true, workTypes: ['rollChange'] }, slot),
    resources: [
      { id: 'roll-a', frame: 'online', diameter: 80, caliberId: 'cal-a', runs: 1 },
      { id: 'roll-b', frame: 'installedSpare', diameter: 90, caliberId: 'cal-b', runs: 0 },
      { id: 'roll-c', frame: 'installedSpare', diameter: 88, caliberId: 'cal-c', runs: 0 },
      { id: 'roll-d', frame: 'installedSpare', diameter: 86, caliberId: 'cal-d', runs: 0 }
    ],
    days: Array.from({ length: 11 }, (_, index) => {
      const day = index + 1;
      const stop = day === 2 || day === 4 || day === 11;
      return {
        date: `2027-04-${String(day).padStart(2, '0')}`,
        productionAmount: stop ? 0 : 10,
        operatingHours: stop ? 0 : 8,
        shift1Team: 'A',
        shift3Team: ''
      };
    })
  });
  assert.equal(both.events.filter(item => item.kind === 'ロール替' && item.date <= '2027-04-04').length, 2);
  assert.equal(both.events.some(item => item.date === '2027-04-04' && item.kind === 'ロール替需要'), false);
  assert.equal(both.events.find(item => item.kind === '改削完了' && item.note.includes('roll-a')).date, '2027-04-11');
  assert.equal(both.events.some(item => item.kind === '改削完了' && item.note.includes('roll-b')), false);
  assert.equal(both.resources.find(item => item.id === 'roll-a').diameter, 76);
  assert.equal(both.resources.find(item => item.id === 'roll-b').diameter, 90);
  assert.equal(both.resources.find(item => item.id === 'roll-b').frame, 'rework');
});

test('a zero-ton day without an assembly slot does not return a roll to spare', () => {
  const resources = () => [
    { id: 'roll-a', frame: 'online', diameter: 80, caliberId: 'cal-a', runs: 1 },
    { id: 'roll-b', frame: 'installedSpare', diameter: 90, caliberId: 'cal-b', runs: 0 }
  ];
  const days = [
    { date: '2027-04-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' },
    { date: '2027-04-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '' },
    { date: '2027-04-03', productionAmount: 0, operatingHours: 0, shift1Team: '', shift3Team: '' }
  ];
  const base = {
    maxRuns: 1, openingRuns: 1, currentCaliberId: 'cal-a', reworkDays: 1, adoptedCutMm: 4, scrapDiameter: 70,
    workConfirmation: {
      date: '2027-04-02', period: 'day', workType: 'rollChange', requiredHours: 5, reservedHours: 5, people: 1,
      continuous: 'no', changeover: 'yes', threeSet: 'yes'
    }
  };
  const bare = context.simulateExchangeCycle(Object.assign({ resources: resources(), days }, base));
  assert.equal(bare.events.some(item => item.kind === '組替完了' || item.kind === '使用可能予備'), false);
  assert.match(bare.events.map(item => `${item.kind} ${item.note}`).join('\n'), /0tだけでは完了にしません/);
  assert.notEqual(bare.resources.find(item => item.id === 'roll-a').frame, 'installedSpare');
  const crewed = days.map(row => row.date === '2027-04-03' ? Object.assign({}, row, { shift1Team: 'A' }) : row);
  const ready = { date: '2027-04-03', period: 'day', requiredHours: 5, reservedHours: 5, people: 1, prepared: 'reworkInbound', preparedTarget: 'roll-a', preparedOn: '2027-04-01' };
  const done = context.simulateExchangeCycle(Object.assign({ resources: resources(), days: crewed, assemblyConfirmation: ready }, base));
  assert.equal(done.events.some(item => item.date === '2027-04-03' && item.kind === '組替完了'), true);
  assert.equal(done.resources.find(item => item.id === 'roll-a').frame, 'installedSpare');
  const short = context.simulateExchangeCycle(Object.assign({
    resources: resources(), days: crewed, assemblyConfirmation: Object.assign({}, ready, { reservedHours: 1 })
  }, base));
  assert.equal(short.events.some(item => item.kind === '組替完了'), false);
  assert.match(short.events.map(item => item.note).join('\n'), /確保時間が足りません/);
  const cleared = context.simulateExchangeCycle(Object.assign({
    resources: resources(), days: crewed, assemblyConfirmation: { period: 'day', prepared: 'reworkInbound', preparedTarget: 'roll-a', preparedOn: '2027-04-01', requiredHours: 5, reservedHours: 5, people: 1 }
  }, base));
  assert.equal(cleared.events.some(item => item.kind === '組替完了'), false);
  const unprepared = context.simulateExchangeCycle(Object.assign({
    resources: resources(), days: crewed, assemblyConfirmation: Object.assign({}, ready, { prepared: 'no' })
  }, base));
  assert.equal(unprepared.events.some(item => item.kind === '使用可能予備'), false);
  assert.match(unprepared.events.map(item => item.note).join('\n'), /発注や改削見込日数だけでは準備にしません/);
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

test('anonymous check keeps normal inputs out of memory, storage, and equipment specs', () => {
  const fields = {};
  const field = id => {
    if (!fields[id]) fields[id] = { value: '', textContent: '', dataset: {} };
    return fields[id];
  };
  const previousDocument = context.document;
  const writes = [];
  const originalSet = context.localStorage.setItem;
  context.localStorage.setItem = (key, value) => {
    writes.push(key);
    originalSet.call(context.localStorage, key, value);
  };
  const fetches = [];
  context.fetch = async () => {
    fetches.push('stand-premises');
    return { ok: true, json: async () => ({ diametersMm: { '10': { newDiameter: 999, scrapDiameter: 111 } } }) };
  };
  context.document = { readyState: 'complete', getElementById: field, addEventListener() {} };
  field('forecast-roll').value = 'real-roll';
  field('caliber-current').value = 'real-caliber';
  field('caliber-opening').value = '6';
  field('caliber-opening-tons').value = '50';
  field('caliber-stand').value = '10';
  field('caliber-size').value = 'D10';
  field('forecast-reference').value = '2026-11-01';
  context.syncForecastSettingContext();
  context.syncForecastSettingContext();
  const normal = JSON.parse(context.localStorage.getItem('caliber_forecast_settings_v1'));
  assert.equal(normal['real-roll|10|D10|2026-11-01'].caliberId, 'real-caliber');
  assert.equal(normal['real-roll|10|D10|2026-11-01'].openingRuns, 6);
  writes.length = 0;
  fetches.length = 0;
  context.finishScheduleRead(context.beginScheduleRead(), { ok: true, sourceName: 'real-file.xlsx', days: [], months: [] });
  context.startAnonymousForecastCheck();
  const text = field('cycle-result').textContent;
  assert.equal(text.includes('real-caliber'), false);
  assert.equal(text.includes('real-roll'), false);
  assert.equal(text.includes('real-file'), false);
  assert.equal(text.includes('999'), false);
  assert.match(text, /anon-online/);
  assert.match(text, /anon-cal-b/);
  assert.match(text, /開始2/);
  assert.match(text, /組替需要/);
  assert.match(text, /試験用の匿名予定/);
  field('work-date').value = '2027-04-02';
  field('assembly-prepared-target').value = 'anon-online';
  context.syncForecastSettingContext();
  context.applyAnonymousScene('ready');
  assert.match(field('cycle-result').textContent, /組替完了/);
  context.applyAnonymousScene('clear');
  assert.equal(field('cycle-result').textContent.includes('組替完了'), false);
  context.applyAnonymousScene('short');
  assert.match(field('cycle-result').textContent, /確保時間が足りません/);
  assert.deepEqual(writes, []);
  assert.deepEqual(fetches, []);
  assert.equal(context.localStorage.getItem('caliber_forecast_settings_anon_v1'), null);
  assert.equal(context.localStorage.getItem('roles'), null);
  const kept = JSON.parse(context.localStorage.getItem('caliber_forecast_settings_v1'));
  assert.equal(kept['real-roll|10|D10|2026-11-01'].caliberId, 'real-caliber');
  assert.equal(kept['real-roll|10|D10|2026-11-01'].openingRuns, 6);
  context.localStorage.setItem = originalSet;
  context.document = previousDocument;
  context.anonymousForecastCheck = false;
  context.fetch = undefined;
});

test('a schedule read that finishes after anonymous start does not replace the anonymous result', () => {
  const inflight = context.beginScheduleRead();
  context.latestMonthlySummary = null;
  context.startAnonymousForecastCheck();
  assert.equal(context.finishScheduleRead(inflight, { ok: true, sourceName: 'late-real.xlsx', months: [{ month: '2027-04' }], days: [{ date: '2027-04-01', productionAmount: 10 }] }), false);
  assert.equal(context.finishScheduleRead(inflight, null), false);
  assert.equal(context.currentMonthlySummary().sourceName, '試験用の匿名予定');
  assert.equal(JSON.stringify(context.currentMonthlySummary()).includes('late-real'), false);
});

test('anonymous examples show a shortage, a return, and an unknown stop', () => {
  const fields = {};
  const field = id => {
    if (!fields[id]) fields[id] = { value: '', textContent: '', dataset: {} };
    return fields[id];
  };
  const previousDocument = context.document;
  context.document = { readyState: 'complete', getElementById: field, addEventListener() {} };
  context.startAnonymousForecastCheck();
  context.applyAnonymousExample('short');
  const shortText = field('cycle-result').textContent;
  assert.match(shortText, /試験用の不足予定/);
  assert.match(shortText, /夜勤の開始時点で使用可能な予備が無い日は2027-04-03/);
  assert.match(shortText, /廃却による補充需要は2027-04-03/);
  assert.match(shortText, /この読込予定の補充需要は廃却した対象ごとです/);
  assert.match(shortText, /anon-online/);
  assert.match(shortText, /条件付きの手配目安/);
  assert.match(shortText, /確定の購入日ではありません/);
  assert.match(shortText, /仮の13か月シナリオです/);
  context.applyAnonymousExample('ready');
  const readyText = field('cycle-result').textContent;
  assert.match(readyText, /試験用の間に合う予定/);
  assert.match(readyText, /この読込予定では、昼の組替のあと予備へ戻しています/);
  assert.match(readyText, /使用可能予備/);
  assert.match(readyText, /不足なしの確定ではありません/);
  context.applyAnonymousExample('unknown');
  const unknownText = field('cycle-result').textContent;
  assert.match(unknownText, /試験用の未確認予定/);
  assert.match(unknownText, /この読込予定では、3つの運用枠をいつまで保てるかは未確認です/);
  assert.match(unknownText, /4時間未満/);
  assert.match(unknownText, /最終日はありません/);
  assert.match(unknownText, /仮の13か月は読込予定の未確認は埋めていません|読込予定の未確認は埋めていません/);
  context.document = previousDocument;
});

test('a producing night with no usable spare is reported and later unknowns keep that date', () => {
  const resources = [
    { id: 'anon-online', frame: 'online', caliberId: 'anon-cal-a', runs: 7, diameter: 81 },
    { id: 'anon-spare', frame: 'installedSpare', caliberId: 'anon-cal-b', runs: 2, diameter: 93 },
    { id: 'anon-used', frame: 'usedSpare', caliberId: 'anon-cal-c', runs: 0, diameter: 74 }
  ];
  const work = { date: '2027-04-02', period: 'day', reservedHours: 5, workType: 'rollChange', requiredHours: 5, people: 1, continuous: 'no', changeover: 'yes', threeSet: 'yes' };
  const day = (date, amount, hours, shift1, shift3) => ({ date, productionAmount: amount, operatingHours: hours, shift1Team: shift1, shift3Team: shift3 });
  const producing = context.simulateExchangeCycle({
    maxRuns: 8, reworkDays: 30, scrapDiameter: 70, adoptedCutMm: 4, leadMonths: 6, leadStatus: 'provisional',
    workConfirmation: work, resources: resources.map(item => Object.assign({}, item)),
    days: [day('2027-04-01', 10, 8, 'A', ''), day('2027-04-02', 0, 0, 'A', ''), day('2027-04-03', 10, 8, '', 'B')]
  });
  assert.equal(producing.events.some(item => item.date === '2027-04-03' && item.kind === '夜勤予備不足'), true);
  assert.equal(producing.events.some(item => item.date === '2027-04-03' && item.kind === '操業'), true);
  const producingText = context.describeSetOutlook(producing, 'この読込予定では');
  assert.match(producingText, /無い日は2027-04-03/);
  assert.match(producingText, /操業中はanon-spare/);
  assert.equal(producingText.includes('足りなくなる日は出ていません'), false);
  const hidden = context.simulateExchangeCycle({
    maxRuns: 8, reworkDays: 1, scrapDiameter: 70, adoptedCutMm: 4, leadMonths: 6, leadStatus: 'provisional',
    workConfirmation: work, resources: resources.map(item => Object.assign({}, item)),
    days: [day('2027-04-01', 10, 8, 'A', ''), day('2027-04-02', 0, 0, 'A', ''), day('2027-04-03', 0, 0, '', 'B'), day('2027-04-04', 10, 3, 'A', '')]
  });
  const hiddenText = context.describeSetOutlook(hidden, 'この読込予定では');
  assert.match(hiddenText, /無い日は2027-04-03/);
  assert.match(hiddenText, /いつまで保てるかは未確認です/);
  assert.match(hiddenText, /それより前に出た不足は残します/);
  const separate = context.simulateExchangeCycle({
    maxRuns: 8, reworkDays: 1, scrapDiameter: 77, adoptedCutMm: 4, leadMonths: 6, leadStatus: 'provisional',
    workConfirmation: work, resources: resources.map(item => Object.assign({}, item)),
    days: [day('2027-04-01', 10, 8, 'A', ''), day('2027-04-02', 0, 0, 'A', ''), day('2027-04-03', 0, 0, 'A', ''), day('2027-04-05', 10, 8, '', 'B')]
  });
  const separateText = context.describeSetOutlook(separate, 'この読込予定では');
  assert.match(separateText, /補充需要は2027-04-03/);
  assert.match(separateText, /対象はanon-online/);
  assert.match(separateText, /無い日は2027-04-05/);
  assert.match(separateText, /操業中はanon-spare/);
  assert.match(context.describeReplenishment(separate, 'この読込予定の補充需要'), /対象はanon-online/);
  assert.match(context.describeReplenishment(separate, 'この読込予定の補充需要'), /トン数やロール替の回数からは出しません/);
});

test('the latest plan lists each stand without inventing days or copying another stand', () => {
  const premises = { status: 'loaded', data: { diametersMm: { '10': { scrapDiameter: 292 }, '17': { scrapDiameter: 292, adoptedCutMm: 2.5 } } } };
  const rolls = [
    { id: 'roll-10', name: '#10-A', status: 'オンライン' },
    { id: 'roll-17', name: '#17-A', status: 'オンライン', currentCaliber: 'cal-17', openingRuns: 1, currentDiameter: 300 }
  ];
  const first = { id: 'plan-a', updatedAt: '2026-11-01T00:00:00.000Z', targetMonths: ['2027-04'], rows: [{ standKey: '10', month: '2027-04', plannedUseCount: 1, actualUseCount: null }] };
  const monthly = context.buildStandDemandList({ plan: first, rolls, premises });
  assert.match(monthly, /本数の版はplan-a/);
  assert.match(monthly, /操業日は作っていません/);
  assert.match(monthly, /roll-10: 現在のカリバは未記録です/);
  assert.match(monthly, /開始直数は未記録です/);
  assert.match(monthly, /17番の2\.5mmは使いません/);
  assert.equal(monthly.includes('2027-04-01'), false);
  const second = { id: 'plan-b', updatedAt: '2026-12-01T00:00:00.000Z', targetMonths: ['2027-05'], rows: [{ standKey: '17', month: '2027-05', plannedUseCount: 1, actualUseCount: null }] };
  const replaced = context.buildStandDemandList({ plan: second, rolls, premises, days: [{ date: '2027-04-02', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' }] });
  assert.match(replaced, /本数の版はplan-b/);
  assert.equal(replaced.includes('plan-a'), false);
  assert.match(replaced, /対象月の外の日付1件/);
  assert.match(replaced, /操業日は作っていません/);
  const daily = context.buildStandDemandList({
    plan: { id: 'plan-days', updatedAt: '2027-04-01T00:00:00.000Z', targetMonths: ['2027-04'], rows: [{ standKey: '17', month: '2027-04', plannedUseCount: 1, actualUseCount: null }] },
    rolls: rolls.concat([{ id: 'roll-17b', name: '#17-B', status: '新品予備（組込完了）', currentCaliber: 'cal-17b', openingRuns: 0, currentDiameter: 310 }]),
    premises,
    size: 'D10',
    reworkDays: 1,
    workConfirmation: { date: '2027-04-02', period: 'day', reservedHours: 5, workType: 'rollChange', requiredHours: 5, people: 1, continuous: 'no', changeover: 'yes', threeSet: 'yes' },
    days: [
      { date: '2027-04-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '', size: 'D10' },
      { date: '2027-04-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '', size: 'D10' }
    ]
  });
  assert.match(daily, /日付の予定は2日あります/);
  assert.match(daily, /roll-10/);
  assert.match(daily, /現在のカリバは未記録です/);
  assert.match(daily, /対象期間は2027-04-01から2027-04-02です/);
  assert.match(daily, /#10[\s\S]*17番の2\.5mmは使いません/);
  assert.match(daily, /計算できた範囲に廃却はありません/);
});

test('saved openings stay on their own stand and a replaced schedule drops the old dates', () => {
  context.rememberForecastSetting({ rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2027-04-01', caliberId: 'cal-A10', openingRuns: 7 });
  context.rememberForecastSetting({ rollId: 'roll-10b', standKey: '10', size: 'D10', referenceAt: '2027-04-01', caliberId: 'cal-B10', openingRuns: 2 });
  const rolls = [
    { id: 'roll-10', name: '#10-A', status: 'オンライン', currentDiameter: 81 },
    { id: 'roll-10b', name: '#10-B', status: '新品予備（組込完了）', currentDiameter: 90 },
    { id: 'roll-17', name: '#17-A', status: 'オンライン', currentCaliber: 'cal-17', openingRuns: 5, currentDiameter: 81 },
    { id: 'roll-17b', name: '#17-B', status: '新品予備（組込完了）', currentCaliber: 'cal-17b', openingRuns: 0, currentDiameter: 90 }
  ];
  const premises = { status: 'loaded', data: { diametersMm: { '10': { scrapDiameter: 77, adoptedCutMm: 4 }, '17': { scrapDiameter: 77, adoptedCutMm: 4 } } } };
  const days = [
    { date: '2027-04-01', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '', size: 'D10' },
    { date: '2027-04-02', productionAmount: 0, operatingHours: 0, shift1Team: 'A', shift3Team: '', size: 'D10' }
  ];
  const listed = context.buildStandDemandList({
    scheduleName: 'schedule-a', referenceAt: '2027-04-01', standKey: '10', size: 'D10', reworkDays: 1,
    workConfirmation: { date: '2027-04-02', period: 'day', reservedHours: 5, workType: 'rollChange', requiredHours: 5, people: 1, continuous: 'no', changeover: 'yes', threeSet: 'yes', owner: { standKey: '10', rollId: 'roll-10', size: 'D10', referenceAt: '2027-04-01' } },
    rolls, days, premises
  });
  assert.match(listed, /読込予定はschedule-a/);
  assert.match(listed, /roll-10: 保存した開始条件です。基準日2027-04-01、サイズD10。台帳には書いていません。/);
  const stand17 = listed.slice(listed.indexOf('#17'));
  assert.equal(stand17.includes('廃却需要'), false);
  assert.match(stand17, /作業枠はこのスタンドに確認されていません/);
  const otherReference = context.buildStandDemandList({
    scheduleName: 'schedule-may', referenceAt: '2027-05-01', standKey: '10', size: 'D10', rolls: [rolls[0]], days, premises
  });
  assert.match(otherReference, /現在のカリバは未記録です/);
  assert.equal(otherReference.includes('cal-A10'), false);
  const cleared = context.buildStandDemandList({ rolls, days: [], premises });
  assert.equal(cleared.includes('schedule-a'), false);
  assert.equal(cleared.includes('2027-04-02'), false);
  const replaced = context.buildStandDemandList({
    scheduleName: 'schedule-b', referenceAt: '2027-04-01', standKey: '10', size: 'D10', rolls, premises,
    days: [{ date: '2027-04-01', productionAmount: 10, operatingHours: 3, shift1Team: 'A', shift3Team: '', size: 'D10' }]
  });
  assert.match(replaced, /読込予定はschedule-b/);
  assert.equal(replaced.includes('schedule-a'), false);
  assert.equal(replaced.includes('廃却需要'), false);
  const otherRoll = context.buildStandDemandList({
    scheduleName: 'schedule-a', referenceAt: '2027-04-01', scheduleReference: '2027-04-01', standKey: '10', size: 'D10', reworkDays: 1,
    workConfirmation: { date: '2027-04-02', period: 'day', reservedHours: 5, workType: 'rollChange', requiredHours: 5, people: 1, continuous: 'no', changeover: 'yes', threeSet: 'yes', owner: { standKey: '10', rollId: 'roll-10b', size: 'D10', referenceAt: '2027-04-01' } },
    rolls, days, premises
  });
  const stand10 = otherRoll.slice(otherRoll.indexOf('#10'), otherRoll.indexOf('#17'));
  assert.match(stand10, /ロールroll-10b/);
  assert.match(stand10, /付け直していません/);
  assert.equal(stand10.includes('廃却需要'), false);
});

test('screen reference and slot owner follow the input events', () => {
  context.setAnonymousForecastCheck(false);
  const fields = {};
  const field = id => {
    if (!fields[id]) {
      fields[id] = {
        value: '',
        textContent: '',
        dataset: {},
        listeners: [],
        addEventListener(type, fn) { if (type === 'change') this.listeners.push(fn); },
        dispatchEvent() { this.listeners.forEach(fn => fn()); }
      };
    }
    return fields[id];
  };
  const fire = (id, value) => {
    field(id).value = value;
    field(id).dispatchEvent();
  };
  context.document = {
    documentElement: { dataset: {} },
    body: { dataset: {} },
    readyState: 'complete',
    getElementById: field,
    addEventListener() {}
  };
  context.roles = [
    { id: 'roll-10', name: '#10-A', status: 'オンライン', currentDiameter: 81 },
    { id: 'roll-10b', name: '#10-B', status: '新品予備（組込完了）', currentDiameter: 90 },
    { id: 'roll-17', name: '#17-A', status: 'オンライン', currentCaliber: 'cal-17', openingRuns: 5, currentDiameter: 81 },
    { id: 'roll-17b', name: '#17-B', status: '新品予備（組込完了）', currentCaliber: 'cal-17b', openingRuns: 0, currentDiameter: 90 }
  ];
  context.bindMonthlyScheduleFileInput();
  context.rememberForecastSetting({ rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2027-04-01', caliberId: 'cal-A10', openingRuns: 7 });
  context.rememberForecastSetting({ rollId: 'roll-10', standKey: '10', size: 'D10', referenceAt: '2027-04-03', caliberId: 'cal-A10', openingRuns: 1 });
  context.rememberForecastSetting({ rollId: 'roll-10', standKey: '10', size: 'D13', referenceAt: '2027-04-01', caliberId: 'cal-D13', openingRuns: 0 });
  field('caliber-stand').value = '10';
  field('caliber-size').value = 'D10';
  field('forecast-roll').value = 'roll-10';
  field('forecast-reference').value = '2027-04-01';
  field('caliber-current').value = 'cal-A10';
  field('caliber-opening').value = '7';
  ['work-period', 'work-reserved-hours', 'work-type', 'work-required-hours', 'work-people', 'work-continuous', 'work-changeover', 'work-three-set'].forEach((id, index) => {
    field(id).value = ['day', '5', 'rollChange', '5', '1', 'no', 'yes', 'yes'][index];
  });
  fire('work-date', '2027-04-03');
  const day = (date, amount, hours) => ({ date, productionAmount: amount, operatingHours: hours, shift1Team: 'A', shift3Team: '', size: 'D10' });
  context.renderMonthlyScheduleSummary({
    ok: true, sourceName: 'schedule-file', referenceDate: '2027-04-01',
    months: [{ month: '2027-04', classification: 'future', productionTons: null, operatingHours: null, sizes: ['D10'], shifts: ['A'] }],
    days: [day('2027-04-01', 10, 8), day('2027-04-02', 10, 8), day('2027-04-03', 0, 0)],
    reason: '試験用です。'
  });
  fire('forecast-reference', '2027-04-03');
  const later = field('stand-demand-list').textContent;
  const laterCycle = field('cycle-result').textContent;
  assert.match(later, /予測の基準日は2027-04-03/);
  assert.match(later, /予定資料の基準日は2027-04-01/);
  assert.match(later, /基準日より前の操業2日は開始量へ足していません/);
  assert.match(later, /付け直していません/);
  assert.equal(laterCycle.includes('2027-04-01 操業'), false);
  fire('forecast-reference', '2027-04-01');
  const back = `${field('stand-demand-list').textContent}\n${field('cycle-result').textContent}`;
  assert.match(back, /予測の基準日は2027-04-01/);
  assert.match(back, /2027-04-01 操業/);
  fire('forecast-roll', 'roll-10b');
  fire('work-date', '2027-04-03');
  fire('forecast-roll', 'roll-10');
  const switchedRoll = field('stand-demand-list').textContent;
  const stand10 = switchedRoll.slice(switchedRoll.indexOf('#10'), switchedRoll.indexOf('#17'));
  assert.match(stand10, /ロールroll-10b/);
  assert.equal(stand10.includes('廃却需要'), false);
  fire('forecast-roll', 'roll-10');
  fire('work-date', '2027-04-03');
  fire('caliber-stand', '17');
  const otherStand = field('stand-demand-list').textContent;
  const stand17 = otherStand.slice(otherStand.indexOf('#17'));
  assert.match(stand17, /作業枠はこのスタンドに確認されていません/);
  assert.match(stand17, /10番/);
  assert.equal(stand17.includes('廃却需要'), false);
  fire('caliber-stand', '10');
  fire('caliber-size', 'D13');
  const otherSize = field('stand-demand-list').textContent;
  assert.match(otherSize, /付け直していません/);
  assert.match(otherSize, /サイズD13/);
  assert.equal(otherSize.includes('cal-A10'), false);
  fire('work-date', '');
  fire('forecast-reference', '');
  fire('forecast-roll', '');
  fire('caliber-size', 'D10');
  fire('caliber-stand', '10');
});
