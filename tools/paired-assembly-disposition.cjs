'use strict';
// Anonymous PC planning only: independent physical reserve handovers after a joint exchange.
const {previewPairedLifecycle}=require('./paired-lifecycle-gate.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
function previewPairedAssemblyDisposition(input,api){
 const s=input||{},r=previewPairedLifecycle(s,api);
 const base={...r,handovers:[],dispositions:[],operationAuthorized:false,writeAllowed:false,annualComplete:false};
 if(r.status!=='conditional-pair-exchange')return base;
 const requests=Array.isArray(s.assemblies)?s.assemblies:[],roles=r.projectedRoles.map(x=>({...x}));
 const handovers=[],dispositions=[];
 for(const k of r.pair){
  const own=roles.filter(x=>String(x.stand)===k),old=own.find(x=>x.status==='used-standby'),target=own.find(x=>['rework','rework-ready','unassembled-return','new-unassembled'].includes(x.status)),life=r.individual.find(x=>x.stand===k);
  const req=requests.filter(x=>x&&String(x.stand)===k),a=req[0]||{},slot=a.slot||{},row=a.day||{},rec=a.receipt||{};
  const same=x=>x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
  const h={stand:k,oldIdentity:id(old),targetIdentity:id(target),status:'held',oldReserveRetained:true,emergencyReserveCount:1,actualCompletion:false};
  const held=reason=>handovers.push({...h,reason});
  // Procurement guidance is independent of physical handover; no order/admission is asserted.
  const d={stand:k,identity:id(old),kind:life.disposition,status:'held',actualDisposition:false,actualOrderDate:null,issueMonth:null};
  if(life.disposition==='successor-needed'){
   const lead=a.purchaseLead??{...api.defaultStandLeadTime(k),basis:'R12 provisional'};
   if(String(lead.standKey)===k&&Number.isInteger(lead.months)&&lead.months>0&&lead.months<=120&&['confirmed','provisional'].includes(lead.status)&&str(lead.basis)&&(a.purchaseLead==null||lead.sourceRevision===s.sourceRevision)){
    d.procurement={status:'forecast-guidance',latestArrivalBy:r.allocation.date,latestOrderBy:api.addMonths(r.allocation.date,-lead.months),leadMonths:lead.months,leadBasis:lead.basis,idealArrivalBy:null,idealOrderBy:null,actualReceiptDate:null,accountingMonth:null};
    d.status='successor-review'; // final-use start evidence not yet linked.
   }
  }
  dispositions.push(d);
  if(req.length!==1||!same(a)||a.oldIdentity!==id(old)||a.targetIdentity!==id(target)){held('組替対象・版未確認');continue;}
  if(!same(rec)||rec.identity!==id(target)||rec.status!=='actual'||!date(rec.date)||rec.date>s.asOf||rec.present!==true||rec.usable!==true||rec.unassembled!==true||!['unassembled-return','new-unassembled'].includes(target.status)){held('現物搬入・未組込の実績未確認');continue;}
  const prepared=target.status==='new-unassembled'?'newSide':'reworkInbound';
  if(!date(slot.date)||slot.date<s.asOf||slot.date<r.allocation.date||rec.date>=slot.date||slot.date===r.allocation.date&&slot.startHour*60<r.allocation.endMinute||slot.workArea!=='workshop'||row.date!==slot.date||row.dateRowVerified!==true||slot.owner?.rollId!==target.rollId||String(slot.owner?.standKey)!==k||slot.prepared!==prepared||slot.preparedTarget!==target.rollId||slot.preparedOn!==rec.date||!api.physicalAssemblySlotReady(slot,row).ok){held('交換後の工作枠・準備根拠未成立');continue;}
  if(a.sameDayCompletionPlanned!==true||a.targetEmergencyEligible!==true||a.safetyBlocked!==false||!str(a.completionBasis)||!str(a.nightBasis)||typeof row.nightOperating!=='boolean'){held('同日完了・夜勤条件未確認');continue;}
  // Shared capacity: overlapping reservations are not assumed independent.
  if(requests.some(b=>b!==a&&b?.slot?.date===slot.date&&Number.isFinite(b.slot.startHour)&&Number.isFinite(b.slot.endHour)&&b.slot.startHour<slot.endHour&&slot.startHour<b.slot.endHour)){held('工作枠重複・共有容量未確認');continue;}
  old.status=life.disposition==='rework-candidate'?'rework-ready':life.disposition==='successor-needed'?'retirement-review':'disposition-review';
  old.chockAssembled=false;old.emergencyEligible=false;
  target.status='new-standby';target.chockAssembled=true;target.emergencyEligible=true;
  handovers.push({...h,status:'conditional-assembly',date:slot.date,oldReserveRetained:false,reason:'同日引継ぎ予測'});
  if(life.disposition!=='rework-candidate')continue;
  const p=a.dispatchPlan||{};
  if(!same(p)||p.identity!==id(old)||p.status!=='planned'||!date(p.date)||p.date<=slot.date||!str(p.cycleId)||!Array.isArray(p.priorCycleIds)||p.priorCycleIds.some(x=>!str(x))||new Set(p.priorCycleIds).size!==p.priorCycleIds.length||p.priorCycleIds.includes(p.cycleId)||p.dispatchCapacityConfirmed!==true||p.vendorAcceptanceConfirmed!==true)continue;
  const ov=p.leadOverride;
  if(ov!==undefined&&(!ov||String(ov.stand)!==k||!Number.isInteger(ov.days)||ov.days<=0||!str(ov.basis)||ov.sourceRevision!==s.sourceRevision))continue;
  const days=ov===undefined?api.provisionalReworkCalendarDays(k):ov.days;
  if(!Number.isInteger(days)||days<=0)continue;
  const inbound=api.addDays(p.date,days);if(!date(inbound)||inbound<=p.date)continue;
  d.status='conditional-rework';d.rework={cycleId:p.cycleId,dispatchDate:p.date,leadDays:days,expectedInboundDate:inbound,plannedReworkCostMonth:inbound.slice(0,7),actualInboundDate:null,receiptConfirmed:false,basis:p.basis};
  // Keep post-assembly state separate from later dispatch forecast.
 }
 return {...base,projectedRoles:roles,handovers,dispositions,bothHandoversPlanned:handovers.every(x=>x.status==='conditional-assembly'),emergencyReserveByStand:Object.fromEntries(r.pair.map(k=>[k,1])),futurePairReview:r.futurePairReview||handovers.some(x=>x.status!=='conditional-assembly'),actualAdmission:false,actualRetired:false};
}
module.exports={previewPairedAssemblyDisposition};
