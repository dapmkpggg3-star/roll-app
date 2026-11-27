'use strict';
// Isolated, anonymous PC forecast; not an actual shift ledger or operating approval.
const {previewLinked1217}=require('./linked-12-17-combinations.cjs');
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
function previewLinkedCampaign(input,api){
 const s=input||{}, events=[], unresolved=[];
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const key=(k,r,g,n)=>JSON.stringify([String(k),r,g,n]);
 const copy=x=>JSON.parse(JSON.stringify(x));
 let usageRows=[],selection=null,operatingRuns=0,prev=null;
 const finish=(status)=>({status,complete:status==='campaign-preview-complete',events,unresolved,operatingRuns,endingUsage:usageRows,endingSelection:selection,operationAuthorized:false,writeAllowed:false});
 const hold=(reason,period=null,extra={})=>{unresolved.push({periodId:period?.id??null,date:period?.date??null,reason,...extra});return finish('campaign-preview-held');};
 if(s.anonymousOnly!==true||!['D10','D13'].includes(s.size)||s.grade!=='SD295'||s.timelineVerified!==true||!str(s.timelineBasis)||!Array.isArray(s.periods)||!s.periods.length||s.periods.length>1000||!Array.isArray(s.usageRows))return hold('対象・SD295単一キャンペーン・連続時系列未確認');
 const localDate=t=>new Date((t+540)*60000).toISOString().slice(0,10);
 const validMinute=t=>Number.isSafeInteger(t)&&Math.abs(t)<1e10;
 const ids=new Set(),shifts=new Set();
 let last=null;
 // Validate the whole timeline first: no gaps, duplicated shift IDs or hidden operating time.
 for(const p of s.periods){
  if(!p||!str(p.id)||ids.has(p.id)||!validMinute(p.start)||!validMinute(p.end)||p.end<=p.start||p.end-p.start>1440||!str(p.basis)||p.confirmed!==true||p.dateRowVerified!==true||p.date!==localDate(p.start)||!['production','stop','unavailable'].includes(p.type)||(last!==null&&p.start!==last))return hold('期間の欠損・重複・日付・根拠未確認',p);
  ids.add(p.id);last=p.end;
  if(p.type==='production'){
   if(!str(p.shiftId)||shifts.has(p.shiftId)||!Number.isInteger(p.productionMinutes)||p.productionMinutes<=0||p.productionMinutes>p.end-p.start||!['D10','D13'].includes(p.size)||!['SD295','SD345'].includes(p.grade))return hold('生産勤・実生産時間・鋼種サイズ未確認',p);
   shifts.add(p.shiftId);
  }
 }
 const masters=['12','13','14','15','16','17'].map(k=>resolveOnlineCaliberMaster(s,k));
 if(masters.some(r=>r.status!=='resolved'))return hold('開始時オンライン個体・配置未確認');
 selection=copy(s.selection||{});usageRows=copy(s.usageRows);
 const canFit=(candidate,stop,p)=>{
  if(!stop||stop.type!=='stop'||stop.end!==p.start||stop.dateRowVerified!==true||stop.lineStopped!==true||!['常昼','Ⅰ勤A','Ⅰ勤B','Ⅲ勤A','Ⅲ勤B'].includes(stop.team)||!Number.isInteger(stop.capacity)||stop.capacity<=0||!str(stop.capacityBasis)||!Array.isArray(stop.eligibility)||stop.date!==localDate(stop.end-1)||candidate.columnChange||candidate.referenceMinutes>stop.end-stop.start||candidate.changeCount>stop.capacity)return false;
  return candidate.changes.every(group=>{
   const k=group.slice().sort().join(',');
   const records=stop.eligibility.filter(e=>e&&Array.isArray(e.stands)&&e.stands.slice().sort().join(',')===k);
   return records.length===1&&str(records[0].basis)&&records[0].preparationReady===true&&records[0].reserveReady===true&&records[0].pairReady===true&&records[0].additionalReady===true&&records[0].safetyBlocked===false;
  });
 };
 for(const p of s.periods){
  if(p.type!=='production'){prev=p;continue;}
  if(p.size!==s.size||p.grade!==s.grade)return hold('サイズ・鋼種切替は未接続',p);
  if(p.productionMinutes>=120&&p.productionMinutes<240)return hold('2〜4h未満は提案のみ・確定消費しない',p);
  const runs=p.productionMinutes>=240?1:0;
  const search=previewLinked1217({...s,selection,usageRows},api);
  const candidates=search.candidates||[];
  const current=candidates.find(c=>c.changeCount===0&&c.remainingRuns>=1);
  let chosen=current;
  if(!chosen){
   const required={requiredExchange:true,candidateCount:candidates.length,searchComplete:search.searchComplete===true,issues:search.issues||[]};
   // Unknown does not prove exhaustion, and a column switch requires upstream approval.
   if(!search.searchComplete)return hold('候補根拠未確認・交換要否保留',p,{...required,requiredExchange:null});
   chosen=candidates.find(c=>c.remainingRuns>=1&&canFit(c,prev,p));
   if(!chosen)return hold(candidates.length?'成立する停止枠・列変更条件不足':'現オンライン候補なし・ロール替等の確認必要',p,required);
  }
  const d=chosen.detail;
  const updates=new Map();
  if(!Array.isArray(d)||d.length!==(s.size==='D10'?8:6))return hold('選択カリバ本数不一致',p);
  for(const c of d){
   const k=key(c.stand,c.rollId,c.generation,c.number);
   const records=usageRows.filter(u=>u&&key(u.stand,u.rollId,u.generation,u.number)===k);
   if(updates.has(k)||records.length!==1||records[0].runs!==c.runs||records[0].available!==true||!Number.isInteger(c.runs)||!Number.isInteger(c.limit)||c.runs+runs>c.limit)return hold('使用量・上限・個体一致未確認',p);
   updates.set(k,{stand:c.stand,rollId:c.rollId,generation:c.generation,number:c.number,before:c.runs,after:c.runs+runs,limit:c.limit});
  }
  // An exchange is committed only in this synthetic forecast after all checks.
  if(chosen.changeCount>0)events.push({type:'caliber-exchange-preview',periodId:prev.id,date:prev.date,forPeriod:p.id,from:copy(selection),to:copy(chosen.selection),changes:copy(chosen.changes),referenceMinutes:chosen.referenceMinutes,capacityBasis:prev.capacityBasis,checks:copy(chosen.checks),operationAuthorized:false});
  selection=copy(chosen.selection);
  usageRows=usageRows.map(u=>{const v=updates.get(key(u?.stand,u?.rollId,u?.generation,u?.number));return v?{...u,runs:v.after}:u;});
  operatingRuns+=runs;
  events.push({type:'production-preview',periodId:p.id,date:p.date,productionMinutes:p.productionMinutes,operatingRuns:runs,selection:copy(selection),consumption:[...updates.values()],reached:[...updates.values()].filter(v=>v.after===v.limit),operationAuthorized:false});
  prev=p;
 }
 return finish('campaign-preview-complete');
}
module.exports={previewLinkedCampaign};
