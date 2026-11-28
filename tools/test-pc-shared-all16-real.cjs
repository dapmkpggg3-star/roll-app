'use strict';
// All 16 in a single anonymous first-stage planning window, not a full year.
const {fixture:downstream}=require('./test-pc-shared-downstream-real.cjs');
const {fixture:single}=require('./test-pc-shared-single-real.cjs');
const {previewPcSharedCirculation}=require('./pc-shared-circulation.cjs');
function fixture(api){
 const x=downstream(api),b=single(api),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous'},copy=z=>JSON.parse(JSON.stringify(z)),id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const d0=x.days[0],d1=x.days.at(-1),s0=b.singleInputs[0],w0=b.workshopOptions[0],g0=b.groups[0],slot0=b.slots[0];
 x.throughDate=api.addDays(x.asOf,11);
 x.days=Array.from({length:12},(_,i)=>({...v,...(i===11?d1:d0),date:api.addDays(x.asOf,i),nightProductionAmount:0}));
 x.setupNightHistory=[{...v,date:'2027-03-31',recordKind:'actual',dateRowVerified:true,productionAmount:400,nightProductionAmount:400,shift3Team:'B'}];
 const members={};
 for(let k=2;k<=11;k++){
  const stand=String(k),s=copy(s0),roles=s.roles.map((r,i)=>({...r,stand,rollId:'R'+k+'-'+i})),[old,next]=roles;
  members[stand]={stand,roles,diameter:{...s.diameter,stand,rollId:old.rollId,identity:id(old)},diameterHistory:s.diameterHistory.map(h=>({...h,stand,rollId:k+'-'+h.rollId}))};
 }
 const usage=(k,i)=>{
  const r=members[k].roles[i],lim=api.monthlyUsageThreshold(k,'D10');
  if(+k<=5)return {...g0.members[0],...v,standKey:k,rollId:r.rollId,generation:r.generation,openingUsedTons:lim.tons-100};
  const tons=lim.tons===null?null:i===1?0:lim.tons-75,runs=lim.runs===null?null:i===1?0:+k>=10?8:14;
  const caliberLedger={...v,identity:id(r),complete:true,totalCalibers:2,calibers:[{...v,id:'1',state:'active',tons,runs},{...v,id:'2',state:i===1?'unused':'used',tons:lim.tons===null?null:i===1?0:lim.tons,runs:lim.runs===null?null:i===1?0:lim.runs}]};
  return {...v,caliberLedger,standKey:k,rollId:r.rollId,generation:r.generation,identity:id(r),size:'D10',usageBasis:'anonymous usage',remainingBasis:'anonymous remaining',nextCaliberAvailable:i===1,openingUsedTons:tons,activeCalibers:lim.runs===null?[]:[{id:'1',runs}]};
 };
 for(const [i,stands] of [['2'],['3'],['4'],['5'],['6','7'],['8','9'],['10','11']].entries()){
  const did=stands.length===2?'paired-'+stands.join('-'):'g'+stands[0],date=x.days[i+4].date;
  const group={...v,id:did,stands,workType:'rollChange',size:'D10',standPass:'pass',members:stands.map(k=>usage(k,0))};
  x.groups.push(group);
  const d=api.deriveFirstMonthlyExchange({referenceDate:x.asOf,throughDate:x.throughDate,days:x.days,group}).demand;
  x.slots.push({...slot0,id:'stop-'+date,date,eligibility:[{...slot0.eligibility[0],demandId:did,deadlineBasis:d.deadlineBasis,compatibilityBasis:v.basis}]});
  const oldIdentities=Object.fromEntries(stands.map(k=>[k,id(members[k].roles[0])])),newIdentities=Object.fromEntries(stands.map(k=>[k,id(members[k].roles[1])]));
  if(stands.length===2)x.pairedInputs.push({...v,anonymousOnly:true,asOf:x.asOf,stand:stands[0],size:'D10',members:stands.map(k=>members[k]),replacementUsage:stands.map(k=>usage(k,1)),compatibility:{...v,size:'D10',status:'compatible',lineFitConfirmed:true,oldIdentities,replacementIdentities:newIdentities,replacementDiameters:Object.fromEntries(stands.map(k=>[k,420]))},assemblies:[]});
  else{const k=stands[0];x.singleInputs.push({...v,...members[k],demandId:did,compatibility:{...v,size:'D10',status:'compatible',oldIdentity:oldIdentities[k],newIdentity:newIdentities[k],replacementDiameter:420}});}
  for(const k of stands){
   const [old,next,target]=members[k].roles,w=copy(w0),a=w.request;
   Object.assign(w,{stand:k,demandId:did});
   Object.assign(a,{stand:k,oldIdentity:id(old),targetIdentity:id(target),receipt:{...a.receipt,identity:id(target)},slot:{...a.slot,owner:{rollId:target.rollId,standKey:k},preparedTarget:target.rollId},dispatchPlan:{...a.dispatchPlan,identity:id(old),cycleId:'cycle-'+k}});
   x.workshopOptions.push(w);
  }
 }
 // One common workshop slot per weekday; all after the first exchange window.
 let date='2027-04-13';x.workshopDays=[];
 for(const w of x.workshopOptions.sort((a,b)=>Number(a.stand)-Number(b.stand))){
  while([0,6].includes(new Date(date+'T00:00:00Z').getUTCDay()))date=api.addDays(date,1);
  const a=w.request; a.slot.date=date;a.day={...a.day,...v,date,workshopWorking:true};
  a.dispatchPlan.date='2027-05-10';x.workshopDays.push({...a.day});
  date=api.addDays(date,1);
 }
 // Refresh deadline basis after extending the shared daily window.
 for(const slot of x.slots)for(const e of slot.eligibility){
  const g=x.groups.find(q=>q.id===e.demandId),d=api.deriveFirstMonthlyExchange({referenceDate:x.asOf,throughDate:x.throughDate,days:x.days,group:g}).demand;e.deadlineBasis=d.deadlineBasis;
 }
 return x;
}
function makeCases(api){
 const x=fixture(api),before=JSON.stringify(x),copy=v=>JSON.parse(JSON.stringify(v));
 const short=copy(x);short.slots=short.slots.filter(s=>s.eligibility[0].demandId!=='g5');
 const clash=copy(x),a=clash.workshopOptions.find(w=>w.stand==='2').request,b=clash.workshopOptions.find(w=>w.stand==='17').request;
 b.slot.date=a.slot.date;b.day={...a.day};
 return {x,before,cases:{normal:x,short,clash}};
}
function evaluate(x,before,results){
 const {normal:r,short,clash}=results,f=r.first,disp=f?.dispositions||[],stands=Array.from({length:16},(_,i)=>String(i+2));
 const month=(k,m)=>r.annual?.rows.find(q=>q.stand===k)?.months.find(q=>q.month===m)?.forecastRework;
 return {tests:[
 ['One engine all eleven groups and six downstream path checks',f?.pathlineComplete&&f.upstreamPairReplays.filter(q=>q.status==='conditional-upstream-pair-preview').length===3&&f.verifiedExchangeEvents.filter(q=>q.pathlineVerifiedAfterBatch).length===4&&f.exchangeUnresolved.length===0],
 ['All sixteen workshop allocations unique',f?.allocations.length===16&&new Set(f.allocations.map(q=>q.date)).size===16&&f.allocations.every(q=>q.status==='conditional-assembly')],
 ['48 roles and one online/one emergency reserve per stand',f?.projectedRoles.length===48&&stands.every(k=>{const a=f.projectedRoles.filter(q=>q.stand===k);return a.length===3&&new Set(a.map(q=>q.rollId)).size===3&&a.filter(q=>q.status==='online').length===1&&a.filter(q=>q.status!=='online'&&q.chockAssembled&&q.emergencyEligible).length===1;})],
 ['15 reworks and one successor',disp.filter(q=>q.rework).length===15&&disp.filter(q=>q.kind==='successor-needed').length===1],
 ['20-day May, 30-day June, 60-day July counts',stands.every(k=>k==='12'?month(k,'2027-06')===null:month(k,+k<=9?'2027-05':+k<=15?'2027-06':'2027-07')===1)],
 ['Purchase deadline outside year retained',r.purchase?.rows.some(q=>q.stand==='12'&&q.deadline==='2026-10-01')],
 ['One missing line slot retains demand and no false #5 rework',short.held.some(q=>q.stand==='5'&&q.requiredExchange===true)&&!short.first.dispositions.some(q=>q.stand==='5')],
 ['Workshop conflict holds old 17 and no false rework',clash.first?.held.some(q=>q.stand==='17'&&q.oldReserveRetained===true)&&clash.first.projectedRoles.some(q=>q.rollId==='R17-0'&&q.status==='used-standby')&&!clash.first.dispositions.find(q=>q.stand==='17')?.rework],
 ['No missing stand or full horizon claim',r.coverage.every(q=>q.state!=='対象入力なし'&&!q.fullHorizonVerified)&&!r.periodComplete&&!r.complete],
 ['No input mutation or authority',JSON.stringify(x)===before&&!r.writeAllowed&&!r.operationAuthorized]
 ],result:r,short,clash};
}
function selfTest(api){const {x,before,cases}=makeCases(api);return evaluate(x,before,Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,previewPcSharedCirculation(v,api)])));}
module.exports={fixture,makeCases,evaluate,selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [n,ok] of tests)console.log((ok?'PASS ':'FAIL ')+n);if(tests.some(x=>!x[1]))process.exitCode=1;}
