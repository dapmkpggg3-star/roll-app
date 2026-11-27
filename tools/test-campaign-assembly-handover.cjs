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

 const startUsage=usage.map(u=>u.rollId==='r17'&&[1,5].includes(u.number)?{...u,runs:5}:u);
 const first=prod('first',0,240),stp=stop('exchange',240,600,[['17']]),second=prod('second',600,840),third=prod('third',840,1080);
 const exchange={stand:17,confirmed:true,replacementRequired:true,basis:'anonymous',snapshotId,sourceRevision,forPeriod:'second',stopId:'exchange',oldIdentity:idOf(roles[0]),newIdentity:idOf(roles[1]),oldEmergencyEligibleAfterRemoval:true,reserveBasis:'anonymous',selection:input.selection};
 const s={...input,masterRows:[...input.masterRows,replacement],usageRows:startUsage,roles,rollExchange:exchange,timelineVerified:true,timelineBasis:'anonymous',periods:[first,stp,second,third]};

 const slot={workArea:'workshop',status:'forecast',basis:'anon',period:'day',date:'2027-04-02',workshopWorking:true,workshopCalendarBasis:'anon',offlineIsolated:true,isolationBasis:'anon',independentOfLineCrew:true,capacityConfirmed:true,capacityBasis:'anon',startHour:8,endHour:16,workshopStartHour:8,workshopEndHour:17,requiredHours:6,reservedHours:6,people:2,availablePeople:2,prepared:'reworkInbound',preparedTarget:'third',preparedOn:'2027-04-01',owner:{rollId:'third',standKey:'17'}};
 const assembly={snapshotId,sourceRevision,oldIdentity:idOf(roles[0]),targetIdentity:idOf(roles[2]),basis:'anon',slot,day:{date:slot.date,dateRowVerified:true,productionAmount:400,nightOperating:true},receipt:{status:'actual',identity:idOf(roles[2]),date:'2027-04-01',basis:'anon',present:true,unassembled:true,usable:true},sameDayCompletionPlanned:true,targetEmergencyEligible:true,oldDispatchReadyPlanned:true,safetyBlocked:false,completionBasis:'anon',nightBasis:'anon'};
 const x={...s,asOf:'2027-04-01',assembly};const before=JSON.stringify(x),r=preview(x,api),run=p=>preview({...x,assembly:{...assembly,...p}},api),sl=p=>run({slot:{...slot,...p}}),rec=p=>run({receipt:{...assembly.receipt,...p}});const held=y=>y.assemblyHandover?.status==='held'&&y.assemblyHandover.oldReserveRetained&&y.roles[0].status==='used-standby';
 return {tests:[['conditional handover',r.assemblyHandover?.status==='conditional-assembly'],['old dispatch ready forecast',r.projectedRoles?.[0].status==='rework-ready'],['new spare forecast',r.projectedRoles?.[2].status==='new-standby'],['actual state unchanged',r.roles[0].status==='used-standby'&&r.assemblyHandover?.actualCompletion===false],['night reserve one',r.assemblyHandover?.emergencyReserveCount===1&&!r.assemblyHandover?.nightWarning?.warningRequired],['receipt estimate held',held(rec({status:'forecast'}))],['future receipt held',held(rec({date:'2027-04-02'}))],['missing physical held',held(rec({present:false}))],['wrong target held',held(run({targetIdentity:'wrong'}))],['not workshop held',held(sl({workArea:'line'}))],['short slot held',held(sl({reservedHours:5}))],['no same-day completion held',held(run({sameDayCompletionPlanned:false}))],['unsafe held',held(run({safetyBlocked:true}))],['night unknown held',held(run({day:{...assembly.day,nightOperating:null}}))],['actual input unchanged',before===JSON.stringify(x)],['no authorization',!r.writeAllowed&&!r.operationAuthorized]],result:r};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./campaign-assembly-handover.cjs').previewCampaignAssembly,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
