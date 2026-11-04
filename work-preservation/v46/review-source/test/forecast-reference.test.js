const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
function load(name, context) {
    const start = source.indexOf('function ' + name + '(');
    assert.notEqual(start, -1, name);
    const end = source.indexOf('\nfunction ', start + 1);
    vm.runInContext(source.slice(start, end < 0 ? undefined : end), context);
}
function harness() {
    const nodes = Object.fromEntries(['three-set-forecast-dashboard', 'three-set-forecast-count', 'three-set-forecast-list']
        .map(id => [id, { classList: { toggle() {} } }]));
    const c = vm.createContext({ roles: [], ONLINE_STATUS: 'online', DISCARDED_STATUS: 'discarded',
        NEW_INSTALLED_STATUS: 'installed', NEW_READY_STATUS: 'ready', NEW_STORAGE_STATUS: 'stored',
        REWORKING_STATUS: 'reworking', REWORK_READY_STATUS: 'dispatchable', USED_STANDBY_STATUS: 'used',
        THREE_SET_FORECAST_MIN_STAND: 17, THREE_SET_FORECAST_MAX_STAND: 17,
        THREE_SET_FORECAST_DASHBOARD_CONFIG: {},
        getTodayDateString: () => '2026-10-26', normalizeDateInputValue: value => /^\d{4}-\d\d-\d\d$/.test(value || '') ? value : '',
        getRoleArrivalDate: role => role.workProgress?.arrivalDate || '',
        getRoleDispatchDate: role => role.workProgress?.dispatchDate || '',
        getStandKey: name => String(name || '').replace(/^#/, '').split('-')[0],
        normalizeUseStartDate: value => value || '', getOnlineUseEndDate: role => role ? '2027-01-01' : '',
        compareRolesByStandRole: (a, b) => a.name.localeCompare(b.name), compareUpdatedAt: () => 0,
        getRemainingDiameterInfo: role => role.cutUnknown ? null : { adoptedCutMm: 2, currentDiameter: 320, scrapDiameter: 292 },
        getStandMaster: () => null, formatDateForDisplay: value => value || '-', escapeHtml: String,
        document: { getElementById: id => nodes[id] }, syncCollapsibleDashboardState() {},
        // A hidden fallback to a fixed duration must fail this integration test.
        addDaysToDateString: () => { throw new Error('No fixed regrind duration allowed here'); }
    });
    for (const name of ['getThreeSetForecastReworkReturnDate', 'getThreeSetForecastRoleLabel', 'getThreeSetForecastCutInfo',
        'sortThreeSetForecastRoleCandidates', 'getThreeSetForecastCandidate', 'getThreeSetForecastPurchaseAction',
        'getThreeSetForecastItem', 'getThreeSetForecastStandKeys', 'getThreeSetForecastItems',
        'getThreeSetForecastPriorityRank', 'compareThreeSetForecastItems', 'getThreeSetForecastSupplement',
        'getThreeSetForecastSummaryFieldHtml', 'updateThreeSetForecastDashboard']) load(name, c);
    return { c, nodes };
}
const spare = (patch = {}) => ({ id: 'spare', name: '#17-example-spare', status: 'reworking',
    workProgress: { dispatchDate: '2026-08-21', arrivalDate: '2026-10-26' }, ...patch });
test('candidate forecast uses recorded return plan instead of dispatch plus fixed days', () => {
    const { c } = harness();
    assert.equal(c.getThreeSetForecastReworkReturnDate(spare()), '2026-10-26');
    assert.equal(c.getThreeSetForecastReworkReturnDate(spare({ workProgress: { arrivalDate: '2026-11-02' } })), '2026-11-02');
});
test('unknown return dates are never invented from dispatch, status changes or today', () => {
    const { c } = harness();
    for (const status of ['reworking', 'dispatchable', 'used']) {
        assert.equal(c.getThreeSetForecastReworkReturnDate(spare({ status,
            workProgress: { dispatchDate: '2026-08-21' }, updatedAt: '2026-08-28' })), '');
    }
});
test('return before dispatch is unresolved and cannot become a usable return plan', () => {
    const { c } = harness();
    const row = spare({ workProgress: { dispatchDate: '2026-11-01', arrivalDate: '2026-10-26' } });
    assert.equal(c.getThreeSetForecastReworkReturnDate(row), '');
    const r = c.getThreeSetForecastCandidate([row], '2027-01-01');
    assert.equal(r.judgment, '要確認'); assert.match(r.reason, /矛盾/);
});
test('a return due today is still a plan and never completes assembly or changes status', () => {
    const { c } = harness(), row = spare(), before = JSON.stringify(row);
    const r = c.getThreeSetForecastCandidate([row], '2027-01-01');
    assert.equal(r.judgment, '要段取り'); assert.match(r.reason, /受入・組替完了は未確認/);
    assert.equal(JSON.stringify(row), before);
});
test('past planned return retains overdue review even with incomplete diameter information', () => {
    const { c } = harness();
    const row = spare({ cutUnknown: true, workProgress: { arrivalDate: '2026-10-25' } });
    const r = c.getThreeSetForecastCandidate([row], '2027-01-01');
    assert.equal(r.judgment, '要確認'); assert.match(r.reason, /予定日.*過ぎています/);
    assert.equal(r.readyDate, '2026-10-25');
});
test('previous cycle arrival on used spare is not recycled as a new preparation forecast', () => {
    const { c } = harness();
    const row = spare({ status: 'used', workProgress: { arrivalDate: '2026-06-15' } });
    const r = c.getThreeSetForecastCandidate([row], '2027-01-01');
    assert.equal(r.judgment, '要確認'); assert.equal(r.readyDate, ''); assert.match(r.reason, /今回.*未確定/);
});
test('assembled spare does not establish twelve-month rotation or its suitable calibers', () => {
    const { c } = harness();
    const r = c.getThreeSetForecastCandidate([spare({ status: 'installed' })], '2027-01-01');
    assert.equal(r.judgment, '要確認'); assert.equal(r.className, 'is-check');
    assert.equal(r.readyDate, ''); assert.match(r.reason, /残カリバ.*未確認/);
});
test('rendered candidate panel exposes fixed-period basis and unassessed annual readiness', () => {
    const { c, nodes } = harness();
    const rows = [{ id: 'online', name: '#17-example-online', status: 'online', useStartDate: '2026-10-01' },
        spare({ status: 'installed' })];
    const result = c.getThreeSetForecastItems(rows);
    assert.equal(result.length, 1); assert.equal(result[0].annualReadinessAssessed, false);
    assert.equal(result[0].scope, 'next-candidate-reference');
    c.updateThreeSetForecastDashboard(rows);
    const html = nodes['three-set-forecast-list'].innerHTML;
    assert.match(html, /使用終了の参考値/); assert.match(html, /固定月数/); assert.match(html, /12か月.*未判定/);
    assert.doesNotMatch(html, /is-maintainable|確保済み/);
    assert.equal(nodes['three-set-forecast-count'].textContent, '1件');
});
