'use strict';
// Anonymous PC forecast only: one #16/#17 replacement and reserve handover.
const {previewLinked1217}=require('./linked-12-17-combinations.cjs');
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
function previewSingleRollHandover(input,api){
 const s=input||{}, e=s.exchange||{}, c=s.campaign||{}, k=String(e.stand), slot=e.stop||{};
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const hold=reason=>({status:'held',reason,requiredExchange:c.unresolved?.some(x=>x.requiredExchange===true)===true,operationAuthorized:false,writeAllowed:false});
 const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 if(s.anonymousOnly!==true||!['16','17'].includes(k)||!str(s.snapshotId)||!str(s.sourceRevision)||!Array.isArray(s.roles)||!Array.isArray(s.onlineRows)||!Array.isArray(c.endingUsage)||!c.endingSelection||!['D10','D13'].includes(c.endingSize)||s.grade!=='SD295')return hold('対象・個体・キャンペーン未確認');
 if(c.status!=='campaign-preview-held'||c.unresolved?.length!==1||c.unresolved[0].requiredExchange!==true||c.unresolved[0].searchComplete!==true||c.unresolved[0].candidateCount!==0)return hold('候補枯渇と未確認を区別・ロール替需要未確定');
 if(e.confirmed!==true||e.replacementRequired!==true||!str(e.basis)||e.snapshotId!==s.snapshotId||e.sourceRevision!==s.sourceRevision||e.forPeriod!==c.unresolved[0].periodId)return hold('個体別ロール替根拠未確認');
 const roles=s.roles.filter(r=>r&&String(r.stand)===k);
 if(roles.length!==3||new Set(roles.map(r=>r.rollId)).size!==3||roles.some(r=>!str(r.rollId)||!str(r.generation)||!str(r.basis)||r.snapshotId!==s.snapshotId||r.sourceRevision!==s.sourceRevision))return hold('3セット個体・世代・版未確認');
 const old=roles.find(r=>r.status==='online'),next=roles.find(r=>r.status==='new-standby'),third=roles.find(r=>['rework','rework-ready','unassembled-return'].includes(r.status));
 if(!old||!next||!third||e.oldIdentity!==id(old)||e.newIdentity!==id(next)||next.chockAssembled!==true||next.emergencyEligible!==true||old.chockAssembled!==true||e.oldEmergencyEligibleAfterRemoval!==true||!str(e.reserveBasis))return hold('オンライン・新品予備・第三セットまたは中古予備適合未確認');
 const oldMaster=resolveOnlineCaliberMaster({...s,usageRows:c.endingUsage},k);
 if(oldMaster.status!=='resolved'||id(oldMaster)!==id(old))return hold('オンライン個体不一致');
 const localDate=t=>new Date((t+540)*60000).toISOString().slice(0,10);
 const valid=t=>Number.isSafeInteger(t)&&Math.abs(t)<1e10;
 const effort=api?.monthlyExchangeEffort?.('rollChange',[k],c.endingSize);
 if(effort?.minutes!==360||!valid(slot.start)||!valid(slot.end)||slot.end-slot.start<360||slot.end-slot.start>1440||slot.date!==localDate(slot.start)||slot.date!==localDate(slot.end-1)||slot.date!==c.unresolved[0].date||slot.confirmed!==true||slot.dateRowVerified!==true||slot.lineStopped!==true||!['常昼','Ⅰ勤A','Ⅰ勤B','Ⅲ勤A','Ⅲ勤B'].includes(slot.team)||!Number.isInteger(slot.capacity)||slot.capacity<1||!str(slot.capacityBasis)||!str(slot.basis)||slot.preparationReady!==true||slot.additionalReady!==true||slot.safetyBlocked!==false||slot.forPeriod!==e.forPeriod)return hold('360分停止枠・準備・安全・日付未確認');
 if(!e.selection||['12','13','14','15','16','17'].some(st=>st!==k&&JSON.stringify(e.selection[st])!==JSON.stringify(c.endingSelection[st])))return hold('非交換スタンド無断変更');
 const onlineRows=s.onlineRows.map(r=>r&&String(r.stand)===k&&r.status==='online'?{...r,rollId:next.rollId,generation:next.generation,basis:e.basis}:r);
 const state={...s,size:c.endingSize,onlineRows,usageRows:copy(c.endingUsage),selection:copy(e.selection)};
 const newMaster=resolveOnlineCaliberMaster(state,k);
 if(newMaster.status!=='resolved'||id(newMaster)!==id(next))return hold('新オンラインの個体マスター未確認');
 const search=previewLinked1217(state,api);
 const chosen=search.candidates.find(x=>x.changeCount===0&&x.remainingRuns>=1);
 if(!chosen||!search.searchComplete)return hold('交換後の全パスライン・カリバ残直未確認');
 const after=roles.map(r=>r===old?{...r,status:'used-standby',emergencyEligible:true,chockAssembled:true}:r===next?{...r,status:'online'}:{...r});
 return {status:'conditional-handover',requiredExchange:true,stand:k,date:slot.date,oldIdentity:id(old),newIdentity:id(next),roles:copy(after),onlineRows,usageRows:state.usageRows,selection:state.selection,referenceMinutes:360,emergencyReserveCount:1,oldReserveMustRemainAssembled:true,checks:copy(chosen.checks),newCaliberCount:newMaster.totalCalibers,newSizeCounts:newMaster.sizeCounts,operationAuthorized:false,writeAllowed:false};
}
module.exports={previewSingleRollHandover};
