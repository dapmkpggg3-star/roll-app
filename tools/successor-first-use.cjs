'use strict';
// R05/R21/R22: first production, not receipt or installation, is the issue date.
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const physical=r=>JSON.stringify([String(r.stand),r.rollId]);
const copy=x=>JSON.parse(JSON.stringify(x));
function forecastFirstPurchaseUse(s,stage,sequence,roles,api){
 const result={roles:copy(roles),issues:[],pending:[],held:[],actualIssue:false,writeAllowed:false};
 const e=sequence.events.find(e=>e.rollChanged);
 if(!e)return result;
 for(const r of result.roles.filter(r=>r.status==='online'&&r.purchaseSuccessor===true)){
  const records=[r,...stage.roles].filter(q=>physical(q)===physical(r)&&q.purchaseFirstUse!=null).map(q=>q.purchaseFirstUse);
  if(records.length){
   const valid=u=>u&&String(u.stand)===String(r.stand)&&u.rollId===r.rollId&&typeof u.generation==='string'&&u.identity===id(u)&&u.forecastOnly===true&&u.actualIssue===false&&u.actualIssueDate===null&&day(u.exchangeDate)&&day(u.firstUseDate)&&u.exchangeDate<u.firstUseDate&&u.firstUseDate<=e.date&&u.plannedIssueMonth===u.firstUseDate.slice(0,7);
   // Same exchange replay may precede the first production date; retain its original evidence.
   const replay=u=>u&&u.identity===id(r)&&u.exchangeDate===e.date&&day(u.firstUseDate)&&u.firstUseDate>e.date&&u.forecastOnly===true&&u.actualIssue===false&&u.actualIssueDate===null&&String(u.stand)===String(r.stand)&&u.rollId===r.rollId&&u.plannedIssueMonth===u.firstUseDate.slice(0,7);
   if(records.some(u=>!valid(u)&&!replay(u))||records.some(u=>JSON.stringify(u)!==JSON.stringify(records[0]))){result.held.push({stand:String(r.stand),reason:'物理個体の初回払出履歴不一致',requiredExchange:null});continue;}
   r.purchaseFirstUse=copy(records[0]);continue;
  }
  const k=String(r.stand),identity=id(r),h=stage.handovers.find(h=>h.stand===k&&h.targetIdentity===identity),prior=stage.roles.find(q=>id(q)===identity);
  if(!prior||prior.status!=='new-standby'||prior.chockAssembled!==true||prior.emergencyEligible!==true||!day(prior.purchaseAssemblyDate)||!day(prior.purchaseAdmissionDate)||prior.purchaseAdmissionDate>prior.purchaseAssemblyDate||prior.purchaseAssemblyDate>=e.date||h?.date!==prior.purchaseAssemblyDate||h.actualCompletion!==false||!e.newGroup.members.some(m=>m.identity===identity)){result.held.push({stand:k,reason:'新品初回使用の組替・交換根拠未確認',requiredExchange:true});continue;}
  let date=api.addDays(e.date,1),first=null;
  for(;date<=s.throughDate;date=api.addDays(date,1)){
   const rows=s.days.filter(d=>d.date===date),d=rows[0];
   if(rows.length!==1||d.snapshotId!==s.snapshotId||d.sourceRevision!==s.sourceRevision||d.dateRowVerified!==true||d.recordKind!=='plan'||!Number.isFinite(d.productionAmount)||d.productionAmount<0){result.held.push({stand:k,reason:'初回操業日未確認',requiredExchange:null});break;}
   if(d.productionAmount>0){first=date;break;}
  }
  if(!first){result.pending.push({stand:k,identity,exchangeDate:e.date,plannedIssueMonth:null,reason:'期間内の初回使用日未確認'});continue;}
  const issue={stand:k,identity,rollId:r.rollId,generation:r.generation,exchangeDate:e.date,firstUseDate:first,plannedIssueMonth:first.slice(0,7),actualIssueDate:null,actualIssue:false,accountingMonth:null,forecastOnly:true,basis:'組替・交換後の最初の確認済み操業予定'};
  r.purchaseFirstUse=issue;result.issues.push(issue);
 }
 return result;
}
module.exports={forecastFirstPurchaseUse};
