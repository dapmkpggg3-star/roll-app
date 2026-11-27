'use strict';
function selfTest(preview,api){ const sourceRevision='r1',snapshotId='s1',grade='SD295';
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


 const st='17',old=ms.find(x=>x.stand===17),replacement={...old,rollId:'new17',generation:'g2',calibers:old.calibers.map(c=>({...c}))};
 const newUsage=replacement.calibers.map(c=>({stand:17,rollId:'new17',generation:'g2',number:c.number,runs:0,available:true,basis:'anonymous',snapshotId,sourceRevision}));
 const usage=[...input.usageRows.map(u=>({...u,runs:u.stand===17?6:0})),...newUsage];
 const idOf=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const role=(rollId,generation,status)=>({stand:17,rollId,generation,status,basis:'anonymous',snapshotId,sourceRevision,chockAssembled:true,emergencyEligible:true});
 const roles=[role('r17','g1','online'),role('new17','g2','new-standby'),role('third','g1','rework')];
 const campaign={status:'campaign-preview-held',endingUsage:usage,endingSelection:input.selection,endingSize:'D10',unresolved:[{requiredExchange:true,searchComplete:true,candidateCount:0,periodId:'next',date:'2027-04-01'}]};
 const exchange={stand:17,confirmed:true,replacementRequired:true,basis:'anonymous',snapshotId,sourceRevision,forPeriod:'next',oldIdentity:idOf(roles[0]),newIdentity:idOf(roles[1]),oldEmergencyEligibleAfterRemoval:true,reserveBasis:'anonymous',selection:input.selection,stop:{...stop('stop',0,360,[['17']]),forPeriod:'next',preparationReady:true,additionalReady:true,safetyBlocked:false}};
 const s={...input,masterRows:[...input.masterRows,replacement],roles,campaign,exchange};
 const before=JSON.stringify(s),r=preview(s,api);
 const run=p=>preview({...s,...p},api);
 const ex=p=>run({exchange:{...exchange,...p}});
 const sl=p=>ex({stop:{...exchange.stop,...p}});
 return {tests:[['handover',r.status==='conditional-handover'],['old retained',r.roles?.[0].status==='used-standby'&&r.roles?.[0].chockAssembled],['new online',r.roles?.[1].status==='online'&&r.onlineRows?.find(x=>x.stand===17).rollId==='new17'],['third unchanged',r.roles?.[2].status==='rework'],['old usage retained',r.usageRows?.find(u=>u.stand===17&&u.rollId==='r17').runs===6],['new usage retained',r.usageRows?.find(u=>u.rollId==='new17').runs===0],['reserve count',r.emergencyReserveCount===1],['unknown search',run({campaign:{...campaign,unresolved:[{...campaign.unresolved[0],searchComplete:false}]}}).status==='held'],['capacity missing',sl({capacity:null}).status==='held'],['359 minutes',sl({end:exchange.stop.end-1}).status==='held'],['safety blocked',sl({safetyBlocked:true}).status==='held'],['not assembled',run({roles:roles.map((r,i)=>i===1?{...r,chockAssembled:false}:r)}).status==='held'],['old unusable',ex({oldEmergencyEligibleAfterRemoval:false}).status==='held'],['duplicate ID',run({roles:[roles[0],roles[1],roles[1]]}).status==='held'],['missing new master',run({masterRows:input.masterRows}).status==='held'],['wrong path',ex({selection:{...input.selection,17:[2,6]}}).status==='held'],['untouched stand',ex({selection:{...input.selection,16:[2,6]}}).status==='held'],['input unchanged',before===JSON.stringify(s)],['no authorization',r.operationAuthorized===false&&r.writeAllowed===false]],result:r};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./single-roll-handover.cjs').previewSingleRollHandover,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
