const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

function uint16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}
function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}
function storedZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const local = Buffer.concat([
      uint32(0x04034b50), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(0), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0),
      nameBytes, data
    ]);
    const central = Buffer.concat([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(0), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0),
      uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  });
  const central = Buffer.concat(centrals);
  const end = Buffer.concat([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(centrals.length), uint16(centrals.length),
    uint32(central.length), uint32(offset), uint16(0)
  ]);
  return Buffer.concat([...locals, central, end]);
}
function anonymousScheduleFile() {
  const rows = [];
  for (let day = 1; day <= 20; day += 1) {
    const row = day + 15;
    const amount = day === 2 ? `<c r="J${row}" t="s"><v>1</v></c>` : `<c r="J${row}"><v>10</v></c>`;
    const hours = day === 2 ? `<c r="P${row}" t="s"><v>1</v></c>` : `<c r="P${row}" t="str"><v>7.00</v></c>`;
    rows.push(`<row r="${row}">${[
      `<c r="D${row}"><v>${day}</v></c>`,
      `<c r="G${row}" t="s"><v>0</v></c>`,
      `<c r="H${row}" t="s"><v>2</v></c>`,
      `<c r="I${row}" t="s"><v>3</v></c>`,
      amount,
      hours
    ].join('')}</row>`);
  }
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
  const file = path.join(os.tmpdir(), 'roll-anon-schedule.xlsx');
  fs.writeFileSync(file, storedZip({
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="25.04 生産予定" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>D1</t></si><si><t> </t></si><si><t>A</t></si><si><t>B</t></si></sst>',
    'xl/worksheets/sheet1.xml': sheet
  }));
  return file;
}
function futureScheduleFile() {
  const rows = [];
  for (let day = 1; day <= 20; day += 1) {
    const row = day + 15;
    const producing = day === 1 || day === 3 || day === 4;
    rows.push(`<row r="${row}">${[
      `<c r="D${row}"><v>${day}</v></c>`,
      `<c r="G${row}" t="s"><v>0</v></c>`,
      `<c r="I${row}" t="s"><v>${producing ? 2 : 3}</v></c>`,
      `<c r="J${row}"><v>${producing ? 10 : 0}</v></c>`,
      `<c r="L${row}"><v>${producing ? 10 : 0}</v></c>`,
      `<c r="N${row}"><v>0</v></c>`,
      `<c r="P${row}"><v>${producing ? 8 : 0}</v></c>`
    ].join('')}</row>`);
  }
  const file = path.join(os.tmpdir(), 'roll-anon-future.xlsx');
  fs.writeFileSync(file, storedZip({
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="27.04 生産予定" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>D1</t></si><si><t> </t></si><si><t>A</t></si><si><t>B</t></si></sst>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`
  }));
  return file;
}
function normalGuideFile() {
  const rows = [];
  for (let day = 1; day <= 20; day += 1) {
    const row = day + 15;
    const producing = day === 1;
    rows.push(`<row r="${row}">${[
      `<c r="D${row}"><v>${day}</v></c>`,
      `<c r="G${row}" t="s"><v>0</v></c>`,
      `<c r="I${row}" t="s"><v>${producing ? 2 : 3}</v></c>`,
      `<c r="J${row}"><v>${producing ? 10 : 0}</v></c>`,
      `<c r="L${row}"><v>${producing ? 10 : 0}</v></c>`,
      `<c r="N${row}"><v>0</v></c>`,
      `<c r="P${row}"><v>${producing ? 8 : 0}</v></c>`
    ].join('')}</row>`);
  }
  const file = path.join(os.tmpdir(), 'roll-anon-guide.xlsx');
  fs.writeFileSync(file, storedZip({
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="27.04 生産予定" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>D10</t></si><si><t> </t></si><si><t>A</t></si><si><t>B</t></si></sst>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`
  }));
  return file;
}
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
    await page.locator('#monthly-schedule-file').setInputFiles(anonymousScheduleFile());
    await page.waitForFunction(() => document.getElementById('monthly-schedule-summary').textContent.includes('2025-04'));
    const imported = await page.locator('#monthly-schedule-summary').innerText();
    assert.match(imported, /2025-04 過去の予定/);
    assert.match(imported, /トン数未確認/);
    assert.match(imported, /操業時間は未確認/);
    assert.match(imported, /今の実績にも、これからの年間計画にも使いません/);
    assert.match(imported, /不足なしとは判定しません/);
    const consumption = await page.locator('#consumption-link').innerText();
    assert.match(consumption, /過去の月/);
    assert.match(consumption, /8直/);
    assert.match(consumption, /4時間以上/);
    await page.locator('#caliber-stand').fill('10');
    await page.locator('#caliber-size').fill('D1');
    await page.locator('#caliber-current').fill('anon-1');
    await page.locator('#caliber-opening').fill('6');
    await page.locator('#monthly-schedule-file').setInputFiles(futureScheduleFile());
    await page.waitForFunction(() => document.getElementById('consumption-link').textContent.includes('交換候補は2027-04-02'));
    const candidate = await page.locator('#consumption-link').innerText();
    assert.match(candidate, /交換候補は2027-04-02/);
    assert.match(candidate, /改削日でも購入日でもありません/);
    await page.locator('#caliber-stand').fill('12');
    await page.locator('#caliber-size').fill('D10');
    await page.locator('#caliber-current').fill('anon-1');
    await page.locator('#caliber-opening').fill('11');
    await page.locator('#monthly-schedule-file').setInputFiles(normalGuideFile());
    await page.waitForFunction(() => document.getElementById('consumption-link').textContent.includes('通常11直の目安'));
    const guide = await page.locator('#consumption-link').innerText();
    assert.match(guide, /確定最大は未確認/);
    assert.equal(guide.includes('交換候補は'), false);
    await page.locator('#caliber-stand').fill('7');
    await page.locator('#caliber-opening-tons').fill('1000');
    await page.locator('#caliber-opening-tons').dispatchEvent('change');
    await page.waitForFunction(() => document.getElementById('consumption-link').textContent.includes('19直'));
    const tons = await page.locator('#consumption-link').innerText();
    assert.match(tons, /15直/);
    assert.match(tons, /19直/);
    assert.match(tons, /交換日は出しません/);
    assert.equal(tons.includes('交換候補は'), false);
    await page.locator('#caliber-stand').fill('4');
    await page.locator('#caliber-opening').fill('');
    await page.locator('#caliber-opening-tons').fill('13000');
    await page.locator('#caliber-opening-tons').dispatchEvent('change');
    await page.waitForFunction(() => document.getElementById('consumption-link').textContent.includes('基準15,000tより前'));
    const reference = await page.locator('#consumption-link').innerText();
    assert.match(reference, /規定37直/);
    assert.match(reference, /参考候補を出しません/);
    assert.equal(reference.includes('交換候補は'), false);
    await page.locator('#caliber-stand').fill('2');
    await page.locator('#caliber-pass').selectOption('pass');
    await page.locator('#caliber-opening').fill('33');
    await page.locator('#caliber-opening-tons').fill('');
    await page.locator('#monthly-schedule-file').setInputFiles(futureScheduleFile());
    await page.waitForFunction(() => document.getElementById('consumption-link').textContent.includes('規定到達の参考候補は2027-04-02'));
    const reached = await page.locator('#consumption-link').innerText();
    assert.match(reached, /到達見込みは2027-04-03/);
    assert.equal(reached.includes('超えます'), false);
    assert.equal(await page.evaluate(() => roles[0].status), 'オンライン');
    assert.equal(await page.evaluate(() => roles[0].status), 'オンライン');
    assert.equal(outbound.length, 0);
    console.log('OPERATING PLAN browser PASS');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
