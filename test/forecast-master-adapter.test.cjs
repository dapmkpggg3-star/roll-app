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

test('a mixed-size horizon does not become a single selected-size depletion forecast', () => {
  const c = api();
  const input = scenario();
  input.days.push({ date: '2027-04-03', size: 'D13', productionAmount: 10, operatingHours: 8, shift1Team: 'A' });
  const result = c.buildStandDemandList(input);
  assert.match(result, /選択中の1サイズには丸めません/);
  assert.equal(result.includes('対象はAです。廃却径以下'), false);
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
