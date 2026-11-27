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

 const plan={identity:idOf(roles[0]),snapshotId,sourceRevision,status:'planned',basis:'anonymous dispatch slot',date:'2027-04-05',dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true,cycleId:'cycle2',priorCycleIds:['cycle1'],nextExchangeTarget:'2027-06-03',nextExchangeBasis:'anonymous exchange target'};
 const x={...s,asOf:'2027-04-01',assembly,dispatchPlan:plan};
 const rev='r2',snap='s2',key=idOf(roles[0]),actualEvent=(type,date)=>({type,date,status:'actual',identity:key,cycleId:'cycle2',snapshotId:snap,sourceRevision:rev,basis:'anon actual evidence'});
 const newMaster={...old,generation:'g2',sourceRevision:rev,calibers:old.calibers.map(c=>({...c}))};
 const a2={asOf:'2027-07-03',snapshotId:snap,sourceRevision:rev,basis:'anon snapshot',assembly:{...actualEvent('assembly-complete','2027-04-02'),counterpartIdentity:idOf(roles[2]),oldDisassembled:true,newAssembled:true,dispatchReady:true},dispatch:actualEvent('dispatch','2027-04-06'),receipt:{...actualEvent('receipt','2027-07-02'),present:true,unassembled:true,usable:true,newGeneration:'g2'},currentRoles:[{...roles[0],generation:'g2',status:'unassembled-return',chockAssembled:false,snapshotId:snap,sourceRevision:rev}],masterRows:[newMaster],usageRows:newMaster.calibers.map(c=>({stand:17,rollId:'r17',generation:'g2',number:c.number,runs:0,available:true,basis:'anon',snapshotId:snap,sourceRevision:rev}))};
 const inp={originalPlan:x,actual:a2},before=JSON.stringify(inp),r=preview(inp,api),run=p=>preview({...inp,actual:{...a2,...p}},api),rec=p=>run({receipt:{...a2.receipt,...p}}),held=y=>y.status==='held';
 return {tests:[['actual receipt separate from original',r.status==='returned-unassembled'&&r.actualInboundDate==='2027-07-02'&&r.originalForecast.expectedInboundDate==='2027-06-04'],['revised estimate actual dispatch',r.revisedInboundEstimate==='2027-06-05'],['actual cost month July vs planned June',r.actualReworkCostMonth==='2027-07'&&r.originalForecast.plannedReworkCostMonth==='2027-06'],['unassembled not reserve',r.assemblyCandidate&&r.emergencyReserveAdded===0],['new generation zero checked',r.master?.generation==='g2'&&r.master.calibers.every(c=>c.runs===0)],['missing receipt overdue',run({receipt:null}).status==='awaiting-receipt'&&run({receipt:null}).receiptOverdue],['planned receipt held',held(rec({status:'planned'}))],['wrong cycle held',held(rec({cycleId:'cycle1'}))],['wrong roll held',held(rec({identity:'wrong'}))],['future receipt held',held(rec({date:'2027-07-04'}))],['no actual assembly held',held(run({assembly:null}))],['old generation held but actual retained',held(rec({newGeneration:'g1'}))&&rec({newGeneration:'g1'}).receiptConfirmed],['missing master held but actual retained',held(run({masterRows:[]}))&&run({masterRows:[]}).actualReworkCostMonth==='2027-07'],['unknown usage not zero',held(run({usageRows:[]}))],['nonzero new usage held',held(run({usageRows:a2.usageRows.map((u,i)=>i?u:{...u,runs:1})}))],['wrong ledger held',held(run({currentRoles:[{...a2.currentRoles[0],chockAssembled:true}]}))],['input unchanged',before===JSON.stringify(inp)],['no authorization',!r.operationAuthorized&&!r.writeAllowed]],result:r};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./rework-receipt-reconciliation.cjs').previewReworkReceipt,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
