'use strict';
const {forecastFirstPurchaseUse}=require('./successor-first-use.cjs');
function selfTest(api){
 const s={snapshotId:'anon',sourceRevision:'v1',throughDate:'2028-03-03',days:[{date:'2028-03-02',snapshotId:'anon',sourceRevision:'v1',dateRowVerified:true,recordKind:'plan',productionAmount:400}]};
 const old={stand:'8',rollId:'D',generation:'g2',status:'new-standby',purchaseSuccessor:true,chockAssembled:true,emergencyEligible:true,purchaseAssemblyDate:'2028-02-28',purchaseAdmissionDate:'2027-11-17'};
 const issue={stand:'8',rollId:'D',generation:'g1',identity:'["8","D","g1"]',exchangeDate:'2027-12-31',firstUseDate:'2028-01-01',plannedIssueMonth:'2028-01',actualIssueDate:null,actualIssue:false,accountingMonth:null,forecastOnly:true,basis:'anon first use'};
 const online={...old,status:'online'},seq={events:[{rollChanged:true,date:'2028-03-01',newGroup:{members:[{identity:'["8","D","g2"]'}]}}]},stage={roles:[{...old,purchaseFirstUse:issue}],handovers:[{stand:'8',targetIdentity:'["8","D","g2"]',date:'2028-02-28',actualCompletion:false}]};
 const before=JSON.stringify([s,stage,seq,online]),r=forecastFirstPurchaseUse(s,stage,seq,[online],api);
 const wrong=forecastFirstPurchaseUse(s,stage,seq,[{...online,purchaseFirstUse:{...issue,rollId:'X'}}],api);
 const conflict=forecastFirstPurchaseUse(s,stage,seq,[{...online,purchaseFirstUse:{...issue,firstUseDate:'2028-01-02'}}],api);
 const original={...old,generation:'g1',purchaseAssemblyDate:'2027-12-30'},first={...original,status:'online'},e={events:[{rollChanged:true,date:'2027-12-31',newGroup:{members:[{identity:issue.identity}]}}]},a={roles:[original],handovers:[{stand:'8',targetIdentity:issue.identity,date:'2027-12-30',actualCompletion:false}]},ss={...s,throughDate:'2028-01-01',days:[{...s.days[0],date:'2028-01-01'}]},f=forecastFirstPurchaseUse(ss,a,e,[first],api);
 return [
 ['physical roll history retained across g1 to g2',r.issues.length===0&&r.held.length===0&&r.roles[0].purchaseFirstUse.identity===issue.identity&&r.roles[0].generation==='g2'],
 ['conflicting history held',conflict.held.length===1&&conflict.issues.length===0],
 ['wrong physical identity held',wrong.held.length===1&&wrong.issues.length===0],
 ['genuine initial use issued once',f.issues.length===1&&f.issues[0].plannedIssueMonth==='2028-01'],
 ['same event replay no duplicate',forecastFirstPurchaseUse(ss,a,e,f.roles,api).issues.length===0],
 ['no mutation',JSON.stringify([s,stage,seq,online])===before],
 ['no actual write',!r.actualIssue&&!r.writeAllowed]
 ];
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const tests=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
