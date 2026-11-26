'use strict';
// R03/R05/R18/R19/R20: conditional #17 inventory with fixed #15/#16 positions.
// No automatic operating permission, no calendar or regrind date inference.
const {resolveOnlineCaliberMaster,previewMasterPassline1517}=require('./individual-caliber-master.cjs');
function previewStand17CandidateInventory(input,api){
 const s=input||{}, candidates=[],issues=[];
 const finish=(status,extra={})=>({status,candidates,issues,operationAuthorized:false,writeAllowed:false,...extra});
 const hold=reason=>{issues.push(reason);return finish('unconfirmed',{conditionalRemainingRuns:null});};
 if(s.anonymousOnly!==true||!['D10','D13'].includes(s.size)||!['SD295','SD345'].includes(s.grade)||typeof api?.monthlyUsageThreshold!=='function')return hold('対象サイズ・鋼種・基準未確認');
 const rs=['15','16','17'].map(k=>resolveOnlineCaliberMaster(s,k));
 if(rs.some(r=>r.status!=='resolved'))return hold('オンライン個体・配置未確認');
 const r=rs[2], limit=api.monthlyUsageThreshold('17',s.size)?.runs;
 if(!Number.isInteger(limit)||limit<=0)return hold('使用上限未確認');
 const selectedNeighbors=[];
 for(const n of rs.slice(0,2)){
  const nums=s.selection?.[n.stand], count=s.size==='D10'&&n.stand==='16'?2:1;
  if(!Array.isArray(nums)||nums.length!==count||new Set(nums).size!==count)return hold('隣接スタンド選択未確認');
  for(const number of nums){
   const c=n.calibers.find(x=>x.number===number), max=api.monthlyUsageThreshold(n.stand,s.size)?.runs;
   if(!c||c.size!==s.size||!c.grades.includes(s.grade)||c.available!==true||c.runs===null||!Number.isInteger(max))return hold('隣接スタンド使用条件未確認');
   selectedNeighbors.push({stand:n.stand,number,runs:c.runs,limit:max,remaining:Math.max(0,max-c.runs)});
  }
 }
 const neighborRemaining=Math.min(...selectedNeighbors.map(c=>c.remaining));
 const grooves=r.calibers.filter(c=>c.size===s.size);
 let groups=[], complete=true;
 if(s.size==='D13')groups=grooves.map(c=>[c.number]);
 else{
  if(!Array.isArray(r.pairs))return hold('対応ペア台帳未確認');
  const used=new Set();
  for(const p of r.pairs.filter(p=>p?.size==='D10')){
   const w=grooves.find(c=>c.number===p.west&&c.column==='西'),e=grooves.find(c=>c.number===p.east&&c.column==='東');
   if(!w||!e||p.confirmed!==true||typeof p.basis!=='string'||!p.basis.trim()||!Array.isArray(p.grades)||!p.grades.length||p.grades.some(g=>!['SD295','SD345'].includes(g))||used.has(p.west)||used.has(p.east)){complete=false;issues.push('対応ペア重複・根拠不足');continue;}
   used.add(p.west);used.add(p.east);
   if(p.grades.includes(s.grade))groups.push([p.west,p.east]);
   else candidates.push({numbers:[p.west,p.east],status:'excluded',reason:'ペア鋼種制限',remainingRuns:null});
  }
  if(grooves.some(c=>!used.has(c.number))){complete=false;issues.push('未登録対応ペアあり');}
 }
 for(const numbers of groups){
  const cs=numbers.map(n=>grooves.find(c=>c.number===n));
  const base={numbers,rollId:r.rollId,generation:r.generation,usedRuns:cs.map(c=>c.runs),limit};
  let reason=null;
  if(cs.some(c=>!c.grades.includes(s.grade)))reason='鋼種制限';
  else if(cs.some(c=>c.available===false))reason='使用不可';
  else if(cs.some(c=>c.runs!==null&&c.runs>=limit))reason='上限到達';
  if(reason){candidates.push({...base,status:'excluded',reason,remainingRuns:null});continue;}
  if(cs.some(c=>c.available!==true||c.runs===null)){complete=false;candidates.push({...base,status:'unconfirmed',reason:'使用量・状態未確認',remainingRuns:null});continue;}
  const gate=previewMasterPassline1517({...s,selection:{...s.selection,17:numbers}});
  if(gate.status!=='planning-match'){
   if(gate.status==='unconfirmed')complete=false;
   candidates.push({...base,status:gate.status==='incompatible'?'excluded':'unconfirmed',reason:gate.reason,remainingRuns:null,checks:gate.checks||[]});continue;
  }
  candidates.push({...base,status:'candidate',remainingRuns:Math.min(...cs.map(c=>limit-c.runs)),checks:gate.checks});
 }
 const eligible=candidates.filter(c=>c.status==='candidate');
 // Sum only disjoint explicitly registered groups; otherwise leave total unknown.
 const knownCandidateRuns=eligible.reduce((a,c)=>a+c.remainingRuns,0);
 const remaining=complete?knownCandidateRuns:null;
 return finish(complete?'conditional-inventory':'partial-inventory',{rollId:r.rollId,generation:r.generation,size:s.size,grade:s.grade,physicalCount:r.sizeCounts[s.size].total,eligibleGroups:eligible.length,conditionalRemainingRuns:remaining,knownCandidateRuns,neighborRemainingRuns:neighborRemaining,conditionalLineUpperBound:remaining===null?null:Math.min(remaining,neighborRemaining),basis:'固定#15/#16位置・同一サイズ鋼種・停止枠未考慮。連続使用寿命や交換日ではない'});
}
module.exports={previewStand17CandidateInventory};
