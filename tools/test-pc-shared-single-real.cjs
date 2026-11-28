'use strict';
// Focused real-engine integration: only #2, not a downstream or annual completion test.
const {previewPcSharedCirculation}=require('./pc-shared-circulation.cjs');
function fixture(api){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'anonymous'},asOf='2027-04-01',throughDate='2027-04-05',id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const roles=['online','new-standby','unassembled-return'].map((status,i)=>({...v,stand:'2',rollId:'R'+i,generation:'g1',status,chockAssembled:i!==2,emergencyEligible:i!==2,diameterMm:420}));
 const [old,next,target]=roles;
 const group={...v,id:'g2',stands:['2'],members:[{...v,standKey:'2',rollId:old.rollId,generation:'g1',usageBasis:'anon ton',openingUsedTons:13900}],workType:'rollChange',size:'D10',standPass:'pass'};
 const days=Array.from({length:5},(_,i)=>({...v,date:'2027-04-0'+(i+1),dateRowVerified:true,recordKind:'plan',productionAmount:i===4?400:0,size:'D10',shift1Team:i===4?'A':'',operatingHours:i===4?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anon'}));
 const demand=api.deriveFirstMonthlyExchange({referenceDate:asOf,throughDate,days,group}).demand;
 const slot={...v,id:'stop',date:'2027-04-03',startMinute:480,endMinute:1000,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,reserved:[],eligibility:[{...v,demandId:group.id,deadlineBasis:demand.deadlineBasis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true}]};
 const single={...v,stand:'2',demandId:group.id,roles,compatibility:{...v,oldIdentity:id(old),newIdentity:id(next),size:'D10',status:'compatible',replacementDiameter:420},diameter:{...v,stand:'2',rollId:old.rollId,generation:'g1',identity:id(old),status:'actual',measuredDate:asOf,currentMm:420,limitMm:400,limitApproved:true,limitBasis:'anon'},diameterHistory:[1,2,3].map(i=>({...v,stand:'2',rollId:'hist'+i,cycleId:'c'+i,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}))};
 const workDate='2027-04-06',workDay={...v,date:workDate,dateRowVerified:true,productionAmount:400,nightOperating:true,workshopWorking:true};
 const request={...v,stand:'2',oldIdentity:id(old),targetIdentity:id(target),receipt:{...v,identity:id(target),status:'actual',date:'2027-03-31',present:true,usable:true,unassembled:true},slot:{date:workDate,workArea:'workshop',status:'forecast',period:'day',basis:'anon',workshopWorking:true,workshopCalendarBasis:'anon',offlineIsolated:true,isolationBasis:'anon',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anon',startHour:8,endHour:16,workshopStartHour:8,workshopEndHour:17,requiredHours:6,reservedHours:6,people:3,availablePeople:3,owner:{rollId:target.rollId,standKey:'2'},prepared:'reworkInbound',preparedTarget:target.rollId,preparedOn:'2027-03-31'},day:workDay,sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anon',nightBasis:'anon',dispatchPlan:{...v,identity:id(old),status:'planned',date:'2027-04-11',cycleId:'new-cycle',priorCycleIds:[],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true}};
 const x={...v,anonymousOnly:true,asOf,throughDate,days,groups:[group],pairedInputs:[],singleInputs:[single],slots:[slot],workshopOptions:[{...v,demandId:group.id,stand:'2',request}],workshopDays:[workDay],workshopReserved:[],workshopReservationsVerified:true,workshopReservationBasis:'anon',actualEvents:[],startMonth:'2027-04',fiscalYear:2027};
 return x;
}
function selfTest(api){
 const x=fixture(api),[old,next,target]=x.singleInputs[0].roles,workDate=x.workshopDays[0].date;
 const before=JSON.stringify(x),r=previewPcSharedCirculation(x,api),missing=previewPcSharedCirculation({...x,workshopOptions:[]},api),blocked=previewPcSharedCirculation({...x,slots:[]},api);
 const own=r.first?.projectedRoles?.filter(y=>String(y.stand)==='2')||[],d=r.first?.dispositions?.find(y=>y.stand==='2'),e=r.annual?.detail?.find(y=>y.stand==='2'&&y.kind==='rework-inbound');
 const oldSpare=missing.first?.projectedRoles?.find(y=>y.rollId===old.rollId);
 return {tests:[
 ['Actual shared engine invoked',r.first?.status==='shared-workshop-preview'],
 ['Actual first exchange and workshop allocation',r.first?.allocations?.some(a=>a.stand==='2'&&a.date===workDate&&a.status==='conditional-assembly')],
 ['Three distinct physical roles after handover',own.length===3&&new Set(own.map(y=>y.rollId)).size===3&&own.some(y=>y.rollId===next.rollId&&y.status==='online')],
 ['Assembled successor spare and old disposition',own.some(y=>y.rollId===target.rollId&&y.status==='new-standby'&&y.chockAssembled)&&own.some(y=>y.rollId===old.rollId&&y.status==='rework-ready'&&!y.chockAssembled)],
 ['20 calendar days derived by real engine',d?.rework?.expectedInboundDate==='2027-05-01'&&d.rework.leadDays===20],
 ['Actual engine forecast reaches annual month',e?.date==='2027-05-01'&&e.status==='forecast'&&r.annual.rows.find(y=>y.stand==='2').months.find(y=>y.month==='2027-05').forecastRework===1],
 ['No handover retains old reserve and no rework',oldSpare?.status==='used-standby'&&oldSpare.chockAssembled&&oldSpare.emergencyEligible&&!missing.first.dispositions.some(y=>y.rework)],
 ['Missing slot preserves required exchange',blocked.held.some(h=>h.stand==='2'&&h.requiredExchange===true)],
 ['No downstream completion or annual authorization',!r.first.pathlineComplete&&!r.periodComplete&&!r.complete&&!r.writeAllowed&&!r.operationAuthorized],
 ['Input untouched',JSON.stringify(x)===before]
 ],result:r};
}
module.exports={selfTest,fixture};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [n,ok] of tests)console.log((ok?'PASS ':'FAIL ')+n);if(tests.some(x=>!x[1]))process.exitCode=1;}
