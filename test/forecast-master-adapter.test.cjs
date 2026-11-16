const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function api(extra = {}) {
  const context = vm.createContext({ document: { readyState: 'loading', addEventListener() {} }, ...extra });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/operating-plan.js'), 'utf8'), context);
  return context;
}
const local = { status: 'loaded', data: { diametersMm: { '10': { scrapDiameter: 50, adoptedCutMm: 4 } } } };
const loaded = { stand: { stand: '10', newDiameter: 99, scrapDiameter: 70 }, cutting: { stand: '10', calculationCutMm: 12, standardCutMm: 4, actualAverageCutMm: 2, active: true } };
function scenario(masters = loaded) {
  return {
    scheduleName: 'anonymous.xlsx', referenceAt: '2027-04-01', standKey: '10', size: 'D10', premises: local,
    mastersByStand: { '10': masters }, reworkDays: 0,
    workConfirmation: { date: '2027-04-02', period: 'day', workType: 'rollChange', requiredHours: 6, reservedHours: 6, people: 3, continuous: 'no', changeover: 'yes', threeSet: 'yes', owner: { standKey: '10', rollId: 'A', size: 'D10', referenceAt: '2027-04-01' } },
    rolls: [
      { id: 'A', name: '#10-A', status: 'オンライン', currentDiameter: 81, currentCaliber: 'ca', openingRuns: 7 },
      { id: 'B', name: '#10-B', status: '新品予備（組込完了）', currentDiameter: 93, currentCaliber: 'cb', openingRuns: 2 }
    ],
    days: [{ date: '2027-04-01', size: 'D10', productionAmount: 10, operatingHours: 8, shift1Team: 'A' }, { date: '2027-04-02', size: 'D10', productionAmount: 0, operatingHours: 0, shift1Team: 'A' }]
  };
}

test('the adopted calculation cut and scrap diameter from loaded masters reach the real cycle', () => {
  const c = api();
  const fact = c.premisesFact(local, '10', loaded);
  assert.equal(fact.scrapDiameter, 70);
  assert.equal(fact.adoptedCutMm, 12);
  const result = c.buildStandDemandList(scenario());
  assert.match(result, /2027-04-02 対象はAです。廃却径以下/);
  assert.match(result, /廃却径は取得済みStandMaster/);
  assert.match(result, /採用改削量は取得済み改削マスタの計算用改削量/);
  assert.equal(c.buildStandDemandList(scenario({})).includes('対象はAです。廃却径以下'), false);
  const stopped = scenario();
  stopped.days[1].size = '休止';
  assert.match(c.buildStandDemandList(stopped), /2027-04-02 対象はAです。廃却径以下/);
});

test('blank, invalid or inactive calculation cuts never fall back to an average or standard', () => {
  const c = api();
  for (const value of ['', ' ', null, 0, -1, 'invalid']) {
    const fact = c.premisesFact(local, '10', { ...loaded, cutting: { ...loaded.cutting, calculationCutMm: value } });
    assert.equal(fact.adoptedCutMm, null);
    assert.match(fact.cutReason, /標準値や実績平均では埋めません/);
  }
  const fact = c.premisesFact(local, '10', { ...loaded, cutting: { ...loaded.cutting, active: false } });
  assert.equal(fact.adoptedCutMm, null);
  assert.match(fact.cutReason, /無効/);
  const emptyLocal = c.premisesFact({ status: 'loaded', data: { diametersMm: { '10': { scrapDiameter: ' ', adoptedCutMm: 4 } } } }, '10');
  assert.equal(emptyLocal.scrapDiameter, null);
  assert.match(emptyLocal.diameterReason, /未記録/);
});

test('other stands and new diameters do not fill this roll current measurement', () => {
  const c = api();
  const wrong = c.premisesFact(local, '10', { stand: { ...loaded.stand, stand: '17' }, cutting: { ...loaded.cutting, stand: '17' } });
  assert.equal(wrong.scrapDiameter, null);
  assert.equal(wrong.adoptedCutMm, null);
  assert.match(wrong.diameterReason, /一致しない/);
  const input = scenario();
  delete input.rolls[0].currentDiameter;
  const result = c.buildStandDemandList(input);
  assert.match(result, /現在径は未記録です/);
  assert.equal(result.includes('対象はAです。廃却径以下'), false);
});

test('reading already loaded maps does not fetch and anonymous mode never calls master getters', () => {
  let getterCalls = 0;
  const c = api({ getStandMaster: () => { getterCalls++; return loaded.stand; }, getCuttingMaster: () => { getterCalls++; return loaded.cutting; }, fetch() { throw Error('unexpected remote fetch'); } });
  assert.equal(c.loadedForecastMasters('10').cutting.calculationCutMm, 12);
  assert.equal(getterCalls, 2);
  vm.runInContext('anonymousForecastCheck = true', c);
  assert.equal(Object.keys(c.loadedForecastMasters('10')).length, 0);
  assert.equal(getterCalls, 2);
});

test('a mixed-size horizon keeps known demand before the transition and holds the rest', () => {
  const c = api();
  const input = scenario();
  input.days.push({ date: '2027-04-03', size: 'D13', productionAmount: 10, operatingHours: 8, shift1Team: 'A' });
  const result = c.buildStandDemandList(input);
  assert.match(result, /選択中の1サイズには丸めません/);
  assert.match(result, /2027-04-02 対象はAです。廃却径以下/);
  assert.match(result, /2027-04-03にBを止めました/);
  assert.match(result, /サイズがD10からD13/);
  assert.match(result, /対象B: サイズがD10からD13/);
});

test('a size transition keeps the current resource id and does not consume later operation', () => {
  const c = api();
  const input = scenario();
  input.days.push({ date: '2027-04-03', size: 'D13', productionAmount: 10, operatingHours: 8, shift1Team: 'A' });
  input.days.push({ date: '2027-04-04', size: 'D10', productionAmount: 10, operatingHours: 8, shift1Team: 'A' });
  const resources = c.readLedgerResources(input.rolls);
  const result = c.simulateExchangeCycle({ currentSize: 'D10', maxRuns: 8, resources, adoptedCutMm: 12, scrapDiameter: 70, reworkDays: 0, workConfirmation: input.workConfirmation, days: input.days.slice().reverse() });
  assert.equal(result.confirmedThrough, '2027-04-02');
  assert.equal(result.stopRecord.id, 'B');
  assert.equal(result.stopRecord.fromSize, 'D10');
  assert.equal(result.stopRecord.toSize, 'D13');
  assert.equal(result.events.some(item => item.date === '2027-04-04'), false);
  assert.equal(result.events.filter(item => item.kind === '操業').length, 1);
  assert.equal(result.resources.find(item => item.id === 'B').runs, 2);
  assert.equal(input.rolls[0].currentDiameter, 81);
});

