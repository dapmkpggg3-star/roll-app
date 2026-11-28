'use strict';
const {fixture4}=require('./test-following-upper-rotation.cjs');
const {previewRepeatedFollowing}=require('./repeated-following-rotation.cjs');
function fixture(api){
 const x=fixture4(api),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:x.basis},g=x.groups[0],id=(k,r,gen)=>JSON.stringify([k,r,gen]);
 x.throughDate=x.secondCycle.throughDate='2027-10-13';
 for(let d='2027-08-19';d<=x.throughDate;d=api.addDays(d,1)){
  const production=[['2027-08-19','2027-08-30'],['2027-09-01','2027-09-13'],['2027-09-15','2027-09-27'],['2027-09-29','2027-10-11'],['2027-10-13','2027-10-13']].some(([a,b])=>d>=a&&d<=b)?400:0;
  x.days.push({...x.days[0],date:d,productionAmount:production,shift1Team:production?'A':'',operatingHours:production?5:0});
 }
 for(const date of ['2027-08-31','2027-09-14','2027-09-28','2027-10-12'])x.slots.push({...x.slots[0],date,id:date});
 const build=(exchange,oldNum,oldGen,returnNum,returnOldGen,returnGen,onlineNum,onlineGen,received,mm,cyclePrefix,dispatchDate,nextCyclePrefix,dates)=>{
  const workshop={...v,members:[],returnMasters:[],workshopOptions:[],dispatchPlans:[]},next={...v,members:[]};
  for(const [i,k] of g.stands.entries()){
   const old='anon-'+k+'-'+oldNum,target='anon-'+k+'-'+returnNum,online='anon-'+k+'-'+onlineNum,oldIdentity=id(k,old,oldGen),identity=id(k,target,returnGen),cycleId=cyclePrefix+k,date=dates[i],u=x.thirdWorkshop.returnMasters.find(m=>m.standKey===k),template=x.thirdWorkshop.workshopOptions.find(m=>m.stand===k);
   workshop.members.push({...v,stand:k,onlineIdentity:oldIdentity});
   workshop.returnMasters.push({...u,rollId:target,generation:returnGen,identity,oldIdentity:id(k,target,returnOldGen),cycleId,expectedInboundDate:received,diameterMm:mm,caliberLedger:{...u.caliberLedger,identity}});
   const row={...template.day,date};workshop.workshopOptions.push({...template,oldIdentity,targetIdentity:identity,cycleId,slot:{...template.slot,date,owner:{rollId:target,standKey:k},preparedTarget:target,preparedOn:received},day:row});x.workshopDays.push({...v,...row,workshopWorking:true});
   workshop.dispatchPlans.push({...v,stand:k,identity:oldIdentity,status:'planned',date:dispatchDate,cycleId:nextCyclePrefix+k,priorCycleIds:[],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true});
   next.members.push({...v,stand:k,onlineIdentity:id(k,online,onlineGen),replacementIdentity:identity});
  }
  next.compatibility={...x.fourthCycle.compatibility,oldIdentities:Object.fromEntries(next.members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(next.members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(next.members.map(m=>[m.stand,mm]))};
  return {...v,afterExchangeDate:exchange,workshop,next};
 };
 x.followingStages=[build('2027-08-17',0,'g2',2,'g1','g2',1,'g2','2027-08-04',413,'third-','2027-08-25','fourth-',['2027-08-18','2027-08-19']),build('2027-09-14',1,'g2',0,'g2','g3',2,'g2','2027-09-14',406,'fourth-','2027-09-22','fifth-',['2027-09-15','2027-09-16'])];
 for(const [date,ms] of [['2027-08-31',x.thirdWorkshop.returnMasters],['2027-09-28',x.followingStages[0].workshop.returnMasters]])x.upperCaliberSelections.push({...v,demandId:g.id,date,startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous fit',members:ms.map(m=>({...v,standKey:m.standKey,identity:m.identity,oldId:'1',nextId:'2'}))});
 return x;
}
function selfTest(api){
 const x=fixture(api),before=JSON.stringify(x),r=previewRepeatedFollowing(x,api),run=fn=>{const q=JSON.parse(before);fn(q);return previewRepeatedFollowing(q,api);};
 const short=run(q=>{q.throughDate=q.secondCycle.throughDate='2027-10-01';q.days=q.days.filter(d=>d.date<=q.throughDate);}),blocked=run(q=>q.followingStages[0].workshop.workshopOptions.pop());
 return {result:r,short,tests:[
 ['same loop runs fifth and sixth physical exchanges',r.stages.length===2&&r.stages.every(e=>e.next?.rotationComplete)&&r.stages.map(e=>e.next.sequence.events.find(x=>x.rollChanged).date).join(',')==='2027-09-14,2027-10-12'],
 ['A second rework to 406',r.stages[0]?.stage.dispositions.every(d=>d.rework?.forecastDiameterMm===406&&d.rework.expectedInboundDate==='2027-09-14'&&d.life.forecastOnly)],
 ['B second rework to 406',r.stages[1]?.stage.dispositions.every(d=>d.rework?.forecastDiameterMm===406&&d.rework.expectedInboundDate==='2027-10-12'&&d.life.forecastOnly)],
 ['three sets and one reserve per stand after sixth',r.endingRoles?.length===6&&['8','9'].every(k=>r.endingRoles.filter(z=>String(z.stand)===k&&z.status!=='online'&&z.emergencyEligible&&z.chockAssembled).length===1)],
 ['period end after fifth no forced sixth',short.periodComplete&&short.endingGroup?.members.every(m=>m.openingUsedTons===1200)&&short.stages[1]?.next?.periodComplete],
 ['all shared line reservations retained',r.reservations?.length===14&&new Set(r.reservations.map(z=>z.eventId)).size===14],
 ['missing handover retains old standby',blocked.stages[0]?.stage.roles.some(z=>String(z.stand)==='9'&&z.status==='used-standby'&&z.emergencyEligible)&&!blocked.stages[0]?.next],
 ['wrong exchange key stops iteration',run(q=>q.followingStages[0].afterExchangeDate='2027-08-16').stages.length===0],
 ['no unsupported full completion or writes',!r.periodComplete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed&&JSON.stringify(x)===before]
 ]};
}
module.exports={fixture,selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
