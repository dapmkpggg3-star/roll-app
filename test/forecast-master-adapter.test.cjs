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