test('a different first productive size stops before adding anything to the saved opening', () => {
  const c = api();
  const input = scenario();
  const result = c.simulateExchangeCycle({ currentSize: 'D13', maxRuns: 8, resources: c.readLedgerResources(input.rolls), days: input.days });
  assert.equal(result.confirmedThrough, null);
  assert.equal(result.stopRecord.date, '2027-04-01');
  assert.equal(result.stopRecord.id, 'A');
  assert.equal(result.events.some(item => item.kind === '操業'), false);
});

test('detail and list resolve the same loaded master while explicit trial inputs stay labelled', () => {
  const c = api({ getStandMaster: () => loaded.stand, getCuttingMaster: () => loaded.cutting });
  const resolved = c.resolvedLifePremises({ standKey: '10' });
  assert.equal(resolved.scrapDiameter, 70);
  assert.equal(resolved.cutMm, 12);
  const trial = c.resolvedLifePremises({ standKey: '10', scrapDiameter: 60, cutMm: 3 });
  assert.equal(trial.scrapDiameter, 60);
  assert.equal(trial.cutMm, 3);
  assert.match(trial.masterSourceNote, /画面入力の試算/);
});

function sizeCycle(c) {
  const input = scenario();
  input.rolls[0].openingRuns = 6;
  const owner = { rollId: 'A', standKey: '10', size: 'D10', referenceAt: input.referenceAt };
  const change = (fromSize, toSize, date, operationDate) => ({ ...input.workConfirmation, workType: 'sizeChange', fromSize, toSize, date, operationDate, owner: { ...owner, size: fromSize } });
  input.days.push({ date: '2027-04-03', size: 'D13', productionAmount: 10, operatingHours: 8, shift1Team: 'A' });
  input.days.push({ date: '2027-04-04', size: 'D13', productionAmount: 0, operatingHours: 0, shift1Team: 'A' });
  input.days.push({ date: '2027-04-05', size: 'D10', productionAmount: 10, operatingHours: 8, shift1Team: 'A' });
  return { ...input, currentSize: 'D10', maxRuns: 8, resources: c.readLedgerResources(input.rolls),
    sizeOpenings: [{ owner: { ...owner, size: 'D13' }, caliberId: 'a13', runs: 2 }],
    sizeChanges: [change('D10', 'D13', '2027-04-02', '2027-04-03'), change('D13', 'D10', '2027-04-04', '2027-04-05')] };
}

test('verified size changes use their own openings and keep consumed runs when the size returns', () => {
  const c = api();
  const input = sizeCycle(c);
  const original = JSON.stringify(input);
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.stopRecord, null);
  assert.equal(result.confirmedThrough, '2027-04-05');
  assert.deepEqual(Array.from(result.events.filter(e => e.kind === '操業'), e => [e.date, e.caliberId, e.caliberRuns]), [
    ['2027-04-01', 'ca', 7], ['2027-04-03', 'a13', 3], ['2027-04-05', 'ca', 8]
  ]);
  assert.equal(result.events.filter(e => e.kind === 'サイズ替').length, 2);
  assert.equal(result.resources.find(r => r.id === 'A').diameter, 81);
  assert.equal(JSON.stringify(input), original);
});

test('a next-size opening must belong to the exact roll, stand, size and reference', () => {
  const c = api();
  for (const patch of [{ rollId: 'B' }, { standKey: '17' }, { size: 'D10' }, { referenceAt: '2027-04-02' }]) {
    const input = sizeCycle(c);
    Object.assign(input.sizeOpenings[0].owner, patch);
    const result = c.simulateExchangeCycle(input);
    assert.equal(result.stopRecord.date, '2027-04-03');
    assert.equal(result.stopRecord.id, 'A');
    assert.equal(result.events.some(e => e.caliberId === 'a13'), false);
  }
  for (const runs of [undefined, null, '', -1, NaN, 0.5, 8]) {
    const input = sizeCycle(c);
    input.sizeOpenings[0].runs = runs;
    assert.equal(c.simulateExchangeCycle(input).stopRecord.date, '2027-04-03');
  }
});

test('a size-change slot needs a preceding daytime stop and its own confirmed scope', () => {
  const c = api();
  const changes = [
    slot => { slot.period = 'night'; }, slot => { slot.reservedHours = 1; }, slot => { slot.people = undefined; },
    slot => { slot.continuous = 'yes'; }, slot => { slot.threeSet = ''; }, slot => { slot.changeover = 'no'; },
    slot => { slot.workType = 'rollChange'; }, slot => { slot.date = '2027-04-03'; },
    slot => { slot.owner.rollId = 'B'; }, slot => { slot.owner.referenceAt = '2027-04-02'; }
  ];
  for (const change of changes) {
    const input = sizeCycle(c);
    change(input.sizeChanges[0]);
    assert.equal(c.simulateExchangeCycle(input).stopRecord.date, '2027-04-03');
  }
  for (const patch of [{ shift1Team: '', shift3Team: 'A' }, { shift1Team: '', shift3Team: '' }, { productionAmount: 10, operatingHours: 8 }]) {
    const input = sizeCycle(c);
    Object.assign(input.days[1], patch);
    assert.equal(c.simulateExchangeCycle(input).stopRecord.date, '2027-04-03');
  }
  const duplicated = sizeCycle(c);
  duplicated.sizeChanges.push(structuredClone(duplicated.sizeChanges[0]));
  assert.equal(c.simulateExchangeCycle(duplicated).stopRecord.date, '2027-04-03');
});

test('zero is a valid next-size opening but an unconfirmed short operation still stops the suffix', () => {
  const c = api();
  const input = sizeCycle(c);
  input.sizeOpenings[0].runs = 0;
  input.days[2].operatingHours = 3;
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.stopRecord.date, '2027-04-03');
  assert.match(result.stopRecord.reason, /4時間未満/);
  assert.equal(result.events.some(e => e.date === '2027-04-05'), false);
  assert.equal(result.events.find(e => e.kind === 'サイズ替').caliberRuns, 0);
});

test('a slot already used for a roll change cannot also certify a size change', () => {
  const c = api();
  const input = sizeCycle(c);
  input.resources[0].runs = 7;
  input.adoptedCutMm = 12;
  input.scrapDiameter = 70;
  input.sizeChanges[0].owner.rollId = 'B';
  input.sizeOpenings[0].owner.rollId = 'B';
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.stopRecord.date, '2027-04-03');
  assert.equal(result.stopRecord.id, 'B');
  assert.equal(result.events.filter(e => e.kind === 'ロール替').length, 1);
  assert.equal(result.events.filter(e => e.kind === 'サイズ替').length, 0);
  assert.equal(result.scrapCount, 1);
});

