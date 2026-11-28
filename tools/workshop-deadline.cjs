'use strict';
// R23: deadline only; dates are conditional forecasts, never work orders.
const valid=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
function previewWorkshopDeadline(s={}){
 const out={forecastOnly:true,workDate:null,operationAuthorized:false,actualCompletion:false,assemblyDeadline:null,dispatchDeadline:null,oldReserveRetained:true,warnings:[]};
 const fail=x=>({...out,status:'held',warnings:[x]});
 const roles=s.roles;
 if(!Array.isArray(roles)||roles.length!==3||roles.some(r=>!r||typeof r.rollId!=='string'||!r.rollId.trim())||new Set(roles.map(r=>r.rollId)).size!==3)return fail('3セット個体未確認');
 const one=k=>roles.filter(r=>r.status===k);
 const old=one('used-standby'),online=one('online'),target=roles.filter(r=>['unassembled-return','new-unassembled','rework-in-progress'].includes(r.status));
 if(old.length!==1||online.length!==1||target.length!==1||old[0].assembled!==true||old[0].emergencyEligible!==true)return fail('組込予備・現況未確認');
 if(s.dispositionKind==='retirement'){
  if(!valid(s.asOf)||!valid(s.nextExchangeDeadline)||typeof s.needBasis!=='string'||!s.needBasis.trim())return fail('次回交換期限根拠未確認');
  out.assemblyDeadline=s.nextExchangeDeadline;
 }else{
 if(!valid(s.asOf)||!valid(s.inboundRequiredBy)||!Number.isInteger(s.leadDays)||s.leadDays<=0||typeof s.leadBasis!=='string'||!s.leadBasis.trim()||typeof s.needBasis!=='string'||!s.needBasis.trim())return fail('搬入必要日・LT根拠未確認');
 out.dispatchDeadline=shift(s.inboundRequiredBy,-s.leadDays);
 if(!Number.isInteger(s.preDispatchDays)||s.preDispatchDays<0||typeof s.bufferBasis!=='string'||!s.bufferBasis.trim())return fail('組替から搬出までの余裕未確認');
 out.assemblyDeadline=shift(out.dispatchDeadline,-s.preDispatchDays);
 if(valid(s.nextExchangeDeadline)&&s.nextExchangeDeadline<out.assemblyDeadline)out.assemblyDeadline=s.nextExchangeDeadline;
 if(!valid(s.nextExchangeDeadline))return fail('次回交換期限未確認');
 }
 if(s.asOf>out.assemblyDeadline)return fail('組替期限超過');
 const t=target[0];
 if(!valid(t.availableDate)||!['actual','forecast'].includes(t.receiptKind)||typeof t.receiptBasis!=='string'||!t.receiptBasis.trim()||(t.receiptKind==='actual'&&t.availableDate>s.asOf)||(t.status==='rework-in-progress'&&t.receiptKind==='actual'))return fail('現物・搬入見込未確認');
 if(t.availableDate>out.assemblyDeadline)return fail('搬入遅延・組替期限内成立せず');
 const from=[s.asOf,t.availableDate].sort().pop();
 const candidates=Array.isArray(s.verifiedWorkDays)?s.verifiedWorkDays.filter(d=>valid(d.date)&&d.date>=from&&d.date<=out.assemblyDeadline&&d.sameDayHandover===true&&d.workshopWorking===true&&d.safetyConfirmed===true&&(d.date!==s.nextExchangeDeadline||d.beforeExchangeConfirmed===true)&&(d.date!==t.availableDate||d.afterReceiptConfirmed===true)&&typeof d.basis==='string'&&d.basis.trim()):[];
 if(!candidates.length)return fail('期限内の同日引継ぎ可能枠未確認');
 return {...out,status:'conditional-deadline',earliestPossibleDate:from,oldRollId:old[0].rollId,targetRollId:t.rollId,receiptKind:t.receiptKind,workDayCandidateCount:candidates.length};
}
module.exports={previewWorkshopDeadline};
