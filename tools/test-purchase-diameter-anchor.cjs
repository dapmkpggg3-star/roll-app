'use strict';
const {assessPurchasedDiameter}=require('./purchase-diameter-anchor.cjs');
function selfTest(){
 const s={anonymousOnly:true,asOf:'2027-04-01',snapshotId:'anon',sourceRevision:'v1'},v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anon'},identity='["8","D","g1"]',m={...v,standKey:'8',rollId:'D',generation:'g1',identity,status:'new-purchase-forecast',diameterMm:420},p={...v,newIdentity:identity,status:'conditional-slot-replacement',actualAdmission:false,actualReceipt:false,master:m,date:'2027-11-17',expectedReceiptDate:'2027-11-16'},role={stand:'8',rollId:'D',generation:'g1',diameterMm:420,purchaseSuccessor:true,purchaseFirstUse:{identity,forecastOnly:true,actualIssue:false,actualIssueDate:null,firstUseDate:'2028-01-01',exchangeDate:'2027-12-31',plannedIssueMonth:'2028-01'}},e={...v,purchaseAnchor:{...v,master:m,admission:p,limit:{...v,identity,approved:true,mm:400},history:[{...v,stand:'8',rollId:'X',cycleId:'x',status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]}},event={date:'2028-02-01'};
 const before=JSON.stringify([s,role,e,event]),r=assessPurchasedDiameter(s,role,e,event),run=(fn)=>{const a=JSON.parse(before);fn(...a);return assessPurchasedDiameter(...a);};
 return [
 ['new purchase forecast next 413',r.status==='rework-candidate'&&r.nextDiameter===413&&r.remainingReworks===2],
 ['not actual',r.forecastOnly&&!r.actualMeasurement&&!r.actualReceipt&&r.measurementBasis===null],
 ['missing first use',run((s,r)=>delete r.purchaseFirstUse).status==='held'],
 ['future first use',run((s,r,e,t)=>t.date='2027-12-31').status==='held'],
 ['wrong diameter',run((s,r)=>r.diameterMm=421).status==='held'],
 ['wrong admission',run((s,r,e)=>e.purchaseAnchor.admission.newIdentity='wrong').status==='held'],
 ['unapproved limit',run((s,r,e)=>e.purchaseAnchor.limit.approved=false).status==='held'],
 ['forecast history excluded',run((s,r,e)=>e.purchaseAnchor.history[0].status='forecast').status==='held'],
 ['future history excluded',run((s,r,e)=>e.purchaseAnchor.history[0].inboundDate='2027-05-01').status==='held'],
 ['input unchanged',JSON.stringify([s,role,e,event])===before]];
}
module.exports={selfTest};
if(require.main===module){const tests=selfTest();for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(t=>!t[1]))process.exitCode=1;}
