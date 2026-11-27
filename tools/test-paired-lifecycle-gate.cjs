'use strict';
function selfTest(preview,api){
 const snap={snapshotId:'s',sourceRevision:'r',basis:'anon'},asOf='2027-04-01',id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const member=(stand,mm=420,cut=7)=>{const roles=['online','new-standby','rework'].map((status,i)=>({...snap,stand,rollId:'roll'+stand+'-'+i,generation:'g1',status,chockAssembled:i!==2,emergencyEligible:i!==2,diameterMm:i===0?mm:420}));const old=roles[0];return {stand,roles,diameter:{...snap,stand,rollId:old.rollId,generation:old.generation,identity:id(old),status:'actual',measuredDate:asOf,currentMm:mm,limitMm:400,limitApproved:true,limitBasis:'anon limit'},diameterHistory:[1,2,3].map(i=>({...snap,stand,rollId:'hist'+stand,cycleId:'c'+i,status:'actual',kind:'rework',before:430,after:430-cut,inboundDate:'2027-03-01'})),deadline:{...snap,identity:id(old),required:true,date:stand===12?'2027-04-03':'2027-04-05',minute:1000}};};
 const fixture=(p=[12,13],size='D10',mm=405)=>{const members=[member(p[0],mm),member(p[1])],key='paired-'+p.join('-');return {...snap,anonymousOnly:true,asOf,stand:p[0],size,members,compatibility:{...snap,size,status:'compatible',lineFitConfirmed:true,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,id(m.roles[0])])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,id(m.roles[1])])),replacementDiameters:Object.fromEntries(members.map(m=>[m.stand,m.roles[1].diameterMm]))},slots:[{id:'stop',date:'2027-04-03',startMinute:480,endMinute:1000,team:'Ⅰ勤A',lineStopped:true,basis:'anon stop',eligibility:[{...snap,demandId:key,compatibilityBasis:'anon',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false}]}],exchangeCapacityByDate:{'2027-04-03':1}};};
 const x=fixture(),before=JSON.stringify(x),r=preview(x,api),run=p=>preview({...x,...p},api),mem=(i,p)=>x.members.map((m,j)=>i===j?{...m,...p}:m);
 const roles=(i,j,p)=>mem(i,{roles:x.members[i].roles.map((r,k)=>j===k?{...r,...p}:r)});
 const slot=p=>run({slots:[{...x.slots[0],...p}]});
 const tests=[
 ['D10 12/13 roll pair',r.status==='conditional-pair-exchange'&&r.pair.join(',')==='12,13'&&r.allocation.minutes===420],
 ['D13 same pair',preview(fixture([12,13],'D13'),api).allocation?.minutes===420],
 ['other pairs durations',[[6,7,420],[8,9,420],[10,11,360],[14,15,420]].every(([a,b,n])=>preview(fixture([a,b]),api).allocation?.minutes===n)],
 ['earliest deadline',r.earliestDeadline?.date==='2027-04-03'],
 ['one demand one allocation',r.allocation?.stands.length===2&&r.requiredExchange===true],
 ['individual final/rework',r.individual[0]?.disposition==='successor-needed'&&r.individual[1]?.disposition==='rework-candidate'&&r.futurePairReview],
 ['six rolls retained',r.projectedRoles?.length===6&&r.projectedRoles.filter(x=>x.status==='online').length===2&&r.projectedRoles.filter(x=>x.status==='used-standby').length===2],
 ['both reserves',r.emergencyReserveByStand?.['12']===1&&r.emergencyReserveByStand?.['13']===1],
 ['no crew fixed',r.allocation?.referencePeople===3],
 ['broken exception retains life',run({members:roles(0,0,{condition:'broken'})}).status==='individual-review'&&run({members:roles(0,0,{condition:'broken'})}).individual.length===2],
 ['incompatible review',run({compatibility:{...x.compatibility,status:'incompatible'}}).status==='individual-review'],
 ['missing line fit review',run({compatibility:{...x.compatibility,lineFitConfirmed:false}}).status==='individual-review'],
 ['wrong replacement diameter held',run({members:roles(0,1,{diameterMm:419})}).allocation===null],
 ['wrong snapshot held',run({members:roles(0,1,{snapshotId:'old'})}).allocation===null],
 ['no chock held',run({members:roles(1,1,{chockAssembled:false})}).allocation===null],
 ['raw contradiction held',run({members:roles(1,2,{chockAssembled:true})}).allocation===null],
 ['different cuts flag future',run({members:mem(1,{diameterHistory:member(13,420,5).diameterHistory})}).futurePairReview===true],
 ['one deadline sufficient',run({members:mem(1,{deadline:null})}).allocation?.minutes===420],
 ['no deadlines no schedule',run({members:x.members.map(m=>({...m,deadline:null}))}).allocation===null],
 ['short stop retains demand',slot({endMinute:890}).allocation===null&&slot({endMinute:890}).requiredExchange===true],
 ['unknown capacity retains demand',run({exchangeCapacityByDate:{}}).requiredExchange===true&&run({exchangeCapacityByDate:{}}).allocation===null],
 ['no line stop',slot({lineStopped:false}).allocation===null],
 ['stale slot evidence',slot({eligibility:x.slots[0].eligibility.map(e=>({...e,sourceRevision:'old'}))}).allocation===null],
 ['unknown life not false retirement',run({members:mem(0,{diameter:null})}).individual[0].disposition==='review'],
 ['no actual or writes',!r.operationAuthorized&&!r.writeAllowed&&!r.actualExchange&&!r.automaticPairRelease&&!r.annualComplete],
 ['input unchanged',JSON.stringify(x)===before]];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./paired-lifecycle-gate.cjs').previewPairedLifecycle,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
