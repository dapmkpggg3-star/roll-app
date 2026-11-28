'use strict';
const {selfTest:prior}=require('./test-conditional-second-upper-cycle.cjs');
function selfTest(preview,disposition,second,sequenceWorkshop,sequence,workshop,bridge,paired,api){
 let fixture;const reg=prior((x,a)=>{if(!fixture)fixture=x;return second(x,a)},sequenceWorkshop,sequence,workshop,bridge,paired,api);
 const x=JSON.parse(JSON.stringify(fixture)),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous third rotation'},id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 x.throughDate='2027-07-06';x.secondCycle.throughDate=x.throughDate;
 for(let date='2027-06-09';date<=x.throughDate;date=api.addDays(date,1)){
  const production=(date<='2027-06-20'||date>='2027-06-22'&&date<='2027-07-04'||date==='2027-07-06')?400:0;
  x.days.push({...x.days[0],date,productionAmount:production,shift1Team:production?'A':'',operatingHours:production?5:0});
 }
 for(const date of ['2027-06-21','2027-07-05'])x.slots.push({...x.slots[0],id:date,date});
 const p=x.pairedInputs[0],g=x.groups[0],members=[],dispatchPlans=[];
 for(const m of p.members){
  const k=String(m.stand),[a,b,c]=m.roles,ret=x.secondCycle.returnMasters.find(r=>r.standKey===k),u=x.secondCycle.members.find(r=>r.stand===k).replacementUsage;
  members.push({...v,stand:k,onlineIdentity:id(c),replacementIdentity:ret.identity,diameter:{...m.diameter,rollId:c.rollId,generation:c.generation,identity:id(c),currentMm:c.diameterMm},diameterHistory:m.diameterHistory});
  dispatchPlans.push({...v,stand:k,identity:id(b),status:'planned',date:'2027-06-15',cycleId:'second-'+k,priorCycleIds:['cycle-'+k],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
 }
 x.thirdCycle={...v,members,dispatchPlans,compatibility:{...p.compatibility,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(x.secondCycle.returnMasters.map(r=>[r.standKey,r.diameterMm]))}};
 x.upperCaliberSelections.push({...v,demandId:g.id,date:'2027-06-21',startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous fit',members:x.secondCycle.members.map(m=>({...v,standKey:m.stand,identity:m.replacementIdentity,oldId:'1',nextId:'2'}))});
 const before=JSON.stringify(x),r=preview(x,api),run=fn=>{const q=JSON.parse(JSON.stringify(x));fn(q);return preview(q,api);};
 const wrong=run(q=>q.thirdCycle.dispatchPlans[0].cycleId='cycle-8'),early=run(q=>q.thirdCycle.dispatchPlans[0].date='2027-06-07'),noAssembly=run(q=>q.secondCycle.workshopOptions.pop()),noFit=run(q=>q.thirdCycle.compatibility.lineFitConfirmed=false),noSlot=run(q=>q.slots=q.slots.filter(t=>t.date!=='2027-07-05'));
 const old=p.members[0].roles[1],q=x.secondCycle.members[0],event=r.second.second.events.find(e=>e.rollChanged),h=r.second.nextHandovers[0],d=x.thirdCycle.dispatchPlans[0],life=(mm)=>disposition(x,{...old,diameterMm:mm},{...q,diameter:{...q.diameter,currentMm:mm},onlineStartDate:'2027-05-02',finalUseStart:{...v,identity:id(old),status:'forecast',date:'2027-05-02'}},event,h,d,[],api);
 const final=life(405),boundary=life(407);
 const tests=[
 ['prior second cycle regression',reg.tests.every(t=>t[1])],
 ['second rework forecast 20 days July cost',r.dispositions.length===2&&r.dispositions.every(d=>d.rework?.expectedInboundDate==='2027-07-05'&&d.rework.plannedReworkCostMonth==='2027-07'&&d.rework.forecastDiameterMm===413&&!d.rework.receiptConfirmed)],
 ['second old roles ready for rework',r.projectedRoles.filter(r=>r.status==='rework-ready').length===2],
 ['third sequence dates and kinds',r.thirdRotationComplete&&r.third.events.map(e=>e.date).join(',')==='2027-06-21,2027-07-05'&&r.third.events.map(e=>e.workType).join(',')==='caliberChange,rollChange'],
 ['old A new generation becomes online',r.third?.ending[0]?.group.members.every(m=>m.generation==='g2'&&m.rollId.endsWith('-0')&&m.openingUsedTons===0)],
 ['three sets and old C reserve after third exchange',r.third?.rollHandoverCandidates[0]?.projectedRoles.length===6&&r.third.rollHandoverCandidates[0].projectedRoles.filter(r=>r.status==='used-standby'&&r.chockAssembled&&r.emergencyEligible).length===2],
 ['duplicate cycle blocks third',wrong.held.length>0&&!wrong.third],
 ['dispatch not before handover',early.held.length>0&&!early.third],
 ['missing second handover blocks third and keeps reserve',!noAssembly.third&&noAssembly.projectedRoles.some(r=>String(r.stand)==='9'&&r.status==='used-standby'&&r.emergencyEligible)],
 ['third geometry proof missing holds',noFit.third?.unresolved.length>0&&!noFit.thirdRotationComplete],
 ['third slot missing retains demand',noSlot.third?.unresolved.some(u=>u.requiredExchange===true)],
 ['final-use purchase forecast not rework',final.kind==='successor-needed'&&final.procurement?.latestOrderBy==='2026-12-05'&&final.procurement.idealOrderBy==='2026-11-02'&&!final.rework&&final.issueMonth===null],
 ['boundary is review not rework',boundary.kind==='boundary-review'&&!!boundary.procurement&&!boundary.rework],
 ['no actual state or annual completion',!r.complete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed&&!r.actualReceipt],
 ['source unchanged',JSON.stringify(x)===before]];
 return {tests,result:r,regression:reg.tests};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const w=require('./shared-workshop-handover.cjs'),t=require('./third-upper-rotation.cjs');const {tests}=selfTest(t.previewThirdUpperRotation,t.forecastDisposition,require('./conditional-second-upper-cycle.cjs').previewSecondUpperCycle,w.previewSequenceWorkshop,require('./repeated-upper-caliber.cjs').previewUpperSequence,w.previewSharedWorkshop,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
