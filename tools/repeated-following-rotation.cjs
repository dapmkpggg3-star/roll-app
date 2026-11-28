'use strict';
// Repeat the same post-exchange stage and next sequence. Each future master and
// compatibility/slot proof must be explicit. Missing evidence stops the preview.
const {previewFourthUpperRotation,makeReturnEvidence,previewFollowingUpperSequence}=require('./following-upper-rotation.cjs');
const {previewReturnHandover}=require('./return-handover-stage.cjs');
const {previewSuccessorAdmission}=require('./successor-three-set.cjs');
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&typeof x.basis==='string'&&x.basis.trim();
const copy=x=>JSON.parse(JSON.stringify(x));
function previewRepeatedFollowing(s,api){
 const initial=previewFourthUpperRotation(s,api),fourth=initial.fourth,stages=[],held=[],evidence=new Map();
 const base={initial,stages,held,periodComplete:false,annualComplete:false,forecastOnly:true,operationAuthorized:false,writeAllowed:false};
 const hold=(reason,extra={})=>{held.push({reason,...extra});return base;};
 if(fourth?.periodComplete)return {...base,periodComplete:true,endingGroup:fourth.endingGroup,endingRoles:fourth.endingRoles,reservations:fourth.reservations};
 if(!fourth?.rotationComplete||!Array.isArray(s.followingStages))return hold('先行第4交換・後続計画未成立');
 const r=initial.third.third,t=initial.third.stage,original=s.pairedInputs[0],ks=fourth.endingGroup.stands;
 const find=(a,k)=>a.find(x=>String(x.standKey??x.stand)===k);
 for(const k of ks){
  const a=find(original.members,k),b=find(s.secondCycle.members,k),c=find(s.thirdWorkshop.members,k);
  const am=find(s.secondCycle.returnMasters,k),bm=find(s.thirdWorkshop.returnMasters,k);
  const h=find(r.second.first.allocations,k),req=s.workshopOptions.find(o=>String(o.stand)===k&&o.request?.slot?.date===h?.date&&o.request?.slot?.startHour===h?.startHour&&o.request?.slot?.endHour===h?.endHour)?.request;
  const ae=makeReturnEvidence(s,{...a,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:a.diameter.basis},am,find(r.second.first.dispositions,k),h,req?.dispatchPlan);
  const be=makeReturnEvidence(s,b,bm,find(r.dispositions,k),find(r.second.nextHandovers,k),find(s.thirdCycle.dispatchPlans,k));
  if(!ae||!be||!same(s,c))return hold('起点の予測径履歴未成立',{stand:k});
  evidence.set(am.identity,ae);evidence.set(bm.identity,be);evidence.set(c.diameter.identity,c);
 }
 let current=fourth,previous=t,previousDispatch=s.thirdWorkshop.dispatchPlans;
 const knownRollIds=new Set(original.members.flatMap(m=>m.roles.map(r=>r.rollId)));
 for(let i=0;i<s.followingStages.length;i++){
  const plan=s.followingStages[i],event=current.sequence.events.find(e=>e.rollChanged),g=current.endingGroup;
  if(!same(s,plan)||!same(s,plan.workshop)||!same(s,plan.next)||plan.afterExchangeDate!==event?.date||!Array.isArray(plan.workshop.members)||!Array.isArray(plan.workshop.returnMasters)||!Array.isArray(plan.workshop.dispatchPlans)||!Array.isArray(plan.next.members))return hold('後続計画・対象交換日未確認',{exchangeDate:event?.date,requiredExchange:null});
  const members=[];
  for(const k of ks){
   const old=current.endingRoles.find(r=>String(r.stand)===k&&r.status==='used-standby'),q=find(plan.workshop.members,k),anchor=old&&evidence.get(id(old));
   if(!old||!same(s,q)||q.onlineIdentity!==id(old)||!anchor)return hold('使用終了個体の予測径履歴未確認',{stand:k});
   members.push({...q,...anchor,onlineStartDate:q.onlineStartDate,finalUseStart:q.finalUseStart});
  }
  let stage=previewReturnHandover(s,{roles:current.endingRoles,event,group:g,busy:previous.busy,priorCycles:previous.priorCycles,dispositions:previous.dispositions,admissions:previous.admissions||[]},{...plan.workshop,members},api);
  const entry={exchangeDate:event.date,stage,next:null};stages.push(entry);
  if(stage.conditionalHandoverComplete&&stage.dispositions.some(d=>d.kind==='successor-needed')){
   stage=previewSuccessorAdmission(s,stage,event,g,plan.successors,[...knownRollIds],api);entry.admission=stage;entry.stage=stage;
   for(const a of stage.admissions||[])knownRollIds.add(a.master.rollId);
  }
  if(!stage.readyForNextRotation)return hold('工作・次回処遇未成立',{exchangeDate:event.date,details:stage.held});
  for(const k of ks){
   const m=find(plan.workshop.returnMasters,k);
   if(m?.status==='new-purchase-forecast'){
    const admission=(previous.admissions||[]).find(a=>a.newIdentity===m.identity&&a.stand===k);
    const spec=find(plan.workshop.purchaseDiameterInputs||[],k);
    if(!admission||!same(s,spec)||spec.identity!==m.identity||evidence.has(m.identity))return hold('新品仕様径・廃却径根拠未確認',{stand:k});
    evidence.set(m.identity,{snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:spec.basis,stand:k,purchaseAnchor:{snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:spec.basis,master:copy(m),admission:{...copy(admission),snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:admission.master.basis},limit:copy(spec.limit),history:copy(spec.history||[])}});
    continue;
   }
   const anchor=evidence.get(m.oldIdentity),h=find(previous.handovers,k),d=find(previous.dispositions,k),dispatch=find(previousDispatch,k);
   const ev=anchor&&makeReturnEvidence(s,anchor,m,d,h,dispatch);
   if(!ev||evidence.has(m.identity))return hold('戻り世代の履歴連結未成立',{stand:k});
   evidence.set(m.identity,ev);
  }
  const nextMembers=[];
  for(const k of ks){
   const old=stage.roles.find(r=>String(r.stand)===k&&r.status==='online'),q=find(plan.next.members,k),ev=old&&evidence.get(id(old));
   if(!old||!same(s,q)||q.onlineIdentity!==id(old)||!ev)return hold('次回オンライン履歴未確認',{stand:k});
   nextMembers.push({...q,...ev});
  }
  const next=previewFollowingUpperSequence(s,{group:g,cursor:current.cursor,stage,replacementMasters:plan.workshop.returnMasters,original,reservations:current.reservations},{...plan.next,members:nextMembers},api);entry.next=next;
  if(next.periodComplete)return {...base,periodComplete:true,endingGroup:next.endingGroup,endingRoles:next.endingRoles,reservations:next.reservations};
  if(!next.rotationComplete)return hold('次回交換未成立',{details:next.held,requiredExchange:next.held.some(h=>h.requiredExchange===true)});
  if(next.cursor<=current.cursor)return hold('反復時系列が進まない');
  current=next;previous=stage;previousDispatch=plan.workshop.dispatchPlans;
 }
 return {...base,held:[...held,{reason:'期間内の次回工作計画未確認',exchangeDate:current.sequence.events.find(e=>e.rollChanged)?.date}],endingGroup:current.endingGroup,endingRoles:current.endingRoles,reservations:current.reservations};
}
module.exports={previewRepeatedFollowing};
