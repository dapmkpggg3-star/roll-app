'use strict';
// R01/R12/R13/R21/R22: forecast diameter lineage, separate from the actual measurement gate.
const {assessDiameterLife}=require('./annual-diameter-gate.cjs');
const {finalState}=require('../test/fixtures/annual-projection/tonnage-circulation.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const fixed=x=>Math.round(x*1e6)/1e6;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
function assessForecastDiameterChain(input){
 const s=input||{},d=s.diameter||{},base={status:'held',identity:null,forecastOnly:true,actualMeasurement:false,actualReceipt:false,operationAuthorized:false,writeAllowed:false,remainingReworks:null,nextDiameter:null,steps:[]};
 const hold=(reason,extra={})=>({...base,...extra,status:'held',reason});
 if(!day(s.asOf)||!day(s.forecastAsOf)||s.forecastAsOf<s.asOf||!Array.isArray(s.steps)||!s.steps.length)return hold('予測基準日または改削履歴未確認');
 const anchor=assessDiameterLife(s);
 if(anchor.status==='held')return hold('起点実測径・実績平均・廃却径未確認',{anchor});
 const k=String(d.stand),cut=anchor.cut.value,limit=anchor.limitMm,steps=[],generations=new Set([d.generation]),cycles=new Set((s.history||[]).filter(r=>r&&String(r.stand)===k&&r.rollId===d.rollId&&r.status==='actual').map(r=>r.cycleId));
 let identity=d.identity,current=anchor.currentMm,prevDate=s.asOf;
 for(const step of s.steps){
  if(!same(s,step)||step.status!=='conditional-return'||step.actualReceipt!==false||String(step.stand)!==k||step.rollId!==d.rollId||step.oldIdentity!==identity||!str(step.generation)||generations.has(step.generation)||step.newIdentity!==JSON.stringify([k,d.rollId,step.generation])||!str(step.cycleId)||cycles.has(step.cycleId)||!day(step.dispatchDate)||!day(step.expectedInboundDate)||step.dispatchDate<=prevDate||step.expectedInboundDate<=step.dispatchDate||step.expectedInboundDate>s.forecastAsOf||!Number.isInteger(step.leadDays)||step.leadDays<=0||Date.parse(step.expectedInboundDate+'T00:00:00Z')-Date.parse(step.dispatchDate+'T00:00:00Z')!==step.leadDays*86400000)return hold('改削予測の個体・世代・回次・時系列・LT不一致',{anchor,steps});
  const next=fixed(current-cut);
  if(finalState(current,limit,cut)!=='rework'||step.forecastDiameterMm!==next)return hold('最終径・境界または予測径不一致',{anchor,steps});
  steps.push({oldIdentity:identity,newIdentity:step.newIdentity,cycleId:step.cycleId,dispatchDate:step.dispatchDate,expectedInboundDate:step.expectedInboundDate,beforeMm:current,forecastDiameterMm:next,actualReceipt:false,basis:step.basis});
  generations.add(step.generation);cycles.add(step.cycleId);identity=step.newIdentity;current=next;prevDate=step.expectedInboundDate;
 }
 const state=finalState(current,limit,cut),next=fixed(current-cut);
 if(state==='unknown'||next<=0)return hold('予測径計算未成立',{anchor,steps});
 return {...base,status:state==='final'?'final-use':state==='boundary'?'boundary-review':'rework-candidate',identity,anchor,steps,currentMm:current,limitMm:limit,nextDiameter:next,remainingReworks:Math.max(0,Math.ceil(fixed(current-limit)/cut-1e-9)-1),cut:anchor.cut,measurementBasis:d.basis,limitBasis:d.limitBasis,extensionApproved:false,reason:state==='final'?'予測径の次回平均改削後が廃却径未満':state==='boundary'?'予測径の次回平均改削後が廃却径と同値・要確認':'予測径の次回平均改削後が廃却径より大きい'};
}
function selfTest(){
 const s={anonymousOnly:true,asOf:'2027-04-01',forecastAsOf:'2027-09-01',snapshotId:'anon',sourceRevision:'anon-v1'};
 const actual={stand:'8',rollId:'A',generation:'g1',identity:'["8","A","g1"]',snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,status:'actual',limitApproved:true,basis:'anon measurement',limitBasis:'anon limit',measuredDate:s.asOf,currentMm:420,limitMm:400};
 const history=[{stand:'8',rollId:'X',cycleId:'old',status:'actual',kind:'rework',before:430,after:423,basis:'anon history',inboundDate:'2027-03-01',sourceRevision:s.sourceRevision}];
 const step=(old,g,n,dispatch,inbound,diameter)=>({stand:'8',rollId:'A',generation:g,oldIdentity:JSON.stringify(['8','A',old]),newIdentity:JSON.stringify(['8','A',g]),cycleId:n,dispatchDate:dispatch,expectedInboundDate:inbound,leadDays:20,forecastDiameterMm:diameter,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,status:'conditional-return',actualReceipt:false,basis:'anon planned dispatch and return'});
 const a=step('g1','g2','c1','2027-05-01','2027-05-21',413),b=step('g2','g3','c2','2027-07-01','2027-07-21',406),c=step('g3','g4','c3','2027-08-01','2027-08-21',399);
 const input={...s,diameter:actual,history,steps:[a,b]},orig=JSON.stringify(input),r=assessForecastDiameterChain(input),run=x=>assessForecastDiameterChain({...input,...x});
 return [
 ['one forecast return',run({steps:[a]}).currentMm===413&&run({steps:[a]}).status==='rework-candidate'],
 ['two returns then final use',r.currentMm===406&&r.nextDiameter===399&&r.status==='final-use'&&r.remainingReworks===0],
 ['boundary review',run({diameter:{...actual,currentMm:421},steps:[{...a,forecastDiameterMm:414},{...b,forecastDiameterMm:407}]}).status==='boundary-review'],
 ['no next rework after final',run({steps:[a,b,c]}).status==='held'],
 ['forecast never actual',r.forecastOnly&&!r.actualReceipt&&!r.actualMeasurement&&!r.operationAuthorized&&!r.writeAllowed&&r.anchor.currentMm===420],
 ['wrong diameter',run({steps:[{...a,forecastDiameterMm:412}]}).status==='held'],
 ['wrong identity',run({steps:[{...a,oldIdentity:'other'}]}).status==='held'],
 ['duplicate generation',run({steps:[a,{...b,generation:'g1',newIdentity:actual.identity}]}).status==='held'],
 ['duplicate cycle',run({steps:[a,{...b,cycleId:'c1'}]}).status==='held'],
 ['future actual refused',run({diameter:{...actual,measuredDate:'2027-05-01'}}).status==='held'],
 ['future receipt not yet available',run({forecastAsOf:'2027-06-01'}).status==='held'],
 ['forged actual receipt refused',run({steps:[{...a,actualReceipt:true}]}).status==='held'],
 ['wrong lead time',run({steps:[{...a,leadDays:19}]}).status==='held'],
 ['out of order',run({steps:[b,a]}).status==='held'],
 ['stale revision',run({steps:[{...a,sourceRevision:'old'}]}).status==='held'],
 ['no actual average',run({history:[{...history[0],status:'forecast'}]}).status==='held'],
 ['future history excluded',run({history:[{...history[0],inboundDate:'2027-05-01'}]}).status==='held'],
 ['input preserved',JSON.stringify(input)===orig]
 ];
}
module.exports={assessForecastDiameterChain,selfTest};
if(require.main===module){const tests=selfTest();for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
