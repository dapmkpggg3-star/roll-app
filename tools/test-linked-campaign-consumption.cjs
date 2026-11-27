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

 const epoch=Date.parse('2027-04-01T00:00:00+09:00')/60000;
 const commonPeriod=(id,start,end,type)=>({id,start:epoch+start,end:epoch+end,type,date:new Date((epoch+start+540)*60000).toISOString().slice(0,10),confirmed:true,dateRowVerified:true,basis:'anonymous timeline'});
 const prod=(id,start,end,minutes=240)=>({...commonPeriod(id,start,end,'production'),shiftId:id,size:'D10',grade,productionMinutes:minutes});
 const eligible=stands=>({stands,basis:'anonymous stop evidence',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false});
 const stop=(id,start,end,groups=[['13']])=>({...commonPeriod(id,start,end,'stop'),lineStopped:true,team:'常昼',capacity:groups.length,capacityBasis:'anonymous capacity',eligibility:groups.map(eligible)});
 const start={...input,timelineVerified:true,timelineBasis:'anonymous continuous period rows',usageRows:input.usageRows.map(u=>u.stand===13&&u.number===1?{...u,runs:5}:u)};
 const periods=[prod('p1',0,240),stop('s1',240,480),prod('p2',480,720),prod('p3',720,960)];
 const run=(patch={})=>preview({...start,periods,...patch},api),r=run();
 const get=(r,stand,number)=>r.endingUsage.find(u=>u.stand===stand&&u.number===number)?.runs;
 const ex=r.events.filter(e=>e.type==='caliber-exchange-preview');
 const p1=r.events.find(e=>e.periodId==='p1');
 const p2=r.events.find(e=>e.periodId==='p2');
 const before=JSON.stringify(start);
 const tests=[
 ['three operating runs',r.complete&&r.operatingRuns===3],
 ['one stand13 exchange only',ex.length===1&&ex[0].changes.map(x=>x.join(',')).join(';')==='13'&&ex[0].periodId==='s1'],
 ['stand12 retains and increments 3',get(r,12,1)===3],
 ['stand13 old stays 6 new gets 2',get(r,13,1)===6&&get(r,13,2)===2],
 ['D10 eight grooves each one run not double count',p1?.consumption.length===8&&p1.operatingRuns===1&&p1.consumption.every(c=>c.after-c.before===1)],
 ['D10 west/east both consumed',get(r,16,1)===3&&get(r,16,5)===3&&get(r,17,1)===3&&get(r,17,5)===3],
 ['other-size usage unchanged',get(r,12,2)===0&&get(r,17,3)===0],
 ['no unnecessary exchange when valid',r.events.filter(e=>e.type==='production-preview').length===3&&p2?.selection['12'][0]===1],
 ['missing stop eligibility holds and keeps previous run',(()=>{const x=run({periods:[periods[0],{...periods[1],eligibility:[]},periods[2]]});return !x.complete&&x.operatingRuns===1&&x.unresolved[0]?.requiredExchange===true&&get(x,13,1)===6&&get(x,13,2)===0})()],
 ['no capacity holds',!run({periods:[periods[0],{...periods[1],capacity:0},periods[2]]}).complete],
 ['short stop holds',!run({periods:[prod('p1',0,240),stop('s1',240,419),prod('p2',419,659)]}).complete],
 ['safety blocked holds',!run({periods:[periods[0],{...periods[1],eligibility:[{...eligible(['13']),safetyBlocked:true}]},periods[2]]}).complete],
 ['gap rejected before consumption',run({periods:[periods[0],prod('p2',241,481)]}).operatingRuns===0],
 ['duplicate shift rejected',run({periods:[periods[0],{...prod('p2',240,480),shiftId:'p1'}]}).operatingRuns===0],
 ['two to four hour proposal held',!run({periods:[prod('p1',0,240,180)]}).complete],
 ['under two hours zero runs',(()=>{const x=run({periods:[prod('p1',0,240,119)]});return x.complete&&x.operatingRuns===0&&get(x,13,1)===5})()],
 ['exact four hours counts one',run({periods:[prod('p1',0,240)]}).operatingRuns===1],
 ['steel grade switch held',!run({periods:[periods[0],{...prod('p2',240,480),grade:'SD345'}]}).complete],
 ['unknown date row held',run({periods:[{...periods[0],dateRowVerified:false}]}).operatingRuns===0],
 ['input not mutated',JSON.stringify(start)===before],
 ['no write permission',!r.writeAllowed&&!r.operationAuthorized]
 ];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);
 const {tests}=selfTest(require('./linked-campaign-consumption.cjs').previewLinkedCampaign,ctx);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
