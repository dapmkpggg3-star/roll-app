'use strict';
function selfTest(preview){
 const identity=c=>JSON.stringify([String(c.stand),c.rollId,c.generation,c.number]);
 const base={anonymousOnly:true,size:'D10',grade:'SD295',snapshotId:'t1',sourceRevision:'s1',basis:'anonymous source'};
 const c=(stand,number,column,centerMm,size='D10')=>({stand,number,column,centerMm,size,grade:'SD295',snapshotId:'t1',sourceRevision:'s1',rollId:'r'+stand,generation:'g1',available:true,layoutBasis:'anonymous layout',datumId:'common',positionBasis:'anonymous position',positionVerified:true});
 const d10=[c(15,1,'西',50),c(16,4,'西',258.5),c(16,10,'東',500),c(17,7,'西',260),c(17,18,'東',540)];
 const pair=(stand,west,east)=>({stand,west,east,rollId:'r'+stand,generation:'g1',confirmed:true,snapshotId:'t1',sourceRevision:'s1',size:'D10',grade:'SD295',basis:'anonymous pair'});
 const p={...base,calibers:d10,pairEvidence:[pair(16,4,10),pair(17,7,18)]};
 const d13=[c(15,6,'西',700,'D13'),c(16,1,'西',159,'D13'),c(17,2,'西',168,'D13')];
 const f={confirmed:true,snapshotId:'t1',sourceRevision:'s1',size:'D13',grade:'SD295',fromIdentity:identity(d13[0]),toIdentity:identity(d13[1]),basis:'anonymous confirmed prior plan'};
 const q={...base,size:'D13',calibers:d13,foldEvidence:[f]};
 const run=x=>preview(x);
 const change=(x,i,patch)=>({...x,calibers:x.calibers.map((c,j)=>j===i?{...c,...patch}:c)});
 const before=JSON.stringify(p),r=run(p);
 return [
 ['D10 two independent lanes and 40 inclusive',r.status==='planning-match'&&r.checks.slice(1).map(x=>x.deltaMm).join(',')==='1.5,40'],
 ['fold no straight limit',r.checks[0].deltaMm===null],
 ['east over 40 fails even when west passes',run(change(p,4,{centerMm:540.1})).status==='incompatible'],
 ['west over 40 fails',run(change(p,3,{centerMm:300})).status==='incompatible'],
 ['unknown east not inferred',run(change(p,2,{centerMm:null})).status==='unconfirmed'],
 ['unknown zero not silently substituted',run(change(p,2,{centerMm:0,positionVerified:false})).status==='unconfirmed'],
 ['different datum held',run(change(p,4,{datumId:'other'})).status==='unconfirmed'],
 ['missing east held',run({...p,calibers:d10.slice(0,4)}).status==='unconfirmed'],
 ['wrong pair held',run({...p,pairEvidence:[pair(16,4,11),pair(17,7,18)]}).status==='unconfirmed'],
 ['pair duplicate held',run({...p,pairEvidence:[...p.pairEvidence,p.pairEvidence[0]]}).status==='unconfirmed'],
 ['generation mismatch held',run(change(p,2,{generation:'g2'})).status==='unconfirmed'],
 ['wrong grade held',run(change(p,4,{grade:'SD345'})).status==='unconfirmed'],
 ['unavailable held',run(change(p,4,{available:false})).status==='unconfirmed'],
 ['stale revision held',run(change(p,4,{sourceRevision:'old'})).status==='unconfirmed'],
 ['stale time held',run(change(p,4,{snapshotId:'old'})).status==='unconfirmed'],
 ['D13 confirmed fold match',run(q).status==='planning-match'&&run(q).checks[1].deltaMm===9],
 ['D13 no inferred other same lane combination',run({...q,foldEvidence:[]}).status==='unconfirmed'],
 ['D13 fold cross lane incompatible',run(change(q,0,{column:'東'})).status==='incompatible'],
 ['D13 straight cross lane incompatible',run(change(q,2,{column:'東'})).status==='incompatible'],
 ['D13 different roll not inherited',run(change(q,0,{rollId:'new'})).status==='unconfirmed'],
 ['D13 double lane held',run({...q,calibers:[...d13,c(16,7,'東',338,'D13')]}).status==='unconfirmed'],
 ['never grants approval',!r.operationAuthorized&&!r.writeAllowed],
 ['input unchanged',JSON.stringify(p)===before],
 ['nonanonymous held',run({...p,anonymousOnly:false}).status==='unconfirmed']
 ];
}
module.exports={selfTest};
if(require.main===module){
 const tests=selfTest(require('./passline-15-17-preview.cjs').previewPassline1517);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
