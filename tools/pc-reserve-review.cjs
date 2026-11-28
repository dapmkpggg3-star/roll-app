'use strict';
// R01/R04/R05/R11/R12/R24: PC-only reserve review, never operational authority.
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(s,x)=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
const stands=Array.from({length:16},(_,i)=>String(i+2));
const pair=['6,7','8,9','10,11','12,13','14,15'].map(x=>x.split(','));
const statuses=['online','used-standby','new-standby','rework','rework-ready','rework-in-progress','new-unassembled','unassembled-return','disposition-review','retirement-review'];
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const broken=r=>r.condition==='broken'||r.ledgerStatus==='折損'||r.spareKind==='折損';
function classify(roles,k){
 const unknown=reason=>({stand:k,emergencyCount:null,normalCount:null,emergencyIdentities:[],reason});
 if(!Array.isArray(roles)||roles.length!==3||roles.some(r=>!r||String(r.stand)!==k||!str(r.rollId)||!str(r.generation)||!statuses.includes(r.status))||new Set(roles.map(r=>r.rollId)).size!==3||roles.filter(r=>r.status==='online').length!==1)return unknown('3セット個体・オンライン未確認');
 const standby=roles.filter(r=>r.status==='new-standby'||r.status==='used-standby'),all=roles.filter(r=>r.status!=='online');
 if(all.some(r=>typeof r.chockAssembled!=='boolean'||typeof r.emergencyEligible!=='boolean'||(!standby.includes(r)&&(r.chockAssembled||r.emergencyEligible))||(r.emergencyEligible&&!r.chockAssembled)))return unknown('組込・緊急使用適合未確認または矛盾');
 const brokenStandby=standby.filter(broken);
 const available=standby.filter(r=>!broken(r)&&r.chockAssembled&&r.emergencyEligible);
 const candidates=available.filter(r=>r.status==='new-standby'||Number(k)>=12);
 const normal=candidates.filter(r=>r.normalEligible===true);
 const uncertainNormal=candidates.some(r=>typeof r.normalEligible!=='boolean');
 return {stand:k,emergencyCount:available.length,normalCount:uncertainNormal?null:normal.length,emergencyIdentities:available.map(id),brokenIdentities:brokenStandby.map(id),reason:available.length?'適合組込済予備あり（個体単位）':brokenStandby.length?'折損予備を除外・適合組込済予備なし':'確認対象の3セットに適合組込済予備なし'};
}
function previewPcReserveReview(s={}){
 const out={current:[],forecast:[],pairReview:[],held:[],complete:false,writeAllowed:false,operationAuthorized:false};
 if(s.anonymousOnly!==true||!day(s.asOf)||!str(s.snapshotId)||!str(s.sourceRevision)||!Array.isArray(s.circulations)){out.held.push({reason:'予備判定基準・出典未確認'});return out;}
 const held=out.held,actual=Array.isArray(s.reserveActualSnapshots)?s.reserveActualSnapshots:[];
 for(const k of stands){
  const a=actual.filter(x=>String(x?.stand)===k),x=a[0];
  const ok=a.length===1&&same(s,x)&&x.date===s.asOf&&x.kind==='actual'&&x.complete===true&&Array.isArray(x.roles)&&x.roles.every(r=>r?.forecastOnly!==true&&r?.conditionalAssembly!==true&&r?.actualStateVerified===true&&same(s,r));
  const r=ok?classify(x.roles,k):classify(null,k);
  out.current.push({...r,date:s.asOf,kind:'actual',state:r.emergencyCount===null?'情報不足':r.emergencyCount===0?'実際の予備不足':'個体別予備あり',basis:ok?x.basis:null});
 }
 const seen=new Map();
 const add=(roles,date,phase,source)=>{
  if(!Array.isArray(roles)||!day(date)||date<s.asOf)return;
  for(const k of [...new Set(roles.map(r=>String(r?.stand)))].filter(k=>stands.includes(k))){
   const own=roles.filter(r=>String(r?.stand)===k);
   const r=classify(own,k),key=JSON.stringify([k,date,phase]);
   const row={...r,date,phase,kind:'forecast',state:r.emergencyCount===null?'情報不足':r.emergencyCount===0?'将来の予備不足見込み':'個体別予備見込みあり',source,forecastOnly:true};
   if(!seen.has(key))seen.set(key,row);
   else{const p=seen.get(key);if(p.emergencyCount!==row.emergencyCount||p.normalCount!==row.normalCount||JSON.stringify(p.emergencyIdentities.slice().sort())!==JSON.stringify(row.emergencyIdentities.slice().sort()))seen.set(key,{...row,emergencyCount:null,normalCount:null,emergencyIdentities:[],state:'情報不足',reason:'同一予測時点の予備根拠競合',possibleShortage:p.emergencyCount===0||row.emergencyCount===0||p.possibleShortage===true});}
  }
 };
 for(const [i,c] of s.circulations.entries()){
  const root=c?.result,source='circulation-'+i;
  if(!same(s,c)||root?.forecastOnly!==true||root.writeAllowed!==false||root.operationAuthorized!==false||!Array.isArray(root.stages)){held.push({source,reason:'循環予備根拠未確認'});continue;}
  const rotation=(node,src)=>{
   if(node?.rotationComplete!==true||node.forecastOnly!==true||node.writeAllowed!==false||node.operationAuthorized!==false)return;
   const events=(node.sequence?.events||[]).filter(e=>e.rollChanged===true);
   if(events.length!==1||!Array.isArray(node.endingRoles)){held.push({source:src,reason:'交換直後の予備時点未確認'});return;}
   add(node.endingRoles,events[0].date,'圧延交換直後',src);
  };
  rotation(root.initial?.fourth,source+'/fourth');
  for(const [j,e] of root.stages.entries()){
   const stage=e?.stage,src=source+'/stage-'+j;
   if(stage?.forecastOnly===true&&stage.writeAllowed===false&&stage.operationAuthorized===false&&Array.isArray(stage.roles)&&Array.isArray(stage.handovers)){
    // A stage may contain different handover dates for different stands.
    for(const h of stage.handovers){
     if(!h||h.status!=='conditional-on-future-receipt'||h.forecastOnly!==true||h.actualCompletion!==false||!day(h.date))continue;
     const own=stage.roles.filter(r=>String(r.stand)===String(h.stand));
     if(own.filter(r=>id(r)===h.targetIdentity&&r.status==='new-standby'&&r.conditionalAssembly===true).length!==1){held.push({source:src,stand:h.stand,reason:'組替後の予備個体未確認'});continue;}
     add(own,h.date,'工作組替後（条件付き）',src);
    }
   }
   rotation(e?.next,source+'/next-'+j);
  }
 }
 out.forecast=[...seen.values()].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.stand)-Number(b.stand)||a.phase.localeCompare(b.phase));
 // Stand-level reserve count cannot prove compatibility of a linked pair.
 for(const ks of pair){
  const r=ks.map(k=>out.current.find(x=>x.stand===k));
  out.pairReview.push({stands:ks,kind:'actual',date:s.asOf,state:r.some(x=>x.emergencyCount===0)?'片側予備不足・ペア未成立':r.some(x=>x.emergencyCount===null)?'片側予備情報不足・ペア適合未確認':'ペア適合別途確認'});
 }
 return out;
}
module.exports={previewPcReserveReview};
