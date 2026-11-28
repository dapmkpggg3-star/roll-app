'use strict';
const {fixture}=require('./test-pc-shared-single-real.cjs');
const {previewPcSharedCirculation}=require('./pc-shared-circulation.cjs');
function selfTest(api){
 const x=fixture(api),clone=v=>JSON.parse(JSON.stringify(v)),id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const g0=x.groups[0],s0=x.singleInputs[0],w0=x.workshopOptions[0],day0=x.workshopDays[0],slot0=x.slots[0];
 x.groups=[];x.singleInputs=[];x.workshopOptions=[];x.workshopDays=[];x.slots=[];
 for(const [i,limit] of [14000,12000,15000,12500].entries()){
  const k=String(i+2),demandId='g'+k,s=clone(s0),g=clone(g0),w=clone(w0),day={...day0,date:'2027-04-0'+(6+i)};
  for(const r of s.roles){r.stand=k;r.rollId=k+'-'+r.rollId;}
  const [old,next,target]=s.roles;
  Object.assign(s,{stand:k,demandId,compatibility:{...s.compatibility,oldIdentity:id(old),newIdentity:id(next)},diameter:{...s.diameter,stand:k,rollId:old.rollId,identity:id(old)},diameterHistory:s.diameterHistory.map(h=>({...h,stand:k,rollId:k+'-'+h.rollId}))});
  Object.assign(g,{id:demandId,stands:[k],members:[{...g.members[0],standKey:k,rollId:old.rollId,openingUsedTons:limit-100}]});
  Object.assign(w,{stand:k,demandId});const a=w.request;
  Object.assign(a,{stand:k,oldIdentity:id(old),targetIdentity:id(target),receipt:{...a.receipt,identity:id(target)},slot:{...a.slot,date:day.date,owner:{rollId:target.rollId,standKey:k},preparedTarget:target.rollId},day,dispatchPlan:{...a.dispatchPlan,identity:id(old),cycleId:'cycle-'+k}});
  x.groups.push(g);x.singleInputs.push(s);x.workshopOptions.push(w);x.workshopDays.push(day);
 }
 const eligibility=x.groups.map(g=>({...slot0.eligibility[0],demandId:g.id,deadlineBasis:api.deriveFirstMonthlyExchange({referenceDate:x.asOf,throughDate:x.throughDate,days:x.days,group:g}).demand.deadlineBasis}));
 x.slots=x.days.slice(0,4).map(d=>({...slot0,id:'stop-'+d.date,date:d.date,eligibility}));
 const before=JSON.stringify(x),r=previewPcSharedCirculation(x,api),short=previewPcSharedCirculation({...x,slots:x.slots.slice(1)},api);
 const clash=clone(x);clash.workshopOptions.forEach(w=>{w.request.slot.date=x.workshopDays[0].date;w.request.day=x.workshopDays[0];});
 const c=previewPcSharedCirculation(clash,api),alloc=r.first?.allocations||[],disp=r.first?.dispositions||[];
 const t=[
 ['Four upstream single stand first-stage real replays',disp.filter(d=>d.rework).length===4],
 ['All four distinct workshop slots used',alloc.length===4&&new Set(alloc.map(a=>a.date)).size===4],
 ['All four stands get exactly one May forecast', ['2','3','4','5'].every(k=>r.annual?.rows.find(y=>y.stand===k).months.find(y=>y.month==='2027-05').forecastRework===1)],
 ['Each stand retains three physical roles', ['2','3','4','5'].every(k=>{const rr=r.first?.projectedRoles.filter(y=>y.stand===k);return rr?.length===3&&rr.filter(y=>y.status==='online').length===1&&rr.filter(y=>y.status!=='online'&&y.chockAssembled&&y.emergencyEligible).length===1;})],
 ['One fewer line stop retains unresolved demand',short.held.some(h=>h.requiredExchange===true)&&short.first?.dispositions.filter(d=>d.rework).length===3],
 ['Overlapping workshop requests not double booked',c.first?.allocations.length===1&&c.first?.dispositions.filter(d=>d.rework).length===1&&c.first?.held.filter(h=>h.oldReserveRetained===true).length===3],
 ['Uncovered downstream stays unverified',r.coverage.filter(y=>Number(y.stand)>=6).every(y=>y.state==='対象入力なし')&&!r.complete],
 ['Input untouched and no authority',JSON.stringify(x)===before&&!r.writeAllowed&&!r.operationAuthorized]
 ];
 return {tests:t,result:r,short,clash:c};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [n,ok] of tests)console.log((ok?'PASS ':'FAIL ')+n);if(tests.some(x=>!x[1]))process.exitCode=1;}
