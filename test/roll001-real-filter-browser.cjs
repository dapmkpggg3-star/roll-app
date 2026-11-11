// ROLL-001 browser integration: REAL app search/status/memo filters and task
// navigation, with synthetic roles and DOM rows. No network, auth, Sheets or GAS.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const src=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const onlineSafetySource=fs.readFileSync(path.join(__dirname,'../js/online-safety.js'),'utf8');
function slice(from,to){
  const a=src.indexOf(from), b=src.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,'missing actual app function: '+from);
  return src.slice(a,b);
}
function safetySlice(from,to){
  const a=onlineSafetySource.indexOf(from), b=onlineSafetySource.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,'missing production online-safety function: '+from);
  return onlineSafetySource.slice(a,b);
}
function status(name){
  const match=src.match(new RegExp("const "+name+" = '([^']+)';"));
  assert.ok(match,'missing status constant '+name);
  return match[1];
}
const list=src.match(/const ALLOWED_STATUSES\s*=\s*\[([\s\S]*?)\];/);
assert.ok(list);
const allowed=[...list[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
const names=['USED_STANDBY_STATUS','NEW_READY_STATUS','ONLINE_STATUS','NEW_STORAGE_STATUS','ORDERED_WAITING_STATUS','SCRAP_WAITING_STATUS','DISCARDED_STATUS','LEGACY_SCRAP_WAITING_STATUS'];
const parts=names.map(n=>'const '+n+' = '+JSON.stringify(status(n))+';');
parts.push('const ALLOWED_STATUSES = '+JSON.stringify(allowed)+';');
parts.push("let roles=[],statusFilter='all',searchQuery='',memoOnlyFilter=false,watchStandFilter=null;");
parts.push("const TODAY_TASK_DASHBOARD_CONFIG={}; const TASK_PRIORITY_LABELS={high:'高',medium:'中',low:'低'};");
parts.push(safetySlice('    function getStandKey(roleName) {', '    function isOnline(role) {'));
parts.push("function compareUpdatedAt(a,b,o){return o==='asc'?a.updatedAt-b.updatedAt:b.updatedAt-a.updatedAt;}");
parts.push("function escapeHtml(v){return String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}");
parts.push("function getTodayTaskItems(){return window.__tasks||[];} function getTodayTaskWarning(){return '';} function getTodayTaskElapsedClass(){return 'is-normal';} function syncCollapsibleDashboardState(){}");
parts.push(slice('function normalizeRoleStatusValue(status)','function isPurchaseHandledStatus(status)'));
parts.push(slice('function hasMemoText(role)','function toggleMemoOnlyFilter(event)'));
parts.push(slice('function isStatusMatched(role)','function getStatusSummaryCategory(role)'));
parts.push(slice('function isWatchStandMatched(role)','function isThreeSetForecastStandKey(standKey)'));
parts.push(slice('function getFilteredRoles()','function getEmptyRoleListMessage()'));
parts.push(slice('function updateTodayTaskDashboard(allRoles)','function getWorkshopRoleLines('));
parts.push(slice('function handleTodayTaskKeydown(event, taskId)','function focusTodayTaskRole(taskId)'));
parts.push(slice('function focusTodayTaskRole(taskId)','function getWatchStandItems(allRoles)'));
parts.push(slice('function showToast(message)','function scrollPageToTop()'));
parts.push("window.__prepare=(state)=>{roles=state.roles.map(r=>({...r}));statusFilter=state.statusFilter||'all';searchQuery=state.searchQuery||'';memoOnlyFilter=!!state.memoOnlyFilter;watchStandFilter=state.watchStandFilter||null;window.__tasks=[state.task];const tbody=document.getElementById('role-list');tbody.replaceChildren();for(const role of getFilteredRoles()){const tr=document.createElement('tr');tr.id='role-'+role.id;const td=document.createElement('td');td.textContent=role.name+' / '+role.status;tr.appendChild(td);tbody.appendChild(tr);}updateTodayTaskDashboard(roles);};");
parts.push("window.__visible=()=>getFilteredRoles().map(r=>r.id);window.__states=()=>roles.map(r=>[r.id,r.status]);window.__standKey=n=>getStandKey(n);");
const injected=parts.join('\n');
new Function(injected); // fail early on source-injection syntax mistakes

const roles=[
 {id:'10-A',name:'#10-A',status:status('USED_STANDBY_STATUS'),memo:'',updatedAt:10},
 {id:'10-B',name:'#10-B',status:status('NEW_READY_STATUS'),memo:'filter-visible',updatedAt:30},
 {id:'10-C',name:'#10-C',status:status('ONLINE_STATUS'),memo:'filter-visible',updatedAt:50},
 {id:'10-D',name:'#10-D',status:status('SCRAP_WAITING_STATUS'),memo:'',updatedAt:100},
 {id:'10-E',name:'#10-E',status:status('NEW_STORAGE_STATUS'),memo:'',updatedAt:99},
 {id:'10-F',name:'#10-F',status:status('ORDERED_WAITING_STATUS'),memo:'',updatedAt:98}
];
const assembly={id:'assembly-10',standKey:'10',standLabel:'#10',title:'組替候補あり',priority:'medium',elapsedDays:0};
const reserve={id:'reserve-shortage-10',standKey:'10',standLabel:'#10',title:'予備準備の予定を確認',priority:'low',elapsedDays:0};
async function main(){
  const dir=path.join(__dirname,'../artifacts/roll001-real-filter');
  fs.mkdirSync(dir,{recursive:true});
  const checked=[];
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:1080,height:700}});
    await context.route('**/*',route=>route.abort('blockedbyclient'));
    const page=await context.newPage();
    await page.setContent('<!doctype html><html lang="ja"><meta charset="utf-8"><style>body{font-family:sans-serif;padding:30px}.wrap{display:flex;gap:28px}#today-task-dashboard{width:450px;padding:18px;border:1px solid #aaa}.today-task-item{cursor:pointer;padding:16px;margin:8px;border:1px solid #aaa}td{padding:16px;border:1px solid #aaa}.today-task-target-highlight{outline:5px solid orange;background:#ffedac}</style><h1>ROLL-001 実フィルタ隔離試験（架空データ）</h1><div class="wrap"><section id="today-task-dashboard">本日のタスク <span id="today-task-count"></span><div id="today-task-list"></div></section><table><tbody id="role-list"></tbody></table></div>');
    await page.addScriptTag({content:injected});
    assert.equal(await page.evaluate(()=>window.__standKey('＃１０－Ａ')),'10');
    assert.equal(await page.evaluate(()=>window.__standKey('#11-B')),'11');
    checked.push('production online-safety stand key handles normalized and ASCII labels');
    async function prepare(task,options={}){await page.evaluate(x=>window.__prepare(x),{roles,task,...options});}
    async function click(){await page.locator('.today-task-item').click();await page.waitForTimeout(450);}
    async function snap(name){await page.screenshot({path:path.join(dir,name),fullPage:true});}
    await prepare(reserve);
    assert.deepEqual(await page.evaluate(()=>window.__visible()),['10-A','10-B','10-C']);
    await click();
    assert.equal(await page.locator('.today-task-target-highlight').count(),0);
    assert.ok((await page.locator('body').innerText()).includes('現物・改削搬入予定・組替予定'));
    assert.equal(await page.locator('#role-10-D').count(),0);
    await snap('01-default-filter.png');
    checked.push('real default filter hides excluded statuses; readiness makes no false online navigation');

    await prepare(assembly,{searchQuery:'filter-visible'});
    assert.deepEqual(await page.evaluate(()=>window.__visible()),['10-B','10-C']);
    await snap('02-search-before.png');
    const state=await page.evaluate(()=>window.__states());
    await click();
    assert.equal(await page.locator('.today-task-target-highlight').count(),0);
    assert.ok((await page.locator('body').innerText()).includes('対象ロールは現在の表示条件では見つかりません'));
    assert.deepEqual(await page.evaluate(()=>window.__states()),state);
    await snap('03-search-hidden.png');
    checked.push('real search filter blocks hidden assembly target; no wrong redirect/mutation');

    await prepare(reserve,{statusFilter:status('USED_STANDBY_STATUS')});
    assert.deepEqual(await page.evaluate(()=>window.__visible()),['10-A']);
    await click();
    assert.equal(await page.locator('.today-task-target-highlight').count(),0);
    checked.push('real explicit status filter blocks hidden reserve target');

    await prepare(reserve,{statusFilter:status('SCRAP_WAITING_STATUS')});
    assert.deepEqual(await page.evaluate(()=>window.__visible()),['10-D']);
    await click();
    assert.equal(await page.locator('.today-task-target-highlight').count(),0);
    checked.push('explicit scrap filter shows scrap but does not redirect reserve task');

    await prepare(assembly,{memoOnlyFilter:true});
    assert.deepEqual(await page.evaluate(()=>window.__visible()),['10-B','10-C']);
    await click();
    assert.equal(await page.locator('.today-task-target-highlight').count(),0);
    await snap('04-memo-only.png');
    checked.push('real memo-only filter blocks hidden assembly target');

    fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify({status:'PASS',test:'real app getFilteredRoles + task handler, synthetic role rows',assertions:checked,noLiveConnections:true},null,2));
    console.log('ROLL-001 REAL FILTER DOM assertions PASS:',checked.length);
    checked.forEach(x=>console.log(' - '+x));
  }finally{await browser.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
