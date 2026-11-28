'use strict';
const {makeReturnEvidence}=require('./following-upper-rotation.cjs');
const {forecastDisposition,resolveDispositionLife}=require('./third-upper-rotation.cjs');
function selfTest(api){
 const s={anonymousOnly:true,asOf:'2027-04-01',snapshotId:'anon',sourceRevision:'v1'},v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anon'},identity='["8","D","g1"]',m={...v,standKey:'8',rollId:'D',generation:'g1',identity,status:'new-purchase-forecast',diameterMm:420},p={...v,newIdentity:identity,status:'conditional-slot-replacement',actualAdmission:false,actualReceipt:false,master:m,date:'2027-11-17',expectedReceiptDate:'2027-11-16'},role={stand:'8',rollId:'D',generation:'g1',diameterMm:420,purchaseSuccessor:true,purchaseFirstUse:{identity,forecastOnly:true,actualIssue:false,actualIssueDate:null,firstUseDate:'2028-01-01',exchangeDate:'2027-12-31',plannedIssueMonth:'2028-01'}},e={...v,purchaseAnchor:{...v,master:m,admission:p,limit:{...v,identity,approved:true,mm:400},history:[{...v,stand:'8',rollId:'X',cycleId:'x',status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]}},event={date:'2028-02-01'},h={...v,actualCompletion:false,oldIdentity:identity,status:'conditional-on-future-receipt',date:'2028-02-02'},d={...v,identity,status:'planned',date:'2028-02-05',cycleId:'D-first',priorCycleIds:[],dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true};
 const input=[s,role,e,event,h,d,[]],before=JSON.stringify(input),r=forecastDisposition(...input,api),run=fn=>{const a=JSON.parse(before);fn(a);return forecastDisposition(...a,api);};
 const master={...v,standKey:'8',rollId:'D',generation:'g2',oldIdentity:identity,identity:'["8","D","g2"]',cycleId:'D-first',expectedInboundDate:'2028-02-25',diameterMm:413};
 const ev=makeReturnEvidence(s,{...e,purchaseOriginRole:role},master,r,h,d);
 const returned={...role,generation:'g2',diameterMm:413};
 const life=resolveDispositionLife(s,returned,ev,{date:'2028-03-01'},['D-first'],api);
 const bad=resolveDispositionLife(s,returned,ev,{date:'2028-02-24'},['D-first'],api);
 return [
 ['D return generation keeps original purchase evidence',life.status==='rework-candidate'&&life.currentMm===413&&life.nextDiameter===406&&life.remainingReworks===1&&life.measurementBasis===null],
 ['D cannot return before expected inbound',bad.status==='held'],
 ['D return rejects missing cycle',resolveDispositionLife(s,returned,ev,{date:'2028-03-01'},[],api).status==='held'],
 ['D first rework forecast',r.status==='conditional-rework'&&r.rework.forecastDiameterMm===413&&r.rework.expectedInboundDate==='2028-02-25'],
 ['forecast not actual',r.life.forecastOnly&&!r.life.actualMeasurement&&!r.rework.receiptConfirmed&&r.rework.actualInboundDate===null],
 ['missing first use held',run(a=>delete a[1].purchaseFirstUse).status==='held'],
 ['missing handover held',run(a=>a[4]=null).status==='held'],
 ['duplicate cycle held',run(a=>a[6].push('D-first')).status==='held'],
 ['wrong individual held',run(a=>a[5].identity='wrong').status==='held'],
 ['input unchanged',JSON.stringify(input)===before]
 ];
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const tests=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
