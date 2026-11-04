const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
function load(name, context) {
    const start = source.indexOf('function ' + name + '(');
    const end = source.indexOf('\nfunction ', start + 1);
    vm.runInContext(source.slice(start, end < 0 ? undefined : end), context);
}
function harness() {
    const fields = { 'status-filter': { value: 'オンライン' }, 'role-search': { value: '別スタンド' },
        'memo-only-filter': { checked: true } };
    const roles = ['オンライン', '新品予備保管', '発注済み（納入待ち）', '廃却待ち（ラック保管）', '廃棄']
        .map((status, i) => ({ id: i, name: '#14-' + i, status, memo: '' }));
    let rendered = [];
    const c = vm.createContext({ roles, searchQuery: '別スタンド', memoOnlyFilter: true,
        watchStandFilter: '2', statusFilter: 'オンライン', NEW_STORAGE_STATUS: '新品予備保管',
        ORDERED_WAITING_STATUS: '発注済み（納入待ち）', SCRAP_WAITING_STATUS: '廃却待ち（ラック保管）',
        document: { getElementById: id => fields[id] }, normalizeRoleStatusValue: String,
        isWatchStandMatched: () => !c.watchStandFilter, renderRoles: () => { rendered = c.getFilteredRoles(); } });
    for (const name of ['setSummaryFilter', 'showAllRoles', 'isStatusMatched', 'getFilteredRoles', 'hasMemoText']) load(name, c);
    return { c, fields, roles, rendered: () => rendered };
}
test('summary selection clears stale search, memo and stand filters and shows the counted status', () => {
    const h = harness(); h.c.setSummaryFilter('新品予備保管');
    assert.equal(h.rendered().length, 1); assert.equal(h.rendered()[0].status, '新品予備保管');
    assert.equal(h.fields['role-search'].value, ''); assert.equal(h.fields['memo-only-filter'].checked, false);
    assert.equal(h.fields['status-filter'].value, '新品予備保管');
    assert.equal(h.c.watchStandFilter, null);
});
test('summary total and show-all include stored and retired rolls without deleting data', () => {
    for (const action of ['summary', 'all']) {
        const h = harness(), before = JSON.stringify(h.roles);
        if (action === 'summary') h.c.setSummaryFilter('all'); else h.c.showAllRoles();
        assert.equal(h.rendered().length, h.roles.length);
        assert.equal(h.fields['status-filter'].value, 'allIncludingStored');
        assert.equal(JSON.stringify(h.roles), before);
    }
});
test('normal view still hides stored statuses; explicit selection of a zero-count status is empty', () => {
    const h = harness(); h.c.setSummaryFilter('all'); h.c.statusFilter = 'all';
    assert.equal(h.c.getFilteredRoles().length, 2);
    h.c.setSummaryFilter('改削中'); assert.equal(h.rendered().length, 0);
});
test('future-work panel follows incomplete tasks and restores when work becomes incomplete again', () => {
    const classes = new Set();
    const nodes = { 'incomplete-work-dashboard': { classList: { toggle(k,on) { if(on) classes.add(k); else classes.delete(k); } } },
        'incomplete-work-count': {}, 'incomplete-work-list': {} };
    const c = vm.createContext({ document: { getElementById: id => nodes[id] },
        getWorkProgressState: r => ({ isIncomplete: r.done < 3 && r.done > 0, completedCount: r.done, totalCount: 3 }),
        syncCollapsibleDashboardState() {}, FUTURE_WORK_DASHBOARD_CONFIG: {}, escapeHtml: String });
    load('updateIncompleteWorkDashboard', c);
    const rows = [{ name: '#14-57', done: 1 }];
    c.updateIncompleteWorkDashboard(rows); assert.equal(classes.has('is-empty'), false);
    rows[0].done = 3; c.updateIncompleteWorkDashboard(rows);
    assert.equal(classes.has('is-empty'), true); assert.equal(nodes['incomplete-work-count'].textContent, '0件');
    assert.equal(rows.length, 1);
    rows[0].done = 2; c.updateIncompleteWorkDashboard(rows);
    assert.equal(classes.has('is-empty'), false); assert.equal(nodes['incomplete-work-count'].textContent, '1件');
});
