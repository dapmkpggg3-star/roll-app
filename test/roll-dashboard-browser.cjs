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
    await context.addInitScript(() => {
      window.__storageCalls = { setItem: 0, removeItem: 0, clear: 0 };
      ['setItem', 'removeItem', 'clear'].forEach(name => {
        const original = Storage.prototype[name];
        Storage.prototype[name] = function (...args) {
          window.__storageCalls[name] += 1;
          return original.apply(this, args);
        };
      });
    });
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
    const summaryText = () => page.locator('#dashboard-rows tr[data-roll]').evaluateAll(rows => rows.map(row => row.innerText).join('\n'));
    const initial = await summaryText();
    assert.match(initial, /#16-ANON-3/);
    assert.match(initial, /#10-ANON-1/);
    assert.match(initial, /改削 2027-01-20/);
    assert.match(initial, /作業枠未確認/);
    assert.equal(initial.includes('2027-04-02'), false);
    assert.match(initial, /予備0本/);
    assert.equal(initial.includes('不足なし'), false);
    assert.equal(await page.locator('#dashboard-rows tr[data-roll]').first().getAttribute('data-roll'), '#16-ANON-3');
    const manualColor = await page.locator('.is-manual-plan').first().evaluate(element => getComputedStyle(element).color);
    const warningColor = await page.locator('.is-warning').first().evaluate(element => getComputedStyle(element).color);
    assert.notEqual(manualColor, warningColor);

    await page.fill('#filter-stand', '#10');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr[data-roll]').length === 1);
    let visible = await summaryText();
    assert.match(visible, /#10-ANON-1/);
    assert.equal(visible.includes('#16-ANON-3'), false);
    assert.equal(visible.includes('2027-04-02'), false);
    await page.locator('button[data-basis="#10-ANON-1"]').click();
    const basis = await page.locator('.basis:not([hidden])').innerText();
    assert.match(basis, /計算式/);
    assert.match(basis, /暫定/);
    assert.match(basis, /匿名計画A/);
    assert.match(basis, /2027-04-02/);
    assert.match(basis, /交換候補にはしません/);
    assert.match(basis, /2027-02-15/);
    assert.match(basis, /種類が違うので、日数差は出しません/);
    assert.match(basis, /入力:/);
    assert.match(basis, /判断:/);
    assert.match(basis, /EとHが班/);
    assert.match(basis, /Kが作業文言/);
    assert.match(basis, /交換可能日にはしない/);
    assert.equal((basis.match(/手入力: 使用終了/g) || []).length, 1);

    await page.fill('#filter-stand', '');
    await page.fill('#filter-roll', 'ANON-2');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr[data-roll]').length === 1);
    visible = await summaryText();
    assert.match(visible, /#11-ANON-2/);
    assert.match(visible, /作業枠未確認/);
    await page.locator('button[data-basis="#11-ANON-2"]').click();
    assert.match(await page.locator('.basis:not([hidden])').innerText(), /0回にしません/);

    await page.fill('#filter-roll', '');
    await page.fill('#filter-month', '2027-03');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr[data-roll]').length === 1);
    assert.match(await summaryText(), /2027-03-01/);

    await page.fill('#filter-month', '');
    await page.waitForFunction(() => document.querySelectorAll('#dashboard-rows tr[data-roll]').length === 3);
    await page.click('#freeze');
    assert.match(await page.locator('#snapshot-match').innerText(), /一致しています/);
    const frozen = await page.locator('#snapshot-numbers').innerText();
    assert.match(frozen, /作業枠未確認/);
    assert.equal(frozen.includes('2027-04-02'), false);
    assert.match(frozen, /判定不能/);
    await page.selectOption('#plan-version', 'anon-plan-b');
    await page.waitForFunction(() => document.getElementById('plan-label').textContent.includes('匿名計画B'));
    assert.match(await summaryText(), /改削 2027-01-20/);
    await page.locator('button[data-basis="#10-ANON-1"]').click();
    const revisedBasis = await page.locator('.basis:not([hidden])').innerText();
    assert.match(revisedBasis, /12か月/);
    assert.match(revisedBasis, /2027-02-15/);
    assert.match(await page.locator('#snapshot-match').innerText(), /固定済み/);
    assert.equal((await page.locator('#snapshot-numbers').innerText()), frozen);
    await page.click('#recalculate');
    assert.match(await page.locator('#recalc-status').innerText(), /手入力予定、確定・実績、ロールの状態は変えていません/);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(evidenceDir, 'screen-wide.png'), fullPage: true });
    const wideOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.setViewportSize({ width: 720, height: 900 });
    await page.screenshot({ path: path.join(evidenceDir, 'screen-narrow.png'), fullPage: true });
    const narrowOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(wideOverflow < 24, `wide overflow ${wideOverflow}`);
    assert.ok(narrowOverflow < 24, `narrow overflow ${narrowOverflow}`);
    assert.match(await summaryText(), /作業枠未確認/);
    await page.setViewportSize({ width: 400, height: 800 });
    await page.locator('button[data-basis="#10-ANON-1"]').click();
    const narrowBasis = await page.locator('.basis:not([hidden])').innerText();
    assert.match(narrowBasis, /確認済み交換可能日は作業枠未確認/);
    const labels = await page.locator('tr[data-roll="#10-ANON-1"] td').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-label')));
    assert.ok(labels.includes('予定表上の交換候補日'));
    assert.ok(labels.includes('確認済み交換可能日'));
    assert.match(await page.locator('tr[data-roll="#10-ANON-1"]').innerText(), /なし/);
    assert.match(await page.locator('tr[data-roll="#10-ANON-1"]').innerText(), /作業枠未確認/);
    assert.ok(await page.locator('.basis:not([hidden]) li').count() > 1);
    await page.screenshot({ path: path.join(evidenceDir, 'screen-400.png'), fullPage: true });
    const splitOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(splitOverflow < 8, `400px overflow ${splitOverflow}`);
    assert.deepEqual(await page.evaluate(() => window.__storageCalls), { setItem: 0, removeItem: 0, clear: 0 });
    const dashboardRow = page.locator('tr[data-roll="#10-ANON-1"]');
    const exchangeDate = dashboardRow.locator('[data-label="確認済み交換可能日"]');
    const mutationCases = [
      { duplicated: false, setsWritten: 1, expected: '2027-04-02' },
      { duplicated: true, setsWritten: 1, expected: '作業枠未確認' },
      { duplicated: false, setsWritten: true, expected: '作業枠未確認' }
    ];
    for (const { expected, ...scenario } of mutationCases) {
      await page.evaluate(({ duplicated, setsWritten }) => {
        const roll = fixture.rolls[0];
        const date = '2027-04-02';
        const stopped = { date, shift1Team: 'A', daytimeStop: 'yes', productionAmount: 0, operatingHours: 0 };
        roll.days = [stopped];
        if (duplicated) roll.days.push({ date, shift1Team: 'A', productionAmount: 10, operatingHours: 8 });
        roll.replacementPlan = [{
          standKey: roll.standKey, date, workType: 'caliberChange', kind: 'plan',
          withinShift: 'yes', constraintsKnown: 'yes', setsWritten
        }];
        roll.workConfirmation = {
          date, period: 'day', workType: 'caliberChange', requiredHours: 1, reservedHours: 1, people: 3,
          continuous: 'no', changeover: 'yes', threeSet: 'yes'
        };
        render();
      }, scenario);
      assert.equal(await exchangeDate.innerText(), expected);
      assert.equal(await dashboardRow.locator('[data-label="予定表上の交換候補日"]').innerText(), '2027-04-02');
    }
    assert.deepEqual(await page.evaluate(() => window.__storageCalls), { setItem: 0, removeItem: 0, clear: 0 });
    await page.goto('http://roll-app.test/roll-management-sheet.html');
    await page.waitForSelector('#sheet-rows tr[data-roll]');
    assert.equal(await page.locator('.roll-card').count(), 3);
    const sheetText = await page.locator('#sheet-rows').innerText();
    assert.match(sheetText, /手入力予定/);
    assert.match(sheetText, /予測/);
    assert.match(sheetText, /確定・実績/);
    assert.match(sheetText, /根拠/);
    assert.match(sheetText, /警告/);
    assert.match(sheetText, /2027-02-15/);
    assert.match(sheetText, /作業枠未確認/);
    const listedCell = await page.locator('tr[data-roll="#10-ANON-1"][data-item="予定表上の交換候補日"]').innerText();
    const exchangeCell = await page.locator('tr[data-roll="#10-ANON-1"][data-item="確認済み交換可能日"]').innerText();
    assert.match(listedCell, /なし/);
    assert.equal(listedCell.includes('2027-04-02'), false);
    assert.match(exchangeCell, /作業枠未確認/);
    assert.equal(exchangeCell.includes('2027-04-02'), false);
    const paste = await page.locator('#sheet-tsv').inputValue();
    assert.match(paste, /手入力予定\t#10\t#10-ANON-1\t使用終了\t2027-02-15/);
    assert.match(paste, /予測\t#10\t#10-ANON-1\t予定表上の交換候補日\tなし/);
    assert.match(paste, /予測\t#10\t#10-ANON-1\t確認済み交換可能日\t作業枠未確認/);
    assert.match(paste, /確定・実績\t#10\t#10-ANON-1\t使用終了\t2026-08-20/);
    assert.match(paste, /警告\t#16\t#16-ANON-3\t表示\t予備0本/);
    assert.match(paste, /#11-ANON-2/);
    assert.equal(paste.includes('googleapis'), false);
    await page.click('#select-sheet');
    const selected = await page.locator('#sheet-tsv').evaluate(element => element.selectionEnd - element.selectionStart);
    assert.ok(selected > 20);
    await page.screenshot({ path: path.join(evidenceDir, 'sheet-400.png'), fullPage: true });
    const sheetOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(sheetOverflow < 8, `sheet overflow ${sheetOverflow}`);
    assert.deepEqual(await page.evaluate(() => window.__storageCalls), { setItem: 0, removeItem: 0, clear: 0 });
    await page.goto('http://roll-app.test/roll-acceptance-prep.html');
    await page.waitForSelector('#checks article');
    const prepText = await page.locator('main').innerText();
    assert.match(prepText, /手入力の使用終了/);
    assert.match(prepText, /useEndDateには入れない/);
    assert.match(prepText, /6月の同じセルは未確認/);
    assert.match(prepText, /作業文言はK/);
    assert.match(prepText, /EとHは班/);
    assert.match(prepText, /未確認のまま止め/);
    assert.match(prepText, /recordKind/);
    assert.match(prepText, /操業A/);
    assert.match(prepText, /過去の計画/);
    assert.match(prepText, /完了実績/);
    assert.match(prepText, /liveConnected false/);
    assert.match(prepText, /#10-ANON-1/);
    assert.match(prepText, /作業枠未確認/);
    assert.equal(prepText.includes('googleapis'), false);
    const prepOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(prepOverflow < 8, `prep overflow ${prepOverflow}`);
    fs.writeFileSync(path.join(evidenceDir, 'evidence.json'), JSON.stringify({
      page: 'roll-dashboard.html',
      data: 'anonymous',
      externalRequests: blocked,
      checks: ['search', 'basis', 'manual-plan-kept', 'snapshot-frozen', 'warning-separate', 'ambiguous-exchange-unconfirmed']
    }, null, 2));
    assert.deepEqual(await page.evaluate(() => window.__storageCalls), { setItem: 0, removeItem: 0, clear: 0 });
    assert.deepEqual(blocked, []);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
