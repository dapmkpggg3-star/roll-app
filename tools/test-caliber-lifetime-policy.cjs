'use strict';
const {selfTest:prior}=require('./test-upstream-pair-replay.cjs');
const {normalReuseAllowed}=require('./caliber-lifetime-policy.cjs');
function selfTest(workshop,bridge,paired,api){
 let fixture;const regression=prior((x,a)=>{if(!fixture)fixture=x;return workshop(x,a)},bridge,paired,api);
 const x=JSON.parse(JSON.stringify(fixture)),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous whole groove history'};
 const group=(k)=>x.groups.find(g=>g.id===k),target=group('paired-6-7');
 for(const m of target.members){
  const l=m.caliberLedger;l.totalCalibers=4;l.calibers[1]={...l.calibers[1],tons:1000,runs:3};
  l.calibers.push({...v,id:'3',state:'unused',tons:0,runs:0},{...v,id:'4',state:'unavailable',tons:0,runs:0});
 }
 x.upperCaliberSelections=[{...v,demandId:target.id,date:'2027-04-02',startMinute:480,endMinute:840,size:'D10',pairFitConfirmed:true,fitBasis:'anonymous pair',members:target.members.map(m=>({...v,standKey:m.standKey,identity:m.caliberLedger.identity,oldId:'1',nextId:'3'}))}];
 const before=JSON.stringify(x),r=bridge(x,api),w=workshop(x,api);
 const calc=r.caliberLifetime.find(q=>q.id===target.id),u=r.upstreamPairReplays.find(q=>q.id===target.id),a=r.allocations.find(q=>q.id===target.id),l=calc?.ledgers[0];
 const runChange=fn=>{const q=JSON.parse(JSON.stringify(x));fn(q,q.groups.find(g=>g.id===target.id));return bridge(q,api);};
 const held=q=>q.unresolved.some(z=>z.id===target.id);
 const no=runChange((q,g)=>{g.members.forEach(m=>{delete m.caliberLedger;});});
 const wrong=runChange((q,g)=>{g.members[0].caliberLedger.identity='wrong';});
 const mismatch=runChange((q,g)=>{g.members[0].caliberLedger.totalCalibers=5;});
 const oneSide=runChange((q,g)=>{g.members[0].caliberLedger.calibers[2].state='used';});
 const used=runChange(q=>{q.upperCaliberSelections[0].members[0].nextId='2';});
 const badSelection=runChange(q=>{q.upperCaliberSelections[0].endMinute=900;});
 const falseNew=runChange((q,g)=>{g.members[0].caliberLedger.calibers[2].tons=1;});
 const noFit=runChange(q=>{q.upperCaliberSelections[0].pairFitConfirmed=false;});
 const early=runChange((q,g)=>{g.members[0].openingUsedTons=5999;});
 const allUsed=runChange((q,g)=>{g.members.forEach(m=>{m.caliberLedger.calibers[2].state='used';});});
 const eight=r.caliberLifetime.find(q=>q.id==='paired-8-9')?.ledgers[0],ten=r.caliberLifetime.find(q=>q.id==='paired-10-11')?.ledgers[0];
 const tests=[
 ['all #105 regression pass with complete ledgers',regression.tests.every(z=>z[1])],
 ['auto correct requested roll change into caliber change',calc?.requestedWorkType==='rollChange'&&calc.workType==='caliberChange'&&a?.workType==='caliberChange'&&a.minutes===360],
 ['6075 per groove times usable count not physical count',l?.nominalRollTons===18225&&l.usableCount===3&&l.totalCalibers===4],
 ['normal remaining excludes used and unavailable',l?.remainingNormalTons===6150&&l.usedResidualExcludedTons===5075&&l.remainingNormalRuns===16],
 ['5265 times two usable grooves per stand',eight?.nominalRollTons===10530&&eight.remainingNormalTons===75&&eight.nominalRollRuns===null],
 ['8 straight times two grooves no ton assumption',ten?.nominalRollRuns===16&&ten.nominalRollTons===null&&ten.recordedTotalTons===null],
 ['same roll identity and new unused selection',u?.status==='conditional-upstream-caliber-preview'&&u.changes.every(c=>c.oldId==='1'&&c.newId==='3'&&c.oldUsedTons===6000&&c.oldRuns===14)],
 ['last new groove becomes roll change next',u?.postChangeGroup.workType==='rollChange'&&u.postChangeLifetime.every(c=>c.unusedCount===0&&c.remainingNormalTons===6075)],
 ['new groove consumption is 400t and one straight',u?.endingUsage.every(c=>c.tons===400&&c.calibers[0].runs===1&&c.calibers[0].id==='3')],
 ['caliber switch creates no rework or workshop',u?.rollChanged===false&&u.reworkGenerated===false&&!w.dispositions.some(d=>['6','7'].includes(d.stand))&&w.allocations.length===4],
 ['setup instruction persists only 6/7',w.setupInstructions.length===1&&w.setupInstructions[0].date==='2027-03-31'],
 ['missing ledger holds',held(no)&&!no.allocations.some(a=>a.id===target.id)],
 ['wrong identity holds',held(wrong)],
 ['wrong physical count holds',held(mismatch)],
 ['one side only new holds pair',held(oneSide)],
 ['used groove never selected',held(used)&&used.upstreamPairReplays.find(z=>z.id===target.id)?.status==='held'],
 ['allocation interval mismatch holds',held(badSelection)],
 ['nonzero unused contradictory holds',held(falseNew)],
 ['no fit evidence holds',held(noFit)],
 ['opening usage mismatch holds',held(early)],
 ['when no unused grooves remain derive roll change',allUsed.caliberLifetime.find(z=>z.id===target.id)?.workType==='rollChange'&&allUsed.allocations.find(z=>z.id===target.id)?.minutes===420],
 ['policy only #12–17 normal reuse',Array.from({length:16},(_,i)=>i+2).every(k=>normalReuseAllowed(k)===(k>=12))],
 ['never claim actual or annual completion',!r.complete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed],
 ['input untouched',JSON.stringify(x)===before]
 ];
 return {tests,regression:regression.tests,result:r,workshop:w};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./shared-workshop-handover.cjs').previewSharedWorkshop,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
