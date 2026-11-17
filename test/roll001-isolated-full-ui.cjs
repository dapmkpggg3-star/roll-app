// ROLL-001 isolated full UI smoke test. Use actual index.html and bundled JS,
// never authenticate or access live servers. All data are synthetic.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'artifacts/roll001-full-ui');
fs.mkdirSync(out,{recursive:true});
const roles=[
 {id:'10-A',name:'#10-A',status:'中古予備（バラシ前）',memo:'',updatedAt:'2026-11-01T00:00:00.000Z',isActiveThreeSet:true},
 {id:'10-B',name:'#10-B',status:'新品予備（組替可能）',memo:'',updatedAt:'2026-11-03T00:00:00.000Z',isActiveThreeSet:true},
 {id:'10-C',name:'#10-C',status:'オンライン',memo:'',updatedAt:'2026-11-05T00:00:00.000Z',isActiveThreeSet:true},
 {id:'10-D',name:'#10-D',status:'廃却待ち（ラック保管）',memo:'',updatedAt:'2026-11-06T00:00:00.000Z',isActiveThreeSet:false}
];
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const failures=[],outbound=[],checks=[];
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:false});
  await context.route('**/*',async(route)=>{
   let url;
   try{url=new URL(route.request().url());}catch(e){return route.abort('blockedbyclient');}
   if(url.protocol!=='http:'||url.hostname!=='roll-app.test'){outbound.push(url.href);return route.abort('blockedbyclient');}
   const rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
   const absolute=path.resolve(root,'.'+rel);
   if(!(absolute.startsWith(root+path.sep))||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){return route.abort('blockedbyclient');}
   return route.fulfill({path:absolute,contentType:mime[path.extname(absolute)]||'application/octet-stream'});
  });
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(String(e.message)));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('http://roll-app.test/index.html',{waitUntil:'load'});
  assert.ok(await page.locator('#main-screen').count(),'real app main screen not present');
  assert.ok(await page.locator('#today-task-list').count(),'real task DOM absent');
  assert.ok(await page.evaluate(()=>typeof renderRoles==='function'&&typeof focusTodayTaskRole==='function'),'real app JS not loaded');
  checks.push('actual index.html and production script bundle loaded with network blocked');
  // This changes ONLY the disposable browser page, not authentication or storage.
  await page.evaluate(input=>{
    document.getElementById('login-screen').style.display='none';
    document.getElementById('main-screen').style.display='block';
    roles=input.map(x=>({...x}));
    searchQuery='';
    statusFilter='all';
    memoOnlyFilter=false;
    watchStandFilter=null;
    renderRoles();
    updateTodayTaskDashboard(roles);
  },roles);
  assert.equal(await page.locator('#role-10-C').count(),1,'real rendered online row missing');
  assert.equal(await page.locator('#role-10-D').count(),0,'scrap should be hidden in default view');
  const task=page.locator('.today-task-item').filter({hasText:'予備準備の予定を確認'}).first();
  assert.equal(await task.count(),1,'real generated reserve task missing');
  await page.locator('#today-task-toggle').click();
  assert.equal(await page.locator('#today-task-toggle').getAttribute('aria-expanded'),'true','dashboard did not open with a real click');
  assert.ok(await task.isVisible(),'task should be visible after user opens dashboard');
  await page.screenshot({path:path.join(out,'01-before-click.png'),fullPage:true});
  await task.click();
  await page.waitForTimeout(380);
  assert.equal(await page.locator('.today-task-target-highlight').count(),0,'readiness must not highlight a single roll');
  assert.ok((await page.locator('body').innerText()).includes('現物・改削搬入予定・組替予定'),'stand readiness instruction missing');
  assert.equal(await page.locator('#role-10-D').count(),0,'hidden scrap became visible');
  await page.screenshot({path:path.join(out,'02-after-click.png'),fullPage:true});
  checks.push('real readiness card from synthetic scrap guides stand-wide review, not an arbitrary online card');

  await page.evaluate(()=>{
    searchQuery='#10-A';
    renderRoles();
  });
  assert.equal(await page.locator('#role-10-C').count(),0,'online target should be search-hidden');
  assert.equal(await page.locator('#role-10-A').count(),1);
  assert.ok(await task.isVisible(),'task became inaccessible after real search filter changed');
  await task.click();
  await page.waitForTimeout(140);
  assert.equal(await page.locator('.today-task-target-highlight').count(),0,'wrong row highlighted');
  assert.ok((await page.locator('body').innerText()).includes('現物・改削搬入予定・組替予定'),'missing stand-wide guidance');
  await page.screenshot({path:path.join(out,'03-search-hidden.png'),fullPage:true});
  checks.push('real search filter does not cause false navigation; stand guidance remains visible');
  assert.equal(await page.evaluate(()=>roles.length),4,'synthetic roles mutated in navigation');
  checks.push('no mutation of role list by task navigation');

  // Procurement regression: inspect actual rendered dashboard, not just VM return values.
  // The three synthetic active rolls intentionally lack diameter/master data.
  await page.evaluate(input=>{
    const before=roles.map(x=>({...x}));
    updatePurchaseConfirmationBoard(before);
  },roles);
  const procurementCards=page.locator('#purchase-confirmation-list .purchase-confirmation-card');
  assert.equal(await procurementCards.count(),3,'three unhandled active rolls with missing masters must remain visible in purchase review');
  for(const name of ['#10-A','#10-B','#10-C']){
    const card=procurementCards.filter({hasText:name});
    assert.equal(await card.count(),1,'missing purchase warning for '+name);
    assert.ok((await card.innerText()).includes('安全判定不能'),'missing fail-closed label for '+name);
  }
  assert.equal(await procurementCards.filter({hasText:'#10-D'}).count(),0,'discarded roll must not be in procurement review');
  assert.equal(await page.locator('#purchase-confirmation-count').innerText(),'3件');
  // Normal app starts in simple-overview and purchase review is disabled by
  // default. Open both using the actual user-facing controls, not forced CSS.
  await page.locator('#detailModeBtn').click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('simple-overview')),false,'detail view must be enabled');
  await page.locator('#dashboard-display-settings-toggle').click();
  await page.locator('#dashboard-visibility-purchase-confirmation').check();
  assert.equal(await page.locator('#purchase-confirmation-board').evaluate(el=>el.hidden),false,'purchase review must be enabled in display settings');
  checks.push('real detail-view and dashboard settings controls expose procurement review');
  // Expand through the real UI control: CSS is-collapsed hides the cards even
  // when their DOM assertions pass. Capture the actual visible board.
  const purchaseToggle=page.locator('#purchase-confirmation-toggle');
  // Diagnose actual visibility rather than forcing clicks on hidden elements.
  const purchaseVisibility=await purchaseToggle.evaluate(el=>{
    const chain=[];
    for(let node=el;node&&chain.length<14;node=node.parentElement){
      const css=getComputedStyle(node);
      chain.push({tag:node.tagName,id:node.id,classes:node.className,display:css.display,visibility:css.visibility,opacity:css.opacity,rects:node.getClientRects().length,hidden:node.hidden});
    }
    return chain;
  });
  fs.writeFileSync(path.join(out,'purchase-visibility.json'),JSON.stringify(purchaseVisibility,null,2));
  if(!await purchaseToggle.isVisible()){
    await page.screenshot({path:path.join(out,'04-procurement-hidden-diagnostic.png'),fullPage:true});
    throw new Error('Purchase toggle hidden; ancestor computed-style evidence saved: '+JSON.stringify(purchaseVisibility));
  }
  await purchaseToggle.click();
  assert.equal(await purchaseToggle.getAttribute('aria-expanded'),'true','purchase board did not expand');
  for(const name of ['#10-A','#10-B','#10-C']){
    const card=procurementCards.filter({hasText:name});
    assert.ok(await card.isVisible(),'purchase warning not visibly rendered for '+name);
  }
  await page.locator('#purchase-confirmation-board').screenshot({path:path.join(out,'04-procurement-missing-master.png')});
  checks.push('actual procurement dashboard retains all three unhandled roles with missing master data as unknown; discarded roll excluded');

  const rework = await page.evaluate(() => {
    const previous = {
      requestFormCreatedAt: { done: true, updatedAt: '2026-08-03T01:00:00.000Z', updatedBy: 'anon-a' },
      sealConfirmedAt: { done: true, updatedAt: '2026-08-04T01:00:00.000Z', updatedBy: 'anon-a' },
      pdfCreatedAt: { done: true, updatedAt: '2026-08-05T01:00:00.000Z', updatedBy: 'anon-a' },
      vendorSentAt: { done: true, updatedAt: '2026-08-06T01:00:00.000Z', updatedBy: 'anon-a' },
      vendorContactedAt: { done: true, updatedAt: '2026-08-07T01:00:00.000Z', updatedBy: 'anon-a' },
      pickupAdjustedAt: { done: false, updatedAt: '', updatedBy: '' }
    };
    const role = {
      id: 'anon-16',
      name: '#16-anon',
      status: '中古予備（バラシ前）',
      updatedAt: '2026-08-07T01:00:00.000Z',
      requestSent: true,
      dispatchDate: '2026-08-01',
      arrivalDate: '2026-08-20',
      workProgress: previous,
      memo: '',
      isActiveThreeSet: false
    };
    const entered = settleReworkCycle(role, role.status, '改削行き（搬出可能）', '2026-11-17T00:00:00.000Z');
    applySettledReworkCycle(role, entered);
    role.status = '改削行き（搬出可能）';
    role.reworkCycleWarning = describeIncompleteReworkAdvance(role.workProgressHistory[role.workProgressHistory.length - 1]);
    const continued = settleReworkCycle(role, '改削行き（搬出可能）', '改削中', '2026-11-17T01:00:00.000Z');
    const legacy = guardMergedReworkProgress({
      ...role,
      updatedAt: '2026-11-17T04:00:00.000Z',
      dispatchDate: '2026-08-01',
      arrivalDate: '2026-08-20',
      workProgress: previous
    }, {
      ...role,
      updatedAt: '2026-11-17T04:00:00.000Z',
      dispatchDate: '2026-08-01',
      arrivalDate: '2026-08-20',
      requestSent: true,
      workProgress: previous
    }, role);
    localStorage.setItem('roles', JSON.stringify([{
      ...role,
      dispatchDate: '2026-08-01',
      arrivalDate: '2026-08-20'
    }]));
    loadLocalRoles();
    const reloaded = roles.find(item => item.id === 'anon-16');
    const standby = {
      ...role,
      status: '中古予備（バラシ前）',
      dispatchDate: '2026-08-01',
      arrivalDate: '2026-08-20',
      workProgress: previous,
      workProgressHistory: []
    };
    const installed = {
      id: 'anon-16b',
      name: '#16-new',
      status: '新品予備（組込完了）',
      memo: '',
      isActiveThreeSet: false,
      updatedAt: '2026-11-17T02:00:00.000Z'
    };
    roles = [standby, installed];
    const autoMoved = autoMoveUsedStandbyToReworkReadyForNewInstalled(installed, '2026-11-17T02:00:00.000Z');
    role.workProgress = {
      ...role.workProgress,
      dispatchDate: '2026-11-20',
      arrivalDate: '2026-12-01'
    };
    role.dispatchDate = '2026-11-20';
    role.arrivalDate = '2026-12-01';
    const kept = settleReworkCycle(role, '改削行き（搬出可能）', '改削中', '2026-11-17T03:00:00.000Z');
    roles = [role];
    searchQuery = '';
    statusFilter = 'all';
    memoOnlyFilter = false;
    watchStandFilter = null;
    renderRoles();
    editRole('anon-16');
    const text = document.querySelector('#role-anon-16 .work-progress').textContent;
    return {
      enteredCycle: entered.progress.cycleId,
      enteredDone: ['requestFormCreatedAt', 'sealConfirmedAt', 'pdfCreatedAt', 'vendorSentAt', 'vendorContactedAt', 'pickupAdjustedAt'].filter(key => entered.progress[key] && entered.progress[key].done).length,
      enteredDispatch: entered.progress.dispatchDate,
      enteredArrival: entered.progress.arrivalDate,
      historyDispatch: entered.history[0] && entered.history[0].dispatchDate,
      historyArrival: entered.history[0] && entered.history[0].arrivalDate,
      historyCount: entered.history[0] && entered.history[0].completedCount,
      judgment: entered.history[0] && entered.history[0].judgment,
      incomplete: entered.history[0] && entered.history[0].incomplete,
      continuedDone: ['requestFormCreatedAt', 'vendorContactedAt'].filter(key => continued.progress[key] && continued.progress[key].done).length,
      continuedReset: continued.reset,
      legacyCycle: legacy.workProgress.cycleId,
      legacyRevived: Boolean(legacy.workProgress.requestFormCreatedAt && legacy.workProgress.requestFormCreatedAt.done),
      legacyDispatch: legacy.dispatchDate,
      reloadedDispatch: reloaded && reloaded.dispatchDate,
      reloadedArrival: reloaded && reloaded.arrivalDate,
      autoDispatch: autoMoved[0] && autoMoved[0].dispatchDate,
      autoArrival: autoMoved[0] && autoMoved[0].arrivalDate,
      autoProgressDispatch: autoMoved[0] && autoMoved[0].workProgress.dispatchDate,
      keptDispatch: kept.progress.dispatchDate,
      keptArrival: kept.progress.arrivalDate,
      formDispatch: document.getElementById('role-dispatch-date').value,
      formArrival: document.getElementById('role-arrival-date').value,
      storedArrival: getRoleArrivalDate(role),
      text
    };
  });
  assert.equal(rework.enteredDone, 0, 'new rework cycle must render 0/6');
  assert.equal(rework.historyCount, 5);
  assert.equal(rework.judgment, '判定不能');
  assert.deepEqual(rework.incomplete, ['引き取り日設定']);
  assert.equal(rework.continuedReset, false);
  assert.equal(rework.continuedDone, 0);
  assert.equal(rework.legacyRevived, false);
  assert.equal(rework.legacyCycle, rework.enteredCycle);
  assert.equal(rework.enteredDispatch, '');
  assert.equal(rework.enteredArrival, '');
  assert.equal(rework.historyDispatch, '2026-08-01');
  assert.equal(rework.historyArrival, '2026-08-20');
  assert.equal(rework.legacyDispatch, '');
  assert.equal(rework.reloadedDispatch, '');
  assert.equal(rework.reloadedArrival, '');
  assert.equal(rework.autoDispatch, '');
  assert.equal(rework.autoArrival, '');
  assert.equal(rework.autoProgressDispatch, '');
  assert.equal(rework.keptDispatch, '2026-11-20');
  assert.equal(rework.keptArrival, '2026-12-01');
  assert.equal(rework.formDispatch, '2026-11-20');
  assert.equal(rework.formArrival, '');
  assert.equal(rework.storedArrival, '2026-12-01');
  assert.match(rework.text, /作業依頼進捗 0\/6/);
  assert.match(rework.text, /判定不能/);
  assert.match(rework.text, /引き取り日設定/);
  assert.match(rework.text, /前回搬出日 2026\/08\/01/);
  assert.match(rework.text, /前回搬入日 2026\/08\/20/);
  assert.match(rework.text, /引き取り日設定（⑥）は未完了です/);
  assert.doesNotMatch(rework.text, /仮搬入予定：2026\/08/);
  await page.locator('#role-anon-16 .work-progress').screenshot({ path: path.join(out, '05-rework-cycle-reset.png') });
  checks.push('anonymous rework re-entry renders 0/6, keeps August dates only in history, and does not revive them on reload, auto move, or sync');

  const repeated = await page.evaluate(() => {
    const progress = {
      cycleId: 'rework-anon-sync',
      dispatchDate: '',
      arrivalDate: '',
      requestFormCreatedAt: { done: true, updatedAt: '2026-11-17T01:00:00.000Z', updatedBy: 'anon-b' },
      sealConfirmedAt: { done: false, updatedAt: '', updatedBy: '' },
      pdfCreatedAt: { done: false, updatedAt: '', updatedBy: '' },
      vendorSentAt: { done: false, updatedAt: '', updatedBy: '' },
      vendorContactedAt: { done: false, updatedAt: '', updatedBy: '' },
      pickupAdjustedAt: { done: false, updatedAt: '', updatedBy: '' }
    };
    const role = {
      id: 'anon-sync',
      name: '#16-sync',
      status: '改削行き（搬出可能）',
      updatedAt: '2026-11-17T02:00:00.000Z',
      dispatchDate: '2026-08-01',
      arrivalDate: '2026-08-20',
      requestSent: true,
      reworkCycleWarning: '',
      memo: '',
      isActiveThreeSet: false,
      workProgress: progress,
      workProgressHistory: []
    };
    const loaded = applySettledReworkCycle({ ...role }, settleStoredReworkCycle(role, role.updatedAt));
    const remote = { ...loaded, updatedAt: '2026-11-17T03:00:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20', requestSent: true };
    const merged = { ...remote, workProgress: { ...remote.workProgress }, workProgressHistory: remote.workProgressHistory.slice() };
    guardMergedReworkProgress(merged, remote, loaded);
    const reloaded = applySettledReworkCycle({ ...merged, dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' }, settleStoredReworkCycle({ ...merged, dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' }, merged.updatedAt));
    const resynced = { ...reloaded, updatedAt: '2026-11-17T04:00:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20', requestSent: true, workProgress: { ...reloaded.workProgress }, workProgressHistory: reloaded.workProgressHistory.slice() };
    guardMergedReworkProgress(resynced, resynced, reloaded);
    roles = [resynced];
    searchQuery = '';
    statusFilter = 'all';
    memoOnlyFilter = false;
    watchStandFilter = null;
    renderRoles();
    const text = document.querySelector('#role-anon-sync .work-progress').textContent;
    return {
      cycleId: resynced.workProgress.cycleId,
      done: resynced.workProgress.requestFormCreatedAt.done,
      vendor: resynced.workProgress.vendorSentAt.done,
      dispatch: resynced.dispatchDate,
      arrival: resynced.arrivalDate,
      notes: resynced.workProgressHistory.filter(item => item.recordKind === 'date-reference').length,
      closedCurrent: resynced.workProgressHistory.filter(item => item.recordKind !== 'date-reference' && item.cycleId === 'rework-anon-sync').length,
      warning: resynced.reworkCycleWarning || '',
      text
    };
  });
  assert.equal(repeated.cycleId, 'rework-anon-sync');
  assert.equal(repeated.done, true);
  assert.equal(repeated.vendor, false);
  assert.equal(repeated.dispatch, '');
  assert.equal(repeated.arrival, '');
  assert.equal(repeated.notes, 1);
  assert.equal(repeated.closedCurrent, 0);
  assert.equal(repeated.warning, '');
  assert.match(repeated.text, /作業依頼進捗 1\/6/);
  assert.match(repeated.text, /前回搬出日 2026\/08\/01/);
  assert.match(repeated.text, /前回搬入日 2026\/08\/20/);
  assert.doesNotMatch(repeated.text, /仮搬入予定：2026\/08/);
  assert.doesNotMatch(repeated.text, /⑥は未完了です/);
  await page.locator('#role-anon-sync .work-progress').screenshot({ path: path.join(out, '06-rework-sync-keeps-cycle.png') });
  checks.push('repeated load and sync keep the open cycle at 1/6 and store the August dates once');

  await page.evaluate(() => {
    localStorage.removeItem('roles');
    localStorage.removeItem('current_operator');
  });
  const screen = await context.newPage();
  screen.on('dialog', dialog => dialog.accept());
  screen.on('pageerror', e => failures.push(String(e.message)));
  await screen.goto('http://roll-app.test/index.html', { waitUntil: 'load' });
  await screen.evaluate(() => {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    roles = [];
    nextId = 1;
    renderRoles();
  });
  if (await screen.locator('body').evaluate(el => el.classList.contains('simple-overview'))) {
    await screen.locator('#detailModeBtn').click();
  }
  await screen.locator('#operator-select').selectOption('hiwatashi');
  await screen.locator('#toggleRoleFormBtn').click();
  await screen.locator('#role-name').fill('#16-case1');
  await screen.locator('#role-status').selectOption('改削行き（搬出可能）');
  await screen.locator('#role-dispatch-date').fill('');
  await screen.locator('#addRoleBtn').click();
  const created = await screen.evaluate(() => {
    const role = roles.find(item => item.name === '#16-case1');
    return { cycleId: role.workProgress.cycleId, done: role.workProgress.requestFormCreatedAt.done };
  });
  assert.ok(created.cycleId, 'new rework role must receive a cycle id at registration');
  assert.equal(created.done, false);
  await screen.locator('tr', { hasText: '#16-case1' }).locator('button', { hasText: '改削依頼書作成' }).click();
  await screen.reload({ waitUntil: 'load' });
  await screen.evaluate(() => {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    renderRoles();
  });
  if (await screen.locator('body').evaluate(el => el.classList.contains('simple-overview'))) {
    await screen.locator('#detailModeBtn').click();
  }
  const reloaded = await screen.evaluate(() => {
    const role = roles.find(item => item.name === '#16-case1');
    const done = ['requestFormCreatedAt', 'sealConfirmedAt', 'pdfCreatedAt', 'vendorSentAt', 'vendorContactedAt', 'pickupAdjustedAt']
      .filter(key => role.workProgress[key] && role.workProgress[key].done).length;
    return { cycleId: role.workProgress.cycleId, done, text: document.querySelector('#role-1 .work-progress').textContent };
  });
  assert.equal(reloaded.cycleId, created.cycleId);
  assert.equal(reloaded.done, 1);
  assert.match(reloaded.text, /作業依頼進捗 1\/6/);
  await screen.locator('#role-1 .work-progress').screenshot({ path: path.join(out, '07-add-role-keeps-cycle.png') });
  const synced = await screen.evaluate(() => {
    const local = roles.find(item => item.name === '#16-case1');
    const remote = { ...local, updatedAt: '2026-11-17T13:00:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' };
    const first = { ...remote, workProgress: { ...remote.workProgress }, workProgressHistory: (remote.workProgressHistory || []).slice() };
    guardMergedReworkProgress(first, remote, local);
    const secondRemote = { ...first, updatedAt: '2026-11-17T13:05:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' };
    const second = { ...secondRemote, workProgress: { ...secondRemote.workProgress }, workProgressHistory: secondRemote.workProgressHistory.slice() };
    guardMergedReworkProgress(second, secondRemote, first);
    const mergedList = mergeRemoteAndLocalRoles([secondRemote], [first]);
    const merged = mergedList.find(item => item.name === '#16-case1');
    return {
      cycleId: second.workProgress.cycleId,
      done: second.workProgress.requestFormCreatedAt.done,
      dispatch: second.dispatchDate,
      notes: second.workProgressHistory.filter(item => item.recordKind === 'date-reference').length,
      mergedCycle: merged.workProgress.cycleId,
      mergedDone: merged.workProgress.requestFormCreatedAt.done
    };
  });
  assert.equal(synced.cycleId, created.cycleId);
  assert.equal(synced.done, true);
  assert.equal(synced.dispatch, '');
  assert.equal(synced.notes, 1);
  assert.equal(synced.mergedCycle, created.cycleId);
  assert.equal(synced.mergedDone, true);
  checks.push('adding a rework role issues a cycle id and keeps 1/6 after reload and repeated anonymous sync merge');

  await screen.locator('#toggleRoleFormBtn').click();
  await screen.locator('#role-name').fill('#16-case2');
  await screen.locator('#role-status').selectOption('改削行き（搬出可能）');
  await screen.locator('#role-dispatch-date').fill('2026-08-01');
  await screen.locator('#addRoleBtn').click();
  const case2Row = screen.locator('tr', { hasText: '#16-case2' });
  for (const label of ['改削依頼書作成', '押印確認', 'PDF化', '業者へ送信', '業者連絡']) {
    await case2Row.locator('button', { hasText: label }).click();
  }
  await case2Row.locator('button.edit-btn').click();
  await screen.locator('#role-status').selectOption('改削中');
  if (await screen.locator('#role-arrival-date').isVisible()) await screen.locator('#role-arrival-date').fill('2026-08-20');
  await screen.locator('#updateRoleBtn').click();
  await screen.locator('tr', { hasText: '#16-case2' }).locator('button.edit-btn').click();
  await screen.locator('#role-status').selectOption('中古予備（バラシ前）');
  await screen.locator('#updateRoleBtn').click();
  await screen.locator('tr', { hasText: '#16-case2' }).locator('button.edit-btn').click();
  await screen.locator('#role-status').selectOption('改削行き（搬出可能）');
  await screen.locator('#updateRoleBtn').click();
  const case2 = await screen.evaluate(() => {
    const role = roles.find(item => item.name === '#16-case2');
    const done = ['requestFormCreatedAt', 'sealConfirmedAt', 'pdfCreatedAt', 'vendorSentAt', 'vendorContactedAt', 'pickupAdjustedAt']
      .filter(key => role.workProgress[key] && role.workProgress[key].done).length;
    return {
      done,
      dispatch: role.dispatchDate,
      arrival: role.arrivalDate,
      historyDispatch: role.workProgressHistory[0] && role.workProgressHistory[0].dispatchDate,
      historyArrival: role.workProgressHistory[0] && role.workProgressHistory[0].arrivalDate,
      historyCount: role.workProgressHistory[0] && role.workProgressHistory[0].completedCount
    };
  });
  assert.equal(case2.done, 0);
  assert.equal(case2.dispatch, '');
  assert.equal(case2.arrival, '');
  assert.equal(case2.historyCount, 5);
  assert.equal(case2.historyDispatch, '2026-08-01');
  assert.equal(case2.historyArrival, '2026-08-20');
  await screen.locator('tr', { hasText: '#16-case2' }).locator('.work-progress').screenshot({ path: path.join(out, '08-new-cycle-zero.png') });
  checks.push('a second rework entry stays at 0/6 and keeps the August dates in history');

  await screen.locator('#toggleRoleFormBtn').click();
  await screen.locator('#role-name').fill('#16-case3');
  await screen.locator('#role-status').selectOption('改削行き（搬出可能）');
  await screen.locator('#role-dispatch-date').fill('');
  await screen.locator('#addRoleBtn').click();
  const case3Row = screen.locator('tr', { hasText: '#16-case3' });
  await case3Row.locator('button', { hasText: '改削依頼書作成' }).click();
  const case3Cycle = await screen.evaluate(() => roles.find(item => item.name === '#16-case3').workProgress.cycleId);
  await case3Row.locator('button.edit-btn').click();
  await screen.locator('#role-status').selectOption('改削中');
  await screen.locator('#updateRoleBtn').click();
  const case3 = await screen.evaluate(expectedCycle => {
    const role = roles.find(item => item.name === '#16-case3');
    const done = ['requestFormCreatedAt', 'sealConfirmedAt', 'pdfCreatedAt', 'vendorSentAt', 'vendorContactedAt', 'pickupAdjustedAt']
      .filter(key => role.workProgress[key] && role.workProgress[key].done).length;
    return { done, cycleId: role.workProgress.cycleId, warning: role.reworkCycleWarning || '', status: role.status };
  }, case3Cycle);
  assert.equal(case3.status, '改削中');
  assert.equal(case3.cycleId, case3Cycle);
  assert.equal(case3.done, 1);
  assert.match(case3.warning, /⑥/);
  const case3Clip = await screen.evaluate(() => {
    const role = roles.find(item => item.name === '#16-case3');
    const node = document.getElementById(`role-${role.id}`);
    node.scrollIntoView({ block: 'start' });
    const rect = node.getBoundingClientRect();
    const x = Math.max(rect.x, 0);
    const y = Math.max(rect.y, 0);
    return {
      x,
      y,
      width: Math.max(Math.min(rect.width, window.innerWidth - x), 1),
      height: Math.max(Math.min(rect.height, window.innerHeight - y), 1)
    };
  });
  await screen.screenshot({ path: path.join(out, '09-same-cycle-warning.png'), clip: case3Clip });
  checks.push('moving from rework ready to rework in progress keeps 1/6 and shows the incomplete pickup warning');

  const reworkingView = await screen.evaluate(() => {
    const role = roles.find(item => item.name === '#16-case3');
    const card = document.getElementById(`role-${role.id}`);
    return { steps: card.querySelectorAll('.progress-step-btn').length };
  });
  assert.equal(reworkingView.steps, 0);
  const case3Back = screen.locator('tr', { hasText: '#16-case3' });
  await case3Back.locator('button.edit-btn').click();
  await screen.locator('#role-status').selectOption('改削行き（搬出可能）');
  await screen.locator('#updateRoleBtn').click();
  await case3Back.locator('button', { hasText: '押印確認' }).click();
  const resumed = await screen.evaluate(expectedCycle => {
    const role = roles.find(item => item.name === '#16-case3');
    const done = ['requestFormCreatedAt', 'sealConfirmedAt', 'pdfCreatedAt', 'vendorSentAt', 'vendorContactedAt', 'pickupAdjustedAt']
      .filter(key => role.workProgress[key] && role.workProgress[key].done).length;
    return { status: role.status, done, cycleId: role.workProgress.cycleId };
  }, case3Cycle);
  assert.equal(resumed.status, '改削行き（搬出可能）');
  assert.equal(resumed.cycleId, case3Cycle);
  assert.equal(resumed.done, 2);
  checks.push('incomplete work while reworking is continued by returning to rework ready on the same cycle');

  const layoutBox = async () => screen.evaluate(() => {
    const role = roles.find(item => item.name === '#16-case2');
    const card = document.getElementById(`role-${role.id}`);
    const help = card.querySelector('.progress-step-help');
    const step = help ? help.closest('.rework-pickup-step') : null;
    const rect = node => node ? { w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height } : null;
    return { help: rect(help), step: rect(step), mobile: document.body.classList.contains('mobile-layout') };
  });
  const desktopLayout = await layoutBox();
  assert.ok(desktopLayout.help.w > 160, 'pickup help must stay on one readable line at desktop width');
  assert.ok(desktopLayout.help.h < 48, 'pickup help must not wrap one character per line');
  await screen.setViewportSize({ width: 390, height: 844 });
  await screen.waitForTimeout(250);
  const mobileLayout = await layoutBox();
  assert.equal(mobileLayout.mobile, true);
  assert.ok(mobileLayout.help.w > 160, 'pickup help must use the phone card width');
  assert.ok(mobileLayout.help.h < 80, 'pickup help must stay readable on a phone');
  assert.ok(mobileLayout.step.w > 240, 'pickup step must not stay squeezed beside the progress label');
  const mobileClip = await screen.evaluate(() => {
    const role = roles.find(item => item.name === '#16-case2');
    const node = document.getElementById(`role-${role.id}`).querySelector('.work-progress');
    node.scrollIntoView({ block: 'start' });
    const rect = node.getBoundingClientRect();
    const x = Math.max(rect.x, 0);
    const y = Math.max(rect.y, 0);
    return {
      x,
      y,
      width: Math.max(Math.min(rect.width, window.innerWidth - x), 1),
      height: Math.max(Math.min(rect.height, window.innerHeight - y), 1)
    };
  });
  await screen.screenshot({ path: path.join(out, '10-pickup-layout-mobile.png'), clip: mobileClip });
  await screen.setViewportSize({ width: 1280, height: 800 });
  checks.push('pickup step text stays readable at desktop and phone widths');

  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({status:'PASS',scope:'actual index.html + app scripts in ephemeral disconnected browser, authentication UI bypassed only within fixture; fake roles',checks,networkRequestsBlocked:outbound.length},null,2));
  console.log('ROLL-001 ISOLATED FULL UI PASS:',checks.length);
  checks.forEach(x=>console.log(' - '+x));
  console.log('Remote requests blocked:',outbound.length);
 }catch(e){
  try{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack||e)+'\nPAGE ERRORS:\n'+failures.join('\n')+'\nREMOTE REQUESTS:\n'+outbound.join('\n'));}catch(_){}
  throw new Error(String(e.message)+'; page errors: '+failures.slice(0,5).join(' / '));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
