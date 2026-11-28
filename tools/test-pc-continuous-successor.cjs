'use strict';
// Start with the original 3 physical rolls per stand, then run one continuous
// #8/9 D10 campaign. All new/returned ledgers start at zero, never near-limit.
const {fixture:priorFixture}=require('./test-repeated-following-rotation.cjs');
const {previewRepeatedFollowing}=require('./repeated-following-rotation.cjs');
function fixture(api){
 const x=priorFixture(api),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:x.basis},g=x.groups[0],copy=q=>JSON.parse(JSON.stringify(q)),id=(k,r,gen)=>JSON.stringify([k,r,gen]);
 const name=(k,n)=>Number.isInteger(n)?'anon-'+k+'-'+n:k+n;
 const history=k=>copy(x.pairedInputs[0].members.find(m=>String(m.stand)===k).diameterHistory);
 const master=(k,n,gen,mm,oldGen,cycle,date)=>{
  const r=name(k,n),identity=id(k,r,gen),u=copy(x.followingStages[1].workshop.returnMasters.find(m=>m.standKey===k));
  const m={...u,...v,rollId:r,generation:gen,identity,diameterMm:mm,openingUsedTons:0,activeCalibers:[],nextCaliberAvailable:true,caliberLedger:{...u.caliberLedger,identity,complete:true,totalCalibers:2,calibers:[{...v,id:'1',state:'active',tons:0,runs:null},{...v,id:'2',state:'unused',tons:0,runs:null}]}};
  if(oldGen===null){delete m.oldIdentity;delete m.cycleId;delete m.expectedInboundDate;return {...m,status:'new-purchase-forecast'};}
  return {...m,status:'forecast',oldIdentity:id(k,r,oldGen),cycleId:cycle+k,expectedInboundDate:date};
 };
 const stops=['2027-10-26','2027-11-09','2027-11-23','2027-12-07','2027-12-21','2028-01-04','2028-01-18','2028-02-01','2028-02-15','2028-02-29','2028-03-14','2028-03-28'];
 x.throughDate=x.secondCycle.throughDate='2028-03-29';
 for(let d='2027-10-14';d<=x.throughDate;d=api.addDays(d,1)){
  const production=stops.includes(d)?0:400;
  x.days.push({...x.days[0],date:d,productionAmount:production,shift1Team:production?'A':'',operatingHours:production?5:0});
 }
 for(const date of stops)x.slots.push({...x.slots[0],id:date,date});
 const selection=(date,ms)=>x.upperCaliberSelections.push({...v,demandId:g.id,date,startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous fit',members:ms.map(m=>({...v,standKey:m.standKey,identity:m.identity,oldId:'1',nextId:'2'}))});
 const stages=[
  {exchange:'2027-10-12',old:2,oldGen:'g2',target:1,targetGen:'g3',targetOld:'g2',targetMm:406,receipt:'2027-10-12',cycle:'fifth-',online:0,onlineGen:'g3',work:['2027-10-13','2027-10-14'],dispatch:'2027-10-20',nextCycle:'sixth-',caliber:'2027-10-26'},
  {exchange:'2027-11-09',old:0,oldGen:'g3',target:2,targetGen:'g3',targetOld:'g2',targetMm:406,receipt:'2027-11-09',cycle:'sixth-',online:1,onlineGen:'g3',work:['2027-11-10','2027-11-11'],successor:'D',newReceipt:'2027-11-08',order:'2027-05-08',caliber:'2027-11-23'},
  {exchange:'2027-12-07',old:1,oldGen:'g3',target:'D',targetGen:'new',targetOld:null,targetMm:420,receipt:'2027-11-08',online:2,onlineGen:'g3',work:['2027-12-08','2027-12-09'],successor:'E',newReceipt:'2027-12-06',order:'2027-06-06',caliber:'2027-12-21'},
  {exchange:'2028-01-04',old:2,oldGen:'g3',target:'E',targetGen:'new',targetOld:null,targetMm:420,receipt:'2027-12-06',online:'D',onlineGen:'new',work:['2028-01-05','2028-01-06'],successor:'F',newReceipt:'2028-01-03',order:'2027-07-03',caliber:'2028-01-18'},
  {exchange:'2028-02-01',old:'D',oldGen:'new',target:'F',targetGen:'new',targetOld:null,targetMm:420,receipt:'2028-01-03',online:'E',onlineGen:'new',work:['2028-02-02','2028-02-03'],dispatch:'2028-02-10',nextCycle:'D-first-',caliber:'2028-02-15'},
  {exchange:'2028-02-29',old:'E',oldGen:'new',target:'D',targetGen:'r1',targetOld:'new',targetMm:413,receipt:'2028-03-01',cycle:'D-first-',online:'F',onlineGen:'new',work:['2028-03-02','2028-03-03'],dispatch:'2028-03-08',nextCycle:'E-first-',caliber:'2028-03-14'}
 ];
 const purchaseMasters=new Map(),purchaseDates=new Map();
 let currentMasters=x.followingStages[0].workshop.returnMasters;
 // After 10/12 the online A is the g3 master assembled in the preceding stage.
 currentMasters=x.followingStages[1].workshop.returnMasters;
 for(const q of stages){
  const workshop={...v,members:[],returnMasters:[],workshopOptions:[],dispatchPlans:[],purchaseDiameterInputs:[]},next={...v,members:[]},successors=[];
  for(const [i,k] of g.stands.entries()){
   const oldIdentity=id(k,name(k,q.old),q.oldGen),onlineIdentity=id(k,name(k,q.online),q.onlineGen);
   const m=q.targetOld===null?copy(purchaseMasters.get(k+q.target)):master(k,q.target,q.targetGen,q.targetMm,q.targetOld,q.cycle,q.receipt);
   if(!m)throw Error('missing successor master');
   workshop.members.push({...v,stand:k,onlineIdentity:oldIdentity});
   workshop.returnMasters.push(m);
   if(q.targetOld===null)workshop.purchaseDiameterInputs.push({...v,stand:k,identity:m.identity,limit:{...v,identity:m.identity,approved:true,mm:400},history:history(k)});
   const template=copy(x.thirdWorkshop.workshopOptions.find(o=>o.stand===k)),date=q.work[i],row={...v,date,dateRowVerified:true,productionAmount:x.days.find(d=>d.date===date).productionAmount,nightOperating:false,workshopWorking:true};
   const o={...template,...v,stand:k,oldIdentity,targetIdentity:m.identity,cycleId:m.cycleId,day:row,slot:{...template.slot,date,owner:{rollId:m.rollId,standKey:k},prepared:q.targetOld===null?'newSide':'reworkInbound',preparedTarget:m.rollId,preparedOn:q.receipt}};
   if(q.targetOld===null){delete o.cycleId;o.purchaseAdmissionDate=purchaseDates.get(k+q.target);}
   workshop.workshopOptions.push(o);x.workshopDays.push({...row});
   if(q.dispatch)workshop.dispatchPlans.push({...v,stand:k,identity:oldIdentity,status:'planned',date:q.dispatch,cycleId:q.nextCycle+k,priorCycleIds:[],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
   if(q.successor){
    const nm=master(k,q.successor,'new',420,null),identity=nm.identity;
    purchaseMasters.set(k+q.successor,nm);purchaseDates.set(k+q.successor,date);
    successors.push({...v,stand:k,oldIdentity,status:'planned',retireDate:date,admissionDate:date,master:nm,receipt:{...v,identity,status:'forecast',actualReceipt:false,usableForecast:true,date:q.newReceipt},order:{...v,identity,status:'planned',date:q.order}});
   }
   next.members.push({...v,stand:k,onlineIdentity,replacementIdentity:m.identity});
  }
  next.compatibility={...x.fourthCycle.compatibility,oldIdentities:Object.fromEntries(next.members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(next.members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(next.members.map(m=>[m.stand,q.targetMm]))};
  x.followingStages.push({...v,afterExchangeDate:q.exchange,workshop,next,successors});
  selection(q.caliber,currentMasters);currentMasters=workshop.returnMasters;
 }
 return x;
}
function selfTest(api){
 const x=fixture(api),before=JSON.stringify(x),r=previewRepeatedFollowing(x,api);
 const entry=date=>r.stages.find(e=>e.exchangeDate===date),ad=entry('2027-11-09')?.stage,first=entry('2028-01-04')?.next,grind=entry('2028-02-01')?.stage,back=entry('2028-02-29')?.next;
 const rotations=r.stages.map(e=>e.next).filter(n=>n?.rotationComplete),stages=r.stages.map(e=>e.stage);
 const issues=rotations.flatMap(n=>n.plannedIssues||[]),firstD=issues.filter(u=>u.rollId.endsWith('D'));
 const oldD=grind?.dispositions.filter(d=>JSON.parse(d.identity)[1].endsWith('D'))||[];
 const tests=[
 ['Original six and six further rotations in one invocation',r.stages.length===8&&rotations.length===8&&rotations.at(-1)?.sequence.events.find(e=>e.rollChanged)?.date==='2028-03-28'],
 ['A final use triggers successor, not rework',ad?.dispositions.every(d=>d.kind==='successor-needed'&&d.life.currentMm===406&&d.life.nextDiameter===399&&!d.rework)],
 ['D replaces retired A and stays unassembled until workshop',ad?.admissionComplete&&ad.roles.filter(q=>q.purchaseSuccessor).every(q=>q.rollId.endsWith('D')&&q.status==='new-unassembled'&&!q.chockAssembled&&!q.emergencyEligible)&&ad.retiredHistory.length===2],
 ['D first production January only',first?.rotationComplete&&firstD.length===2&&firstD.every(u=>u.firstUseDate==='2028-01-05'&&u.plannedIssueMonth==='2028-01'&&!u.actualIssue)],
 ['D actual usage accumulates to threshold without reset',grind?.dispositions.length===2&&first?.endingGroup.members.every(m=>m.openingUsedTons===0)&&entry('2028-01-04').next.sequence.events.find(e=>e.rollChanged).newGroup.members.every(m=>m.caliberLedger.calibers.every(c=>c.tons===0))&&entry('2028-01-04').next.cursor==='2028-01-05'],
 ['D first rework forecast 420 to 413 from purchase specification',oldD.length===2&&oldD.every(d=>d.life.forecastOnly&&!d.life.actualMeasurement&&d.life.currentMm===420&&d.rework?.forecastDiameterMm===413&&d.rework.expectedInboundDate==='2028-03-01')],
 ['D return becomes online r1 without another issue',back?.rotationComplete&&back.endingRoles.filter(q=>q.status==='online').every(q=>q.rollId.endsWith('D')&&q.generation==='r1'&&q.purchaseFirstUse?.firstUseDate==='2028-01-05')&&back.plannedIssues.length===0],
 ['All completed stages maintain three physical rolls and one reserve',stages.every(z=>z.roles.length===6&&['8','9'].every(k=>{const a=z.roles.filter(q=>String(q.stand)===k);return a.length===3&&new Set(a.map(q=>q.rollId)).size===3&&a.filter(q=>q.status!=='online'&&q.chockAssembled&&q.emergencyEligible).length===1;}))],
 ['No input mutation or actual authorization',JSON.stringify(x)===before&&!r.writeAllowed&&!r.operationAuthorized&&!r.annualComplete]
 ];
 return {tests,result:r,issues};
}
module.exports={fixture,selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [n,ok] of tests)console.log((ok?'PASS ':'FAIL ')+n);if(tests.some(x=>!x[1]))process.exitCode=1;}
