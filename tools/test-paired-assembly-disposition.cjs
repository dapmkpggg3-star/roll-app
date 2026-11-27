'use strict';
function selfTest(preview,api){
 const snap={snapshotId:'s',sourceRevision:'r',basis:'anonymous'},asOf='2027-04-01',id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const member=(stand,mm)=>{const roles=['online','new-standby','unassembled-return'].map((status,i)=>({...snap,stand,rollId:'anon-'+stand+'-'+i,generation:'g1',status,chockAssembled:i!==2,emergencyEligible:i!==2,diameterMm:i===0?mm:420}));const old=roles[0];return {stand,roles,diameter:{...snap,stand,rollId:old.rollId,generation:old.generation,identity:id(old),status:'actual',measuredDate:asOf,currentMm:mm,limitMm:400,limitApproved:true,limitBasis:'anon'},diameterHistory:[1,2,3].map(i=>({...snap,stand,rollId:'hist'+stand,cycleId:'c'+i,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'})),deadline:{...snap,identity:id(old),required:true,date:'2027-04-05',minute:1000}};};
 const members=[member(12,405),member(13,420)];
 const assemble=(m,date)=>{const target=m.roles[2],k=m.stand;return {...snap,stand:k,oldIdentity:id(m.roles[0]),targetIdentity:id(target),receipt:{...snap,identity:id(target),status:'actual',date:'2027-03-31',present:true,usable:true,unassembled:true},slot:{date,workArea:'workshop',status:'forecast',period:'day',basis:'anon',workshopWorking:true,workshopCalendarBasis:'anon',offlineIsolated:true,isolationBasis:'anon',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anon',startHour:8,endHour:16,workshopStartHour:8,workshopEndHour:17,requiredHours:6,reservedHours:6,people:3,availablePeople:3,owner:{rollId:target.rollId,standKey:k},prepared:'reworkInbound',preparedTarget:target.rollId,preparedOn:'2027-03-31'},day:{date,dateRowVerified:true,productionAmount:400,nightOperating:true},sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anon',nightBasis:'anon',dispatchPlan:{...snap,identity:id(m.roles[0]),status:'planned',date:'2027-04-09',cycleId:'new-cycle',priorCycleIds:[],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true}};};
 const x={...snap,anonymousOnly:true,asOf,stand:12,size:'D10',members,compatibility:{...snap,size:'D10',status:'compatible',lineFitConfirmed:true,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,id(m.roles[0])])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,id(m.roles[1])])),replacementDiameters:Object.fromEntries(members.map(m=>[m.stand,m.roles[1].diameterMm]))},slots:[{id:'stop',date:'2027-04-05',startMinute:480,endMinute:1000,team:'Ⅰ勤A',lineStopped:true,basis:'anon',eligibility:[{...snap,demandId:'paired-12-13',compatibilityBasis:'anonymous',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false}]}],exchangeCapacityByDate:{'2027-04-05':1},assemblies:[assemble(members[0],'2027-04-06'),assemble(members[1],'2027-04-07')]};
 const before=JSON.stringify(x),r=preview(x,api),run=(i,p)=>preview({...x,assemblies:x.assemblies.map((a,j)=>i===j?{...a,...p}:a)},api);
 const a=x.assemblies[0],b=x.assemblies[1],h=r.handovers,d=r.dispositions;
 const tests=[
 ['joint exchange retained',r.status==='conditional-pair-exchange'&&r.allocation.minutes===420],
 ['both workshop handovers',r.bothHandoversPlanned===true&&h.every(x=>!x.oldReserveRetained)],
 ['six roles remain',r.projectedRoles?.length===6&&r.projectedRoles.filter(x=>x.status==='online').length===2],
 ['one final candidate only',r.projectedRoles?.filter(x=>x.status==='retirement-review').length===1&&d[0]?.kind==='successor-needed'],
 ['one rework candidate only',d[1]?.rework?.expectedInboundDate==='2027-05-09'&&d[1].rework.plannedReworkCostMonth==='2027-05'&&!d[0].rework],
 ['purchase guidance separate',d[0]?.procurement?.latestOrderBy==='2026-10-05'&&d[0].procurement.idealArrivalBy===null],
 ['one spare per stand',r.projectedRoles?.filter(x=>x.status==='new-standby'&&x.emergencyEligible).length===2],
 ['no actual status or issue',!r.operationAuthorized&&!r.actualRetired&&!r.actualAdmission&&!r.writeAllowed&&d.every(x=>x.issueMonth===null)],
 ['missing receipt retains old reserve',run(0,{receipt:null}).handovers[0]?.oldReserveRetained===true&&run(0,{receipt:null}).handovers[1]?.status==='conditional-assembly'],
 ['stale receipt held',run(1,{receipt:{...b.receipt,sourceRevision:'old'}}).handovers[1]?.status==='held'],
 ['same-day overlapping work held',run(1,{slot:{...b.slot,date:a.slot.date},day:{...b.day,date:a.slot.date}}).handovers.every(x=>x.status==='held')],
 ['before exchange held',run(0,{slot:{...a.slot,date:'2027-04-02'},day:{...a.day,date:'2027-04-02'}}).handovers[0]?.status==='held'],
 ['same day before exchange end held',run(0,{slot:{...a.slot,date:'2027-04-05'},day:{...a.day,date:'2027-04-05'}}).handovers[0]?.status==='held'],
 ['no completion evidence held',run(1,{sameDayCompletionPlanned:false}).handovers[1]?.status==='held'],
 ['invalid dispatch not costed',!run(1,{dispatchPlan:{...b.dispatchPlan,priorCycleIds:['new-cycle']}}).dispositions[1]?.rework],
 ['future receipt held',run(1,{receipt:{...b.receipt,date:'2027-04-02'}}).handovers[1]?.status==='held'],
 ['wrong identity held',run(1,{oldIdentity:'other'}).handovers[1]?.status==='held'],
 ['no input mutation',JSON.stringify(x)===before]];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
