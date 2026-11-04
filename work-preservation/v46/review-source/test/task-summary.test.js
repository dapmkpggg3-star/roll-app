const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/app.js'), 'utf8');
function load(name, context) {
    const start = source.indexOf('function ' + name + '(');
    const end = source.indexOf('\nfunction ', start + 1);
    vm.runInContext(source.slice(start, end < 0 ? undefined : end), context);
}
test('purchase count, header and displayed items include outstanding delivery followup', () => {
    const pending = [{ hasOrderedWaiting: true, status: '納入待ち', action: '納入を確認' }];
    const c = vm.createContext({ roles: [], getThreeSetManagementAssemblyItems: () => [],
        getThreeSetManagementAssemblyExcludedItems: () => [], getThreeSetManagementReworkItems: () => [],
        getThreeSetManagementPurchaseItems: () => pending, escapeHtml: String });
    for (const name of ['getThreeSetManagementEmptySummary', 'getThreeSetManagementSummary',
        'getThreeSetManagementData', 'getThreeSetManagementPanelHeaderMetaHtml']) load(name, c);
    const purchase = c.getThreeSetManagementData([]).find(g => g.key === 'purchase');
    assert.equal(purchase.summary.count, purchase.items.length);
    assert.equal(purchase.summary.count, 1);
    assert.equal(c.getThreeSetManagementPanelHeaderMetaHtml(purchase), '<span>1件</span>');
    const empty = c.getThreeSetManagementSummary('購入', pending, { summaryFilter: () => false });
    assert.equal(empty.count, 0); assert.equal(empty.status, '対応なし');
});
