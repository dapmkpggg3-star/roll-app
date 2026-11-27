'use strict';
// Anonymous PC-side candidate search: fixed #13, coupled #14/#15, separate #16/#17.
// A positional candidate is not a confirmed exchange slot or operation authorization.
const {resolveOnlineCaliberMaster,previewMasterPassline1517}=require('./individual-caliber-master.cjs');
function previewDownstreamCombinations(input,api){
 const s=input||{}, candidates=[],issues=[],rejected={};
 const str=x=>typeof x==='string'&&x.trim().length>0;
 const end=(status,extra={})=>({status,candidates,issues,rejected,operationAuthorized:false,writeAllowed:false,...extra});
 const hold=reason=>{issues.push(reason);return end('unconfirmed',{preferred:null,searchComplete:false});};
 if(s.anonymousOnly!==true||!['D10','D13'].includes(s.size)||!['SD295','SD345'].includes(s.grade)||!str(s.basis)||typeof api?.monthlyUsageThreshold!=='function'||typeof api?.monthlyExchangeEffort!=='function')return hold('対象・基準未確認');
 const stands=['13','14','15','16','17'];
 const resolved=stands.map(k=>resolveOnlineCaliberMaster(s,k));
 if(resolved.some(r=>r.status!=='resolved'))return hold('個体・世代別配置未確認');
 const by=Object.fromEntries(resolved.map(r=>[r.stand,r]));
 const limits=Object.fromEntries(stands.map(k=>[k,api.monthlyUsageThreshold(k,s.size)?.runs]));
 if(stands.some(k=>!Number.isInteger(limits[k])||limits[k]<=0))return hold('直数基準未確認');
 let complete=true;
 const unknown=reason=>{complete=false;if(!issues.includes(reason))issues.push(reason);};
 const reject=reason=>{rejected[reason]=(rejected[reason]||0)+1;};
 const two=k=>s.size==='D10'&&['16','17'].includes(k);
 const get=(k,n)=>by[k].calibers.find(c=>c.number===n);
 const canon=a=>[...a].sort((a,b)=>a-b).join(',');
 const prior={};
 for(const k of stands){
  const nums=s.selection?.[k];
  if(!Array.isArray(nums)||nums.length!==(two(k)?2:1)||new Set(nums).size!==nums.length||nums.some(n=>!get(k,n)||get(k,n).size!==s.size))return hold('現用番号未確認 #'+k);
  prior[k]=nums.slice();
 }
 if(prior['14'][0]!==prior['15'][0])return hold('現用#14/15ペア不一致');
 const validPos=c=>c&&typeof c.centerMm==='number'&&Number.isFinite(c.centerMm)&&c.centerMm>=0&&c.positionVerified===true&&str(c.positionBasis)&&str(c.datumId);
 const sameDatum=(a,b)=>validPos(a)&&validPos(b)&&a.datumId===b.datumId;
 const available=(k,nums)=>{
  const cs=nums.map(n=>get(k,n));
  if(cs.some(c=>!c||c.size!==s.size||!c.grades.includes(s.grade)||c.available===false||c.runs!==null&&c.runs>=limits[k]))return false;
  if(cs.some(c=>c.available!==true||c.runs===null)){unknown('使用可否・直数未確認 #'+k);return false;}
  return true;
 };
 const groups=k=>{
  const r=by[k], cs=r.calibers.filter(c=>c.size===s.size);
  if(!two(k))return cs.map(c=>[c.number]).filter(ns=>available(k,ns));
  if(!Array.isArray(r.pairs)){unknown('対応ペア台帳未確認 #'+k);return [];}
  const used=new Set(), out=[];
  for(const p of r.pairs.filter(p=>p?.size==='D10')){
   const w=get(k,p.west),e=get(k,p.east);
   if(!w||!e||w.size!==s.size||e.size!==s.size||w.column!=='西'||e.column!=='東'||p.confirmed!==true||!str(p.basis)||!Array.isArray(p.grades)||!p.grades.length||p.grades.some(g=>!['SD295','SD345'].includes(g))||used.has(p.west)||used.has(p.east)){unknown('対応ペア重複・根拠不足 #'+k);continue;}
   used.add(p.west);used.add(p.east);
   if(p.grades.includes(s.grade)&&available(k,[p.west,p.east]))out.push([p.west,p.east]);
  }
  if(cs.some(c=>!used.has(c.number)))unknown('対応ペア未登録 #'+k);
  return out;
 };
 const c13=get('13',prior['13'][0]);
 if(!available('13',prior['13']))return end('fixed-upstream-held',{preferred:null,searchComplete:complete,reason:'#13の変更・確認が必要。ロール替確定ではない'});
 const identity=(k,c)=>JSON.stringify([k,by[k].rollId,by[k].generation,c.number]);
 const g14=groups('14'),g16=groups('16'),g17=groups('17');
 // Only the coupled #14/#15 same-number and same-position normal case.
 const upstream=[];
 if(by['14'].totalCalibers!==by['15'].totalCalibers)return hold('#14/15本数違い・通常ペア不成立');
 for(const [n] of g14){
  const c14=get('14',n),c15=get('15',n);
  if(!available('15',[n])){reject('#14/15使用条件');continue;}
  if(c13.column!==c14.column||c14.column!==c15.column){reject('#13〜15列不一致');continue;}
  if(!sameDatum(c13,c14)||!sameDatum(c14,c15)){unknown('#13〜15位置基準未確認');continue;}
  const d=Math.abs(c13.centerMm-c14.centerMm);
  if(d>47||c14.centerMm!==c15.centerMm){reject('#13〜15位置条件不成立');continue;}
  if(s.size==='D13'){
   const match=(Array.isArray(s.approachEvidence)?s.approachEvidence:[]).filter(e=>e&&e.confirmed===true&&e.snapshotId===s.snapshotId&&e.sourceRevision===s.sourceRevision&&e.size===s.size&&e.grade===s.grade&&e.fromIdentity===identity('13',c13)&&e.toIdentity===identity('14',c14)&&str(e.basis));
   if(match.length!==1){unknown('#13→14 D13個別対応未確認');continue;}
  }
  upstream.push({n,delta:d});
 }
 // Unknown or duplicate master pair entries prevent a global optimum claim.
 const count=upstream.length*g16.length*g17.length;
 if(count>10000)return hold('組合せ上限超過・探索未完');
 for(const u of upstream)for(const ns16 of g16)for(const ns17 of g17){
  const selection={'13':prior['13'],'14':[u.n],'15':[u.n],'16':ns16,'17':ns17};
  const gate=previewMasterPassline1517({...s,selection});
  if(gate.status!=='planning-match'){
   if(gate.status==='unconfirmed')unknown(gate.reason);
   else reject(gate.reason);
   continue;
  }
  const changes=[];
  if(canon(selection['14'])!==canon(prior['14'])||canon(selection['15'])!==canon(prior['15']))changes.push(['14','15']);
  for(const k of ['16','17'])if(canon(selection[k])!==canon(prior[k]))changes.push([k]);
  const effort=changes.map(g=>api.monthlyExchangeEffort('caliberChange',g,s.size));
  if(effort.some(e=>!e||!Number.isFinite(e.minutes))){unknown('作業時間基準未確認');continue;}
  const detail=stands.flatMap(k=>selection[k].map(n=>({stand:k,rollId:by[k].rollId,generation:by[k].generation,number:n,runs:get(k,n).runs,limit:limits[k],remaining:limits[k]-get(k,n).runs})));
  const min=Math.min(...detail.map(c=>c.remaining));
  const maxDelta=Math.max(0,...gate.checks.map(c=>c.deltaMm).filter(Number.isFinite));
  candidates.push({selection,changes,changeCount:changes.length,referenceMinutes:effort.reduce((a,e)=>a+e.minutes,0),remainingRuns:min,checks:[{segment:'13→14',deltaMm:u.delta,limitMm:47},{segment:'14→15',deltaMm:0},...gate.checks],maxDownstreamDeltaMm:maxDelta,detail,status:'conditional-candidate'});
 }
 // Provisional ranking only: fewer exchange tasks, then more remaining runs,
 // then smaller downstream offset. No actual date/capacity or annual optimum.
 candidates.sort((a,b)=>a.changeCount-b.changeCount||b.remainingRuns-a.remainingRuns||a.maxDownstreamDeltaMm-b.maxDownstreamDeltaMm||JSON.stringify(a.selection).localeCompare(JSON.stringify(b.selection)));
 return end(complete?'conditional-search':'partial-search',{searchComplete:complete,preferred:candidates[0]||null,combinationCount:count,scope:'固定#13・#14/15連動・#16/17個別。同サイズ鋼種。#12以前・停止枠・予備・将来最適化未接続。'});
}
module.exports={previewDownstreamCombinations};
