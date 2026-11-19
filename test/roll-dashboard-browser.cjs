const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function launchBrowser() {
  const attempts = [
    () => chromium.launch({ headless: true, args: ['--no-sandbox'] }),
    () => chromium.launch({ channel: 'msedge', headless: true }),
    () => chromium.launch({ channel: 'chrome', headless: true })
  ];
  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (!/Executable doesn't exist/.test(String(error && error.message))) throw error;
    }
  }
  throw lastError;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const evidenceDir = path.join(root, 'artifacts', 'roll-dashboard');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await launchBrowser();
  const blocked = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
      if (url.origin !== 'http://roll-app.test') {
        blocked.push(url.origin);
        return route.abort();
      }
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
      return route.fulfill({ path: file, contentType: types[path.extname(file)] || 'text/plain' });
    });
    const page = await context.newPage();
    await page.goto('http://roll-app.test/roll-dashboard.html');
    await page.waitForSelector('#dashboard-rows tr');
    const initial = await page.locator('#dashboard-rows').innerText();
    assert.match(initial, /#16-ANON-3/);
    assert.match(initial, /#10-ANON-1/);
    assert.match(initial, /手入力予定/);
    assert.match(initial, /2027-02-15/);
    assert.match(initial, /2027-04-02/);
    assert.match(initial, /判定不能/);
    assert.match(initial, /予備は0本/);
    assert.equal(initial.replaceAll('不足なしとは判定しません', '').replaceAll('不足なしにはしません', '').replaceAll('不足なしにもしません', '').includes('不足なし'), false);
    assert.equal((await page.locator('#dashboard-rows tr').first().getAttribute('data-roll')), '#16-ANON-3');
    const manualColor = await page.locator('.is-manual-plan').first().evaluate(element => getComputedStyle(element).color);
    const warningColor = await page.locator('.is-warning').first().evaluate(element => getComputedStyle(element).color);
    assert.notEqual(manualColor, warningColor);

    await page.fill('#filter-stand', '#10');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr').length === 1);
    let visible = await page.locator('#dashboard-rows').innerText();
    assert.match(visible, /#10-ANON-1/);
    assert.equal(visible.includes('#16-ANON-3'), false);
    assert.match(visible, /上書きしません/);
    await page.locator('button[data-basis="#10-ANON-1"]').click();
    const basis = await page.locator('.basis:not([hidden])').innerText();
    assert.match(basis, /計算式/);
    assert.match(basis, /暫定/);
    assert.match(basis, /匿名計画A/);

    await page.fill('#filter-stand', '');
    await page.fill('#filter-roll', 'ANON-2');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr').length === 1);
    visible = await page.locator('#dashboard-rows').innerText();
    assert.match(visible, /#11-ANON-2/);
    assert.match(visible, /未確認/);
    assert.match(visible, /0回にしません/);

    await page.fill('#filter-roll', '');
    await page.fill('#filter-month', '2027-03');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr').length === 1);
    assert.match(await page.locator('#dashboard-rows').innerText(), /2027-03-01/);

    await page.fill('#filter-month', '');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr').length === 3);
    await page.click('#freeze');
    assert.match(await page.locator('#snapshot-match').innerText(), /一致しています/);
    const frozen = await page.locator('#snapshot-numbers').innerText();
    assert.match(frozen, /2027-04-02/);
    assert.match(frozen, /判定不能/);
    await page.selectOption('#plan-version', 'anon-plan-b');
    await page.waitForFunction(() => document.getElementById('plan-label').textContent.includes('匿名計画B'));
    const revised = await page.locator('#dashboard-rows').innerText();
    assert.match(revised, /12か月/);
    assert.match(revised, /2027-02-15/);
    assert.match(await page.locator('#snapshot-match').innerText(), /固定済み/);
    assert.equal((await page.locator('#snapshot-numbers').innerText()), frozen);
    await page.click('#recalculate');
    assert.match(await page.locator('#recalc-status').innerText(), /手入力予定、確定・実績、ロールの状態は変えていません/);
    await page.screenshot({ path: path.join(evidenceDir, 'screen.png'), fullPage: true });
    fs.writeFileSync(path.join(evidenceDir, 'evidence.json'), JSON.stringify({
      page: 'roll-dashboard.html',
      data: 'anonymous',
      externalRequests: blocked,
      checks: ['search', 'basis', 'manual-plan-kept', 'snapshot-frozen', 'warning-separate']
    }, null, 2));
    assert.deepEqual(blocked, []);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
