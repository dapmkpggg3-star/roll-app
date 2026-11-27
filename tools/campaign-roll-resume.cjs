'use strict';
// Anonymous PC forecast. One roll exchange, bound to the actual stop in the timeline.
const {previewLinkedCampaign}=require('./linked-campaign-consumption.cjs');
const {previewSingleRollHandover}=require('./single-roll-handover.cjs');
function previewCampaignWithSingleHandover(input,api){
 const s=input||{},e=s.rollExchange||{};
 const first=previewLinkedCampaign(s,api);
 const base={...first,roles:s.roles,onlineRows:s.onlineRows,rollHandover:null,operationAuthorized:false,writeAllowed:false};
 if(first.complete||!first.unresolved?.some(x=>x.requiredExchange===true))return base;
 const hold=reason=>({...base,rollHandover:{status:'held',reason},complete:false});
 const u=first.unresolved[0],periods=s.periods||[];
 const ix=periods.findIndex(p=>p.id===u.periodId);
 if(ix<=0||e.forPeriod!==u.periodId)return hold('交換需要と時系列の対応未確認');
 const p=periods[ix],stop=periods[ix-1],stand=String(e.stand);
 if(p.type!=='production'||p.size!==first.endingSize||p.grade!==s.grade||stop.type!=='stop'||stop.end!==p.start||stop.id!==e.stopId)return hold('直前停止枠・同サイズ鋼種未確認');
 const matches=(stop.eligibility||[]).filter(x=>Array.isArray(x?.stands)&&x.stands.length===1&&String(x.stands[0])===stand);
 if(matches.length!==1)return hold('交換対象別停止枠根拠未確認');
 const ready=matches[0];
 if(typeof ready.basis!=='string'||!ready.basis.trim()||ready.reserveReady!==true||ready.pairReady!==true)return hold('予備・対象条件未確認');
 const slot={...stop,forPeriod:p.id,preparationReady:ready.preparationReady,additionalReady:ready.additionalReady,safetyBlocked:ready.safetyBlocked};
 const h=previewSingleRollHandover({...s,campaign:first,exchange:{...e,stop:slot}},api);
 if(h.status!=='conditional-handover')return {...base,rollHandover:h};
 const next=previewLinkedCampaign({...s,size:first.endingSize,onlineRows:h.onlineRows,usageRows:h.usageRows,selection:h.selection,periods:periods.slice(ix)},api);
 // Preserve the chronological prefix and the exchange. Never replay consumed shifts.
 const exchangeEvent={type:'roll-exchange-preview',periodId:stop.id,date:stop.date,forPeriod:p.id,stand,oldIdentity:h.oldIdentity,newIdentity:h.newIdentity,referenceMinutes:h.referenceMinutes,stopStart:stop.start,stopEnd:stop.end,capacityBasis:stop.capacityBasis,basis:e.basis,checks:h.checks,emergencyReserveCount:h.emergencyReserveCount,operationAuthorized:false};
 const roles=s.roles.map(r=>h.roles.find(x=>String(x.stand)===String(r.stand)&&x.rollId===r.rollId&&x.generation===r.generation)||r);
 return {...next,events:[...first.events,exchangeEvent,...next.events],operatingRuns:first.operatingRuns+next.operatingRuns,roles,onlineRows:h.onlineRows,rollHandover:h,operationAuthorized:false,writeAllowed:false};
}
module.exports={previewCampaignWithSingleHandover};
