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

 const version=o=>({...o,snapshotId:snap,sourceRevision:rev});
 const b2=version({...roles[1],status:'online'}),c2=version({...roles[2],status:'new-standby'}),a3={...a2.currentRoles[0],emergencyEligible:false};
 const cMaster={...old,rollId:'third',generation:'g1',sourceRevision:rev};
 const laterMaster=[...x.masterRows.map(version),newMaster,cMaster];
 const laterUsage=[...x.usageRows.map(u=>version({...u,runs:u.rollId==='new17'?([1,5].includes(u.number)?5:6):u.rollId==='r17'?6:0})),...a2.usageRows,...cMaster.calibers.map(c=>version({stand:17,rollId:'third',generation:'g1',number:c.number,runs:0,available:true,basis:'anonymous'}))];
 const actual={...a2,currentRoles:[b2,c2,a3],masterRows:laterMaster,usageRows:laterUsage,onlineRows:x.onlineRows.map(o=>version(o.stand===17?{...o,rollId:b2.rollId,generation:b2.generation}:o))};
 const shift=Date.parse('2027-07-05T00:00:00+09:00')/60000-epoch;
 const move=(p,id)=>({...p,id,shiftId:p.type==='production'?id:undefined,start:p.start+shift,end:p.end+shift,date:'2027-07-05'});
 const periods=[move(first,'later-first'),move(stp,'later-stop'),move(second,'later-second'),move(third,'later-third')];
 const slot2={...slot,date:'2027-07-06',owner:{rollId:'r17',standKey:'17'},preparedTarget:'r17',preparedOn:'2027-07-02'};
 const assembly2=version({...assembly,oldIdentity:idOf(b2),targetIdentity:idOf(a3),slot:slot2,day:{...assembly.day,date:slot2.date},receipt:{...assembly.receipt,identity:idOf(a3),date:'2027-07-02'}});
 const next=version({...s,link1213Evidence:s.link1213Evidence.map(version),asOf:a2.asOf,periods,rollExchange:version({...exchange,oldIdentity:idOf(b2),newIdentity:idOf(c2),forPeriod:'later-second',stopId:'later-stop'}),assembly:assembly2});

 const dispatch={...plan,identity:idOf(b2),snapshotId:snap,sourceRevision:rev,date:'2027-07-09',cycleId:'cycle3',priorCycleIds:['cycle2'],nextExchangeTarget:'2027-09-10'};

 const diameter={stand:17,rollId:b2.rollId,generation:b2.generation,identity:idOf(b2),snapshotId:snap,sourceRevision:rev,status:'actual',measuredDate:'2027-04-01',currentMm:405,limitMm:400,limitApproved:true,basis:'anon measured',limitBasis:'anon approved planning limit'};
 const row=(cycleId,cut,status='actual')=>({stand:17,rollId:'hist',cycleId,status,kind:'rework',before:420,after:420-cut,basis:'anonymous history',sourceRevision:rev,inboundDate:'2027-03-01'});
 const hist=[row('c1',6),row('c2',7),row('c3',8),row('forecast',50,'planned'),{...row('future',90),inboundDate:'2028-01-01'}];
 const finalUseStart={identity:idOf(b2),snapshotId:snap,sourceRevision:rev,status:'actual',date:'2027-04-01',basis:'anonymous actual start'};

 const successor={stand:17,rollId:'successor17',generation:'new1',identity:JSON.stringify(['17','successor17','new1']),replacesIdentity:idOf(b2),snapshotId:snap,sourceRevision:rev,status:'actual',receiptDate:'2027-03-31',basis:'anon new receipt',present:true,unassembled:true,usable:true,neverUsed:true,chockAssembled:false};
 const inp={originalPlan:x,actual,next,nextDispatchPlan:dispatch,fiscalYear:2027,diameter,diameterHistory:hist,finalUseStart,successor},before=JSON.stringify(inp),r=preview(inp,api),run=q=>preview({...inp,...q},api),n=q=>run({successor:{...successor,...q}}),l={standKey:'17',months:4,status:'confirmed',basis:'anon LT',sourceRevision:rev};
 const pr=r.procurement,ad=r.successorAdmission;
 return {result:r,tests:[['default six',pr.leadMonths===6&&pr.leadStatus==='provisional'],['ideal strict prior',pr.idealArrivalBy==='2027-03-31'],['month clamp',pr.idealOrderBy==='2026-09-30'],['latest July5 minus6',pr.latestOrderBy==='2027-01-05'],['actual receipt separate',pr.actualReceiptDate==='2027-03-31'&&pr.idealReceiptMet&&pr.latestReceiptMet],['no order or accounting or issue',pr.actualOrderDate===null&&pr.accountingMonth===null&&pr.issueMonth===null],['override four',run({purchaseLead:l}).procurement.idealOrderBy==='2026-11-30'],['bad LT held',run({purchaseLead:{...l,months:0}}).procurement===null],['fractional LT held',run({purchaseLead:{...l,months:4.5}}).procurement===null],['wrong stand held',run({purchaseLead:{...l,standKey:'16'}}).procurement===null],['wrong revision held',run({purchaseLead:{...l,sourceRevision:'old'}}).procurement===null],['missing successor warning',run({successor:null}).procurement.orderWindow==='latest-order-guide-passed'],['planned receipt not actual',n({status:'planned'}).successorAdmission.status==='held'],['future receipt held',n({receiptDate:'2027-07-04'}).successorAdmission.status==='held'],['late ideal but timely latest',n({receiptDate:'2027-06-30'}).procurement.idealReceiptMet===false&&n({receiptDate:'2027-06-30'}).procurement.latestReceiptMet===true],['wrong replacement held',n({replacesIdentity:'bad'}).successorAdmission.status==='held'],['used not new',n({neverUsed:false}).successorAdmission.status==='held'],['duplicate roll held',n({rollId:b2.rollId,identity:idOf(b2)}).successorAdmission.status==='held'],['conditional admission July6',ad.status==='conditional-admission'&&ad.date==='2027-07-06'&&!ad.actualAdmission],['fixed three no old',ad.projectedRoles.length===3&&!ad.projectedRoles.some(x=>idOf(x)===idOf(b2))],['new raw not reserve',ad.projectedRoles.find(x=>x.rollId===successor.rollId).status==='new-unassembled'&&!ad.projectedRoles.find(x=>x.rollId===successor.rollId).emergencyEligible&&ad.emergencyReserveCount===1],['no issue before first use',ad.issueMonth===null&&!ad.firstUseConfirmed],['boundary held',run({diameter:{...diameter,currentMm:407}}).successorAdmission.status==='held'],['assembly held',run({next:{...next,assembly:{...assembly2,sameDayCompletionPlanned:false}}}).successorAdmission.status==='held'],['normal no demand',run({diameter:{...diameter,currentMm:420}}).procurement===null],['unknown start latest only',run({finalUseStart:null}).procurement.idealOrderBy===null],['input unchanged',before===JSON.stringify(inp)],['no write',!r.operationAuthorized&&!r.writeAllowed]]};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./annual-successor-procurement.cjs').previewSuccessorProcurement,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
