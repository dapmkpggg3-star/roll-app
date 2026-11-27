'use strict';
// PC-only: known entries are not a complete annual total.
const {previewNextPhysicalCycle}=require('./second-physical-cycle.cjs');
const {previewCampaignRework}=require('./campaign-rework-forecast.cjs');
function previewAnnualReworkLedger(input,api){
 const s=input||{},a=s.actual||{},year=s.fiscalYear;
 const out={status:'held',complete:false,operationAuthorized:false,writeAllowed:false,months:[],entries:[],unresolved:[],outsideFiscalYear:[],annualTotal:null};
 if(!Number.isInteger(year)||year<2000||year>9998)return {...out,unresolved:['年度未確認']};
 const months=Array.from({length:12},(_,i)=>({month:String(year+Math.floor((i+3)/12))+'-'+String((i+3)%12+1).padStart(2,'0'),actualKnownCount:null,plannedKnownCount:null,complete:false}));
 const entries=[],unresolved=[],seen=new Set();
 const add=(p,status,date,basis)=>{const key=JSON.stringify([p.stand,p.rollId,p.generation,p.cycleId]);if(seen.has(key)){unresolved.push('同一改削回次の重複');return;}seen.add(key);entries.push({key,stand:p.stand,rollId:p.rollId,generation:p.generation,cycleId:p.cycleId,status,date,month:date.slice(0,7),originalExpectedInbound:p.expectedInboundDate,basis,rule:'R21: 搬入月に改削費を計上',stockConfirmed:false});};
 const r=previewNextPhysicalCycle(s,api),p=r.receipt?.originalForecast;
 if(r.receipt?.receiptConfirmed===true&&p?.status==='conditional-rework')add(p,'actual',r.receipt.actualInboundDate,a.receipt.basis);
 else unresolved.push('第1回次の搬入実績未確認');
 let nextForecast=null;
 if(r.status==='second-cycle-preview'){
  const d=s.nextDispatchPlan;
  if(!d||d.cycleId===p.cycleId)unresolved.push('第2回次の独立した搬出予定・回次未確認');
  else{
   const n={...s.next,roles:a.currentRoles,onlineRows:a.onlineRows,masterRows:a.masterRows,usageRows:a.usageRows,dispatchPlan:d};
   nextForecast=previewCampaignRework(n,api).reworkForecast;
   if(nextForecast?.status==='conditional-rework')add(nextForecast,'planned',nextForecast.expectedInboundDate,nextForecast.basis);
   else unresolved.push(nextForecast?.reason||'第2回次の搬出予定未成立');
  }
 }else unresolved.push(r.reason||'第2循環未成立');
 const outsideFiscalYear=[];
 for(const e of entries){const m=months.find(m=>m.month===e.month);if(!m){outsideFiscalYear.push(e);continue;}const k=e.status==='actual'?'actualKnownCount':'plannedKnownCount';m[k]=(m[k]??0)+1;}
 return {...out,status:entries.length?'partial-ledger':'held',months,entries,unresolved,outsideFiscalYear,firstCycle:r.receipt,nextForecast};
}
module.exports={previewAnnualReworkLedger};
