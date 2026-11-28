'use strict';
// R14/R15/R21/R22: consume explicit conditional circulation outputs, not raw role guesses.
const {previewPcEventMonths}=require('./pc-event-month-ledger.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
function identity(s,k){try{const a=JSON.parse(s);return Array.isArray(a)&&a.length===3&&String(a[0])===String(k)&&/^([2-9]|1[0-7])$/.test(String(k))&&str(a[1])&&str(a[2])?a:null;}catch{return null;}}
function previewPcCirculationEvents(s={}){
 const events=[],held=[],purchaseGuidance=[],pending=[];
 const base={events,held,purchaseGuidance,pending,ledger:null,complete:false,writeAllowed:false,operationAuthorized:false};
 if(s.anonymousOnly!==true||!str(s.snapshotId)||!str(s.sourceRevision)||!day(s.asOf)||!Array.isArray(s.circulations)||!Array.isArray(s.actualEvents))return {...base,held:[{reason:'循環・実績入力未確認'}]};
 const tag={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision};
 for(const e of s.actualEvents){if(!same(s,e)||e.status!=='actual'){held.push({reason:'実績入力の出典・区分未確認'});continue;}events.push({...e});}
 // Preserve upstream flags as evidence, not as verified current spare counts.
 const collectHold=(h,source,depth=0)=>{
  if(!h||typeof h!=='object'||depth>8){held.push({source,reason:'警告詳細未確認'});return;}
  const row={source,reason:str(h.reason)?h.reason:'循環保留',stand:h.stand??null,forecastOnly:true};
  if(typeof h.requiredExchange==='boolean'||h.requiredExchange===null)row.requiredExchange=h.requiredExchange;
  if(typeof h.oldReserveRetained==='boolean')row.oldReserveRetained=h.oldReserveRetained;
  if(day(h.exchangeDate))row.exchangeDate=h.exchangeDate;
  if(day(h.date))row.date=h.date;
  if(str(h.demandId))row.demandId=h.demandId;
  if(Array.isArray(h.warnings))row.warnings=h.warnings.filter(str);
  if(row.requiredExchange===true)row.exchangeStatus='交換需要あり・未成立';
  else if(row.requiredExchange===null)row.exchangeStatus='交換需要の判定未確認';
  if(row.oldReserveRetained===true)row.spareStatus='旧予備保持の予測根拠あり・現物別確認';
  else if(row.oldReserveRetained===false)row.spareStatus='旧予備保持未成立または未確認・現物照合';
  held.push(row);
  if(Array.isArray(h.details))for(const d of h.details)collectHold(d,source+'/detail',depth+1);
 };
 const visit=(node,source)=>{
  if(!node)return;
  if(node.writeAllowed===true||node.operationAuthorized===true){held.push({source,reason:'予測専用出力ではない'});return;}
  for(const h of node.held||[])collectHold(h,source);
  for(const w of node.workshopInstructions||[]){
   if(w?.status==='held'||w?.warnings?.length){
    collectHold({stand:w.stand,reason:'工作期限・組替成立性の警告',warnings:w.warnings},source+'/workshop');
    const last=held[held.length-1];
    if(day(w.assemblyDeadline))last.assemblyDeadline=w.assemblyDeadline;
    if(day(w.dispatchDeadline))last.dispatchDeadline=w.dispatchDeadline;
    // The deadline helper defaults oldReserveRetained=true even on invalid roles.
    // Do not infer actual reserve retention from that field.
   }
  }
  for(const d of node.dispositions||[]){
   const a=identity(d?.identity,d?.stand),r=d?.rework,p=d?.procurement;
   if(d?.status==='conditional-rework'){
    if(!a||!r||r.receiptConfirmed!==false||r.actualInboundDate!==null||!day(r.dispatchDate)||!day(r.expectedInboundDate)||r.expectedInboundDate<=r.dispatchDate||!Number.isInteger(r.leadDays)||r.leadDays<=0||Date.parse(r.expectedInboundDate)-Date.parse(r.dispatchDate)!==r.leadDays*86400000||r.plannedReworkCostMonth!==r.expectedInboundDate.slice(0,7)||!str(r.cycleId)||!str(r.basis)){held.push({source,reason:'改削搬入予測根拠未確認',stand:d.stand});continue;}
    events.push({...tag,kind:'rework-inbound',status:'forecast',stand:a[0],rollId:a[1],generation:a[2],cycleId:r.cycleId,date:r.expectedInboundDate,basis:r.basis,source,dispatchDate:r.dispatchDate,forecastDiameterMm:r.forecastDiameterMm});
   }else if(d?.kind==='successor-needed'&&d.status==='successor-review'&&a&&p?.status==='forecast-guidance'&&p.actualReceived===false&&p.accountingMonth===null&&day(p.latestOrderBy)&&day(p.latestArrivalBy)&&p.latestOrderBy<=p.latestArrivalBy&&str(p.leadBasis)){
    purchaseGuidance.push({source,stand:a[0],oldIdentity:d.identity,latestOrderBy:p.latestOrderBy,latestArrivalBy:p.latestArrivalBy,idealOrderBy:p.idealOrderBy??null,idealArrivalBy:p.idealArrivalBy??null,leadBasis:p.leadBasis,reason:d.reason??null,accountingMonth:null,forecastOnly:true});
   }else{held.push({source,stand:d?.stand??null,reason:d?.reason||'処遇・購入根拠未確認'});}
  }
  for(const u of node.plannedIssues||[]){
   const a=identity(u?.identity,u?.stand);
   if(!a||a[1]!==u.rollId||a[2]!==u.generation||u.forecastOnly!==true||u.actualIssue!==false||u.actualIssueDate!==null||!day(u.exchangeDate)||!day(u.firstUseDate)||u.firstUseDate<=u.exchangeDate||u.plannedIssueMonth!==u.firstUseDate.slice(0,7)||!str(u.basis)){held.push({source,reason:'初回使用予測根拠未確認'});continue;}
   events.push({...tag,kind:'first-use',status:'forecast',stand:a[0],rollId:a[1],generation:a[2],date:u.firstUseDate,basis:u.basis,source,exchangeDate:u.exchangeDate});
  }
  for(const u of node.pendingFirstUse||[])pending.push({...u,source});
 };
 for(const [i,c] of s.circulations.entries()){
  const root=c?.result,pre='circulation-'+i;
  if(!same(s,c)||root?.forecastOnly!==true||root.writeAllowed!==false||root.operationAuthorized!==false||!Array.isArray(root.stages)){held.push({source:pre,reason:'循環出力・版未確認'});continue;}
  const t=root.initial?.third?.third;
  visit(t?.second?.first,pre+'/first');visit(t,pre+'/third');visit(root.initial?.third?.stage,pre+'/third-workshop');visit(root.initial?.fourth,pre+'/fourth');
  for(const [j,entry] of root.stages.entries()){visit(entry?.stage,pre+'/stage-'+j);visit(entry?.next,pre+'/next-'+j);}
  visit(root,pre);
  if(root.periodComplete!==true)held.push({source:pre,reason:'期間内の全循環未確認'});
 }
 const ledger=previewPcEventMonths({...s,events});
 return {...base,ledger,held:[...held,...ledger.held]};
}
module.exports={previewPcCirculationEvents};
