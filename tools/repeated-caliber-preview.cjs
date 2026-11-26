'use strict';
// R02/R03/R04/R05/R10/R13/R18/R19/R20. Single evidenced same-size campaign,
// one group at a time. No automatic selection, no real status changes or authorization.
function previewRepeatedCaliberCampaign(input,api){
  const s=input||{}, stages=Array.isArray(s.stages)?s.stages:[], days=Array.isArray(s.days)?s.days:[];
  const events=[], forecasts=[], usedCalibers=new Set(), unresolved=[];
  const nonblank=x=>typeof x==='string'&&x.trim().length>0;
  const next=d=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
  const result=(status,endingUsage=null)=>({status,events,forecasts,unresolved,endingUsage,complete:status==='campaign-preview-complete',operationAuthorized:false,writeAllowed:false});
  const hold=(reason,forecast=null)=>{unresolved.push({reason,forecast,requiredExchange:forecast?.requiredExchange??null,operationAuthorized:false});return result('campaign-preview-unresolved');};
  if(!api||typeof api.deriveFirstMonthlyExchange!=='function'||typeof api.previewDeadlineFirstExchangePlan!=='function'||typeof api.monthlyExchangeEffort!=='function'||typeof api.monthlyUsageThreshold!=='function')return hold('既存計算API未確認');
  if(s.anonymousOnly!==true||!valid(s.referenceDate)||!valid(s.throughDate)||s.referenceDate>s.throughDate||s.referenceDate.slice(0,7)!==s.throughDate.slice(0,7)||!nonblank(s.sourceBasis)||s.dateRowsVerified!==true||!['D10','D13'].includes(s.size)||!['SD295','SD345'].includes(s.steelGrade)||!stages.length)return hold('匿名・対象月・サイズ鋼種・原予定確認不足');
  let expected=s.referenceDate;
  for(const d of days){
    if(!d||d.date!==expected||expected>s.throughDate)return hold('予定の日付欠損・重複');
    if(!['plan','計画'].includes(d.recordKind)||typeof d.productionAmount!=='number'||!Number.isFinite(d.productionAmount)||d.productionAmount<0)return hold('日別予定量・予定区分未確認');
    if(d.productionAmount>0&&(d.size!==s.size||d.steelGrade!==s.steelGrade))return hold('サイズ・鋼種切替または不明。別キャンペーン連携待ち');
    expected=next(expected);
  }
  if(expected!==next(s.throughDate))return hold('予測期間末までの予定不足');
  const stands=(stages[0]?.stands||[]).map(String).sort();
  if(!stands.length||stands.some(k=>!/^1[0-7]$/.test(k))||new Set(stands).size!==stands.length)return hold('今回は#10〜17の直数管理グループのみ');
  const ids=new Set(), physical=new Map();
  function verify(stage,successor=false){
    if(!stage||!nonblank(stage.id)||ids.has(stage.id)||stage.size!==s.size||stage.standPass!=='pass'||!nonblank(stage.inventoryBasis)||!nonblank(stage.basis)||!['caliberChange','rollChange'].includes(stage.workType)||!Array.isArray(stage.stands)||stage.stands.map(String).sort().join(',')!==stands.join(',')||!Array.isArray(stage.members)||stage.members.length!==stands.length||!api.monthlyExchangeEffort(stage.workType,stage.stands,s.size))return null;
    const keys=[], members=[];
    for(const stand of stands){
      const list=stage.members.filter(m=>m&&String(m.standKey)===stand);
      if(list.length!==1)return null;
      const m=list[0],two=s.size==='D10'&&['16','17'].includes(stand);
      if(!nonblank(m.rollId)||!nonblank(m.generation)||!nonblank(m.usageBasis)||!nonblank(m.remainingBasis)||m.nextCaliberAvailable!==(stage.workType==='caliberChange')||!Array.isArray(m.activeCalibers)||m.activeCalibers.length!==(two?2:1))return null;
      if(physical.has(stand)&&physical.get(stand)!==JSON.stringify([m.rollId,m.generation]))return null;
      if(two&&(!nonblank(m.columnBasis)||m.activeCalibers.map(c=>c?.column).sort().join(',')!=='東,西'))return null;
      const limit=api.monthlyUsageThreshold(stand,s.size);
      if(!limit||!Number.isInteger(limit.runs))return null;
      for(const c of m.activeCalibers){
        if(!c||!nonblank(c.id)||!Number.isInteger(c.runs)||c.runs<0||c.available!==true||c.steelGrade!==s.steelGrade||!nonblank(c.compatibilityBasis))return null;
        if(successor&&c.runs>=limit.runs)return null;
        const key=JSON.stringify([stand,m.rollId,m.generation,c.id]);
        if(usedCalibers.has(key)||keys.includes(key))return null;
        keys.push(key);
      }
      members.push(m);
    }
    return {keys,members};
  }
  const capacity=Object.create(null);
  for(const d of days)if(d.productionAmount===0&&Number.isInteger(d.exchangeCapacity)&&d.exchangeCapacity>0&&nonblank(d.exchangeCapacityBasis)&&(!d.productionByTeam||['A','B'].every(k=>d.productionByTeam[k]==null||d.productionByTeam[k]===0)))capacity[d.date]=d.exchangeCapacity;
  let from=s.referenceDate;
  for(let i=0;i<stages.length;i++){
    const stage=stages[i], verified=verify(stage);
    if(!verified)return hold('カリバ個体・世代・互換性・残数・使用量・再使用の確認不足');
    ids.add(stage.id);for(const k of verified.keys)usedCalibers.add(k);
    for(const m of verified.members)physical.set(String(m.standKey),JSON.stringify([m.rollId,m.generation]));
    const f=api.deriveFirstMonthlyExchange({group:stage,referenceDate:from,throughDate:s.throughDate,days:days.filter(d=>d.date>=from)});
    forecasts.push(f);
    if(f.status==='not-due-in-window')return result('campaign-preview-complete',f.usage);
    if(!f.demand)return hold(f.reason,f);
    if(stage.workType==='rollChange')return hold('次のロール替需要。3セット予備・組替引継ぎへの接続待ち',f);
    // Only advance if a different, explicitly compatible groove set is supplied.
    if(!verify(stages[i+1],true))return hold('次回カリバの根拠不足。交換需要保持',f);
    const prior=days.filter(d=>d.date>=from&&d.date<f.demand.latestDate&&d.productionAmount>0).at(-1);
    const earliest=prior?next(prior.date):from;
    const demand={...f.demand,earliestDate:earliest};
    const slots=(Array.isArray(s.slots)?s.slots:[]).filter(x=>x&&Object.hasOwn(capacity,x.date));
    const p=api.previewDeadlineFirstExchangePlan({demands:[demand],slots,exchangeCapacityByDate:capacity});
    if(p.allocations.length!==1)return hold(p.unresolved[0]?.reason||'交換停止枠未成立',f);
    const a=p.allocations[0];
    events.push({...a,sequence:i+1,fromCalibers:f.usage, toCalibers:stages[i+1].members.map(m=>({standKey:m.standKey,rollId:m.rollId,generation:m.generation,activeCalibers:m.activeCalibers.map(c=>({...c}))})),triggers:f.triggers,conditional:true});
    // Stop is a full zero-production day; next usage starts the following date.
    capacity[a.date]--;from=next(a.date);
    if(from>s.throughDate)return hold('次回操業未確認',f);
  }
  return hold('後続カリバ根拠未確認');
}
module.exports={previewRepeatedCaliberCampaign};
