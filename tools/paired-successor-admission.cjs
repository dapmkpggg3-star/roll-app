'use strict';
// R01/R04/R11/R18/R21: physical admission is distinct from initial use and accounting.
const {previewPairedAssemblyDisposition}=require('./paired-assembly-disposition.cjs');
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(Date.parse(x+'T00:00:00Z')).toISOString().slice(0,10)===x;
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
function previewPairedSuccessorAdmission(input,api){
 const s=input||{},r=previewPairedAssemblyDisposition(s,api);
 const base={...r,admissions:[],issueEntries:[],operationAuthorized:false,writeAllowed:false,annualComplete:false};
 if(r.status!=='conditional-pair-exchange')return base;
 const roles=r.projectedRoles.map(x=>({...x})),admissions=[],issueEntries=[];
 const requests=Array.isArray(s.successors)?s.successors:[];
 const same=e=>e&&e.snapshotId===s.snapshotId&&e.sourceRevision===s.sourceRevision&&str(e.basis);
 for(const d of r.dispositions.filter(d=>d.kind==='successor-needed')){
  const k=d.stand,h=r.handovers.find(x=>x.stand===k),old=roles.find(x=>id(x)===d.identity),own=roles.filter(x=>String(x.stand)===k),online=own.find(x=>x.status==='online'),spare=own.find(x=>x.status==='new-standby');
  const entries=requests.filter(x=>x&&String(x.stand)===k),n=entries[0]||{},u=n.finalUseStart||{};
  const proc=d.procurement?{...d.procurement}:null;
  // The original life output has no measuredDate; validate against source diameter record below.
  const measured=s.members.find(x=>String(x.stand)===k)?.diameter?.measuredDate;
  if(proc&&same(u)&&u.identity===d.identity&&u.status==='actual'&&date(u.date)&&date(measured)&&u.date>=measured&&u.date<=s.asOf){
   proc.idealArrivalBy=api.addDays(u.date,-1);proc.idealOrderBy=api.addMonths(proc.idealArrivalBy,-proc.leadMonths);
  }
  const a={stand:k,replacesIdentity:d.identity,status:'held',procurement:proc,actualAdmission:false,actualRetired:false,issueMonth:null};
  const hold=reason=>admissions.push({...a,reason});
  if(!proc||entries.length!==1||!same(n)||n.identity!==id(n)||n.replacesIdentity!==d.identity||!str(n.rollId)||!str(n.generation)||n.status!=='actual'||!date(n.receiptDate)||n.receiptDate>s.asOf||n.present!==true||n.unassembled!==true||n.usable!==true||n.neverUsed!==true||n.chockAssembled!==false){hold('後継現物・未使用・個体対応未確認');continue;}
  if(roles.some(x=>x.rollId===n.rollId)||requests.filter(x=>x?.rollId===n.rollId).length!==1){hold('物理個体ID重複');continue;}
  proc.actualReceiptDate=n.receiptDate;proc.latestReceiptMet=n.receiptDate<=proc.latestArrivalBy;
  proc.idealReceiptMet=proc.idealArrivalBy? n.receiptDate<=proc.idealArrivalBy:null;
  if(!proc.latestReceiptMet||h?.status!=='conditional-assembly'||old?.status!=='retirement-review'||old.chockAssembled!==false||own.length!==3||!online||!spare||spare.chockAssembled!==true||spare.emergencyEligible!==true){hold('離脱・安全な組替後の3セット引継ぎ未成立');continue;}
  const nr={stand:k,rollId:n.rollId,generation:n.generation,status:'new-unassembled',chockAssembled:false,emergencyEligible:false,neverUsed:true,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:n.basis};
  roles[roles.indexOf(old)]=nr;
  const result={...a,status:'conditional-admission',date:h.date,successorIdentity:n.identity,emergencyReserveCount:1,reason:'旧個体の枠を未組込新品が引継ぐ予測。払出なし'};
  admissions.push(result);
  // Only independently supplied later actual history; no forecast is promoted to actual.
  const v=n.firstUseEvidence;if(!v)continue;
  const evidence=e=>e&&e.status==='actual'&&e.snapshotId===v.snapshotId&&e.sourceRevision===v.sourceRevision&&str(e.basis)&&date(e.date)&&e.date<=v.asOf;
  const b=v.admission,t=v.intermediateExchange,w=v.assembly,z=v.firstRolling,rs=v.currentRoles,history=v.issueHistory;
  const pairOK=e=>Array.isArray(e?.pair)&&e.pair.map(String).slice().sort().join(',')===r.pair.slice().sort().join(',')&&e.pairCompatibilityConfirmed===true&&str(e.compatibilityBasis);
  const fail=reason=>{result.firstUse={status:'held',reason};};
  if(v.anonymousOnly!==true||!date(v.asOf)||v.asOf<h.date||!str(v.snapshotId)||v.snapshotId===s.snapshotId||!str(v.sourceRevision)||!str(v.basis)){fail('後日実績版未確認');continue;}
  if(!evidence(b)||b.date<h.date||b.retiredIdentity!==d.identity||b.successorIdentity!==n.identity||b.onlineIdentity!==id(online)||b.spareIdentity!==id(spare)||b.oldRetired!==true||b.spareAssembled!==true||b.successorAdmitted!==true){fail('廃却・加入実績未確認');continue;}
  if(!evidence(t)||t.date<=b.date||t.oldIdentity!==id(online)||t.newIdentity!==id(spare)||t.oldEmergencyUsable!==true||!pairOK(t)){fail('中間共同交換実績未確認');continue;}
  if(!evidence(w)||w.date<t.date||w.oldIdentity!==id(online)||w.targetIdentity!==n.identity||w.sameDayHandover!==true||w.newAssembled!==true||w.emergencyUsable!==true||w.neverUsed!==true){fail('新品組込実績未確認');continue;}
  if(!evidence(z)||z.date<=w.date||z.oldIdentity!==id(spare)||z.newIdentity!==n.identity||!pairOK(z)||z.exchangeCompleted!==true||z.actualRolling!==true||z.firstEverUse!==true||!Number.isInteger(z.productionMinutes)||z.productionMinutes<=0||!['D10','D13'].includes(z.size)||!['SD295','SD345'].includes(z.grade)||!str(z.periodId)){fail('共同交換後初回圧延実績未確認');continue;}
  if(!Array.isArray(rs)||rs.length!==6||new Set(rs.map(x=>x?.rollId)).size!==6||rs.some(x=>!x||!r.pair.includes(String(x.stand))||x.snapshotId!==v.snapshotId||x.sourceRevision!==v.sourceRevision||!str(x.basis))||r.pair.some(p=>{const q=rs.filter(x=>String(x.stand)===p);return q.length!==3||q.filter(x=>x.status==='online'&&x.chockAssembled===true).length!==1||q.filter(x=>['new-standby','used-standby'].includes(x.status)&&x.chockAssembled===true&&x.emergencyEligible===true).length!==1;})){fail('後日ペア3セット現況未確認');continue;}
  const current=rs.find(x=>id(x)===n.identity&&x.status==='online');
  const mate=rs.find(x=>String(x.stand)!==k&&x.status==='online');
  if(!current||!mate||z.mateIdentity!==id(mate)||!str(z.lineFitBasis)||z.lineFitConfirmed!==true){fail('初回圧延時のペア・パスライン根拠未確認');continue;}
  const m=resolveOnlineCaliberMaster({...v,onlineRows:rs.filter(x=>x.status==='online')},k);
  if(m.status!=='resolved'||!Array.isArray(z.selectedNumbers)||!z.selectedNumbers.length||new Set(z.selectedNumbers).size!==z.selectedNumbers.length||!z.selectedNumbers.every(num=>m.calibers.some(c=>c.number===num&&c.size===z.size&&c.grades.includes(z.grade)&&c.available===true&&c.runs!==null))){fail('初回使用個体配置・選択未確認');continue;}
  if(!history||history.completeBefore!==z.date||history.sourceRevision!==v.sourceRevision||!str(history.basis)||!Array.isArray(history.entries)||history.entries.some(e=>!e||!str(e.rollId)||!str(e.stand)||!date(e.date)||e.date>=z.date||e.status!=='actual'||!str(e.basis))){fail('過去払出確認範囲未確認');continue;}
  if(history.entries.some(e=>String(e.stand)===k&&e.rollId===n.rollId)){fail('既払出・物理個体重複');continue;}
  const entry={key:JSON.stringify([k,n.rollId]),stand:k,rollId:n.rollId,generation:n.generation,date:z.date,month:z.date.slice(0,7),status:'actual-evidence',basis:z.basis,rule:'R21 初回使用月'};
  result.firstUse={status:'actual-evidence-matched',entry,firstUseConfirmed:true,forecastCalculated:false,operationAuthorized:false};
  issueEntries.push(entry);
 }
 return {...base,projectedRoles:roles,admissions,issueEntries,actualAdmission:false,actualRetired:false,futurePairReview:true};
}
module.exports={previewPairedSuccessorAdmission};
