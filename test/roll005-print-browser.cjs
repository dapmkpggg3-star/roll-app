const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/roll005-print');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const outbound = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      let url;
      try { url = new URL(route.request().url()); } catch (error) { return route.abort('blockedbyclient'); }
      if (url.protocol !== 'http:' || url.hostname !== 'roll-app.test') {
        outbound.push(url.href);
        return route.abort('blockedbyclient');
      }
      const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const absolute = path.resolve(root, `.${rel}`);
      if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        return route.abort('blockedbyclient');
      }
      return route.fulfill({ path: absolute, contentType: mime[path.extname(absolute)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(String(error.message)));
    await page.goto('http://roll-app.test/index.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';
      roles = [{ id: 'anon-print', name: '#99-PRINT', status: 'オンライン', memo: 'print-anon', updatedAt: '2026-11-13T00:00:00.000Z', history: [] }];
      searchQuery = '';
      statusFilter = 'all';
      memoOnlyFilter = false;
      watchStandFilter = null;
      renderRoles();
    });
    await page.emulateMedia({ media: 'print' });
    const style = await page.evaluate(() => {
      const row = document.querySelector('#role-list tr');
      const sync = document.getElementById('syncSheetsBtn');
      const bodyStyle = getComputedStyle(document.body);
      return {
        table: getComputedStyle(document.getElementById('role-table')).display,
        list: getComputedStyle(document.getElementById('role-list')).display,
        row: row ? getComputedStyle(row).display : '',
        name: row ? getComputedStyle(row.querySelector('.stand-name-cell') || row).fontSize : '',
        sync: sync ? getComputedStyle(sync).display : '',
        transform: bodyStyle.transform
      };
    });
    assert.equal(style.table, 'table', 'role table must print as a table');
    assert.equal(style.list, 'table-row-group', 'role list must print as table rows');
    assert.equal(style.row, 'table-row');
    assert.equal(await page.locator('#syncSheetsBtn').isVisible(), false, 'sync control must be hidden in print');
    assert.equal(style.transform, 'none');
    assert.ok(Number.parseFloat(style.name) <= 16, `printed stand name too large: ${style.name}`);
    assert.equal(await page.locator('#role-list').innerText().then(text => text.includes('#99-PRINT')), true);
    await page.screenshot({ path: path.join(out, 'role-list-print.png'), fullPage: true });

    await page.evaluate(() => {
      document.body.classList.add('workshop-board-mode');
      const board = document.getElementById('workshop-board-list') || document.querySelector('.assembly-alert-list');
      if (!board) throw new Error('workshop list missing');
      board.innerHTML = '<article class="assembly-alert-card is-selected">selected-anon</article><article class="assembly-alert-card">hidden-anon</article>';
    });
    const cards = await page.evaluate(() => [...document.querySelectorAll('.assembly-alert-card')].map(card => getComputedStyle(card).display));
    assert.notEqual(cards[0], 'none', 'selected workshop card must remain printable');
    assert.equal(cards[1], 'none', 'unselected workshop card must stay hidden in print');
    assert.equal(failures.length, 0, failures.join('\n'));
    assert.equal(outbound.length, 0, outbound.join('\n'));
    console.log('ROLL-005 print browser PASS');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
