'use strict';
// R01/R11/R12/R13: separate conditional annual state from actual observations.
const {previewSequenceWorkshop}=require('./shared-workshop-handover.cjs');
const {previewUpperSequence}=require('./repeated-upper-caliber.cjs');
const {inspectUpperLedger}=require('./caliber-lifetime-policy.cjs');
const {assessDiameterLife}=require('./annual-diameter-gate.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const copy=x=>JSON.parse(JSON.stringify(x));
function previewSecondUpperCycle(input,api){
 const s=input||{},first=previewSequenceWorkshop(s,api),returns=[],held=[],nextHandovers=[],projectedRoles=[];
 const base={status:'conditional-second-upper-cycle',first,returns,held,nextHandovers,projectedRoles,second:null,complete:false,annualComplete:false,operationAuthorized:false,writeAllowed:false,actualReceipt:false,actualAssembly:false,scope:'one upstream pair, two physical exchanges; all future states conditional'};
 const hold=(reason,extra={})=>{held.push({reason,...extra});return base;};
 if(s.anonymousOnly!==true||s.groups?.length!==1||!first.sequence.sequenceComplete||first.sequence.rollHandoverCandidates.length!==1)return hold('単一上流ペアの初回交換未成立');
 const f=first.sequence.ending[0],g=f.group,oldEvent=first.sequence.events.find(e=>e.rollChanged),original=s.pairedInputs?.[0];
 if(!oldEvent||f.status!=='first-roll-change'||!original||!first.workshopComplete||first.allocations.length!==2||first.projectedRoles.length!==6)return hold('初回ロール替後の新品予備引継ぎ未成立');
 const plan=s.secondCycle;
 if(!same(s,plan)||!day(plan.throughDate)||plan.throughDate!==s.throughDate||!Array.isArray(plan.members)||plan.members.length!==2||!Array.isArray(plan.returnMasters)||!Array.isArray(plan.workshopOptions))return hold('次循環の個体・版・予測マスター未確認');
 const ready=first.allocations.map(a=>a.date).sort().at(-1),members=[],replacementUsage=[];
 for(const k of g.stands){
  const own=first.projectedRoles.filter(r=>String(r.stand)===k),online=own.find(r=>r.status==='online'),spare=own.find(r=>r.status==='new-standby'),old=own.find(r=>r.status==='rework-ready'),m=plan.members.filter(m=>String(m?.stand)===k),q=m[0],d=first.dispositions.find(d=>d.stand===k),orig=original.members.find(m=>String(m.stand)===k);
  if(own.length!==3||!online||!spare||!old||!d?.rework||d.identity!==id(old)||m.length!==1||!same(s,q)||q.onlineIdentity!==id(online)||q.replacementIdentity!==id(spare)||q.diameter?.identity!==id(online)||q.diameter?.currentMm!==online.diameterMm||!day(q.diameter?.measuredDate)||q.diameter.measuredDate>s.asOf)return hold('次回旧新個体・初回改削・現径根拠未確認 #'+k);
  const life=assessDiameterLife({...s,diameter:orig.diameter,history:orig.diameterHistory}),nextLife=assessDiameterLife({...s,diameter:q.diameter,history:q.diameterHistory});
  if(life.status!=='rework-candidate'||nextLife.status==='held')return hold('個体径・廃却径未確認 #'+k);
  const rr=plan.returnMasters.filter(r=>String(r?.standKey)===k),r=rr[0];
  if(rr.length!==1||!same(s,r)||r.status!=='forecast'||r.cycleId!==d.rework.cycleId||r.oldIdentity!==id(old)||r.rollId!==old.rollId||!str(r.generation)||r.generation===old.generation||r.caliberLedger?.identity!==JSON.stringify([k,r.rollId,r.generation])||r.diameterMm!==life.nextDiameter||r.expectedInboundDate!==d.rework.expectedInboundDate||r.caliberLedger?.calibers?.some(c=>!['active','unused','unavailable'].includes(c.state)||c.tons!==0&&c.tons!==null||c.runs!==0&&c.runs!==null))return hold('改削後の新世代・予定径・個別カリバ根拠未確認 #'+k);
  const l=inspectUpperLedger(s,r,g.size,api),u=q.replacementUsage;
  if(l.status!=='verified-ledger'||!same(s,u)||u.rollId!==spare.rollId||u.generation!==spare.generation||u.identity!==id(spare)||inspectUpperLedger(s,u,g.size,api).status!=='verified-ledger')return hold('改削後または次回新品カリバ台帳未成立 #'+k);
  returns.push({stand:k,cycleId:r.cycleId,oldIdentity:id(old),newIdentity:r.caliberLedger.identity,date:r.expectedInboundDate,diameterMm:r.diameterMm,caliberLedger:copy(r.caliberLedger),oldCaliberLedger:copy(oldEvent.oldGroup.members.find(m=>m.standKey===k).caliberLedger),progress:0,progressTotal:6,status:'conditional-return',actualReceipt:false,chockAssembled:false,emergencyEligible:false});
  members.push({stand:k,roles:[{...online},{...spare,conditionalAssembly:true},{...old,status:'rework'}],diameter:q.diameter,diameterHistory:q.diameterHistory});
  replacementUsage.push(u);
 }
 const ctx={...original,asOf:f.asOf,members,replacementUsage,compatibility:plan.compatibility,assemblies:[]};
 // Continue usage from first exchange, but don't allocate a second roll change before both planned standby assemblies.
 const days=s.days.filter(d=>d.date>=f.asOf).map(d=>({...d,reservedExchangeCount:Number.isInteger(d.reservedExchangeCount)?d.reservedExchangeCount+first.sequence.reservations.filter(a=>a.date===d.date).length:d.reservedExchangeCount}));
 const slots=s.slots.filter(t=>t.date>=f.asOf&&t.date>ready).map(t=>({...t,reserved:Array.isArray(t.reserved)?[...t.reserved,...first.sequence.reservations.filter(a=>a.slotId===t.id).map(a=>({startMinute:a.startMinute,endMinute:a.endMinute,basis:a.eventId}))]:t.reserved}));
 const second=previewUpperSequence({...s,asOf:f.asOf,days,slots,groups:[g],pairedInputs:[ctx],setupNightHistory:[...(s.setupNightHistory||[]),...s.days.filter(d=>d.date<f.asOf)]},api);
 base.second=second;
 const e=second.events.find(e=>e.rollChanged),candidate=second.rollHandoverCandidates[0];
 if(!second.sequenceComplete||!e||!candidate)return hold('次回ロール替未成立・需要を保持',{forecast:second.unresolved});
 const busy=[...(s.workshopReserved||[]),...first.allocations],options=plan.workshopOptions;
 for(const k of g.stands){
  const own=candidate.projectedRoles.filter(r=>String(r.stand)===k),old=own.find(r=>r.status==='used-standby'),online=own.find(r=>r.status==='online'),third=own.find(r=>r.status==='rework'),ret=returns.find(r=>r.stand===k),master=plan.returnMasters.find(r=>String(r.standKey)===k);
  if(!old||!online||!third||id(third)!==ret.oldIdentity)return hold('次回物理役割不一致 #'+k);
  const newThird={...third,generation:master.generation,diameterMm:ret.diameterMm,status:'unassembled-return',forecastOnly:true,chockAssembled:false,emergencyEligible:false};
  const available=options.filter(o=>{
   const slot=o?.slot,row=o?.day;
   if(!same(s,o)||String(o.stand)!==k||o.oldIdentity!==id(old)||o.targetIdentity!==ret.newIdentity||o.cycleId!==ret.cycleId||o.receiptStatus!=='forecast'||o.sameDayCompletionPlanned!==true||o.targetEmergencyEligible!==true||o.safetyBlocked!==false||!str(o.completionBasis)||!str(o.nightBasis)||!slot||slot.workArea!=='workshop'||!day(slot.date)||slot.date<=ret.date||slot.date<e.date||slot.date===e.date&&slot.startHour*60<e.endMinute||slot.owner?.rollId!==third.rollId||String(slot.owner?.standKey)!==k||slot.prepared!=='reworkInbound'||slot.preparedTarget!==third.rollId||slot.preparedOn!==ret.date||!row||row.date!==slot.date||row.dateRowVerified!==true||typeof row.nightOperating!=='boolean'||!api.physicalAssemblySlotReady(slot,row).ok)return false;
   const rows=(s.workshopDays||[]).filter(d=>d.date===slot.date);
   return rows.length===1&&same(s,rows[0])&&rows[0].workshopWorking===true&&rows[0].dateRowVerified===true&&rows[0].productionAmount===row.productionAmount&&rows[0].nightOperating===row.nightOperating&&!busy.some(b=>b.date===slot.date&&b.startHour<slot.endHour&&slot.startHour<b.endHour);
  }).sort((a,b)=>a.slot.date.localeCompare(b.slot.date)||a.slot.startHour-b.slot.startHour);
  const o=available[0];
  if(!o){held.push({stand:k,reason:'次回予測搬入・同日組替枠未成立',oldReserveRetained:true});projectedRoles.push({...old,forecastOnly:true},{...online,forecastOnly:true},ret.date<=e.date?newThird:{...third,forecastOnly:true});continue;}
  busy.push(o.slot);
  nextHandovers.push({stand:k,date:o.slot.date,oldIdentity:id(old),targetIdentity:ret.newIdentity,status:'conditional-on-future-receipt',actualCompletion:false,emergencyReserveCount:1,receiptConfirmed:false});
  projectedRoles.push({...old,status:'disposition-review',forecastOnly:true,chockAssembled:false,emergencyEligible:false},{...online,forecastOnly:true},{...newThird,status:'new-standby',chockAssembled:true,emergencyEligible:true,conditionalAssembly:true});
 }
 return {...base,conditionalCycleComplete:held.length===0&&nextHandovers.length===2};
}
module.exports={previewSecondUpperCycle};
