'use strict';
const {selfTest:prior}=require('./test-paired-assembly-disposition.cjs');
function selfTest(workshop,bridge,paired,api){
 let fixture;prior((x,a)=>{if(!fixture)fixture=x;return paired(x,a)},api);
 const v={snapshotId:fixture.snapshotId,sourceRevision:fixture.sourceRevision,basis:'anonymous'},id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const x={...v,anonymousOnly:true,asOf:fixture.asOf,throughDate:'2027-04-05',groups:[],pairedInputs:[],slots:[],days:[],workshopOptions:[],workshopDays:[],workshopReserved:[],workshopReservationsVerified:true,workshopReservationBasis:'anonymous empty',setupNightHistory:[{...v,date:'2027-03-31',recordKind:'actual',dateRowVerified:true,productionAmount:400,nightProductionAmount:400,shift3Team:'B'}]};
 x.days=Array.from({length:5},(_,i)=>({...v,date:'2027-04-0'+(i+1),dateRowVerified:true,recordKind:'plan',productionAmount:i===4?400:0,nightProductionAmount:0,size:'D10',grade:'SD295',shift1Team:i===4?'A':'',operatingHours:i===4?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anon'}));
 const slot=(date,e)=>({...v,id:date,date,startMinute:480,endMinute:1000,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,reserved:[],eligibility:[e]});
 for(const [idx,stands] of [[0,[6,7]],[1,[8,9]],[2,[10,11]]]){
  const did='paired-'+stands.join('-'),members=fixture.members.map((m,i)=>{
   const k=stands[i],roles=m.roles.map((r,j)=>({...r,stand:k,rollId:'anon-'+k+'-'+j,diameterMm:420})),old=roles[0];
   return {...m,stand:k,roles,diameter:{...m.diameter,stand:k,rollId:old.rollId,identity:id(old),currentMm:420},diameterHistory:m.diameterHistory.map(h=>({...h,stand:k,rollId:'history-'+k}))};
  });
  const usage=(m,i)=>{const k=String(m.stand),r=m.roles[i],lim=api.monthlyUsageThreshold(k,'D10');return {...v,standKey:k,rollId:r.rollId,generation:r.generation,identity:id(r),size:'D10',usageBasis:'anonymous usage',remainingBasis:'anonymous remaining',nextCaliberAvailable:i===1,openingUsedTons:lim.tons===null?null:i===1?0:lim.tons-75,activeCalibers:lim.runs===null?[]:[{id:'1',runs:i===1?0:k==='10'||k==='11'?8:14}]};};
  const g={...v,id:did,stands:stands.map(String),workType:'rollChange',size:'D10',standPass:'pass',members:members.map(m=>usage(m,0))};
  x.groups.push(g);
  const f=api.deriveFirstMonthlyExchange({referenceDate:x.asOf,throughDate:x.throughDate,days:x.days,group:g});
  x.slots.push(slot('2027-04-0'+(idx+2),{...v,demandId:did,deadlineBasis:f.demand.deadlineBasis,compatibilityBasis:v.basis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true}));
  const p={...fixture,...v,stand:stands[0],members,compatibility:{...fixture.compatibility,...v,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,id(m.roles[0])])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,id(m.roles[1])])),replacementDiameters:Object.fromEntries(members.map(m=>[m.stand,420]))},replacementUsage:members.map(m=>usage(m,1)),assemblies:[]};
  for(const [i,m] of members.entries()){
   const k=m.stand,t=m.roles[2],a=fixture.assemblies[i],date=api.addDays('2027-04-06',idx*2+i);
   const req={...a,...v,stand:k,oldIdentity:id(m.roles[0]),targetIdentity:id(t),receipt:{...a.receipt,identity:id(t)},slot:{...a.slot,date,owner:{rollId:t.rollId,standKey:k},preparedTarget:t.rollId},day:{...a.day,date},dispatchPlan:{...a.dispatchPlan,identity:id(m.roles[0]),date:'2027-04-15',cycleId:'cycle-'+k}};
   p.assemblies.push(req);x.workshopOptions.push({...v,demandId:did,stand:String(k),request:req});x.workshopDays.push({...v,...req.day,workshopWorking:true});
  }
  x.pairedInputs.push(p);
 }
 const before=JSON.stringify(x),r=workshop(x,api),b=bridge(x,api),run=q=>workshop({...x,...q},api),u=k=>b.upstreamPairReplays.find(z=>z.id===k),use=(k,stand)=>u(k)?.endingUsage?.find(z=>z.standKey===stand);
 const missing=run({setupNightHistory:[]}),unknown=run({days:x.days.map(d=>d.date==='2027-04-01'?{...d,nightProductionAmount:null}:d)});
 const bad=run({pairedInputs:x.pairedInputs.map(p=>p.stand===8?{...p,replacementUsage:p.replacementUsage.map(m=>({...m,generation:'wrong'}))}:p)});
 const tests=[
 ['all three upstream pairs allocated',b.upstreamPairReplays.filter(z=>z.status==='conditional-upstream-pair-preview').length===3],
 ['6/7 prior producing night only',r.setupInstructions.length===1&&r.setupInstructions[0].date==='2027-03-31'&&r.setupInstructions[0].team==='B'],
 ['6/7 6075t and 15 straight',use('paired-6-7','6')?.limit.tons===6075&&use('paired-6-7','6')?.limit.runs===15],
 ['6/7 new 400t and 1 straight',use('paired-6-7','7')?.tons===400&&use('paired-6-7','7')?.calibers[0].runs===1],
 ['8/9 5265t without inferred straight',use('paired-8-9','8')?.limit.tons===5265&&use('paired-8-9','8')?.limit.runs===null&&use('paired-8-9','8')?.tons===400],
 ['10/11 8 straight and 1 new straight',use('paired-10-11','10')?.limit.runs===8&&use('paired-10-11','10')?.calibers[0].runs===1],
 ['old usage retained separate',u('paired-10-11')?.openingUsage.every(z=>z.calibers[0].runs===8)],
 ['six workshop allocations and 18 roles',r.allocations.length===6&&r.projectedRoles.length===18],
 ['one emergency standby per stand', [6,7,8,9,10,11].every(k=>r.projectedRoles.filter(z=>String(z.stand)===String(k)&&z.status!=='online'&&z.chockAssembled&&z.emergencyEligible).length===1)],
 ['20 day rework upstream',r.dispositions.find(z=>z.stand==='6')?.rework?.expectedInboundDate==='2027-05-05'],
 ['30 day rework high speed',r.dispositions.find(z=>z.stand==='10')?.rework?.expectedInboundDate==='2027-05-15'],
 ['missing setup holds 6/7 only',missing.exchangeUnresolved.some(z=>z.id==='paired-6-7')&&!missing.dispositions.some(z=>['6','7'].includes(z.stand))&&missing.allocations.length===4],
 ['unknown intervening night holds 6/7',unknown.exchangeUnresolved.some(z=>z.id==='paired-6-7')],
 ['wrong replacement generation holds 8/9',bad.exchangeUnresolved.some(z=>z.id==='paired-8-9')&&!bad.dispositions.some(z=>['8','9'].includes(z.stand))],
 ['explicit fit evidence only',r.dispositions.every(z=>z.upstreamFitEvidenceOnly===true)],
 ['no full annual or operation approval',!r.complete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed],
 ['input unchanged',JSON.stringify(x)===before]];
 return {tests,result:r,bridge:b};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./shared-workshop-handover.cjs').previewSharedWorkshop,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
