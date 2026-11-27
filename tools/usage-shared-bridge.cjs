'use strict';
// Anonymous PC bridge: derive first demands, allocate once, replay paired lifecycle on exact allocated interval.
const {setupForSlot,replayUpstreamPair}=require('./upstream-pair-replay.cjs');
const {previewSharedLineCapacity}=require('./shared-line-capacity.cjs');
const {previewPairedAssemblyDisposition}=require('./paired-assembly-disposition.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const key=x=>String(x).replace(/^#/,'');
const pairKeys=['6,7','8,9','10,11','12,13','14,15'];
const id=r=>JSON.stringify([key(r.stand),r.rollId,r.generation]);
function previewUsageSharedBridge(input,api){
 const s=input||{},groups=Array.isArray(s.groups)?s.groups:[],forecasts=[],demands=[],unresolved=[],replays=[],upstreamPairReplays=[],setupInstructions=[];
 const base={status:'usage-shared-bridge',forecasts,demands,unresolved,replays,upstreamPairReplays,setupInstructions,allocations:[],complete:false,annualComplete:false,operationAuthorized:false,writeAllowed:false};
 const same=x=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
 const hold=(g,reason,required=null)=>unresolved.push({id:g?.id??null,stands:g?.stands??[],requiredExchange:required,reason,operationAuthorized:false});
 if(s.anonymousOnly!==true||!str(s.snapshotId)||!str(s.sourceRevision)||!date(s.asOf)||!date(s.throughDate)||s.throughDate<s.asOf){groups.forEach(g=>hold(g,'匿名・版・期間未確認'));return base;}
 const days=Array.isArray(s.days)?s.days:[],slots=Array.isArray(s.slots)?s.slots:[],paired=Array.isArray(s.pairedInputs)?s.pairedInputs:[];
 const covered=groups.flatMap(g=>Array.isArray(g?.stands)?g.stands.map(key):[]);
 const cleanDays=days.every(d=>same(d)&&d.dateRowVerified===true&&d.recordKind==='plan');
 const candidates=slots.filter(t=>days.some(d=>d?.date===t?.date&&d.productionAmount===0&&(!d.productionByTeam||['A','B'].every(k=>d.productionByTeam[k]==null||d.productionByTeam[k]===0))));
 const capacity=Object.fromEntries(days.filter(d=>Number.isInteger(d.exchangeCapacity)&&d.exchangeCapacity>0).map(d=>[d.date,d.exchangeCapacity]));
 const pairContexts=new Map();
 for(const g of groups){
  if(!same(g)||!str(g.id)||groups.filter(x=>x?.id===g.id).length!==1||!Array.isArray(g.stands)||g.stands.some(k=>covered.filter(x=>x===key(k)).length!==1)||!Array.isArray(g.members)||g.members.some(m=>!same(m)||!str(m.generation))||!cleanDays){hold(g,'個体・版・日別計画・重複未確認');continue;}
  const f=api.deriveFirstMonthlyExchange({referenceDate:s.asOf,throughDate:s.throughDate,days,group:g});
  forecasts.push(f);
  if(f.status==='not-due-in-window')continue;
  if(!f.demand){hold(g,f.reason,f.requiredExchange);continue;}
  const d={...f.demand,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:g.basis,requiredExchange:true};
  const k=d.stands.join(',');
  if(d.workType==='rollChange'&&pairKeys.includes(k)){
   const matches=paired.filter(p=>p&&p.stand!=null&&d.stands.includes(key(p.stand)));
   const p=matches[0];
   if(matches.length!==1||!same(p)||p.asOf!==s.asOf||p.size!==d.size||g.id!=='paired-'+d.stands.join('-')||!Array.isArray(p.members)||p.members.length!==2){hold(g,'共同ロール替の3セット根拠未確認',true);continue;}
   const members=p.members.map(m=>{
    const u=g.members.find(x=>key(x.standKey)===key(m.stand)),old=m.roles?.find(x=>x.status==='online');
    if(!u||!old||u.rollId!==old.rollId||u.generation!==old.generation)return null;
    // Group deadline is the earliest usage trigger; do not manufacture a second independent deadline.
    const cause=f.triggers?.some(x=>key(x.standKey)===key(m.stand));
    return {...m,deadline:cause?{snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:d.deadlineBasis,identity:id(old),required:true,date:d.latestDate,minute:d.latestMinute}:null};
   });
   if(members.some(x=>!x)||!members.some(x=>x.deadline)){hold(g,'共同交換の使用個体・期限原因不一致',true);continue;}
   const ctx={...p,members,slots:candidates,exchangeCapacityByDate:capacity};
   // Do not consume shared capacity on an already known invalid paired state.
   const preflight=previewPairedAssemblyDisposition(ctx,api);
   if(preflight.status!=='conditional-pair-exchange'){hold(g,preflight.reason||'共同交換事前照合未成立',true);continue;}
   pairContexts.set(d.id,ctx);
  }
  demands.push(d);
 }
 const eligibleSlots=candidates.map(t=>({...t,eligibility:(t.eligibility||[]).filter(e=>{const d=demands.find(x=>x.id===e?.demandId);return d?.stands.join(',')!=='6,7'||setupForSlot(s,d,t,api).status==='preview';})}));
 const plan=previewSharedLineCapacity({...s,demands,slots:eligibleSlots},api);
 for(const u of plan.unresolved)unresolved.push(u);
 const chronological=plan.allocations.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.startMinute-b.startMinute);
 for(const a of chronological){
  const d=demands.find(x=>x.id===a.id),ctx=pairContexts.get(a.id),slot=eligibleSlots.find(x=>x.id===a.slotId),g=groups.find(x=>x.id===a.id);
  const setup=setupForSlot(s,a,a,api);if(setup.instruction)setupInstructions.push(setup.instruction);
  if(!ctx){
   // Upstream use is recomputed through the assigned zero-production day, without consuming the later original deadline.
   const prefix=days.filter(x=>x.date<=a.date),p=api.deriveFirstMonthlyExchange({referenceDate:s.asOf,throughDate:a.date,days:prefix,group:g});
   replays.push({id:a.id,allocation:a,status:'awaiting-physical-replay',prefixStatus:p.status,usageAtAllocatedDate:p.status==='not-due-in-window'?p.usage:null,reason:'割当日までの使用量を再計算。交換後個体・全パスライン未接続',operationAuthorized:false});
   continue;
  }
  const exact={...slot,startMinute:a.startMinute,endMinute:a.endMinute,eligibility:slot.eligibility.filter(e=>e?.demandId===a.id)};
  const r=previewPairedAssemblyDisposition({...ctx,slots:[exact],exchangeCapacityByDate:{[a.date]:1}},api);
  const ok=r.status==='conditional-pair-exchange'&&r.allocation.date===a.date&&r.allocation.startMinute===a.startMinute&&r.allocation.endMinute===a.endMinute;
  if(!ok){hold(g,r.reason||'割当後共同交換再照合未成立',true);replays.push({id:a.id,allocation:a,status:'held',reason:r.reason,operationAuthorized:false});continue;}
  const replay={id:a.id,allocation:a,status:'conditional-pair-replay',projectedRoles:r.projectedRoles,handovers:r.handovers,dispositions:r.dispositions,emergencyReserveByStand:r.emergencyReserveByStand,requiresFullPathlineRecalculation:true,requiresUsageReplay:true,operationAuthorized:false};
  if(['6,7','8,9','10,11'].includes(a.stands.join(','))){
   const u=replayUpstreamPair(s,a,replay,api);upstreamPairReplays.push({...u,id:a.id});
   if(u.status!=='conditional-upstream-pair-preview'){hold(g,u.reason,true);replay.status='held';replay.reason=u.reason;}
  }
  replays.push(replay);
 }
 return {...base,allocations:chronological.map(a=>({...a,status:replays.find(r=>r.id===a.id)?.status==='held'?'held-replay':'proposal-replay-pending'})),sharedPlan:plan,allocationComplete:groups.length>0&&unresolved.length===0,uncoveredStands:Array.from({length:16},(_,i)=>String(i+2)).filter(k=>!covered.includes(k)),complete:false};
}
module.exports={previewUsageSharedBridge};
