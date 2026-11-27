'use strict';
function selfTest(preview,charge,api){
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

 const epoch=Date.parse('2027-04-01T00:00:00+09:00')/60000;
 const commonPeriod=(id,start,end,type)=>({id,start:epoch+start,end:epoch+end,type,date:new Date((epoch+start+540)*60000).toISOString().slice(0,10),confirmed:true,dateRowVerified:true,basis:'anonymous timeline'});
 const prod=(id,start,end,minutes=240)=>({...commonPeriod(id,start,end,'production'),shiftId:id,size:'D10',grade,productionMinutes:minutes});
 const eligible=stands=>({stands,basis:'anonymous stop evidence',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false});
 const stop=(id,start,end,groups=[['13']])=>({...commonPeriod(id,start,end,'stop'),lineStopped:true,team:'常昼',capacity:groups.length,capacityBasis:'anonymous capacity',eligibility:groups.map(eligible)});
 const start={...input,timelineVerified:true,timelineBasis:'anonymous continuous period rows',usageRows:input.usageRows.map(u=>u.stand===13&&u.number===1?{...u,runs:5}:u)};

 const all=['12','13','14','15','16','17'];
 const d10sel={...input.selection},d13sel={12:[2],13:[3],14:[3],15:[3],16:[3],17:[3]};
 const target=(size,selection,grade='SD295')=>({confirmed:true,basis:'anonymous target',snapshotId,sourceRevision,size,grade,selection});
 const szstop=(id,start,end,fromSize,toSize,redPassIncluded=false)=>({...stop(id,start,end,[]),sizeChangeEvidence:{...eligible(all),fromSize,toSize,snapshotId,sourceRevision,upstreamReady:true,redPassIncluded}});
 const periods=[prod('p1',0,240),szstop('s1',240,630,'D10','D13'),{...prod('p2',630,870),size:'D13',targetSelectionEvidence:target('D13',d13sel)},szstop('s2',870,1230,'D13','D10',true),{...prod('p3',1230,1470),targetSelectionEvidence:target('D10',d10sel)}];
 const mixed={...start,mixedSizePreview:true,usageRows:start.usageRows.map(u=>({...u,runs:0})),link1213Evidence:[...input.link1213Evidence,map(2,[3],'D13'),map(3,[4],'D13'),map(5,[7],'D13'),map(6,[8],'D13')],approachEvidence:[3,4,7,8].flatMap(n=>[3,4,7,8].map(v=>ev(13,14,n,v))),foldEvidence:[3,4,7,8].flatMap(n=>[3,4,7,8].map(v=>ev(15,16,n,v))),periods};
 const run=patch=>preview({...mixed,...patch},api),r=run({});
 const get=(x,st,n)=>x.endingUsage.find(u=>u.stand===st&&u.number===n)?.runs;
 const se=r.events.filter(e=>e.type==='size-exchange-preview');
 const badStop=patch=>run({periods:periods.map(p=>p.id==='s1'?{...p,...patch}:p)});
 const badEv=patch=>badStop({sizeChangeEvidence:{...periods[1].sizeChangeEvidence,...patch}});
 const gradeMaster=mixed.masterRows.map(m=>({...m,calibers:m.calibers.map(c=>({...c,grades:m.stand===17&&[2,6].includes(c.number)?['SD345']:['SD295','SD345']})),pairs:(m.pairs||[]).map(p=>({...p,grades:m.stand===17&&p.west===2?['SD345']:['SD295','SD345']}))}));
 const chargeSelection={...d10sel,16:[2,6],17:[2,6]};
 const chargeInput={...mixed,masterRows:gradeMaster,link1213Evidence:mixed.link1213Evidence.map(e=>({...e,grade:'SD345'})),chargePlan:{size:'D10',grade:'SD345',chargeCount:1,date:'2027-04-01',shiftId:'I-A',dateRowVerified:true,basis:'anonymous provisional charge',targetSelectionEvidence:target('D10',chargeSelection,'SD345')}};
 const cp=charge(chargeInput,api);
 const tests=[
 ['D10 D13 D10 three shifts complete',r.complete&&r.operatingRuns===3&&r.endingSize==='D10'],
 ['two size changes with 390 and 360 min',se.length===2&&se[0].referenceMinutes===390&&se[1].referenceMinutes===360],
 ['size changes do not consume caliber capacity',se.every(e=>e.countsAgainstCaliberCapacity===false)],
 ['D10 resume counts not reset',get(r,12,1)===2&&get(r,13,1)===2&&get(r,17,1)===2&&get(r,17,5)===2],
 ['D13 usage remains separate',get(r,12,2)===1&&get(r,17,3)===1],
 ['size switch needs stop evidence',!badStop({sizeChangeEvidence:null}).complete],
 ['size switch requires upstream readiness',!badEv({upstreamReady:false}).complete],
 ['size switch rejects stale evidence',!badEv({sourceRevision:'old'}).complete],
 ['size switch rejects safety block',!badEv({safetyBlocked:true}).complete],
 ['wrong target size rejected',!badEv({toSize:'D10'}).complete],
 ['size switch does not silently consume old groove',!run({periods:periods.map(p=>p.id==='p2'?{...p,targetSelectionEvidence:null}:p)}).complete],
 ['unconfirmed red-pass inclusion needs 390min',!run({periods:periods.map(p=>p.id==='s2'?{...p,sizeChangeEvidence:{...p.sizeChangeEvidence,redPassIncluded:false}}:p)}).complete],
 ['390 default fails 389',!run({periods:[periods[0],szstop('s1',240,629,'D10','D13'),{...prod('p2',629,869),size:'D13',targetSelectionEvidence:target('D13',d13sel)}]}).complete],
 ['SD345 charge is provisional not runs',cp.status==='provisional-charge-plan'&&cp.chargeCount===1&&cp.convertedRuns===null&&cp.gradeTransitionReviewRequired],
 ['charge requires dedicated valid grade pair',charge({...chargeInput,masterRows:mixed.masterRows},api).status==='unconfirmed'],
 ['charge count cannot become shift',charge({...chargeInput,chargePlan:{...chargeInput.chargePlan,chargeCount:2}},api).status==='unconfirmed'],
 ['SD345 actual mixed shift remains held',(()=>{const x=run({periods:[periods[0],{...prod('p2',240,480),grade:'SD345',chargeCount:1}]});return !x.complete&&x.operatingRuns===1&&x.unresolved[0].convertedRuns===null&&x.unresolved[0].chargeCount===1})()],
 ['no write permission',!r.writeAllowed&&!cp.writeAllowed&&!r.operationAuthorized&&!cp.operationAuthorized]
 ];
 return {tests,result:r,charge:cp};
}
module.exports={selfTest};
if(require.main===module){
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);
 const mod=require('./linked-campaign-consumption.cjs');
 const {tests}=selfTest(mod.previewLinkedCampaign,mod.previewSD345ChargePlan,ctx);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
