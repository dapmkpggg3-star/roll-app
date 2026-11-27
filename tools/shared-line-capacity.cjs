'use strict';
// PC-only shared line stop allocator. Explicit first-demand inputs; no operation approval.
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const minute=x=>Number.isInteger(x)&&x>=0&&x<=1440;
const overlap=(a,b)=>a.startMinute<b.endMinute&&b.startMinute<a.endMinute;
function previewSharedLineCapacity(input,api){
 const s=input||{},raw=Array.isArray(s.demands)?s.demands:[],allocations=[],unresolved=[],warnings=[];
 const base={status:'shared-line-preview',allocations,unresolved,warnings,complete:false,annualComplete:false,operationAuthorized:false,writeAllowed:false};
 const held=(d,reason)=>unresolved.push({id:d?.id??null,stands:d?.stands??[],workType:d?.workType??null,latestDate:d?.latestDate??null,latestMinute:d?.latestMinute??null,requiredExchange:true,reason,operationAuthorized:false});
 const version=e=>e&&e.snapshotId===s.snapshotId&&e.sourceRevision===s.sourceRevision&&str(e.basis);
 if(s.anonymousOnly!==true||!str(s.snapshotId)||!str(s.sourceRevision)||!date(s.asOf)){raw.forEach(d=>held(d,'匿名・版・基準日未確認'));return base;}
 const days=Array.isArray(s.days)?s.days:[],slots=Array.isArray(s.slots)?s.slots:[];
 const dayMap=new Map();
 for(const d of days){
  if(!version(d)||!date(d.date)||d.dateRowVerified!==true||d.recordKind!=='plan'||days.filter(x=>x?.date===d.date).length!==1)continue;
  if(!Number.isInteger(d.exchangeCapacity)||d.exchangeCapacity<0||!Number.isInteger(d.reservedExchangeCount)||d.reservedExchangeCount<0||d.reservedExchangeCount>d.exchangeCapacity||!str(d.capacityBasis))continue;
  dayMap.set(d.date,{...d,used:d.reservedExchangeCount});
 }
 const clean=slots.filter(t=>version(t)&&str(t.id)&&slots.filter(x=>x?.id===t.id).length===1&&dayMap.has(t.date)&&t.date>=s.asOf&&minute(t.startMinute)&&minute(t.endMinute)&&t.endMinute>t.startMinute&&t.lineStopped===true&&t.stopTimeVerified===true&&['常昼','Ⅰ勤A','Ⅰ勤B','Ⅲ勤A','Ⅲ勤B'].includes(t.team)&&Array.isArray(t.eligibility)&&Array.isArray(t.reserved)&&t.reserved.every(a=>a&&minute(a.startMinute)&&minute(a.endMinute)&&a.startMinute>=t.startMinute&&a.endMinute<=t.endMinute&&a.startMinute<a.endMinute&&str(a.basis)));
 const safe=clean.filter(t=>!clean.some(u=>t!==u&&u.date===t.date&&overlap(t,u)));
 const ids=new Map();for(const d of raw)ids.set(d?.id,(ids.get(d?.id)||0)+1);
 const checked=[];
 for(const d of raw){
  const e=d&&api.monthlyExchangeEffort(d.workType,d.stands,d.size);
  if(!version(d)||!str(d.id)||ids.get(d.id)!==1||d.requiredExchange!==true||!e||!date(d.earliestDate)||!date(d.latestDate)||d.latestDate<s.asOf||d.earliestDate>d.latestDate||!minute(d.latestMinute)||!str(d.deadlineBasis)){held(d,'需要・組合せ・期限・版未確認');continue;}
  checked.push({d,e});
 }
 // Only one ordinary first exchange per stand in this snapshot. Size change is a separate operation.
 const ordinary=checked.filter(x=>x.d.workType!=='sizeChange');
 const conflict=x=>x.d.workType!=='sizeChange'&&ordinary.some(y=>x!==y&&x.e.stands.some(k=>y.e.stands.includes(k)));
 const order=checked.filter(x=>{if(conflict(x)){held(x.d,'同一スタンドの交換需要競合・順序再計算必要');return false;}return true;}).sort((x,y)=>x.d.latestDate.localeCompare(y.d.latestDate)||x.d.latestMinute-y.d.latestMinute||x.d.id.localeCompare(y.d.id));
 const reserved=new Map(safe.map(t=>[t.id,t.reserved.map(a=>({...a}))]));
 const load=new Map();
 for(const {d,e} of order){
  const candidates=[];
  for(const t of safe){
   const day=dayMap.get(t.date),isSize=d.workType==='sizeChange';
   if(t.date<d.earliestDate||t.date>d.latestDate||(!isSize&&(day.exchangeCapacity<=0||day.used>=day.exchangeCapacity)))continue;
   const evidence=t.eligibility.filter(x=>x?.demandId===d.id);
   if(evidence.length!==1)continue;
   const q=evidence[0];
   if(!version(q)||q.preparationReady!==true||q.reserveReady!==true||q.pairReady!==true||q.additionalReady!==true||q.safetyBlocked!==false||q.workAllowed!==true||q.deadlineBasis!==d.deadlineBasis)continue;
   // Explicit permission is required, not inferred from a team's name.
   if(t.afterRegularDay===true&&e.stands.some(k=>+k<10))continue;
   if(typeof t.afterRegularDay!=='boolean'||typeof t.nightOnlyStop!=='boolean'||t.nightOnlyStop)continue;
   const minutes=isSize&&q.redPassIncluded===true?360:e.minutes;
   const busy=reserved.get(t.id).slice().sort((a,b)=>a.startMinute-b.startMinute);
   let start=t.startMinute;
   for(const a of busy){if(start+minutes<=a.startMinute)break;if(start<a.endMinute)start=a.endMinute;}
   const end=start+minutes;
   if(end>t.endMinute||(t.date===d.latestDate&&end>d.latestMinute))continue;
   const key=t.date+'|'+t.team;
   candidates.push({t,day,key,start,end,minutes,isSize,q});
  }
  candidates.sort((a,b)=>(load.get(a.key)||0)-(load.get(b.key)||0)||b.t.date.localeCompare(a.t.date)||a.start-b.start||a.t.id.localeCompare(b.t.id));
  if(!candidates.length){held(d,'期限内停止枠・準備・予備・適合・作業時間または件数未成立');continue;}
  const c=candidates[0],a={id:d.id,stands:e.stands,workType:d.workType,size:d.size,date:c.t.date,team:c.t.team,slotId:c.t.id,startMinute:c.start,endMinute:c.end,minutes:c.minutes,countsAgainstExchangeCapacity:!c.isSize,referencePeople:e.referencePeople,deadlineBasis:d.deadlineBasis,slotBasis:c.t.basis,eligibilityBasis:c.q.basis,status:'proposal',operationAuthorized:false};
  allocations.push(a);reserved.get(c.t.id).push(a);if(!c.isSize)c.day.used++;load.set(c.key,(load.get(c.key)||0)+c.minutes);
 }
 for(const u of unresolved)warnings.push({id:u.id,kind:'交換需要未解決',reason:u.reason});
 for(const a of allocations)if(allocations.filter(b=>a.date===b.date&&a.team===b.team).length>1)warnings.push({id:a.id,kind:'同日同班負荷集中',reason:'必要交換を保持し、調整案を検討'});
 return {...base,complete:raw.length>0&&unresolved.length===0,dayUsage:[...dayMap.values()].map(d=>({date:d.date,exchangeCapacity:d.exchangeCapacity,reservedExchangeCount:d.reservedExchangeCount,plannedExchangeCount:d.used-d.reservedExchangeCount,remaining:d.exchangeCapacity-d.used})),searchMethod:'deadline-first-greedy',globalOptimumProven:false};
}
module.exports={previewSharedLineCapacity};
