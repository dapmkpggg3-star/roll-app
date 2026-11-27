'use strict';
// Isolated, anonymous PC forecast; not an actual shift ledger or operating approval.
const {previewLinked1217}=require('./linked-12-17-combinations.cjs');
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
function previewLinkedCampaign(input,api){
 const s=input||{}, events=[], unresolved=[];
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const key=(k,r,g,n)=>JSON.stringify([String(k),r,g,n]);
 const copy=x=>JSON.parse(JSON.stringify(x));
 let usageRows=[],selection=null,operatingRuns=0,prev=null,currentSize=s.size;
 const finish=(status)=>({status,complete:status==='campaign-preview-complete',events,unresolved,operatingRuns,endingUsage:usageRows,endingSelection:selection,endingSize:currentSize,operationAuthorized:false,writeAllowed:false});
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
 const mixed=s.mixedSizePreview===true;
 const ready=e=>e&&str(e.basis)&&e.preparationReady===true&&e.reserveReady===true&&e.pairReady===true&&e.additionalReady===true&&e.safetyBlocked===false;
 const sizeFit=(stop,p)=>{
  const e=stop?.sizeChangeEvidence;
  const all=['12','13','14','15','16','17'];
  const effort=api.monthlyExchangeEffort('sizeChange',all,p.size);
  const minutes=e?.redPassIncluded===true?360:effort?.minutes;
  if(!stop||stop.type!=='stop'||stop.end!==p.start||stop.lineStopped!==true||stop.dateRowVerified!==true||!['常昼','Ⅰ勤A','Ⅰ勤B','Ⅲ勤A','Ⅲ勤B'].includes(stop.team)||stop.date!==localDate(stop.end-1)||!ready(e)||e.fromSize!==currentSize||e.toSize!==p.size||e.snapshotId!==s.snapshotId||e.sourceRevision!==s.sourceRevision||!Array.isArray(e.stands)||e.stands.slice().sort().join(',')!==all.join(',')||e.upstreamReady!==true||!Number.isFinite(minutes)||stop.end-stop.start<minutes)return null;
  return {minutes,basis:e.basis};
 };
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
  if(p.grade!==s.grade)return hold('鋼種切替の作業・使用時間根拠未確認',p,{requiredGradeReview:true,grade:p.grade,chargeCount:p.chargeCount??null,convertedRuns:null});
  const sizeChanged=p.size!==currentSize;
  let sizeChange=null,targetSelection=selection;
  if(sizeChanged){
   if(!mixed)return hold('サイズ・鋼種切替は未接続',p);
   sizeChange=sizeFit(prev,p);
   if(!sizeChange)return hold('サイズ替停止枠・赤通し・上流準備未確認',p,{requiredSizeChange:true,fromSize:currentSize,toSize:p.size});
   const evidence=p.targetSelectionEvidence;
   if(!evidence||evidence.confirmed!==true||!str(evidence.basis)||evidence.snapshotId!==s.snapshotId||evidence.sourceRevision!==s.sourceRevision||evidence.size!==p.size||evidence.grade!==p.grade||!evidence.selection)return hold('サイズ替後の個体別候補根拠未確認',p,{requiredSizeChange:true});
   targetSelection=evidence.selection;
  }
  if(p.productionMinutes>=120&&p.productionMinutes<240)return hold('2〜4h未満は提案のみ・確定消費しない',p);
  const runs=p.productionMinutes>=240?1:0;
  const search=previewLinked1217({...s,size:p.size,selection:targetSelection,usageRows},api);
  const candidates=search.candidates||[];
  const current=candidates.find(c=>c.changeCount===0&&c.remainingRuns>=1);
  let chosen=current;
  if(sizeChanged&&!chosen)return hold('サイズ替後の指定候補が不成立・要再選定',p,{requiredSizeChange:true,issues:search.issues||[]});
  if(!chosen){
   const required={requiredExchange:true,candidateCount:candidates.length,searchComplete:search.searchComplete===true,issues:search.issues||[]};
   // Unknown does not prove exhaustion, and a column switch requires upstream approval.
   if(!search.searchComplete)return hold('候補根拠未確認・交換要否保留',p,{...required,requiredExchange:null});
   chosen=candidates.find(c=>c.remainingRuns>=1&&canFit(c,prev,p));
   if(!chosen)return hold(candidates.length?'成立する停止枠・列変更条件不足':'現オンライン候補なし・ロール替等の確認必要',p,required);
  }
  const d=chosen.detail;
  const updates=new Map();
  if(!Array.isArray(d)||d.length!==(p.size==='D10'?8:6))return hold('選択カリバ本数不一致',p);
  for(const c of d){
   const k=key(c.stand,c.rollId,c.generation,c.number);
   const records=usageRows.filter(u=>u&&key(u.stand,u.rollId,u.generation,u.number)===k);
   if(updates.has(k)||records.length!==1||records[0].runs!==c.runs||records[0].available!==true||!Number.isInteger(c.runs)||!Number.isInteger(c.limit)||c.runs+runs>c.limit)return hold('使用量・上限・個体一致未確認',p);
   updates.set(k,{stand:c.stand,rollId:c.rollId,generation:c.generation,number:c.number,before:c.runs,after:c.runs+runs,limit:c.limit});
  }
  // An exchange is committed only in this synthetic forecast after all checks.
  if(sizeChanged)events.push({type:'size-exchange-preview',periodId:prev.id,date:prev.date,forPeriod:p.id,fromSize:currentSize,toSize:p.size,from:copy(selection),to:copy(chosen.selection),referenceMinutes:sizeChange.minutes,basis:sizeChange.basis,countsAgainstCaliberCapacity:false,checks:copy(chosen.checks),operationAuthorized:false});
  else if(chosen.changeCount>0)events.push({type:'caliber-exchange-preview',periodId:prev.id,date:prev.date,forPeriod:p.id,from:copy(selection),to:copy(chosen.selection),changes:copy(chosen.changes),referenceMinutes:chosen.referenceMinutes,capacityBasis:prev.capacityBasis,checks:copy(chosen.checks),operationAuthorized:false});
  selection=copy(chosen.selection);currentSize=p.size;
  usageRows=usageRows.map(u=>{const v=updates.get(key(u?.stand,u?.rollId,u?.generation,u?.number));return v?{...u,runs:v.after}:u;});
  operatingRuns+=runs;
  events.push({type:'production-preview',periodId:p.id,date:p.date,size:p.size,grade:p.grade,productionMinutes:p.productionMinutes,operatingRuns:runs,selection:copy(selection),consumption:[...updates.values()],reached:[...updates.values()].filter(v=>v.after===v.limit),operationAuthorized:false});
  prev=p;
 }
 return finish('campaign-preview-complete');
}
// A one-charge plan is a separate unit, never an inferred production shift.
function previewSD345ChargePlan(input,api){
 const s=input||{}, p=s.chargePlan||{};
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const base={size:'D10',grade:'SD345',convertedRuns:null,operationAuthorized:false,writeAllowed:false};
 const hold=reason=>({...base,status:'unconfirmed',reason});
 if(s.anonymousOnly!==true||p.size!=='D10'||p.grade!=='SD345'||p.chargeCount!==1||!str(p.basis)||!str(p.shiftId)||p.dateRowVerified!==true||typeof p.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date+'T00:00:00Z'))||new Date(Date.parse(p.date+'T00:00:00Z')).toISOString().slice(0,10)!==p.date)return hold('仮予定・チャージ根拠未確認');
 const e=p.targetSelectionEvidence;
 if(!e||e.confirmed!==true||!str(e.basis)||e.snapshotId!==s.snapshotId||e.sourceRevision!==s.sourceRevision||e.size!=='D10'||e.grade!=='SD345'||!e.selection)return hold('SD345候補・個体版未確認');
 const search=previewLinked1217({...s,size:'D10',grade:'SD345',selection:e.selection},api);
 const chosen=search.candidates.find(c=>c.changeCount===0&&c.remainingRuns>=1);
 if(!chosen)return hold('SD345鋼種・位置・残直候補未確認');
 return {...base,status:'provisional-charge-plan',date:p.date,shiftId:p.shiftId,chargeCount:1,selection:chosen.selection,checks:chosen.checks,gradeTransitionReviewRequired:true,basis:p.basis};
}
module.exports={previewLinkedCampaign,previewSD345ChargePlan};
