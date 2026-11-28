'use strict';
// Focused purchased physical roll first-use + PC ledger integration, not a full circulation.
const {forecastFirstPurchaseUse}=require('./successor-first-use.cjs');
const {previewPcEventMonths}=require('./pc-event-month-ledger.cjs');
function selfTest(api){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'匿名'},id=(generation)=>JSON.stringify(['8','D',generation]);
 const s={...v,anonymousOnly:true,asOf:'2027-11-01',throughDate:'2028-03-03',startMonth:'2027-04',days:[{...v,date:'2028-01-01',dateRowVerified:true,recordKind:'plan',productionAmount:400},{...v,date:'2028-03-02',dateRowVerified:true,recordKind:'plan',productionAmount:400}]};
 const d={...v,stand:'8',rollId:'D',generation:'g1',status:'new-standby',purchaseSuccessor:true,purchaseOriginIdentity:id('g1'),chockAssembled:true,emergencyEligible:true,purchaseAssemblyDate:'2027-12-30',purchaseAdmissionDate:'2027-11-17'};
 const stage={roles:[d],handovers:[{stand:'8',targetIdentity:id('g1'),date:'2027-12-30',actualCompletion:false}]};
 const seq=(date,generation)=>({events:[{rollChanged:true,date,newGroup:{members:[{identity:id(generation)}]}}]});
 const first=forecastFirstPurchaseUse(s,stage,seq('2027-12-31','g1'),[{...d,status:'online'}],api);
 const firstIssue=first.issues[0],returned={...first.roles[0],generation:'g2',status:'new-standby',purchaseReworked:true};
 const reuseStage={roles:[returned],handovers:[{stand:'8',targetIdentity:id('g2'),date:'2028-02-28',actualCompletion:false}]},reuse=forecastFirstPurchaseUse(s,reuseStage,seq('2028-03-01','g2'),[{...returned,status:'online'}],api);
 const replay=forecastFirstPurchaseUse(s,stage,seq('2027-12-31','g1'),first.roles,api);
 const issueEvents=first.issues.concat(reuse.issues,replay.issues).map(u=>({...u,...v,kind:'first-use',status:'forecast',date:u.firstUseDate}));
 const rework={...v,stand:'8',rollId:'D',generation:'g1',kind:'rework-inbound',cycleId:'D-first',date:'2028-02-20',status:'forecast'};
 const ledger=events=>previewPcEventMonths({...s,events}),r=ledger([...issueEvents,rework]),withDuplicate=ledger([...issueEvents,rework,...issueEvents]),actual=previewPcEventMonths({...s,asOf:'2028-03-03',events:[...issueEvents,rework,{...issueEvents[0],date:'2028-01-02',status:'actual'},{...rework,date:'2028-03-01',status:'actual'}]});
 const get=(z,m)=>z.months.find(x=>x.month===m);
 const stripped={...returned};delete stripped.purchaseFirstUse;
 const lost=forecastFirstPurchaseUse(s,{...reuseStage,roles:[stripped]},seq('2028-03-01','g2'),[{...stripped,status:'online'}],api);
 return [
 ['First issue belongs to actual first planned production month',first.issues.length===1&&firstIssue.firstUseDate==='2028-01-01'&&firstIssue.actualIssue===false],
 ['Same physical roll reuse retains first-use generation',reuse.issues.length===0&&reuse.held.length===0&&reuse.roles[0].purchaseFirstUse.identity===id('g1')],
 ['Replaying first exchange does not emit again',replay.issues.length===0],
 ['PC ledger keeps one issue and distinct rework',r.entries.length===2&&get(r,'2028-01').forecastIssueKnown===1&&get(r,'2028-02').forecastReworkKnown===1&&get(r,'2028-03').forecastIssueKnown===null],
 ['Duplicate input issue does not double count',withDuplicate.entries.length===2&&get(withDuplicate,'2028-01').forecastIssueKnown===1],
 ['Confirmed actual supersedes moved forecasts without double counting',actual.entries.length===2&&get(actual,'2028-01').actualIssueKnown===1&&get(actual,'2028-01').forecastIssueKnown===null&&get(actual,'2028-02').forecastReworkKnown===null&&get(actual,'2028-03').actualReworkKnown===1],
 ['Lost history after regrind is held, not a new payout',lost.issues.length===0&&lost.held.length===1],
 ['Amounts remain unknown and no operation authorized',r.entries.every(e=>e.accountingAmount===null)&&!r.writeAllowed&&!r.operationAuthorized]
 ];
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const tests=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
