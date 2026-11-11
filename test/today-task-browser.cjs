// Browser-only DOM integration check, using selected real app functions and
// synthetic roles. No authentication, live app, localStorage, network, or Sheets.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
function section(first, next) {
  const start = source.indexOf(first);
  const end = source.indexOf(next, start + first.length);
  assert.ok(start >= 0 && end > start, 'app source section missing: ' + first);
  return source.slice(start, end);
}
function statusConstant(name) {
  const match = source.match(new RegExp("const " + name + " = '([^']+)';"));
  assert.ok(match, 'app status constant missing: ' + name);
  return match[1];
}
const statusesMatch = source.match(/const ALLOWED_STATUSES\s*=\s*\[([\s\S]*?)\];/);
assert.ok(statusesMatch, 'app ALLOWED_STATUSES missing');
const allowedStatuses = [...statusesMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const statusNames = [
  'USED_STANDBY_STATUS', 'NEW_READY_STATUS', 'NEW_STORAGE_STATUS',
  'ORDERED_WAITING_STATUS', 'SCRAP_WAITING_STATUS', 'DISCARDED_STATUS',
  'ONLINE_STATUS'
];
const constants = statusNames.map(name => 'const ' + name + ' = ' + JSON.stringify(statusConstant(name)) + ';').join('\n');
const renderer = section('function updateTodayTaskDashboard(allRoles)', 'function getWorkshopRoleLines(');
const selector = section('function focusTodayTaskRole(taskId)', 'function getWatchStandItems(allRoles)');
const scrollAndToast = section('function showToast(message)', 'function scrollPageToTop()');
const stubs = [
  'let roles = []; let visibleIds = new Set();',
  'const ALLOWED_STATUSES = ' + JSON.stringify(allowedStatuses) + ';',
  'const TASK_PRIORITY_LABELS = { high: "高", medium: "中", low: "低" };',
  'const TODAY_TASK_DASHBOARD_CONFIG = {};',
  'function getTodayTaskItems() { return window.__tasks || []; }',
  'function getTodayTaskWarning() { return ""; }',
  'function getTodayTaskElapsedClass() { return "is-normal"; }',
  'function syncCollapsibleDashboardState() {}',
  'function getFilteredRoles() { return roles.filter(role => visibleIds.has(role.id)); }',
  'function getStandKey(name) { const match = String(name).match(/#(\d+)/); return match ? match[1] : ""; }',
  'function compareUpdatedAt(a,b,order) { return order === "desc" ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt; }',
  'function escapeHtml(input) { return String(input).replace(/[&<>"\x27]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\x27":"&#39;"}[ch])); }',
  'window.__setFixtures = (state) => { roles = state.roles; visibleIds = new Set(state.visibleIds); window.__tasks = state.tasks; const root = document.getElementById("role-list"); root.replaceChildren(); roles.filter(role => visibleIds.has(role.id)).forEach(role => { const row = document.createElement("tr"); row.id = "role-" + role.id; const td = document.createElement("td"); td.textContent = role.name + " / " + role.status; row.appendChild(td); root.appendChild(row); }); updateTodayTaskDashboard(roles); };',
  'window.__getStatusSnapshot = () => roles.map(role => ({ id: role.id, status: role.status }));'
].join('\n');
const keyboard = section('function handleTodayTaskKeydown(event, taskId)', 'function focusTodayTaskRole(taskId)');
const browserCode = [constants, stubs, renderer, keyboard, selector, scrollAndToast].join('\n');

const out = path.join(__dirname, '../artifacts/roll001-dom');
fs.mkdirSync(out, { recursive: true });
const roleFixtures = [
  {id:'10-A',name:'#10-A',status:statusConstant('USED_STANDBY_STATUS'),updatedAt:10},
  {id:'10-B',name:'#10-B',status:statusConstant('NEW_READY_STATUS'),updatedAt:30},
  {id:'10-C',name:'#10-C',status:statusConstant('ONLINE_STATUS'),updatedAt:50},
  {id:'10-D',name:'#10-D',status:statusConstant('SCRAP_WAITING_STATUS'),updatedAt:80}
];
const assemblyTask = { id:'assembly-10',standKey:'10',standLabel:'#10',title:'組替候補あり',priority:'medium',elapsedDays:0 };
const reserveTask = { id:'reserve-shortage-10',standKey:'10',standLabel:'#10',title:'予備不足確認',priority:'low',elapsedDays:0 };
async function runBrowserDom() {
let browser;
const checked = [];
try {
  browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const context = await browser.newContext({ viewport: {width:1100,height:720} });
  await context.route('**/*', route => route.abort('blockedbyclient'));
  const page = await context.newPage();
  await page.setContent('<!doctype html><html lang="ja"><meta charset="utf-8"><style>body{font-family:sans-serif;padding:28px;background:#fafafa} .wrap{display:flex;gap:36px}#today-task-dashboard{width:420px;border:1px solid #aaa;padding:20px;background:white}#role-list{width:420px}#role-list tr{height:60px;background:white}#role-list td{padding:10px;border:1px solid #ccc}.today-task-item{cursor:pointer;margin:9px 0;padding:18px;border:1px solid #ccc;background:#f7faff}.today-task-target-highlight{outline:5px solid #ef9300;background:#fff1c1!important}</style><h1>ROLL-001 隔離DOM検証（架空データ）</h1><div class="wrap"><section id="today-task-dashboard"><h2>本日のタスク <span id="today-task-count"></span></h2><div id="today-task-list"></div></section><table><tbody id="role-list"></tbody></table></div>');
  await page.addScriptTag({ content: browserCode });
  async function reset(visibleIds, tasks) {
    await page.evaluate(state => window.__setFixtures(state), {roles:roleFixtures,visibleIds,tasks});
  }
  async function screenshot(name) { await page.screenshot({path:path.join(out,name),fullPage:true}); }
  await reset(['10-A','10-B','10-C'],[assemblyTask]);
  await screenshot('01-before-visible.png');
  const before = await page.evaluate(() => window.__getStatusSnapshot());
  await page.locator('.today-task-item').click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#role-10-A.today-task-target-highlight.today-task-target-medium').count(),1,'visible intended role must highlight');
  assert.equal(await page.locator('#role-10-B.today-task-target-highlight').count(),0,'wrong role must not highlight');
  assert.deepEqual(await page.evaluate(() => window.__getStatusSnapshot()),before,'click must not mutate roles');
  await screenshot('02-after-visible.png');
  checked.push('visible assembly target highlights correct row without mutation');

  await reset(['10-B','10-C'],[assemblyTask]);
  await screenshot('03-before-hidden.png');
  await page.locator('.today-task-item').click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.today-task-target-highlight').count(),0,'must not redirect to another visible roll');
  assert.ok((await page.locator('body').innerText()).includes('対象ロールは現在の表示条件では見つかりません'),'hidden target toast missing');
  await screenshot('04-after-hidden.png');
  checked.push('hidden preferred role stops with toast, not false redirect');

  await reset(['10-A','10-B','10-C'],[reserveTask]);
  await page.locator('.today-task-item').click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#role-10-C.today-task-target-highlight.today-task-target-low').count(),1,'reserve short target must be visible ONLINE');
  assert.equal(await page.locator('#role-10-D').count(),0,'excluded scrap role must remain unrendered');
  await screenshot('05-reserve-shortage.png');
  checked.push('reserve shortage selects eligible visible role, excludes scrap');

  await reset(['10-A','10-B','10-C'],[assemblyTask]);
  await page.locator('.today-task-item').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#role-10-A.today-task-target-highlight').count(),1,'Enter action must match click');
  await screenshot('06-keyboard.png');
  checked.push('keyboard Enter opens the same correct target');

  fs.writeFileSync(path.join(out,'evidence.json'), JSON.stringify({
    source:'js/app.js extracted real renderer/handler/selector/toast/scroll',
    testScope:'isolated browser DOM fixture: not full authenticated app',
    assertions:checked,
    result:'passed',
    status:'no network/localStorage/GAS/Sheets',
    runAt:new Date().toISOString()
  },null,2));
  console.log('ROLL-001 browser DOM assertions PASS:', checked.length);
  for(const item of checked) console.log(' - '+item);
} catch (error) {
  fs.writeFileSync(path.join(out,'error.txt'),String(error.stack||error));
  console.error(error);
  process.exitCode=1;
} finally {
  if(browser) await browser.close();
}
}
runBrowserDom().catch(error => { console.error(error); process.exitCode = 1; });
