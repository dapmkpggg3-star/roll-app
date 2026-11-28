'use strict';
// Shared recurrence capacity gate. A candidate batch is atomic: conflicting
// or unverified intervals do not alter the previously accepted calendar.
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const str=x=>typeof x==='string'&&x.trim().length>0;
const copy=x=>JSON.parse(JSON.stringify(x));
function reserveRecurrenceBatch(input={}){
 const {snapshotId,sourceRevision,existing,candidates}=input;
 const base={accepted:false,held:[],calendar:Array.isArray(existing)?copy(existing):[],operationAuthorized:false,writeAllowed:false};
 const valid=r=>r&&r.snapshotId===snapshotId&&r.sourceRevision===sourceRevision&&str(r.basis)&&str(r.id)&&day(r.date)&&['workshop','rolling'].includes(r.area)&&Number.isInteger(r.startMinute)&&Number.isInteger(r.endMinute)&&r.startMinute>=0&&r.endMinute<=1440&&r.startMinute<r.endMinute;
 if(!str(snapshotId)||!str(sourceRevision)||input.calendarVerified!==true||!str(input.calendarBasis)||!Array.isArray(existing)||!Array.isArray(candidates)||!candidates.length||![...existing,...candidates].every(valid)){base.held.push({reason:'共通予約・根拠未確認'});return base;}
 const all=[...existing,...candidates],ids=new Set();
 for(const r of all){if(ids.has(r.id)){base.held.push({reason:'予約ID重複',id:r.id});}ids.add(r.id);}
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const a=all[i],b=all[j];
  if(a.area===b.area&&a.date===b.date&&a.startMinute<b.endMinute&&b.startMinute<a.endMinute)base.held.push({reason:'共通作業枠重複',ids:[a.id,b.id],date:a.date,area:a.area});
 }
 if(base.held.length)return base;
 return {...base,accepted:true,calendar:copy(all)};
}
module.exports={reserveRecurrenceBatch};
