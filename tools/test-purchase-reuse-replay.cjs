'use strict';
const {selfTest:firstUse}=require('./test-successor-first-use.cjs');
const {previewReturnHandover}=require('./return-handover-stage.cjs');
const {previewFollowingUpperSequence}=require('./following-upper-rotation.cjs');
const {forecastFirstPurchaseUse}=require('./successor-first-use.cjs');
function selfTest(api){
 const front=firstUse(api),s=JSON.parse(JSON.stringify(front.chain.s)),v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anonymous'};
 const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const spareOk=roles=>['8','9'].every(k=>roles.filter(r=>String(r.stand)===k).length===3&&roles.filter(r=>String(r.stand)===k&&r.status!=='online'&&r.emergencyEligible&&r.chockAssembled).length===1);
 const costOk=ds=>ds.length===2&&ds.every(d=>d.rework&&d.rework.plannedReworkCostMonth===d.rework.expectedInboundDate.slice(0,7));
 const event=front.result.sequence.events.find(e=>e.rollChanged);
 const roles=JSON.parse(JSON.stringify(front.result.endingRoles));
 const stage={roles,event:{date:event.date,endMinute:event.endMinute},group:{stands:['8','9'],size:'D10'},busy:JSON.parse(JSON.stringify(front.work.busy)),priorCycles:front.work.priorCycles.slice(),dispositions:JSON.parse(JSON.stringify(front.work.dispositions)),admissions:JSON.parse(JSON.stringify(front.chain.admission.admissions))};
 const plan={...v,returnMasters:[],workshopOptions:[],members:[],dispatchPlans:[]};
 for(const k of ['8','9']){
  const date=k==='8'?'2028-01-06':'2028-01-07',target=roles.find(r=>String(r.stand)===k&&r.rollId===k+'B'),old=roles.find(r=>String(r.stand)===k&&r.status==='used-standby'),ident=JSON.stringify([k,target.rollId,'g3']);
  plan.returnMasters.push({...v,standKey:k,rollId:target.rollId,generation:'g3',identity:ident,status:'forecast',diameterMm:406,size:'D10',usageBasis:'anonymous',remainingBasis:'anonymous',openingUsedTons:0,activeCalibers:[],expectedInboundDate:'2027-12-15',cycleId:'after-D-'+k,oldIdentity:id(target),caliberLedger:{...v,identity:ident,complete:true,totalCalibers:2,calibers:[{...v,id:'1',state:'active',tons:0,runs:null},{...v,id:'2',state:'unused',tons:0,runs:null}]}});
  const row={...v,date,dateRowVerified:true,productionAmount:400,nightOperating:true,workshopWorking:true,recordKind:'plan'};
  s.workshopDays.push(row);
  plan.workshopOptions.push({...v,stand:k,oldIdentity:id(old),targetIdentity:ident,cycleId:'after-D-'+k,receiptStatus:'forecast',sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anonymous',nightBasis:'anonymous',day:row,slot:{...v,date,workArea:'workshop',status:'forecast',period:'day',workshopWorking:true,workshopCalendarBasis:'anonymous',offlineIsolated:true,isolationBasis:'anonymous',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anonymous',startHour:8,endHour:16,workshopStartHour:8,workshopEndHour:17,requiredHours:6,reservedHours:6,people:3,availablePeople:3,prepared:'reworkInbound',preparedTarget:target.rollId,preparedOn:'2027-12-15',owner:{rollId:target.rollId,standKey:k}}});
  plan.members.push({...v,stand:k,diameter:{...v,stand:k,rollId:old.rollId,generation:old.generation,identity:id(old),status:'actual',limitApproved:true,limitBasis:'anonymous',measuredDate:s.asOf,currentMm:old.diameterMm,limitMm:400},diameterHistory:[{...v,stand:k,rollId:'history-'+k,cycleId:'past-'+k,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]});
  plan.dispatchPlans.push({...v,stand:k,identity:id(old),status:'planned',date:'2028-01-12',cycleId:'c-after-'+k,priorCycleIds:['after-D-'+k],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
 }
 s.throughDate='2028-03-31';
 const returnedB=previewReturnHandover(s,stage,plan,api);
 const near=g=>g.members.map(m=>({...m,openingUsedTons:5000,nextCaliberAvailable:false,activeCalibers:[],caliberLedger:{...m.caliberLedger,totalCalibers:1,calibers:[{...v,id:'1',state:'active',tons:5000,runs:null}]}}));
 const stop=(id,date,demand)=>s.slots.push({...v,id,date,startMinute:480,endMinute:1000,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,reserved:[],eligibility:[{...v,demandId:demand,deadlineBasis:v.basis+'／当日の予定使用量で計画基準超過見込み・操業前に交換',compatibilityBasis:v.basis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true}]});
 s.days=s.days.filter(d=>d.date<'2028-01-01');
 for(let date='2028-01-01';date<=s.throughDate;date=api.addDays(date,1)){const production=date>='2028-01-09'&&date<='2028-01-20'?400:0;s.days.push({...v,date,dateRowVerified:true,recordKind:'plan',productionAmount:production,nightProductionAmount:0,size:'D10',grade:'SD295',shift1Team:production?'A':'',operatingHours:production?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anonymous'});}
 s.slots=s.slots.filter(t=>t.date>='2028-01-01');
 stop('2028-01-08','2028-01-08',front.result.endingGroup.id);
 const rotate=(group,cursor,stage,reservations,onlineStatus,spareStatus)=>{
  const g=JSON.parse(JSON.stringify(group));g.members=near(g);
  const repl=[],members=[];
  for(const k of ['8','9']){
   const spare=stage.roles.find(r=>String(r.stand)===k&&r.status===spareStatus),online=stage.roles.find(r=>String(r.stand)===k&&r.status===onlineStatus);
   repl.push({...v,standKey:k,rollId:spare.rollId,generation:spare.generation,identity:id(spare),size:'D10',usageBasis:'anonymous',remainingBasis:'anonymous',openingUsedTons:0,activeCalibers:[],caliberLedger:{...v,identity:id(spare),complete:true,totalCalibers:1,calibers:[{...v,id:'1',state:'active',tons:0,runs:null}]}});
   members.push({...v,stand:k,onlineIdentity:id(online),replacementIdentity:id(spare),diameter:{...v,stand:k,rollId:online.rollId,generation:online.generation,identity:id(online),status:'actual',limitApproved:true,limitBasis:'anonymous',measuredDate:s.asOf,currentMm:online.diameterMm,limitMm:400},diameterHistory:[{...v,stand:k,rollId:'history-'+k,cycleId:'past-'+k,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]});
  }
  const compatibility={...v,size:'D10',status:'compatible',lineFitConfirmed:true,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(members.map(m=>[m.stand,stage.roles.find(r=>id(r)===m.replacementIdentity).diameterMm]))};
  return previewFollowingUpperSequence(s,{group:g,cursor,stage,replacementMasters:repl,original:{...v,anonymousOnly:true,stand:8,size:'D10'},reservations},{...v,members,compatibility},api);
 };
 const toB=rotate(front.result.endingGroup,'2028-01-01',returnedB,front.result.reservations,'online','new-standby');
 const roles2=JSON.parse(JSON.stringify(toB.endingRoles||[]));
 const ev=toB.sequence?.events.find(e=>e.rollChanged);
 const stage2={roles:roles2,event:ev&&{date:ev.date,endMinute:ev.endMinute},group:{stands:['8','9'],size:'D10'},busy:JSON.parse(JSON.stringify(returnedB.busy)),priorCycles:returnedB.priorCycles.slice(),dispositions:JSON.parse(JSON.stringify(returnedB.dispositions)),admissions:JSON.parse(JSON.stringify(front.chain.admission.admissions))};
 const plan2={...v,returnMasters:[],workshopOptions:[],members:[],dispatchPlans:[]};
 if(ev)for(const k of ['8','9']){
  const date=k==='8'?'2028-02-03':'2028-02-04',target=roles2.find(r=>String(r.stand)===k&&r.rollId===k+'C'),old=roles2.find(r=>String(r.stand)===k&&r.status==='used-standby'),disp=returnedB.dispositions.find(d=>d.stand===k),ident=JSON.stringify([k,target.rollId,'g3']);
  plan2.returnMasters.push({...v,standKey:k,rollId:target.rollId,generation:'g3',identity:ident,status:'forecast',diameterMm:disp.rework.forecastDiameterMm,size:'D10',usageBasis:'anonymous',remainingBasis:'anonymous',openingUsedTons:0,activeCalibers:[],expectedInboundDate:disp.rework.expectedInboundDate,cycleId:disp.rework.cycleId,oldIdentity:id(target),caliberLedger:{...v,identity:ident,complete:true,totalCalibers:2,calibers:[{...v,id:'1',state:'active',tons:0,runs:null},{...v,id:'2',state:'unused',tons:0,runs:null}]}});
  const row={...v,date,dateRowVerified:true,productionAmount:0,nightOperating:true,workshopWorking:true,recordKind:'plan'};s.workshopDays.push(row);
  plan2.workshopOptions.push({...v,stand:k,oldIdentity:id(old),targetIdentity:ident,cycleId:disp.rework.cycleId,receiptStatus:'forecast',sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anonymous',nightBasis:'anonymous',day:row,slot:{...v,date,workArea:'workshop',status:'forecast',period:'day',workshopWorking:true,workshopCalendarBasis:'anonymous',offlineIsolated:true,isolationBasis:'anonymous',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anonymous',startHour:8,endHour:12,workshopStartHour:8,workshopEndHour:17,requiredHours:4,reservedHours:4,people:3,availablePeople:3,prepared:'reworkInbound',preparedTarget:target.rollId,preparedOn:disp.rework.expectedInboundDate,owner:{rollId:target.rollId,standKey:k}}});
  const admission=front.chain.admission.admissions.find(a=>a.stand===k),master=front.chain.plan.returnMasters.find(m=>m.standKey===k);
  plan2.members.push({...v,stand:k,purchaseAnchor:{...v,master:JSON.parse(JSON.stringify(master)),admission:{...JSON.parse(JSON.stringify(admission)),snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:master.basis},limit:{...v,identity:id(old),approved:true,mm:400},history:[{...v,stand:k,rollId:'history-'+k,cycleId:'past-'+k,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]}});
  plan2.dispatchPlans.push({...v,stand:k,identity:id(old),status:'planned',date:'2028-02-10',cycleId:'d-first-'+k,priorCycleIds:[disp.rework.cycleId],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
 }
 const regrind=ev?previewReturnHandover(s,stage2,plan2,api):{readyForNextRotation:false,held:[{reason:'exchange missing'}],roles:[],dispositions:[],handovers:[]};
 for(const d of s.days)if(d.date>='2028-01-09'){d.productionAmount=d.date==='2028-02-10'?400:0;d.shift1Team=d.productionAmount?'A':'';d.operatingHours=d.productionAmount?5:0;}
 stop('2028-02-09','2028-02-09',front.result.endingGroup.id);
 const toC=regrind.readyForNextRotation?rotate(toB.endingGroup,toB.cursor,regrind,toB.reservations,'online','new-standby'):{rotationComplete:false,held:[]};
 const roles3=JSON.parse(JSON.stringify(toC.endingRoles||[])),ev2=toC.sequence?.events.find(e=>e.rollChanged);
 const stage3={roles:roles3,event:ev2&&{date:ev2.date,endMinute:ev2.endMinute},group:{stands:['8','9'],size:'D10'},busy:JSON.parse(JSON.stringify(regrind.busy||[])),priorCycles:(regrind.priorCycles||[]).slice(),dispositions:JSON.parse(JSON.stringify(regrind.dispositions||[])),admissions:[]};
 const plan3={...v,returnMasters:[],workshopOptions:[],members:[],dispatchPlans:[]};
 if(ev2)for(const k of ['8','9']){
  const date=k==='8'?'2028-03-03':'2028-03-04',target=roles3.find(r=>String(r.stand)===k&&r.rollId===k+'D'),old=roles3.find(r=>String(r.stand)===k&&r.status==='used-standby'),disp=regrind.dispositions.find(d=>d.stand===k),ident=JSON.stringify([k,target.rollId,'r1']);
  plan3.returnMasters.push({...v,standKey:k,rollId:target.rollId,generation:'r1',identity:ident,status:'forecast',diameterMm:disp.rework.forecastDiameterMm,size:'D10',usageBasis:'anonymous',remainingBasis:'anonymous',openingUsedTons:0,activeCalibers:[],expectedInboundDate:disp.rework.expectedInboundDate,cycleId:disp.rework.cycleId,oldIdentity:id(target),caliberLedger:{...v,identity:ident,complete:true,totalCalibers:1,calibers:[{...v,id:'1',state:'active',tons:0,runs:null}]}});
  const row={...v,date,dateRowVerified:true,productionAmount:0,nightOperating:true,workshopWorking:true,recordKind:'plan'};s.workshopDays.push(row);
  plan3.workshopOptions.push({...v,stand:k,oldIdentity:id(old),targetIdentity:ident,cycleId:disp.rework.cycleId,receiptStatus:'forecast',sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anonymous',nightBasis:'anonymous',day:row,slot:{...v,date,workArea:'workshop',status:'forecast',period:'day',workshopWorking:true,workshopCalendarBasis:'anonymous',offlineIsolated:true,isolationBasis:'anonymous',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anonymous',startHour:8,endHour:12,workshopStartHour:8,workshopEndHour:17,requiredHours:4,reservedHours:4,people:3,availablePeople:3,prepared:'reworkInbound',preparedTarget:target.rollId,preparedOn:disp.rework.expectedInboundDate,owner:{rollId:target.rollId,standKey:k}}});
  plan3.members.push({...v,stand:k,diameter:{...v,stand:k,rollId:old.rollId,generation:old.generation,identity:id(old),status:'actual',limitApproved:true,limitBasis:'anonymous',measuredDate:s.asOf,currentMm:old.diameterMm,limitMm:400},diameterHistory:[{...v,stand:k,rollId:'history-'+k,cycleId:'cut4-'+k,status:'actual',kind:'rework',before:420,after:416,inboundDate:'2027-03-01'}]});
  plan3.dispatchPlans.push({...v,stand:k,identity:id(old),status:'planned',date:'2028-03-08',cycleId:'b-next-'+k,priorCycleIds:[disp.rework.cycleId],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
 }
 const back=ev2?previewReturnHandover(s,stage3,plan3,api):{readyForNextRotation:false,held:[],roles:[],dispositions:[],handovers:[],workshopInstructions:[]};
 const deadlinePlan=JSON.parse(JSON.stringify(plan3));
 deadlinePlan.deadlineMode=true;
 deadlinePlan.deadlineInputs=(deadlinePlan.workshopOptions||[]).map(o=>({...v,stand:o.stand,oldIdentity:o.oldIdentity,targetIdentity:o.targetIdentity,inboundRequiredBy:'2028-03-28',leadDays:20,leadBasis:'anonymous',needBasis:'anonymous',preDispatchDays:3,bufferBasis:'anonymous',nextExchangeDeadline:'2028-03-20'}));
 const timed=ev2?previewReturnHandover(JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(stage3)),deadlinePlan,api):{workshopInstructions:[],handovers:[]};
 for(const d of s.days)if(d.date>='2028-02-10'){d.productionAmount=d.date==='2028-03-06'?400:0;d.shift1Team=d.productionAmount?'A':'';d.operatingHours=d.productionAmount?5:0;}
 stop('2028-03-05','2028-03-05',front.result.endingGroup.id);
 const reuse=back.readyForNextRotation?rotate(toC.endingGroup,toC.cursor,back,toC.reservations,'online','new-standby'):{rotationComplete:false,held:[],plannedIssues:null,endingRoles:[]};
 const reused=reuse.endingRoles?.find(r=>r.rollId==='8D'&&r.status==='online');
 let lost={issues:[1],held:[]};
 if(reused){
  const bare={...reused};delete bare.purchaseFirstUse;delete bare.purchaseReworked;delete bare.purchaseOriginIdentity;
  const earlier={...reused,generation:'new',status:'rework',purchaseReworked:true};delete earlier.purchaseFirstUse;delete earlier.purchaseOriginIdentity;
  lost=forecastFirstPurchaseUse(s,{roles:[earlier],handovers:back.handovers},reuse.sequence,[bare],api);
 }
 const issues=front.result.plannedIssues||[];
 return [
  ['scrap admit assembly and first use',front.tests.every(t=>t[1])],
  ['first issue once in January',issues.length===2&&issues.every(i=>i.plannedIssueMonth==='2028-01'&&i.actualIssue===false)],
  ['three sets and one reserve after first use',spareOk(front.result.endingRoles)],
  ['B return keeps one reserve and inbound cost month',returnedB.readyForNextRotation&&spareOk(returnedB.roles)&&costOk(returnedB.dispositions)],
  ['D leaves service without a second issue',toB.rotationComplete&&(toB.plannedIssues||[]).length===0&&spareOk(toB.endingRoles)],
  ['D first regrind costs the March inbound not the February dispatch',regrind.readyForNextRotation&&regrind.dispositions.every(d=>d.rework?.dispatchDate==='2028-02-10'&&d.rework.expectedInboundDate==='2028-03-01'&&d.rework.plannedReworkCostMonth==='2028-03'&&d.rework.forecastDiameterMm===443)&&spareOk(regrind.roles)],
  ['returned D is reworked and keeps the January issue',back.readyForNextRotation&&back.roles.filter(r=>r.purchaseSuccessor).every(r=>r.generation==='r1'&&r.purchaseReworked===true&&r.purchaseFirstUse.plannedIssueMonth==='2028-01'&&r.diameterMm===443)&&spareOk(back.roles)&&costOk(back.dispositions)],
  ['reuse does not issue again',reuse.rotationComplete&&(reuse.plannedIssues||[]).length===0&&reuse.endingRoles.filter(r=>r.status==='online').every(r=>r.rollId.endsWith('D')&&r.generation==='r1'&&r.purchaseFirstUse.plannedIssueMonth==='2028-01')&&spareOk(reuse.endingRoles)],
  ['missing history on another generation holds',lost.issues.length===0&&lost.held.length===1&&lost.held[0].reason==='改削済み購入個体の初回払出履歴欠損'],
  ['R23 deadline does not assign a work day',timed.workshopInstructions.length===2&&timed.workshopInstructions.every(x=>x.workDate===null&&x.status==='conditional-deadline'&&x.actualCompletion===false)&&timed.handovers.every(h=>h.workDate==null)],
  ['no actual write',!front.result.writeAllowed&&!returnedB.writeAllowed&&!regrind.writeAllowed&&!back.writeAllowed&&!reuse.writeAllowed&&!reuse.operationAuthorized]
 ];
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const tests=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
