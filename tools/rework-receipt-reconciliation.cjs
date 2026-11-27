'use strict';
const {previewCampaignRework}=require('./campaign-rework-forecast.cjs');
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
function previewReworkReceipt(input,api){
 const s=input||{},r=previewCampaignRework(s.originalPlan,api),p=r.reworkForecast,a=s.actual||{};
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
 const base={originalForecast:p,actualDispatchDate:null,actualInboundDate:null,actualReworkCostMonth:null,revisedInboundEstimate:null,receiptConfirmed:false,assemblyCandidate:false,emergencyReserveAdded:0,operationAuthorized:false,writeAllowed:false,historyUnchanged:true};
 const hold=(reason,extra={})=>({...base,...extra,status:'held',reason});
 if(p?.status!=='conditional-rework'||!date(a.asOf)||!str(a.snapshotId)||!str(a.sourceRevision)||!str(a.basis)||a.asOf<s.originalPlan.asOf)return hold('原予測または後日実績の版未確認');
 const key=JSON.stringify([p.stand,p.rollId,p.generation]);
 const evidence=(e,type)=>e&&e.type===type&&e.status==='actual'&&e.identity===key&&e.cycleId===p.cycleId&&e.snapshotId===a.snapshotId&&e.sourceRevision===a.sourceRevision&&str(e.basis)&&date(e.date)&&e.date<=a.asOf;
 const h=a.assembly,d=a.dispatch,b=a.receipt;
 if(!evidence(h,'assembly-complete')||h.counterpartIdentity!==r.assemblyHandover.targetIdentity||h.oldDisassembled!==true||h.newAssembled!==true||h.dispatchReady!==true||h.date<r.rollHandover.date)return hold('旧中古バラシ・次予備組込・搬出可能の実績未確認');
 if(!evidence(d,'dispatch')||d.date<=h.date)return hold('実搬出日・個体・回次未確認');
 const next={actualDispatchDate:d.date,revisedInboundEstimate:api.addDays(d.date,p.leadDays)};
 if(b==null)return {...base,...next,status:'awaiting-receipt',receiptOverdue:a.asOf>next.revisedInboundEstimate,reason:'実搬出確認、実搬入は未確認'};
 if(!evidence(b,'receipt')||b.date<=d.date||b.present!==true)return hold('実搬入日・現物・回次未確認',next);
 const arrived={...next,actualInboundDate:b.date,actualReworkCostMonth:b.date.slice(0,7),receiptConfirmed:true,receiptOverdue:false};
 if(!str(b.newGeneration)||b.newGeneration===p.generation||b.unassembled!==true||b.usable!==true)return hold('搬入実績あり、次世代または組替可能状態未確認',arrived);
 const newKey=JSON.stringify([p.stand,p.rollId,b.newGeneration]);
 const target=Array.isArray(a.currentRoles)?a.currentRoles.filter(x=>String(x.stand)===p.stand&&x.rollId===p.rollId):[];
 if(target.length!==1||target[0].generation!==b.newGeneration||target[0].status!=='unassembled-return'||target[0].chockAssembled!==false||target[0].snapshotId!==a.snapshotId||target[0].sourceRevision!==a.sourceRevision||!str(target[0].basis))return hold('搬入済み個体と現台帳の一致未確認',arrived);
 // Temporary lookup selector only, not a change of online status.
 const m=resolveOnlineCaliberMaster({anonymousOnly:true,snapshotId:a.snapshotId,sourceRevision:a.sourceRevision,masterRows:a.masterRows,usageRows:a.usageRows,onlineRows:[{...target[0],status:'online'}]},p.stand);
 if(m.status!=='resolved'||m.calibers.some(c=>c.runs!==0||typeof c.available!=='boolean'))return hold('新改削世代の配置・初期直数未確認',arrived);
 return {...base,...arrived,status:'returned-unassembled',newIdentity:newKey,assemblyCandidate:true,master:m,reason:'現物搬入・世代別マスター照合済み。未組込のため緊急予備には加算しない。'};
}
module.exports={previewReworkReceipt};
