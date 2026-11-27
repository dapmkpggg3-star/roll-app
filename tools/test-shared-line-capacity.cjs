'use strict';
function selfTest(preview,api){
 const v={snapshotId:'s',sourceRevision:'r',basis:'anonymous'},asOf='2027-04-01',day='2027-04-03',other='2027-04-04';
 const d=(id,stands,workType='rollChange',latestDate=day,latestMinute=1440,size='D10')=>({...v,id,stands,workType,size,requiredExchange:true,earliestDate:asOf,latestDate,latestMinute,deadlineBasis:'anonymous '+id});
 const e=(d,p={})=>({...v,demandId:d.id,deadlineBasis:d.deadlineBasis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true,...p});
 const row=(date,exchangeCapacity=3,reservedExchangeCount=0)=>({...v,date,recordKind:'plan',dateRowVerified:true,exchangeCapacity,reservedExchangeCount,capacityBasis:'anonymous'});
 const slot=(id,date,startMinute,endMinute,ds,p={})=>({...v,id,date,startMinute,endMinute,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,eligibility:ds.map(q=>e(q)),reserved:[],...p});
 const a=d('a',['2']),b=d('b',['12','13']),c=d('c',['17'],'caliberChange'),z=d('z',['12','13','14','15','16','17'],'sizeChange');
 const x={...v,anonymousOnly:true,asOf,demands:[a,b,c,z],days:[row(day,3)],slots:[slot('s1',day,0,1440,[a,b,c,z])]};
 const r=preview(x,api),run=p=>preview({...x,...p},api),before=JSON.stringify(x);
 const allGroups=[['2'],['3'],['4'],['5'],['6','7'],['8','9'],['10','11'],['12','13'],['14','15'],['16'],['17']];
 const all=allGroups.map((g,i)=>d('g'+i,g,'rollChange',new Date(Date.parse(day+'T00:00:00Z')+i*86400000).toISOString().slice(0,10)));
 const allPlan=run({demands:all,days:all.map(q=>row(q.latestDate,1)),slots:all.map(q=>slot(q.id,q.latestDate,480,1000,[q]))});
 const p=d('p',['6','7'],'caliberChange',day,1000),q=d('q',['8','9'],'caliberChange',day,1100);
 const narrow=run({demands:[q,p],days:[row(day,2)],slots:[slot('n',day,480,1050,[q,p])]});
 const single=p=>run({demands:[a],slots:[slot('a',day,480,1000,[a],p)]});
 const tests=[
 ['all eleven groups cover sixteen stands',allPlan.allocations.length===11&&new Set(allPlan.allocations.flatMap(a=>a.stands)).size===16],
 ['correct all roll times',allPlan.allocations.every(a=>a.minutes===([6,8,12,14].includes(+a.stands[0])?420:360))],
 ['shared capacity and size exemption',r.allocations.length===4&&r.dayUsage[0].plannedExchangeCount===3&&r.dayUsage[0].remaining===0&&r.allocations.find(a=>a.id==='z').countsAgainstExchangeCapacity===false],
 ['no overlap',r.allocations.every(a=>r.allocations.every(b=>a===b||a.endMinute<=b.startMinute||b.endMinute<=a.startMinute))],
 ['deadline first and unresolved retained',narrow.allocations[0]?.id==='p'&&narrow.unresolved[0]?.id==='q'&&narrow.unresolved[0].requiredExchange===true],
 ['missing capacity holds',run({days:[]}).allocations.length===0],
 ['zero capacity holds ordinary but not size',run({days:[row(day,0)]}).allocations.map(a=>a.id).join(',')==='z'],
 ['prior count reserved',run({days:[row(day,3,2)]}).dayUsage[0].plannedExchangeCount===1],
 ['manual time reserved',single({reserved:[{startMinute:480,endMinute:600,basis:'manual'}]}).allocations[0]?.startMinute===600],
 ['missing date row held',run({days:[{...row(day),dateRowVerified:false}]}).allocations.length===0],
 ['duplicate day held',run({days:[row(day),row(day)]}).allocations.length===0],
 ['overlapping slots held',run({slots:[...x.slots,slot('dup',day,480,1000,[a])]}).allocations.length===0],
 ['night-only held',single({nightOnlyStop:true}).allocations.length===0],
 ['upstream after day held',single({afterRegularDay:true}).allocations.length===0],
 ['downstream after day explicit',run({demands:[c],slots:[slot('c',day,1000,1100,[c],{afterRegularDay:true})]}).allocations.length===1],
 ['no stop evidence held',single({stopTimeVerified:false}).allocations.length===0],
 ['safety blocked held',single({eligibility:[e(a,{safetyBlocked:true})]}).allocations.length===0],
 ['stale evidence held',single({eligibility:[e(a,{sourceRevision:'old'})]}).allocations.length===0],
 ['reference people not mandatory',r.allocations.every(a=>a.referencePeople>0)],
 ['size already red pass included',run({demands:[z],slots:[slot('z',day,480,840,[z],{eligibility:[e(z,{redPassIncluded:true})]})]}).allocations[0]?.minutes===360],
 ['duplicate stand demands held',run({demands:[a,d('aa',['2'])]}).unresolved.length===2],
 ['invalid pair held',run({demands:[d('bad',['12'])]}).unresolved.length===1],
 ['D10 single caliber valid',(()=>{const w=d('w',['12'],'caliberChange');return run({demands:[w],slots:[slot('w',day,480,660,[w])]}).allocations[0]?.minutes===180})()],
 ['D13 single caliber invalid',run({demands:[d('w',['12'],'caliberChange',day,1000,'D13')]}).unresolved.length===1],
 ['date and team load spread',(()=>{const aa=d('aa',['2'],'rollChange',other),bb=d('bb',['3'],'rollChange',other);return run({demands:[aa,bb],days:[row(day),row(other)],slots:[slot('1',day,0,1000,[aa,bb]),slot('2',other,0,1000,[aa,bb])]}).allocations.map(x=>x.date).sort().join(',')===[day,other].join(',')})()],
 ['no writes or optimality assertion',!r.operationAuthorized&&!r.writeAllowed&&!r.annualComplete&&!r.globalOptimumProven],
 ['input unchanged',JSON.stringify(x)===before]];
 return {tests,result:r,allPlan};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);const {tests}=selfTest(require('./shared-line-capacity.cjs').previewSharedLineCapacity,ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
