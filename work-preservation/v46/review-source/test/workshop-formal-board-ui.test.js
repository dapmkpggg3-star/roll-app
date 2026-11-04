const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const board = require('../js/workshop-board');
const { fixture } = require('./helpers/workshop-api-fixture.cjs');
class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.events = {}; this.textContent = ''; this.classes = new Set(); this.classList = { add: name => this.classes.add(name) }; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, action) { this.events[key] = action; }
    get innerHTML() { throw new Error('Unsafe HTML rendering'); }
    set innerHTML(_) { throw new Error('Unsafe HTML rendering'); }
}
function setup(itemFields = {}) {
    const nodes = Object.fromEntries(['workshop-board', 'workshop-board-list', 'workshop-board-selected-toggle',
        'workshop-board-print', 'workshop-board-stand-filter', 'workshop-board-summary', 'workshop-board-count']
        .map(id => [id, new Element('div')]));
    const title = new Element('h2'), subtitle = new Element('p'), note = new Element('p');
    nodes['workshop-board'].querySelector = selector => selector === 'h2' ? title : selector === '.workshop-board-header p' ? subtitle : note;
    const context = vm.createContext({ document: { getElementById: id => nodes[id], createElement: tag => new Element(tag) },
        isWorkshopCompletionEnabled: () => true, RollWorkshopBoard: board, workshopBoardStandFilter: 'all',
        RollAuth: { currentUser: () => ({ id: 'fixture', role: 'editor' }) } });
    vm.runInContext(fs.readFileSync(require.resolve('../js/workshop-board-ui'), 'utf8'), context);
    const h = fixture(), issued = h.issue(itemFields);
    const render = state => { context.nextState = state; vm.runInContext('formalWorkshopState = nextState; renderFormalWorkshopBoard()', context); };
    return { context, nodes, h, issued, render, title, snapshot: () => board.model(h.ok({ action: 'fetchworkshop' })) };
}
const allText = node => [node.textContent, ...node.children.map(allText)].join(' ');
test('formal view shows not-checked rather than zero; legacy feature gate does not touch the board', () => {
    const x = setup(); x.context.renderFormalWorkshopBoard();
    assert.equal(x.nodes['workshop-board-count'].textContent, '未確認');
    assert.equal(x.nodes['workshop-board-print'].disabled, true);
    x.context.isWorkshopCompletionEnabled = () => false;
    x.nodes['workshop-board-count'].textContent = 'legacy';
    assert.equal(x.context.renderFormalWorkshopBoard(), false);
    assert.equal(x.nodes['workshop-board-count'].textContent, 'legacy');
});
test('completed instructions leave normal display, remain accessible, and return when pending work exists', () => {
    const x = setup(); x.render({ phase: 'ready', model: x.snapshot(), error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件');
    x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    const completed = x.snapshot(); x.render({ phase: 'ready', model: completed, error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '0件');
    x.nodes['workshop-board-summary'].children[1].events.click();
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件');
    assert.match(allText(x.nodes['workshop-board-list']), /組込完了・反映確認済み/);
    x.nodes['workshop-board-summary'].children[1].events.click();
    const pending = structuredClone(completed); pending.items[0].completed = false; pending.items[0].label = '要対応';
    x.render({ phase: 'ready', model: pending, error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件');
});
test('fetch errors keep old rows visibly stale and disable recovery and print; reader cannot recover', () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const model = x.snapshot(); x.render({ phase: 'error', model, error: '通信失敗' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件（前回確認分）');
    assert.match(allText(x.nodes['workshop-board-summary']), /通信失敗/);
    assert.equal(x.nodes['workshop-board-list'].children[0].children.find(node => node.tag === 'button').disabled, true);
    assert.equal(x.nodes['workshop-board-print'].disabled, true);
    x.context.RollAuth.currentUser = () => ({ role: 'reader' });
    x.render({ phase: 'ready', model, error: '' });
    assert.equal(x.nodes['workshop-board-list'].children[0].children.find(node => node.tag === 'button').disabled, true);
});
test('names and reasons are text only, filter counts match cards, logout clears cached instructions', () => {
    const x = setup(), model = x.snapshot(); model.items[0].donor = '<img src=x onerror=alert(1)>';
    model.items[0].blockers = ['<script>alert(1)</script>'];
    x.render({ phase: 'ready', model, error: '' });
    assert.match(allText(x.nodes['workshop-board-list']), /<img src=x/);
    x.context.workshopBoardStandFilter = '15'; x.context.renderFormalWorkshopBoard();
    assert.equal(x.nodes['workshop-board-count'].textContent, '0件');
    x.context.resetFormalWorkshopBoard();
    assert.equal(x.nodes['workshop-board-list'].children.length, 0);
    x.context.renderFormalWorkshopBoard();
    assert.equal(x.nodes['workshop-board-count'].textContent, '未確認');
});

test('verified timestamp is shown in Japan time and pending work is not styled as completed', () => {
    const x = setup(); x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const model = x.snapshot(); model.checkedAt = '2026-10-25T09:00:00Z';
    x.render({ phase: 'ready', model, error: '' });
    assert.match(allText(x.nodes['workshop-board-summary']), /2026\/10\/25 18:00（日本時間）/);
    const card = x.nodes['workshop-board-list'].children[0];
    assert.equal(card.classes.has('formal-workshop-pending'), true);
    assert.equal(card.classes.has('formal-workshop-completed'), false);
});


test('same-day rule stays within the existing card and updates count only after verified completion', () => {
    const x = setup({ assemblySchedule: { workDate: '2026-10-25', nightProduction: 'operating', source: '架空の採用計画' } });
    const snapshot = () => board.model({ ...x.h.ok({ action: 'fetchworkshop' }), checkedAt: '2026-10-25T09:00:00Z' });
    x.render({ phase: 'ready', model: snapshot(), error: '' });
    assert.equal(x.nodes['workshop-board-list'].children.length, 1);
    assert.match(allText(x.nodes['workshop-board-list']), /準備期限：2026-10-30/);
    assert.match(allText(x.nodes['workshop-board-list']), /作業予定日：2026-10-25/);
    assert.match(allText(x.nodes['workshop-board-list']), /操業あり・実施当日の完了が必要/);
    x.h.state.stale = true;
    assert.equal(x.h.post({ action: 'completeworkshop', request: x.issued.request }).success, false);
    const pending = snapshot(); x.render({ phase: 'ready', model: pending, error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件');
    assert.match(allText(x.nodes['workshop-board-list']), /反映確認が途中/);
    x.h.state.stale = false; x.h.ok({ action: 'resumeworkshop', operationId: pending.items[0].pending[0].id });
    x.render({ phase: 'ready', model: snapshot(), error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '0件');
    x.nodes['workshop-board-summary'].children[1].events.click();
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件');
    assert.match(allText(x.nodes['workshop-board-list']), /準備期限内の組込完了・反映を確認済み/);
});

test('optional workday shows consultation and verified completion leaves normal view with its history', () => {
    const x = setup({ assemblySchedule: { workDate: null, nightProduction: 'unknown', source: '工作と相談' } });
    x.render({ phase: 'ready', model: x.snapshot(), error: '' });
    const text = allText(x.nodes['workshop-board-list']);
    assert.match(text, /作業予定日：未定（工作と相談）/);
    assert.match(text, /準備期限：2026-10-30（採用した指示）/);
    assert.doesNotMatch(text, /確認が必要|当日完了要確認/);
    x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    x.render({ phase: 'ready', model: x.snapshot(), error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '0件');
    x.nodes['workshop-board-summary'].children[1].events.click();
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件');
    assert.match(allText(x.nodes['workshop-board-list']), /組込完了日：2026-10-25/);
});
test('deadline overrun remains visible and does not ask for another assembly', () => {
    const x = setup({ readyBy: '2026-10-24' });
    x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    x.render({ phase: 'ready', model: x.snapshot(), error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '1件');
    const text = allText(x.nodes['workshop-board-list']);
    assert.match(text, /期限超過の影響要確認/);
    assert.match(text, /組込は完了済み/);
    assert.doesNotMatch(text, /組込先ロールを編集/);
});

test('late-review entry is only inside the affected card; saved review is readable in completed history', () => {
    const x = setup({ readyBy: '2026-10-24' });
    x.h.ok({ action: 'completeworkshop', request: x.issued.request });
    const initial = x.snapshot(); x.render({ phase: 'ready', model: initial, error: '' });
    assert.match(allText(x.nodes['workshop-board-list']), /期限超過の対応を記録/);
    assert.match(allText(x.nodes['workshop-board-list']), /対応完了として記録/);
    x.context.RollAuth.currentUser = () => ({ role: 'reader' });
    x.render({ phase: 'ready', model: initial, error: '' });
    assert.doesNotMatch(allText(x.nodes['workshop-board-list']), /対応完了として記録/);
    x.h.ok({ action: 'reviewworkshopdeadline', request: { instructionId: initial.items[0].id,
        expectedRevision: initial.items[0].revision, requestId: 'ui-impact', reason: '<b>予備を確認済み</b>' } });
    x.render({ phase: 'ready', model: x.snapshot(), error: '' });
    assert.equal(x.nodes['workshop-board-count'].textContent, '0件');
    x.nodes['workshop-board-summary'].children[1].events.click();
    const text = allText(x.nodes['workshop-board-list']);
    assert.match(text, /対応記録（2026-10-25）：<b>予備を確認済み<\/b>/);
    assert.doesNotMatch(text, /解消したか確認が必要/);
});
