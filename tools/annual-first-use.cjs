'use strict';
const {previewSuccessorProcurement}=require('./annual-successor-procurement.cjs');
const {previewCampaignWithSingleHandover}=require('./campaign-roll-resume.cjs');
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
function previewFirstUse(input,api){
 const s=input||{},r=previewSuccessorProcurement(s,api),ad=r.successorAdmission,v=s.firstUseSnapshot||{},n=s.firstUseCampaign||{};
 const out={...r,firstUse:null,issueEntries:[],issueMonths:r.months.map(m=>({month:m.month,actualKnownCount:null,plannedKnownCount:null,complete:false})),operationAuthorized:false,writeAllowed:false};
 const hold=reason=>({...out,firstUse:{status:'held',reason},unresolved:[...out.unresolved,reason]});
 if(ad?.status!=='conditional-admission')return hold('後継加入候補未成立');
 if(v.anonymousOnly!==true||!date(v.asOf)||v.asOf<s.actual.asOf||!str(v.snapshotId)||v.snapshotId===s.actual.snapshotId||!str(v.sourceRevision)||!str(v.basis))return hold('後日実績版未確認');
 const stand=String(s.successor.stand),d=s.successor,c=ad.projectedRoles.find(x=>x.status==='online'),a=ad.projectedRoles.find(x=>x.status==='new-standby');
 const evidence=(e,type)=>e&&e.type===type&&e.status==='actual'&&e.snapshotId===v.snapshotId&&e.sourceRevision===v.sourceRevision&&str(e.basis)&&date(e.date)&&e.date<=v.asOf;
 const b=v.retirementAdmission,t=v.intermediateExchange,w=v.newAssembly;
 if(!evidence(b,'retirement-admission')||b.date<s.actual.asOf||b.date<s.successor.receiptDate||b.retiredIdentity!==ad.replacesIdentity||b.successorIdentity!==ad.successorIdentity||b.onlineIdentity!==id(c)||b.assembledSpareIdentity!==id(a)||b.oldDisassembled!==true||b.oldRetired!==true||b.spareAssembled!==true||b.successorAdmitted!==true||b.emergencyReserveConfirmed!==true)return hold('廃却・新品加入・予備引継ぎ実績未確認');
 if(!evidence(t,'roll-exchange')||t.date<=b.date||t.oldIdentity!==id(c)||t.newIdentity!==id(a)||t.oldChockRetained!==true||t.oldEmergencyUsable!==true)return hold('中間ロール替実績未確認');
 if(!evidence(w,'new-assembly')||w.date<t.date||w.oldIdentity!==id(c)||w.targetIdentity!==d.identity||w.oldDisassembled!==true||w.newAssembled!==true||w.emergencyUsable!==true||w.sameDayHandover!==true||w.neverUsed!==true)return hold('新品組込・中古予備引継ぎ実績未確認');
 const rs=v.currentRoles;
 if(!Array.isArray(rs)||rs.length!==3||new Set(rs.map(x=>x.rollId)).size!==3||rs.some(x=>String(x.stand)!==stand||x.snapshotId!==v.snapshotId||x.sourceRevision!==v.sourceRevision||!str(x.basis)))return hold('現3セット・版未確認');
 const ar=rs.find(x=>id(x)===id(a)),dr=rs.find(x=>id(x)===d.identity),cr=rs.find(x=>id(x)===id(c));
 if(!ar||ar.status!=='online'||ar.chockAssembled!==true||!dr||dr.status!=='new-standby'||dr.chockAssembled!==true||dr.emergencyEligible!==true||dr.neverUsed!==true||!cr||!['rework','rework-ready','unassembled-return'].includes(cr.status)||cr.chockAssembled!==false)return hold('新品組込後の3セット不一致');
 const m=resolveOnlineCaliberMaster({...v,onlineRows:[{...dr,status:'online'}]},stand);
 if(m.status!=='resolved'||m.calibers.some(x=>x.runs!==0||typeof x.available!=='boolean'))return hold('新品個体マスター・初期直数未確認');
 // Prior issues are keyed by physical roll, not regrind generation.
 const hist=v.issueHistory;
 if(!hist||hist.completeThrough!==v.asOf||hist.sourceRevision!==v.sourceRevision||!str(hist.basis)||!Array.isArray(hist.entries)||hist.entries.some(e=>!e||!str(e.rollId)||!str(e.stand)||!date(e.date)||e.date>v.asOf||e.status!=='actual'||!str(e.basis)))return hold('過去払出の確認範囲未確認');
 if(hist.entries.some(e=>String(e.stand)===stand&&e.rollId===d.rollId))return hold('同一物理ロールの既払出記録あり・重複計上しない');
 if(n.anonymousOnly!==true||n.asOf!==v.asOf||n.snapshotId!==v.snapshotId||n.sourceRevision!==v.sourceRevision||!Array.isArray(n.periods)||!n.periods.length||n.periods.some(p=>!date(p.date)||p.date<v.asOf)||n.rollExchange?.oldIdentity!==id(a)||n.rollExchange?.newIdentity!==d.identity||String(n.rollExchange?.stand)!==stand)return hold('初回使用候補の操業時系列・交換対象未確認');
 const q=previewCampaignWithSingleHandover({...n,roles:rs,onlineRows:v.onlineRows,masterRows:v.masterRows,usageRows:v.usageRows},api);
 const h=q.rollHandover;
 if(h?.status!=='conditional-handover'||h.newIdentity!==d.identity||h.date<w.date)return hold('新品へのロール替・全パスライン未成立');
 const first=q.events.find(e=>e.type==='production-preview'&&e.consumption?.some(x=>id(x)===d.identity));
 if(!first||first.productionMinutes<=0||first.date<h.date)return hold('新品初回圧延候補未確認');
 const planned={status:'planned',date:first.date,periodId:first.periodId,size:first.size,grade:first.grade,selection:first.selection,basis:n.timelineBasis};
 let event=planned;
 const z=s.firstUseActual;
 if(z!=null){
  if(z.anonymousOnly!==true||!date(z.asOf)||z.asOf<v.asOf||!str(z.snapshotId)||z.snapshotId===v.snapshotId||!str(z.sourceRevision)||!str(z.basis)||z.status!=='actual'||z.identity!==d.identity||z.date!==first.date||z.date>z.asOf||z.periodId!==first.periodId||z.size!==first.size||z.grade!==first.grade||JSON.stringify(z.selection)!==JSON.stringify(first.selection)||z.originalSnapshotId!==v.snapshotId||z.originalSourceRevision!==v.sourceRevision||z.exchangeCompleted!==true||z.actualRolling!==true||z.firstEverUse!==true||!Number.isInteger(z.productionMinutes)||z.productionMinutes<=0||z.priorIssueChecked!==true)return hold('初回使用実績と計画の照合未成立・日程差等は別再計算');
  event={...planned,status:'actual',basis:z.basis,productionMinutes:z.productionMinutes};
 }
 const entry={key:JSON.stringify([stand,d.rollId]),stand,rollId:d.rollId,generation:d.generation,date:event.date,month:event.date.slice(0,7),status:event.status,basis:event.basis,rule:'R21 新品初回使用月',originalPlannedDate:planned.date};
 const months=out.issueMonths.map(m=>m.month===entry.month?{...m,[entry.status==='actual'?'actualKnownCount':'plannedKnownCount']:1}:m);
 return {...out,firstUse:{status:event.status==='actual'?'actual-first-use':'conditional-first-use',identity:d.identity,plannedDate:planned.date,actualDate:event.status==='actual'?event.date:null,issueMonth:entry.month,entry,caliberCount:m.totalCalibers,sizeCounts:m.sizeCounts,firstUseConfirmed:event.status==='actual',checks:h.checks,operationAuthorized:false,writeAllowed:false},issueEntries:[entry],issueMonths:months,outsideFiscalYearIssue:months.some(m=>m.month===entry.month)?[]:[entry],firstUseCampaignResult:q,unresolved:[...out.unresolved,'払出は部分明細・全年度件数未確定']};
}
module.exports={previewFirstUse};
