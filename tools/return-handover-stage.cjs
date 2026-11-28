'use strict';
// Reusable conditional return/assembly stage, independent of the rotation number.
const {inspectUpperLedger}=require('./caliber-lifetime-policy.cjs');
const {previewThirdUpperRotation,forecastDisposition}=require('./third-upper-rotation.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const interval=x=>x&&day(x.date)&&Number.isFinite(x.startHour)&&Number.isFinite(x.endHour)&&x.startHour>=0&&x.endHour<=22&&x.endHour>x.startHour;
const copy=x=>JSON.parse(JSON.stringify(x));
function previewReturnHandover(s,stage,plan,api){
 const roles=copy(stage?.roles||[]),held=[],handovers=[],returns=[],dispositions=[],allocations=[];
 const out={roles,held,handovers,returns,dispositions,allocations,complete:false,forecastOnly:true,actualReceipt:false,actualAssembly:false,operationAuthorized:false,writeAllowed:false};
 const e=stage?.event,g=stage?.group,ks=g?.stands||[],busy=copy(stage?.busy||[]),cycles=[...(stage?.priorCycles||[])];
 const fail=reason=>{held.push({reason});return out;};
 if(s.anonymousOnly!==true||!same(s,plan)||!day(s.asOf)||!day(s.throughDate)||!day(e?.date)||e.date<s.asOf||e.date>s.throughDate||!Number.isFinite(e.endMinute)||!['6,7','8,9','10,11'].includes(ks.join(','))||roles.length!==6||new Set(roles.map(id)).size!==6||!Array.isArray(plan.returnMasters)||!Array.isArray(plan.workshopOptions)||!Array.isArray(plan.members)||!Array.isArray(plan.dispatchPlans)||s.workshopReservationsVerified!==true||!str(s.workshopReservationBasis)||!Array.isArray(stage.busy)||busy.some(b=>!interval(b))||!Array.isArray(stage.priorCycles)||new Set(cycles).size!==cycles.length||!Array.isArray(stage.dispositions))return fail('交換・工作予約・回次・期間の根拠未確認');
 const find=(arr,k)=>{const a=arr.filter(x=>String(x?.standKey??x?.stand)===k);return a.length===1?a[0]:null;};
 for(const k of ks){
  const own=roles.filter(r=>String(r.stand)===k),old=own.find(r=>r.status==='used-standby'),online=own.find(r=>r.status==='online'),target=own.find(r=>r.status==='rework'),d=find(stage.dispositions,k),m=find(plan.returnMasters,k),q=find(plan.members,k),dispatch=find(plan.dispatchPlans,k);
  const retain=reason=>held.push({stand:k,reason,oldReserveRetained:!!old?.emergencyEligible&&!!old?.chockAssembled});
  if(own.length!==3||!old||!online||!target||new Set(own.map(r=>r.rollId)).size!==3||old.emergencyEligible!==true||old.chockAssembled!==true||!d?.rework||d.status!=='conditional-rework'||d.identity!==id(target)||d.rework.receiptConfirmed!==false||!cycles.includes(d.rework.cycleId)||!same(s,m)||m.status!=='forecast'||m.cycleId!==d.rework.cycleId||m.oldIdentity!==id(target)||m.rollId!==target.rollId||!str(m.generation)||m.generation===target.generation||m.identity!==JSON.stringify([k,target.rollId,m.generation])||m.expectedInboundDate!==d.rework.expectedInboundDate||m.diameterMm!==d.rework.forecastDiameterMm||!day(m.expectedInboundDate)||m.expectedInboundDate<=s.asOf||!Array.isArray(m.caliberLedger?.calibers)||m.caliberLedger.calibers.some(c=>!['active','unused','unavailable'].includes(c.state)||c.tons!==0&&c.tons!==null||c.runs!==0&&c.runs!==null)||inspectUpperLedger(s,m,g.size,api).status!=='verified-ledger'){retain('改削戻りの新世代・個体・全カリバ未確認');continue;}
  const ret={stand:k,oldIdentity:id(target),newIdentity:m.identity,cycleId:m.cycleId,date:m.expectedInboundDate,diameterMm:m.diameterMm,caliberLedger:copy(m.caliberLedger),status:'conditional-return',initialCycleProgress:0,progressTotal:6,actualReceipt:false,emergencyEligible:false};
  returns.push(ret);
  const options=plan.workshopOptions.filter(o=>{
   const t=o?.slot,row=o?.day;
   if(!same(s,o)||String(o.stand)!==k||o.oldIdentity!==id(old)||o.targetIdentity!==m.identity||o.cycleId!==m.cycleId||o.receiptStatus!=='forecast'||o.sameDayCompletionPlanned!==true||o.targetEmergencyEligible!==true||o.safetyBlocked!==false||!str(o.completionBasis)||!str(o.nightBasis)||!interval(t)||t.workArea!=='workshop'||t.date<=ret.date||t.date>s.throughDate||t.date<e.date||t.date===e.date&&t.startHour*60<e.endMinute||String(t.owner?.standKey)!==k||t.owner?.rollId!==target.rollId||t.prepared!=='reworkInbound'||t.preparedTarget!==target.rollId||t.preparedOn!==ret.date||!row||row.date!==t.date||row.dateRowVerified!==true||typeof row.nightOperating!=='boolean'||!api.physicalAssemblySlotReady(t,row).ok)return false;
   const rows=(s.workshopDays||[]).filter(r=>r.date===t.date);
   return rows.length===1&&same(s,rows[0])&&rows[0].workshopWorking===true&&rows[0].dateRowVerified===true&&rows[0].productionAmount===row.productionAmount&&rows[0].nightOperating===row.nightOperating&&!busy.some(b=>b.date===t.date&&b.startHour<t.endHour&&t.startHour<b.endHour);
  }).sort((a,b)=>a.slot.date.localeCompare(b.slot.date)||a.slot.startHour-b.slot.startHour);
  const o=options[0];
  if(!o){retain('現物見込み後の同日組替・共通枠未成立');continue;}
  const h={stand:k,date:o.slot.date,oldIdentity:id(old),targetIdentity:m.identity,status:'conditional-on-future-receipt',forecastOnly:true,actualCompletion:false,receiptConfirmed:false,emergencyReserveCount:1,basis:o.basis};
  handovers.push(h);const a={...h,startHour:o.slot.startHour,endHour:o.slot.endHour};allocations.push(a);busy.push(a);
  Object.assign(old,{status:'disposition-review',forecastOnly:true,chockAssembled:false,emergencyEligible:false});
  Object.assign(target,{generation:m.generation,diameterMm:m.diameterMm,status:'new-standby',forecastOnly:true,chockAssembled:true,emergencyEligible:true,conditionalAssembly:true});
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
module.exports={previewReturnHandover,previewThirdWorkshop};
