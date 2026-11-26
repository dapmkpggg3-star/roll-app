'use strict';
// R18/R20: resolve the exact online roll and generation; never default groove count.
const {previewPassline1517}=require('./passline-15-17-preview.cjs');
const {previewRepeatedCaliberCampaign}=require('./repeated-caliber-preview.cjs');
const str=x=>typeof x==='string'&&x.trim().length>0;
const key=(stand,roll,generation)=>JSON.stringify([String(stand),roll,generation]);
const copy=x=>JSON.parse(JSON.stringify(x));
function resolveOnlineCaliberMaster(input,stand){
 const s=input||{}, k=String(stand);
 const hold=reason=>({status:'unconfirmed',stand:k,reason,totalCalibers:null,operationAuthorized:false,writeAllowed:false});
 if(s.anonymousOnly!==true||!str(s.snapshotId)||!str(s.sourceRevision)||!Array.isArray(s.onlineRows)||!Array.isArray(s.masterRows)||!Array.isArray(s.usageRows))return hold('入力版・マスター未確認');
 const rows=s.onlineRows.filter(r=>r&&String(r.stand)===k&&r.status==='online');
 if(rows.length!==1)return hold('オンライン個体を一意に特定できない');
 const o=rows[0];
 if(!str(o.rollId)||!str(o.generation)||o.snapshotId!==s.snapshotId||o.sourceRevision!==s.sourceRevision||!str(o.basis))return hold('オンライン個体・世代・根拠不明');
 const id=key(k,o.rollId,o.generation);
 const ms=s.masterRows.filter(r=>r&&key(r.stand,r.rollId,r.generation)===id);
 if(ms.length!==1)return hold('個体世代別マスター未登録・重複');
 const m=ms[0];
 if(!Number.isInteger(m.totalCalibers)||m.totalCalibers<=0||!Array.isArray(m.calibers)||m.calibers.length!==m.totalCalibers||!str(m.basis)||m.sourceRevision!==s.sourceRevision||m.confirmed!==true)return hold('総本数・配置・版の矛盾または未確認');
 const nums=m.calibers.map(c=>c?.number);
 if(new Set(nums).size!==nums.length||nums.some(n=>!Number.isInteger(n)||n<1||n>m.totalCalibers))return hold('カリバ番号の重複・欠損');
 if(m.calibers.some(c=>!['D10','D13'].includes(c.size)||!['西','東'].includes(c.column)||!Array.isArray(c.grades)||!c.grades.length||c.grades.some(g=>!['SD295','SD345'].includes(g))||!str(c.basis)))return hold('サイズ・列・鋼種配置未確認');
 const usages=s.usageRows.filter(r=>r&&key(r.stand,r.rollId,r.generation)===id);
 if(usages.some(u=>!nums.includes(u.number))||new Set(usages.map(u=>u.number)).size!==usages.length)return hold('直数記録重複・配置外番号');
 const calibers=m.calibers.map(c=>{
   const u=usages.find(u=>u.number===c.number);
   const known=u&&u.snapshotId===s.snapshotId&&u.sourceRevision===s.sourceRevision&&str(u.basis)&&Number.isInteger(u.runs)&&u.runs>=0&&typeof u.available==='boolean';
   return {...copy(c),runs:known?u.runs:null,available:known?u.available:null,usageBasis:known?u.basis:null};
 });
 const sizeCounts=Object.fromEntries(['D10','D13'].map(size=>{
   const items=calibers.filter(c=>c.size===size);
   return [size,{total:items.length,west:items.filter(c=>c.column==='西').length,east:items.filter(c=>c.column==='東').length,share:items.length/m.totalCalibers,gradeCounts:Object.fromEntries(['SD295','SD345'].map(grade=>[grade,items.filter(c=>c.grades.includes(grade)).length]))}];
 }));
 // Optional declared counts are assertions, never the source of a fabricated layout.
 if(m.sizeCounts!==undefined&&(!m.sizeCounts||['D10','D13'].some(size=>m.sizeCounts[size]!==sizeCounts[size].total)))return hold('サイズ別本数と個体配置が不一致');
 return {status:'resolved',stand:k,rollId:o.rollId,generation:o.generation,totalCalibers:m.totalCalibers,sizeCounts,calibers,pairs:copy(m.pairs||[]),masterBasis:m.basis,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,operationAuthorized:false,writeAllowed:false};
}
function previewMasterPassline1517(input){
 const s=input||{},resolved=['15','16','17'].map(k=>resolveOnlineCaliberMaster(s,k));
 const hold=reason=>({status:'unconfirmed',reason,resolved,operationAuthorized:false,writeAllowed:false});
 if(resolved.some(r=>r.status!=='resolved'))return hold('オンライン個体配置未確認');
 const selected=[],pairEvidence=[];
 for(const r of resolved){
   const nums=s.selection?.[r.stand], count=s.size==='D10'&&r.stand!=='15'?2:1;
   if(!Array.isArray(nums)||nums.length!==count||new Set(nums).size!==count)return hold('使用候補番号未確認 #'+r.stand);
   for(const n of nums){
     const c=r.calibers.find(x=>x.number===n);
     if(!c||c.size!==s.size||!c.grades.includes(s.grade)||c.available!==true||c.runs===null)return hold('個体配置・鋼種・使用可否・累計未確認 #'+r.stand);
     selected.push({...c,stand:r.stand,rollId:r.rollId,generation:r.generation,grade:s.grade,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,layoutBasis:c.basis});
   }
   if(count===2){
     const a=selected.filter(c=>c.stand===r.stand);
     const west=a.find(c=>c.column==='西')?.number,east=a.find(c=>c.column==='東')?.number;
     const p=r.pairs.filter(p=>p&&p.west===west&&p.east===east&&p.size===s.size&&Array.isArray(p.grades)&&p.grades.includes(s.grade)&&p.confirmed===true&&str(p.basis));
     if(p.length!==1)return hold('個体マスターの対応ペア未確認 #'+r.stand);
     pairEvidence.push({stand:r.stand,rollId:r.rollId,generation:r.generation,west,east,confirmed:true,size:s.size,grade:s.grade,snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:p[0].basis});
   }
 }
 const gate=previewPassline1517({...s,calibers:selected,pairEvidence});
 return {...gate,resolved,selected};
}
// New master-linked entry point for the single #16 or #17 campaign prototype.
// Original repeated-caliber-preview remains an isolated algorithm test helper.
function previewMasterLinkedCampaign(input,api){
 const s=input||{}, stages=Array.isArray(s.stages)?s.stages:[];
 const results=[], validated=[];
 const group=String(stages[0]?.stands?.[0]||'');
 const hold=reason=>{
   const prefix=validated.length?previewRepeatedCaliberCampaign({...s,stages:validated},api):null;
   return {...(prefix||{events:[],forecasts:[],unresolved:[]}),status:'master-linked-unresolved',reason,passlineResults:results,complete:false,operationAuthorized:false,writeAllowed:false};
 };
 if(s.anonymousOnly!==true||!stages.length)return hold('匿名・対象候補未確認');
 for(const stage of stages){
   if(!Array.isArray(stage?.stands)||stage.stands.length!==1||String(stage.stands[0])!==group||!['16','17'].includes(group))return hold('現在は#16/#17単独交換のみ');
   if(validated.length&&['15','16','17'].some(k=>k!==group&&JSON.stringify(stage.selection?.[k])!==JSON.stringify(validated[0].selection?.[k])))return hold('非交換スタンドのカリバが無断で変更された');
   const ctx={...s,grade:s.steelGrade,selection:stage.selection};
   const gate=previewMasterPassline1517(ctx);results.push({stageId:stage.id,...gate});
   if(gate.status!=='planning-match')return hold(gate.reason);
   const st=String(stage.stands[0]),sel=gate.selected.filter(c=>c.stand===st);
   const member=stage.members?.[0];
   if(stage.members?.length!==1||String(member?.standKey)!==st||member.rollId!==sel[0]?.rollId||member.generation!==sel[0]?.generation||!Array.isArray(member.activeCalibers)||member.activeCalibers.length!==sel.length)return hold('交換対象とオンラインマスター不一致');
   if(!sel.every(c=>member.activeCalibers.filter(g=>g&&g.id===String(c.number)&&g.runs===c.runs&&g.available===true&&g.steelGrade===s.steelGrade&&g.column===c.column).length===1))return hold('交換候補番号・直数・東西列とマスター不一致');
   validated.push(stage);
 }
 const out=previewRepeatedCaliberCampaign(s,api);
 return {...out,passlineResults:results,masterLinked:true};
}
module.exports={resolveOnlineCaliberMaster,previewMasterPassline1517,previewMasterLinkedCampaign};
