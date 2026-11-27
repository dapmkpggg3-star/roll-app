'use strict';
// R18/R20: replay actual master arithmetic after shared allocation; no operation authorization.
const {previewSingleAllocated}=require('./shared-single-exchange.cjs');
const {previewUsageSharedBridge}=require('./usage-shared-bridge.cjs');
const {previewLinked1217}=require('./linked-12-17-combinations.cjs');
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const key=(r,n)=>JSON.stringify([String(r.stand),r.rollId,r.generation,n]);
const id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
const copy=x=>JSON.parse(JSON.stringify(x));
const stands=['12','13','14','15','16','17'];
function previewAllocatedPathline(input,api){
 const s=input||{},r=previewUsageSharedBridge(s,api),c=s.pathline||{},events=[],issues=[];
 const base={...r,pathlineEvents:events,pathlineIssues:issues,pathlineComplete:false,complete:false,annualComplete:false,operationAuthorized:false,writeAllowed:false};
 const same=x=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
 let online=[],usage=[],selection={},staged=[],checkpoint=null;
 const rollback=()=>{if(checkpoint){online=checkpoint.online;selection=checkpoint.selection;staged=[];checkpoint=null;}};
 const finish=(reason=null)=>{if(reason){issues.push(reason);rollback();}return {...base,endingOnline:online,endingUsage:usage,endingSelection:selection,pathlineComplete:!issues.length};};
 if(!same(c)||c.anonymousOnly!==true||c.grade!=='SD295'||!['D10','D13'].includes(c.size)||!Array.isArray(c.onlineRows)||!Array.isArray(c.usageRows)||!Array.isArray(c.masterRows)||!c.selection)return finish('開始時の個体・配置・使用量・サイズ鋼種未確認');
 if(r.unresolved.some(u=>!Array.isArray(u.stands)||!u.stands.length||u.stands.some(k=>stands.includes(String(k)))))return finish('下流交換需要未解決・消費を進めない');
 online=copy(c.onlineRows);usage=copy(c.usageRows);selection=copy(c.selection);
 const ctx=()=>({...c,onlineRows:online,usageRows:usage,selection});
 if(stands.some(k=>resolveOnlineCaliberMaster(ctx(),k).status!=='resolved'))return finish('開始時個体別マスター未確認');
 // Compare every supplied downstream group opening usage with the master ledger.
 for(const g of s.groups||[])for(const m of g.members||[]){
  const k=String(m.standKey).replace(/^#/,'');if(!stands.includes(k))continue;
  const master=resolveOnlineCaliberMaster(ctx(),k);
  if(master.rollId!==m.rollId||master.generation!==m.generation||!Array.isArray(m.activeCalibers)||m.activeCalibers.length!==selection[k]?.length||m.activeCalibers.some(x=>!selection[k].includes(Number(x.id))||!master.calibers.some(y=>y.number===Number(x.id)&&y.runs===x.runs)))return finish('需要計算と個体別開始直数不一致 #'+k);
 }
 const choices=Array.isArray(c.exchangeSelections)?c.exchangeSelections:[];
 const pending=r.allocations.filter(a=>a.stands.some(k=>stands.includes(k)));
 const days=s.days||[];
 let expected=s.asOf;
 for(const d of days){if(!same(d)||d.date!==expected||d.dateRowVerified!==true||d.recordKind!=='plan'||!Number.isFinite(d.productionAmount)||d.productionAmount<0)return finish('連続日別計画・生産量未確認');expected=api.addDays(expected,1);}
 if(expected!==api.addDays(s.throughDate,1)||pending.some(a=>!days.some(d=>d.date===a.date)))return finish('期間末または割当日未確認');
 // Multi-exchange windows require explicit uninterrupted-stop evidence. No inferred shutdown
 // from a zero-ton entry alone. Validate every member against the shared allocation.
 const batches=c.stopBatches===undefined?[]:c.stopBatches, batchByDemand=new Map();
 if(!Array.isArray(batches))return finish('連続停止根拠の形式未確認');
 for(const b of batches){
  if(!same(b)||!str(b.id)||batches.filter(x=>x?.id===b.id).length!==1||b.noProductionConfirmed!==true||!Array.isArray(b.demandIds)||b.demandIds.length<2||new Set(b.demandIds).size!==b.demandIds.length)return finish('連続停止・対象交換の根拠未確認');
  const members=pending.filter(a=>b.demandIds.includes(a.id));
  if(members.length!==b.demandIds.length||members.map(a=>a.id).join('|')!==b.demandIds.join('|')||members[0].date!==b.fromDate||members.at(-1).date!==b.toDate||members.some(a=>batchByDemand.has(a.id)))return finish('連続停止の割当・日付・順序不一致');
  const window=days.filter(d=>d.date>=b.fromDate&&d.date<=b.toDate);
  if(!window.length||window.some(d=>d.productionAmount!==0||d.productionByTeam&&['A','B'].some(k=>d.productionByTeam[k]!=null&&d.productionByTeam[k]!==0)))return finish('連続停止内に操業・不明生産量あり');
  const all=pending.filter(a=>a.date>=b.fromDate&&a.date<=b.toDate);
  if(all.length!==members.length||all.some(a=>!b.demandIds.includes(a.id)))return finish('連続停止内の下流交換抜け');
  for(const a of members)batchByDemand.set(a.id,b);
 }
 const choose=state=>{const q=previewLinked1217(state,api);return {q,chosen:q.searchComplete?q.candidates.find(x=>x.changeCount===0&&x.remainingRuns>=1):null};};
 for(const d of days){
  for(const a of pending.filter(a=>a.date===d.date)){
   const single=a.stands.length===1&&['16','17'].includes(a.stands[0]);
   const replay=single?previewSingleAllocated(s,a,api):r.replays.find(x=>x.id===a.id),req=choices.filter(x=>x?.demandId===a.id),e=req[0];
   if(d.productionAmount!==0||a.workType!=='rollChange'||!(single?replay?.status==='conditional-single-replay':['12,13','14,15'].includes(a.stands.join(','))&&replay?.status==='conditional-pair-replay'))return finish('今回未接続の下流交換・停止条件 '+a.id);
   if(req.length!==1||!same(e)||e.date!==a.date||e.startMinute!==a.startMinute||e.endMinute!==a.endMinute||!e.selection||!e.oldIdentities||!e.newIdentities)return finish('割当時点の使用カリバ指定根拠未確認 '+a.id);
   const next=copy(online),sel=copy(selection);
   for(const k of a.stands){
    const old=online.find(x=>String(x.stand)===k&&x.status==='online'),replacement=replay.projectedRoles.find(x=>String(x.stand)===k&&x.status==='online'),removed=replay.projectedRoles.find(x=>String(x.stand)===k&&['used-standby','rework-ready','retirement-review','disposition-review'].includes(x.status));
    if(!old||!replacement||!removed||id(old)!==id(removed)||id(old)!==e.oldIdentities[k]||id(replacement)!==e.newIdentities[k]||replacement.chockAssembled!==true)return finish('交換対象個体不一致 '+k);
    next[next.findIndex(x=>x===undefined||String(x.stand)===k&&x.status==='online')]={...replacement,status:'online'};
    sel[k]=copy(e.selection[k]??null);
   }
   if(stands.some(k=>!a.stands.includes(k)&&JSON.stringify(e.selection[k])!==JSON.stringify(selection[k])))return finish('非交換スタンドの無断カリバ変更');
   // Each individual replacement still needs its own master, selected grooves, size/grade and remaining runs.
   // Only the cross-stand final path is deferred across a proved uninterrupted shutdown.
   const batch=batchByDemand.get(a.id);
   if(batch){
    for(const k of a.stands){
     const m=resolveOnlineCaliberMaster({...ctx(),onlineRows:next,selection:sel},k),nums=sel[k],limit=api.monthlyUsageThreshold(k,c.size)?.runs;
     if(m.status!=='resolved'||!Number.isInteger(limit)||!Array.isArray(nums)||nums.length!==(c.size==='D10'&&['16','17'].includes(k)?2:1)||new Set(nums).size!==nums.length||nums.some(n=>!m.calibers.some(z=>z.number===n&&z.size===c.size&&z.grades.includes(c.grade)&&z.available===true&&Number.isInteger(z.runs)&&z.runs<limit)))return finish('連続交換中の新個体・選択・残直未成立 '+k);
    }
    if(!checkpoint)checkpoint={online,selection,batchId:batch.id};
    if(checkpoint.batchId!==batch.id)return finish('連続交換の重複・中断');
    online=next;selection=sel;
    staged.push({type:single?'allocated-single-pathline-preview':'allocated-pair-pathline-preview',id:a.id,date:a.date,startMinute:a.startMinute,endMinute:a.endMinute,oldIdentities:e.oldIdentities,newIdentities:e.newIdentities,selection:copy(sel),batchId:batch.id,intermediatePathlineVerified:false,operationAuthorized:false});
    if(a.id!==batch.demandIds.at(-1))continue;
    const {q,chosen}=choose(ctx());
    if(!chosen)return finish('連続交換後の再開パスライン・残直未成立 '+batch.id+' '+q.issues.join('／'));
    for(const z of staged)events.push({...z,finalSelection:copy(selection),checks:copy(chosen.checks),remainingRuns:chosen.remainingRuns,pathlineVerifiedAfterBatch:true,pathlineVerifiedOnDate:a.date,batchBasis:batch.basis});
    staged=[];checkpoint=null;
   }else{
    if(checkpoint)return finish('連続停止内の未登録交換');
    const {q,chosen}=choose({...ctx(),onlineRows:next,selection:sel});
    if(!chosen)return finish('交換後の全パスライン・残直未成立 '+a.id+' '+q.issues.join('／'));
    online=next;selection=sel;
    events.push({type:single?'allocated-single-pathline-preview':'allocated-pair-pathline-preview',id:a.id,date:a.date,startMinute:a.startMinute,endMinute:a.endMinute,oldIdentities:e.oldIdentities,newIdentities:e.newIdentities,selection:copy(sel),checks:copy(chosen.checks),remainingRuns:chosen.remainingRuns,operationAuthorized:false});
   }
  }
  if(d.productionAmount===0)continue;
  if(checkpoint)return finish('連続交換未完了の操業再開を保留');
  if(d.size!==c.size||d.grade!==c.grade||d.shiftEvidenceVerified!==true||![d.shift1Team,d.shift3Team].filter(x=>x==='A'||x==='B').length||[d.shift1Team,d.shift3Team].filter(x=>x==='A'||x==='B').length!==1||typeof d.operatingHours!=='number'||!Number.isFinite(d.operatingHours)||d.operatingHours<=0||d.operatingHours>24||d.operatingHours>=2&&d.operatingHours<4)return finish('単一勤・同サイズ鋼種・使用時間未確認 '+d.date);
  const {q,chosen}=choose(ctx());if(!chosen)return finish('操業前パスライン・残直未成立 '+d.date+' '+q.issues.join('／'));
  const runs=d.operatingHours>=4?1:0,updates=new Map();
  if(chosen.detail.length!==(c.size==='D10'?8:6))return finish('使用カリバ本数不一致');
  for(const x of chosen.detail){const k=key(x,x.number),u=usage.filter(y=>key(y,y.number)===k);if(updates.has(k)||u.length!==1||u[0].runs!==x.runs||u[0].available!==true||x.runs+runs>x.limit)return finish('直数・個体・上限不一致');updates.set(k,{...x,before:x.runs,after:x.runs+runs});}
  usage=usage.map(u=>updates.has(key(u,u.number))?{...u,runs:updates.get(key(u,u.number)).after}:u);
  events.push({type:'downstream-production-preview',date:d.date,operatingRuns:runs,productionAmount:d.productionAmount,selection:copy(selection),consumption:[...updates.values()],checks:copy(chosen.checks),operationAuthorized:false});
 }
 if(checkpoint)return finish('連続交換の最終確認未成立');
 return finish();
}
module.exports={previewAllocatedPathline};
