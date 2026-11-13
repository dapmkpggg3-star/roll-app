const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function printBlocks(css) {
  const blocks = [];
  let searchFrom = 0;
  while (searchFrom < css.length) {
    const start = css.indexOf('@media print {', searchFrom);
    if (start < 0) break;
    let depth = 0;
    for (let i = css.indexOf('{', start); i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(css.slice(start, i + 1));
          searchFrom = i + 1;
          break;
        }
      }
    }
  }
  assert.ok(blocks.length >= 1, 'missing print media block');
  return blocks.join('\n');
}

test('ROLL-005 print keeps the workshop sheet and lays the role list out as a table', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  const block = printBlocks(css);
  assert.match(block, /size:\s*A4 portrait/);
  assert.match(block, /margin:\s*10mm/);
  assert.match(block, /transform:\s*none\s*!important/);
  assert.match(block, /assembly-alert-card:not\(\.is-selected\)[\s\S]*display:\s*none\s*!important/);
  assert.match(block, /tbody#role-list\s*\{[\s\S]*display:\s*table-row-group\s*!important/);
  assert.match(block, /#role-table\s*\{[\s\S]*display:\s*table\s*!important/);
  const cardRule = css.indexOf('minmax(420px, 1fr)');
  const printRule = css.lastIndexOf('display: table-row-group !important');
  assert.ok(cardRule > 0 && printRule > cardRule, 'print table rules must follow the screen card rules');
});
