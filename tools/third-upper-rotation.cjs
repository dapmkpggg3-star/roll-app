'use strict';
// R01/R11/R12/R21: second disposition and third rotation, never actual receipt.
const {previewSecondUpperCycle}=require('./conditional-second-upper-cycle.cjs');
const {previewUpperSequence}=require('./repeated-upper-caliber.cjs');
const {assessDiameterLife}=require('./annual-diameter-gate.cjs');
const {assessPurchasedDiameter}=require('./purchase-diameter-anchor.cjs');
const {assessForecastDiameterChain}=require('./forecast-diameter-chain.cjs');
const {inspectUpperLedger}=require('./caliber-lifetime-policy.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const copy=x=>JSON.parse(JSON.stringify(x));
// Resolve actual measurements and forecast generations without promoting forecasts into actuals.
function resolveDispositionLife(s,role,evidence,event,priorCycles,api){
 const k=String(role.stand),identity=id(role);
 if(!same(s,evidence)||!day(event?.date)||event.date<s.asOf)return {status:'held',reason:'処遇根拠未確認'};
 if(evidence.purchaseAnchor!==undefined&&evidence.diameterChain===undefined)return assessPurchasedDiameter(s,role,evidence,event);
 if(evidence.diameterChain===undefined){
  if(evidence.diameter?.identity!==identity||evidence.diameter?.currentMm!==role.diameterMm)return {status:'held',reason:'個体径根拠未確認'};
  return assessDiameterLife({...s,diameter:evidence.diameter,history:evidence.diameterHistory});
 }
 const c=evidence.diameterChain,hold=reason=>({status:'held',forecastOnly:true,reason});
 if(!same(s,c)||!Array.isArray(c.steps)||!c.steps.length||!Array.isArray(priorCycles)||(c.purchaseOrigin?.role??c.diameter)?.rollId!==role.rollId||String((c.purchaseOrigin?.role??c.diameter)?.stand)!==k)return hold('予測径の起点未確認');
 for(const step of c.steps){
  const proof=step?.dispatchEvidence,ov=proof?.leadOverride;
  if(!same(s,proof)||proof.identity!==step.oldIdentity||proof.cycleId!==step.cycleId||proof.date!==step.dispatchDate||proof.status!=='planned'||proof.dispatchCapacityConfirmed!==true||proof.vendorAcceptanceConfirmed!==true||!day(proof.handoverDate)||proof.handoverDate>=proof.date||proof.handoverConfirmed!==true||!str(proof.handoverBasis)||!priorCycles.includes(step.cycleId))return hold('先行回次・搬出・引継ぎ根拠未確認');
  if(ov!==undefined&&(!ov||String(ov.stand)!==k||!Number.isInteger(ov.days)||ov.days<=0||!str(ov.basis)||ov.sourceRevision!==s.sourceRevision))return hold('予測改削LT根拠未確認');
  if(step.leadDays!==(ov===undefined?api.provisionalReworkCalendarDays(k):ov.days))return hold('予測改削LT不一致');
 }
 const life=assessForecastDiameterChain({...s,diameter:c.diameter,history:c.history,purchaseOrigin:c.purchaseOrigin,steps:c.steps,forecastAsOf:event.date});
 if(life.status==='held')return life;
 if(life.identity!==identity||life.currentMm!==role.diameterMm)return hold('予測新世代・個体径不一致');
 return life;
}
function forecastDisposition(s,role,evidence,event,handover,dispatch,priorCycles,api){
 const k=String(role.stand),identity=id(role);
 const out={stand:k,identity,status:'held',kind:'review',actualDisposition:false,actualOrderDate:null,issueMonth:null,operationAuthorized:false};
 const life=resolveDispositionLife(s,role,evidence,event,priorCycles,api);
 if(life.status==='held')return {...out,life,reason:life.reason};
 if(['final-use','boundary-review'].includes(life.status)){
  const lead=evidence.purchaseLead??{...api.defaultStandLeadTime(k),basis:'R12 provisional'};
  const ok=String(lead.standKey)===k&&Number.isInteger(lead.months)&&lead.months>0&&lead.months<=120&&['confirmed','provisional'].includes(lead.status)&&str(lead.basis)&&(evidence.purchaseLead==null||lead.sourceRevision===s.sourceRevision);
  const start=evidence.finalUseStart;
  const ideal=same(s,start)&&start.identity===identity&&start.status==='forecast'&&day(start.date)&&start.date<=event.date&&start.date===evidence.onlineStartDate&&(!life.forecastOnly||start.date>=(life.steps?.at(-1)?.expectedInboundDate??role.purchaseFirstUse?.firstUseDate??'9999-12-31'))?start.date:null;
  return {...out,life,kind:life.status==='final-use'?'successor-needed':'boundary-review',status:ok?'successor-review':'held',reason:life.reason,procurement:ok?{status:'forecast-guidance',latestArrivalBy:event.date,latestOrderBy:api.addMonths(event.date,-lead.months),idealArrivalBy:ideal,idealOrderBy:ideal?api.addMonths(ideal,-lead.months):null,leadMonths:lead.months,leadBasis:lead.basis,actualReceived:false,accountingMonth:null}:null};
 }
 const base={...out,life,kind:'rework-candidate'};
 if(!handover||handover.status!=='conditional-on-future-receipt'||handover.oldIdentity!==identity)return {...base,reason:'中古予備引継ぎ未成立'};
 if(!same(s,dispatch)||dispatch.identity!==identity||dispatch.status!=='planned'||!day(dispatch.date)||dispatch.date<=handover.date||!str(dispatch.cycleId)||!Array.isArray(dispatch.priorCycleIds)||dispatch.priorCycleIds.some(x=>!str(x))||new Set(dispatch.priorCycleIds).size!==dispatch.priorCycleIds.length||dispatch.priorCycleIds.includes(dispatch.cycleId)||priorCycles.includes(dispatch.cycleId)||dispatch.dispatchCapacityConfirmed!==true||dispatch.vendorAcceptanceConfirmed!==true)return {...base,reason:'搬出・回次・受入根拠未確認'};
 const ov=dispatch.leadOverride;
 if(ov!==undefined&&(!ov||String(ov.stand)!==k||!Number.isInteger(ov.days)||ov.days<=0||!str(ov.basis)||ov.sourceRevision!==s.sourceRevision))return {...base,reason:'改削LT根拠未確認'};
 const n=ov===undefined?api.provisionalReworkCalendarDays(k):ov.days;
 if(!Number.isInteger(n)||n<=0)return {...base,reason:'改削LT未確認'};
 const inbound=api.addDays(dispatch.date,n);
 return {...base,status:'conditional-rework',rework:{cycleId:dispatch.cycleId,dispatchDate:dispatch.date,leadDays:n,expectedInboundDate:inbound,plannedReworkCostMonth:inbound.slice(0,7),forecastDiameterMm:life.nextDiameter,actualInboundDate:null,receiptConfirmed:false,basis:dispatch.basis}};
}
function previewThirdUpperRotation(input,api){
 const s=input||{},second=previewSecondUpperCycle(s,api),dispositions=[],held=[],projectedRoles=[],third=null;
 const base={status:'third-upper-rotation',second,dispositions,held,projectedRoles,third,complete:false,annualComplete:false,operationAuthorized:false,writeAllowed:false,actualReceipt:false,actualAssembly:false};
 const hold=(reason,extra={})=>{held.push({reason,...extra});return base;};
 const e=second.second?.events.find(e=>e.rollChanged),candidate=second.second?.rollHandoverCandidates[0],plan=s.thirdCycle,original=s.pairedInputs?.[0],f=second.second?.ending[0];
 if(!e||!candidate||!f||f.status!=='first-roll-change'||!same(s,plan)||!Array.isArray(plan.members)||plan.members.length!==2||!Array.isArray(plan.dispatchPlans))return hold('第2交換・第3循環入力未確認');
 const priorCycles=second.first.dispositions.flatMap(d=>d.rework?[d.rework.cycleId]:[]);
 const roles=second.projectedRoles.map(r=>({...r})),members=[],replacementUsage=[];
 for(const k of e.stands){
  const old=candidate.projectedRoles.find(r=>String(r.stand)===k&&r.status==='used-standby'),q=s.secondCycle.members.find(m=>String(m.stand)===k),h=second.nextHandovers.find(h=>h.stand===k),dispatches=plan.dispatchPlans.filter(d=>String(d?.stand)===k);
  if(!old||!q)return hold('第2旧個体未確認 #'+k);
  const d=forecastDisposition(s,old,{...q,onlineStartDate:s.days.find(d=>d.date>second.first.sequence.events.find(e=>e.rollChanged).date&&d.productionAmount>0)?.date??null},e,h,dispatches.length===1?dispatches[0]:null,priorCycles,api);
  dispositions.push(d);
  if(d.rework)priorCycles.push(d.rework.cycleId);
  const current=roles.find(r=>id(r)===id(old));
  if(current&&h){current.status=d.kind==='successor-needed'?'retirement-review':d.rework?'rework-ready':'disposition-review';}
 }
 projectedRoles.push(...roles);
 if(!second.conditionalCycleComplete)return hold('第2工作引継ぎ未成立・旧中古予備保持');
 if(dispositions.some(d=>!d.rework))return hold('第2旧個体の再生または後継確保未成立',{requiredExchange:true});
 const g=f.group,ready=second.nextHandovers.map(h=>h.date).sort().at(-1);
 for(const k of g.stands){
  const own=roles.filter(r=>String(r.stand)===k),online=own.find(r=>r.status==='online'),spare=own.find(r=>r.status==='new-standby'),old=own.find(r=>r.status==='rework-ready'),qs=plan.members.filter(q=>String(q?.stand)===k),q=qs[0],ret=second.returns.find(r=>r.stand===k),u=s.secondCycle.returnMasters.find(r=>String(r.standKey)===k);
  if(own.length!==3||!online||!spare||!old||qs.length!==1||!same(s,q)||q.onlineIdentity!==id(online)||q.replacementIdentity!==id(spare)||q.diameter?.identity!==id(online)||q.diameter?.currentMm!==online.diameterMm||assessDiameterLife({...s,diameter:q.diameter,history:q.diameterHistory}).status==='held'||!ret||id(spare)!==ret.newIdentity||u?.identity!==id(spare)||inspectUpperLedger(s,u,g.size,api).status!=='verified-ledger')return hold('第3交換先・現径・新世代未確認 #'+k);
  members.push({stand:k,roles:[{...online},{...spare},{...old,status:'rework'}],diameter:q.diameter,diameterHistory:q.diameterHistory});
  replacementUsage.push(copy(u));
 }
 const allReservations=[...second.first.sequence.reservations,...second.second.reservations];
 const days=s.days.filter(d=>d.date>=f.asOf).map(d=>({...d,reservedExchangeCount:Number.isInteger(d.reservedExchangeCount)?d.reservedExchangeCount+allReservations.filter(a=>a.date===d.date).length:d.reservedExchangeCount}));
 const slots=s.slots.filter(t=>t.date>=f.asOf&&t.date>ready).map(t=>({...t,reserved:Array.isArray(t.reserved)?[...t.reserved,...allReservations.filter(a=>a.slotId===t.id).map(a=>({startMinute:a.startMinute,endMinute:a.endMinute,basis:a.eventId}))]:t.reserved}));
 const r=previewUpperSequence({...s,asOf:f.asOf,days,slots,groups:[g],pairedInputs:[{...original,asOf:f.asOf,members,replacementUsage,compatibility:plan.compatibility,assemblies:[]}],setupNightHistory:[...(s.setupNightHistory||[]),...s.days.filter(d=>d.date<f.asOf)]},api);
 base.third=r;
 if(!r.sequenceComplete)return hold('第3交換の停止枠・選択・適合未成立',{forecast:r.unresolved});
 return {...base,thirdRotationComplete:r.rollHandoverCandidates.length===1,thirdProjectedRoles:(r.rollHandoverCandidates[0]?.projectedRoles||[]).map(role=>({...role,forecastOnly:true})),forecastOnly:true};
}
module.exports={previewThirdUpperRotation,forecastDisposition,resolveDispositionLife};
