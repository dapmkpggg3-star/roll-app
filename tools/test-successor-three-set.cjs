'use strict';
const {previewSuccessorAdmission}=require('./successor-three-set.cjs');
const {forecastDisposition}=require('./third-upper-rotation.cjs');
function fixture(api){
 const s={anonymousOnly:true,asOf:'2027-04-01',throughDate:'2027-12-31',snapshotId:'s',sourceRevision:'r'},v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anonymous'},event={date:'2027-11-15'},group={stands:['8','9'],size:'D10'},stage={conditionalHandoverComplete:true,held:[],roles:[],handovers:[],dispositions:[],priorCycles:[],busy:[]},plans=[];
 const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 for(const k of group.stands){
  const old={...v,stand:k,rollId:k+'A',generation:'g3',diameterMm:406,status:'retirement-review',chockAssembled:false,emergencyEligible:false},online={...v,stand:k,rollId:k+'B',generation:'g2',diameterMm:413,status:'online',chockAssembled:true,emergencyEligible:true},spare={...v,stand:k,rollId:k+'C',generation:'g2',diameterMm:413,status:'new-standby',chockAssembled:true,emergencyEligible:true};
  stage.roles.push(old,online,spare);const date=k==='8'?'2027-11-16':'2027-11-17',h={stand:k,date,oldIdentity:id(old),targetIdentity:id(spare),status:'conditional-on-future-receipt',actualCompletion:false};stage.handovers.push(h);
  const anchor={...v,stand:k,rollId:old.rollId,generation:'g1',identity:JSON.stringify([k,old.rollId,'g1']),status:'actual',limitApproved:true,limitBasis:'anon limit',measuredDate:s.asOf,currentMm:420,limitMm:400};
  const history=[{...v,stand:k,rollId:'history-'+k,cycleId:'past-'+k,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}];
  const step=(a,b,cycle,dispatch,inbound,hd,mm)=>({...v,stand:k,rollId:old.rollId,generation:b,oldIdentity:JSON.stringify([k,old.rollId,a]),newIdentity:JSON.stringify([k,old.rollId,b]),cycleId:cycle,status:'conditional-return',actualReceipt:false,dispatchDate:dispatch,expectedInboundDate:inbound,leadDays:20,forecastDiameterMm:mm,dispatchEvidence:{...v,identity:JSON.stringify([k,old.rollId,a]),cycleId:cycle,date:dispatch,status:'planned',dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true,handoverDate:hd,handoverConfirmed:true,handoverBasis:'anon'}});
  const cycles=['c1-'+k,'c2-'+k];stage.priorCycles.push(...cycles);
  const evidence={...v,diameterChain:{...v,diameter:anchor,history,steps:[step('g1','g2',cycles[0],'2027-05-01','2027-05-21','2027-04-30',413),step('g2','g3',cycles[1],'2027-08-01','2027-08-21','2027-07-31',406)]},onlineStartDate:'2027-09-01',finalUseStart:{...v,identity:id(old),status:'forecast',date:'2027-09-01'}};
  stage.dispositions.push(forecastDisposition(s,old,evidence,event,h,null,stage.priorCycles,api));
  const rollId=k+'D',identity=JSON.stringify([k,rollId,'new']),master={...v,standKey:k,rollId,generation:'new',identity,status:'new-purchase-forecast',diameterMm:450,size:'D10',usageBasis:'anon',remainingBasis:'anon',openingUsedTons:0,activeCalibers:[],caliberLedger:{...v,identity,complete:true,totalCalibers:3,calibers:['active','unused','unused'].map((state,i)=>({...v,id:String(i+1),state,tons:0,runs:null}))}};
  plans.push({...v,stand:k,oldIdentity:id(old),status:'planned',retireDate:date,admissionDate:date,master,receipt:{...v,identity,status:'forecast',actualReceipt:false,usableForecast:true,date:'2027-09-01'},order:{...v,identity,status:'planned',date:'2027-04-01'}});
  // 6 month lead: September ideal cannot be met with an April planned order.
  plans.at(-1).receipt.date='2027-10-01';
 }
 return {s,stage,event,group,plans,known:['old-historical']};
}
function selfTest(api){
 const {s,stage,event,group,plans,known}=fixture(api);
 const before=JSON.stringify([s,stage,event,group,plans]),r=previewSuccessorAdmission(s,stage,event,group,plans,known,api);
 const run=fn=>{const [a,b,c,d,e]=JSON.parse(before);fn(a,b,c,d,e);return previewSuccessorAdmission(a,b,c,d,e,known,api);};
 const noChange=q=>!q.admissionComplete&&q.roles.length===6&&!q.roles.some(t=>t.purchaseSuccessor);
 return [
 ['forecast final use from two reworks',stage.dispositions.every(d=>d.kind==='successor-needed'&&d.life.currentMm===406&&d.life.nextDiameter===399&&!d.rework)],
 ['D replaces A, exactly three each',r.admissionComplete&&r.admissions.length===2&&r.roles.length===6&&group.stands.every(k=>r.roles.filter(t=>String(t.stand)===k).map(t=>t.rollId).sort().join(',')===[k+'B',k+'C',k+'D'].join(','))],
 ['D not yet chocked or emergency spare',r.roles.filter(t=>t.purchaseSuccessor).every(t=>t.status==='new-unassembled'&&!t.chockAssembled&&!t.emergencyEligible)],
 ['existing spare remains available',group.stands.every(k=>r.roles.filter(t=>String(t.stand)===k&&t.status!=='online'&&t.emergencyEligible&&t.chockAssembled).length===1)],
 ['A history retained and no false actual',r.retiredHistory.length===2&&r.retiredHistory.every(t=>t.generation==='g3'&&!t.actualRetired)&&r.admissions.every(t=>!t.actualAdmission&&!t.actualReceipt&&t.issueMonth===null&&t.accountingMonth===null)],
 ['late relative to ideal flagged',r.warnings.length===2],
 ['no admission without handover',noChange(run((a,b)=>b.conditionalHandoverComplete=false))],
 ['late receipt blocked',noChange(run((a,b,c,d,e)=>e[0].receipt.date='2027-11-16'))],
 ['unconfirmed receipt blocked',noChange(run((a,b,c,d,e)=>e[0].receipt.status='actual'))],
 ['insufficient purchase LT blocked',noChange(run((a,b,c,d,e)=>e[0].order.date='2027-05-01'))],
 ['no fourth set duplicate historical ID',noChange(run((a,b,c,d,e)=>e[0].master.rollId='old-historical'))],
 ['no old roll ID reuse',noChange(run((a,b,c,d,e)=>e[0].master.rollId='8A'))],
 ['no admission before standby handover',noChange(run((a,b,c,d,e)=>e[0].admissionDate=e[0].retireDate='2027-11-15'))],
 ['no nonzero new groove',noChange(run((a,b,c,d,e)=>e[0].master.caliberLedger.calibers[0].tons=400))],
 ['both sides evidence or atomic hold',noChange(run((a,b,c,d,e)=>e.pop()))],
 ['no mutation and no actual writes',JSON.stringify([s,stage,event,group,plans])===before&&!r.operationAuthorized&&!r.writeAllowed&&!r.actualIssue]
 ];
}
module.exports={fixture,selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const tests=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
