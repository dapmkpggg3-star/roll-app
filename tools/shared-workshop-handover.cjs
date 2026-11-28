'use strict';
// Anonymous PC-only shared workshop allocation after a verified physical pathline replay.
const {previewWorkshopDeadline}=require('./workshop-deadline.cjs');
const {assessDiameterLife}=require('./annual-diameter-gate.cjs');
const {previewSingleAllocated,previewSingleDisposition}=require('./shared-single-exchange.cjs');
const {previewAllocatedPathline}=require('./allocated-pathline-replay.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const overlap=(a,b)=>a.date===b.date&&a.startHour<b.endHour&&b.startHour<a.endHour;
const interval=x=>x&&date(x.date)&&Number.isFinite(x.startHour)&&Number.isFinite(x.endHour)&&x.startHour>=0&&x.endHour<=22&&x.endHour>x.startHour;
const copy=x=>JSON.parse(JSON.stringify(x));
// A completion deadline is not a reservation of workshop personnel.
function selectWorkshopOptions(s,options,busy,eligible,target){
 const deadline=s.workshopDeadlineMode===true;
 if(deadline&&!date(target))return [];
 return options.filter(o=>eligible(o)&&(!deadline||o.request.slot.date<=target)&&(deadline||!busy.some(b=>overlap(b,o.request.slot)))).sort((a,b)=>a.request.slot.date.localeCompare(b.request.slot.date)||a.request.slot.startHour-b.request.slot.startHour);
}
function deriveInitialDeadline(s,d,options,api){
 const specs=(Array.isArray(s.workshopDeadlineInputs)?s.workshopDeadlineInputs:[]).filter(x=>x?.demandId===d.a.id&&String(x.stand)===d.k);
 const same=x=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
 const spec=specs[0],fail=reason=>({status:'held',assemblyDeadline:null,workDate:null,actualCompletion:false,warnings:[reason]});
 if(specs.length!==1||!same(spec)||spec.oldIdentity!==id(d.old)||spec.targetIdentity!==id(d.target))return fail('期限・個体根拠未確認');
 const life=d.single?.life??assessDiameterLife({...s,diameter:d.q?.members.find(m=>String(m.stand)===d.k)?.diameter,history:d.q?.members.find(m=>String(m.stand)===d.k)?.diameterHistory});
 if(!['final-use','rework-candidate'].includes(life?.status))return fail('廃却・改削判定未確認');
 const retiring=life.status==='final-use';
 const valid=options.filter(o=>{
  const p=o.request.dispatchPlan,ov=p?.leadOverride;
  if(retiring)return true;
  const lead=ov===undefined?api.provisionalReworkCalendarDays(d.k):ov?.days;
  return same(p)&&p.identity===id(d.old)&&p.status==='planned'&&date(p.date)&&spec.leadDays===lead&&(ov===undefined||(ov&&String(ov.stand)===d.k&&ov.sourceRevision===s.sourceRevision&&str(ov.basis)))&&p.dispatchCapacityConfirmed===true&&p.vendorAcceptanceConfirmed===true;
 });
 if(!valid.length)return fail('搬出予定・現物根拠未確認');
 const rec=valid[0].request.receipt;
 if(valid.some(o=>o.request.receipt.date!==rec.date))return fail('搬入根拠不一致');
 const result=previewWorkshopDeadline({...spec,asOf:d.a.date,dispositionKind:retiring?'retirement':'rework',roles:[{rollId:d.next.rollId,status:'online'},{rollId:d.old.rollId,status:'used-standby',assembled:d.old.chockAssembled,emergencyEligible:d.old.emergencyEligible},{rollId:d.target.rollId,status:d.target.status,availableDate:rec.date,receiptKind:'actual',receiptBasis:rec.basis}],verifiedWorkDays:valid.map(o=>({date:o.request.slot.date,workshopWorking:true,sameDayHandover:true,safetyConfirmed:true,basis:o.basis}))});
 const candidates=result.status==='conditional-deadline'?valid.filter(o=>o.request.slot.date<=result.assemblyDeadline&&o.request.slot.date<spec.nextExchangeDeadline&&(retiring||(o.request.dispatchPlan.date<=result.dispatchDeadline&&o.request.slot.date<o.request.dispatchPlan.date&&api.addDays(o.request.slot.date,spec.preDispatchDays)<=o.request.dispatchPlan.date))):[];
 return {...result,status:candidates.length?'conditional-deadline':'held',warnings:candidates.length?result.warnings:[...result.warnings,'期限内の搬出・組替候補未成立'],candidates};
}
function runSharedWorkshop(input,api,preview){
 const s=input||{},p=preview(s,api),allocations=[],held=[],dispositions=[],projectedRoles=[],warnings=[];
 const deadlineMode=s.workshopDeadlineMode===true,workshopInstructions=[];
 const base={status:'shared-workshop-preview',allocations,held,dispositions,projectedRoles,warnings,workshopInstructions,deadlineMode,complete:false,annualComplete:false,operationAuthorized:false,writeAllowed:false};
 const same=x=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
 const pairs=Array.isArray(s.pairedInputs)?s.pairedInputs:[],options=Array.isArray(s.workshopOptions)?s.workshopOptions:[],manual=Array.isArray(s.workshopReserved)?s.workshopReserved:null;
 const events=p.pathlineEvents.filter(e=>['allocated-pair-pathline-preview','allocated-single-pathline-preview'].includes(e.type));
 const demand=[];
 for(const a of p.allocations.filter(a=>a.workType==='rollChange')){
  if(a.stands.length===1&&['2','3','4','5','16','17'].includes(a.stands[0])){
   const k=a.stands[0],r=previewSingleAllocated(s,a,api),upstream=+k<=5,event=events.find(e=>e.id===a.id&&e.date===a.date&&e.startMinute===a.startMinute&&e.endMinute===a.endMinute),prefix=p.replays.find(x=>x.id===a.id);
   if(r.status!=='conditional-single-replay'||(upstream?!(prefix?.usageAtAllocatedDate?.some(u=>u.rollId===JSON.parse(r.oldIdentity)[1])):!event)){held.push({demandId:a.id,stands:a.stands,reason:'単独個体・使用量またはパスライン未確認',oldReserveRetained:null});continue;}
   const old=r.projectedRoles.find(x=>x.status==='used-standby'),next=r.projectedRoles.find(x=>x.status==='online'),target=r.projectedRoles.find(x=>x!==old&&x!==next);
   demand.push({a,k,old,next,target,single:r,key:a.id+'|'+k});continue;
  }
  const paired=pairs.filter(q=>q&&a.stands.includes(String(q.stand)));
  if(paired.length!==1){held.push({demandId:a.id,stands:a.stands,reason:'単独等の物理引継ぎ未接続',oldReserveRetained:null});continue;}
  const q=paired[0],upstream=a.stands.every(k=>+k<=11),event=(upstream?(p.upstreamPairReplays||[]).filter(e=>e.status==='conditional-upstream-pair-preview'):events).find(e=>e.id===a.id&&e.date===a.date&&e.startMinute===a.startMinute&&e.endMinute===a.endMinute);
  if(!event){held.push({demandId:a.id,stands:a.stands,reason:'交換後パスライン未成立・後続計画保留',oldReserveRetained:null});continue;}
  for(const k of a.stands){
   const m=q.members.find(m=>String(m.stand)===k),old=m?.roles.find(r=>r.status==='online'),next=m?.roles.find(r=>r.status==='new-standby'),target=m?.roles.find(r=>r!==old&&r!==next);
   if(!old||!next||!target||event.oldIdentities[k]!==id(old)||event.newIdentities[k]!==id(next)){held.push({demandId:a.id,stand:k,reason:'旧新個体不一致',oldReserveRetained:null});continue;}
   demand.push({a,q,k,old,next,target,upstream,key:a.id+'|'+k});
  }
 }
 const retain=(d,reason)=>{held.push({demandId:d.a.id,stand:d.k,oldIdentity:id(d.old),targetIdentity:id(d.target),reason,oldReserveRetained:true,emergencyReserveCount:1});};
 // Require a confirmed reservation snapshot, even if explicitly empty.
 const reservationsOK=s.workshopReservationsVerified===true&&str(s.workshopReservationBasis)&&manual&&manual.every(x=>same(x)&&interval(x)&&str(x.id))&&new Set(manual.map(x=>x.id)).size===manual.length;
 const busy=reservationsOK?manual.map(x=>({...x})):[];
 const selected=new Map();
 const dayRows=Array.isArray(s.workshopDays)?s.workshopDays:[];
 const eligible=(d,o)=>{
  const a=o?.request,slot=a?.slot,row=a?.day,rec=a?.receipt;
  if(!same(o)||o.demandId!==d.a.id||String(o.stand)!==d.k||!same(a)||a.oldIdentity!==id(d.old)||a.targetIdentity!==id(d.target)||!same(rec)||rec.identity!==id(d.target)||rec.status!=='actual'||!date(rec.date)||rec.date>s.asOf||rec.present!==true||rec.usable!==true||rec.unassembled!==true||!['unassembled-return','new-unassembled'].includes(d.target.status)||!interval(slot)||slot.workArea!=='workshop'||slot.date<d.a.date||slot.date===d.a.date&&slot.startHour*60<d.a.endMinute||slot.date<=rec.date||slot.owner?.rollId!==d.target.rollId||String(slot.owner?.standKey)!==d.k||slot.preparedTarget!==d.target.rollId||slot.preparedOn!==rec.date||slot.prepared!==(d.target.status==='new-unassembled'?'newSide':'reworkInbound')||a.sameDayCompletionPlanned!==true||a.targetEmergencyEligible!==true||a.safetyBlocked!==false||!str(a.completionBasis)||!str(a.nightBasis)||!row||row.date!==slot.date||row.dateRowVerified!==true||typeof row.nightOperating!=='boolean')return false;
  const days=dayRows.filter(x=>x?.date===slot.date),day=days[0];
  if(days.length!==1||!same(day)||day.workshopWorking!==true||day.dateRowVerified!==true||day.productionAmount!==row.productionAmount||day.nightOperating!==row.nightOperating||!api.physicalAssemblySlotReady(slot,row).ok)return false;
  return true;
 };
 // R23 approximate ten-day target remains a separately evidenced preference, not an invented deadline.
 const targets=Array.isArray(s.workshopTargets)?s.workshopTargets:[];
 const targetFor=d=>{const t=targets.filter(x=>x?.demandId===d.a.id&&String(x.stand)===d.k);return t.length===1&&same(t[0])&&date(t[0].targetDate)?t[0].targetDate:null;};
 demand.sort((a,b)=>(targetFor(a)||'9999-12-31').localeCompare(targetFor(b)||'9999-12-31')||a.a.date.localeCompare(b.a.date)||+a.k-+b.k);
 for(const d of demand){
  const calculated=deadlineMode?deriveInitialDeadline(s,d,options.filter(o=>eligible(d,o)),api):null;
  const target=deadlineMode?calculated.assemblyDeadline:targetFor(d);
  if(deadlineMode){const {candidates,...instruction}=calculated;workshopInstructions.push({demandId:d.a.id,stand:d.k,oldIdentity:id(d.old),targetIdentity:id(d.target),...instruction});}
  if(deadlineMode&&calculated.status!=='conditional-deadline'){retain(d,'R23期限・現物・搬出根拠未成立');continue;}
  if(!deadlineMode&&!reservationsOK){retain(d,'工作共通予約の根拠未確認');continue;}
  const available=selectWorkshopOptions(s,deadlineMode?calculated.candidates:options,busy,o=>eligible(d,o),target);
  if(!available.length){retain(d,deadlineMode?'期限内の現物・同日引継ぎ見込み未成立':'現物・同日完了・工作枠または共有容量未成立');continue;}
  const o=available[0],slot=o.request.slot;
  selected.set(d.key,o.request);if(!deadlineMode)busy.push({date:slot.date,startHour:slot.startHour,endHour:slot.endHour});
  allocations.push({demandId:d.a.id,stand:d.k,oldIdentity:id(d.old),targetIdentity:id(d.target),date:slot.date,startHour:slot.startHour,endHour:slot.endHour,targetDate:target,late:target===null?null:slot.date>target,status:'provisional',actualCompletion:false,basis:o.basis});
  if(target&&slot.date>target)warnings.push({stand:d.k,kind:'組替目標日超過',targetDate:target,date:slot.date});
 }
 // Re-run the existing coupled disposition engine with only globally selected requests.
 const patched=pairs.map(q=>({...q,assemblies:demand.filter(d=>d.q===q&&selected.has(d.key)).map(d=>selected.get(d.key))}));
 const replay=preview({...s,pairedInputs:patched},api);
 for(const d of demand){
  if(d.single){
   const fresh=previewSingleAllocated(s,d.a,api),upstream=+d.k<=5,event=replay.pathlineEvents.find(e=>e.type==='allocated-single-pathline-preview'&&e.id===d.a.id&&e.date===d.a.date&&e.startMinute===d.a.startMinute&&e.endMinute===d.a.endMinute),prefix=replay.replays.find(x=>x.id===d.a.id),a=allocations.find(x=>x.demandId===d.a.id&&x.stand===d.k);
   if(fresh.status!=='conditional-single-replay'||(!upstream&&!event)||(upstream&&!prefix?.usageAtAllocatedDate?.some(u=>u.rollId===d.old.rollId))){if(a)a.status='held';held.push({demandId:d.a.id,stand:d.k,reason:'単独交換再照合未成立',oldReserveRetained:null});continue;}
   const out=previewSingleDisposition(s,d.a,fresh,selected.get(d.key),api);
   if(a)a.status='conditional-assembly';
   projectedRoles.push(...out.roles);dispositions.push({...out.disposition,demandId:d.a.id,upstreamFitEvidenceOnly:upstream});continue;
  }
  const event=(d.upstream?(replay.upstreamPairReplays||[]).filter(e=>e.status==='conditional-upstream-pair-preview'):replay.pathlineEvents.filter(e=>e.type==='allocated-pair-pathline-preview')).find(e=>e.id===d.a.id&&e.date===d.a.date&&e.startMinute===d.a.startMinute&&e.endMinute===d.a.endMinute);
  const r=replay.replays.find(x=>x.id===d.a.id),a=allocations.find(x=>x.demandId===d.a.id&&x.stand===d.k),h=r?.handovers?.find(x=>x.stand===d.k),disp=r?.dispositions?.find(x=>x.stand===d.k);
  if(!event){if(a)a.status='held';if(!held.some(x=>x.demandId===d.a.id&&x.stand===d.k))held.push({demandId:d.a.id,stand:d.k,reason:'再計算で交換未成立',oldReserveRetained:null});continue;}
  const valid=a&&h?.status==='conditional-assembly'&&h.date===a.date&&h.oldIdentity===a.oldIdentity&&h.targetIdentity===a.targetIdentity;
  if(valid){a.status='conditional-assembly';projectedRoles.push(...r.projectedRoles.filter(x=>String(x.stand)===d.k).map(x=>({...x})));if(disp)dispositions.push({...disp,demandId:d.a.id,upstreamFitEvidenceOnly:d.upstream===true});}
  else {if(a)a.status='held';if(!held.some(x=>x.demandId===d.a.id&&x.stand===d.k))retain(d,'工作引継ぎ再計算未成立');projectedRoles.push({...d.old,status:'used-standby'},{...d.next,status:'online'},{...d.target});if(disp?.procurement)dispositions.push({...disp,demandId:d.a.id,rework:undefined,upstreamFitEvidenceOnly:d.upstream===true});}
 }
 return {...base,exchangeUnresolved:replay.unresolved,caliberLifetime:replay.caliberLifetime,upstreamPairReplays:replay.upstreamPairReplays,setupInstructions:replay.setupInstructions,uncoveredStands:replay.uncoveredStands,pathlineComplete:replay.pathlineComplete,pathlineIssues:replay.pathlineIssues,verifiedExchangeEvents:replay.pathlineEvents,pairedWorkshopComplete:demand.some(d=>!d.single)&&!held.some(h=>demand.some(d=>!d.single&&d.a.id===h.demandId))&&allocations.filter(a=>demand.some(d=>!d.single&&d.a.id===a.demandId)).every(a=>a.status==='conditional-assembly'),workshopComplete:replay.allocationComplete===true&&demand.length>0&&held.length===0&&allocations.every(a=>a.status==='conditional-assembly'),scope:deadlineMode?'conditional deadline forecast only; workshop staffing not allocated':'legacy time-specific forecast'};
}
function previewSharedWorkshop(input,api){return runSharedWorkshop(input,api,previewAllocatedPathline);}
function previewSequenceWorkshop(input,api){
 const s=input||{},windows=[];
 const {previewUpperSequence}=require('./repeated-upper-caliber.cjs');
 const {previewUsageSharedBridge}=require('./usage-shared-bridge.cjs');
 const sequence=previewUpperSequence(s,api,(window,event)=>windows.push({window,event}));
 const preview=(state)=>{
  const allocations=[],replays=[],upstreamPairReplays=[],unresolved=[...sequence.unresolved];
  for(const {window,event} of windows){
   const p=(state.pairedInputs||[]).filter(q=>q&&event.stands.includes(String(q.stand)));
   if(p.length!==1){unresolved.push({id:event.id,reason:'循環共同個体再照合未成立',requiredExchange:true});continue;}
   // Original observation date remains authoritative. A future receipt is not actual.
   const assemblies=(p[0].assemblies||[]).filter(a=>a?.receipt?.status==='actual'&&date(a.receipt.date)&&a.receipt.date<=s.asOf);
   const r=previewUsageSharedBridge({...window,pairedInputs:window.pairedInputs.map(q=>({...q,assemblies}))},api);
   const a=r.allocations.find(a=>a.id===event.id),u=r.upstreamPairReplays.find(u=>u.id===event.id),v=r.replays.find(v=>v.id===event.id);
   if(r.unresolved.length||!a||!v||u?.status!=='conditional-upstream-pair-preview'||a.date!==event.date||a.startMinute!==event.startMinute||a.endMinute!==event.endMinute||a.slotId!==event.slotId){unresolved.push({id:event.id,reason:'連続交換の確定候補と再計算不一致',requiredExchange:true});continue;}
   allocations.push(a);replays.push(v);upstreamPairReplays.push(u);
  }
  return {allocations,replays,upstreamPairReplays,unresolved,pathlineEvents:[],pathlineComplete:false,pathlineIssues:[],allocationComplete:sequence.sequenceComplete&&unresolved.length===0,uncoveredStands:Array.from({length:16},(_,i)=>String(i+2)).filter(k=>!(sequence.coveredStands||[]).includes(k)),setupInstructions:sequence.setupInstructions};
 };
 const workshop=runSharedWorkshop(s,api,preview);
 return {...workshop,sequence,scope:'upstream repeated caliber sequence to first roll change and shared workshop; forecast only'};
}
module.exports={previewSharedWorkshop,previewSequenceWorkshop,selectWorkshopOptions,deriveInitialDeadline};
