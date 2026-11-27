'use strict';
// R04/R05/R06/R09: upstream use replay and separately evidenced setup material.
const {deriveUpperGroup}=require('./caliber-lifetime-policy.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const is67=d=>d?.stands?.join(',')==='6,7';
function setupForSlot(s,d,slot,api){
 if(!is67(d))return {status:'not-applicable',instruction:null};
 const rows=[...(Array.isArray(s.setupNightHistory)?s.setupNightHistory:[]),...(s.days||[])].filter(r=>r?.date<slot.date);
 if(rows.some(r=>!same(s,r)||r.dateRowVerified!==true||!['plan','actual'].includes(r.recordKind)))return {status:'held',reason:'型決め材の夜勤記録・版未確認',instruction:null};
 const q=api.previewSetupMaterialInstruction(rows,slot.date);
 return q.status==='preview'?{...q,instruction:{...q.instruction,demandId:d.id,basis:rows.find(r=>r.date===q.instruction.date)?.basis,operationAuthorized:false}}:q;
}
function verifiedPrefix(s,g,a,api){
 const days=s.days||[];
 let opening=api.deriveFirstMonthlyExchange({referenceDate:s.asOf,throughDate:a.date,days:days.filter(d=>d.date<=a.date),group:g});
 if(opening.status==='unresolved'&&opening.reason==='計画基準到達・次回操業日未確認'&&opening.reached){
  const full=api.deriveFirstMonthlyExchange({referenceDate:s.asOf,throughDate:s.throughDate,days,group:g});
  if(full.status==='required'&&full.demand?.latestDate>a.date&&full.reached?.date===opening.reached.date&&full.reason==='前操業で計画基準到達・次の操業前に交換'&&Array.isArray(full.usage))opening={...opening,status:'verified-prefix-at-limit',usage:full.usage};
 }
 return ['not-due-in-window','verified-prefix-at-limit'].includes(opening.status)&&Array.isArray(opening.usage)?opening:null;
}
function replayUpperCaliber(s,a,g,api){
 const hold=reason=>({status:'held',id:a.id,reason,requiredExchange:true,operationAuthorized:false,writeAllowed:false});
 if(!['6,7','8,9','10,11'].includes(a.stands.join(','))||a.workType!=='caliberChange')return hold('共同カリバ替対象未確認');
 const opening=verifiedPrefix(s,g,a,api),choices=(s.upperCaliberSelections||[]).filter(x=>x?.demandId===a.id),e=choices[0];
 if(!opening||choices.length!==1||!same(s,e)||e.date!==a.date||e.startMinute!==a.startMinute||e.endMinute!==a.endMinute||e.size!==a.size||e.pairFitConfirmed!==true||!str(e.fitBasis)||!Array.isArray(e.members)||e.members.length!==2)return hold('共同カリバ替の割当・選択・適合根拠未確認');
 const members=[],changes=[];
 for(const stand of a.stands){
  const m=g.members.find(x=>String(x.standKey)===stand),u=opening.usage.find(x=>x.standKey===stand&&x.rollId===m?.rollId),p=e.members.filter(x=>String(x?.standKey)===stand),q=p[0],old=m?.caliberLedger.calibers.find(c=>c.state==='active'),next=m?.caliberLedger.calibers.find(c=>c.id===q?.nextId),lim=api.monthlyUsageThreshold(stand,a.size);
  if(!m||!u||p.length!==1||!same(s,q)||q.identity!==m.caliberLedger.identity||!old||q.oldId!==old.id||next?.state!=='unused'||!lim)return hold('新品カリバ・個体世代不一致 #'+stand);
  const retired={...old,state:'used',tons:lim.tons===null?(old.tons===null?null:old.tons+s.days.filter(d=>d.date<=a.date).reduce((n,d)=>n+d.productionAmount,0)):u.tons,runs:lim.runs===null?(old.runs??null):u.calibers[0].runs};
  const current={...next,state:'active'};
  const ledger={...m.caliberLedger,calibers:m.caliberLedger.calibers.map(c=>c.id===old.id?retired:c.id===next.id?current:{...c})};
  members.push({...m,caliberLedger:ledger,openingUsedTons:lim.tons===null?null:0,activeCalibers:lim.runs===null?[]:[{id:next.id,runs:0}]});
  changes.push({stand,identity:q.identity,oldId:old.id,newId:next.id,oldUsedTons:retired.tons,oldRuns:retired.runs});
 }
 const nextGroup=deriveUpperGroup(s,{...g,members},api);
 if(nextGroup.status!=='derived')return hold(nextGroup.reason);
 const start=api.addDays(a.date,1),suffix=start<=s.throughDate?api.deriveFirstMonthlyExchange({referenceDate:start,throughDate:s.throughDate,days:s.days.filter(d=>d.date>=start),group:nextGroup.group}):null;
 const setup=setupForSlot(s,a,a,api);
 if(setup.status==='held')return hold(setup.reason);
 return {status:'conditional-upstream-caliber-preview',id:a.id,date:a.date,startMinute:a.startMinute,endMinute:a.endMinute,changes,openingUsage:opening.usage,postChangeGroup:nextGroup.group,postChangeLifetime:nextGroup.ledgers,endingUsage:suffix?.usage??null,followup:suffix,requiresFollowup:suffix?.status!=='not-due-in-window',setupInstruction:setup.instruction,rollChanged:false,reworkGenerated:false,upstreamFitEvidenceOnly:true,operationAuthorized:false,writeAllowed:false};
}
function replayUpstreamPair(s,a,r,api){
 const k=a.stands.join(','),hold=reason=>({status:'held',reason,requiredExchange:true,operationAuthorized:false,writeAllowed:false});
 if(!['6,7','8,9','10,11'].includes(k)||a.workType!=='rollChange'||r?.status!=='conditional-pair-replay')return hold('上流共同交換未成立');
 const groups=(s.groups||[]).filter(g=>g?.id===a.id),contexts=(s.pairedInputs||[]).filter(p=>a.stands.includes(String(p?.stand)));
 if(groups.length!==1||contexts.length!==1)return hold('共同交換入力未確認');
 const g=groups[0],p=contexts[0],days=s.days||[];
 let opening=api.deriveFirstMonthlyExchange({referenceDate:s.asOf,throughDate:a.date,days:days.filter(d=>d.date<=a.date),group:g});
 // At an exact limit, the prefix reports 'next operation unknown' rather than usage.
 // Recover the identical verified usage from the full demand calculation only when
 // the first actual planned production after reaching the limit is later than this allocation.
 if(opening.status==='unresolved'&&opening.reason==='計画基準到達・次回操業日未確認'&&opening.reached){
  const full=api.deriveFirstMonthlyExchange({referenceDate:s.asOf,throughDate:s.throughDate,days,group:g});
  if(full.status==='required'&&full.demand?.latestDate>a.date&&full.reached?.date===opening.reached.date&&full.reason==='前操業で計画基準到達・次の操業前に交換'&&Array.isArray(full.usage))opening={...opening,status:'verified-prefix-at-limit',usage:full.usage};
 }
 if(!['not-due-in-window','verified-prefix-at-limit'].includes(opening.status)||!Array.isArray(opening.usage))return hold('割当日までの使用量・上限未確認');
 const choices=p.replacementUsage;
 if(!Array.isArray(choices)||choices.length!==2)return hold('交換先の使用開始条件未確認');
 const newMembers=[],oldIdentities={},newIdentities={};
 for(const stand of a.stands){
  const m=p.members.find(m=>String(m.stand)===stand),old=m?.roles.find(x=>x.status==='online'),next=m?.roles.find(x=>x.status==='new-standby'),rows=choices.filter(x=>String(x?.standKey)===stand),u=rows[0],limit=api.monthlyUsageThreshold(stand,a.size);
  if(!old||!next||!limit||rows.length!==1||!same(s,u)||u.rollId!==next.rollId||u.generation!==next.generation||u.identity!==id(next)||u.size!==a.size||!str(u.usageBasis)||!str(u.remainingBasis)||!opening.usage.some(x=>x.standKey===stand&&x.rollId===old.rollId)||!r.projectedRoles.some(x=>x.status==='online'&&id(x)===id(next)))return hold('交換先個体・使用量根拠不一致 #'+stand);
  if(limit.tons!==null&&(!Number.isFinite(u.openingUsedTons)||u.openingUsedTons<0||u.openingUsedTons>=limit.tons))return hold('交換先開始トン数未確認 #'+stand);
  if(limit.runs!==null&&(!Array.isArray(u.activeCalibers)||u.activeCalibers.length!==1||!str(u.activeCalibers[0]?.id)||!Number.isInteger(u.activeCalibers[0]?.runs)||u.activeCalibers[0].runs<0||u.activeCalibers[0].runs>=limit.runs))return hold('交換先開始直数未確認 #'+stand);
  oldIdentities[stand]=id(old);newIdentities[stand]=id(next);newMembers.push({...u});
 }
 const replacement=deriveUpperGroup(s,{...g,members:newMembers},api);
 if(replacement.status!=='derived')return hold('交換先全カリバ根拠：'+replacement.reason);
 if(newMembers.some(m=>m.caliberLedger.calibers.some(c=>c.state==='active'&&((c.tons!==null&&c.tons!==0)||(api.monthlyUsageThreshold(m.standKey,a.size).runs!==null&&c.runs!==0)))))return hold('通常中古カリバを交換先にしない');
 const setup=setupForSlot(s,a,a,api);
 if(setup.status==='held')return hold(setup.reason);
 // Reuse the real consumption forecast from the first day after the stopped exchange.
 const start=api.addDays(a.date,1),suffixGroup=replacement.group;
 let suffix=null;
 if(start<=s.throughDate)suffix=api.deriveFirstMonthlyExchange({referenceDate:start,throughDate:s.throughDate,days:days.filter(d=>d.date>=start),group:suffixGroup});
 return {status:'conditional-upstream-pair-preview',id:a.id,date:a.date,startMinute:a.startMinute,endMinute:a.endMinute,oldIdentities,newIdentities,openingUsage:opening.usage,replacementUsage:replacement.group.members,replacementLifetime:replacement.ledgers,endingUsage:suffix?.usage??null,followup:suffix,requiresFollowup:suffix?.status!=='not-due-in-window',setupInstruction:setup.instruction,upstreamFitEvidenceOnly:true,operationAuthorized:false,writeAllowed:false};
}
module.exports={setupForSlot,replayUpstreamPair,replayUpperCaliber};
