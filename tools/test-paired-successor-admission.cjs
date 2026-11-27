'use strict';
const {selfTest:priorTest}=require('./test-paired-assembly-disposition.cjs');
function selfTest(preview,previous,api){
 let fixture;priorTest((x,a)=>{if(!fixture)fixture=x;return previous(x,a)},api);
 const s=fixture,id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]),k='12',old=s.members[0].roles[0],online=s.members[0].roles[1],spare=s.members[0].roles[2];
 const n={stand:k,rollId:'successor-12',generation:'new1',snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anon receipt',replacesIdentity:id(old),status:'actual',receiptDate:'2027-03-31',present:true,unassembled:true,usable:true,neverUsed:true,chockAssembled:false};
 n.identity=id(n);n.finalUseStart={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anon start',identity:id(old),status:'actual',date:s.asOf};
 const x={...s,successors:[n]},before=JSON.stringify(x),r=preview(x,api);
 const version={snapshotId:'later',sourceRevision:'later-r',basis:'anon later'},pair={pair:['12','13'],pairCompatibilityConfirmed:true,compatibilityBasis:'anon pair evidence'};
 const e=(date,fields)=>({...version,status:'actual',date,...fields});
 const rs=[{...n,status:'online',chockAssembled:true,emergencyEligible:true},{...spare,status:'used-standby',chockAssembled:true,emergencyEligible:true},{...online,status:'rework',chockAssembled:false,emergencyEligible:false},...r.projectedRoles.filter(q=>String(q.stand)==='13')].map(q=>({...q,...version}));
 const mate=rs.find(q=>String(q.stand)==='13'&&q.status==='online');
 const mateOpening=id(mate),mateIntermediate=id(s.members[1].roles[2]);
 mate.generation='g2'; // same physical roll may return only as a new generation; later snapshot is synthetic.

 const calibers=[{number:1,size:'D10',column:'西'},{number:2,size:'D13',column:'西'},{number:3,size:'D10',column:'東'},{number:4,size:'D13',column:'東'}].map(q=>({...q,grades:['SD295'],basis:'anon layout'}));
 const v={...version,anonymousOnly:true,asOf:'2027-08-05',admission:e('2027-04-06',{retiredIdentity:id(old),successorIdentity:n.identity,onlineIdentity:id(online),spareIdentity:id(spare),oldRetired:true,spareAssembled:true,successorAdmitted:true}),intermediateExchange:e('2027-06-01',{...pair,mateOldIdentity:mateOpening,mateNewIdentity:mateIntermediate,oldIdentity:id(online),newIdentity:id(spare),oldEmergencyUsable:true}),assembly:e('2027-06-02',{oldIdentity:id(online),targetIdentity:n.identity,sameDayHandover:true,newAssembled:true,emergencyUsable:true,neverUsed:true}),firstRolling:e('2027-08-01',{...pair,mateOldIdentity:mateIntermediate,oldIdentity:id(spare),newIdentity:n.identity,mateIdentity:id(mate),exchangeCompleted:true,actualRolling:true,firstEverUse:true,productionMinutes:240,size:'D10',grade:'SD295',periodId:'shift-1',lineFitConfirmed:true,lineFitBasis:'anon line fit',selectedNumbers:[1]}),currentRoles:rs,masterRows:[{...version,stand:k,rollId:n.rollId,generation:n.generation,confirmed:true,totalCalibers:4,calibers}],usageRows:calibers.map(c=>({...version,stand:k,rollId:n.rollId,generation:n.generation,number:c.number,runs:c.number===1?1:0,available:true})),issueHistory:{completeBefore:'2027-08-01',sourceRevision:version.sourceRevision,basis:'anon complete',entries:[]}};
 const run=(p={})=>preview({...x,successors:[{...n,...p}]},api),later=(p={})=>run({firstUseEvidence:{...v,...p}});
 const z=later(),tests=[
 ['conditional admission',r.admissions[0]?.status==='conditional-admission'],
 ['fixed six, three each',r.projectedRoles.length===6&&r.pair.every(k=>r.projectedRoles.filter(q=>String(q.stand)===k).length===3)],
 ['new not emergency reserve',r.projectedRoles.find(q=>id(q)===n.identity)?.emergencyEligible===false],
 ['old only removed in forecast',!r.actualAdmission&&!r.actualRetired&&!r.projectedRoles.some(q=>id(q)===id(old))],
 ['other stand preserved',r.projectedRoles.filter(q=>String(q.stand)==='13').every(q=>q.rollId.startsWith('anon-13'))],
 ['ideal and latest distinct',r.admissions[0].procurement.idealArrivalBy==='2027-03-31'&&r.admissions[0].procurement.idealOrderBy==='2026-09-30'&&r.admissions[0].procurement.latestOrderBy==='2026-10-05'],
 ['receipt not issue',r.issueEntries.length===0],
 ['missing receipt held',run({present:false}).admissions[0].status==='held'],
 ['wrong predecessor held',run({replacesIdentity:'bad'}).admissions[0].status==='held'],
 ['used successor held',run({neverUsed:false}).admissions[0].status==='held'],
 ['duplicate physical ID held',run({rollId:online.rollId,identity:id({...n,rollId:online.rollId})}).admissions[0].status==='held'],
 ['no handover retains old',preview({...x,assemblies:[]},api).admissions[0].status==='held'],
 ['missing ideal date does not invent',run({finalUseStart:null}).admissions[0].procurement.idealArrivalBy===null],
 ['actual evidence first-use August',z.issueEntries[0]?.month==='2027-08'&&z.issueEntries[0].status==='actual-evidence'],
 ['not forecast or write',z.admissions[0].firstUse?.forecastCalculated===false&&!z.operationAuthorized&&!z.writeAllowed],
 ['missing intermediate held',later({intermediateExchange:null}).issueEntries.length===0],
 ['missing assembly held',later({assembly:null}).issueEntries.length===0],
 ['not rolling held',later({firstRolling:{...v.firstRolling,actualRolling:false}}).issueEntries.length===0],
 ['pair mismatch held',later({firstRolling:{...v.firstRolling,mateIdentity:'wrong'}}).issueEntries.length===0],
 ['mate intermediate chain held',later({intermediateExchange:{...v.intermediateExchange,mateNewIdentity:mateOpening}}).issueEntries.length===0],
 ['line evidence absent held',later({firstRolling:{...v.firstRolling,lineFitConfirmed:false}}).issueEntries.length===0],
 ['master absent held',later({masterRows:[]}).issueEntries.length===0],
 ['wrong caliber held',later({firstRolling:{...v.firstRolling,selectedNumbers:[2]}}).issueEntries.length===0],
 ['prior physical issue any generation held',later({issueHistory:{...v.issueHistory,entries:[{stand:k,rollId:n.rollId,generation:'different',date:'2027-07-01',status:'actual',basis:'anon'}]}}).issueEntries.length===0],
 ['unknown history held',later({issueHistory:null}).issueEntries.length===0],
 ['inputs unchanged',JSON.stringify(x)===before]];
 return {tests,result:z};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./paired-successor-admission.cjs').previewPairedSuccessorAdmission,require('./paired-assembly-disposition.cjs').previewPairedAssemblyDisposition,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
