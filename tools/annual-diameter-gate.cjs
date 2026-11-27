'use strict';
const {meanCut,finalState}=require('../test/fixtures/annual-projection/tonnage-circulation.cjs');
const {previewAnnualReworkLedger}=require('./annual-rework-ledger.cjs');
const {previewNextPhysicalCycle}=require('./second-physical-cycle.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function assessDiameterLife(s){
 const d=s.diameter||{},k=String(d.stand),base={status:'held',identity:d.identity??null,remainingReworks:null,nextDiameter:null,operationAuthorized:false,writeAllowed:false};
 const hold=reason=>({...base,reason});
 if(s.anonymousOnly!==true||!date(s.asOf)||!str(s.snapshotId)||!str(s.sourceRevision)||!/^([2-9]|1[0-7])$/.test(k)||!str(d.rollId)||!str(d.generation)||d.identity!==JSON.stringify([k,d.rollId,d.generation])||d.snapshotId!==s.snapshotId||d.sourceRevision!==s.sourceRevision||d.status!=='actual'||d.limitApproved!==true||!str(d.basis)||!str(d.limitBasis)||!date(d.measuredDate)||d.measuredDate>s.asOf||!positive(d.currentMm)||!positive(d.limitMm)||d.currentMm<d.limitMm)return hold('個体・現径・承認済み計画廃却径・版未確認');
 const history=Array.isArray(s.history)?s.history.map(r=>r&&({...r,status:date(r.inboundDate)&&r.inboundDate<=s.asOf&&r.sourceRevision===s.sourceRevision?r.status:'unverified'})):[];
 const cut=meanCut(k,history);
 if(!positive(cut.value))return {...hold('有効な実績平均改削量なし'),cut};
 const state=finalState(d.currentMm,d.limitMm,cut.value),next=Math.round((d.currentMm-cut.value)*1e6)/1e6;
 if(state==='unknown'||next<=0)return {...hold('径計算未成立'),cut};
 const n=Math.max(0,Math.ceil(Math.round((d.currentMm-d.limitMm)*1e6)/1e6/cut.value-1e-9)-1);
 return {...base,status:state==='final'?'final-use':state==='boundary'?'boundary-review':'rework-candidate',currentMm:d.currentMm,limitMm:d.limitMm,nextDiameter:next,remainingReworks:n,cut,limitBasis:d.limitBasis,measurementBasis:d.basis,extensionReview:state!=='rework',extensionApproved:false,reason:state==='final'?'次回平均改削後が廃却径未満。現径を最終使用と見込む':state==='boundary'?'次回径が廃却径と同値。境界確認まで安全側の購入検討':'次回平均改削後は廃却径より大きい。実改削量は未確定'};
}
function previewAnnualDiameterGate(input,api){
 const s=input||{},a=s.actual||{},r=previewNextPhysicalCycle(s,api),h=r.nextCycle?.rollHandover;
 const baseline=previewAnnualReworkLedger({...s,nextDispatchPlan:null},api);
 const out={...baseline,life:null,retirement:null,purchaseNeed:null,operationAuthorized:false,writeAllowed:false};
 if(h?.status!=='conditional-handover')return {...out,unresolved:[...out.unresolved,'次回交換個体未確認']};
 const d=s.diameter||{};
 const life=assessDiameterLife({anonymousOnly:s.next?.anonymousOnly,asOf:a.asOf,snapshotId:a.snapshotId,sourceRevision:a.sourceRevision,diameter:d,history:s.diameterHistory});
 if(d.identity!==h.oldIdentity||String(d.stand)!==h.stand||life.status==='held')return {...out,life,unresolved:[...out.unresolved,'交換個体の径・寿命未確認']};
 if(life.status==='rework-candidate')return {...previewAnnualReworkLedger(s,api),life,retirement:null,purchaseNeed:null};
 const u=s.finalUseStart||{};
 const startOk=u.identity===h.oldIdentity&&u.snapshotId===a.snapshotId&&u.sourceRevision===a.sourceRevision&&u.status==='actual'&&str(u.basis)&&date(u.date)&&u.date<=a.asOf&&u.date<=h.date&&u.date>=d.measuredDate;
 const assembled=r.nextCycle.assemblyHandover?.status==='conditional-assembly';
 const retirement={status:'forecast-only',identity:h.oldIdentity,onlineExitDate:h.date,retirementCandidateDate:assembled?r.nextCycle.assemblyHandover.date:null,actualRetired:false,reason:life.reason,oldReserveMustRemainUntilHandover:true,extensionApproved:false};
 return {...out,life,retirement,purchaseNeed:{status:'forecast-need',identity:h.oldIdentity,idealReadyBefore:startOk?u.date:null,latestReadyBy:h.date,actualOrdered:false,actualReceived:false,issueMonth:null,accountingMonth:null,reason:life.reason},unresolved:[...out.unresolved,'後継確保・組替と廃却実行未確認',...(!startOk?['最終径使用開始日未確認']:[])]};
}
module.exports={assessDiameterLife,previewAnnualDiameterGate};
