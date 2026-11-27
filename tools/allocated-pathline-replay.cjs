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
 let online=[],usage=[],selection={};
 const finish=(reason=null)=>{if(reason)issues.push(reason);return {...base,endingOnline:online,endingUsage:usage,endingSelection:selection,pathlineComplete:!issues.length};};
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
   const {q,chosen}=choose({...ctx(),onlineRows:next,selection:sel});
   if(!chosen)return finish('交換後の全パスライン・残直未成立 '+a.id+' '+q.issues.join('／'));
   online=next;selection=sel;
   events.push({type:single?'allocated-single-pathline-preview':'allocated-pair-pathline-preview',id:a.id,date:a.date,startMinute:a.startMinute,endMinute:a.endMinute,oldIdentities:e.oldIdentities,newIdentities:e.newIdentities,selection:copy(sel),checks:copy(chosen.checks),remainingRuns:chosen.remainingRuns,operationAuthorized:false});
  }
  if(d.productionAmount===0)continue;
  if(d.size!==c.size||d.grade!==c.grade||d.shiftEvidenceVerified!==true||![d.shift1Team,d.shift3Team].filter(x=>x==='A'||x==='B').length||[d.shift1Team,d.shift3Team].filter(x=>x==='A'||x==='B').length!==1||typeof d.operatingHours!=='number'||!Number.isFinite(d.operatingHours)||d.operatingHours<=0||d.operatingHours>24||d.operatingHours>=2&&d.operatingHours<4)return finish('単一勤・同サイズ鋼種・使用時間未確認 '+d.date);
  const {q,chosen}=choose(ctx());if(!chosen)return finish('操業前パスライン・残直未成立 '+d.date+' '+q.issues.join('／'));
  const runs=d.operatingHours>=4?1:0,updates=new Map();
  if(chosen.detail.length!==(c.size==='D10'?8:6))return finish('使用カリバ本数不一致');
  for(const x of chosen.detail){const k=key(x,x.number),u=usage.filter(y=>key(y,y.number)===k);if(updates.has(k)||u.length!==1||u[0].runs!==x.runs||u[0].available!==true||x.runs+runs>x.limit)return finish('直数・個体・上限不一致');updates.set(k,{...x,before:x.runs,after:x.runs+runs});}
  usage=usage.map(u=>updates.has(key(u,u.number))?{...u,runs:updates.get(key(u,u.number)).after}:u);
  events.push({type:'downstream-production-preview',date:d.date,operatingRuns:runs,productionAmount:d.productionAmount,selection:copy(selection),consumption:[...updates.values()],checks:copy(chosen.checks),operationAuthorized:false});
 }
 return finish();
}
module.exports={previewAllocatedPathline};
