'use strict';
// R15/R21/R22: PC-only preview, 18 months; never infer completeness or amounts.
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const month=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
function previewPcEventMonths(s={}){
 const base={months:[],entries:[],outside:[],held:[],complete:false,forecastOnly:true,writeAllowed:false,operationAuthorized:false};
 if(s.anonymousOnly!==true||!month(s.startMonth)||!day(s.asOf)||!str(s.sourceRevision)||!str(s.snapshotId)||!Array.isArray(s.events))return {...base,held:[{reason:'集計基準・入力未確認'}]};
 const [y,m]=s.startMonth.split('-').map(Number);if(y<2000||y>9997)return {...base,held:[{reason:'集計開始年月範囲外'}]};
 const months=Array.from({length:18},(_,i)=>({month:String(y+Math.floor((m-1+i)/12))+'-'+String((m-1+i)%12+1).padStart(2,'0'),actualReworkKnown:null,forecastReworkKnown:null,actualIssueKnown:null,forecastIssueKnown:null,complete:false}));
 const groups=new Map(),held=[],entries=[],outside=[];
 for(const e of s.events){
  const k=String(e?.stand),kind=e?.kind;
  if(!/^([2-9]|1[0-7])$/.test(k)||!str(e?.rollId)||!['rework-inbound','first-use'].includes(kind)||(kind==='rework-inbound'&&!str(e.cycleId))){held.push({reason:'イベント個体・回次未確認'});continue;}
  const key=JSON.stringify([k,e.rollId,kind,kind==='rework-inbound'?e.cycleId:null]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(e);
 }
 for(const [key,rows] of groups){
  const valid=e=>e.snapshotId===s.snapshotId&&e.sourceRevision===s.sourceRevision&&str(e.basis)&&day(e.date)&&['actual','forecast'].includes(e.status)&&(e.status!=='actual'||e.date<=s.asOf);
  if(rows.some(e=>!valid(e))){held.push({key,reason:'実績・予測・出典未確認'});continue;}
  const actual=rows.filter(e=>e.status==='actual'),forecast=rows.filter(e=>e.status==='forecast');
  const selected=actual.length?actual:forecast;
  if(new Set(selected.map(e=>e.date)).size!==1){held.push({key,reason:'同一イベント日付競合'});continue;}
  const e=selected[0],entry={key,stand:String(e.stand),rollId:e.rollId,cycleId:e.kind==='rework-inbound'?e.cycleId:null,kind:e.kind,status:e.status,date:e.date,month:e.date.slice(0,7),basis:[...new Set(selected.map(e=>e.basis))],supersededForecastDates:actual.length?[...new Set(forecast.map(e=>e.date))]:[],accountingAmount:null};
  entries.push(entry);
  const dest=months.find(x=>x.month===entry.month);
  if(!dest){outside.push(entry);continue;}
  const field=(entry.status==='actual'?'actual':'forecast')+(entry.kind==='first-use'?'IssueKnown':'ReworkKnown');
  dest[field]=(dest[field]??0)+1;
 }
 return {...base,months,entries,held,outside};
}
module.exports={previewPcEventMonths};
