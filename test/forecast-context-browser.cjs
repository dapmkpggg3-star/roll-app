const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://roll-app.test') return route.abort();
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
      return route.fulfill({ path: file, contentType: types[path.extname(file)] || 'text/plain' });
    });
    const page = await context.newPage();
    await page.goto('http://roll-app.test/index.html');
    await page.evaluate(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';
      document.body.classList.remove('simple-overview');
      roles = [
        { id: 'A', name: '#10-A', status: 'オンライン', currentDiameter: 81 },
        { id: 'B', name: '#10-B', status: '新品予備（組込完了）', currentDiameter: 93 },
        { id: 'C', name: '#17-A', status: 'オンライン', currentDiameter: 81 }
      ];
      for (const [referenceAt, openingRuns] of [['2027-04-01', 7], ['2027-04-02', 1]]) {
        rememberForecastSetting({ rollId: 'A', standKey: '10', size: 'D10', referenceAt, caliberId: 'ca-' + referenceAt, openingRuns });
      }
      rememberForecastSetting({ rollId: 'B', standKey: '10', size: 'D10', referenceAt: '2027-04-01', caliberId: 'cb', openingRuns: 2 });
      for (const [id, value] of Object.entries({ 'forecast-roll': 'A', 'forecast-reference': '2027-04-01', 'caliber-stand': '10', 'caliber-size': 'D10', 'life-scrap': '77', 'life-cut': '4', 'cycle-rework-days': '1' })) document.getElementById(id).value = value;
      standPremisesCache = { status: 'loaded', data: { diametersMm: { '10': { scrapDiameter: 77, adoptedCutMm: 4 } } } };
      resetConfirmationContext(false);
      activeForecastContext = null;
      const day = (date, amount) => ({ date, productionAmount: amount, operatingHours: amount ? 8 : 0, shift1Team: 'A', shift3Team: '', size: 'D10' });
      renderMonthlyScheduleSummary({ ok: true, sourceName: 'context-test.xlsx', referenceDate: '2027-04-01', months: [{ month: '2027-04', classification: 'future', sizes: ['D10'], shifts: ['A'], productionTons: null, operatingHours: null }], days: [day('2027-04-01', 10), day('2027-04-02', 10), day('2027-04-03', 0)], reason: '匿名の入力です。' });
      syncForecastSettingContext();
    });
    const change = async (id, value) => {
      const field = page.locator('#' + id);
      if (await field.evaluate(node => node.tagName) === 'SELECT') await field.selectOption(value);
      else await field.fill(value);
      await field.dispatchEvent('change');
    };
    for (const [id, value] of Object.entries({ 'work-date': '2027-04-03', 'work-period': 'day', 'work-type': 'rollChange', 'work-required-hours': '6', 'work-reserved-hours': '6', 'work-people': '3', 'work-continuous': 'no', 'work-changeover': 'yes', 'work-three-set': 'yes' })) await change(id, value);
    assert.match(await page.locator('#cycle-result').innerText(), /2027-04-03 ロール替/);
    await change('forecast-reference', '2027-04-02');
    assert.equal(await page.locator('#caliber-opening').inputValue(), '1');
    assert.equal(await page.locator('#work-date').inputValue(), '');
    assert.match(await page.locator('#stand-demand-list').innerText(), /基準日は2027-04-02/);
    assert.match(await page.locator('#stand-demand-list').innerText(), /対象期間は2027-04-02から2027-04-03/);
    assert.match(await page.locator('#cycle-result').innerText(), /対象期間は2027-04-02から2027-04-03/);
    await change('forecast-reference', '2027-04-01');
    assert.equal(await page.locator('#work-date').inputValue(), '2027-04-03');
    for (const [id, alternate, original] of [['forecast-roll', 'B', 'A'], ['caliber-stand', '17', '10'], ['caliber-size', 'D13', 'D10']]) {
      await change(id, alternate);
      assert.equal(await page.locator('#work-date').inputValue(), '');
      await change(id, original);
      assert.equal(await page.locator('#work-date').inputValue(), '2027-04-03');
    }
    await page.locator('#monthly-schedule-file').setInputFiles({ name: 'bad.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid anonymous workbook') });
    await page.waitForFunction(() => currentMonthlySummary() === null);
    assert.equal(await page.locator('#work-date').inputValue(), '');
    assert.equal((await page.locator('#stand-demand-list').innerText()).includes('context-test.xlsx'), false);
    fs.mkdirSync(path.join(root, 'artifacts/roll001-dom'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'artifacts/roll001-dom/forecast-context.png'), fullPage: true });
    console.log('FORECAST CONTEXT browser PASS');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
