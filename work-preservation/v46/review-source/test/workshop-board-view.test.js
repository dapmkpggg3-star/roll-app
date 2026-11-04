const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('workshop board mode hides the automatic planning panel', () => {
    const styles = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
    const workshopHiddenGroup = styles.match(
        /body\.workshop-board-mode #count-summary,[\s\S]*?\{\s*display:\s*none\s*!important;\s*\}/
    );

    assert.ok(workshopHiddenGroup, '工作課モードの非表示グループが必要です');
    assert.match(workshopHiddenGroup[0], /body\.workshop-board-mode #auto-planning-panel/);
});

test('monthly planning stays outside the app while workshop and roll controls remain', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    assert.doesNotMatch(html, /auto-planning|月次計画を作成|src="js\/planning-/);
    assert.match(html, /id="workshop-board"/);
    assert.match(html, /id="role-search"/);
    assert.match(html, /id="sync-status-badge"/);
});

test('candidate board distinguishes a calculated target from a registered instruction deadline', () => {
    const vm = require('node:vm');
    const code = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
    const body = code.slice(code.indexOf('function getWorkshopBoardAssemblyDueEditHtml('), code.indexOf('function startWorkshopBoardAssemblyDueEdit('));
    const context = vm.createContext({ getWorkshopBoardCandidateKey: () => 'fixture',
        getWorkshopBoardAssemblyDueInputId: () => 'due-fixture',
        normalizeWorkshopBoardInstructionDueDate: x => x,
        getRoleAssemblyInstructionDue: r => r.assemblyInstructionDue || '',
        workshopBoardEditingAssemblyDueKey: '', escapeHtml: x => String(x) });
    vm.runInContext(body, context);
    for (const [source, caption] of [['onlineUseEndDate', '自動計算の目安'], ['assemblyInstructionDue', '登録した指示期限']]) {
        const html = context.getWorkshopBoardAssemblyDueEditHtml({ usedRole: {}, details: { deadlineSource: source } }, '2026/10/30', 'あと5日');
        assert.ok(html.includes(caption)); assert.ok(html.includes('2026/10/30'));
        assert.ok(html.includes('あと5日'));
    }
});
