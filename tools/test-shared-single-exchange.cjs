'use strict';
const {selfTest:prior}=require('./test-shared-workshop-handover.cjs');
function selfTest(preview,workshop,pathline,bridge,paired,linked,api){
 let fixture;prior((x,a)=>{if(!fixture)fixture=x;return workshop(x,a)},pathline,bridge,paired,linked,api);
 const x=JSON.parse(JSON.stringify(fixture)),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous'},c=x.pathline;
 const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const make=(stand,rollId,demandId,mm)=>{
  const roles=['online','new-standby','unassembled-return'].map((status,i)=>({...v,stand,rollId:i===0?rollId:'single-'+stand+'-'+i,generation:'g1',status,chockAssembled:i!==2,emergencyEligible:i!==2,diameterMm:i===0?mm:420}));
  const old=roles[0],next=roles[1];
  return {...v,stand,demandId,roles,compatibility:{...v,oldIdentity:id(old),newIdentity:id(next),size:'D10',status:'compatible',replacementDiameter:420},diameter:{...v,stand,rollId:old.rollId,generation:old.generation,identity:id(old),status:'actual',measuredDate:x.asOf,currentMm:mm,limitMm:400,limitApproved:true,limitBasis:'anon'},diameterHistory:[1,2,3].map(i=>({...v,stand,rollId:'history-'+stand,cycleId:'c'+i,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}))};
 };
 const a=make(2,'a2','a',420),b=make(17,'r17','z17',420),old=b.roles[0],next=b.roles[1];
 x.singleInputs=[a,b];
 const g={...v,id:'z17',stands:['17'],workType:'rollChange',size:'D10',standPass:'pass',members:[{...v,standKey:'17',rollId:old.rollId,generation:'g1',usageBasis:'anon',remainingBasis:'anon',nextCaliberAvailable:false,columnBasis:'anon',activeCalibers:[{id:'1',runs:6,column:'西'},{id:'5',runs:6,column:'東'}]}]};
 x.groups.push(g);
 const demand=api.deriveFirstMonthlyExchange({referenceDate:x.asOf,throughDate:x.throughDate,days:x.days,group:g}).demand;
 const e={...v,demandId:g.id,deadlineBasis:demand.deadlineBasis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true};
 x.slots.push({...x.slots[0],id:'2027-04-02',date:'2027-04-02',eligibility:[e]});
 // New #17 has six grooves, with a different D10/D13 ratio from its old eight.
 const original=c.masterRows.find(m=>String(m.stand)==='17'),mapping=[1,3,4,5,7,8];
 const newMaster={...original,rollId:next.rollId,totalCalibers:6,calibers:mapping.map((n,i)=>({...original.calibers.find(q=>q.number===n),number:i+1})),pairs:[{...original.pairs[0],west:1,east:4}]};
 c.masterRows.push(newMaster);
 c.usageRows=c.usageRows.map(q=>String(q.stand)==='17'&&[1,5].includes(q.number)?{...q,runs:6}:q);
 c.usageRows.push(...newMaster.calibers.map(q=>({...v,stand:17,rollId:next.rollId,generation:'g1',number:q.number,runs:0,available:true})));
 c.exchangeSelections=c.exchangeSelections.map(q=>({...q,selection:{...q.selection,17:[1,4]}}));
 c.exchangeSelections.push({...v,demandId:'z17',date:'2027-04-02',startMinute:480,endMinute:840,selection:{...c.selection,17:[1,4]},oldIdentities:{17:id(old)},newIdentities:{17:id(next)}});
 const option=(q,date)=>{
  const template=x.workshopOptions[0].request,target=q.roles[2],k=q.stand;
  return {...v,demandId:q.demandId,stand:String(k),request:{...template,...v,stand:k,oldIdentity:id(q.roles[0]),targetIdentity:id(target),receipt:{...template.receipt,identity:id(target)},slot:{...template.slot,date,owner:{rollId:target.rollId,standKey:k},preparedTarget:target.rollId},day:{...template.day,date},dispatchPlan:{...template.dispatchPlan,identity:id(q.roles[0]),cycleId:'cycle-'+k,date:'2027-04-10'}}};
 };
 const o2=option(a,'2027-04-08'),o17=option(b,'2027-04-07'),alt17=option(b,'2027-04-09');
 x.workshopOptions.push(o2,o17,alt17);x.workshopDays.push(...[o2,alt17].map(o=>({...v,...o.request.day,workshopWorking:true})));x.workshopTargets=[];
 const before=JSON.stringify(x),r=preview(x,api),p=pathline(x,api),run=q=>preview({...x,...q},api),rs=(out,k)=>out.projectedRoles.filter(y=>String(y.stand)===k);
 const held17=run({workshopOptions:x.workshopOptions.filter(o=>o.demandId!=='z17')});
 const bad=run({pathline:{...c,masterRows:c.masterRows.map(m=>m.rollId===next.rollId?{...m,calibers:m.calibers.map(z=>({...z,centerMm:z.centerMm+41}))}:m)}});
 const tests=[
 ['single and pair line replay succeeds',p.pathlineComplete&&p.pathlineEvents.some(e=>e.type==='allocated-single-pathline-preview'&&e.id==='z17')],
 ['new individual count and selection',p.endingOnline.some(y=>y.rollId===next.rollId)&&p.endingSelection['17'].join(',')==='1,4'],
 ['old usage preserved',p.endingUsage.find(y=>y.rollId===old.rollId&&y.number===5)?.runs===6],
 ['new dual groove consumed',p.endingUsage.filter(y=>y.rollId===next.rollId&&[1,4].includes(y.number)).every(y=>y.runs===1)],
 ['shared workshop allocation four sides',r.allocations.length===4&&new Set(r.allocations.map(a=>a.date)).size===4],
 ['single 17 moves off pair slot',r.allocations.find(a=>a.stand==='17')?.date==='2027-04-09'],
 ['single 2 joins shared workshop',r.allocations.find(a=>a.stand==='2')?.date==='2027-04-08'],
 ['all supported stands retain one emergency spare',['2','12','13','17'].every(k=>rs(r,k).length===3&&rs(r,k).filter(y=>y.status!=='online'&&y.chockAssembled&&y.emergencyEligible).length===1)],
 ['17 sixty days rework',r.dispositions.find(d=>d.stand==='17')?.rework?.expectedInboundDate==='2027-06-09'],
 ['2 twenty days rework',r.dispositions.find(d=>d.stand==='2')?.rework?.expectedInboundDate==='2027-04-30'],
 ['no assembly slot keeps old spare',rs(held17,'17').some(y=>y.status==='used-standby'&&y.emergencyEligible)&&!held17.dispositions.find(d=>d.stand==='17')?.rework],
 ['bad geometry blocks single downstream disposition',!bad.pathlineComplete&&!bad.dispositions.some(d=>d.stand==='17')],
 ['missing single third held',!pathline({...x,singleInputs:[a,{...b,roles:b.roles.slice(0,2)}]},api).pathlineComplete],
 ['wrong new individual held',!pathline({...x,singleInputs:[a,{...b,compatibility:{...b.compatibility,newIdentity:'other'}}]},api).pathlineComplete],
 ['upstream explicit fit only',r.dispositions.find(d=>d.stand==='2')?.upstreamFitEvidenceOnly===true],
 ['no operation or annual completion',!r.complete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed],
 ['input unchanged',JSON.stringify(x)===before]];
 return {tests,result:r,pathline:p};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const w=require('./shared-workshop-handover.cjs').previewSharedWorkshop;const {tests}=selfTest(w,w,require('./allocated-pathline-replay.cjs').previewAllocatedPathline,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,require('./linked-12-17-combinations.cjs').previewLinked1217,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
