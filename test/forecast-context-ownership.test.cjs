const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const fields = new Map();
  const memory = new Map();
  const field = id => {
    if (!fields.has(id)) fields.set(id, { value: '', textContent: '', dataset: {}, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } });
    return fields.get(id);
  };
  const context = vm.createContext({
    document: { readyState: 'loading', documentElement: { dataset: {} }, addEventListener() {}, getElementById: id => fields.get(id) || null },
    localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, String(value)) },
    roles: [
      { id: 'A', name: '#10-A', status: 'オンライン', currentDiameter: 81 },
      { id: 'B', name: '#10-B', status: '新品予備（組込完了）', currentDiameter: 93 },
      { id: 'C', name: '#17-A', status: 'オンライン', currentDiameter: 81, currentCaliber: 'cc', openingRuns: 5 }
    ]
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/operating-plan.js'), 'utf8'), context);
  ['forecast-roll', 'forecast-reference', 'caliber-stand', 'caliber-size', 'caliber-current', 'caliber-opening', 'caliber-opening-tons', 'monthly-schedule-file', 'monthly-schedule-summary', 'stand-demand-list', 'work-date', 'work-period', 'work-required-hours', 'work-reserved-hours', 'work-people', 'work-type', 'work-continuous', 'work-changeover', 'work-three-set', 'assembly-date', 'assembly-period'].forEach(field);
  Object.entries({ 'forecast-roll': 'A', 'forecast-reference': '2027-04-01', 'caliber-stand': '10', 'caliber-size': 'D10' }).forEach(([id, value]) => { field(id).value = value; });
  for (const [referenceAt, openingRuns] of [['2027-04-01', 7], ['2027-04-02', 1]]) {
    context.rememberForecastSetting({ rollId: 'A', standKey: '10', size: 'D10', referenceAt, caliberId: `ca-${referenceAt}`, openingRuns });
  }
  const day = date => ({ date, productionAmount: 10, operatingHours: 8, shift1Team: 'A', shift3Team: '', size: 'D10' });
  context.summary = { ok: true, sourceName: 'same.xlsx', referenceDate: '2027-04-01', months: [{ month: '2027-04', classification: 'future', sizes: ['D10'], shifts: ['A'], productionTons: null, operatingHours: null }], days: [day('2027-04-01'), day('2027-04-02')], reason: '' };
  vm.runInContext("latestMonthlySummary = summary; standPremisesCache = { status: 'missing' };", context);
  context.bindMonthlyScheduleFileInput();
  const change = (id, value) => { field(id).value = value; field(id).handlers.change(); };
  return { context, field, change };
}

test('real change handlers use the selected reference and never replay earlier days', () => {
  const { context, field, change } = fixture();
  change('forecast-reference', '2027-04-02');
  assert.match(field('stand-demand-list').textContent, /基準日は2027-04-02/);
  assert.match(field('stand-demand-list').textContent, /対象期間は2027-04-02から2027-04-02/);
  assert.match(field('stand-demand-list').textContent, /保存した開始条件です。基準日2027-04-02/);
  assert.equal(field('caliber-opening').value, '1');
  change('forecast-reference', '2027-04-03');
  assert.equal(field('caliber-opening').value, '');
  change('forecast-reference', '2027-04-01');
  assert.equal(field('caliber-opening').value, '7');
  assert.equal(context.recallForecastSetting({ rollId: 'A', standKey: '10', size: 'D10', referenceAt: '2027-04-02' }).value.openingRuns, 1);
});

test('work drafts follow the roll, stand, size and reference that were edited', () => {
  const { context, field, change } = fixture();
  change('work-date', '2027-04-03');
  change('work-period', 'day');
  const initial = context.readCaliberInputs().workConfirmation;
  assert.equal(initial.rollId, 'A');
  assert.equal(initial.referenceAt, '2027-04-01');
  for (const [id, different, original] of [
    ['forecast-roll', 'B', 'A'], ['caliber-stand', '17', '10'],
    ['caliber-size', 'D13', 'D10'], ['forecast-reference', '2027-04-02', '2027-04-01']
  ]) {
    change(id, different);
    assert.equal(field('work-date').value, '', id);
    change(id, original);
    assert.equal(field('work-date').value, '2027-04-03', id);
  }
  const target = { rollId: 'A', size: 'D10', referenceAt: '2027-04-01' };
  assert.ok(context.confirmationForStand(initial, '10', target));
  assert.equal(context.confirmationForStand({ ...initial, rollId: 'B' }, '10', target), null);
  assert.equal(context.confirmationForStand({ ...initial, size: 'D13' }, '10', target), null);
  assert.equal(context.confirmationForStand({ ...initial, referenceAt: '2027-04-02' }, '10', target), null);
});

test('starting another file read discards approvals even when the filename is unchanged', () => {
  const { context, field, change } = fixture();
  change('work-date', '2027-04-03');
  const first = context.readCaliberInputs().workConfirmation;
  context.beginScheduleRead();
  assert.equal(field('work-date').value, '');
  const second = context.readCaliberInputs().workConfirmation;
  assert.notEqual(first.scheduleGeneration, second.scheduleGeneration);
  change('forecast-reference', '2027-04-02');
  change('forecast-reference', '2027-04-01');
  assert.equal(field('work-date').value, '');
});
