'use strict';
const {selfTest:prior}=require('./test-shared-single-exchange.cjs');
function selfTest(workshop,pathline,bridge,paired,linked,api){
 let fixture;prior((x,a)=>{if(!fixture)fixture=x;return workshop(x,a)},workshop,pathline,bridge,paired,linked,api);
 const x=JSON.parse(JSON.stringify(fixture)),c=x.pathline,v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous uninterrupted stop'};
 const pair=x.pairedInputs[0],old13=pair.members.find(m=>String(m.stand)==='13').roles[0],old17=x.singleInputs.find(m=>String(m.stand)==='17').roles[0];
 x.groups=x.groups.map(g=>g.id==='paired-12-13'?{...g,members:g.members.map(m=>String(m.standKey)==='13'?{...m,activeCalibers:m.activeCalibers.map(z=>({...z,runs:6}))}:m)}:g);
 c.usageRows=c.usageRows.map(u=>u.rollId===old13.rollId&&u.number===1?{...u,runs:6}:u);
 c.stopBatches=[{...v,id:'stop-1',demandIds:['z17','paired-12-13'],fromDate:'2027-04-02',toDate:'2027-04-03',noProductionConfirmed:true}];
 const before=JSON.stringify(x),r=pathline(x,api),w=workshop(x,api),run=q=>pathline({...x,pathline:{...c,...q}},api);
 const events=r.pathlineEvents.filter(e=>e.pathlineVerifiedAfterBatch),prod=r.pathlineEvents.filter(e=>e.type==='downstream-production-preview');
 const bad=run({masterRows:c.masterRows.map(m=>m.rollId===x.singleInputs.find(q=>String(q.stand)==='17').roles[1].rollId?{...m,calibers:m.calibers.map(z=>({...z,centerMm:z.centerMm+41}))}:m)});
 const no=run({stopBatches:[]}),stale=run({stopBatches:[{...c.stopBatches[0],sourceRevision:'old'}]});
 const tests=[
 ['both exhausted stands replaced across continuous stop',r.pathlineComplete&&events.length===2],
 ['individual event dates preserved',events[0]?.date==='2027-04-02'&&events[1]?.date==='2027-04-03'],
 ['only final path verified for both',events.every(e=>e.intermediatePathlineVerified===false&&e.pathlineVerifiedOnDate==='2027-04-03'&&e.checks.length===6)],
 ['no consumption during shutdown',prod.length===2&&prod.every(e=>e.date>='2027-04-05')],
 ['old 13 and 17 usage untouched',r.endingUsage.find(u=>u.rollId===old13.rollId&&u.number===1)?.runs===6&&r.endingUsage.find(u=>u.rollId===old17.rollId&&u.number===5)?.runs===6],
 ['four workshop sides after verified batch',w.allocations.length===4&&w.held.length===0],
 ['without continuity evidence held',!no.pathlineComplete&&no.pathlineEvents.length===0],
 ['stale continuity held',!stale.pathlineComplete],
 ['wrong order held',!run({stopBatches:[{...c.stopBatches[0],demandIds:['paired-12-13','z17']}]}).pathlineComplete],
 ['wrong window held',!run({stopBatches:[{...c.stopBatches[0],toDate:'2027-04-04'}]}).pathlineComplete],
 ['duplicate batch held',!run({stopBatches:[c.stopBatches[0],{...c.stopBatches[0],id:'duplicate'}]}).pathlineComplete],
 ['no explicit stop held',!run({stopBatches:[{...c.stopBatches[0],noProductionConfirmed:false}]}).pathlineComplete],
 ['contradictory team tonnage held',!pathline({...x,days:x.days.map(d=>d.date==='2027-04-02'?{...d,productionByTeam:{A:1,B:0}}:d)},api).pathlineComplete],
 ['bad final geometry rolls back whole batch',!bad.pathlineComplete&&bad.pathlineEvents.length===0&&bad.endingOnline.some(o=>o.rollId===old17.rollId)],
 ['bad final geometry has no batch workshop disposition',!workshop({...x,pathline:{...c,masterRows:c.masterRows.filter(m=>m.rollId!==pair.members[1].roles[1].rollId)}},api).dispositions.some(d=>['12','13','17'].includes(d.stand))],
 ['missing second allocation held',!pathline({...x,slots:x.slots.filter(s=>s.date!=='2027-04-03')},api).pathlineComplete],
 ['not a production permission',!r.operationAuthorized&&!r.writeAllowed&&!r.annualComplete],
 ['input unchanged',JSON.stringify(x)===before]
 ];
 return {tests,result:r,workshop:w};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./shared-workshop-handover.cjs').previewSharedWorkshop,require('./allocated-pathline-replay.cjs').previewAllocatedPathline,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,require('./linked-12-17-combinations.cjs').previewLinked1217,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