test('the opening adapter only reads explicit saved size conditions and never borrows the ledger caliber', () => {
  const memory = {};
  const c = api({ localStorage: { getItem: key => memory[key] || null, setItem: (key, value) => { memory[key] = value; } } });
  const input = sizeCycle(c);
  c.rememberForecastSetting({ rollId: 'A', standKey: '10', size: 'D13', referenceAt: input.referenceAt, caliberId: 'saved13', openingRuns: 0 });
  const openings = c.forecastSizeOpenings(input.resources, '10', input.days, input.referenceAt);
  assert.equal(openings.length, 1);
  assert.equal(openings[0].caliberId, 'saved13');
  assert.equal(openings[0].runs, 0);
  assert.equal(c.forecastSizeOpenings(input.resources, '10', input.days, '2027-04-02').length, 0);
  const result = c.buildStandDemandList({ ...input, sizeOpenings: openings });
  assert.match(result, /確定して計算できた最終日は2027-04-05/);
});

test('a zero-ton new-size night stops before night calculations and preserves earlier real demand', () => {
  const c = api();
  const input = scenario();
  input.days.push(
    { date: '2027-04-03', size: 'D10', productionAmount: 10, operatingHours: 8, shift3Team: 'A' },
    { date: '2027-04-04', size: 'D13', productionAmount: 0, operatingHours: 0, shift3Team: 'A' },
    { date: '2027-04-05', size: 'D13', productionAmount: 10, operatingHours: 8, shift1Team: 'A' }
  );
  const result = c.simulateExchangeCycle({ ...input, standKey: '10', currentSize: 'D10', maxRuns: 8,
    resources: c.readLedgerResources(input.rolls), scrapDiameter: 70, adoptedCutMm: 12 });
  assert.equal(result.stopRecord.date, '2027-04-04');
  assert.equal(result.stopRecord.id, 'B');
  assert.equal(result.confirmedThrough, '2027-04-03');
  assert.equal(result.scrapCount, 1);
  assert.deepEqual(Array.from(result.events.filter(e => e.kind === '夜勤予備不足'), e => e.date), ['2027-04-03']);
  assert.equal(result.events.some(e => e.date === '2027-04-05'), false);
});

test('an explicit new size on a stopped day can continue only with the matching daytime slot and opening', () => {
  const c = api();
  const input = sizeCycle(c);
  input.days[1].size = 'D13';
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.stopRecord, null);
  assert.equal(result.events.find(e => e.kind === 'サイズ替').date, '2027-04-02');
  assert.equal(result.events.find(e => e.date === '2027-04-03' && e.kind === '操業').caliberRuns, 3);
  input.sizeChanges = [];
  assert.equal(c.simulateExchangeCycle(input).stopRecord.date, '2027-04-02');
  input.sizeChanges = sizeCycle(c).sizeChanges;
  input.resources[0].runs = 7;
  assert.equal(c.simulateExchangeCycle(input).stopRecord.date, '2027-04-02');
});

test('a usual guide for the next size never substitutes for its unconfirmed maximum', () => {
  const c = api();
  const input = sizeCycle(c);
  input.standKey = '13';
  input.currentSize = 'D13';
  input.maxRuns = 12;
  input.days = input.days.slice(0, 3).map(row => ({ ...row, size: row.date === '2027-04-03' ? 'D10' : 'D13' }));
  input.sizeChanges = [{ ...input.sizeChanges[0], fromSize: 'D13', toSize: 'D10', owner: { rollId: 'A', standKey: '13', size: 'D13', referenceAt: input.referenceAt } }];
  input.sizeOpenings = [{ owner: { rollId: 'A', standKey: '13', size: 'D10', referenceAt: input.referenceAt }, caliberId: 'a10', runs: 0 }];
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.stopRecord.date, '2027-04-03');
  assert.match(result.stopRecord.reason, /次サイズの確定最大は未確認/);
});

function laterCycle(c) {
  const input = sizeCycle(c);
  const owner = { rollId: 'A', standKey: '10', size: 'D13', referenceAt: input.referenceAt };
  input.sizeOpenings[0].runs = 7;
  input.sizeOpenings.push({ owner: { ...owner, rollId: 'B' }, caliberId: 'b13', runs: 2 });
  input.sizeChanges = input.sizeChanges.slice(0, 1);
  input.days = input.days.slice(0, 4).concat([
    { date: '2027-04-05', size: 'D13', productionAmount: 0, operatingHours: 0, shift1Team: 'A' },
    { date: '2027-04-06', size: 'D13', productionAmount: 10, operatingHours: 8, shift3Team: 'A' }
  ]);
  input.workSlots = [{ ...input.workConfirmation, owner: { ...owner }, date: '2027-04-04' }];
  input.assemblySlots = [{ owner: { ...owner }, date: '2027-04-05', period: 'day', reservedHours: 6, requiredHours: 6,
    people: 3, prepared: 'reworkInbound', preparedTarget: 'A', preparedOn: '2027-04-05' }];
  return { ...input, reworkDays: 1, adoptedCutMm: 4, scrapDiameter: 70 };
}

test('later scoped exchange and assembly frames complete the post-size cycle before the night', () => {
  const c = api();
  const input = laterCycle(c);
  const original = JSON.stringify(input);
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.stopRecord, null);
  assert.equal(result.confirmedThrough, '2027-04-06');
  const swap = result.events.find(e => e.kind === 'ロール替');
  assert.equal(swap.date, '2027-04-04');
  assert.equal(swap.onlineId, 'B');
  assert.equal(swap.caliberId, 'b13');
  assert.equal(swap.caliberRuns, 2);
  assert.equal(result.resources.find(r => r.id === 'A').diameter, 77);
  assert.equal(result.resources.find(r => r.id === 'A').frame, 'installedSpare');
  assert.equal(result.resources.find(r => r.id === 'B').diameter, 93);
  assert.equal(result.events.filter(e => e.kind === '使用可能予備').length, 1);
  assert.equal(result.events.some(e => e.kind === '夜勤予備不足'), false);
  assert.equal(result.events.find(e => e.date === '2027-04-06' && e.kind === '操業').caliberRuns, 3);
  assert.equal(JSON.stringify(input), original);
});

test('later exchange frames cannot borrow another owner, size, reference, day or short frame', () => {
  const c = api();
  for (const patch of [{ rollId: 'B' }, { standKey: '17' }, { size: 'D10' }, { referenceAt: '2027-04-02' }]) {
    const input = laterCycle(c);
    Object.assign(input.workSlots[0].owner, patch);
    const result = c.simulateExchangeCycle(input);
    assert.equal(result.stopRecord.date, '2027-04-04');
    assert.equal(result.stopRecord.id, 'A');
    assert.equal(result.events.some(e => e.date > '2027-04-04'), false);
  }
  for (const patch of [{ date: '2027-04-03' }, { reservedHours: 1 }, { people: 0 }, { threeSet: '' }, { workType: 'caliberChange' }, { period: 'night' }]) {
    const input = laterCycle(c);
    Object.assign(input.workSlots[0], patch);
    assert.equal(c.simulateExchangeCycle(input).stopRecord.date, '2027-04-04');
  }
  const input = laterCycle(c);
  input.workSlots = [];
  assert.equal(c.simulateExchangeCycle(input).stopRecord.date, '2027-04-04');
  const noShift = laterCycle(c);
  noShift.days[3].shift1Team = '';
  assert.equal(c.simulateExchangeCycle(noShift).stopRecord.date, '2027-04-04');
});

