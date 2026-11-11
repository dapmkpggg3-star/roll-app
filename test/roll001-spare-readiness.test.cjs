const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
// Test the real task-generation function against synthetic status configurations.
// Never read localStorage or query company GAS/Sheets.
const s=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const begin=s.indexOf('function getTodayTaskItems(allRoles)');
const end=s.indexOf('function updateTodayTaskDashboard(allRoles)',begin);
assert.ok(begin>=0 && end>begin,'real task generator must exist');
const generator=s.slice(begin,end);
function status(name){const m=s.match(new RegExp("const "+name+" = '([^']+)';"));assert.ok(m,name);return m[1]}
const ONLINE=status('ONLINE_STATUS'),USED=status('USED_STANDBY_STATUS');
const INSTALLED=status('NEW_INSTALLED_STATUS'),READY=status('NEW_READY_STATUS');
const SCRAP=status('SCRAP_WAITING_STATUS'),REWORKING=status('REWORKING_STATUS');
function role(id,statusValue){return {id,name:'#10-'+id,status:statusValue,updatedAt:'2026-11-01T00:00:00.000Z'};}
const now=()=>new Date('2026-11-11T00:00:00.000Z');
function tasks(input){
  const data=input.map(x=>({...x}));
  const copy=JSON.stringify(data);
  const context=vm.createContext({
    Date:class FixedDate extends Date {constructor(...args){super(...(args.length?args:[now().toISOString()]))}},
    ONLINE_STATUS:ONLINE,USED_STANDBY_STATUS:USED,NEW_INSTALLED_STATUS:INSTALLED,
    SCRAP_WAITING_STATUS:SCRAP,REWORK_READY_STATUS:'改削行き（搬出可能）',
    REWORKING_STATUS:REWORKING,
    getStandKey:n=>String(n).match(/#([0-9]+)/)?.[1]||'',
    getOldestStatusChangedAt:()=>null,getElapsedDaysSince:()=>0,
    getAssemblyCandidateItems:()=>[], sortTodayTasks:(a,b)=>({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]),
    getWorkProgressState:()=>({completedCount:0,totalCount:0}),
    getRoleStatusChangedAt:()=>null,getRoleDispatchDate:()=>'',getRoleArrivalDate:()=>'',getInboundPlanDate:()=>'',getTodayDateString:()=>'',REWORKING_CONFIRM_THRESHOLD_DAYS:25
  });
  vm.runInContext(generator+'\nthis.generate=getTodayTaskItems;',context,{timeout:1000});
  const result=context.generate(data);
  assert.equal(JSON.stringify(data),copy,'task generation must never edit roles');
  return Array.from(result);
}
test('normal ONLINE plus USED without installed roll is not automatically short of emergency spare',()=>{
  assert.equal(tasks([role('A',ONLINE),role('B',USED)]).filter(x=>x.id.startsWith('reserve-shortage')).length,0);
});
test('with scrap and USED, readiness is informational, not confirmed shortage',()=>{
  const t=tasks([role('A',ONLINE),role('B',USED),role('C',SCRAP)]).find(x=>x.id==='reserve-shortage-10');
  assert.ok(t);
  assert.equal(t.priority,'low');
  assert.match(t.title,/予定を確認/);
  assert.match(t.reason,/不足確定ではない/);
});
test('installed complete spare suppresses provisional readiness warning',()=>{
  assert.equal(tasks([role('A',ONLINE),role('B',INSTALLED),role('C',SCRAP)]).filter(x=>x.id.startsWith('reserve-shortage')).length,0);
});
test('no USED or INSTALLED with online requires physical emergency spare confirmation',()=>{
  const t=tasks([role('A',ONLINE),role('B',READY),role('C',SCRAP)]).find(x=>x.id==='reserve-shortage-10');
  assert.ok(t);
  assert.equal(t.priority,'high');
  assert.match(t.title,/緊急交換用/);
  assert.match(t.reason,/現物確認が必要/);
});
test('NEW_READY roll alone does not count as chock-installed emergency backup',()=>{
  const t=tasks([role('A',ONLINE),role('B',READY)]).find(x=>x.id==='reserve-shortage-10');
  assert.ok(t);
  assert.equal(t.priority,'high');
});
test('stored or ordered expected roll alone never suppresses missing completed backup check',()=>{
  for(const state of [status('NEW_STORAGE_STATUS'),status('ORDERED_WAITING_STATUS')]){
    const t=tasks([role('A',ONLINE),role('B',state)]).find(x=>x.id==='reserve-shortage-10');
    assert.ok(t);
    assert.equal(t.priority,'high');
  }
});
test('no ONLINE registered does not infer exchange deadline or physical shortage',()=>{
  const list=tasks([role('B',USED)]);
  assert.equal(list.filter(x=>x.id.startsWith('reserve-shortage')).length,0);
});
