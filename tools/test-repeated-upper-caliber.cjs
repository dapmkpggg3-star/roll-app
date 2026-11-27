'use strict';
const {selfTest:prior}=require('./test-upstream-pair-replay.cjs');
function selfTest(sequence,workshop,bridge,paired,api){
 let fixture;const regression=prior((x,a)=>{if(!fixture)fixture=x;return workshop(x,a)},bridge,paired,api);
 const x=JSON.parse(JSON.stringify(fixture)),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous repeated use'};
 x.groups=x.groups.filter(g=>g.id==='paired-8-9');x.pairedInputs=x.pairedInputs.filter(p=>p.stand===8);
 const g=x.groups[0],p=x.pairedInputs[0],template=x.slots.find(s=>s.date==='2027-04-03');
 for(const m of g.members){m.caliberLedger.totalCalibers=4;m.caliberLedger.calibers.push({...v,id:'3',state:'unused',tons:0,runs:null},{...v,id:'4',state:'unused',tons:0,runs:null});}
 x.throughDate='2027-05-03';x.days=[];
 for(let d=x.asOf;d<=x.throughDate;d=api.addDays(d,1)){
  const production=(d>='2027-04-05'&&d<='2027-04-17'||d>='2027-04-19'&&d<='2027-05-01'||d==='2027-05-03')?400:0;
  x.days.push({...v,date:d,dateRowVerified:true,recordKind:'plan',productionAmount:production,nightProductionAmount:0,size:'D10',grade:'SD295',shift1Team:production?'A':'',operatingHours:production?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anonymous'});
 }
 x.slots=['2027-04-03','2027-04-18','2027-05-02'].map(d=>({...template,date:d,id:d,reserved:[],eligibility:template.eligibility.map(e=>({...e,deadlineBasis:g.basis+'／当日の予定使用量で計画基準超過見込み・操業前に交換'}))}));
 x.upperCaliberSelections=[['2027-04-03','1','3'],['2027-04-18','3','4']].map(([date,oldId,nextId])=>({...v,demandId:g.id,date,startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous fit',members:g.members.map(m=>({...v,standKey:m.standKey,identity:m.caliberLedger.identity,oldId,nextId}))}));
 const before=JSON.stringify(x),r=sequence(x,api),run=fn=>{const q=JSON.parse(JSON.stringify(x));fn(q);return sequence(q,api);};
 const e=r.events,finish=r.ending[0],old=e[2]?.oldGroup.members[0].caliberLedger.calibers,newLedger=finish?.group.members[0].caliberLedger;
 const no=run(q=>q.upperCaliberSelections.pop()),busy=run(q=>q.days.find(d=>d.date==='2027-04-18').reservedExchangeCount=1),bad=run(q=>q.upperCaliberSelections[1].members[0].nextId='1'),noRoll=run(q=>q.pairedInputs=[]),short=run(q=>{q.throughDate='2027-04-12';q.days=q.days.filter(d=>d.date<=q.throughDate);});
 const tests=[
 ['prior upstream regression',regression.tests.every(t=>t[1])],
 ['two caliber changes followed by roll replacement',e.length===3&&e.map(a=>a.workType).join(',')==='caliberChange,caliberChange,rollChange'&&r.sequenceComplete],
 ['exact dates and effort',e.map(a=>a.date).join(',')==='2027-04-03,2027-04-18,2027-05-02'&&e.map(a=>a.minutes).join(',')==='360,360,420'],
 ['same physical roll during caliber switches',e.slice(0,2).every(a=>a.oldGroup.members.every((m,i)=>m.rollId===a.newGroup.members[i].rollId))],
 ['all old groove tonnage retained',old?.map(c=>c.tons).join(',')==='5190,5265,5200,5200'],
 ['no reused groove or duplicated event identity',e[1]?.changes.every(c=>c.oldId==='3'&&c.newId==='4')&&new Set(e.map(a=>a.eventId)).size===3],
 ['first roll replacement new identity and zero use',finish?.status==='first-roll-change'&&newLedger?.calibers.find(c=>c.state==='active')?.tons===0&&finish.group.members[0].rollId!==g.members[0].rollId],
 ['only roll replacement generates handover candidate',r.rollHandoverCandidates.length===1&&r.rollHandoverCandidates[0].projectedRoles.length===6&&r.rollHandoverCandidates[0].emergencyReserveByStand['8']===1&&!r.rollHandoverCandidates[0].workshopVerified],
 ['reservations reflect all intervals',r.reservations.length===3&&r.reservations.every(a=>e.some(b=>a.eventId===b.eventId&&a.endMinute===b.endMinute))],
 ['missing later selection preserves prior verified event',no.events.length===1&&no.unresolved[0]?.requiredExchange===true],
 ['full day count blocks second exchange',busy.events.length===1&&busy.unresolved.length===1],
 ['cannot go back to used groove',bad.events.length===1&&bad.unresolved.length===1],
 ['missing spare proof blocks roll only',noRoll.events.length===2&&noRoll.unresolved[0]?.requiredExchange===true&&!noRoll.rollHandoverCandidates.length],
 ['period end usage written back into ledger',short.events.length===1&&short.ending[0]?.status==='period-end'&&short.ending[0].group.members[0].caliberLedger.calibers.find(c=>c.state==='active')?.tons===3200],
 ['source untouched',JSON.stringify(x)===before],
 ['never full annual or operation authorization',!r.complete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed]
 ];
 return {tests,regression:regression.tests,result:r,short};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./repeated-upper-caliber.cjs').previewUpperSequence,require('./shared-workshop-handover.cjs').previewSharedWorkshop,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
