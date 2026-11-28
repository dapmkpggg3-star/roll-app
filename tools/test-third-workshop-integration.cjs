'use strict';
const {previewThirdWorkshop}=require('./return-handover-stage.cjs');
function fixture(api){
 const v={snapshotId:'s',sourceRevision:'r',basis:'anonymous'},asOf='2027-04-01',throughDate='2027-07-07',id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]),g={...v,id:'paired-8-9',stands:['8','9'],workType:'rollChange',size:'D10',standPass:'pass',members:[]};
 const p={...v,anonymousOnly:true,asOf,stand:8,size:'D10',members:[],replacementUsage:[],assemblies:[],compatibility:{...v,size:'D10',status:'compatible',lineFitConfirmed:true,oldIdentities:{},replacementIdentities:{},replacementDiameters:{}}};
 const x={...v,anonymousOnly:true,asOf,throughDate,groups:[g],pairedInputs:[p],slots:[],days:[],workshopOptions:[],workshopDays:[],workshopReserved:[],workshopReservationsVerified:true,workshopReservationBasis:'anon empty',workshopTargets:[],setupNightHistory:[],upperCaliberSelections:[]};
 const second={...v,throughDate,members:[],returnMasters:[],workshopOptions:[]},third={...v,members:[],dispatchPlans:[]},work={...v,members:[],dispatchPlans:[],returnMasters:[],workshopOptions:[]};
 const compat=(members,diameters)=>({...p.compatibility,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(members.map(m=>[m.stand,diameters]))});
 const ledger=(r,rows)=>({...v,standKey:String(r.stand),rollId:r.rollId,generation:r.generation,identity:id(r),size:'D10',usageBasis:'anonymous usage',remainingBasis:'anonymous remaining',nextCaliberAvailable:rows.some(c=>c.state==='unused'),openingUsedTons:rows.find(c=>c.state==='active').tons,activeCalibers:[],caliberLedger:{...v,identity:id(r),complete:true,totalCalibers:rows.length,calibers:rows.map((c,i)=>({...v,id:String(i+1),runs:null,...c}))}});
 const zero=n=>Array.from({length:n},(_,i)=>({state:i===0?'active':'unused',tons:0}));
 const hist=k=>[1,2,3].map(i=>({...v,stand:k,rollId:'history-'+k,cycleId:'past-'+i,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}));
 const diameter=r=>({...v,stand:r.stand,rollId:r.rollId,generation:r.generation,identity:id(r),status:'actual',measuredDate:asOf,currentMm:r.diameterMm,limitMm:400,limitApproved:true,limitBasis:'anon'});
 const slot=(k,r,date,received)=>({date,workArea:'workshop',status:'forecast',period:'day',basis:'anon',workshopWorking:true,workshopCalendarBasis:'anon',offlineIsolated:true,isolationBasis:'anon',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anon',startHour:8,endHour:16,workshopStartHour:8,workshopEndHour:17,requiredHours:6,reservedHours:6,people:3,availablePeople:3,owner:{rollId:r.rollId,standKey:k},prepared:'reworkInbound',preparedTarget:r.rollId,preparedOn:received});
 const row=date=>({date,dateRowVerified:true,productionAmount:400,nightOperating:true});
 const addDay=date=>{if(!x.workshopDays.some(r=>r.date===date))x.workshopDays.push({...v,...row(date),workshopWorking:true});};
 const dispatch=(r,date,cycle,prior)=>({...v,identity:id(r),stand:String(r.stand),status:'planned',date,cycleId:cycle,priorCycleIds:prior,dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
 const option=(k,old,target,cycle,date,received)=>({...v,stand:k,oldIdentity:id(old),targetIdentity:id(target),cycleId:cycle,receiptStatus:'forecast',slot:slot(k,target,date,received),day:row(date),sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anon',nightBasis:'anon'});
 const returnMaster=(old,next,cycle,received,n)=>({...ledger(next,zero(n)),status:'forecast',cycleId:cycle,oldIdentity:id(old),expectedInboundDate:received,diameterMm:next.diameterMm});
 for(const k of [8,9]){
  const roles=['online','new-standby','unassembled-return'].map((status,i)=>({...v,stand:k,rollId:'anon-'+k+'-'+i,generation:'g1',status,chockAssembled:i!==2,emergencyEligible:i!==2,diameterMm:420})),[a,b,c]=roles,a2={...a,generation:'g2',diameterMm:413},b2={...b,generation:'g2',diameterMm:413};
  g.members.push(ledger(a,[{state:'active',tons:5190},{state:'used',tons:5265},{state:'unused',tons:0},{state:'unused',tons:0}]));
  p.members.push({stand:k,roles,diameter:diameter(a),diameterHistory:hist(k),deadline:{...v,identity:id(a),required:true,date:'2027-04-05',minute:1000}});
  p.replacementUsage.push(ledger(b,zero(2)));p.compatibility.oldIdentities[k]=id(a);p.compatibility.replacementIdentities[k]=id(b);p.compatibility.replacementDiameters[k]=420;
  const date=k===8?'2027-05-06':'2027-05-07',req={...v,stand:k,oldIdentity:id(a),targetIdentity:id(c),receipt:{...v,identity:id(c),status:'actual',date:'2027-03-31',present:true,usable:true,unassembled:true},slot:slot(k,c,date,'2027-03-31'),day:row(date),sameDayCompletionPlanned:true,targetEmergencyEligible:true,safetyBlocked:false,completionBasis:'anon',nightBasis:'anon',dispatchPlan:dispatch(a,'2027-05-15','cycle-'+k,[])};
  p.assemblies.push(req);x.workshopOptions.push({...v,demandId:g.id,stand:String(k),request:req});addDay(date);
  second.members.push({...v,stand:String(k),onlineIdentity:id(b),replacementIdentity:id(c),diameter:diameter(b),diameterHistory:hist(k),replacementUsage:ledger(c,zero(2))});
  second.returnMasters.push(returnMaster(a,a2,'cycle-'+k,'2027-06-04',3));const d2=k===8?'2027-06-07':'2027-06-08';second.workshopOptions.push(option(String(k),b,a2,'cycle-'+k,d2,'2027-06-04'));addDay(d2);
  third.members.push({...v,stand:String(k),onlineIdentity:id(c),replacementIdentity:id(a2),diameter:diameter(c),diameterHistory:hist(k)});third.dispatchPlans.push(dispatch(b,'2027-06-15','second-'+k,['cycle-'+k]));
  work.returnMasters.push(returnMaster(b,b2,'second-'+k,'2027-07-05',2));const d3=k===8?'2027-07-06':'2027-07-07';work.workshopOptions.push(option(String(k),c,b2,'second-'+k,d3,'2027-07-05'));addDay(d3);
  work.members.push({...v,stand:String(k),diameter:diameter(c),diameterHistory:hist(k)});work.dispatchPlans.push(dispatch(c,'2027-07-15','third-'+k,['cycle-'+k,'second-'+k]));
 }
 second.compatibility=compat(second.members,420);third.compatibility=compat(third.members,413);x.secondCycle=second;x.thirdCycle=third;x.thirdWorkshop=work;
 for(let d=asOf;d<=throughDate;d=api.addDays(d,1)){
  const prod=[['2027-04-05','2027-04-17'],['2027-04-19','2027-05-01'],['2027-05-03','2027-05-03'],['2027-05-08','2027-05-19'],['2027-05-21','2027-06-02'],['2027-06-06','2027-06-06'],['2027-06-09','2027-06-20'],['2027-06-22','2027-07-04'],['2027-07-06','2027-07-06']].some(([a,b])=>d>=a&&d<=b)?400:0;
  x.days.push({...v,date:d,dateRowVerified:true,recordKind:'plan',productionAmount:prod,nightProductionAmount:0,size:'D10',grade:'SD295',shift1Team:prod?'A':'',operatingHours:prod?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anon'});
 }
 for(const date of ['2027-04-03','2027-04-18','2027-05-02','2027-05-20','2027-06-05','2027-06-21','2027-07-05'])x.slots.push({...v,id:date,date,startMinute:480,endMinute:1000,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,reserved:[],eligibility:[{...v,demandId:g.id,deadlineBasis:g.basis+'／当日の予定使用量で計画基準超過見込み・操業前に交換',compatibilityBasis:v.basis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true}]});
 for(const [date,oldId,nextId,ms] of [['2027-04-03','1','3',g.members],['2027-04-18','3','4',g.members],['2027-05-20','1','2',p.replacementUsage],['2027-06-21','1','2',second.members.map(m=>m.replacementUsage)]])x.upperCaliberSelections.push({...v,demandId:g.id,date,startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous fit',members:ms.map(m=>({...v,standKey:m.standKey,identity:m.identity,oldId,nextId}))});
 return x;
}
function selfTest(api){
 const x=fixture(api),before=JSON.stringify(x),r=previewThirdWorkshop(x,api),s=r.stage;
 const run=fn=>{const q=JSON.parse(before);fn(q);return previewThirdWorkshop(q,api);};
 return {result:r,tests:[
 ['three physical exchanges from original roster',r.third.thirdRotationComplete===true&&[r.third.second.first.sequence,r.third.second.second,r.third.third].flatMap(t=>t.events.filter(e=>e.rollChanged).map(e=>e.date)).join(',')==='2027-05-02,2027-06-05,2027-07-05'],
 ['third workshop stage complete',s?.readyForNextRotation===true&&s.handovers.map(h=>h.date).join(',')==='2027-07-06,2027-07-07'],
 ['one conditional emergency reserve per stand',s?.roles.length===6&&['8','9'].every(k=>s.roles.filter(t=>String(t.stand)===k&&t.status!=='online'&&t.emergencyEligible&&t.chockAssembled).length===1)],
 ['third disposition cost month',s?.dispositions.length===2&&s.dispositions.every(d=>d.rework?.expectedInboundDate==='2027-08-04'&&d.rework.plannedReworkCostMonth==='2027-08')],
 ['missing third workshop retains old reserve',run(q=>q.thirdWorkshop.workshopOptions.pop()).stage?.roles.some(t=>String(t.stand)==='9'&&t.status==='used-standby'&&t.emergencyEligible)],
 ['no actual receipt or assembly',s&&!s.actualReceipt&&!s.actualAssembly&&!r.operationAuthorized&&!r.annualComplete],
 ['input unchanged',JSON.stringify(x)===before]
 ]};
}
module.exports={fixture,selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
