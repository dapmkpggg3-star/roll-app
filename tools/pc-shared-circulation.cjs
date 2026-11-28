'use strict';
// First exchange / shared workshop -> PC reporting. NOT a full-horizon recurrence.
const {previewPcStandYear}=require('./pc-stand-year-matrix.cjs');
const {previewPcPurchaseWarnings}=require('./pc-purchase-warning.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const groups=['2','3','4','5','6,7','8,9','10,11','12,13','14,15','16','17'];
const stands=Array.from({length:16},(_,i)=>String(i+2));
const key=a=>Array.isArray(a)?a.map(String).sort((x,y)=>Number(x)-Number(y)).join(','):'';
function projectPcSharedCirculation(s={},runShared){
 const base={coverage:stands.map(stand=>({stand,state:'未確認',fullHorizonVerified:false})),held:[],first:null,annual:null,purchase:null,periodComplete:false,complete:false,writeAllowed:false,operationAuthorized:false};
 if(s.anonymousOnly!==true||!str(s.snapshotId)||!str(s.sourceRevision)||!day(s.asOf)||!day(s.throughDate)||!Array.isArray(s.groups)||!Array.isArray(s.actualEvents)||typeof runShared!=='function'){base.held.push({reason:'共有循環入力未確認'});return base;}
 const seen=new Map(),same=x=>x&&x.snapshotId===s.snapshotId&&x.sourceRevision===s.sourceRevision&&str(x.basis);
 for(const g of s.groups){
  const k=key(g?.stands);
  // This wrapper only accepts normal roll-exchange coverage, not individual D10 caliber exceptions.
  if(!same(g)||!groups.includes(k)||!str(g.id)||g.workType!=='rollChange'&&g.workType!=='caliberChange'){base.held.push({reason:'対象スタンド・交換種別未確認',stands:g?.stands??[]});continue;}
  if(!seen.has(k))seen.set(k,[]);seen.get(k).push(g);
 }
 if(base.held.length||[...seen.values()].some(v=>v.length!==1)||new Set(s.groups.map(g=>g.id)).size!==s.groups.length){base.held.push({reason:'対象重複・構成不整合、共有計算保留'});return base;}
 let first;
 try{first=runShared(s);}catch(e){base.held.push({reason:'共有計算実行未成立',detail:String(e.message??e)});return base;}
 base.first=first;
 if(first?.status!=='shared-workshop-preview'||first.writeAllowed!==false||first.operationAuthorized!==false){base.held.push({reason:'読取専用結果未確認'});return base;}
 const holds=[...(first.held||[]),...(first.exchangeUnresolved||[])];
 for(const h of holds){
  const ks=Array.isArray(h.stands)&&h.stands.length?h.stands.map(String):h.stand!=null?[String(h.stand)]:[];
  if(ks.length)for(const stand of ks)base.held.push({...h,stand,demandId:h.demandId??h.id??null,date:h.date??h.latestDate??null});
  else base.held.push({...h});
 }
 for(const issue of first.pathlineIssues||[])base.held.push({reason:'下流パスライン：'+String(issue)});
 const dispositions=[];
 for(const d of first.dispositions||[]){
  // Shared first-stage procurement has a different explicit null-receipt contract.
  // Normalize only verified no-actual claims; do not infer a received physical roll.
  if(d?.status==='successor-review'&&d.actualDisposition===false&&d.actualOrderDate===null&&d.procurement?.status==='forecast-guidance'&&d.procurement.actualReceiptDate===null&&d.procurement.accountingMonth===null){
   dispositions.push({...d,procurement:{...d.procurement,actualReceived:false}});
  }else dispositions.push(d);
 }
 for(const c of base.coverage){
  const k=groups.find(x=>x.split(',').includes(c.stand)),input=seen.get(k)?.[0];
  if(!input){c.state='対象入力なし';base.held.push({stand:c.stand,reason:'全16スタンドの対象入力なし'});continue;}
  const related=base.held.filter(h=>h.stand===c.stand||h.demandId===input.id||h.id===input.id);
  const ds=dispositions.filter(d=>String(d.stand)===c.stand);
  c.state=related.length?'初回交換・工作に保留あり':ds.length?'初回処遇の予測あり':'初回処遇未確認';
  c.dispositionCount=ds.length;
  c.demandId=input.id;
 }
 // No mixing independent recurrence runs with first-stage results. The
 // shared capacity history has not yet been transferred to the full engine.
 const root={forecastOnly:true,writeAllowed:false,operationAuthorized:false,periodComplete:false,stages:[{stage:{...first,forecastOnly:true,held:base.held,dispositions}}]};
 const reportInput={...s,circulations:[{snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'共有初回循環の条件付き出力',result:root}]};
 base.annual=previewPcStandYear(reportInput);base.purchase=previewPcPurchaseWarnings(reportInput);
 return {...base,reportInput,scope:'全16対象の共通初回交換・工作からPCへの接続。反復循環未成立'};
}
function previewPcSharedCirculation(s={},api){
 if(!api)return projectPcSharedCirculation(s,null);
 return projectPcSharedCirculation(s,input=>require('./shared-workshop-handover.cjs').previewSharedWorkshop(input,api));
}
module.exports={previewPcSharedCirculation,projectPcSharedCirculation};