test('later assembly returns only its own waiting roll and unconfirmed frames keep night shortage', () => {
  const c = api();
  for (const patch of [{ rollId: 'B' }, { standKey: '17' }, { size: 'D10' }, { referenceAt: '2027-04-02' }]) {
    const input = laterCycle(c);
    Object.assign(input.assemblySlots[0].owner, patch);
    const result = c.simulateExchangeCycle(input);
    assert.equal(result.events.some(e => e.kind === '使用可能予備'), false);
    assert.equal(result.events.find(e => e.kind === '夜勤予備不足').date, '2027-04-06');
    assert.equal(result.resources.find(r => r.id === 'A').frame, 'rework');
  }
  for (const patch of [{ period: 'night' }, { reservedHours: 1 }, { people: undefined }, { prepared: '' }, { preparedOn: '2027-04-07' }]) {
    const input = laterCycle(c);
    Object.assign(input.assemblySlots[0], patch);
    const result = c.simulateExchangeCycle(input);
    assert.equal(result.events.some(e => e.kind === '使用可能予備'), false);
    assert.equal(result.events.find(e => e.kind === '夜勤予備不足').date, '2027-04-06');
  }
  const input = laterCycle(c);
  input.assemblySlots = [];
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.events.some(e => e.kind === '使用可能予備'), false);
  assert.equal(result.events.find(e => e.kind === '夜勤予備不足').onlineId, 'B');
  const duplicated = laterCycle(c);
  duplicated.assemblySlots.push(structuredClone(duplicated.assemblySlots[0]));
  assert.equal(c.simulateExchangeCycle(duplicated).events.some(e => e.kind === '使用可能予備'), false);
});

test('an invalid opening for the entering size does not become extra lifetime', () => {
  const c = api();
  for (const runs of [-1, 0.5, null, 8]) {
    const input = laterCycle(c);
    input.sizeOpenings[1].runs = runs;
    const result = c.simulateExchangeCycle(input);
    assert.equal(result.stopRecord.date, '2027-04-04');
    assert.equal(result.stopRecord.id, 'A');
    assert.equal(result.events.some(e => e.kind === 'ロール替'), false);
  }
  const input = laterCycle(c);
  input.days[0].productionAmount = -1;
  const result = c.simulateExchangeCycle(input);
  assert.equal(result.stopRecord.date, '2027-04-01');
  assert.equal(result.confirmedThrough, null);
  assert.equal(result.events.some(e => e.kind === '操業'), false);
});

test('the timeline excerpt keeps the final operation after intervening assembly events', () => {
  const c = api();
  const result = c.simulateExchangeCycle(laterCycle(c));
  const original = JSON.stringify(result);
  const text = c.describeCycleTimeline(result);
  assert.match(text, /2027-04-05 組替完了/);
  assert.match(text, /2027-04-06 操業 b13の使用は3直/);
  assert.match(text, /最後に計算できた操業は2027-04-06、対象B、カリバb13、3直/);
  assert.equal(JSON.stringify(result), original);
});

test('the final confirmed operation and first hold survive a long bounded excerpt', () => {
  const c = api();
  const events = Array.from({ length: 20 }, (_, i) => ({ date: `2027-04-${String(i + 1).padStart(2, '0')}`, kind: '組替需要', note: '未確認', onlineId: 'A' }));
  events.push({ date: '2027-04-21', kind: '操業', note: 'later-calの使用は3直です。', onlineId: 'B', caliberId: 'later-cal', caliberRuns: 3 });
  events.push({ date: '2027-04-22', kind: '保留', note: '以後未確認', onlineId: 'B' });
  const text = c.describeCycleTimeline({ events, confirmedThrough: '2027-04-21', rollChangeCount: 1 });
  assert.match(text, /2027-04-21 操業/);
  assert.match(text, /2027-04-22 保留/);
  assert.match(text, /表示は抜粋14件/);
  assert.equal(text.indexOf('2027-04-21 操業') < text.indexOf('2027-04-22 保留'), true);
  assert.match(c.describeCycleTimeline({ events: [events.at(-1)], rollChangeCount: 0 }), /計算できた操業はありません/);
});

function twoCycle(c, openings) {
  const owner = rollId => ({ rollId, standKey: '10', size: 'D10', referenceAt: '2027-04-01' });
  const work = (date, rollId) => ({ date, period: 'day', workType: 'rollChange', requiredHours: 6, reservedHours: 6,
    people: 3, continuous: 'no', changeover: 'yes', threeSet: 'yes', owner: owner(rollId) });
  const assembly = (date, rollId) => ({ owner: owner(rollId), date, period: 'day', requiredHours: 6, reservedHours: 6,
    people: 3, prepared: 'reworkInbound', preparedTarget: rollId, preparedOn: date });
  const day = (date, amount) => ({ date, size: 'D10', productionAmount: amount, operatingHours: amount ? 8 : 0, shift1Team: 'A', shift3Team: '' });
  const days = [day('2027-04-01', 10), day('2027-04-02', 0), day('2027-04-03', 0)];
  for (let index = 4; index <= 11; index += 1) days.push(day(`2027-04-${String(index).padStart(2, '0')}`, index === 10 || index === 11 ? 0 : 10));
  return {
    standKey: '10', currentSize: 'D10', referenceAt: '2027-04-01', maxRuns: 8, reworkDays: 1,
    adoptedCutMm: 4, scrapDiameter: 50,
    resources: [
      { id: 'A', frame: 'online', caliberId: 'ca', runs: 7, diameter: 81 },
      { id: 'B', frame: 'installedSpare', caliberId: 'cb', runs: 2, diameter: 93 }
    ],
    days,
    workSlots: [work('2027-04-02', 'A'), work('2027-04-10', 'B')],
    assemblySlots: [assembly('2027-04-03', 'A'), assembly('2027-04-11', 'B')],
    reworkOpenings: openings
  };
}

test('a reworked roll restarts every defined caliber at zero and keeps two repair cycles', () => {
  const c = api();
  const result = c.simulateExchangeCycle(twoCycle(c, []));
  assert.equal(result.stopRecord, null);
  assert.equal(result.events.filter(e => e.kind === 'ロール替').length, 2);
  assert.equal(result.events.filter(e => e.kind === '組替完了').length, 2);
  const returned = result.events.filter(e => e.kind === 'ロール替')[1];
  assert.equal(returned.date, '2027-04-10');
  assert.equal(returned.onlineId, 'A');
  assert.equal(returned.caliberId, 'ca');
  assert.equal(returned.caliberRuns, 0);
  assert.equal(result.resources.find(r => r.id === 'A').diameter, 77);
  assert.equal(result.resources.find(r => r.id === 'A').caliberId, 'ca');
  assert.equal(result.resources.find(r => r.id === 'A').runs, 0);
});

