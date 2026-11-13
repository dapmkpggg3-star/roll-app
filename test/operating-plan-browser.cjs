const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const outbound = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      let url;
      try { url = new URL(route.request().url()); } catch (error) { return route.abort('blockedbyclient'); }
      if (url.protocol !== 'http:' || url.hostname !== 'roll-app.test') { outbound.push(url.href); return route.abort('blockedbyclient'); }
      const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const absolute = path.resolve(root, `.${rel}`);
      if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) return route.abort('blockedbyclient');
      return route.fulfill({ path: absolute, contentType: mime[path.extname(absolute)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    await page.goto('http://roll-app.test/index.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';
      roles = [{ id: 'anon-plan', name: '#10-A', status: 'オンライン', memo: '', updatedAt: '2026-11-13T00:00:00.000Z', history: [] }];
      localStorage.removeItem('operating_plan_revisions_v1');
      localStorage.removeItem('stand_lead_times_v1');
    });
    await page.locator('#detailModeBtn').click();
    assert.equal(await page.locator('#operating-plan-panel').isVisible(), true);
    await page.locator('#save-lead-time').click();
    assert.match(await page.locator('#stand-lead-time-list').innerText(), /暫定/);
    await page.locator('#operating-plan-months').fill('2026-04');
    await page.locator('#operating-plan-row-month').fill('2026-04');
    await page.locator('#operating-plan-planned').fill('2');
    await page.locator('#save-operating-plan').click();
    await page.locator('#operating-plan-id').fill('plan-anon-2');
    await page.locator('#operating-plan-updated-at').fill('2026-12-01T00:00:00.000Z');
    await page.locator('#operating-plan-planned').fill('4');
    await page.locator('#operating-plan-actual').fill('1');
    await page.locator('#save-operating-plan').click();
    assert.match(await page.locator('#operating-plan-diff').innerText(), /変更2/);
    assert.equal(await page.evaluate(() => roles[0].status), 'オンライン');
    const forecast = await page.evaluate(() => forecastThreeSetFromPlan({
      standKey: '10', revision: null, remainingCutCount: 2, activeThreeSetCount: 3, leadTime: defaultStandLeadTime('10')
    }));
    assert.equal(forecast.shortage, 'unknown');
    const summaryText = await page.evaluate(() => {
      const summary = summarizeMonthlyProductionSchedule([
        { date: '2025-04-01', size: 'D10', productionAmount: 120, shift1Team: 'A', shift3Team: 'B' }
      ], '2026-11-13');
      renderMonthlyScheduleSummary(summary);
      return document.getElementById('monthly-schedule-summary').textContent;
    });
    assert.match(summaryText, /120トン/);
    assert.match(summaryText, /過去の予定/);
    assert.match(summaryText, /今の実績にも/);
    assert.match(summaryText, /不足なしとは判定しません/);
    const hoursText = await page.evaluate(() => {
      const summary = summarizeMonthlyProductionSchedule([
        { date: '2026-10-01', size: 'D10', productionAmount: 10, shift1Team: 'A', shift3Team: 'B', operatingHours: 7 }
      ], '2026-11-13');
      renderMonthlyScheduleSummary(summary);
      return document.getElementById('monthly-schedule-summary').textContent;
    });
    assert.match(hoursText, /操業時間7/);
    assert.match(hoursText, /今の実績にも/);
    assert.equal(outbound.length, 0);
    console.log('OPERATING PLAN browser PASS');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
