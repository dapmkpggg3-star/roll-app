'use strict';
const {forecastDisposition}=require('./third-upper-rotation.cjs');
function selfTest(api){
 const s={anonymousOnly:true,asOf:'2027-04-01',snapshotId:'anon',sourceRevision:'anon-v1'},v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anon evidence'},id=g=>JSON.stringify(['8','A',g]);
 const anchor={...v,stand:'8',rollId:'A',generation:'g1',identity:id('g1'),status:'actual',limitApproved:true,limitBasis:'anon limit',measuredDate:s.asOf,currentMm:420,limitMm:400};
 const history=[{...v,stand:'8',rollId:'X',cycleId:'past',status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}];
 const step=(old,g,cycle,dispatch,inbound,handoverDate,mm)=>({...v,stand:'8',rollId:'A',generation:g,oldIdentity:id(old),newIdentity:id(g),cycleId:cycle,dispatchDate:dispatch,expectedInboundDate:inbound,leadDays:20,forecastDiameterMm:mm,status:'conditional-return',actualReceipt:false,dispatchEvidence:{...v,identity:id(old),cycleId:cycle,date:dispatch,status:'planned',dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true,handoverDate,handoverConfirmed:true,handoverBasis:'anon planned same-day handover'}});
 const a=step('g1','g2','c1','2027-05-01','2027-05-21','2027-04-30',413),b=step('g2','g3','c2','2027-07-01','2027-07-21','2027-06-30',406);
 const role={stand:'8',rollId:'A',generation:'g3',diameterMm:406},evidence={...v,diameterChain:{...v,diameter:anchor,history,steps:[a,b]},onlineStartDate:'2027-07-23',finalUseStart:{...v,identity:id('g3'),status:'forecast',date:'2027-07-23'}},event={date:'2027-08-15'},h={status:'conditional-on-future-receipt',oldIdentity:id('g3'),date:'2027-08-16'},d={...v,identity:id('g3'),status:'planned',date:'2027-08-20',cycleId:'c3',priorCycleIds:['c1','c2'],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true};
 const go=(r=role,q=evidence,ev=event,hand=h,di=d,prior=['c1','c2'])=>forecastDisposition(s,r,q,ev,hand,di,prior,api);
 const mutate=fn=>{const q=JSON.parse(JSON.stringify(evidence));fn(q);return go(role,q);};
 const r=go(),one=go({...role,generation:'g2',diameterMm:413},{...evidence,diameterChain:{...evidence.diameterChain,steps:[a]}},event,{...h,oldIdentity:id('g2')},{...d,identity:id('g2')});
 const actual=go({...role,generation:'g1',diameterMm:420},{...v,diameter:anchor,diameterHistory:history},event,{...h,oldIdentity:id('g1')},{...d,identity:id('g1')});
 return [
 ['forecast final use purchase only',r.kind==='successor-needed'&&r.procurement?.latestOrderBy==='2027-02-15'&&r.procurement?.idealArrivalBy==='2027-07-23'&&!r.rework&&r.life.forecastOnly&&!r.life.actualMeasurement&&!r.actualDisposition],
 ['forecast rework dates and fee month',one.rework?.expectedInboundDate==='2027-09-09'&&one.rework.plannedReworkCostMonth==='2027-09'&&one.rework.forecastDiameterMm===406&&!one.rework.receiptConfirmed],
 ['actual path preserved',actual.rework?.forecastDiameterMm===413&&!actual.life.forecastOnly],
 ['missing prior cycle held',go(role,evidence,event,h,d,['c1']).status==='held'],
 ['missing dispatch proof held',mutate(q=>delete q.diameterChain.steps[0].dispatchEvidence).status==='held'],
 ['handover basis required',mutate(q=>q.diameterChain.steps[0].dispatchEvidence.handoverConfirmed=false).status==='held'],
 ['incorrect lead held',mutate(q=>{q.diameterChain.steps[0].leadDays=19;q.diameterChain.steps[0].expectedInboundDate='2027-05-20'}).status==='held'],
 ['wrong forecast diameter held',go({...role,diameterMm:405}).status==='held'],
 ['forecast generation must match',go({...role,generation:'g9'}).status==='held'],
 ['return after exit held',go(role,evidence,{date:'2027-07-20'}).status==='held'],
 ['early ideal date not adopted',mutate(q=>{q.onlineStartDate='2027-07-20';q.finalUseStart.date='2027-07-20'}).procurement?.idealArrivalBy===null],
 ['boundary purchase review no rework',mutate(q=>{q.diameterChain.diameter.currentMm=421;q.diameterChain.steps[0].forecastDiameterMm=414;q.diameterChain.steps[1].forecastDiameterMm=407}).status==='held'],
 ['missing handover retains rework need',go({...role,generation:'g2',diameterMm:413},{...evidence,diameterChain:{...evidence.diameterChain,steps:[a]}},event,null,d).status==='held'],
 ['new dispatch duplicate held',go({...role,generation:'g2',diameterMm:413},{...evidence,diameterChain:{...evidence.diameterChain,steps:[a]}},event,{...h,oldIdentity:id('g2')},{...d,identity:id('g2'),cycleId:'c1'}).status==='held']
 ];
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const tests=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
