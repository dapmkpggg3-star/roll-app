'use strict';
const {selfTest:previous}=require('./test-paired-assembly-disposition.cjs');
function selfTest(preview,paired,api){
 let fixture;previous((x,a)=>{if(!fixture)fixture=x;return paired(x,a)},api);
 const p=fixture,v={snapshotId:p.snapshotId,sourceRevision:p.sourceRevision,basis:'anonymous'},asOf=p.asOf,throughDate='2027-04-05';
 const days=Array.from({length:5},(_,i)=>({...v,date:'2027-04-0'+(i+1),dateRowVerified:true,recordKind:'plan',productionAmount:i===4?400:0,size:'D10',shift1Team:i===4?'A':'',operatingHours:i===4?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anon'}));
 const group=(id,stands,members)=>({...v,id,stands,members,workType:'rollChange',size:'D10',standPass:'pass'});
 const a=group('a',['2'],[{...v,standKey:'2',rollId:'a2',generation:'g1',usageBasis:'anon ton',openingUsedTons:13900}]);
 const b=group('paired-12-13',['12','13'],p.members.map(m=>({...v,standKey:String(m.stand),rollId:m.roles[0].rollId,generation:m.roles[0].generation,usageBasis:'anon runs',remainingBasis:'anon no next',nextCaliberAvailable:false,activeCalibers:[{id:'1',runs:m.stand===13?6:0}]})));
 const demand=g=>api.deriveFirstMonthlyExchange({referenceDate:asOf,throughDate,days,group:g}).demand;
 const e=g=>({...v,demandId:g.id,deadlineBasis:demand(g).deadlineBasis,compatibilityBasis:p.compatibility.basis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true});
 const slot=(date)=>({...v,id:date,date,startMinute:480,endMinute:1000,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,reserved:[],eligibility:[e(a),e(b)]});
 const x={...v,anonymousOnly:true,asOf,throughDate,days,groups:[a,b],pairedInputs:[p],slots:[slot('2027-04-03'),slot('2027-04-04')]},before=JSON.stringify(x),r=preview(x,api),run=q=>preview({...x,...q},api);
 const pp=r.replays.find(a=>a.id===b.id),aa=r.replays.find(a=>a.id==='a');
 const tests=[
 ['both actual derived demands',r.demands.length===2&&r.demands.every(d=>d.latestDate==='2027-04-05')],
 ['pair moves to earlier common date',pp?.allocation.date==='2027-04-03'&&aa?.allocation.date==='2027-04-04'],
 ['paired replay exact interval',pp?.status==='conditional-pair-replay'&&pp.allocation.startMinute===480&&pp.allocation.endMinute===900],
 ['purchase deadline recalculated',pp?.dispositions[0]?.procurement?.latestArrivalBy==='2027-04-03'&&pp.dispositions[0].procurement.latestOrderBy==='2026-10-03'],
 ['both spare counts preserved',pp?.emergencyReserveByStand?.['12']===1&&pp.emergencyReserveByStand['13']===1],
 ['upstream prefix recomputed',aa?.usageAtAllocatedDate?.[0]?.tons===13900],
 ['no final physical authorization',!r.complete&&!r.annualComplete&&!r.operationAuthorized&&!r.writeAllowed&&pp.requiresFullPathlineRecalculation],
 ['uncovered explicit',r.uncoveredStands.length===13],
 ['one slot retains pair demand',run({slots:[x.slots[1]]}).unresolved.some(u=>u.id===b.id&&u.requiredExchange===true)],
 ['wrong pair role generation held',run({groups:[a,{...b,members:b.members.map(m=>({...m,generation:'wrong'}))}]}).unresolved.some(u=>u.id===b.id)],
 ['missing pair state holds need',run({pairedInputs:[]}).unresolved.some(u=>u.id===b.id&&u.requiredExchange===true)],
 ['mismatch compatibility holds before allocation',(()=>{const q=run({pairedInputs:[{...p,compatibility:{...p.compatibility,lineFitConfirmed:false}}]});return q.unresolved.some(u=>u.id===b.id&&u.requiredExchange)&&!q.allocations.some(u=>u.id===b.id)})()],
 ['stale usage version held',run({groups:[{...a,members:[{...a.members[0],sourceRevision:'old'}]},b]}).unresolved.some(u=>u.id==='a')],
 ['duplicate stand held',run({groups:[a,{...a,id:'other'},b]}).unresolved.filter(u=>['a','other'].includes(u.id)).length===2],
 ['missing day no fabricated need',run({days:days.slice(1)}).demands.length===0],
 ['same-day production slot not used',run({days:days.map(d=>d.date==='2027-04-04'?{...d,productionAmount:100,shift1Team:'A',operatingHours:5}:d)}).allocations.every(a=>a.date!=='2027-04-04')],
 ['all allocations clearly pending physical replay',r.allocations.every(a=>a.status==='proposal-replay-pending')],
 ['no input mutation',JSON.stringify(x)===before]];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
