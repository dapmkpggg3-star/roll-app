'use strict';
function selfTest(preview,api){
 const sourceRevision='r1',snapshotId='s1',grade='SD295';
 const g=(number,column,size,centerMm,grades=[grade])=>({number,column,size,centerMm,grades,basis:'anonymous',datumId:'common',positionVerified:true,positionBasis:'anonymous'});
 const p=(west,east)=>({west,east,size:'D10',grades:[grade],confirmed:true,basis:'anonymous'});
 const m=(stand,calibers,pairs=[])=>({stand,rollId:'r'+stand,generation:'g1',totalCalibers:calibers.length,calibers,pairs,confirmed:true,basis:'anonymous',sourceRevision});
 const common=[g(1,'西','D10',100),g(2,'西','D10',120),g(3,'西','D13',130),g(4,'西','D13',140),g(5,'東','D10',400),g(6,'東','D10',420),g(7,'東','D13',430),g(8,'東','D13',440)];
 const ms=[m(13,common),m(14,common),m(15,common),m(16,[g(1,'西','D10',100),g(2,'西','D10',170),g(3,'西','D13',130),g(4,'西','D13',140),g(5,'東','D10',400),g(6,'東','D10',470),g(7,'東','D13',430),g(8,'東','D13',440)],[p(1,5),p(2,6)]),m(17,[g(1,'西','D10',100),g(2,'西','D10',170),g(3,'西','D13',130),g(4,'西','D13',140),g(5,'東','D10',400),g(6,'東','D10',470),g(7,'東','D13',430),g(8,'東','D13',440)],[p(1,5),p(2,6)])];
 const onlineRows=ms.map(r=>({stand:r.stand,rollId:r.rollId,generation:r.generation,status:'online',snapshotId,sourceRevision,basis:'anonymous'}));
 const usageRows=ms.flatMap(r=>r.calibers.map(c=>({stand:r.stand,rollId:r.rollId,generation:r.generation,number:c.number,runs:r.stand===17&&[1,5].includes(c.number)?6:0,available:true,basis:'anonymous',snapshotId,sourceRevision})));
 const base={anonymousOnly:true,sourceRevision,snapshotId,basis:'anonymous',size:'D10',grade,onlineRows,masterRows:ms,usageRows,selection:{13:[1],14:[1],15:[1],16:[1,5],17:[1,5]}};
 const run=x=>preview(x,api),r=run(base);
 const patch=(stand,num,props)=>({...base,usageRows:usageRows.map(u=>u.stand===stand&&u.number===num?{...u,...props}:u)});
 const master=(stand,fn)=>({...base,masterRows:ms.map(x=>x.stand===stand?fn(JSON.parse(JSON.stringify(x))):x)});
 const id=(stand,n)=>JSON.stringify([String(stand),'r'+stand,'g1',n]);
 const ev=(from,to,n1,n2)=>({confirmed:true,snapshotId,sourceRevision,size:'D13',grade,fromIdentity:id(from,n1),toIdentity:id(to,n2),basis:'anonymous'});
 const d13={...base,size:'D13',selection:{13:[3],14:[3],15:[3],16:[3],17:[3]},approachEvidence:[ev(13,14,3,3),ev(13,14,3,4)],foldEvidence:[ev(15,16,3,3),ev(15,16,3,4),ev(15,16,4,3),ev(15,16,4,4)]};
 const d13r=run(d13);
 const before=JSON.stringify(base);
 const tests=[
 ['second downstream pair unlocked by #16 change',r.preferred?.selection['16'].join(',')==='2,6'&&r.preferred?.selection['17'].join(',')==='2,6'],
 ['keep 14/15 if possible',r.preferred?.changes.map(x=>x.join('/')).join(',')==='16,17'],
 ['alternative paired 14/15 only together',r.candidates.some(c=>c.selection['14'][0]===2&&c.selection['15'][0]===2&&c.changes.some(g=>g.join(',')==='14,15'))],
 ['both D10 lanes checked',r.preferred?.checks.filter(c=>c.segment==='16→17').length===2],
 ['D10 operation runs not doubled',r.preferred?.remainingRuns===5],
 ['D13 retain current if eligible',d13r.preferred?.changeCount===0],
 ['D13 no implicit fold compatibility',run({...d13,foldEvidence:[]}).preferred===null],
 ['D13 explicit approach evidence required',run({...d13,approachEvidence:[]}).preferred===null],
 ['fixed 13 exhaustion does not trigger roll change',run(patch(13,1,{runs:6})).status==='fixed-upstream-held'],
 ['14/15 mismatched current held',run({...base,selection:{...base.selection,15:[2]}}).status==='unconfirmed'],
 ['14/15 position mismatch excludes changed pair',run(master(15,x=>{x.calibers[1].centerMm=121;return x})).candidates.every(c=>c.selection['15'][0]!==2)],
 ['47mm inclusive when paired positions match',run({...base,masterRows:ms.map(x=>[14,15].includes(x.stand)?{...x,calibers:x.calibers.map(c=>c.number===2?{...c,centerMm:147}:c)}:x)}).candidates.some(c=>c.selection['14'][0]===2&&c.checks[0].deltaMm===47)],
 ['above 47mm excluded',run({...base,masterRows:ms.map(x=>[14,15].includes(x.stand)?{...x,calibers:x.calibers.map(c=>c.number===2?{...c,centerMm:147.1}:c)}:x)}).candidates.every(c=>c.selection['14'][0]!==2)],
 ['unknown pair makes partial search',run(master(16,x=>{x.pairs.pop();return x})).searchComplete===false],
 ['unknown position no false optimum',run(master(17,x=>{x.calibers[5].centerMm=null;return x})).searchComplete===false],
 ['damaged pair excluded',run(patch(17,6,{available:false})).preferred===null],
 ['missing online not zero',run({...base,onlineRows:onlineRows.slice(1)}).status==='unconfirmed'],
 ['no operation authorization',!r.operationAuthorized&&!r.writeAllowed],
 ['no mutation',JSON.stringify(base)===before]
 ];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);
 const {tests}=selfTest(require('./downstream-combinations.cjs').previewDownstreamCombinations,ctx);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
