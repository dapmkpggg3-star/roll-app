'use strict';
// R05/R06: distinguish individual groove exhaustion from physical roll exhaustion.
const str=x=>typeof x==='string'&&x.trim().length>0;
const amount=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const key=x=>String(x).replace(/^#/,'');
const identity=m=>JSON.stringify([key(m.standKey),m.rollId,m.generation]);
function normalReuseAllowed(stand){const k=key(stand);return /^(12|13|14|15|16|17)$/.test(k);}
function inspectUpperLedger(s,m,size,api){
 const k=key(m?.standKey),l=m?.caliberLedger,limit=api.monthlyUsageThreshold(k,size);
 const hold=reason=>({status:'held',stand:k,reason});
 if(!['6','7','8','9','10','11'].includes(k)||!same(s,m)||!str(m.rollId)||!str(m.generation)||!limit||!same(s,l)||l.identity!==identity(m)||l.complete!==true||!Number.isInteger(l.totalCalibers)||l.totalCalibers<1||!Array.isArray(l.calibers)||l.calibers.length!==l.totalCalibers)return hold('全カリバ本数・個体世代・版未確認');
 const rows=l.calibers;
 if(rows.some(c=>!same(s,c)||!str(c.id)||!['active','unused','used','unavailable'].includes(c.state)||!amount(c.tons)||limit.runs!==null&&(!Number.isInteger(c.runs)||c.runs<0)||c.state==='unused'&&(c.tons!==0||limit.runs!==null&&c.runs!==0))||new Set(rows.map(c=>c.id)).size!==rows.length)return hold('カリバ番号・使用量・使用可否矛盾');
 const active=rows.filter(c=>c.state==='active');
 if(active.length!==1)return hold('現用カリバ未確認');
 const a=active[0],unused=rows.filter(c=>c.state==='unused'),used=rows.filter(c=>c.state==='used'),usable=rows.filter(c=>c.state!=='unavailable');
 if(limit.tons!==null&&m.openingUsedTons!==a.tons||limit.runs!==null&&(!Array.isArray(m.activeCalibers)||m.activeCalibers.length!==1||m.activeCalibers[0].id!==a.id||m.activeCalibers[0].runs!==a.runs))return hold('現用カリバと開始使用量不一致');
 const remT=limit.tons===null?null:Math.max(0,limit.tons-a.tons)+unused.length*limit.tons;
 const remR=limit.runs===null?null:Math.max(0,limit.runs-a.runs)+unused.length*limit.runs;
 return {status:'verified-ledger',stand:k,identity:l.identity,totalCalibers:l.totalCalibers,usableCount:usable.length,unusedCount:unused.length,unusedIds:unused.map(c=>c.id),activeId:a.id,usedIds:used.map(c=>c.id),unavailableIds:rows.filter(c=>c.state==='unavailable').map(c=>c.id),nominalRollTons:limit.tons===null?null:limit.tons*usable.length,nominalRollRuns:limit.runs===null?null:limit.runs*usable.length,remainingNormalTons:remT,remainingNormalRuns:remR,recordedTotalTons:rows.reduce((n,c)=>n+c.tons,0),usedResidualExcludedTons:limit.tons===null?null:used.reduce((n,c)=>n+Math.max(0,limit.tons-c.tons),0),reuseAllowed:false,limit:{...limit},basis:l.basis};
}
function deriveUpperGroup(s,g,api){
 const k=g?.stands?.map(key).join(',');
 if(!['6,7','8,9','10,11'].includes(k))return {status:'not-applicable',group:g};
 const hold=(reason,ledgers=[])=>({status:'held',reason,ledgers,group:null});
 if(!Array.isArray(g.members)||g.members.length!==2||g.stands.some(k=>g.members.filter(m=>key(m?.standKey)===key(k)).length!==1))return hold('共同個体不足');
 const ledgers=g.members.map(m=>inspectUpperLedger(s,m,g.size,api));
 if(ledgers.some(l=>l.status!=='verified-ledger'))return hold(ledgers.find(l=>l.status!=='verified-ledger').reason,ledgers);
 if(new Set(ledgers.map(l=>l.unusedCount>0)).size!==1)return hold('片側のみ新品カリバあり・共同交換種別要確認',ledgers);
 const workType=ledgers[0].unusedCount>0?'caliberChange':'rollChange';
 const group={...g,workType,members:g.members.map(m=>({...m,nextCaliberAvailable:workType==='caliberChange',remainingBasis:m.caliberLedger.basis}))};
 return {status:'derived',group,ledgers,workType,requestedWorkType:g.workType??null,normalReuseAllowed:false};
}
module.exports={normalReuseAllowed,inspectUpperLedger,deriveUpperGroup};