test('an undefined or unusable post-rework caliber does not copy the old runs or invent an id', () => {
  const c = api();
  const owner = { rollId: 'A', standKey: '10', size: 'D10', referenceAt: '2027-04-01' };
  const restarted = c.simulateExchangeCycle(twoCycle(c, [{ owner, generation: 1, caliberId: 'ca2', runs: 7 }]));
  assert.equal(restarted.stopRecord, null);
  assert.equal(restarted.events.filter(e => e.kind === 'ロール替')[1].caliberId, 'ca');
  assert.equal(restarted.events.filter(e => e.kind === 'ロール替')[1].caliberRuns, 0);
  const blocked = twoCycle(c, []);
  blocked.unusableCalibers = [{ owner, generation: 1, caliberId: 'ca', usable: false }];
  const stopped = c.simulateExchangeCycle(blocked);
  assert.equal(stopped.stopRecord.date, '2027-04-10');
  assert.equal(stopped.stopRecord.id, 'A');
  assert.match(stopped.reason, /使用不可/);
  assert.match(stopped.reason, /不足なしとは判定しません/);
  assert.equal(stopped.events.filter(e => e.kind === 'ロール替').length, 1);
  assert.equal(stopped.resources.find(r => r.id === 'A').caliberId, 'ca');
  assert.equal(stopped.resources.find(r => r.id === 'A').runs, 7);
  assert.equal(stopped.resources.find(r => r.id === 'A').frame, 'installedSpare');
  const foreign = twoCycle(c, []);
  foreign.unusableCalibers = [{ owner: { ...owner, standKey: '17' }, generation: 1, caliberId: 'ca', usable: false }];
  const ignored = c.simulateExchangeCycle(foreign);
  assert.equal(ignored.stopRecord, null);
  assert.equal(ignored.events.filter(e => e.kind === 'ロール替')[1].caliberRuns, 0);
});

