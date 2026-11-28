'use strict';
const {previewPcSharedCirculation}=require('./pc-shared-circulation.cjs');
const {selfTest:singleTest}=require('./test-shared-single-exchange.cjs');
const {previewSharedWorkshop}=require('./shared-workshop-handover.cjs');
const {previewAllocatedPathline}=require('./allocated-pathline-replay.cjs');
const {previewUsageSharedBridge}=require('./usage-shared-bridge.cjs');
const {previewPairedAssemblyDisposition}=require('./paired-assembly-disposition.cjs');
const {previewLinked1217}=require('./linked-12-17-combinations.cjs');
function selfTest(api){
 let fixture;
 const capture=(x,a)=>{if(!fixture)fixture=JSON.parse(JSON.stringify(x));return previewSharedWorkshop(x,a);};
 const old=singleTest(capture,previewSharedWorkshop,previewAllocatedPathline,previewUsageSharedBridge,previewPairedAssemblyDisposition,previewLinked1217,api);
 const x={...fixture,startMonth:'2027-04',fiscalYear:2027,actualEvents:[]};
 const copy=v=>JSON.parse(JSON.stringify(v)),before=JSON.stringify(x),r=previewPcSharedCirculation(x,api),bad=fn=>{const n=copy(x);fn(n);return previewPcSharedCirculation(n,api);};
 const coverage=k=>r.coverage.find(c=>c.stand===k);
 const event=r.annual?.detail.find(e=>e.kind==='rework-inbound');
 const held=bad(n=>n.workshopOptions=[]);
 const duplicate=bad(n=>n.groups.push(copy(n.groups[0])));
 const wrong=bad(n=>n.groups[0].stands=['6','8']);
 const allGroups=bad(n=>{
  const keys=['2','3','4','5','6,7','8,9','10,11','12,13','14,15','16','17'];
  for(const k of keys)if(!n.groups.some(g=>g.stands.join(',')===k))n.groups.push({snapshotId:n.snapshotId,sourceRevision:n.sourceRevision,basis:'匿名・入力だけ',id:'new-'+k,stands:k.split(','),workType:'rollChange',size:'D10',members:[]});
 });
 return [
 ['Existing single/pair real replay regression',old.tests.every(t=>t[1])],
 ['Real shared calculation invoked',!!r.first&&r.first.status==='shared-workshop-preview'],
 ['All 16 coverage rows',r.coverage.length===16],
 ['First shared rework reaches PC annual actual calculation',!!event&&event.status==='forecast'&&r.first.dispositions.some(d=>d.rework?.cycleId===event.cycleId&&d.rework.expectedInboundDate===event.date)],
 ['First single #2 covered',coverage('2').state!=='対象入力なし'],
 ['Missing stand kept explicit',coverage('6').state==='対象入力なし'&&r.held.some(h=>h.stand==='6')],
 ['No full horizon claim',r.coverage.every(c=>!c.fullHorizonVerified)&&!r.periodComplete&&!r.complete],
 ['No missing work evidence invented',held.held.length>0&&held.annual?.detail.every(e=>e.kind!=='rework-inbound')],
 ['Duplicate group held before execution',duplicate.first===null&&duplicate.held.length>0],
 ['Wrong pair held before execution',wrong.first===null&&wrong.held.length>0],
 ['Full group list alone cannot establish completion',allGroups.coverage.every(c=>!c.fullHorizonVerified)&&!allGroups.complete],
 ['Annual accounting month not invented',r.annual.purchaseGuidance.every(p=>p.accountingMonth===null)],
 ['Input unchanged and no authority',before===JSON.stringify(x)&&!r.writeAllowed&&!r.operationAuthorized]
 ];
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const t=selfTest(api);for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
