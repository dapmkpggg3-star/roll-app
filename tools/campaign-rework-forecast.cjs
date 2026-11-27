'use strict';
// PC forecast only. A forecast receipt never creates available physical stock.
const {previewCampaignAssembly}=require('./campaign-assembly-handover.cjs');
function previewCampaignRework(input,api){
 const s=input||{},d=s.dispatchPlan||{},r=previewCampaignAssembly(s,api);
 const base={...r,reworkForecast:null,operationAuthorized:false,writeAllowed:false};
 const h=r.assemblyHandover;
 if(h?.status!=='conditional-assembly')return base;
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
 const hold=reason=>({...base,reworkForecast:{status:'held',reason,expectedInboundDate:null,actualInboundDate:null,receiptConfirmed:false}});
 const k=r.rollHandover.stand,old=r.projectedRoles?.find(x=>JSON.stringify([String(x.stand),x.rollId,x.generation])===h.oldIdentity);
 if(!old||old.status!=='rework-ready'||old.chockAssembled!==false||d.identity!==h.oldIdentity||d.snapshotId!==s.snapshotId||d.sourceRevision!==s.sourceRevision||d.status!=='planned'||!str(d.basis)||!date(d.date)||!date(s.asOf)||d.date<=h.date||d.date<s.asOf||d.dispatchCapacityConfirmed!==true||d.vendorAcceptanceConfirmed!==true)return hold('搬出対象・組替後の搬出予定・手配根拠未確認');
 // Prior-generation history cannot become a current-cycle actual event.
 if(!str(d.cycleId)||!Array.isArray(d.priorCycleIds)||d.priorCycleIds.includes(d.cycleId)||new Set(d.priorCycleIds).size!==d.priorCycleIds.length||d.priorCycleIds.some(x=>!str(x)))return hold('新改削回次未確認');
 const override=d.leadOverride;
 if(override!==undefined&&(!override||String(override.stand)!==k||!Number.isInteger(override.days)||override.days<=0||!str(override.basis)||override.sourceRevision!==s.sourceRevision))return hold('改削LT設定根拠未確認');
 const days=override===undefined?api.provisionalReworkCalendarDays(k):override.days;
 if(!Number.isInteger(days)||days<=0)return hold('改削LT未確認');
 const expected=api.addDays(d.date,days);
 if(!date(expected)||expected<=d.date)return hold('搬入見込計算不成立');
 const nextRoles=r.projectedRoles.map(x=>x===old?{...x,status:'rework',chockAssembled:false,emergencyEligible:false}:x);
 const deadline=d.nextExchangeTarget;
 if(deadline!==undefined&&(!date(deadline)||deadline<=d.date||!str(d.nextExchangeBasis)))return hold('次回交換目標の根拠未確認');
 return {...base,reworkProjectedRoles:nextRoles,reworkForecast:{status:'conditional-rework',stand:k,rollId:old.rollId,generation:old.generation,cycleId:d.cycleId,dispatchDate:d.date,dispatchStatus:'planned',actualDispatchDate:null,leadDays:days,leadUnit:'calendar-days',leadBasis:override?.basis||'stand-default-provisional',expectedInboundDate:expected,actualInboundDate:null,receiptConfirmed:false,assemblyConfirmed:false,plannedReworkCostMonth:expected.slice(0,7),actualReworkCostMonth:null,nextExchangeTarget:deadline??null,lateReturnWarning:deadline===undefined?null:expected>=deadline,reason:'搬出予定＋暦日LT。搬入見込は現物・組込完了ではない。改削費予定は搬入見込月。',basis:d.basis,operationAuthorized:false,writeAllowed:false}};
}
module.exports={previewCampaignRework};
