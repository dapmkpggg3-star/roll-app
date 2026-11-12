const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function printBlock(css) {
  const start = css.indexOf('@media print {');
  assert.ok(start >= 0, 'missing print media block');
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error('unclosed print block');
}

test('ROLL-005 print rules reset the workshop sheet but do not layout the role list', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  const block = printBlock(css);
  assert.match(block, /size:\s*A4 portrait/);
  assert.match(block, /margin:\s*10mm/);
  assert.match(block, /transform:\s*none\s*!important/);
  assert.match(block, /assembly-alert-card:not\(\.is-selected\)[\s\S]*display:\s*none\s*!important/);
  assert.equal(block.includes('role-list'), false);
  assert.equal(block.includes('#role-list'), false);
});
