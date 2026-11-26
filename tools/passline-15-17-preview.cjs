'use strict';
// R03/R18/R20: anonymous planning position check, never operation approval.
// All identity, layout, datum and pair evidence must be supplied for the same snapshot.
function previewPassline1517(input){
 const s=input||{}, checks=[];
 const finish=(status,reason)=>({status,reason,checks,operationAuthorized:false,writeAllowed:false});
 const hold=r=>finish('unconfirmed',r), fail=r=>finish('incompatible',r);
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const identity=c=>JSON.stringify([String(c.stand),c.rollId,c.generation,c.number]);
 if(s.anonymousOnly!==true||!['D10','D13'].includes(s.size)||!['SD295','SD345'].includes(s.grade)||!str(s.snapshotId)||!str(s.sourceRevision)||!str(s.basis))return hold('対象・版・根拠未確認');
 const cols=['西','東'], groups={};
 const records=Array.isArray(s.calibers)?s.calibers:[];
 if(records.some(c=>!c||!['15','16','17'].includes(String(c.stand))))return hold('対象スタンド未確認');
 for(const stand of ['15','16','17']){
   const a=records.filter(c=>String(c.stand)===stand);
   if(a.length!==(s.size==='D10'&&stand!=='15'?2:1))return hold('現用カリバ本数未確認 #'+stand);
   if(a.some(c=>!str(c.rollId)||!str(c.generation)||!Number.isInteger(c.number)||c.number<=0||!cols.includes(c.column)||c.size!==s.size||c.grade!==s.grade||!str(c.layoutBasis)||c.snapshotId!==s.snapshotId||c.sourceRevision!==s.sourceRevision||c.available!==true))return hold('個体・世代・列・サイズ・鋼種・使用可否未確認 #'+stand);
   if(new Set(a.map(identity)).size!==a.length||a.some(c=>c.rollId!==a[0].rollId||c.generation!==a[0].generation))return hold('個体重複・世代不一致 #'+stand);
   if(a.length===2&&new Set(a.map(c=>c.column)).size!==2)return hold('D10東西ペア不足 #'+stand);
   groups[stand]=a;
 }
 const evidencedPair=(stand,a)=>Array.isArray(s.pairEvidence)&&s.pairEvidence.filter(p=>p&&p.confirmed===true&&String(p.stand)===stand&&p.rollId===a[0].rollId&&p.generation===a[0].generation&&p.snapshotId===s.snapshotId&&p.sourceRevision===s.sourceRevision&&p.size===s.size&&p.grade===s.grade&&str(p.basis)&&p.west===a.find(c=>c.column==='西')?.number&&p.east===a.find(c=>c.column==='東')?.number).length===1;
 if(s.size==='D10'){
   for(const stand of ['16','17'])if(!evidencedPair(stand,groups[stand]))return hold('D10対応ペア根拠未確認 #'+stand);
   checks.push({segment:'15→16',rule:'D10折返し・対応ペア',status:'planning-match',deltaMm:null});
 }else{
   const a=groups['15'][0],b=groups['16'][0];
   if(a.column!==b.column)return fail('D13 #15→16 同列条件不成立');
   const matched=(Array.isArray(s.foldEvidence)?s.foldEvidence:[]).filter(p=>p&&p.confirmed===true&&p.snapshotId===s.snapshotId&&p.sourceRevision===s.sourceRevision&&p.size==='D13'&&p.grade===s.grade&&p.fromIdentity===identity(a)&&p.toIdentity===identity(b)&&str(p.basis));
   if(matched.length!==1)return hold('D13折返し個体別対応未確認');
   checks.push({segment:'15→16',rule:'D13同列・個体別対応',status:'planning-match',deltaMm:null});
 }
 let missing=false,over=false;
 for(const a of groups['16']){
   const b=groups['17'].find(c=>c.column===a.column);
   if(!b)return fail('#16→17 同列条件不成立');
   const known=c=>typeof c.centerMm==='number'&&Number.isFinite(c.centerMm)&&c.centerMm>=0&&str(c.datumId)&&str(c.positionBasis)&&c.positionVerified===true;
   if(!known(a)||!known(b)||a.datumId!==b.datumId){missing=true;checks.push({segment:'16→17',column:a.column,from:a.number,to:b.number,deltaMm:null,status:'unconfirmed'});continue;}
   const delta=Math.abs(a.centerMm-b.centerMm);
   if(delta>40)over=true;
   checks.push({segment:'16→17',column:a.column,from:a.number,to:b.number,deltaMm:delta,limitMm:40,status:delta<=40?'planning-match':'incompatible'});
 }
 if(over)return fail('#16→17 40mm超過');
 if(missing)return hold('#16→17 位置・共通基準未確認');
 return finish('planning-match','位置条件照合済み・操業許可ではない');
}
module.exports={previewPassline1517};
