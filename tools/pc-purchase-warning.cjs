'use strict';
// PC only, preview only. Reuse the upstream full-horizon procurement deadlines.
// No purchase order is created; no inference of spare availability from procurement.
const {previewPcCirculationEvents}=require('./pc-circulation-event-bridge.cjs');
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const diff=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
const standOK=s=>/^([2-9]|1[0-7])$/.test(String(s));
function demandKey(p){
 try{const a=JSON.parse(p.oldIdentity);if(!Array.isArray(a)||a.length!==3||!standOK(p.stand)||String(a[0])!==String(p.stand)||!nonempty(a[1])||!nonempty(a[2]))return null;
 return JSON.stringify(['successor',String(a[0]),a[1]]);}catch{return null;}
}
function orderDeadline(required,lt){
 if(!day(required)||!lt||!Number.isInteger(lt.value)||lt.value<=0)return null;
 const d=new Date(required+'T00:00:00Z');
 if(lt.unit==='days'&&lt.value<=3650)d.setUTCDate(d.getUTCDate()-lt.value);
 else if(lt.unit==='months'&&lt.value<=120){const targetDay=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-lt.value);const last=new Date(d);last.setUTCMonth(last.getUTCMonth()+1,0);d.setUTCDate(Math.min(targetDay,last.getUTCDate()));}
 else return null;
 const result=d.toISOString().slice(0,10);return day(result)?result:null;
}
function thresholds(settings,stand){
 const proposed=[90,60,30],v=settings?.byStand?.[stand]??settings?.days??proposed;
 if(!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isInteger(x)||x<=0||x>730)||!(v[0]>v[1]&&v[1]>v[2]))return {days:null,approved:false};
 return {days:[...v],approved:false}; // no field promotes an unapproved design to operational status
}
function deadlineLevel(n,t){
 if(n<0)return '期限超過';if(n===0)return '発注期限当日';if(!t)return '警告設定未確認';
 return n<=t[2]?'発注注意':n<=t[1]?'発注準備確認':n<=t[0]?'購入準備':'購入予定';
}
function procurementState(records,asOf){
 if(!records.length)return {state:'発注状況未確認'};
 const v=records[0],signature=x=>JSON.stringify([x.state,x.orderDate??null,x.actualArrivalDate??null,x.confirmedDeliveryDate??null,x.estimatedDeliveryDate??null,x.checkedOn,x.orderReference??null,x.basis]);
 if(records.some(x=>signature(x)!==signature(v)))return {state:'発注状況未確認',problem:'購買記録競合'};
 if(!day(v.checkedOn)||v.checkedOn>asOf||!nonempty(v.basis))return {state:'発注状況未確認',problem:'購買照合日・出典未確認'};
 const invalid=(field,actual=false)=>v[field]!=null&&(!day(v[field])||(actual&&v[field]>v.checkedOn));
 if(['orderDate','actualArrivalDate'].some(k=>invalid(k,true))||['confirmedDeliveryDate','estimatedDeliveryDate'].some(k=>invalid(k)))return {state:'発注状況未確認',problem:'購買日付不正'};
 if(v.state==='not-ordered'&&v.orderDate==null&&v.actualArrivalDate==null&&v.confirmedDeliveryDate==null&&v.estimatedDeliveryDate==null){
  if(v.checkedOn!==asOf)return {state:'発注状況未確認',problem:'未発注照合日が基準日より前'};
  return {state:'未発注',checkedOn:v.checkedOn,basis:v.basis};
 }
 if(!['ordered','received'].includes(v.state)||!day(v.orderDate)||!nonempty(v.orderReference)||v.orderDate>v.checkedOn)return {state:'発注状況未確認',problem:'発注実績根拠未確認'};
 if((v.state==='ordered'&&v.actualArrivalDate!=null)||(v.state==='received'&&(!day(v.actualArrivalDate)||v.actualArrivalDate<v.orderDate))||['confirmedDeliveryDate','estimatedDeliveryDate'].some(k=>v[k]!=null&&v[k]<v.orderDate))return {state:'発注状況未確認',problem:'発注・搬入日順序不正'};
 return {state:v.state==='received'?'搬入済み':v.confirmedDeliveryDate?'発注済み・納期確定':v.estimatedDeliveryDate?'発注済み・納期見込':'発注済み・納期未回答',orderDate:v.orderDate,orderReference:v.orderReference,actualArrivalDate:v.actualArrivalDate??null,confirmedDeliveryDate:v.confirmedDeliveryDate??null,estimatedDeliveryDate:v.estimatedDeliveryDate??null,checkedOn:v.checkedOn,basis:v.basis};
}
function previewPcPurchaseWarnings(input={}){
 const result={rows:[],held:[],complete:false,writeAllowed:false,operationAuthorized:false,notificationAuthorized:false};
 if(input.anonymousOnly!==true||!day(input.asOf)||!nonempty(input.snapshotId)||!nonempty(input.sourceRevision)||!Array.isArray(input.circulations)||!Array.isArray(input.actualEvents))return {...result,held:[{reason:'匿名予測・基準日未確認'}]};
 const upstream=previewPcCirculationEvents(input);result.held.push(...upstream.held);
 const groups=new Map(),records=new Map();
 for(const p of upstream.purchaseGuidance){const k=demandKey(p);if(!k){result.held.push({reason:'後継対象未確認',stand:p.stand});continue;}if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
 const recordInput=input.procurementRecords??[];
 if(!Array.isArray(recordInput)){result.held.push({reason:'購買照合入力未確認'});}else for(const v of recordInput){
  if(!v||!nonempty(v.demandKey)){result.held.push({reason:'購買実績と後継需要の対応未確認'});continue;}
  if(!records.has(v.demandKey))records.set(v.demandKey,[]);records.get(v.demandKey).push(v);
 }
 // An unmatched past order is visible for review, not assigned to a guessed successor.
 for(const [k,rs] of records)if(!groups.has(k))result.held.push({reason:'購入需要未接続の購買履歴',demandKey:k,records:rs.map(x=>({...x}))});
 for(const [k,ps] of groups){
  const p=ps[0],t=thresholds(input.warningSettings,p.stand),proc=procurementState(records.get(k)||[],input.asOf);
  const warnings=[],conflict=ps.some(q=>q.latestOrderBy!==p.latestOrderBy||q.latestArrivalBy!==p.latestArrivalBy||q.idealOrderBy!==p.idealOrderBy||q.idealArrivalBy!==p.idealArrivalBy||q.oldIdentity!==p.oldIdentity);
  const n=conflict?null:diff(p.latestOrderBy,input.asOf),deadline=conflict?null:p.latestOrderBy,required=conflict?null:p.latestArrivalBy;
  if(conflict)warnings.push('購入期限競合・要確認');
  if(!t.days)warnings.push('警告設定未確認');
  if(proc.state==='発注状況未確認')warnings.push('発注状況未確認・購買照合');
  if(n!==null&&(proc.state==='未発注'||proc.state==='発注状況未確認')){
   const label=deadlineLevel(n,t.days);warnings.push(proc.state==='未発注'?label:'期限目安：'+label);
  }
  if(proc.problem)warnings.push(proc.problem);
  let lateDays=null,estimateLateDays=null,actualLateDays=null;
  if(proc.state.startsWith('発注済み')){
   if(proc.state==='発注済み・納期未回答')warnings.push('納期未回答');
   if(required&&proc.confirmedDeliveryDate){lateDays=diff(proc.confirmedDeliveryDate,required);if(lateDays>0)warnings.push('確定納期遅延');}
   if(required&&proc.estimatedDeliveryDate&&!proc.confirmedDeliveryDate){estimateLateDays=diff(proc.estimatedDeliveryDate,required);if(estimateLateDays>0)warnings.push('納期遅延見込み');}
   if(required&&input.asOf>required)warnings.push('必要搬入期限超過・未搬入');
   if(proc.confirmedDeliveryDate&&input.asOf>proc.confirmedDeliveryDate)warnings.push('確定納期超過・未搬入');
  }
  if(proc.state==='搬入済み'){if(required){actualLateDays=diff(proc.actualArrivalDate,required);if(actualLateDays>0)warnings.push('搬入遅延実績');}warnings.push('組込・適合は別途確認');}
  result.rows.push({demandKey:k,stand:p.stand,oldIdentity:p.oldIdentity,deadline,requiredArrival:required,daysRemaining:n,idealOrderBy:conflict?null:p.idealOrderBy,idealArrivalBy:conflict?null:p.idealArrivalBy,warningDays:t.days,warningSettingsApproved:false,...proc,warnings,lateDays,estimateLateDays,actualLateDays,sourceRevision:input.sourceRevision,forecastOnly:true,accountingMonth:null,spareStatus:'別途循環・現物確認',evidence:ps.map(x=>({...x})),orderHistory:(records.get(k)||[]).map(x=>({...x}))});
 }
 return result;
}
module.exports={previewPcPurchaseWarnings,orderDeadline};
