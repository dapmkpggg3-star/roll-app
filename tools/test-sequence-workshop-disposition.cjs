'use strict';
const {selfTest:prior}=require('./test-repeated-upper-caliber.cjs');
function selfTest(preview,sequence,workshop,bridge,paired,api){
 let fixture;const reg=prior((x,a)=>{if(!fixture)fixture=x;return sequence(x,a)},workshop,bridge,paired,api);
 const x=JSON.parse(JSON.stringify(fixture)),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous sequence workshop'};
 x.workshopOptions=x.workshopOptions.filter(o=>o.demandId==='paired-8-9').map(o=>({...o,request:{...o.request,slot:{...o.request.slot,date:'2027-05-06'},day:{...o.request.day,date:'2027-05-06'},dispatchPlan:{...o.request.dispatchPlan,date:'2027-05-15'}}}));
 const alt=JSON.parse(JSON.stringify(x.workshopOptions[1]));alt.request.slot.date='2027-05-07';alt.request.day.date='2027-05-07';x.workshopOptions.push(alt);
 x.workshopDays=['2027-05-06','2027-05-07'].map(date=>({...v,...x.workshopOptions[0].request.day,date,workshopWorking:true}));
 x.workshopTargets=[];
 const before=JSON.stringify(x),r=preview(x,api),run=fn=>{const q=JSON.parse(JSON.stringify(x));fn(q);return preview(q,api);};
 const held=run(q=>q.workshopOptions=q.workshopOptions.slice(0,2)),future=run(q=>q.workshopOptions.forEach(o=>{o.request.receipt.date='2027-04-30';o.request.slot.preparedOn='2027-04-30';})),missing=run(q=>q.upperCaliberSelections.pop()),busy=run(q=>q.workshopReserved=[{...v,id:'manual',date:'2027-05-06',startHour:8,endHour:16}]),noReservation=run(q=>q.workshopReservationsVerified=false),late=run(q=>q.workshopTargets=[{...v,demandId:'paired-8-9',stand:'9',targetDate:'2027-05-06'}]);
 const role=(o,k,status)=>o.projectedRoles.find(r=>String(r.stand)===k&&r.status===status);
 const tests=[
 ['prior sequence regression',reg.tests.every(t=>t[1])],
 ['caliber twice roll once',r.sequence.events.length===3&&r.sequence.sequenceComplete],
 ['shared workshop separate dates',r.allocations.length===2&&r.allocations[0].date==='2027-05-06'&&r.allocations[1].date==='2027-05-07'&&r.workshopComplete],
 ['workshop forecast after roll only',r.allocations.every(a=>a.status==='conditional-assembly'&&a.actualCompletion===false&&a.date>'2027-05-02')],
 ['three roles and one emergency spare on each side',['8','9'].every(k=>r.projectedRoles.filter(o=>String(o.stand)===k).length===3&&r.projectedRoles.filter(o=>String(o.stand)===k&&o.status!=='online'&&o.chockAssembled&&o.emergencyEligible).length===1)],
 ['old online rework-ready and new standby',!!role(r,'8','rework-ready')&&!!role(r,'9','new-standby')],
 ['rework inbound month from dispatch',r.dispositions.length===2&&r.dispositions.every(d=>d.rework?.dispatchDate==='2027-05-15'&&d.rework.expectedInboundDate==='2027-06-04'&&d.rework.plannedReworkCostMonth==='2027-06'&&d.rework.actualInboundDate===null&&!d.rework.receiptConfirmed)],
 ['one overlapping option retains old used reserve',held.allocations.length===1&&!!role(held,'9','used-standby')&&held.held.some(h=>h.stand==='9'&&h.oldReserveRetained)&&!held.dispositions.some(d=>d.stand==='9'&&d.rework)],
 ['future receipt cannot be promoted to actual even after sequence cursor advances',future.allocations.length===0&&future.held.length===2&&['8','9'].every(k=>!!role(future,k,'used-standby'))],
 ['unverified earlier caliber switch blocks downstream handover',missing.sequence.events.length===1&&missing.allocations.length===0&&missing.dispositions.length===0],
 ['manual shared reservation blocks May 6',busy.allocations.length===1&&busy.allocations[0].stand==='9'&&busy.allocations[0].date==='2027-05-07'],
 ['unknown reservations hold both',noReservation.allocations.length===0&&noReservation.held.length===2],
 ['priority target reorders shared allocation',late.allocations.length===1&&late.allocations[0].stand==='9'&&late.allocations[0].date==='2027-05-06'],
 ['no operation approval or actual completion',!r.complete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed],
 ['input unchanged',JSON.stringify(x)===before]
 ];
 return {tests,result:r,regression:reg.tests};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const w=require('./shared-workshop-handover.cjs');const {tests}=selfTest(w.previewSequenceWorkshop,require('./repeated-upper-caliber.cjs').previewUpperSequence,w.previewSharedWorkshop,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
