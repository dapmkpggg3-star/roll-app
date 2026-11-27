'use strict';
const {selfTest:prior}=require('./test-allocated-pathline-replay.cjs');
function selfTest(preview,pathline,bridge,paired,linked,api){
 let fixture;prior((x,a)=>{if(!fixture)fixture=x;return pathline(x,a)},bridge,paired,linked,api);
 const x=JSON.parse(JSON.stringify(fixture)),p=x.pairedInputs[0],v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous'},did='paired-12-13';
 const option=(a,date)=>({...v,demandId:did,stand:String(a.stand),request:{...a,slot:{...a.slot,date},day:{...a.day,date}}});
 const a=option(p.assemblies[0],'2027-04-06'),b=option(p.assemblies[1],'2027-04-06'),alt=option(p.assemblies[1],'2027-04-07');
 x.workshopOptions=[a,b,alt];x.workshopDays=[a,alt].map(o=>({...v,...o.request.day,workshopWorking:true}));x.workshopReserved=[];x.workshopReservationsVerified=true;x.workshopReservationBasis='anonymous confirmed empty';x.workshopTargets=[{...v,demandId:did,stand:'13',targetDate:'2027-04-06'}];
 const before=JSON.stringify(x),r=preview(x,api),run=q=>preview({...x,...q},api),forStand=(o,k)=>o.allocations.find(a=>a.stand===k),roles=(o,k)=>o.projectedRoles.filter(r=>String(r.stand)===k),held=(o,k)=>o.held.find(h=>h.stand===k);
 const noAlt=run({workshopOptions:[a,b]}),manual=run({workshopReserved:[{...v,id:'other-stand',date:'2027-04-06',startHour:8,endHour:16}]});
 const missing=run({workshopReservationsVerified:false}),bad=run({pathline:{...x.pathline,link1213Evidence:[]}});
 const tests=[
 ['same shared slot not double booked',r.allocations.length===2&&forStand(r,'13')?.date==='2027-04-06'&&!forStand(r,'12')],
 ['explicit priority target and held old spare',held(r,'12')?.oldReserveRetained===true&&roles(r,'12').some(z=>z.status==='used-standby'&&z.chockAssembled&&z.emergencyEligible)],
 ['alternative slot with both allocated',(()=>{const t=run({workshopTargets:[]});return t.workshopComplete&&forStand(t,'12')?.date==='2027-04-06'&&forStand(t,'13')?.date==='2027-04-07'})()],
 ['no alternate retains spare',held(noAlt,'12')?.emergencyReserveCount===1],
 ['manual reservation for other stand blocks',forStand(manual,'13')?.date==='2027-04-07'&&held(manual,'12')?.oldReserveRetained],
 ['late target warning',manual.warnings.some(z=>z.stand==='13'&&z.kind==='組替目標日超過')],
 ['unknown reservation ledger retains both',missing.allocations.length===0&&missing.held.filter(z=>z.oldReserveRetained===true).length===2],
 ['production and workshop independent',forStand(r,'13')?.status==='conditional-assembly'&&b.request.day.productionAmount===400],
 ['one assembled emergency spare per stand', ['12','13'].every(k=>roles(r,k).length===3&&roles(r,k).filter(z=>z.status!=='online'&&z.chockAssembled&&z.emergencyEligible).length===1)],
 ['rework cost only valid handover',r.dispositions.find(z=>z.stand==='13')?.rework?.plannedReworkCostMonth==='2027-05'],
 ['invalid pathline removes downstream dispositions',bad.allocations.length===0&&bad.dispositions.length===0&&bad.projectedRoles.length===0],
 ['no receipt retains old spare',held(run({workshopOptions:[{...a,request:{...a.request,receipt:null}},b,alt]}),'12')?.oldReserveRetained],
 ['no same day completion retains old spare',held(run({workshopOptions:[{...a,request:{...a.request,sameDayCompletionPlanned:false}},b,alt]}),'12')?.oldReserveRetained],
 ['wrong generation retains old spare',held(run({workshopOptions:[{...a,request:{...a.request,targetIdentity:'wrong'}},b,alt]}),'12')?.oldReserveRetained],
 ['insufficient workshop personnel held',held(run({workshopOptions:[{...a,request:{...a.request,slot:{...a.request.slot,availablePeople:1}}},b,alt]}),'12')?.oldReserveRetained],
 ['no future receipt as actual',held(run({workshopOptions:[{...a,request:{...a.request,receipt:{...a.request.receipt,date:'2027-04-02'}}},b,alt]}),'12')?.oldReserveRetained],
 ['missing calendar evidence held',run({workshopDays:[]}).allocations.length===0],
 ['no authorization',!r.complete&&!r.annualComplete&&!r.writeAllowed&&!r.operationAuthorized&&r.allocations.every(a=>!a.actualCompletion)],
 ['input unchanged',JSON.stringify(x)===before]];
 // First test expects the priority case to schedule #13 only (no #12 alternative).
 tests[0][1]=r.allocations.length===1&&forStand(r,'13')?.date==='2027-04-06'&&!forStand(r,'12');
 return {tests,result:r,alternate:run({workshopTargets:[]}),manual};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./shared-workshop-handover.cjs').previewSharedWorkshop,require('./allocated-pathline-replay.cjs').previewAllocatedPathline,require('./usage-shared-bridge.cjs').previewUsageSharedBridge,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,require('./linked-12-17-combinations.cjs').previewLinked1217,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
