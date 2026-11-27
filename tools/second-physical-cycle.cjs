'use strict';
// Later observed snapshot is the sole source of current usage.
const {previewReworkReceipt}=require('./rework-receipt-reconciliation.cjs');
const {previewCampaignAssembly}=require('./campaign-assembly-handover.cjs');
function previewNextPhysicalCycle(input,api){
 const s=input||{},a=s.actual||{},n=s.next||{},p=previewReworkReceipt({originalPlan:s.originalPlan,actual:a},api);
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const id=x=>JSON.stringify([String(x.stand),x.rollId,x.generation]);
 const out={receipt:p,nextCycle:null,operationAuthorized:false,writeAllowed:false,originalPlanPreserved:true};
 const hold=reason=>({...out,status:'held',reason});
 if(p.status!=='returned-unassembled')return hold('改削戻り未確認');
 const k=p.originalForecast.stand,rs=a.currentRoles;
 if(!Array.isArray(rs)||rs.length!==3||new Set(rs.map(x=>x.rollId)).size!==3||rs.some(x=>String(x.stand)!==k||!str(x.rollId)||!str(x.generation)||!str(x.basis)||x.snapshotId!==a.snapshotId||x.sourceRevision!==a.sourceRevision))return hold('後日3セット個体・版未確認');
 const online=rs.find(x=>x.status==='online'),spare=rs.find(x=>x.status==='new-standby'),returned=rs.find(x=>x.status==='unassembled-return');
 if(!online||!spare||!returned||id(returned)!==p.newIdentity||id(online)!==s.originalPlan.rollExchange.newIdentity||id(spare)!==s.originalPlan.assembly.targetIdentity||online.chockAssembled!==true||spare.chockAssembled!==true||spare.emergencyEligible!==true||returned.chockAssembled!==false)return hold('Bオンライン・C組込予備・A改削戻りの現況不一致');
 if(n.snapshotId!==a.snapshotId||n.sourceRevision!==a.sourceRevision||n.asOf!==a.asOf||n.anonymousOnly!==true||!str(n.basis)||!Array.isArray(n.periods)||!n.periods.length||n.periods.some(x=>typeof x.date!=='string'||x.date<a.asOf)||!Array.isArray(a.onlineRows)||!Array.isArray(a.masterRows)||!Array.isArray(a.usageRows)||a.onlineRows.filter(x=>String(x.stand)===k&&x.status==='online'&&id(x)===id(online)).length!==1)return hold('後日操業時系列・オンライン・個体データ未確認');
 if(n.rollExchange?.oldIdentity!==id(online)||n.rollExchange?.newIdentity!==id(spare)||n.assembly?.oldIdentity!==id(online)||n.assembly?.targetIdentity!==id(returned)||n.assembly?.receipt?.identity!==id(returned)||n.assembly?.receipt?.date!==p.actualInboundDate)return hold('次回交換・組替の対象不一致');
 const result=previewCampaignAssembly({...n,roles:rs,onlineRows:a.onlineRows,masterRows:a.masterRows,usageRows:a.usageRows},api);
 return {...out,status:result.rollHandover?.status!=='conditional-handover'?'held':result.assemblyHandover?.status==='conditional-assembly'&&result.complete?'second-cycle-preview':'partial-second-cycle',reason:result.assemblyHandover?.reason||result.rollHandover?.reason||result.unresolved?.[0]?.reason||null,nextCycle:result};
}
module.exports={previewNextPhysicalCycle};
