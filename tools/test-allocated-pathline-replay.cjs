'use strict';
const {selfTest:bridgeTest}=require('./test-usage-shared-bridge.cjs');
const {selfTest:linkedTest}=require('./test-linked-12-17-combinations.cjs');
function selfTest(preview,bridge,paired,linked,api){
 let x0,c0;bridgeTest((x,a)=>{if(!x0)x0=x;return bridge(x,a)},paired,api);linkedTest((x,a)=>{if(!c0)c0=x;return linked(x,a)},api);
 const x=JSON.parse(JSON.stringify(x0)),p=x.pairedInputs[0],v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous'},id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const transform=(row,i=0)=>{const m=p.members.find(m=>String(m.stand)===String(row.stand));return {...row,...v,...(m?{rollId:m.roles[i].rollId,generation:m.roles[i].generation}:{})};};
 const rows=c0.masterRows.map(q=>transform(q)),newRows=c0.masterRows.filter(q=>[12,13].includes(q.stand)).map(q=>transform(q,1));
 const usage=c0.usageRows.map(q=>({...transform(q),runs:q.stand===13&&q.number===1?6:0})),newUsage=c0.usageRows.filter(q=>[12,13].includes(q.stand)).map(q=>({...transform(q,1),runs:0}));
 const map=(q,i)=>{const conv=z=>{const a=JSON.parse(z),m=p.members.find(m=>String(m.stand)===a[0]);return JSON.stringify([a[0],m.roles[i].rollId,m.roles[i].generation,a[3]])};return {...q,...v,fromIdentity:conv(q.fromIdentity),toIdentities:q.toIdentities.map(conv)};};
 const c={...c0,...v,onlineRows:c0.onlineRows.map(q=>transform(q)),masterRows:[...rows,...newRows],usageRows:[...usage,...newUsage],link1213Evidence:[...c0.link1213Evidence.map(q=>map(q,0)),...c0.link1213Evidence.map(q=>map(q,1))]};
 const exchange={...v,demandId:'paired-12-13',date:'2027-04-03',startMinute:480,endMinute:900,selection:c.selection,oldIdentities:Object.fromEntries(p.members.map(m=>[m.stand,id(m.roles[0])])),newIdentities:Object.fromEntries(p.members.map(m=>[m.stand,id(m.roles[1])]))};
 c.exchangeSelections=[exchange];
 x.days=x.days.map(d=>({...d,grade:'SD295',shiftEvidenceVerified:true}));x.pathline=c;
 const before=JSON.stringify(x),r=preview(x,api),run=q=>preview({...x,pathline:{...c,...q}},api);
 const ev=r.pathlineEvents.find(e=>e.type==='allocated-pair-pathline-preview'),prod=r.pathlineEvents.find(e=>e.type==='downstream-production-preview');
 const change17=(delta)=>c.masterRows.map(m=>String(m.stand)==='17'?{...m,calibers:m.calibers.map(q=>({...q,centerMm:q.centerMm+delta}))}:m);
 const tests=[
 ['full selected path recalculated',r.pathlineComplete&&ev?.checks.length===6],
 ['new individual consumed',prod?.consumption.some(q=>q.rollId===p.members[1].roles[1].rollId&&q.before===0&&q.after===1)],
 ['old history preserved',r.endingUsage.find(q=>q.rollId===p.members[1].roles[0].rollId&&q.number===1)?.runs===6],
 ['D10 two columns eight grooves one shift',prod?.consumption.length===8&&prod.operatingRuns===1],
 ['40 mm inclusive both lanes',run({masterRows:change17(40)}).pathlineComplete],
 ['41 mm held',!run({masterRows:change17(41)}).pathlineComplete],
 ['old mapping not reused',!run({link1213Evidence:c.link1213Evidence.slice(0,2)}).pathlineComplete],
 ['missing new master held',!run({masterRows:rows}).pathlineComplete],
 ['wrong new identity held',!run({exchangeSelections:[{...exchange,newIdentities:{...exchange.newIdentities,12:'wrong'}}]}).pathlineComplete],
 ['wrong allocated day held',!run({exchangeSelections:[{...exchange,date:'2027-04-04'}]}).pathlineComplete],
 ['unrelated selection unchanged',!run({exchangeSelections:[{...exchange,selection:{...exchange.selection,14:[2]}}]}).pathlineComplete],
 ['opening usage mismatch held',!run({usageRows:c.usageRows.map(u=>u.rollId===p.members[1].roles[0].rollId&&u.number===1?{...u,runs:5}:u)}).pathlineComplete],
 ['unknown new straight not zero',!run({usageRows:c.usageRows.filter(u=>!(u.rollId===p.members[1].roles[1].rollId&&u.number===1))}).pathlineComplete],
 ['missing downstream demand slot held',!preview({...x,slots:[x.slots[1]]},api).pathlineComplete],
 ['short shift proposal held',!preview({...x,days:x.days.map(d=>d.productionAmount?{...d,operatingHours:3}:d)},api).pathlineComplete],
 ['no authorization',!r.complete&&!r.annualComplete&&!r.writeAllowed&&!r.operationAuthorized],
 ['inputs unchanged',JSON.stringify(x)===before]];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./allocated-pathline-replay.cjs').previewAllocatedPathline,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,require('./linked-12-17-combinations.cjs').previewLinked1217,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
