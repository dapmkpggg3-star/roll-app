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
        { id: 'A', name: '#10-A', status: 'オンライン', currentDiameter: 81, currentCaliber: 'ca', openingRuns: 7 },
        { id: 'B', name: '#10-B', status: '新品予備（組込完了）', currentDiameter: 93, currentCaliber: 'cb', openingRuns: 2 },
        { id: 'C', name: '#10-C', status: '中古予備（バラシ前）', currentDiameter: 74 }
      ];
      setStandMasterRows([{ stand: '10', newDiameter: 99, scrapDiameter: 70 }]);
      setCuttingMasterRows([{ stand: '10', calculationCutMm: 12, standardCutMm: 4, actualAverageCutMm: 2, active: true }]);
      standPremisesCache = { status: 'loaded', data: { diametersMm: { '10': { scrapDiameter: 50, adoptedCutMm: 4 } } } };
      for (const [id, value] of Object.entries({ 'forecast-roll': 'A', 'forecast-reference': '2027-04-01', 'caliber-stand': '10', 'caliber-size': 'D10', 'caliber-current': 'ca', 'caliber-opening': '7', 'cycle-rework-days': '0', 'work-period': 'day', 'work-reserved-hours': '6', 'work-type': 'rollChange', 'work-required-hours': '6', 'work-people': '3', 'work-continuous': 'no', 'work-changeover': 'yes', 'work-three-set': 'yes' })) document.getElementById(id).value = value;
      const date = document.getElementById('work-date');
      date.value = '2027-04-02';
      date.dispatchEvent(new Event('change', { bubbles: true }));
      const day = (date, amount, size = 'D10') => ({ date, productionAmount: amount, operatingHours: amount ? 8 : 0, shift1Team: 'A', shift3Team: '', size });
      window.masterFixture = { ok: true, sourceName: 'master-fixture.xlsx', referenceDate: '2027-04-01', months: [{ month: '2027-04', classification: 'future', sizes: ['D10'], shifts: ['A'], productionTons: null, operatingHours: null }], days: [day('2027-04-01', 10), day('2027-04-02', 0)], reason: '匿名資料です。' };
      renderMonthlyScheduleSummary(window.masterFixture);
    });
    let text = await page.locator('#stand-demand-list').innerText();
    assert.match(text, /廃却径は取得済みStandMaster（70mm）/);
    assert.match(text, /計算用改削量（12mm）/);
    assert.match(text, /2027-04-02 対象はAです。廃却径以下/);
    assert.match(await page.locator('#cycle-result').innerText(), /2027-04-02 廃却需要/);
    await page.evaluate(() => { setCuttingMasterRows([{ stand: '10', calculationCutMm: '', standardCutMm: 12, actualAverageCutMm: 12, active: true }]); refreshForecastFromLoadedMasters(); });
    text = await page.locator('#stand-demand-list').innerText();
    assert.match(text, /標準値や実績平均では埋めません/);
    assert.equal(text.includes('対象はAです。廃却径以下'), false);
    assert.equal((await page.locator('#cycle-result').innerText()).includes('2027-04-02 廃却需要'), false);
    await page.evaluate(() => {
      setCuttingMasterRows([{ stand: '10', calculationCutMm: 12, active: true }]);
      renderMonthlyScheduleSummary({ ...window.masterFixture, sourceName: 'mixed-fixture.xlsx', days: window.masterFixture.days.concat(
        { date: '2027-04-03', productionAmount: 10, operatingHours: 8, shift1Team: '', shift3Team: 'A', size: 'D10' },
        { date: '2027-04-04', productionAmount: 10, operatingHours: 8, shift1Team: 'A', size: 'D13' }
      ) });
    });
    text = await page.locator('#stand-demand-list').innerText();
    assert.match(text, /選択中の1サイズには丸めません/);
    assert.match(text, /2027-04-02 対象はAです。廃却径以下/);
    assert.match(text, /2027-04-04にBを止めました/);
    assert.match(await page.locator('#cycle-result').innerText(), /選択中の1サイズには丸めません/);
    assert.match(text, /夜勤の予備不足: 2027-04-03 操業中B/);
    assert.match(await page.locator('#cycle-result').innerText(), /2027-04-03 夜勤予備不足/);
    fs.mkdirSync(path.join(root, 'artifacts/roll001-dom'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'artifacts/roll001-dom/forecast-master.png'), fullPage: true });
    const anonymous = await context.newPage();
    await anonymous.goto('http://roll-app.test/anonymous-check.html');
    await anonymous.evaluate(() => { window.getStandMaster = () => { throw Error('real master accessed'); }; window.getCuttingMaster = window.getStandMaster; });
    await anonymous.locator('#anon-example-ready').click();
    assert.equal(await anonymous.evaluate(() => Object.keys(loadedForecastMasters('10')).length), 0);
    console.log('FORECAST MASTER browser PASS');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
