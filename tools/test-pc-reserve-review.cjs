'use strict';
const {fixture}=require('./test-pc-annual-sheet-export.cjs');
const {previewPcReserveReview}=require('./pc-reserve-review.cjs');
const {renderPcPurchasePanel}=require('./pc-purchase-panel.cjs');
function selfTest(){
 const x=fixture(),tag={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'匿名根拠'},clone=v=>JSON.parse(JSON.stringify(v));
 const roles=(k,status='used-standby',assembled=true,eligible=true)=>[
 {...tag,stand:k,rollId:'A',generation:'g1',status:'online',actualStateVerified:true},
 {...tag,stand:k,rollId:'B',generation:'g1',status,chockAssembled:assembled,emergencyEligible:eligible,normalEligible:true,actualStateVerified:true},
 {...tag,stand:k,rollId:'C',generation:'g1',status:'rework',chockAssembled:false,emergencyEligible:false,actualStateVerified:true}];
 const snapshot=(k,rs)=>({...tag,stand:k,date:x.asOf,kind:'actual',complete:true,roles:rs});
 x.reserveActualSnapshots=[snapshot('8',roles('8')),snapshot('9',roles('9','used-standby',false,false)),snapshot('12',roles('12')),snapshot('16',roles('16','new-unassembled',false,false))];
 const root=x.circulations[0].result,entry=root.stages[0],safe={forecastOnly:true,writeAllowed:false,operationAuthorized:false};
 const p=roles('8','used-standby',false,false);p.forEach(r=>{r.forecastOnly=true;delete r.actualStateVerified;});
 entry.next={...entry.next,...safe,rotationComplete:true,endingRoles:p,sequence:{events:[{rollChanged:true,date:'2027-11-08'}]}};
 const assembled=roles('8','new-standby');assembled[1].conditionalAssembly=true;assembled.forEach(r=>r.forecastOnly=true);
 Object.assign(entry.stage,safe,{roles:assembled,handovers:[{stand:'8',targetIdentity:'["8","B","g1"]',status:'conditional-on-future-receipt',forecastOnly:true,actualCompletion:false,date:'2027-11-10'}]});
 const before=JSON.stringify(x),run=v=>previewPcReserveReview(v),r=run(x),cur=(k,a=r)=>a.current.find(z=>z.stand===k),f=(date,a=r)=>a.forecast.find(z=>z.date===date),bad=fn=>{const c=clone(x);fn(c);return run(c);};
 const html=renderPcPurchasePanel(x);
 const c=bad(v=>{const z=clone(v.circulations[0]);z.result.stages[0].next.endingRoles[1].chockAssembled=true;z.result.stages[0].next.endingRoles[1].emergencyEligible=true;v.circulations.push(z);});
 return [
 ['All 16 stand current rows',r.current.length===16],
 ['Used assembled emergency spare is not normal #8',cur('8').emergencyCount===1&&cur('8').normalCount===0],
 ['Verified zero actual',cur('9').emergencyCount===0&&cur('9').state==='実際の予備不足'],
 ['Missing state not zero',cur('4').emergencyCount===null&&cur('4').state==='情報不足'],
 ['Unassembled arrival not spare',cur('16').emergencyCount===0],
 ['Used normal requires explicit eligibility #12',cur('12').normalCount===1&&cur('12',bad(v=>delete v.reserveActualSnapshots[2].roles[1].normalEligible)).normalCount===null],
 ['Missing role not zero',cur('9',bad(v=>v.reserveActualSnapshots[1].roles.pop())).emergencyCount===null],
 ['Duplicate physical roll not counted',cur('8',bad(v=>v.reserveActualSnapshots[0].roles[2].rollId='B')).emergencyCount===null],
 ['Stale snapshot not current',cur('8',bad(v=>v.reserveActualSnapshots[0].date='2027-11-05')).emergencyCount===null],
 ['Forecast snapshot never actual',cur('8',bad(v=>v.reserveActualSnapshots[0].roles[1].forecastOnly=true)).emergencyCount===null],
 ['Forecast zero and current one coexist',f('2027-11-08').state==='将来の予備不足見込み'&&cur('8').emergencyCount===1],
 ['Later assembly does not erase earlier zero',f('2027-11-10').emergencyCount===1&&f('2027-11-08').emergencyCount===0],
 ['Conflicting zero evidence visible',f('2027-11-08',c).emergencyCount===null&&f('2027-11-08',c).possibleShortage===true],
 ['Incomplete rotation not fabricated forecast',!f('2027-11-08',bad(v=>v.circulations[0].result.stages[0].next.rotationComplete=false))],
 ['Unverified assembly target not counted',!f('2027-11-10',bad(v=>v.circulations[0].result.stages[0].stage.handovers[0].targetIdentity='wrong'))],
 ['Linked pair with zero member unavailable',r.pairReview.find(p=>p.stands.join(',')==='8,9').state==='片側予備不足・ペア未成立'],
 ['Panel contains all three states and both reserve types',html.includes('実際の予備不足')&&html.includes('将来の予備不足見込み')&&html.includes('情報不足')&&html.includes('通常予備')&&html.includes('購入需要一覧')],
 ['No mutation or authority',JSON.stringify(x)===before&&!r.writeAllowed&&!r.operationAuthorized&&!r.complete]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
