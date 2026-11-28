'use strict';
// PC-only next rotation. Retain the original observation date for forecast lineage.
const {previewThirdWorkshop}=require('./return-handover-stage.cjs');
const {previewUpperSequence}=require('./repeated-upper-caliber.cjs');
const {resolveDispositionLife}=require('./third-upper-rotation.cjs');
const {forecastFirstPurchaseUse}=require('./successor-first-use.cjs');
const {inspectUpperLedger}=require('./caliber-lifetime-policy.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const copy=x=>JSON.parse(JSON.stringify(x));
function makeReturnEvidence(s,anchor,master,disposition,handover,dispatch){
 const d=disposition?.rework,k=String(master?.standKey);
 if(!same(s,anchor)||!same(s,master)||!same(s,dispatch)||!handover||!d||disposition.identity!==master.oldIdentity||dispatch.identity!==master.oldIdentity||handover.oldIdentity!==master.oldIdentity||!['conditional-assembly','conditional-on-future-receipt'].includes(handover.status)||handover.actualCompletion!==false||dispatch.cycleId!==master.cycleId||d.cycleId!==master.cycleId||dispatch.date!==d.dispatchDate||d.expectedInboundDate!==master.expectedInboundDate||d.receiptConfirmed!==false)return null;
 if(anchor.purchaseAnchor&&!anchor.purchaseOriginRole)return null;
 const chain=anchor.diameterChain||(anchor.purchaseAnchor?{snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:anchor.basis,purchaseOrigin:{role:copy(anchor.purchaseOriginRole),evidence:{snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:anchor.basis,purchaseAnchor:copy(anchor.purchaseAnchor)}},steps:[]}:null)||{snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:anchor.basis,diameter:anchor.diameter,history:anchor.diameterHistory,steps:[]};
 const step={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:master.basis,stand:k,rollId:master.rollId,generation:master.generation,oldIdentity:master.oldIdentity,newIdentity:master.identity,cycleId:master.cycleId,status:'conditional-return',actualReceipt:false,dispatchDate:d.dispatchDate,expectedInboundDate:d.expectedInboundDate,leadDays:d.leadDays,forecastDiameterMm:master.diameterMm,dispatchEvidence:{...dispatch,handoverDate:handover.date,handoverConfirmed:true,handoverBasis:handover.basis||s.workshopReservationBasis}};
 return {snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:master.basis,stand:k,diameterChain:{...chain,steps:[...chain.steps,step]}};
}
function previewFollowingUpperSequence(s,state,plan,api){
 const held=[],out={held,sequence:null,periodComplete:false,rotationComplete:false,forecastOnly:true,annualComplete:false,operationAuthorized:false,writeAllowed:false};
 const hold=reason=>{held.push({reason,requiredExchange:null});return out;};
 const g=state?.group,stage=state?.stage,cursor=state?.cursor;
 if(s.anonymousOnly!==true||!same(s,plan)||!stage?.readyForNextRotation||!Array.isArray(g?.stands)||!Array.isArray(state.reservations)||!Array.isArray(stage.handovers)||!Array.isArray(stage.roles)||!Array.isArray(stage.priorCycles)||!Array.isArray(plan.members)||!Array.isArray(state.replacementMasters)||!str(cursor)||!str(s.throughDate))return hold('先行交換・組替・次回根拠未確認');
 const ready=[...stage.handovers.map(h=>h.date),...(stage.admissions||[]).map(a=>a.date)].sort().at(-1),members=[],replacementUsage=[],lives=[];
 for(const k of g.stands){
  const own=stage.roles.filter(r=>String(r.stand)===k),old=own.find(r=>r.status==='online'),spare=own.find(r=>r.status==='new-standby'),third=own.find(r=>r.status==='rework-ready'||r.status==='new-unassembled'&&r.purchaseSuccessor===true&&stage.admissions?.some(a=>a.newIdentity===id(r)&&a.status==='conditional-slot-replacement')),q=plan.members.filter(m=>String(m?.stand)===k),u=state.replacementMasters.filter(m=>String(m?.standKey)===k),h=stage.handovers.find(h=>h.stand===k);
  if(own.length!==3||!old||!spare||!third||q.length!==1||u.length!==1||!same(s,q[0])||q[0].onlineIdentity!==id(old)||q[0].replacementIdentity!==id(spare)||h?.targetIdentity!==id(spare)||u[0].identity!==id(spare)||inspectUpperLedger(s,u[0],g.size,api).status!=='verified-ledger'||g.members.find(m=>m.standKey===k)?.identity!==id(old))return hold('次回個体・予備・全台帳未確認 #'+k);
  const life=resolveDispositionLife(s,old,q[0],{date:ready},stage.priorCycles,api);
  if(life.status==='held')return hold('次回オンライン径根拠未確認 #'+k+' '+life.reason);
  lives.push({stand:k,life});
  // Never cast the forecast diameter as a current actual reading. Physical
  // replay may report diameter review internally; verified lineage is separate.
  members.push({stand:k,roles:[old,spare,{...third,status:third.status==='new-unassembled'?'new-unassembled':'rework'}],diameter:q[0].diameter??q[0].diameterChain?.diameter,diameterHistory:q[0].diameterHistory??q[0].diameterChain?.history});
  replacementUsage.push(u[0]);
 }
 out.lives=lives;
 if(cursor>s.throughDate)return {...out,periodComplete:true,endingGroup:copy(g),endingRoles:copy(stage.roles)};
 const days=s.days.filter(d=>d.date>=cursor).map(d=>({...d,reservedExchangeCount:Number.isInteger(d.reservedExchangeCount)?d.reservedExchangeCount+state.reservations.filter(a=>a.date===d.date).length:d.reservedExchangeCount}));
 const slots=s.slots.filter(t=>t.date>=cursor&&t.date>ready).map(t=>({...t,reserved:Array.isArray(t.reserved)?[...t.reserved,...state.reservations.filter(a=>a.slotId===t.id).map(a=>({startMinute:a.startMinute,endMinute:a.endMinute,basis:a.eventId}))]:t.reserved}));
 const r=previewUpperSequence({...s,asOf:cursor,days,slots,groups:[g],pairedInputs:[{...state.original,asOf:cursor,members,replacementUsage,compatibility:plan.compatibility,assemblies:[]}],setupNightHistory:[...(s.setupNightHistory||[]),...s.days.filter(d=>d.date<cursor)]},api);
 out.sequence=r;
 if(!r.sequenceComplete){held.push(...r.unresolved);return out;}
 const f=r.ending[0];
 if(f.status==='period-end')return {...out,periodComplete:true,endingGroup:f.group,endingRoles:copy(stage.roles),reservations:[...state.reservations,...r.reservations]};
 if(f.status!=='first-roll-change'||r.rollHandoverCandidates.length!==1)return hold('次回交換結果未確認');
 const endingRoles=r.rollHandoverCandidates[0].projectedRoles.map(r=>({...r,forecastOnly:true}));
 const firstUse=forecastFirstPurchaseUse(s,stage,r,endingRoles,api);
 if(firstUse.held.length){held.push(...firstUse.held);return out;}
 return {...out,rotationComplete:true,endingGroup:f.group,endingRoles:firstUse.roles,plannedIssues:firstUse.issues,pendingFirstUse:firstUse.pending,cursor:f.asOf,reservations:[...state.reservations,...r.reservations]};
}
function previewFourthUpperRotation(s,api){
 const third=previewThirdWorkshop(s,api),r=third.third,t=third.stage,plan=s.fourthCycle;
 if(!t?.readyForNextRotation||!same(s,plan))return {third,fourth:null,forecastOnly:true,annualComplete:false,operationAuthorized:false,writeAllowed:false};
 const members=[];
 for(const k of r.third.ending[0].group.stands){
  const a=s.pairedInputs[0].members.find(m=>String(m.stand)===k),m=s.secondCycle.returnMasters.find(m=>m.standKey===k),d=r.second.first.dispositions.find(d=>d.stand===k),h=r.second.first.allocations.find(h=>h.stand===k),opts=s.workshopOptions.filter(o=>String(o.stand)===k&&o.request?.slot?.date===h?.date&&o.request?.oldIdentity===h?.oldIdentity),req=opts.find(o=>o.request?.slot?.startHour===h.startHour&&o.request?.slot?.endHour===h.endHour)?.request;
  const evidence=makeReturnEvidence(s,{...a,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:a?.diameter?.basis},m,d,h,req?.dispatchPlan);
  if(!evidence)return {third,fourth:null,held:[{stand:k,reason:'初回改削の予測径連鎖未確認'}],forecastOnly:true,annualComplete:false,operationAuthorized:false,writeAllowed:false};
  const q=plan.members?.find(q=>String(q.stand)===k);
  if(!same(s,q))return {third,fourth:null,held:[{stand:k,reason:'第4交換先未確認'}],forecastOnly:true,annualComplete:false,operationAuthorized:false,writeAllowed:false};
  members.push({...q,...evidence});
 }
 const f=r.third.ending[0],fourth=previewFollowingUpperSequence(s,{group:f.group,cursor:f.asOf,stage:t,replacementMasters:s.thirdWorkshop.returnMasters,original:s.pairedInputs[0],reservations:[...r.second.first.sequence.reservations,...r.second.second.reservations,...r.third.reservations]},{...plan,members},api);
 return {third,fourth,forecastOnly:true,annualComplete:false,operationAuthorized:false,writeAllowed:false};
}
module.exports={makeReturnEvidence,previewFollowingUpperSequence,previewFourthUpperRotation};
