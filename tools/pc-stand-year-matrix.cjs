'use strict';
// PC report projection. Blank is not zero; no fiscal completeness inferred.
const {previewPcCirculationEvents}=require('./pc-circulation-event-bridge.cjs');
function previewPcStandYear(s={}){
 const base={rows:[],months:[],detail:[],purchaseGuidance:[],held:[],complete:false,writeAllowed:false,operationAuthorized:false,print:{paper:'A3',orientation:'landscape',pagesWide:1,pagesTall:1,includeCost:false}};
 if(!Number.isInteger(s.fiscalYear)||s.fiscalYear<2000||s.fiscalYear>9997)return {...base,held:[{reason:'年度未確認'}]};
 const r=previewPcCirculationEvents(s),year=s.fiscalYear,months=Array.from({length:12},(_,i)=>String(year+Math.floor((i+3)/12))+'-'+String((i+3)%12+1).padStart(2,'0'));
 const held=[...r.held],detail=[],rows=Array.from({length:16},(_,i)=>({stand:String(i+2),months:months.map(month=>({month,actualRework:null,forecastRework:null,actualIssue:null,forecastIssue:null,latestOrderGuidance:null,detailKeys:[]}))}));
 if(!r.ledger||months.some(m=>!r.ledger.months.some(x=>x.month===m)))held.push({reason:'年度全12月が18か月予測範囲に含まれない'});
 const cell=(k,m)=>rows.find(x=>x.stand===String(k))?.months.find(x=>x.month===m);
 for(const e of r.ledger?.entries||[]){
  const c=cell(e.stand,e.month);
  detail.push({...e,inFiscalYear:!!c});
  if(!c)continue;
  const field=(e.status==='actual'?'actual':'forecast')+(e.kind==='first-use'?'Issue':'Rework');
  c[field]=(c[field]??0)+1;c.detailKeys.push(e.key);
 }
 const byOld=new Map();
 for(const p of r.purchaseGuidance){
  if(!byOld.has(p.oldIdentity))byOld.set(p.oldIdentity,[]);
  byOld.get(p.oldIdentity).push(p);
 }
 const purchaseGuidance=[];
 for(const [id,ps] of byOld){
  const p=ps[0];
  if(ps.some(q=>q.latestOrderBy!==p.latestOrderBy||q.latestArrivalBy!==p.latestArrivalBy||q.idealOrderBy!==p.idealOrderBy||q.idealArrivalBy!==p.idealArrivalBy)){held.push({stand:p.stand,reason:'同一後継購入期限競合',oldIdentity:id});continue;}
  const key=JSON.stringify(['successor',id]),month=p.latestOrderBy.slice(0,7),c=cell(p.stand,month);
  const row={...p,key,month,inFiscalYear:!!c,accountingMonth:null};
  purchaseGuidance.push(row);detail.push(row);
  if(c){c.latestOrderGuidance=(c.latestOrderGuidance??0)+1;c.detailKeys.push(key);}
 }
 return {...base,months,rows,detail,purchaseGuidance,held,pending:r.pending,ledger:r.ledger,scope:'logical PC annual table; not rendered or approved'};
}
module.exports={previewPcStandYear};
