'use strict';
// R01/R11/R21: swap the retirement slot, never add a permanent fourth active set.
const {inspectUpperLedger}=require('./caliber-lifetime-policy.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const copy=x=>JSON.parse(JSON.stringify(x));
function previewSuccessorAdmission(s,stage,event,group,plans,knownRollIds,api){
 const roles=copy(stage?.roles||[]),admissions=[],held=[],warnings=[],retiredHistory=[];
 const out={...stage,roles,admissions,held,warnings,retiredHistory,readyForNextRotation:false,forecastOnly:true,actualRetired:false,actualAdmission:false,actualIssue:false,operationAuthorized:false,writeAllowed:false};
 const fail=reason=>{held.push({reason});return out;};
 if(s.anonymousOnly!==true||!day(s.asOf)||!day(s.throughDate)||!day(event?.date)||event.date<s.asOf||event.date>s.throughDate||!['6,7','8,9','10,11'].includes(group?.stands?.join(','))||!stage?.conditionalHandoverComplete||stage.held?.length||!Array.isArray(stage.dispositions)||!Array.isArray(stage.handovers)||!Array.isArray(plans)||!Array.isArray(knownRollIds)||roles.length!==6||new Set(roles.map(r=>r.rollId)).size!==6)return fail('廃却枠・組替・履歴・後継根拠未確認');
 const used=new Set([...knownRollIds,...roles.map(r=>r.rollId)]),pending=[];
 for(const k of group.stands){
  const own=roles.filter(r=>String(r.stand)===k),online=own.find(r=>r.status==='online'),spare=own.find(r=>r.status==='new-standby'),old=own.find(r=>['retirement-review','rework-ready'].includes(r.status)),ds=stage.dispositions.filter(d=>d.stand===k),d=ds[0],hs=stage.handovers.filter(h=>h.stand===k),h=hs[0],ps=plans.filter(q=>String(q?.stand)===k),q=ps[0];
  if(own.length!==3||!online||!spare||!old||ds.length!==1||hs.length!==1||d.identity!==id(old)||h.oldIdentity!==id(old)||h.targetIdentity!==id(spare)||h.status!=='conditional-on-future-receipt'||h.actualCompletion!==false||!day(h.date)||h.date<event.date||h.date>s.throughDate||spare.chockAssembled!==true||spare.emergencyEligible!==true||old.chockAssembled!==false||old.emergencyEligible!==false)return fail('3セット・緊急予備の引継ぎ未成立 #'+k);
  if(old.status==='rework-ready'){if(!d.rework||ps.length)return fail('改削枠に購入品を重複登録しない #'+k);continue;}
  const guide=d.procurement,m=q?.master,receipt=q?.receipt,order=q?.order;
  if(d.kind!=='successor-needed'||d.status!=='successor-review'||d.life?.status!=='final-use'||d.rework||!guide||guide.latestArrivalBy!==event.date||ps.length!==1||!same(s,q)||q.oldIdentity!==id(old)||q.status!=='planned'||q.retireDate!==q.admissionDate||!day(q.admissionDate)||q.admissionDate<h.date||q.admissionDate>s.throughDate||!same(s,m)||String(m.standKey)!==k||!str(m.rollId)||used.has(m.rollId)||!str(m.generation)||m.identity!==JSON.stringify([k,m.rollId,m.generation])||m.status!=='new-purchase-forecast'||!Number.isFinite(m.diameterMm)||m.diameterMm<=d.life.limitMm||!Array.isArray(m.caliberLedger?.calibers)||m.caliberLedger.calibers.some(c=>!['active','unused','unavailable'].includes(c.state)||c.tons!==0&&c.tons!==null||c.runs!==0&&c.runs!==null)||inspectUpperLedger(s,m,group.size,api).status!=='verified-ledger')return fail('最終使用径・後継新品・廃却枠未成立 #'+k);
  if(!same(s,receipt)||receipt.identity!==m.identity||receipt.status!=='forecast'||receipt.actualReceipt!==false||receipt.usableForecast!==true||!day(receipt.date)||receipt.date<s.asOf||receipt.date>guide.latestArrivalBy||receipt.date>q.admissionDate||!same(s,order)||order.identity!==m.identity||!['planned','actual'].includes(order.status)||!day(order.date)||order.status==='planned'&&order.date<s.asOf||order.status==='actual'&&order.date>s.asOf||order.date>guide.latestOrderBy||api.addMonths(order.date,guide.leadMonths)>receipt.date)return fail('発注LT・後継搬入見込み未成立 #'+k);
  if(guide.idealArrivalBy&&receipt.date>guide.idealArrivalBy)warnings.push({stand:k,kind:'最終径使用開始前の後継確保目標超過',idealDate:guide.idealArrivalBy,date:receipt.date});
  used.add(m.rollId);pending.push({k,old,q,m,receipt,order});
 }
 if(plans.length!==pending.length||!pending.length)return fail('後継計画の重複・対象外または不足');
 // Apply atomically to the pair after checking both members. Physical receipt
 // is only a forecast; the admitted successor remains UNASSEMBLED.
 for(const {k,old,q,m,receipt,order} of pending){
  const replacement={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:m.basis,stand:k,rollId:m.rollId,generation:m.generation,diameterMm:m.diameterMm,status:'new-unassembled',chockAssembled:false,emergencyEligible:false,forecastOnly:true,purchaseSuccessor:true,admittedOn:q.admissionDate};
  const a={stand:k,oldIdentity:id(old),newIdentity:m.identity,date:q.admissionDate,expectedReceiptDate:receipt.date,orderDate:order.date,actualOrder:order.status==='actual',actualRetired:false,actualAdmission:false,actualReceipt:false,issueMonth:null,accountingMonth:null,master:copy(m),receipt:copy(receipt),status:'conditional-slot-replacement'};
  retiredHistory.push({...copy(old),status:'retirement-forecast',retirementDate:q.retireDate,actualRetired:false,successorIdentity:m.identity});
  roles.splice(roles.indexOf(old),1,replacement);admissions.push(a);
 }
 return {...out,readyForNextRotation:true,admissionComplete:true,activeSetsByStand:Object.fromEntries(group.stands.map(k=>[k,roles.filter(r=>String(r.stand)===k).length]))};
}
module.exports={previewSuccessorAdmission};
