'use strict';
const {assessDiameterLife}=require('./annual-diameter-gate.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
function previewSingleAllocated(s,a,api){
 const k=a?.stands?.[0],hold=reason=>({status:'held',reason,requiredExchange:true,operationAuthorized:false,writeAllowed:false});
 const same=x=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
 if(s.anonymousOnly!==true||a?.workType!=='rollChange'||a.stands.length!==1||!['2','3','4','5','16','17'].includes(k)||a.minutes!==360||!date(a.date))return hold('単独交換対象・停止時間未確認');
 const matches=(s.singleInputs||[]).filter(x=>String(x?.stand)===k),q=matches[0],g=(s.groups||[]).find(x=>x.id===a.id),m=g?.members?.[0];
 if(matches.length!==1||!same(q)||q.demandId!==a.id||!same(m)||!Array.isArray(q.roles)||q.roles.length!==3||q.roles.some(r=>!same(r)||String(r.stand)!==k||!str(r.rollId)||!str(r.generation)||r.condition==='broken'||r.ledgerStatus==='折損'||r.spareKind==='折損')||new Set(q.roles.map(r=>r.rollId)).size!==3)return hold('単独3セット・個体・版未確認');
 const old=q.roles.find(r=>r.status==='online'),next=q.roles.find(r=>r.status==='new-standby'),target=q.roles.find(r=>r!==old&&r!==next);
 if(!old||!next||!target||m.rollId!==old.rollId||m.generation!==old.generation||!['rework','rework-ready','unassembled-return','new-unassembled'].includes(target.status)||target.chockAssembled!==false||target.emergencyEligible!==false||[old,next].some(r=>r.chockAssembled!==true||r.emergencyEligible!==true))return hold('旧新個体・組込予備・第3セット未確認');
 const fit=q.compatibility;
 if(!same(fit)||fit.oldIdentity!==id(old)||fit.newIdentity!==id(next)||fit.size!==a.size||fit.status!=='compatible'||fit.replacementDiameter!==next.diameterMm||!Number.isFinite(next.diameterMm)||next.diameterMm<=0)return hold('交換先個体・径適合未確認');
 const life=q.diameter?.identity===id(old)&&q.diameter.currentMm===old.diameterMm?assessDiameterLife({...s,diameter:q.diameter,history:q.diameterHistory}):{status:'held',reason:'旧個体径未確認'};
 return {status:'conditional-single-replay',stand:k,oldIdentity:id(old),newIdentity:id(next),projectedRoles:[{...old,status:'used-standby'},{...next,status:'online'},{...target}],life,emergencyReserveCount:1,requiresFullPathlineRecalculation:['16','17'].includes(k),upstreamFitEvidenceOnly:!['16','17'].includes(k),operationAuthorized:false,writeAllowed:false};
}
function previewSingleDisposition(s,a,r,request,api){
 const k=r.stand,old=r.projectedRoles.find(x=>x.status==='used-standby'),target=r.projectedRoles.find(x=>!['online','used-standby'].includes(x.status)),roles=r.projectedRoles.map(x=>({...x})),life=r.life;
 const kind=life.status==='final-use'?'successor-needed':life.status==='rework-candidate'?'rework-candidate':'review';
 const d={stand:k,identity:id(old),kind,status:'held',actualDisposition:false,actualOrderDate:null,issueMonth:null};
 if(kind==='successor-needed'){
  const lead=request?.purchaseLead??{...api.defaultStandLeadTime(k),basis:'R12 provisional'};
  if(String(lead.standKey)===k&&Number.isInteger(lead.months)&&lead.months>0&&lead.months<=120&&['confirmed','provisional'].includes(lead.status)&&str(lead.basis)&&(request?.purchaseLead==null||lead.sourceRevision===s.sourceRevision)){d.status='successor-review';d.procurement={status:'forecast-guidance',latestArrivalBy:a.date,latestOrderBy:api.addMonths(a.date,-lead.months),leadMonths:lead.months,leadBasis:lead.basis,idealArrivalBy:null,actualReceiptDate:null,accountingMonth:null};}
 }
 // Request is already verified by the shared workshop gate; never call with raw options.
 if(!request)return {roles,disposition:d};
 const o=roles.find(x=>id(x)===id(old)),t=roles.find(x=>id(x)===id(target));
 o.status=kind==='rework-candidate'?'rework-ready':kind==='successor-needed'?'retirement-review':'disposition-review';o.chockAssembled=false;o.emergencyEligible=false;t.status='new-standby';t.chockAssembled=true;t.emergencyEligible=true;
 const p=request.dispatchPlan||{},same=x=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis),ov=p.leadOverride;
 if(kind==='rework-candidate'&&same(p)&&p.identity===id(old)&&p.status==='planned'&&date(p.date)&&p.date>request.slot.date&&str(p.cycleId)&&Array.isArray(p.priorCycleIds)&&p.priorCycleIds.every(str)&&new Set(p.priorCycleIds).size===p.priorCycleIds.length&&!p.priorCycleIds.includes(p.cycleId)&&p.dispatchCapacityConfirmed===true&&p.vendorAcceptanceConfirmed===true&&(ov===undefined||(ov&&String(ov.stand)===k&&Number.isInteger(ov.days)&&ov.days>0&&str(ov.basis)&&ov.sourceRevision===s.sourceRevision))){
 const n=ov===undefined?api.provisionalReworkCalendarDays(k):ov.days;if(Number.isInteger(n)&&n>0){const inbound=api.addDays(p.date,n);d.status='conditional-rework';d.rework={cycleId:p.cycleId,dispatchDate:p.date,leadDays:n,expectedInboundDate:inbound,plannedReworkCostMonth:inbound.slice(0,7),actualInboundDate:null,receiptConfirmed:false,basis:p.basis};}
 }
 return {roles,disposition:d};
}
module.exports={previewSingleAllocated,previewSingleDisposition};
