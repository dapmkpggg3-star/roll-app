'use strict';
// Execute saved common line/workshop engine using existing anonymous upstream fixture.
const {selfTest:prior}=require('./test-upstream-pair-replay.cjs');
const {previewSharedWorkshop}=require('./shared-workshop-handover.cjs');
const {previewUsageSharedBridge}=require('./usage-shared-bridge.cjs');
const {previewPairedAssemblyDisposition}=require('./paired-assembly-disposition.cjs');
const {previewPcSharedCirculation}=require('./pc-shared-circulation.cjs');
function selfTest(api){
 let fixture;
 const original=prior((x,a)=>{if(!fixture)fixture=JSON.parse(JSON.stringify(x));return previewSharedWorkshop(x,a)},previewUsageSharedBridge,previewPairedAssemblyDisposition,api);
 const x={...fixture,actualEvents:[],startMonth:'2027-04',fiscalYear:2027};
 const before=JSON.stringify(x),run=v=>previewPcSharedCirculation(v,api),r=run(x),noSetup=run({...x,setupNightHistory:[]});
 const clash=JSON.parse(JSON.stringify(x));clash.workshopOptions.forEach(w=>{w.request.slot.date=x.workshopDays[0].date;w.request.day=x.workshopDays[0];});
 const c=run(clash);
 const month=(out,k)=>out.annual?.rows.find(a=>a.stand===String(k))?.months.find(m=>m.month==='2027-05')?.forecastRework;
 const lifetime=(k)=>r.first?.caliberLifetime.find(l=>l.ledgers?.some(z=>z.stand===String(k)))?.ledgers.find(z=>z.stand===String(k));
 const tests=[
 ['Existing upstream paired regression',original.tests.every(t=>t[1])],
 ['Real shared engine and all six dispositions',r.first?.status==='shared-workshop-preview'&&r.first.dispositions.filter(d=>d.rework).length===6],
 ['6/7 nominal roll tons are per groove times two', [6,7].every(k=>lifetime(k)?.nominalRollTons===12150&&lifetime(k)?.remainingNormalTons===75)],
 ['8/9 nominal roll tons are per groove times two, no run inference',[8,9].every(k=>lifetime(k)?.nominalRollTons===10530&&lifetime(k)?.remainingNormalTons===75&&lifetime(k)?.limit.runs===null)],
 ['10/11 nominal 16 runs, exhausted normal grooves',[10,11].every(k=>lifetime(k)?.nominalRollRuns===16&&lifetime(k)?.remainingNormalRuns===0)],
 ['Correct May ledger for each physical stand',[6,7,8,9,10,11].every(k=>month(r,k)===1)],
 ['Separate 20 and 30 calendar day returns',r.first.dispositions.every(d=>d.rework?.expectedInboundDate===(Number(d.stand)<=9?'2027-05-05':'2027-05-15'))],
 ['Only 6/7 setup material instruction',r.first.setupInstructions.length===1&&r.first.setupInstructions[0].date==='2027-03-31'],
 ['Missing setup retains pair demand, no May entry', [6,7].every(k=>noSetup.held.some(h=>h.stand===String(k)&&h.requiredExchange===true)&&month(noSetup,k)===null)&&[8,9,10,11].every(k=>month(noSetup,k)===1)],
 ['Shared workshop clash retains five old assembled spares',c.first?.allocations.length===1&&c.first.held.filter(h=>h.oldReserveRetained===true).length===5&&c.first.dispositions.filter(d=>d.rework).length===1],
 ['No full-period completion or authority',!r.complete&&!r.periodComplete&&!r.writeAllowed&&!r.operationAuthorized&&r.coverage.every(y=>!y.fullHorizonVerified)],
 ['Input unchanged',JSON.stringify(x)===before]
 ];
 return {tests,result:r,prior:original.tests};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [n,ok] of tests)console.log((ok?'PASS ':'FAIL ')+n);if(tests.some(x=>!x[1]))process.exitCode=1;}
