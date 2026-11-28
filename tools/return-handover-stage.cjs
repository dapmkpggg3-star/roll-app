'use strict';
// Reusable conditional return/assembly stage, independent of the rotation number.
const {previewWorkshopDeadline}=require('./workshop-deadline.cjs');
const {inspectUpperLedger}=require('./caliber-lifetime-policy.cjs');
const {previewThirdUpperRotation,forecastDisposition,resolveDispositionLife}=require('./third-upper-rotation.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const interval=x=>x&&day(x.date)&&Number.isFinite(x.startHour)&&Number.isFinite(x.endHour)&&x.startHour>=0&&x.endHour<=22&&x.endHour>x.startHour;
const copy=x=>JSON.parse(JSON.stringify(x));
// Deadline instructions are not time reservations. Internal forecast dates
// may coincide across different rolls; never infer actual staffing or completion.
function workshopTimeConflict(plan,busy,t){
 if(plan?.deadlineMode===true)return false;
 return busy.some(b=>b.date===t.date&&b.startHour<t.endHour&&t.startHour<b.endHour);
}
function previewReturnHandover(s,stage,plan,api){
 const roles=copy(stage?.roles||[]),held=[],handovers=[],returns=[],dispositions=[],allocations=[],purchases=[];
 const workshopInstructions=[];
 const out={roles,held,handovers,returns,dispositions,allocations,purchases,workshopInstructions,deadlineMode:plan?.deadlineMode===true,complete:false,forecastOnly:true,actualReceipt:false,actualAssembly:false,operationAuthorized:false,writeAllowed:false};
 const e=stage?.event,g=stage?.group,ks=g?.stands||[],busy=copy(stage?.busy||[]),cycles=[...(stage?.priorCycles||[])];
 const fail=reason=>{held.push({reason});return out;};
 if(s.anonymousOnly!==true||!same(s,plan)||!day(s.asOf)||!day(s.throughDate)||!day(e?.date)||e.date<s.asOf||e.date>s.throughDate||!Number.isFinite(e.endMinute)||!['6,7','8,9','10,11'].includes(ks.join(','))||roles.length!==6||new Set(roles.map(id)).size!==6||!Array.isArray(plan.returnMasters)||!Array.isArray(plan.workshopOptions)||!Array.isArray(plan.members)||!Array.isArray(plan.dispatchPlans)||s.workshopReservationsVerified!==true||!str(s.workshopReservationBasis)||!Array.isArray(stage.busy)||busy.some(b=>!interval(b))||!Array.isArray(stage.priorCycles)||new Set(cycles).size!==cycles.length||!Array.isArray(stage.dispositions))return fail('交換・工作予約・回次・期間の根拠未確認');
 const find=(arr,k)=>{const a=arr.filter(x=>String(x?.standKey??x?.stand)===k);return a.length===1?a[0]:null;};
 for(const k of ks){
  const own=roles.filter(r=>String(r.stand)===k),old=own.find(r=>r.status==='used-standby'),online=own.find(r=>r.status==='online'),target=own.find(r=>r.status==='rework'||r.status==='new-unassembled'&&r.purchaseSuccessor===true),d=find(stage.dispositions,k),m=find(plan.returnMasters,k),q=find(plan.members,k),dispatch=find(plan.dispatchPlans,k);
  const retain=reason=>held.push({stand:k,reason,oldReserveRetained:!!old?.emergencyEligible&&!!old?.chockAssembled});
  const purchased=target?.status==='new-unassembled',ad=purchased?find(stage.admissions||[],k):null;
  if(own.length!==3||!old||!online||!target||new Set(own.map(r=>r.rollId)).size!==3||old.emergencyEligible!==true||old.chockAssembled!==true||(!purchased&&(!d?.rework||d.status!=='conditional-rework'||d.identity!==id(target)||d.rework.receiptConfirmed!==false||!cycles.includes(d.rework.cycleId)||!same(s,m)||m.status!=='forecast'||m.cycleId!==d.rework.cycleId||m.oldIdentity!==id(target)||m.rollId!==target.rollId||!str(m.generation)||m.generation===target.generation||m.identity!==JSON.stringify([k,target.rollId,m.generation])||m.expectedInboundDate!==d.rework.expectedInboundDate||m.diameterMm!==d.rework.forecastDiameterMm||!day(m.expectedInboundDate)||m.expectedInboundDate<=s.asOf))||!same(s,m)||!Array.isArray(m.caliberLedger?.calibers)||m.caliberLedger.calibers.some(c=>!['active','unused','unavailable'].includes(c.state)||c.tons!==0&&c.tons!==null||c.runs!==0&&c.runs!==null)||inspectUpperLedger(s,m,g.size,api).status!=='verified-ledger'){retain('改削戻りの新世代・個体・全カリバ未確認');continue;}
  if(purchased&&(!ad||ad.status!=='conditional-slot-replacement'||ad.newIdentity!==id(target)||ad.actualAdmission!==false||ad.actualReceipt!==false||ad.master?.identity!==m.identity||m.identity!==id(target)||m.status!=='new-purchase-forecast'||m.diameterMm!==target.diameterMm||JSON.stringify(ad.master.caliberLedger)!==JSON.stringify(m.caliberLedger)||!day(ad.date)||!day(ad.expectedReceiptDate)||ad.date>e.date||ad.expectedReceiptDate>ad.date)){retain('新品後継の受入・個体台帳未確認');continue;}
  const receiptDate=purchased?ad.expectedReceiptDate:m.expectedInboundDate;
  const ret={stand:k,oldIdentity:id(target),newIdentity:m.identity,cycleId:m.cycleId,date:receiptDate,diameterMm:m.diameterMm,caliberLedger:copy(m.caliberLedger),status:'conditional-return',initialCycleProgress:0,progressTotal:6,actualReceipt:false,emergencyEligible:false};
  if(purchased)purchases.push({...ret,oldIdentity:null,status:'conditional-purchase-receipt',initialCycleProgress:null});else returns.push(ret);
  const options=plan.workshopOptions.filter(o=>{
   const t=o?.slot,row=o?.day;
   if(!same(s,o)||String(o.stand)!==k||o.oldIdentity!==id(old)||o.targetIdentity!==m.identity||(purchased?o.cycleId!=null||o.purchaseAdmissionDate!==ad.date:o.cycleId!==m.cycleId)||o.receiptStatus!=='forecast'||o.sameDayCompletionPlanned!==true||o.targetEmergencyEligible!==true||o.safetyBlocked!==false||!str(o.completionBasis)||!str(o.nightBasis)||!interval(t)||t.workArea!=='workshop'||t.date<=ret.date||purchased&&t.date<ad.date||t.date>s.throughDate||t.date<e.date||t.date===e.date&&t.startHour*60<e.endMinute||String(t.owner?.standKey)!==k||t.owner?.rollId!==target.rollId||t.prepared!==(purchased?'newSide':'reworkInbound')||t.preparedTarget!==target.rollId||t.preparedOn!==ret.date||!row||row.date!==t.date||row.dateRowVerified!==true||typeof row.nightOperating!=='boolean'||!api.physicalAssemblySlotReady(t,row).ok)return false;
   const rows=(s.workshopDays||[]).filter(r=>r.date===t.date);
   return rows.length===1&&same(s,rows[0])&&rows[0].workshopWorking===true&&rows[0].dateRowVerified===true&&rows[0].productionAmount===row.productionAmount&&rows[0].nightOperating===row.nightOperating&&!workshopTimeConflict(plan,busy,t);
  }).sort((a,b)=>a.slot.date.localeCompare(b.slot.date)||a.slot.startHour-b.slot.startHour);
  // Explicit R23 preview mode; legacy fixtures remain internal forecasts.
  let eligibleOptions=options;
  if(plan.deadlineMode===true){
   const spec=find(Array.isArray(plan.deadlineInputs)?plan.deadlineInputs:[],k);
   const life=resolveDispositionLife(s,old,q,e,cycles,api);
   const retiring=life.status==='final-use';
   const lead=dispatch?.leadOverride?.days??api.provisionalReworkCalendarDays(k);
   if(!same(s,spec)||spec.oldIdentity!==id(old)||spec.targetIdentity!==m.identity||life.status==='held'||life.status==='boundary-review'||(!retiring&&(!same(s,dispatch)||dispatch.identity!==id(old)||dispatch.status!=='planned'||!day(dispatch.date)||spec.leadDays!==lead))){retain('R23期限・個体・搬出根拠未確認');continue;}
   const deadline=previewWorkshopDeadline({...spec,dispositionKind:retiring?'retirement':'rework',asOf:e.date,roles:[
    {rollId:online.rollId,status:'online'},
    {rollId:old.rollId,status:'used-standby',assembled:old.chockAssembled,emergencyEligible:old.emergencyEligible},
    {rollId:target.rollId,status:purchased?'new-unassembled':'rework-in-progress',availableDate:receiptDate,receiptKind:'forecast',receiptBasis:m.basis}
   ],verifiedWorkDays:options.map(o=>({date:o.slot.date,workshopWorking:true,sameDayHandover:true,safetyConfirmed:true,basis:o.basis}))});
   if(deadline.status!=='conditional-deadline'||(!retiring&&dispatch.date>deadline.dispatchDeadline)){workshopInstructions.push({stand:k,...deadline,status:'held',warnings:[...deadline.warnings,...(!retiring&&dispatch.date>deadline.dispatchDeadline&&deadline.dispatchDeadline?['搬出予定が期限超過']:[])]});retain('R23期限内成立せず');continue;}
   eligibleOptions=options.filter(o=>o.slot.date<=deadline.assemblyDeadline&&o.slot.date<spec.nextExchangeDeadline&&(retiring||(o.slot.date<dispatch.date&&api.addDays(o.slot.date,spec.preDispatchDays)<=dispatch.date)));
   workshopInstructions.push({stand:k,...deadline,status:eligibleOptions.length?'conditional-deadline':'held',warnings:eligibleOptions.length?deadline.warnings:[...deadline.warnings,'搬出予定と組替候補が不整合']});
   if(!eligibleOptions.length){retain('R23期限内の実行可能性未確認');continue;}
  }
  const o=eligibleOptions[0];
  if(!o){retain('現物見込み後の同日組替・共通枠未成立');continue;}
  const h={stand:k,date:o.slot.date,oldIdentity:id(old),targetIdentity:m.identity,status:'conditional-on-future-receipt',forecastOnly:true,actualCompletion:false,receiptConfirmed:false,emergencyReserveCount:1,basis:o.basis};
  handovers.push(h);const a={...h,startHour:o.slot.startHour,endHour:o.slot.endHour};allocations.push(a);if(plan.deadlineMode!==true)busy.push(a);
  Object.assign(old,{status:'disposition-review',forecastOnly:true,chockAssembled:false,emergencyEligible:false});
  Object.assign(target,{generation:m.generation,diameterMm:m.diameterMm,status:'new-standby',forecastOnly:true,chockAssembled:true,emergencyEligible:true,conditionalAssembly:true});
  if(purchased){target.purchaseAssemblyDate=o.slot.date;target.purchaseAdmissionDate=ad.date;target.purchaseOriginIdentity=m.identity;}else if(target.purchaseSuccessor===true){target.purchaseReworked=true;}
  const disposition=forecastDisposition(s,old,q,e,h,dispatch,cycles,api);dispositions.push(disposition);
  if(disposition.rework){cycles.push(disposition.rework.cycleId);old.status='rework-ready';}
  else if(disposition.kind==='successor-needed')old.status='retirement-review';
  else retain('次回改削・購入処遇未成立');
 }
 return {...out,busy,priorCycles:cycles,conditionalHandoverComplete:handovers.length===ks.length,readyForNextRotation:held.length===0&&handovers.length===ks.length&&dispositions.every(d=>!!d.rework)};
}
function previewThirdWorkshop(input,api){
 const s=input||{},third=previewThirdUpperRotation(s,api);
 if(!third.thirdRotationComplete)return {third,stage:null,forecastOnly:true,annualComplete:false,operationAuthorized:false,writeAllowed:false};
 const stage=previewReturnHandover(s,{roles:third.thirdProjectedRoles,event:third.third.events.find(e=>e.rollChanged),group:third.third.ending[0].group,busy:[...(s.workshopReserved||[]),...third.second.first.allocations,...third.second.nextHandovers],priorCycles:[...third.second.first.dispositions,...third.dispositions].flatMap(d=>d.rework?[d.rework.cycleId]:[]),dispositions:third.dispositions},s.thirdWorkshop,api);
 return {third,stage,forecastOnly:true,annualComplete:false,operationAuthorized:false,writeAllowed:false};
}
module.exports={previewReturnHandover,previewThirdWorkshop,workshopTimeConflict};
