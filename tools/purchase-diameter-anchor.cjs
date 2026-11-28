'use strict';
// R12/R21/R22: new purchase specification is not a measurement.
const {meanCut,finalState}=require('../test/fixtures/annual-projection/tonnage-circulation.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
function assessPurchasedDiameter(s,role,evidence,event){
 const base={status:'held',forecastOnly:true,actualMeasurement:false,actualReceipt:false,operationAuthorized:false,writeAllowed:false};
 const fail=reason=>({...base,reason});
 const a=evidence?.purchaseAnchor,m=a?.master,p=a?.admission,u=role?.purchaseFirstUse,k=String(role?.stand),identity=role&&id(role);
 if(s.anonymousOnly!==true||!day(s.asOf)||!day(event?.date)||event.date<s.asOf||!same(s,evidence)||!same(s,a)||!same(s,m)||!same(s,p)||!/^([2-9]|1[0-7])$/.test(k)||!str(role?.rollId)||!str(role?.generation)||role.purchaseSuccessor!==true||m.status!=='new-purchase-forecast'||m.identity!==identity||m.rollId!==role.rollId||String(m.standKey)!==k||m.generation!==role.generation||m.diameterMm!==role.diameterMm||p.newIdentity!==identity||p.status!=='conditional-slot-replacement'||p.actualAdmission!==false||p.actualReceipt!==false||p.master?.identity!==identity||p.master?.diameterMm!==m.diameterMm||!day(p.date)||!day(p.expectedReceiptDate)||p.expectedReceiptDate>p.date)return fail('新品仕様・受入・個体未確認');
 if(!u||u.identity!==identity||u.forecastOnly!==true||u.actualIssue!==false||u.actualIssueDate!==null||!day(u.firstUseDate)||!day(u.exchangeDate)||u.firstUseDate<=u.exchangeDate||u.exchangeDate<p.date||u.firstUseDate>event.date||u.plannedIssueMonth!==u.firstUseDate.slice(0,7))return fail('新品初回使用予定未確認');
 const d=a.limit;if(!same(s,d)||d.identity!==identity||d.approved!==true||!Number.isFinite(d.mm)||d.mm<=0||!Number.isFinite(m.diameterMm)||m.diameterMm<d.mm)return fail('個体別承認廃却径未確認');
 const history=Array.isArray(a.history)?a.history.map(r=>r&&({...r,status:day(r.inboundDate)&&r.inboundDate<=s.asOf&&r.sourceRevision===s.sourceRevision?r.status:'unverified'})):[];
 const cut=meanCut(k,history),state=finalState(m.diameterMm,d.mm,cut.value),next=Math.round((m.diameterMm-cut.value)*1e6)/1e6;
 if(state==='unknown'||!Number.isFinite(next)||next<=0)return fail('有効実績平均・径計算未確認');
 return {...base,status:state==='final'?'final-use':state==='boundary'?'boundary-review':'rework-candidate',identity,currentMm:m.diameterMm,limitMm:d.mm,nextDiameter:next,remainingReworks:Math.max(0,Math.ceil(Math.round((m.diameterMm-d.mm)*1e6)/1e6/cut.value-1e-9)-1),cut,limitBasis:d.basis,measurementBasis:null,purchaseSpecificationBasis:m.basis,extensionApproved:false,reason:'新品仕様径と実績平均からの予測'};
}
module.exports={assessPurchasedDiameter};
