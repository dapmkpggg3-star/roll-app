'use strict';
const {fixture}=require('./test-successor-three-set.cjs');
const {selfTest:prior}=require('./test-successor-following.cjs');
const {previewSuccessorAdmission}=require('./successor-three-set.cjs');
const {previewReturnHandover}=require('./return-handover-stage.cjs');
const {previewFollowingUpperSequence}=require('./following-upper-rotation.cjs');
const {forecastFirstPurchaseUse}=require('./successor-first-use.cjs');
function selfTest(api){
 const {s,stage,event,group,plans,known}=fixture(api),prev=prior(api),a=previewSuccessorAdmission(s,stage,event,group,plans,known,api),v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anonymous'},id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const g=prev.result.endingGroup,e=prev.result.sequence.events.find(e=>e.rollChanged),cursor=prev.result.cursor;
 s.throughDate='2028-01-02';s.workshopReservationsVerified=true;s.workshopReservationBasis='anonymous';s.workshopDays=[];s.days=[];s.slots=[];s.upperCaliberSelections=[];s.setupNightHistory=[];
 for(let date=cursor;date<=s.throughDate;date=api.addDays(date,1)){const production=(date<='2027-12-02'||date>='2027-12-04'&&date<='2027-12-16'||date==='2028-01-01')?400:0;s.days.push({...v,date,dateRowVerified:true,recordKind:'plan',productionAmount:production,nightProductionAmount:0,size:'D10',grade:'SD295',shift1Team:production?'A':'',operatingHours:production?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anonymous'});}
 const master=plans.map(p=>p.master),work={...v,returnMasters:master,workshopOptions:[],members:[],dispatchPlans:[]},next={...v,members:[],compatibility:{...v,size:'D10',status:'compatible',lineFitConfirmed:true,oldIdentities:{},replacementIdentities:{},replacementDiameters:{}}};
 const evidence=r=>({...v,stand:String(r.stand),diameter:{...v,stand:r.stand,rollId:r.rollId,generation:r.generation,identity:id(r),status:'actual',limitApproved:true,limitBasis:'anonymous',measuredDate:s.asOf,currentMm:r.diameterMm,limitMm:400},diameterHistory:[{...v,stand:r.stand,rollId:'history-'+r.stand,cycleId:'past-'+r.stand,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]});
 for(const [i,k] of g.stands.entries()){
  const old=prev.result.endingRoles.find(r=>String(r.stand)===k&&r.status==='used-standby'),online=prev.result.endingRoles.find(r=>String(r.stand)===k&&r.status==='online'),m=master.find(m=>m.standKey===k),ad=a.admissions.find(x=>x.stand===k),date=i?'2027-11-21':'2027-11-20',row={...v,date,dateRowVerified:true,productionAmount:400,nightOperating:true,workshopWorking:true};
  s.workshopDays.push(row);
  work.members.push(evidence(old));work.dispatchPlans.push({...v,stand:k,identity:id(old),status:'planned',date:'2027-11-25',cycleId:'after-D-'+k,priorCycleIds:[],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
  work.workshopOptions.push({...v,stand:k,oldIdentity:id(old),targetIdentity:m.identity,purchaseAdmissionDate:ad.date,receiptStatus:'forecast',sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anonymous',nightBasis:'anonymous',day:row,slot:{...v,date,workArea:'workshop',status:'forecast',period:'day',workshopWorking:true,workshopCalendarBasis:'anonymous',offlineIsolated:true,isolationBasis:'anonymous',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anonymous',startHour:8,endHour:16,workshopStartHour:8,workshopEndHour:17,requiredHours:6,reservedHours:6,people:3,availablePeople:3,prepared:'newSide',preparedTarget:m.rollId,preparedOn:ad.expectedReceiptDate,owner:{rollId:m.rollId,standKey:k}}});
  next.members.push({...evidence(online),onlineIdentity:id(online),replacementIdentity:m.identity});next.compatibility.oldIdentities[k]=id(online);next.compatibility.replacementIdentities[k]=m.identity;next.compatibility.replacementDiameters[k]=m.diameterMm;
 }
 for(const date of ['2027-12-03','2027-12-31'])s.slots.push({...v,id:date,date,startMinute:480,endMinute:1000,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,reserved:[],eligibility:[{...v,demandId:g.id,deadlineBasis:g.basis+'／当日の予定使用量で計画基準超過見込み・操業前に交換',compatibilityBasis:v.basis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true}]});
 s.upperCaliberSelections.push({...v,demandId:g.id,date:'2027-12-03',startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous',members:g.members.map(m=>({...v,standKey:m.standKey,identity:m.identity,oldId:'1',nextId:'2'}))});
 const input={roles:prev.result.endingRoles,event:e,group:g,busy:a.busy,priorCycles:a.priorCycles,dispositions:a.dispositions,admissions:a.admissions};
 const h=previewReturnHandover(s,input,work,api),state={group:g,cursor,stage:h,replacementMasters:master,original:{...v,anonymousOnly:true,stand:8,size:'D10'},reservations:prev.result.reservations};
 const r=previewFollowingUpperSequence(s,state,next,api),before=JSON.stringify([s,input,work,state,next]);
 const blocked=previewReturnHandover(s,input,{...work,workshopOptions:work.workshopOptions.slice(0,1)},api);
 const pending=r.rotationComplete?forecastFirstPurchaseUse({...s,throughDate:'2027-12-31'},h,r.sequence,r.endingRoles.map(t=>{const q={...t};delete q.purchaseFirstUse;return q;}),api):null;
 const duplicate=r.rotationComplete?forecastFirstPurchaseUse(s,h,r.sequence,r.endingRoles,api):null;
 return {result:r,work:h,tests:[
 ['prior successor tests',prev.tests.every(t=>t[1])],
 ['D assembled without a fourth set',h.readyForNextRotation&&h.roles.length===6&&h.purchases.length===2&&h.roles.filter(r=>r.purchaseSuccessor).every(r=>r.status==='new-standby'&&r.chockAssembled&&r.emergencyEligible)],
 ['old B becomes rework only after handover',h.dispositions.every(d=>d.rework?.expectedInboundDate==='2027-12-15')&&h.roles.filter(r=>r.status==='rework-ready').length===2],
 ['missing D assembly retains old emergency reserve',blocked.roles.some(r=>String(r.stand)==='9'&&r.status==='used-standby'&&r.emergencyEligible)&&!blocked.readyForNextRotation],
 ['D online via real exchange sequence',r.rotationComplete&&r.sequence.events.map(e=>e.date).join(',')==='2027-12-03,2027-12-31'&&r.endingRoles.filter(r=>r.status==='online').every(r=>r.purchaseSuccessor)],
 ['issue January not December exchange or receipt',r.plannedIssues?.length===2&&r.plannedIssues.every(i=>i.firstUseDate==='2028-01-01'&&i.plannedIssueMonth==='2028-01'&&!i.actualIssue&&i.actualIssueDate===null)],
 ['no production in horizon no issue',pending?.issues.length===0&&pending.pending.length===2],
 ['no duplicate first issue',duplicate?.issues.length===0],
 ['three sets and one reserve after D online',r.endingRoles?.length===6&&g.stands.every(k=>r.endingRoles.filter(t=>String(t.stand)===k&&t.status!=='online'&&t.emergencyEligible&&t.chockAssembled).length===1)],
 ['no mutation or actual write',JSON.stringify([s,input,work,state,next])===before&&!r.operationAuthorized&&!r.writeAllowed&&!r.annualComplete]
 ]};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
