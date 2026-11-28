'use strict';
const {fixture}=require('./test-third-workshop-integration.cjs');
const {previewFourthUpperRotation}=require('./following-upper-rotation.cjs');
function fixture4(api){
 const x=fixture(api),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:x.basis},g=x.groups[0];
 x.throughDate='2027-08-18';x.secondCycle.throughDate=x.throughDate;
 for(let d='2027-07-08';d<=x.throughDate;d=api.addDays(d,1)){
  const production=[['2027-07-08','2027-07-19'],['2027-07-21','2027-08-02'],['2027-08-04','2027-08-16'],['2027-08-18','2027-08-18']].some(([a,b])=>d>=a&&d<=b)?400:0;
  x.days.push({...x.days[0],date:d,productionAmount:production,shift1Team:production?'A':'',operatingHours:production?5:0});
 }
 for(const date of ['2027-07-20','2027-08-03','2027-08-17'])x.slots.push({...x.slots[0],date,id:date});
 const members=x.secondCycle.returnMasters.map(m=>({...v,stand:m.standKey,onlineIdentity:m.identity,replacementIdentity:x.thirdWorkshop.returnMasters.find(t=>t.standKey===m.standKey).identity}));
 x.fourthCycle={...v,members,compatibility:{...x.thirdCycle.compatibility,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(members.map(m=>[m.stand,413]))}};
 for(const [date,oldId,nextId] of [['2027-07-20','1','2'],['2027-08-03','2','3']])x.upperCaliberSelections.push({...v,demandId:g.id,date,startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous fit',members:x.secondCycle.returnMasters.map(m=>({...v,standKey:m.standKey,identity:m.identity,oldId,nextId}))});
 return x;
}
function selfTest(api){
 const x=fixture4(api);
 const before=JSON.stringify(x),r=previewFourthUpperRotation(x,api),f=r.fourth,run=fn=>{const q=JSON.parse(before);fn(q);return previewFourthUpperRotation(q,api);};
 const short=run(q=>{q.throughDate=q.secondCycle.throughDate='2027-08-10';q.days=q.days.filter(d=>d.date<=q.throughDate);});
 return {result:r,short,tests:[
 ['fourth rotation after third workshop',f?.rotationComplete===true&&f.sequence.events.map(e=>e.date).join(',')==='2027-07-20,2027-08-03,2027-08-17'],
 ['forecast life not actual',f?.lives.length===2&&f.lives.every(v=>v.life.forecastOnly&&v.life.currentMm===413&&!v.life.actualMeasurement)],
 ['fourth online B g2',f?.endingRoles.filter(t=>t.status==='online').every(t=>t.generation==='g2'&&t.rollId.endsWith('-1'))&&f?.endingRoles.length===6],
 ['old A remains emergency spare',f?.endingRoles.filter(t=>t.status==='used-standby'&&t.emergencyEligible&&t.chockAssembled).length===2],
 ['all ten line reservations retained',f?.reservations.length===10&&new Set(f.reservations.map(t=>t.eventId)).size===10],
 ['period end stops without forced roll change',short.fourth?.periodComplete===true&&short.fourth.sequence.events.length===2&&!short.fourth.rotationComplete&&short.fourth.endingGroup.members.every(m=>m.openingUsedTons===2800)],
 ['missing fourth slot retains demand',run(q=>q.slots=q.slots.filter(t=>t.date!=='2027-08-17')).fourth?.held.some(h=>h.requiredExchange===true)],
 ['wrong fourth identity held',run(q=>q.fourthCycle.members[0].replacementIdentity='wrong').fourth?.held.length>0],
 ['missing prior workshop prevents fourth',!run(q=>q.thirdWorkshop.workshopOptions.pop()).fourth],
 ['input unchanged and no actual writes',JSON.stringify(x)===before&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed]
 ]};
}
module.exports={fixture4,selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
