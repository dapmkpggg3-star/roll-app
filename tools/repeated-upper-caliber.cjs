'use strict';
// Anonymous PC preview: repeated upstream caliber changes up to first physical roll change.
// Every interval shares the same reservation ledger; no workshop/admission or operation approval.
const {deriveUpperGroup}=require('./caliber-lifetime-policy.cjs');
const {previewUsageSharedBridge}=require('./usage-shared-bridge.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const copy=x=>JSON.parse(JSON.stringify(x));
const amount=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
function carryUsage(s,g,usage,days,api){
 if(!Array.isArray(usage)||usage.length!==g.members.length||!Array.isArray(days)||days.some(d=>!amount(d.productionAmount)))return null;
 const members=[];
 for(const m of g.members){
  const matches=usage.filter(u=>String(u.standKey)===String(m.standKey)&&u.rollId===m.rollId),u=matches[0],lim=api.monthlyUsageThreshold(m.standKey,g.size),active=m.caliberLedger.calibers.find(c=>c.state==='active');
  if(matches.length!==1||!lim||!active||lim.tons!==null&&(!amount(u.tons)||u.tons<active.tons||u.tons>lim.tons)||lim.runs!==null&&(!Array.isArray(u.calibers)||u.calibers.length!==1||u.calibers[0].id!==active.id||!Number.isInteger(u.calibers[0].runs)||u.calibers[0].runs<active.runs||u.calibers[0].runs>lim.runs))return null;
  const tons=lim.tons===null?(active.tons===null?null:active.tons+days.reduce((n,d)=>n+d.productionAmount,0)):u.tons;
  const runs=lim.runs===null?(active.runs??null):u.calibers[0].runs;
  const l={...m.caliberLedger,calibers:m.caliberLedger.calibers.map(c=>c.id===active.id?{...c,tons,runs}:{...c})};
  members.push({...m,caliberLedger:l,openingUsedTons:lim.tons===null?null:tons,activeCalibers:lim.runs===null?[]:[{id:active.id,runs}]});
 }
 const result=deriveUpperGroup(s,{...g,members},api);
 return result.status==='derived'?result:null;
}
function previewUpperSequence(input,api,onRoll){
 const s=input||{},events=[],unresolved=[],ending=[],reservations=[],setupInstructions=[],rollHandoverCandidates=[],states=[];
 const base={status:'upper-sequence-preview',events,unresolved,ending,reservations,setupInstructions,rollHandoverCandidates,complete:false,annualComplete:false,operationAuthorized:false,writeAllowed:false,scope:'first physical roll change per upstream pair; shared line capacity only'};
 const hold=(g,reason,extra={})=>unresolved.push({id:g?.id??null,stands:g?.stands??[],reason,...extra,operationAuthorized:false});
 if(s.anonymousOnly!==true||!str(s.snapshotId)||!str(s.sourceRevision)||!day(s.asOf)||!day(s.throughDate)||s.asOf>s.throughDate||!Array.isArray(s.groups)||!s.groups.length||!Array.isArray(s.days)||!Array.isArray(s.slots)){hold(null,'匿名・版・期間・計画未確認');return base;}
 let date=s.asOf;
 for(const d of s.days){if(!same(s,d)||d.date!==date||d.dateRowVerified!==true||d.recordKind!=='plan'||!amount(d.productionAmount)){hold(null,'日別予定の連続性・生産量未確認');return base;}date=api.addDays(date,1);}
 if(date!==api.addDays(s.throughDate,1)){hold(null,'期間末までの予定未確認');return base;}
 const covered=s.groups.flatMap(g=>g?.stands||[]);
 for(const g of s.groups){
  if(!same(s,g)||!str(g.id)||!Array.isArray(g.stands)||g.stands.some(k=>covered.filter(x=>x===k).length!==1)||s.groups.filter(q=>q?.id===g.id).length!==1){hold(g,'グループ重複・版未確認');continue;}
  const d=deriveUpperGroup(s,g,api);
  if(d.status!=='derived'){hold(g,d.reason||'上流ペア以外未接続');continue;}
  states.push({group:d.group,cursor:s.asOf,done:false,sequence:0});
 }
 const stop=(st,reason,extra={})=>{st.done=true;hold(st.group,reason,extra);ending.push({id:st.group.id,status:'held',asOf:st.cursor,group:copy(st.group),...extra});};
 const finish=(st,d,status,asOf,extra={})=>{st.done=true;ending.push({id:st.group.id,status,asOf,group:copy(d.group),lifetime:copy(d.ledgers),...extra});};
 // At most one switch per unused groove and one physical replacement per pair.
 const max=states.reduce((n,t)=>n+1+Math.min(...t.group.members.map(m=>m.caliberLedger.calibers.filter(c=>c.state==='unused').length)),0);
 let steps=0;
 while(states.some(t=>!t.done)){
  const due=[];
  for(const st of states.filter(t=>!t.done)){
   if(st.cursor>s.throughDate){const d=deriveUpperGroup(s,st.group,api);finish(st,d,'period-end',st.cursor);continue;}
   const days=s.days.filter(d=>d.date>=st.cursor),f=api.deriveFirstMonthlyExchange({referenceDate:st.cursor,throughDate:s.throughDate,days,group:st.group});
   if(f.status==='not-due-in-window'){
    const d=carryUsage(s,st.group,f.usage,days,api);
    if(!d){stop(st,'期間末の全台帳引継ぎ未成立');continue;}
    finish(st,d,'period-end',api.addDays(s.throughDate,1));continue;
   }
   if(!f.demand){stop(st,f.reason||'次回交換需要未確認',{requiredExchange:f.requiredExchange??null,forecast:f});continue;}
   due.push({st,f});
  }
  if(!due.length)break;
  due.sort((a,b)=>a.f.demand.latestDate.localeCompare(b.f.demand.latestDate)||a.f.demand.latestMinute-b.f.demand.latestMinute||a.st.group.id.localeCompare(b.st.group.id));
  const {st,f}=due[0],g=st.group;
  if(++steps>max){stop(st,'循環回数上限・再選択防止',{requiredExchange:true});continue;}
  const ctx=(s.pairedInputs||[]).filter(p=>p&&g.stands.includes(String(p.stand)));
  if(f.demand.workType==='rollChange'&&(ctx.length!==1||!same(s,ctx[0])||ctx[0].asOf!==s.asOf)){stop(st,'元時点の共同交換・予備情報未確認',{requiredExchange:true,forecast:f});continue;}
  const choices=(s.upperCaliberSelections||[]).filter(e=>e?.demandId===g.id&&e.date>=st.cursor&&Array.isArray(e.members)&&g.members.every(m=>e.members.some(x=>String(x?.standKey)===String(m.standKey)&&x.identity===m.caliberLedger.identity&&x.oldId===m.caliberLedger.calibers.find(c=>c.state==='active').id)));
  if(f.demand.workType==='caliberChange'&&choices.length!==1){stop(st,'今回の新品カリバ選択・適合根拠未確認',{requiredExchange:true,forecast:f});continue;}
  const days=s.days.filter(d=>d.date>=st.cursor).map(d=>({...d,reservedExchangeCount:Number.isInteger(d.reservedExchangeCount)?d.reservedExchangeCount+reservations.filter(a=>a.date===d.date).length:d.reservedExchangeCount}));
  const slots=s.slots.filter(t=>t?.date>=st.cursor&&(f.demand.workType!=='caliberChange'||t.date===choices[0].date)).map(t=>({...t,reserved:Array.isArray(t.reserved)?[...t.reserved,...reservations.filter(a=>a.slotId===t.id).map(a=>({startMinute:a.startMinute,endMinute:a.endMinute,basis:'verified sequence '+a.eventId}))]:t.reserved}));
  const window={...s,asOf:st.cursor,days,slots,groups:[g],pairedInputs:ctx.map(p=>({...p,asOf:st.cursor,assemblies:[]})),upperCaliberSelections:choices,setupNightHistory:[...(s.setupNightHistory||[]),...s.days.filter(d=>d.date<st.cursor)]};
  const r=previewUsageSharedBridge(window,api),a=r.allocations.find(a=>a.id===g.id),u=r.upstreamPairReplays.find(u=>u.id===g.id);
  const expected=f.demand.workType==='caliberChange'?'conditional-upstream-caliber-preview':'conditional-upstream-pair-preview';
  if(!a||u?.status!==expected||r.unresolved.length){stop(st,u?.reason||r.unresolved[0]?.reason||'共通停止枠未成立',{requiredExchange:true,forecast:f});continue;}
  const before=carryUsage(s,g,u.openingUsage,s.days.filter(d=>d.date>=st.cursor&&d.date<=a.date),api);
  if(!before){stop(st,'旧個体の全カリバ履歴未成立',{requiredExchange:true,forecast:f});continue;}
  const after=f.demand.workType==='caliberChange'?deriveUpperGroup(s,u.postChangeGroup,api):deriveUpperGroup(s,{...g,members:u.replacementUsage},api);
  if(after.status!=='derived'){stop(st,'切替後全カリバ台帳未成立',{requiredExchange:true,forecast:f});continue;}
  const eventId=g.id+'@'+a.date+'#'+(++st.sequence),event={...a,eventId,sequence:st.sequence,oldGroup:copy(before.group),newGroup:copy(after.group),oldLifetime:copy(before.ledgers),newLifetime:copy(after.ledgers),changes:u.changes??null,rollChanged:a.workType==='rollChange',operationAuthorized:false};
  events.push(event);reservations.push({eventId,slotId:a.slotId,date:a.date,startMinute:a.startMinute,endMinute:a.endMinute});
  if(u.setupInstruction)setupInstructions.push({...u.setupInstruction,eventId});
  st.group=after.group;st.cursor=api.addDays(a.date,1);
  if(a.workType==='rollChange'){
   const replay=r.replays.find(z=>z.id===g.id);
   if(typeof onRoll==='function')onRoll(copy(window),copy(event));
   rollHandoverCandidates.push({eventId,stands:g.stands,date:a.date,projectedRoles:copy(replay.projectedRoles),emergencyReserveByStand:copy(replay.emergencyReserveByStand),workshopVerified:false,reworkConfirmed:false});
   // Stop physical circulation here: future assembly/receipts must be verified separately.
   finish(st,after,'first-roll-change',st.cursor,{nextForecast:u.followup??null,requiresWorkshop:true});
  }
 }
 events.sort((a,b)=>a.date.localeCompare(b.date)||a.startMinute-b.startMinute);
 return {...base,sequenceComplete:unresolved.length===0&&states.length>0&&ending.length===states.length,coveredStands:states.flatMap(st=>st.group.stands)};
}
module.exports={previewUpperSequence,carryUsage};
