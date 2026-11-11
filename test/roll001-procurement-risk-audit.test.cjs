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
test('AUDIT FINDING: one ordered roll currently hides an urgent second roll from purchase confirmation board',()=>{
  const roles=[
    {name:'#10-A',status:'オンライン',remainingCutCount:0},
    {name:'#10-B',status:'中古予備（バラシ前）',remainingCutCount:0},
    {name:'#10-C',status:'発注済み（納入待ち）',remainingCutCount:99}
  ];
  assert.equal(auditPurchaseList(roles).length,0);
  // This is a reproducible GAP, not a passed business requirement:
  console.log('AUDIT GAP CONFIRMED: ordered status filters the entire stand even if another roll is urgent');
});
test('AUDIT FINDING: the same urgent stand is included when no order is recorded',()=>{
  const roles=[
    {name:'#10-A',status:'オンライン',remainingCutCount:0},
    {name:'#10-B',status:'中古予備（バラシ前）',remainingCutCount:0}
  ];
  assert.equal(auditPurchaseList(roles).length,2);
});
test('AUDIT FINDING: default purchase lead is six months, and first alert window three months',()=>{
  assert.match(src,/const DEFAULT_PURCHASE_LEAD_TIME_MONTHS = 6;/);
  assert.match(src,/const PURCHASE_CONFIRMATION_WINDOW_MONTHS = 3;/);
  console.log('AUDIT GAP: 6+3 month defaults must not be equated to verified 12+ month availability');
});
test('AUDIT FINDING: three-set procurement model uses fixed eight-month decision offset',()=>{
  assert.match(src,/const THREE_SET_MANAGEMENT_PURCHASE_DECISION_MONTHS = 8;/);
  assert.ok(src.includes('addMonthsToDateString(disposalForecastDate, -THREE_SET_MANAGEMENT_PURCHASE_DECISION_MONTHS)'));
});
test('AUDIT FINDING: default duration estimates are stand-number based, not annual production forecast',()=>{
  const example=piece('function getStandOnlineUseMonths(standKey)','function getPurchasePlanningInfo(role)');
  assert.match(example,/return 1;/);
  assert.match(example,/return 3;/);
  console.log('AUDIT GAP: purchase forecast must be checked against actual future operating plan before business signoff');
});
test('AUDIT FINDING: missing leadTimeMonths in stand master can become NaN rather than default',()=>{
  const source=infoSource;
  assert.match(source,/standMaster && standMaster\.leadTimeMonths !== ''/);
  assert.equal(Number(undefined),Number.NaN);
});
