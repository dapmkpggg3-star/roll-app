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

 const a=m(12,[g(1,'西','D10',110),g(2,'西','D13',130),g(3,'西','D13',140),g(4,'東','D10',410),g(5,'東','D13',430),g(6,'東','D13',440)]);
 const id=(stand,n)=>JSON.stringify([String(stand),'r'+stand,'g1',n]);
 const map=(n,ns,size)=>({confirmed:true,snapshotId,sourceRevision,size,grade,fromIdentity:id(12,n),toIdentities:ns.map(v=>id(13,v)),basis:'anonymous correspondence'});
 const ev=(from,to,n1,n2)=>({confirmed:true,snapshotId,sourceRevision,size:'D13',grade,fromIdentity:id(from,n1),toIdentity:id(to,n2),basis:'anonymous'});
 const input={...base,masterRows:[a,...ms],onlineRows:[{stand:12,rollId:'r12',generation:'g1',status:'online',snapshotId,sourceRevision,basis:'anonymous'},...onlineRows],usageRows:[...a.calibers.map(c=>({stand:12,rollId:'r12',generation:'g1',number:c.number,runs:0,available:true,basis:'anonymous',snapshotId,sourceRevision})),...usageRows.map(u=>({...u,runs:u.stand===13&&u.number===1?6:0}))],selection:{...base.selection,12:[1]},link1213Evidence:[map(1,[1,2],'D10'),map(4,[5,6],'D10')]};
 const run=x=>preview(x,api),r=run(input);
 const d13={...input,size:'D13',selection:{13:[3],12:[2],14:[3],15:[3],16:[3],17:[3]},link1213Evidence:[map(2,[3],'D13'),map(3,[4],'D13'),map(5,[7],'D13'),map(6,[8],'D13')],approachEvidence:[3,4,7,8].flatMap(n=>[3,4,7,8].map(v=>ev(13,14,n,v))),foldEvidence:[3,4,7,8].flatMap(n=>[3,4,7,8].map(v=>ev(15,16,n,v))),usageRows:input.usageRows.map(u=>({...u,runs:u.stand===12&&u.number===2?11:0}))};
 const dr=run(d13);
 const changed=(x,stand,num,patch)=>({...x,usageRows:x.usageRows.map(u=>u.stand===stand&&u.number===num?{...u,...patch}:u)});
 const before=JSON.stringify(input);
 const tests=[
 ['D10 only 13 changes inside correspondence',r.preferred?.selection['12'][0]===1&&r.preferred?.selection['13'][0]===2&&r.preferred?.changes.map(g=>g.join(',')).join(';')==='13'],
 ['D10 13 only reference 180 minutes',r.preferred?.referenceMinutes===180],
 ['D10 12 and 13 share remaining minimum',r.preferred?.remainingRuns===5],
 ['D10 no inferred correspondence',run({...input,link1213Evidence:[]}).preferred===null],
 ['D10 no one-target mapping',run({...input,link1213Evidence:[map(1,[1],'D10'),map(4,[5,6],'D10')]}).preferred===null],
 ['D10 duplicate cross lane mapping held',run({...input,link1213Evidence:[map(1,[1,5],'D10'),map(4,[5,6],'D10')]}).preferred===null],
 ['D10 current correspondence wrong held',run({...input,selection:{...input.selection,13:[5]}}).preferred===null],
 ['D10 same lane preferred',r.preferred?.columnChange===false],
 ['D10 east only if west exhausted',run(changed(input,13,2,{runs:6})).preferred?.columnChange===true],
 ['D13 both must change together',dr.preferred?.selection['12'][0]===3&&dr.preferred?.selection['13'][0]===4&&dr.preferred?.changes.some(g=>g.join(',')==='12,13')],
 ['D13 no single 12/13 exchange',dr.candidates.every(c=>!c.changes.some(g=>g.length===1&&['12','13'].includes(g[0])))],
 ['D13 exact position mismatch held',run({...d13,masterRows:d13.masterRows.map(x=>x.stand===12?{...x,calibers:x.calibers.map(c=>c.number===3?{...c,centerMm:140.1}:c)}:x)}).preferred===null],
 ['D13 zero change when existing valid',run(changed(d13,12,2,{runs:0})).preferred?.changeCount===0],
 ['unknown usage not zero',run(changed(input,13,2,{runs:null})).searchComplete===false],
 ['stale mapping held',run({...input,link1213Evidence:input.link1213Evidence.map(e=>({...e,snapshotId:'old'}))}).preferred===null],
 ['input unmodified',JSON.stringify(input)===before],
 ['no authorization',!r.operationAuthorized&&!r.writeAllowed]
 ];
 return {tests,result:r,d13:dr};
}
module.exports={selfTest};
if(require.main===module){
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);
 const {tests}=selfTest(require('./linked-12-17-combinations.cjs').previewLinked1217,ctx);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
