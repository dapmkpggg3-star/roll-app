'use strict';
// Anonymous, read-only revision gate; never overwrites the previous snapshot.
// The storage adapter must persist archive and version identity before adoption.
const {previewPcStandYear}=require('./pc-stand-year-matrix.cjs');
const {previewPcPurchaseWarnings}=require('./pc-purchase-warning.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const month=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
const copy=x=>JSON.parse(JSON.stringify(x));
const canon=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canon).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}';
const actualKey=e=>JSON.stringify([String(e.stand),e.rollId,e.kind,e.kind==='rework-inbound'?e.cycleId:null]);
function fact(e){const {snapshotId,sourceRevision,...rest}=e;return {...rest,stand:String(rest.stand)};}
function valid(i){return i?.anonymousOnly===true&&day(i.asOf)&&str(i.snapshotId)&&str(i.sourceRevision)&&month(i.startMonth)&&Number.isInteger(i.fiscalYear)&&i.fiscalYear>=2000&&i.fiscalYear<=9997&&Array.isArray(i.actualEvents)&&Array.isArray(i.circulations)&&(i.procurementRecords==null||Array.isArray(i.procurementRecords));}
function actualGroups(i,held,label){
 const m=new Map();
 for(const e of i.actualEvents){
  if(!e||e.status!=='actual'||e.snapshotId!==i.snapshotId||e.sourceRevision!==i.sourceRevision||!/^([2-9]|1[0-7])$/.test(String(e.stand))||!str(e.rollId)||!['rework-inbound','first-use'].includes(e.kind)||(e.kind==='rework-inbound'&&!str(e.cycleId))||!day(e.date)||e.date>i.asOf||!str(e.basis)){held.push({reason:label+'実績入力未確認'});continue;}
  const k=actualKey(e);if(!m.has(k))m.set(k,[]);m.get(k).push(e);
 }
 for(const [k,es] of m)if(new Set(es.map(e=>e.date)).size!==1)held.push({reason:label+'実績日付競合',key:k});
 return m;
}
function orders(i,held,label){
 const m=new Map();
 for(const r of i.procurementRecords||[]){
  if(!r||!str(r.demandKey)){held.push({reason:label+'購買需要対応未確認'});continue;}
  if(!['ordered','received','not-ordered'].includes(r.state)){held.push({reason:label+'購買状態未確認',key:r.demandKey});continue;}
  if(r.state==='not-ordered'){
   if(r.orderDate!=null||r.actualArrivalDate!=null||r.orderReference!=null)held.push({reason:label+'未発注記録と発注実績競合',key:r.demandKey});
   continue;
  }
  if(!day(r.orderDate)||r.orderDate>i.asOf||!str(r.orderReference)||!day(r.checkedOn)||r.checkedOn>i.asOf||r.orderDate>r.checkedOn||!str(r.basis)||(r.state==='received'&&(!day(r.actualArrivalDate)||r.actualArrivalDate<r.orderDate||r.actualArrivalDate>r.checkedOn))||(r.state==='ordered'&&r.actualArrivalDate!=null)){held.push({reason:label+'購買実績未確認',key:r.demandKey});continue;}
  if(m.has(r.demandKey)){held.push({reason:label+'同一需要購買実績複数・照合必要',key:r.demandKey});continue;}
  m.set(r.demandKey,r);
 }
 return m;
}
function previewPcPlanRevision(previous,next,{changedMonth,archiveId}={}){
 const out={eligibleForPreview:false,held:[],archive:null,nextPreview:null,previousPreview:null,complete:false,writeAllowed:false,operationAuthorized:false};
 if(!valid(previous)||!valid(next)||!str(archiveId)||!month(changedMonth)){out.held.push({reason:'計画版・差替月・保護対象未確認'});return out;}
 const held=out.held;
 if(previous.snapshotId===next.snapshotId||previous.sourceRevision===next.sourceRevision||next.asOf<previous.asOf||previous.startMonth!==next.startMonth||previous.fiscalYear!==next.fiscalYear)held.push({reason:'新旧版識別・年度・基準日不整合'});
 if(changedMonth<previous.asOf.slice(0,7))held.push({reason:'過去月差替は自動適用せず要確認'});
 const oldActual=actualGroups(previous,held,'旧版'),newActual=actualGroups(next,held,'新版');
 for(const [key,es] of oldActual){
  const ns=newActual.get(key)||[];
  if(es.some(e=>!ns.some(n=>canon(fact(n))===canon(fact(e)))))held.push({reason:'確定実績の削除・変更を検出',key});
 }
 for(const [key,es] of newActual){
  const old=oldActual.get(key)||[];
  for(const e of es)if(!old.some(n=>canon(fact(n))===canon(fact(e)))&&e.date<=previous.asOf)held.push({reason:'過去実績追加・訂正は別途承認',key});
 }
 const oldOrders=orders(previous,held,'旧版'),newOrders=orders(next,held,'新版');
 for(const [key,a] of oldOrders){
  const b=newOrders.get(key);
  if(!b||b.orderDate!==a.orderDate||b.orderReference!==a.orderReference||b.checkedOn<a.checkedOn||(a.state==='received'&&(b.state!=='received'||b.actualArrivalDate!==a.actualArrivalDate)))held.push({reason:'発注・搬入実績の削除・変更を検出',key});
 }
 for(const [key,b] of newOrders)if(!oldOrders.has(key)&&b.orderDate<=previous.asOf)held.push({reason:'過去発注追加・訂正は別途承認',key});
 const prior=previewPcStandYear(previous),candidate=previewPcStandYear(next),oldWarning=previewPcPurchaseWarnings(previous),newWarning=previewPcPurchaseWarnings(next);
 // A disappeared open requirement is not presumed cancelled by a new forecast.
 for(const a of oldWarning.rows){
  const b=newWarning.rows.find(x=>x.demandKey===a.demandKey);
  if(!b&&a.state!=='搬入済み')held.push({reason:'旧購入需要消失・取消根拠要確認',key:a.demandKey});
 }
 for(const e of prior.ledger?.entries||[]){
  if(e.status!=='actual')continue;
  const n=candidate.ledger?.entries.find(x=>x.key===e.key);
  if(!n||n.status!=='actual'||n.date!==e.date)held.push({reason:'新版集計から確定実績消失',key:e.key});
 }
 out.archive={archiveId,sourceRevision:previous.sourceRevision,snapshotId:previous.snapshotId,input:copy(previous),annual:copy(prior),purchaseWarnings:copy(oldWarning),storageVerified:false};
 out.previousPreview=copy(prior);
 if(held.length)return out;
 out.eligibleForPreview=true;out.nextPreview={annual:candidate,purchaseWarnings:newWarning,sourceRevision:next.sourceRevision,snapshotId:next.snapshotId,changedMonth};
 return out;
}
module.exports={previewPcPlanRevision};
