'use strict';
// R04/R08/R18/R20: explicit individual/generation-specific 12→13 correspondence.
// Compose with the existing downstream search; never infer a correspondence by number.
const {resolveOnlineCaliberMaster}=require('./individual-caliber-master.cjs');
const {previewDownstreamCombinations}=require('./downstream-combinations.cjs');
function previewLinked1217(input,api){
 const s=input||{}, candidates=[],issues=[];
 const end=(status,extra={})=>({status,candidates,issues,operationAuthorized:false,writeAllowed:false,...extra});
 const hold=reason=>{issues.push(reason);return end('unconfirmed',{searchComplete:false,preferred:null});};
 const str=x=>typeof x==='string'&&x.trim().length>0;
 if(s.anonymousOnly!==true||!['D10','D13'].includes(s.size)||!['SD295','SD345'].includes(s.grade)||typeof api?.monthlyUsageThreshold!=='function'||typeof api?.monthlyExchangeEffort!=='function')return hold('対象・基準未確認');
 const [a,b]=['12','13'].map(k=>resolveOnlineCaliberMaster(s,k));
 if(a.status!=='resolved'||b.status!=='resolved')return hold('#12/13個体・世代別配置未確認');
 const aa=a.calibers.filter(c=>c.size===s.size),bb=b.calibers.filter(c=>c.size===s.size);
 const id=(r,c)=>JSON.stringify([r.stand,r.rollId,r.generation,c.number]);
 const limitA=api.monthlyUsageThreshold('12',s.size)?.runs,limitB=api.monthlyUsageThreshold('13',s.size)?.runs;
 if(!Number.isInteger(limitA)||!Number.isInteger(limitB)||limitA<=0||limitB<=0)return hold('直数基準未確認');
 const oldA=s.selection?.['12'],oldB=s.selection?.['13'];
 if(!Array.isArray(oldA)||oldA.length!==1||!Array.isArray(oldB)||oldB.length!==1||!aa.some(c=>c.number===oldA[0])||!bb.some(c=>c.number===oldB[0]))return hold('現用#12/13未確認');
 const rows=Array.isArray(s.link1213Evidence)?s.link1213Evidence:[];
 const matches=rows.filter(e=>e&&e.snapshotId===s.snapshotId&&e.sourceRevision===s.sourceRevision&&e.size===s.size&&e.grade===s.grade);
 const mapped=[],seenB=new Set();let complete=true;
 const unknown=r=>{complete=false;if(!issues.includes(r))issues.push(r);};
 const position=c=>typeof c.centerMm==='number'&&Number.isFinite(c.centerMm)&&c.centerMm>=0&&c.positionVerified===true&&str(c.datumId)&&str(c.positionBasis);
 for(const x of aa){
   const found=matches.filter(e=>e.fromIdentity===id(a,x));
   if(found.length!==1){unknown('#12個別対応未確認・重複 '+x.number);continue;}
   const e=found[0], n=s.size==='D10'?2:1;
   if(e.confirmed!==true||!str(e.basis)||!Array.isArray(e.toIdentities)||e.toIdentities.length!==n||new Set(e.toIdentities).size!==n){unknown('#12→13対応本数・根拠不一致 '+x.number);continue;}
   const ys=e.toIdentities.map(k=>bb.find(y=>id(b,y)===k));
   if(ys.some(y=>!y||y.column!==x.column||seenB.has(y.number))){unknown('#12→13対応先・列・重複不一致 '+x.number);continue;}
   if(s.size==='D13'&&ys.some(y=>!position(x)||!position(y)||x.datumId!==y.datumId||x.centerMm!==y.centerMm)){unknown('D13中心完全一致未確認 '+x.number);continue;}
   for(const y of ys){seenB.add(y.number);mapped.push({x,y,basis:e.basis});}
 }
 if(bb.some(y=>!seenB.has(y.number)))unknown('#13未対応番号あり');
 // Do not proceed from an unverified current path, even if its usage is exhausted.
 if(!mapped.some(({x,y})=>x.number===oldA[0]&&y.number===oldB[0]))return hold('現用#12→13対応未確認');
 if(!complete)return hold('個体対応表の欠損・矛盾。候補選択保留');
 const avail=(c,limit)=>{
   if(!c.grades.includes(s.grade)||c.available===false||c.runs!==null&&c.runs>=limit)return false;
   if(c.available!==true||c.runs===null){unknown('累計直数・状態未確認');return false;}
   return true;
 };
 let evaluated=0;
 for(const {x,y,basis} of mapped){
   if(!avail(x,limitA)||!avail(y,limitB))continue;
   const changeA=x.number!==oldA[0],changeB=y.number!==oldB[0];
   if(s.size==='D13'&&changeA!==changeB){unknown('D13単独交換禁止');continue;}
   const down=previewDownstreamCombinations({...s,selection:{...s.selection,'13':[y.number]}},api);
   if(!down.searchComplete)unknown('下流探索未完');
   evaluated+=down.combinationCount||0;
   if(evaluated>10000)return hold('全組合せ探索上限超過');
   const changes=s.size==='D13'?(changeA?[['12','13']]:[]):[...(changeA?[['12']]:[]),...(changeB?[['13']]:[])];
   const effort=changeA&&changeB&&s.size==='D10'?api.monthlyExchangeEffort('caliberChange',['12','13'],s.size)?.minutes:changes.reduce((v,k)=>v+(api.monthlyExchangeEffort('caliberChange',k,s.size)?.minutes??NaN),0);
   if(!Number.isFinite(effort)){unknown('#12/13作業時間未確認');continue;}
   for(const c of down.candidates){
     const selection={...c.selection,'12':[x.number]};
     const detail=[{stand:'12',rollId:a.rollId,generation:a.generation,number:x.number,runs:x.runs,limit:limitA,remaining:limitA-x.runs},...c.detail];
     candidates.push({...c,selection,detail,changes:[...changes,...c.changes],changeCount:changes.length+c.changeCount,referenceMinutes:effort+c.referenceMinutes,remainingRuns:Math.min(limitA-x.runs,c.remainingRuns),columnChange:x.column!==aa.find(v=>v.number===oldA[0]).column,checks:[{segment:'12→13',rule:s.size==='D13'?'中心完全一致・1対1':'確認済み1対2',basis,deltaMm:s.size==='D13'?0:null},...c.checks]});
   }
 }
 candidates.sort((x,y)=>Number(x.columnChange)-Number(y.columnChange)||x.changeCount-y.changeCount||y.remainingRuns-x.remainingRuns||x.maxDownstreamDeltaMm-y.maxDownstreamDeltaMm||JSON.stringify(x.selection).localeCompare(JSON.stringify(y.selection)));
 return end(complete?'conditional-search':'partial-search',{searchComplete:complete,preferred:candidates[0]||null,evaluated,scope:'同サイズ鋼種・個体対応・#12〜17。列変更は参考候補、#11以前・停止枠・予備・年間寿命未接続。'});
}
module.exports={previewLinked1217};
