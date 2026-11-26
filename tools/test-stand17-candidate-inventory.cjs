'use strict';
function selfTest(preview,api){
 const revision='r1',snapshot='s1',grade='SD295';
 const groove=(number,column,size,centerMm,grades=[grade])=>({number,column,size,centerMm,grades,basis:'anonymous layout',datumId:'common',positionVerified:true,positionBasis:'anonymous position'});
 const pair=(west,east,grades=[grade])=>({west,east,size:'D10',grades,confirmed:true,basis:'anonymous pair'});
 const m=(stand,calibers,pairs=[])=>({stand,rollId:'anon'+stand,generation:'g1',totalCalibers:calibers.length,calibers,pairs,confirmed:true,basis:'anonymous layout',sourceRevision:revision});
 const a=m(15,[groove(1,'西','D10',100),groove(2,'西','D13',110),groove(3,'東','D10',400),groove(4,'東','D13',410)]);
 const b=m(16,[groove(1,'西','D10',100),groove(2,'西','D13',110),groove(3,'東','D10',400),groove(4,'東','D13',410)],[pair(1,3)]);
 const c=m(17,[groove(1,'西','D10',101),groove(2,'西','D10',120),groove(3,'西','D10',110,['SD345']),groove(4,'西','D13',112),groove(5,'東','D10',401),groove(6,'東','D10',450),groove(7,'東','D10',410,['SD345']),groove(8,'東','D13',412)],[pair(1,5),pair(2,6),pair(3,7,['SD345'])]);
 const ms=[a,b,c], onlineRows=ms.map(r=>({stand:r.stand,rollId:r.rollId,generation:r.generation,status:'online',snapshotId:snapshot,sourceRevision:revision,basis:'anonymous status'}));
 const usageRows=ms.flatMap(r=>r.calibers.map(g=>({stand:r.stand,rollId:r.rollId,generation:r.generation,number:g.number,runs:r.stand===17&&g.number===1?2:r.stand===17&&g.number===5?4:0,available:true,basis:'anonymous runs',snapshotId:snapshot,sourceRevision:revision})));
 const base={anonymousOnly:true,sourceRevision:revision,snapshotId:snapshot,basis:'anonymous candidate search',size:'D10',grade,onlineRows,masterRows:ms,usageRows,selection:{15:[1],16:[1,3]}};
 const run=x=>preview(x,api), r=run(base);
 const change=(fn)=>({...base,masterRows:ms.map(x=>x.stand===17?fn(JSON.parse(JSON.stringify(x))):x)});
 const use=(number,patch)=>({...base,usageRows:usageRows.map(u=>u.stand===17&&u.number===number?{...u,...patch}:u)});
 const d13={...base,size:'D13',selection:{15:[2],16:[2]},foldEvidence:[{confirmed:true,snapshotId:snapshot,sourceRevision:revision,size:'D13',grade,fromIdentity:JSON.stringify(['15','anon15','g1',2]),toIdentity:JSON.stringify(['16','anon16','g1',2]),basis:'anonymous fold'}]};
 const tests=[
 ['physical count is not usable pair count',r.physicalCount===6&&r.eligibleGroups===1],
 ['D10 pair uses smaller remaining runs',r.conditionalRemainingRuns===2&&r.candidates.find(c=>c.status==='candidate').remainingRuns===2],
 ['east 50mm excludes both grooves',r.candidates.some(c=>c.numbers.join(',')==='2,6'&&c.status==='excluded'&&c.reason.includes('40mm'))],
 ['SD345 dedicated pair not counted for SD295',r.candidates.some(c=>c.numbers.join(',')==='3,7'&&c.reason==='ペア鋼種制限')],
 ['unknown east remains unknown',run(change(m=>{m.calibers[4].centerMm=null;return m})).conditionalRemainingRuns===null],
 ['missing pair not exhaustion',run(change(m=>{m.pairs.pop();return m})).status==='partial-inventory'],
 ['overlapping pair no total',run(change(m=>{m.pairs.push(pair(1,6));return m})).conditionalRemainingRuns===null],
 ['unknown usage not zero',run(use(5,{runs:null})).conditionalRemainingRuns===null],
 ['damage excludes pair',run(use(5,{available:false})).conditionalRemainingRuns===0],
 ['limit reached excludes pair',run(use(5,{runs:6})).conditionalRemainingRuns===0],
 ['D13 single groove counted',run(d13).conditionalRemainingRuns===6&&run(d13).eligibleGroups===1],
 ['neighbor limit constrains line upper bound',run({...base,usageRows:usageRows.map(u=>u.stand===15&&u.number===1?{...u,runs:4}:u)}).conditionalLineUpperBound===1],
 ['no operating approval',!r.operationAuthorized&&!r.writeAllowed],
 ['input unchanged',JSON.stringify(base.masterRows)===JSON.stringify(ms)],
 ['missing online not zero',run({...base,onlineRows:onlineRows.slice(0,2)}).conditionalRemainingRuns===null]
 ];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);
 const {tests}=selfTest(require('./stand17-candidate-inventory.cjs').previewStand17CandidateInventory,ctx);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
