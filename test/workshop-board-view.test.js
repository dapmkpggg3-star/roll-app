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

test('automatic planning remains available outside workshop board mode', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    assert.match(html, /id="auto-planning-panel"/);
    assert.match(html, /<h2>自動計画案<\/h2>/);
});
