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
  // Expand through the real UI control: CSS is-collapsed hides the cards even
  // when their DOM assertions pass. Capture the actual visible board.
  const purchaseToggle=page.locator('#purchase-confirmation-toggle');
  await purchaseToggle.click();
  assert.equal(await purchaseToggle.getAttribute('aria-expanded'),'true','purchase board did not expand');
  for(const name of ['#10-A','#10-B','#10-C']){
    const card=procurementCards.filter({hasText:name});
    assert.ok(await card.isVisible(),'purchase warning not visibly rendered for '+name);
  }
  await page.locator('#purchase-confirmation-board').screenshot({path:path.join(out,'04-procurement-missing-master.png')});
  checks.push('actual procurement dashboard retains all three unhandled roles with missing master data as unknown; discarded roll excluded');

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
