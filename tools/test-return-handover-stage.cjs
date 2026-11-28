'use strict';
const {previewReturnHandover}=require('./return-handover-stage.cjs');
function selfTest(api){
 const s={anonymousOnly:true,asOf:'2027-04-01',throughDate:'2027-08-01',snapshotId:'anon',sourceRevision:'v1',workshopReservationsVerified:true,workshopReservationBasis:'anon capacity',workshopDays:[]},v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anon'},id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const stage={roles:[],event:{date:'2027-07-05',endMinute:900},group:{stands:['8','9'],size:'D10'},busy:[],priorCycles:[],dispositions:[]},plan={...v,returnMasters:[],workshopOptions:[],members:[],dispatchPlans:[]};
 for(const k of stage.group.stands){
  const old={stand:k,rollId:k+'C',generation:'g1',diameterMm:420,status:'used-standby',chockAssembled:true,emergencyEligible:true},online={stand:k,rollId:k+'A',generation:'g2',diameterMm:413,status:'online'},target={stand:k,rollId:k+'B',generation:'g1',diameterMm:420,status:'rework'},cycle='second-'+k,identity=JSON.stringify([k,target.rollId,'g2']),date=k==='8'?'2027-07-06':'2027-07-07',inbound='2027-07-05';
  stage.roles.push(old,online,target);stage.priorCycles.push(cycle);stage.dispositions.push({stand:k,identity:id(target),status:'conditional-rework',rework:{cycleId:cycle,expectedInboundDate:inbound,forecastDiameterMm:413,receiptConfirmed:false}});
  plan.returnMasters.push({...v,standKey:k,rollId:target.rollId,generation:'g2',identity,oldIdentity:id(target),cycleId:cycle,status:'forecast',diameterMm:413,expectedInboundDate:inbound,openingUsedTons:0,activeCalibers:[],caliberLedger:{...v,identity,complete:true,totalCalibers:2,calibers:[{...v,id:'1',state:'active',tons:0,runs:null},{...v,id:'2',state:'unused',tons:0,runs:null}]}});
  const row={...v,date,productionAmount:400,nightOperating:true,dateRowVerified:true,workshopWorking:true};s.workshopDays.push(row);
  plan.workshopOptions.push({...v,stand:k,oldIdentity:id(old),targetIdentity:identity,cycleId:cycle,receiptStatus:'forecast',sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anon',nightBasis:'anon',day:row,slot:{...v,date,workArea:'workshop',status:'forecast',period:'day',workshopWorking:true,workshopCalendarBasis:'anon',offlineIsolated:true,isolationBasis:'anon',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anon',startHour:8,endHour:12,workshopStartHour:8,workshopEndHour:17,requiredHours:4,reservedHours:4,people:3,availablePeople:3,prepared:'reworkInbound',preparedTarget:target.rollId,preparedOn:inbound,owner:{rollId:target.rollId,standKey:k}}});
  plan.members.push({...v,stand:k,diameter:{...v,stand:k,rollId:old.rollId,generation:old.generation,identity:id(old),status:'actual',limitApproved:true,limitBasis:'anon',measuredDate:s.asOf,currentMm:420,limitMm:400},diameterHistory:[{...v,stand:k,rollId:k+'X',cycleId:'past-'+k,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]});
  plan.dispatchPlans.push({...v,stand:k,identity:id(old),status:'planned',date:'2027-07-15',cycleId:'third-'+k,priorCycleIds:[cycle],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
 }
 const before=JSON.stringify([s,stage,plan]),r=previewReturnHandover(s,stage,plan,api),run=fn=>{const [a,b,c]=JSON.parse(before);fn(a,b,c);return previewReturnHandover(a,b,c,api);},retain=(r,k)=>r.roles.some(q=>String(q.stand)===k&&q.status==='used-standby'&&q.emergencyEligible&&q.chockAssembled);
 const deadlinePlan=(a,b,c)=>{c.deadlineMode=true;c.deadlineInputs=c.workshopOptions.map(o=>({...v,stand:o.stand,oldIdentity:o.oldIdentity,targetIdentity:o.targetIdentity,inboundRequiredBy:'2027-08-04',leadDays:20,leadBasis:'anon',needBasis:'anon',preDispatchDays:3,bufferBasis:'anon',nextExchangeDeadline:'2027-07-20'}));};
 const rd=run(deadlinePlan);
 return [
 ['R23 deadline-only instructions and conditional internal handover',rd.readyForNextRotation&&rd.workshopInstructions.length===2&&rd.workshopInstructions.every(x=>x.workDate===null&&x.assemblyDeadline==='2027-07-12'&&x.dispatchDeadline==='2027-07-15'&&x.actualCompletion===false)&&rd.handovers.length===2],
 ['R23 late dispatch retains reserve',retain(run((a,b,c)=>{deadlinePlan(a,b,c);c.dispatchPlans[0].date='2027-07-16';}),'8')],
 ['R23 missing deadline retains reserve',retain(run((a,b,c)=>{deadlinePlan(a,b,c);c.deadlineInputs.pop();}),'9')],
 ['R23 next exchange before candidate retains reserve',retain(run((a,b,c)=>{deadlinePlan(a,b,c);c.deadlineInputs[0].nextExchangeDeadline='2027-07-06';}),'8')],
 ['R23 wrong individual retains reserve',retain(run((a,b,c)=>{deadlinePlan(a,b,c);c.deadlineInputs[0].targetIdentity='wrong';}),'8')],
 ['third conditional handover and next rotation ready',r.readyForNextRotation&&r.conditionalHandoverComplete&&r.handovers.length===2&&r.roles.length===6],
 ['one emergency standby each',stage.group.stands.every(k=>r.roles.filter(q=>String(q.stand)===k&&q.status!=='online'&&q.chockAssembled&&q.emergencyEligible).length===1)],
 ['new generations only conditional',r.roles.filter(q=>q.status==='new-standby').every(q=>q.generation==='g2'&&q.forecastOnly&&q.conditionalAssembly)],
 ['third dispatch Aug inbound',r.dispositions.length===2&&r.dispositions.every(d=>d.rework?.expectedInboundDate==='2027-08-04'&&d.rework.plannedReworkCostMonth==='2027-08')],
 ['missing slot retains old reserve',retain(run((a,b,c)=>c.workshopOptions.pop()),'9')],
 ['prior reservation collision retains old',retain(run((a,b)=>b.busy.push({date:'2027-07-06',startHour:9,endHour:10})),'8')],
 ['same-day overlap across pair blocked',retain(run((a,b,c)=>{c.workshopOptions[1].slot.date='2027-07-06';c.workshopOptions[1].day.date='2027-07-06';}),'9')],
 ['no fake actual receipt',retain(run((a,b,c)=>c.workshopOptions[0].receiptStatus='actual'),'8')],
 ['same-day inbound held without time evidence',retain(run((a,b,c)=>{c.workshopOptions[0].slot.date='2027-07-05';c.workshopOptions[0].day.date='2027-07-05';}),'8')],
 ['wrong diameter retains old',retain(run((a,b,c)=>c.returnMasters[0].diameterMm=420),'8')],
 ['nonzero usage refused',retain(run((a,b,c)=>c.returnMasters[0].caliberLedger.calibers[0].tons=100),'8')],
 ['unknown reservations stop',!run(a=>a.workshopReservationsVerified=false).handovers.length],
 ['duplicate prior cycles stop',!run((a,b)=>b.priorCycles.push(b.priorCycles[0])).handovers.length],
 ['missing dispatch held after safe handover',!run((a,b,c)=>c.dispatchPlans.pop()).readyForNextRotation],
 ['no actual state',!r.actualReceipt&&!r.actualAssembly&&!r.operationAuthorized&&!r.writeAllowed],
 ['input preserved',JSON.stringify([s,stage,plan])===before]
 ];
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const tests=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
