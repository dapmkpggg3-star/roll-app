'use strict';
const {selfTest:prior}=require('./test-sequence-workshop-disposition.cjs');
function selfTest(preview,sequenceWorkshop,sequence,workshop,bridge,paired,api){
 let fixture;const reg=prior((x,a)=>{if(!fixture)fixture=x;return sequenceWorkshop(x,a)},sequence,workshop,bridge,paired,api);
 const x=JSON.parse(JSON.stringify(fixture)),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous second cycle'},id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 x.throughDate='2027-06-08';
 for(let d='2027-05-04';d<=x.throughDate;d=api.addDays(d,1)){
  const production=(d>='2027-05-08'&&d<='2027-05-19'||d>='2027-05-21'&&d<='2027-06-02'||d==='2027-06-06')?400:0;
  x.days.push({...x.days[0],date:d,productionAmount:production,nightProductionAmount:0,shift1Team:production?'A':'',operatingHours:production?5:0});
 }
 const template=x.slots[0];for(const d of ['2027-05-20','2027-06-05'])x.slots.push({...template,date:d,id:d});
 const p=x.pairedInputs[0],g=x.groups[0],members=[],returnMasters=[],options=[];
 for(const m of p.members){
  const k=String(m.stand),[a,b,c]=m.roles,old=g.members.find(u=>u.standKey===k),u=p.replacementUsage.find(u=>u.standKey===k);
  const replacementUsage={...u,rollId:c.rollId,generation:c.generation,identity:id(c),caliberLedger:{...u.caliberLedger,identity:id(c)}};
  members.push({...v,stand:k,onlineIdentity:id(b),replacementIdentity:id(c),diameter:{...m.diameter,rollId:b.rollId,generation:b.generation,identity:id(b),currentMm:b.diameterMm},diameterHistory:m.diameterHistory,replacementUsage});
  const next={...old,generation:'g2',identity:JSON.stringify([k,a.rollId,'g2']),openingUsedTons:0,activeCalibers:[],caliberLedger:{...old.caliberLedger,identity:JSON.stringify([k,a.rollId,'g2']),totalCalibers:3,calibers:['active','unused','unused'].map((state,i)=>({...v,id:String(i+1),state,tons:0,runs:null}))}};
  returnMasters.push({...next,...v,status:'forecast',cycleId:'cycle-'+k,oldIdentity:id(a),expectedInboundDate:'2027-06-04',diameterMm:413});
  const req=x.workshopOptions.find(o=>String(o.stand)===k).request,date=k==='8'?'2027-06-07':'2027-06-08';
  options.push({...v,stand:k,oldIdentity:id(b),targetIdentity:next.identity,cycleId:'cycle-'+k,receiptStatus:'forecast',slot:{...req.slot,date,owner:{rollId:a.rollId,standKey:k},preparedTarget:a.rollId,preparedOn:'2027-06-04'},day:{...req.day,date},sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anonymous',nightBasis:'anonymous'});
  x.workshopDays.push({...v,...req.day,date,workshopWorking:true});
 }
 x.secondCycle={...v,throughDate:x.throughDate,members,returnMasters,workshopOptions:options,compatibility:{...p.compatibility,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(p.members.map(m=>[m.stand,m.roles[2].diameterMm]))}};
 x.upperCaliberSelections.push({...v,demandId:g.id,date:'2027-05-20',startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous fit',members:p.replacementUsage.map(u=>({...v,standKey:u.standKey,identity:u.identity,oldId:'1',nextId:'2'}))});
 const before=JSON.stringify(x),r=preview(x,api),run=fn=>{const q=JSON.parse(JSON.stringify(x));fn(q);return preview(q,api);};
 const badGen=run(q=>q.secondCycle.returnMasters[0].generation='g1'),badDiameter=run(q=>q.secondCycle.returnMasters[0].diameterMm=420),badCount=run(q=>q.secondCycle.returnMasters[0].caliberLedger.totalCalibers=4),badHistory=run(q=>q.secondCycle.returnMasters[0].caliberLedger.calibers[0].tons=100),noAssembly=run(q=>q.secondCycle.workshopOptions.pop()),fake=run(q=>q.secondCycle.workshopOptions[0].receiptStatus='actual'),noFirst=run(q=>q.workshopOptions=[]),noSlot=run(q=>q.slots=q.slots.filter(t=>t.date!=='2027-06-05')),overlap=run(q=>{const o=q.secondCycle.workshopOptions[1];o.slot.date=o.day.date='2027-06-07';});
 const beyond=run(q=>{const o=q.secondCycle.workshopOptions[1];o.slot.date=o.day.date='2027-06-09';q.workshopDays.push({...q.workshopDays.at(-1),date:'2027-06-09'});});
 const role=(q,k,status)=>q.projectedRoles.find(r=>String(r.stand)===k&&r.status===status);
 const tests=[
 ['prior workshop regression',reg.tests.every(t=>t[1])],
 ['second sequence uses first new online',r.second?.events.map(e=>e.workType).join(',')==='caliberChange,rollChange'&&r.second.events[0].oldGroup.members[0].rollId===p.members[0].roles[1].rollId],
 ['second exchange dates',r.second?.events.map(e=>e.date).join(',')==='2027-05-20,2027-06-05'],
 ['return new generation zero usage and 0/6',r.returns.length===2&&r.returns.every(t=>t.newIdentity!==t.oldIdentity&&t.diameterMm===413&&t.initialCycleProgress===0&&t.progressTotal===6&&t.caliberLedger.calibers.every(c=>c.tons===0)&&!t.actualReceipt&&!t.chockAssembled&&!t.emergencyEligible)],
 ['original full history retained',r.returns[0]?.oldCaliberLedger.calibers.map(c=>c.tons).join(',')==='5190,5265,5200,5200'],
 ['forecast handovers only after receipt',r.nextHandovers.length===2&&r.nextHandovers.every(h=>h.date>'2027-06-04'&&!h.actualCompletion&&!h.receiptConfirmed)],
 ['3 sets one conditional spare per side',r.conditionalCycleComplete&&['8','9'].every(k=>r.projectedRoles.filter(z=>String(z.stand)===k).length===3&&r.projectedRoles.filter(z=>String(z.stand)===k&&z.status!=='online'&&z.emergencyEligible&&z.chockAssembled).length===1&&role(r,k,'new-standby').generation==='g2')],
 ['same generation rejected',badGen.held.length>0&&!badGen.second],
 ['wrong diameter rejected',badDiameter.held.length>0&&!badDiameter.second],
 ['unknown count rejected',badCount.held.length>0&&!badCount.second],
 ['nonzero return rejected',badHistory.held.length>0&&!badHistory.second],
 ['missing assembly keeps old spare',noAssembly.nextHandovers.length===1&&role(noAssembly,'9','used-standby')?.emergencyEligible===true],
 ['forecast cannot become actual',fake.nextHandovers.length===1&&role(fake,'8','used-standby')?.emergencyEligible===true],
 ['first assembly required',noFirst.held.length>0&&!noFirst.second],
 ['second roll slot missing holds demand',noSlot.second?.unresolved.some(u=>u.requiredExchange===true)&&!noSlot.nextHandovers.length],
 ['shared second workshop capacity',overlap.nextHandovers.length===1&&role(overlap,'9','used-standby')?.emergencyEligible===true],
 ['no actual writes or authorization',!r.actualReceipt&&!r.actualAssembly&&!r.operationAuthorized&&!r.writeAllowed&&!r.annualComplete],
 ['outside horizon assembly not projected',beyond.nextHandovers.length===1&&role(beyond,'9','used-standby')?.emergencyEligible===true],
 ['source unchanged',JSON.stringify(x)===before]];
 return {tests,result:r,regression:reg.tests};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const w=require('./shared-workshop-handover.cjs');const {tests}=selfTest(require('./conditional-second-upper-cycle.cjs').previewSecondUpperCycle,w.previewSequenceWorkshop,require('./repeated-upper-caliber.cjs').previewUpperSequence,w.previewSharedWorkshop,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