test('a fiscal year outlook keeps the 405 ton basis and does not invent dates', () => {
  const c = api();
  assert.equal(c.provisionalReworkCalendarDays('2'), 20);
  assert.equal(c.provisionalReworkCalendarDays('9'), 20);
  assert.equal(c.provisionalReworkCalendarDays('10'), 30);
  assert.equal(c.provisionalReworkCalendarDays('15'), 30);
  assert.equal(c.provisionalReworkCalendarDays('16'), 60);
  assert.equal(c.provisionalReworkCalendarDays('17'), 60);
  assert.equal(c.provisionalReworkCalendarDays('1'), null);
  assert.equal(c.addDays('2027-04-02', 20), '2027-04-22');
  const text = c.buildFiscalOutlook({
    referenceAt: '2027-01-15',
    standKey: '10',
    months: [{ month: '2026-05', productionTons: 810, sizes: ['D10'] }],
    reworkLeadDays: { '14': 21 },
    installedSpareCount: 0
  });
  assert.match(text, /年度は2026-04から2027-03/);
  assert.match(text, /2026-04 暫定 10000t/);
  assert.match(text, /未確定月の暫定値です。10000tも35:65も確定データではありません/);
  assert.match(text, /2026-05 確定月 810t。D10 810t/);
  assert.match(text, /暫定の35:65は使いません/);
  assert.match(text, /変更前の計算根拠は暫定10000t、1直405tで24直/);
  assert.match(text, /変更後の計算根拠は確定810t、1直405tで2直/);
  assert.match(text, /確定値で置換した月は2026-05だけ/);
  assert.match(text, /2026-06 暫定 10000t/);
  assert.match(text, /変更前の年間直数は暫定10000t×12か月、1直405tで288直/);
  assert.match(text, /変更後の年間直数は266直/);
  assert.match(text, /後続の改削需要は計算し直しましたが、直数の差を改削の本数と日付にはしません/);
  assert.match(text, /後続の購入需要も計算し直しましたが、直数の差を購入本数と購入日にはしません/);
  assert.match(text, /パスラインは未確認/);
  assert.match(text, /#14 改削LT 21暦日（個別の暫定値/);
  assert.match(text, /#10 改削LT 30暦日（初期の暫定値/);
  assert.match(text, /搬入日は作りません/);
  assert.match(text, /購買データは未照合/);
  assert.match(text, /暫定6か月/);
  assert.match(text, /不足なしとは判定しません/);
  assert.match(text, /3セット運用枠の早期警告: 現在の組込済み予備は0/);
  assert.match(text, /将来の戻り日は作らず未確認/);
  assert.match(text, /将来の補充日は作らず未確認/);
  assert.equal(text.includes('2026-05-01'), false);
  assert.equal(text.includes('不足なし。'), false);
  const dated = c.buildFiscalOutlook({
    referenceAt: '2027-01-15',
    standKey: '10',
    installedSpareCount: 0,
    reworkDepartureOn: '2026-05-02',
    purchaseOrderedOn: '2026-05-02'
  });
  assert.match(dated, /戻り見込みは2026-06-01/);
  assert.match(dated, /確定の搬入日ではなく/);
  assert.match(dated, /補充の確定日にはしません/);
  const unknown = c.buildFiscalOutlook({ referenceAt: '2027-01-15' });
  assert.match(unknown, /現在の組込済み予備は未確認/);
  assert.match(unknown, /安全確定しません/);
  assert.equal(unknown.includes('早期警告'), false);
  assert.equal(c.buildFiscalOutlook({}).includes('基準日が無い'), true);
  const created = c.createMonthlyProductionDraft(2027);
  assert.equal(created.ok, true);
  assert.equal(created.draft.months[0].month, '2027-04');
  assert.equal(created.draft.months[11].month, '2028-03');
  assert.equal(created.draft.months.every(item => item.classification === 'provisional'), true);
  const may = c.updateMonthlyProductionMonth(created.draft, '2027-05', { classification: 'confirmed', productionTons: 810, size: 'D10' });
  const sealed = c.sealMonthlyProductionPlan(may.draft, '2027-04-30');
  may.draft.months[1].productionTons = 1;
  assert.equal(sealed.plan.months.find(item => item.month === '2027-05').productionTons, 810);
  assert.equal(c.updateMonthlyProductionMonth(sealed.plan, '2027-05', { classification: 'confirmed', productionTons: 1 }).ok, false);
  const revised = c.reviseMonthlyProductionPlan(sealed.plan);
  const june = c.updateMonthlyProductionMonth(revised.draft, '2027-06', { classification: 'confirmed', productionTons: 405 });
  assert.equal(sealed.plan.months.find(item => item.month === '2027-06').classification, 'provisional');
  assert.equal(c.updateMonthlyProductionMonth(june.draft, '2027-03', { classification: 'confirmed', productionTons: 1 }).ok, false);
  const row = c.addShiftBasisRow(june.draft, { standKey: '#10', size: 'D10', caliberId: 'ca', from: '2027-05-01', to: '2027-05-02', tons: 810, passLine: '仮' });
  assert.equal(row.row.shifts, 2);
  assert.equal(row.row.cumulativeShifts, 2);
  assert.equal(row.row.passLine, '未確認');
  assert.match(row.row.process, /810t ÷ 1直405t = 2直/);
  const next = c.addShiftBasisRow(row.draft, { standKey: '10', size: 'D10', caliberId: 'ca', from: '2027-05-03', to: '2027-05-03', tons: 405 });
  assert.equal(next.row.cumulativeShifts, 3);
  assert.equal(c.addShiftBasisRow(next.draft, { standKey: '10', size: 'D10', caliberId: 'ca', from: '2027-05-04', to: '2027-05-04' }).ok, false);
  assert.match(c.describeOutputFormSurvey(), /原本のセル配置は確定していません/);
  assert.match(c.describeOutputFormSurvey(), /正式な指示書の原本は未入手です/);
  const memory = { roles: '[]', operating_plan_revisions_v1: '[]' };
  const store = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
    setItem(key, value) {
      if (store.quota) { const error = new Error('full'); error.name = 'QuotaExceededError'; throw error; }
      memory[key] = String(value);
    }
  };
  const other = { getItem() { return null; }, setItem() { throw new Error('other device'); } };
  assert.equal(c.writeMonthlyProductionHistory(store, [sealed.plan], june.draft).ok, true);
  assert.equal(memory.roles, '[]');
  assert.equal(memory.operating_plan_revisions_v1, '[]');
  const restored = c.readMonthlyProductionHistory(store);
  assert.equal(restored.sealed[0].months.find(item => item.month === '2027-05').productionTons, 810);
  restored.sealed[0].months.find(item => item.month === '2027-05').productionTons = 1;
  const reread = c.readMonthlyProductionHistory(store);
  assert.equal(reread.sealed[0].months.find(item => item.month === '2027-05').productionTons, 810);
  assert.equal(reread.draft.id, 'prod-2027-04-v1');
  assert.match(c.buildFiscalOutlook({ referenceAt: '2027-05-01', months: c.outlookMonthsFromPlan(reread.draft, []), standKey: '10' }), /2027-06 確定月 405t/);
  assert.equal(c.readMonthlyProductionHistory(other).empty, true);
  store.setItem('monthly_production_plan_history_v1', '{');
  assert.match(c.readMonthlyProductionHistory(store).reason, /壊れています/);
  store.quota = true;
  const failed = c.writeMonthlyProductionHistory(store, [sealed.plan], null);
  assert.match(failed.reason, /容量/);
  assert.equal(store.getItem('monthly_production_plan_history_v1'), '{');
  assert.match(c.describeMonthlyProductionStore(), /別の端末や別のブラウザとは共有しません/);
});

test('a monthly production history file restores into another browser without touching normal keys', () => {
  const c = api();
  const box = () => {
    const data = { roles: '[]', operating_plan_revisions_v1: 'keep' };
    return {
      data,
      fail: false,
      getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
      setItem(key, value) {
        if (this.fail === true || this.fail === key) { const error = new Error('full'); error.name = 'QuotaExceededError'; throw error; }
        data[key] = String(value);
      },
      removeItem(key) { delete data[key]; }
    };
  };
  const may = c.updateMonthlyProductionMonth(c.createMonthlyProductionDraft(2027).draft, '2027-05', { classification: 'confirmed', productionTons: 810, size: 'D10' });
  const sealed = c.sealMonthlyProductionPlan(may.draft, '2027-04-30');
  const otherYear = c.sealMonthlyProductionPlan(c.updateMonthlyProductionMonth(c.createMonthlyProductionDraft(2026).draft, '2026-05', { classification: 'confirmed', productionTons: 405, size: 'D10' }).draft, '2026-04-30');
  const oneTon = c.sealMonthlyProductionPlan(c.updateMonthlyProductionMonth(c.createMonthlyProductionDraft(2027).draft, '2027-05', { classification: 'confirmed', productionTons: 1, size: 'D10' }).draft, '2027-04-30');
  const exported = c.buildMonthlyProductionExport([sealed.plan], may.draft, '2027-04-30T00:00:00.000Z');
  assert.equal(exported.file.sourceKey, 'monthly_production_plan_history_v1');
  assert.equal(exported.file.history.draft, null);
  assert.equal(JSON.stringify(exported.file).includes('operating_plan_revisions_v1'), false);
  const phone = box();
  const desktop = box();
  assert.equal(c.applyMonthlyProductionImport(phone, exported.file, {}).applied, false);
  assert.equal(c.applyMonthlyProductionImport(phone, exported.file, { confirmed: true }).added, 1);
  assert.equal(c.applyMonthlyProductionImport(desktop, exported.file, { confirmed: true }).added, 1);
  assert.equal(c.readMonthlyProductionHistory(desktop).sealed[0].months.find(item => item.month === '2027-05').productionTons, 810);
  assert.equal(phone.data.roles, '[]');
  assert.equal(phone.data.operating_plan_revisions_v1, 'keep');
  const again = c.applyMonthlyProductionImport(phone, exported.file, { confirmed: true });
  assert.equal(again.added, 0);
  assert.equal(c.readMonthlyProductionHistory(phone).sealed.length, 1);
  const conflict = c.buildMonthlyProductionExport([oneTon.plan], null, '2027-04-30T00:00:00.000Z');
  const beforeConflict = phone.data.monthly_production_plan_history_v1;
  assert.match(c.applyMonthlyProductionImport(phone, conflict.file, { confirmed: true }).reason, /上書きしません/);
  assert.equal(phone.data.monthly_production_plan_history_v1, beforeConflict);
  const yearFile = c.buildMonthlyProductionExport([otherYear.plan], null, '2026-04-30T00:00:00.000Z');
  assert.equal(c.applyMonthlyProductionImport(phone, yearFile.file, { confirmed: true }).added, 1);
  assert.equal(c.undoMonthlyProductionImport(phone, { confirmed: true }).applied, true);
  const restored = c.readMonthlyProductionHistory(phone);
  assert.equal(restored.sealed.some(item => item.fiscalStart === '2026-04'), false);
  assert.equal(restored.sealed[0].months.find(item => item.month === '2027-05').productionTons, 810);
  phone.fail = 'monthly_production_plan_history_v1';
  const snapshot = phone.data.monthly_production_plan_history_v1;
  assert.match(c.applyMonthlyProductionImport(phone, yearFile.file, { confirmed: true }).reason, /反映していません/);
  assert.equal(phone.data.monthly_production_plan_history_v1, snapshot);
  assert.match(c.previewMonthlyProductionImport({ kind: 'roll-app-offline-recovery', version: 1, roles: [] }, { ok: true, sealed: [] }).reason, /ロールの復旧ファイルとは別/);
  phone.fail = false;
  phone.setItem('monthly_production_plan_history_v1', '{');
  assert.match(c.readMonthlyProductionHistory(phone).reason, /壊れています/);
});

test('used spare calibers are not restarted from the first one', () => {
  const c = api();
  const work = { date: '2027-04-02', period: 'day', repeatOnStops: true, workTypes: ['caliberChange', 'rollChange'],
    requiredHours: 6, reservedHours: 6, people: 3, continuous: 'no', changeover: 'yes', threeSet: 'yes' };
  const day = (date, amount) => ({ date, size: 'D10', productionAmount: amount, operatingHours: amount ? 8 : 0, shift1Team: 'A', shift3Team: '' });
  const result = c.simulateExchangeCycle({
    standKey: '10', currentSize: 'D10', maxRuns: 2, reworkDays: 1, spareCaliberIds: ['c2'], workConfirmation: work,
    resources: [{ id: 'A', frame: 'online', caliberId: 'c1', runs: 1, diameter: 80 }],
    days: [day('2027-04-01', 10), day('2027-04-02', 0), day('2027-04-03', 10), day('2027-04-04', 10), day('2027-04-05', 0)]
  });
  assert.equal(result.events.filter(e => e.kind === 'カリバ替').length, 1);
  assert.equal(result.events.filter(e => e.kind === 'カリバ替')[0].caliberId, 'c2');
  assert.equal(result.events.filter(e => e.kind === 'ロール替需要').length, 1);
  assert.equal(result.events.some(e => e.kind === 'ロール替'), false);
});

test('a supplied anonymous horizon can pass thirteen months and a stopped return stays short of that claim', () => {
  const c = api();
  const days = [];
  for (let index = 0; index < 400; index += 1) {
    const date = new Date(Date.UTC(2027, 3, 1 + index)).toISOString().slice(0, 10);
    days.push({ date, size: 'D10', productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '' });
  }
  const full = c.simulateExchangeCycle({
    standKey: '10', currentSize: 'D10', maxRuns: 500, openingRuns: 0, currentCaliberId: 'c', days,
    resources: [{ id: 'A', frame: 'online', caliberId: 'c', runs: 0, diameter: 80 }]
  });
  assert.match(full.reason, /13か月の範囲まで同じ計算を繰り返しました/);
  assert.match(full.reason, /不足なしとは判定しません/);
  const blocked = twoCycle(c, []);
  blocked.unusableCalibers = [{ owner: { rollId: 'A', standKey: '10', size: 'D10', referenceAt: '2027-04-01' }, generation: 1, caliberId: 'ca', usable: false }];
  const stopped = c.simulateExchangeCycle(blocked);
  assert.equal(stopped.confirmedThrough < '2027-04-11', true);
  assert.match(stopped.reason, /対象期間は2027-04-01から2027-04-11です/);
  assert.match(stopped.reason, /確定して計算できた最終日は2027-04-09です/);
});

test('stands 16 and 17 use two columns only for D10', () => {
  const c = api();
  const rolls = [
    { id: 'p16', name: '#16-1', status: 'オンライン', currentDiameter: 80, currentCaliber: 'a', openingRuns: 1 },
    { id: 'p17', name: '#17-1', status: '新品予備（組込完了）', currentDiameter: 90, currentCaliber: 'b', openingRuns: 2 }
  ];
  assert.equal(c.pairedStandKeys('16', 'D10').join(','), '16,17');
  assert.equal(c.pairedStandKeys('17', 'Ｄ１０').join(','), '16,17');
  assert.equal(c.rollingColumnRule('16', 'D10').columns, 2);
  assert.equal(c.pairedStandKeys('16', 'D13').join(','), '16');
  assert.equal(c.pairedStandKeys('17', 'D13').join(','), '17');
  assert.equal(c.rollingColumnRule('16', 'D13').columns, 1);
  assert.match(c.rollingColumnRule('17', 'D13').text, /D10の2列圧延は適用しません/);
  assert.equal(c.pairedStandKeys('16', '').join(','), '16');
  const d10 = c.readLedgerResources(rolls, { standKey: '16', size: 'D10' }).map(item => item.id).join(',');
  const d13 = c.readLedgerResources(rolls, { standKey: '16', size: 'D13' }).map(item => item.id).join(',');
  assert.equal(d10, 'p16,p17');
  assert.equal(d13, 'p16');
  assert.equal(c.knownCaliberLimit('16', 'D10').runs, 13);
  assert.equal(c.knownCaliberLimit('16', 'D13').runs, 14);
  assert.equal(c.knownCaliberLimit('17', 'D10').runs, 6);
  assert.equal(c.knownCaliberLimit('17', 'D13').runs, 6);
  const saved = c.recordCaliberLayoutNote({ standKey: '16', size: 'D10', rollId: 'anon-16', side: 'WS', positionNumber: '3', plannedShifts: '3', from: '2027-04-01', to: '2027-04-02' });
  assert.equal(saved.ok, true);
  assert.equal(saved.sameToken, true);
  assert.equal(saved.note.columns, 2);
  assert.equal(saved.note.passLine, '未確認');
  assert.equal(saved.note.positionNumber, '3');
  assert.equal(saved.note.plannedShifts, 3);
  const rejected = c.recordCaliberLayoutNote({ standKey: '16', size: 'D13', rollId: 'anon-16', columns: '2', positionNumber: '4', plannedShifts: '8' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /反映していません/);
  const single = c.recordCaliberLayoutNote({ standKey: '17', size: 'D13', rollId: 'anon-17', side: 'DS', positionNumber: '4', plannedShifts: '8' });
  assert.equal(single.ok, true);
  assert.equal(single.note.columns, 1);
  const text = c.describeCaliberLayoutNotes();
  assert.match(text, /カリバ番号3/);
  assert.match(text, /使用予定3直/);
  assert.match(text, /#17 D13/);
  assert.match(text, /2列圧延は適用しない/);
  assert.match(text, /パスライン未確認/);
  assert.match(text, /実績としては入れていません/);
  assert.match(c.describeOutputFormSurvey(), /2025年度の過去数値は現在の発注済みや確定予測にしません/);
  assert.match(c.describeOutputFormSurvey(), /原本のセル配置は確定していません/);
});

test('a monthly line reads recorded days and draws two D10 tracks only', () => {
  const c = api();
  assert.equal(c.daysInMonth('2027-02'), 28);
  assert.equal(c.daysInMonth('2028-02'), 29);
  assert.equal(c.daysInMonth('2027-04'), 30);
  assert.equal(c.daysInMonth('2027-05'), 31);
  assert.equal(c.caliberLineDate('2027-02', 29), null);
  const draft = c.updateMonthlyProductionMonth(c.createMonthlyProductionDraft(2027).draft, '2027-05', { classification: 'confirmed', productionTons: 810, size: 'D10' });
  const shifted = c.addShiftBasisRow(draft.draft, { standKey: '16', size: 'D10', caliberId: '3', from: '2027-05-02', to: '2027-05-02', tons: 810 });
  const planText = JSON.stringify(shifted.draft);
  const note = (stand, day, extra) => Object.assign({
    standKey: stand, size: 'D10', rollId: 'anon', side: 'WS', lane: '未確認', positionNumber: '3',
    from: `2027-05-0${day}`, to: `2027-05-0${day}`, eventKind: '', eventDate: '', period: '未確認'
  }, extra);
  const view = c.buildCaliberLineView({
    plan: shifted.draft,
    notes: [
      note('16', 1),
      note('16', 2, { positionNumber: '4', eventKind: 'カリバ替', eventDate: '2027-05-02', period: '昼' }),
      note('17', 2, { positionNumber: '5', eventKind: 'ロール替', eventDate: '2027-05-02', period: '夜' }),
      note('16', 2, { size: 'D13', positionNumber: '8' })
    ],
    yearMonth: '2027-05',
    day: 2,
    unusable: [{ standKey: '16', size: 'D10', caliberId: '3' }],
    regrindCalibers: [{ caliberId: '3', unusable: true }, { caliberId: '9', unusable: false }]
  });
  assert.equal(view.ok, true);
  assert.equal(JSON.stringify(shifted.draft), planText);
  assert.equal(view.segments.length, 0);
  assert.equal(c.renderCaliberLineSvg(view).includes('<polyline'), false);
  assert.match(c.renderCaliberLineSvg(view), /<svg id="caliber-line-svg"/);
  assert.equal(view.events.map(item => item.period).join(','), '昼,夜');
  const text = c.describeCaliberLine(view);
  assert.match(text, /東西の対応が未確認なので、線は引きません/);
  assert.match(text, /D13にD10の2列圧延は適用しません/);
  const linked = c.buildCaliberLineView({
    plan: shifted.draft,
    notes: [
      note('12', 2, { lane: '東列', positionNumber: '2', passTo: '16' }),
      note('16', 2, { lane: '東列', positionNumber: '4' }),
      note('15', 2, { lane: '東列', positionNumber: '7' }),
      note('13', 2, { lane: '西列', positionNumber: '6' }),
      note('17', 2, { lane: '西列', positionNumber: '5' })
    ],
    yearMonth: '2027-05',
    day: 2
  });
  const gap = c.renderCaliberLineSvg(linked);
  assert.equal((gap.match(/<polyline/g) || []).length, 0);
  assert.match(c.describeCaliberLine(linked), /#12から#16は途中の#13、#14、#15が未確認なので線を切ります/);
  assert.match(c.describeCaliberLine(linked), /同じ列や隣接だけではつなぎません/);
  const hinted = c.buildCaliberLineView({
    plan: shifted.draft,
    notes: [
      note('15', 2, { lane: '東列', rollId: 'r15', positionNumber: '7', period: '昼', passTo: '16' }),
      note('16', 2, { lane: '東列', rollId: 'r16', positionNumber: '4', period: '昼' }),
      note('16', 2, { lane: '東列', rollId: 'r16', positionNumber: '8', period: '夜' })
    ],
    yearMonth: '2027-05',
    day: 2
  });
  assert.equal((c.renderCaliberLineSvg(hinted).match(/<polyline/g) || []).length, 0);
  assert.match(c.describeCaliberLine(hinted), /通過先入力だけでは接続確認済みにしません/);
  const hop = c.buildCaliberLineView({
    plan: shifted.draft,
    notes: [
      note('15', 2, { lane: '東列', rollId: 'r15', positionNumber: '7', period: '昼', passTo: '16', passRollId: 'r16', passCaliber: '4' }),
      note('16', 2, { lane: '東列', rollId: 'r16', positionNumber: '4', period: '昼', acceptStand: '15', acceptRoll: 'r15', acceptCaliber: '7' }),
      note('16', 2, { lane: '東列', rollId: 'r16', positionNumber: '8', period: '夜', acceptStand: '15', acceptRoll: 'r15', acceptCaliber: '7' }),
      note('16', 2, { size: 'D13', lane: '東列', rollId: 'd16', positionNumber: '8', period: '昼', passTo: '17', passRollId: 'd17', passCaliber: '9' }),
      note('17', 2, { size: 'D13', lane: '東列', rollId: 'd17', positionNumber: '9', period: '夜', acceptStand: '16', acceptRoll: 'd16', acceptCaliber: '8' })
    ],
    yearMonth: '2027-05',
    day: 2
  });
  const svg = c.renderCaliberLineSvg(hop);
  assert.equal((svg.match(/<polyline/g) || []).length, 1);
  assert.match(svg, /data-line="D10-東列" data-from="15" data-to="16" data-from-roll="r15" data-to-roll="r16" data-from-caliber="7" data-to-caliber="4" data-period="昼"/);
  assert.equal(svg.includes('data-to-caliber="8"'), false);
  assert.equal(svg.includes('data-line="D13'), false);
  assert.match(c.describeCaliberLine(hop), /時点が一致しないので線は引きません/);
  const ambiguous = c.buildCaliberLineView({
    plan: shifted.draft,
    notes: [
      note('15', 2, { lane: '東列', rollId: 'r15', positionNumber: '7', period: '昼', passTo: '16', passRollId: 'r16', passCaliber: '4' }),
      note('16', 2, { lane: '東列', rollId: 'r16', positionNumber: '4', period: '昼', acceptStand: '15', acceptRoll: 'r15', acceptCaliber: '7' }),
      note('16', 2, { lane: '東列', rollId: 'r16', positionNumber: '4', period: '昼', acceptStand: '15', acceptRoll: 'r15', acceptCaliber: '7' })
    ],
    yearMonth: '2027-05',
    day: 2
  });
  assert.equal((c.renderCaliberLineSvg(ambiguous).match(/<polyline/g) || []).length, 0);
  assert.match(c.describeCaliberLine(ambiguous), /候補が複数なので線は引きません/);
  assert.match(text, /前日と違うスタンドは/);
  assert.match(text, /前回累計0直 今回加算2直 新しい累計2直 残り11/);
  assert.match(text, /使用不可/);
  assert.match(text, /3は使用不可/);
  assert.match(text, /9は改削後0直/);
  assert.match(text, /補正値と許容値は未確認/);
  assert.equal(c.buildCaliberLineView({ plan: shifted.draft, notes: [], yearMonth: '2027-02', day: 1 }).ok, false);
  const leap = c.buildCaliberLineView({ plan: { months: [{ month: '2028-02' }], shiftRows: [] }, notes: [], yearMonth: '2028-02', day: 29 });
  assert.equal(leap.date, '2028-02-29');
});
