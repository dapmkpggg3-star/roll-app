// ROLL-PROC-001: audit-only reproduction of procurement warning coverage gaps.
// This file does NOT certify procurement safety and does not change app behavior.
// Current assumptions remain UNVERIFIED; use synthetic roles and no remote calls.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function piece(a,b){let i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'missing source section '+a);return src.slice(i,j)}
const purchase=piece('function getPurchaseConfirmationItems(allRoles = roles)','function formatPurchaseDiameter(');
const start=src.indexOf('function getPurchasePlanningInfo(role)');
const stop=src.indexOf('function getPurchaseConfirmationLevel(info)',start);
assert.ok(start>0&&stop>start);
const infoSource=src.slice(start,stop);
const currentDate='2026-11-11';
function auditPurchaseList(roles){
  const ctx=vm.createContext({
    roles,getStandKey:name=>String(name).match(/#([0-9]+)/)?.[1]||'',
    isPurchaseHandledStatus:status=>status==='発注済み（納入待ち）'||status==='新品予備保管',
    getPurchasePlanningInfo:role=>({standKey:'10',roleName:role.name,purchaseDecisionDate:currentDate}),
    getPurchaseConfirmationLevel:()=>({key:'urgent',label:'要確認'}),
    compareStandRoleNames:(a,b)=>a.localeCompare(b)
  });
  vm.runInContext(purchase+'\nthis.audit=getPurchaseConfirmationItems;',ctx,{timeout:1200});
  return ctx.audit(roles);
}
test('GUARD: one ordered roll must not hide an urgent other roll from purchase confirmation board',()=>{
  const roles=[
    {name:'#10-A',status:'オンライン',remainingCutCount:0},
    {name:'#10-B',status:'中古予備（バラシ前）',remainingCutCount:0},
    {name:'#10-C',status:'発注済み（納入待ち）',remainingCutCount:99}
  ];
  const decisions=auditPurchaseList(roles);
  assert.deepEqual(Array.from(decisions, x=>x.roleName),['#10-A','#10-B']);
  console.log('GUARD PASS: ordered role alone no longer suppresses other rolls of the same stand');
});
test('GUARD: the same urgent stand remains included when no order is recorded',()=>{
  const roles=[
    {name:'#10-A',status:'オンライン',remainingCutCount:0},
    {name:'#10-B',status:'中古予備（バラシ前）',remainingCutCount:0}
  ];
  assert.equal(auditPurchaseList(roles).length,2);
});
test('AUDIT OPEN RISK: default purchase lead is six months, first alert window three months',()=>{
  assert.match(src,/const DEFAULT_PURCHASE_LEAD_TIME_MONTHS = 6;/);
  assert.match(src,/const PURCHASE_CONFIRMATION_WINDOW_MONTHS = 3;/);
  console.log('AUDIT GAP: 6+3 month defaults must not be equated to verified 12+ month availability');
});
test('AUDIT OPEN RISK: three-set procurement model uses fixed eight-month decision offset',()=>{
  assert.match(src,/const THREE_SET_MANAGEMENT_PURCHASE_DECISION_MONTHS = 8;/);
  assert.ok(src.includes('addMonthsToDateString(disposalForecastDate, -THREE_SET_MANAGEMENT_PURCHASE_DECISION_MONTHS)'));
});
test('AUDIT OPEN RISK: default duration estimates are stand-number based, not annual production forecast',()=>{
  const example=piece('function getStandOnlineUseMonths(standKey)','function getPurchasePlanningInfo(role)');
  assert.match(example,/return 1;/);
  assert.match(example,/return 3;/);
  console.log('AUDIT GAP: purchase forecast must be checked against actual future operating plan before business signoff');
});
test('GUARD: invalid purchase lead times remain explicitly unverified, never silently safe',()=>{
  assert.match(infoSource,/const leadTimeVerified = Number\.isFinite\(leadTimeMonths\) && leadTimeMonths > 0/);
  assert.match(infoSource,/purchaseDecisionDate = leadTimeVerified \?/);
  const levelSource=piece('function getPurchaseConfirmationLevel(info)','function getPurchaseConfirmationItems(allRoles = roles)');
  assert.match(levelSource,/key: 'unknown', label: '安全判定不能'/);
  const ctx=vm.createContext({getTodayDateString:()=>currentDate,addMonthsToDateString:()=>currentDate,normalizeDateInputValue:x=>x||'',PURCHASE_CONFIRMATION_WINDOW_MONTHS:3});
  vm.runInContext(levelSource+'\nthis.level=getPurchaseConfirmationLevel;',ctx);
  for(const value of [undefined,null,'',0,-1,'bad']){
    const result=ctx.level({leadTimeVerified:false,purchaseDecisionDate:''});
    assert.equal(result.key,'unknown',String(value));
  }
  assert.equal(ctx.level({leadTimeVerified:true,purchaseDecisionDate:currentDate}).key,'urgent');
});

test('GUARD: the three-set purchase dashboard does not mark an ordered stand as resolved',()=>{
  const unhandled=piece('function isThreeSetManagementPurchaseUnhandledItem(item)','function getThreeSetManagementData(');
  const ctx=vm.createContext({});
  vm.runInContext(unhandled+'\nthis.isUnhandled=isThreeSetManagementPurchaseUnhandledItem;',ctx);
  assert.equal(ctx.isUnhandled({hasOrderedWaiting:true,purchaseLevelKey:'urgent'}),true);
  assert.equal(ctx.isUnhandled({hasOrderedWaiting:false,purchaseLevelKey:'soon'}),true);
  assert.match(src,/発注済みあり・必要数要確認/);
  assert.match(src,/発注数量・納入予定と3セット維持可否を確認/);
});
