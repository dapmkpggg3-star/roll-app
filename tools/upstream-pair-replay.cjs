'use strict';
// R04/R05/R06/R09: upstream use replay and separately evidenced setup material.
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
function replayUpstreamPair(s,a,r,api){
 const k=a.stands.join(','),hold=reason=>({status:'held',reason,requiredExchange:true,operationAuthorized:false,writeAllowed:false});
 if(!['6,7','8,9','10,11'].includes(k)||a.workType!=='rollChange'||r?.status!=='conditional-pair-replay')return hold('上流共同交換未成立');
 const groups=(s.groups||[]).filter(g=>g?.id===a.id),contexts=(s.pairedInputs||[]).filter(p=>a.stands.includes(String(p?.stand)));
 if(groups.length!==1||contexts.length!==1)return hold('共同交換入力未確認');
 const g=groups[0],p=contexts[0],days=s.days||[];
 const opening=api.deriveFirstMonthlyExchange({referenceDate:s.asOf,throughDate:a.date,days:days.filter(d=>d.date<=a.date),group:g});
 if(opening.status!=='not-due-in-window'||!Array.isArray(opening.usage))return hold('割当日までの使用量・上限未確認');
 const choices=p.replacementUsage;
 if(!Array.isArray(choices)||choices.length!==2)return hold('交換先の使用開始条件未確認');
 const newMembers=[],oldIdentities={},newIdentities={};
 for(const stand of a.stands){
  const m=p.members.find(m=>String(m.stand)===stand),old=m?.roles.find(x=>x.status==='online'),next=m?.roles.find(x=>x.status==='new-standby'),rows=choices.filter(x=>String(x?.standKey)===stand),u=rows[0],limit=api.monthlyUsageThreshold(stand,a.size);
  if(!old||!next||!limit||rows.length!==1||!same(s,u)||u.rollId!==next.rollId||u.generation!==next.generation||u.identity!==id(next)||u.size!==a.size||!str(u.usageBasis)||!str(u.remainingBasis)||typeof u.nextCaliberAvailable!=='boolean'||!opening.usage.some(x=>x.standKey===stand&&x.rollId===old.rollId)||!r.projectedRoles.some(x=>x.status==='online'&&id(x)===id(next)))return hold('交換先個体・使用量根拠不一致 #'+stand);
  if(limit.tons!==null&&(!Number.isFinite(u.openingUsedTons)||u.openingUsedTons<0||u.openingUsedTons>=limit.tons))return hold('交換先開始トン数未確認 #'+stand);
  if(limit.runs!==null&&(!Array.isArray(u.activeCalibers)||u.activeCalibers.length!==1||!str(u.activeCalibers[0]?.id)||!Number.isInteger(u.activeCalibers[0]?.runs)||u.activeCalibers[0].runs<0||u.activeCalibers[0].runs>=limit.runs))return hold('交換先開始直数未確認 #'+stand);
  oldIdentities[stand]=id(old);newIdentities[stand]=id(next);newMembers.push({...u});
 }
 if(new Set(newMembers.map(m=>m.nextCaliberAvailable)).size!==1)return hold('交換先の次回カリバ可否がペアで不一致・個別確認');
 const setup=setupForSlot(s,a,a,api);
 if(setup.status==='held')return hold(setup.reason);
 // Reuse the real consumption forecast from the first day after the stopped exchange.
 const start=api.addDays(a.date,1),suffixGroup={...g,members:newMembers,workType:newMembers[0].nextCaliberAvailable?'caliberChange':'rollChange'};
 let suffix=null;
 if(start<=s.throughDate)suffix=api.deriveFirstMonthlyExchange({referenceDate:start,throughDate:s.throughDate,days:days.filter(d=>d.date>=start),group:suffixGroup});
 return {status:'conditional-upstream-pair-preview',id:a.id,date:a.date,startMinute:a.startMinute,endMinute:a.endMinute,oldIdentities,newIdentities,openingUsage:opening.usage,replacementUsage:newMembers,endingUsage:suffix?.usage??null,followup:suffix,requiresFollowup:suffix?.status!=='not-due-in-window',setupInstruction:setup.instruction,upstreamFitEvidenceOnly:true,operationAuthorized:false,writeAllowed:false};
}
module.exports={setupForSlot,replayUpstreamPair};
