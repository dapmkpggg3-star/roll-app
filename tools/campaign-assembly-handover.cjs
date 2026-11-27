'use strict';
// R11: atomic same-day used/new reserve handover, anonymous PC forecast only.
const {previewCampaignWithSingleHandover}=require('./campaign-roll-resume.cjs');
function previewCampaignAssembly(input,api){
 const s=input||{},a=s.assembly||{},slot=a.slot||{},row=a.day||{},r=previewCampaignWithSingleHandover(s,api);
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const id=x=>JSON.stringify([String(x.stand),x.rollId,x.generation]);
 const base={...r,assemblyHandover:null,operationAuthorized:false,writeAllowed:false};
 if(r.rollHandover?.status!=='conditional-handover')return base;
 const k=r.rollHandover.stand,roles=r.roles.filter(x=>String(x.stand)===k);
 const old=roles.find(x=>x.status==='used-standby'),online=roles.find(x=>x.status==='online'),target=roles.find(x=>['rework','unassembled-return'].includes(x.status));
 const assessment=rs=>api.assessEmergencyReserve({standKey:k,resources:rs.map(x=>({id:x.rollId,standKey:k,frame:({online:'online','used-standby':'usedSpare','new-standby':'installedSpare','rework-ready':'awaitingDispatch','unassembled-return':'awaitingAssembly',rework:'rework'})[x.status],spareKind:({'used-standby':'中古予備（バラシ前）','new-standby':'新品予備（組込完了）','rework-ready':'改削行き（搬出可能）','unassembled-return':'新品予備（組替可能）','rework':'改削中'})[x.status],chockInstalled:x.status==='rework'||x.status==='unassembled-return'||x.status==='rework-ready'?false:x.chockAssembled,emergencyUsable:x.emergencyEligible}))});
 const warning=rs=>api.assessNightReserveWarning({assessment:assessment(rs),evidence:'forecast'});
 const hold=reason=>({...base,assemblyHandover:{status:'held',reason,oldReserveRetained:true,nightWarning:warning(roles),assemblyReviewRequired:true}});
 if(!old||!online||!target||a.snapshotId!==s.snapshotId||a.sourceRevision!==s.sourceRevision||a.oldIdentity!==id(old)||a.targetIdentity!==id(target)||!str(a.basis))return hold('組替対象個体・版未確認');
 const rec=a.receipt||{}, validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(Date.parse(d+'T00:00:00Z')).toISOString().slice(0,10)===d;
 if(rec.status!=='actual'||rec.identity!==id(target)||!validDate(rec.date)||!str(rec.basis)||rec.present!==true||rec.unassembled!==true||rec.usable!==true||!validDate(s.asOf)||rec.date>s.asOf)return hold('現物搬入・使用可能・未組込の実績未確認');
 if(!validDate(slot.date)||slot.date<s.asOf||rec.date>=slot.date||slot.date<r.rollHandover.date||slot.workArea!=='workshop'||slot.owner?.rollId!==target.rollId||String(slot.owner?.standKey)!==k||slot.preparedTarget!==target.rollId||slot.prepared!=='reworkInbound'||slot.preparedOn!==rec.date||row.date!==slot.date||row.dateRowVerified!==true)return hold('組替日・工作枠・準備対象未確認');
 const exchange=r.events.find(x=>x.type==='roll-exchange-preview');
 const epoch=Date.parse(slot.date+'T00:00:00+09:00')/60000;
 if(!exchange||epoch+slot.startHour*60<exchange.stopEnd||!api.physicalAssemblySlotReady(slot,row).ok)return hold('ロール替後の昼間工作枠未成立');
 if(a.sameDayCompletionPlanned!==true||a.targetEmergencyEligible!==true||a.oldDispatchReadyPlanned!==true||a.safetyBlocked!==false||!str(a.completionBasis)||!str(a.nightBasis)||row.nightOperating!==true&&row.nightOperating!==false)return hold('当日組込完了・搬出可能・夜勤条件未確認');
 const after=roles.map(x=>x===old?{...x,status:'rework-ready',chockAssembled:false,emergencyEligible:false}:x===target?{...x,status:'new-standby',chockAssembled:true,emergencyEligible:true}:x);
 const final=assessment(after);if(final.status!=='available'||final.emergencySpare!==1||final.emergencyIds[0]!==target.rollId)return hold('引継ぎ後の完成予備未確認');
 return {...base,projectedRoles:r.roles.map(x=>after.find(y=>id(x)===id(y))||x),assemblyHandover:{status:'conditional-assembly',date:slot.date,oldIdentity:id(old),targetIdentity:id(target),receiptDate:rec.date,referenceHours:slot.requiredHours,nightWarning:row.nightOperating?warning(after):null,emergencyReserveCount:1,actualCompletion:false,operationAuthorized:false,writeAllowed:false}};
}
module.exports={previewCampaignAssembly};
