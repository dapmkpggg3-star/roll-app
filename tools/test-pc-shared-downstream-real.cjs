'use strict';
// Anonymous first-stage integration of all six downstream stands, one stopped line.
const {fixture:baseFixture}=require('./test-pc-shared-single-real.cjs');
const {previewPcSharedCirculation}=require('./pc-shared-circulation.cjs');
function fixture(api){
 const x=baseFixture(api),v={snapshotId:x.snapshotId,sourceRevision:x.sourceRevision,basis:'anonymous'},copy=z=>JSON.parse(JSON.stringify(z)),id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]);
 const slot0=x.slots[0],s0=x.singleInputs[0],w0=x.workshopOptions[0],day0=x.workshopDays[0];
 x.groups=[];x.singleInputs=[];x.pairedInputs=[];x.slots=[];x.workshopOptions=[];x.workshopDays=[];
 x.days=x.days.map(d=>({...d,grade:'SD295',shiftEvidenceVerified:true}));
 const g=(number,column,size,centerMm)=>({number,column,size,centerMm,grades:['SD295'],basis:'anonymous',datumId:'common',positionVerified:true,positionBasis:'anonymous'});
 const p=(west,east)=>({west,east,size:'D10',grades:['SD295'],confirmed:true,basis:'anonymous'});
 const common=[g(1,'西','D10',100),g(2,'西','D10',120),g(3,'西','D13',130),g(4,'西','D13',140),g(5,'東','D10',400),g(6,'東','D10',420),g(7,'東','D13',430),g(8,'東','D13',440)];
 const dual=[g(1,'西','D10',100),g(2,'西','D10',170),g(3,'西','D13',130),g(4,'西','D13',140),g(5,'東','D10',400),g(6,'東','D10',470),g(7,'東','D13',430),g(8,'東','D13',440)];
 const layout12=[g(1,'西','D10',110),g(2,'西','D13',130),g(3,'西','D13',140),g(4,'東','D10',410),g(5,'東','D13',430),g(6,'東','D13',440)];
 const path={...v,anonymousOnly:true,size:'D10',grade:'SD295',onlineRows:[],masterRows:[],usageRows:[],selection:{12:[1],13:[1],14:[1],15:[1],16:[1,5],17:[1,5]},link1213Evidence:[],exchangeSelections:[]};
 const defs=[['12','13'],['14','15'],['16'],['17']],members={};
 for(let k=12;k<=17;k++){
  const stand=String(k),s=copy(s0),mm=k===12?405:420,roles=s.roles.map((r,i)=>({...r,stand,rollId:'R'+k+'-'+i,diameterMm:i===0?mm:420}));
  const [old,next,target]=roles;
  const d={...s.diameter,stand,rollId:old.rollId,identity:id(old),currentMm:mm};
  const diameterHistory=s.diameterHistory.map(h=>({...h,stand,rollId:k+'-'+h.rollId}));
  members[stand]={stand,roles,diameter:d,diameterHistory};
  const grooves=k===12?layout12:k>=16?dual:common,limit=api.monthlyUsageThreshold(stand,'D10').runs;
  for(const [i,r] of [old,next].entries()){
   const calibers=k===17&&i===1?[1,3,4,5,7,8].map((n,j)=>({...grooves[n-1],number:j+1})):copy(grooves);
   const pairs=k<16?[]:k===17&&i===1?[p(1,4)]:[p(1,5),p(2,6)];
   path.masterRows.push({...v,stand,rollId:r.rollId,generation:r.generation,totalCalibers:calibers.length,calibers,pairs,confirmed:true});
   path.usageRows.push(...calibers.map(c=>({...v,stand,rollId:r.rollId,generation:r.generation,number:c.number,runs:i===0&&c.size==='D10'?limit:0,available:true})));
  }
  path.onlineRows.push({...old});
  const date=['2027-04-06','2027-04-07','2027-04-08','2027-04-09','2027-04-12','2027-04-13'][k-12],day={...day0,date};
  const w=copy(w0),a=w.request;
  Object.assign(w,{stand,demandId:k<=13?'paired-12-13':k<=15?'paired-14-15':'g'+k});
  Object.assign(a,{stand,oldIdentity:id(old),targetIdentity:id(target),receipt:{...a.receipt,identity:id(target)},slot:{...a.slot,date,owner:{rollId:target.rollId,standKey:stand},preparedTarget:target.rollId},day,dispatchPlan:{...a.dispatchPlan,identity:id(old),date:'2027-04-15',cycleId:'cycle-'+k}});
  x.workshopOptions.push(w);x.workshopDays.push(day);
 }
 for(const i of [0,1]){
  const identity=(k,n)=>JSON.stringify([String(k),members[k].roles[i].rollId,'g1',n]);
  for(const [a,b] of [[1,[1,2]],[4,[5,6]]])path.link1213Evidence.push({...v,confirmed:true,size:'D10',grade:'SD295',fromIdentity:identity(12,a),toIdentities:b.map(n=>identity(13,n))});
 }
 let selection=copy(path.selection);
 for(const [i,stands] of defs.entries()){
  const did=stands.length===2?'paired-'+stands.join('-'):'g'+stands[0],mm=stands.length===2?420:360,date=x.days[i].date;
  const group={...v,id:did,stands,workType:'rollChange',size:'D10',standPass:'pass',members:stands.map(k=>({...v,standKey:k,rollId:members[k].roles[0].rollId,generation:'g1',usageBasis:'anonymous',remainingBasis:'anonymous all selected size exhausted',nextCaliberAvailable:false,columnBasis:'anonymous',activeCalibers:path.selection[k].map((n,j)=>({id:String(n),runs:api.monthlyUsageThreshold(k,'D10').runs,column:j===0?'西':'東'}))}))};
  x.groups.push(group);
  const d=api.deriveFirstMonthlyExchange({referenceDate:x.asOf,throughDate:x.throughDate,days:x.days,group}).demand;
  x.slots.push({...slot0,id:'stop-'+date,date,eligibility:[{...slot0.eligibility[0],demandId:did,deadlineBasis:d.deadlineBasis,compatibilityBasis:v.basis}]});
  const oldIdentities=Object.fromEntries(stands.map(k=>[k,id(members[k].roles[0])])),newIdentities=Object.fromEntries(stands.map(k=>[k,id(members[k].roles[1])]));
  if(stands.length===2)x.pairedInputs.push({...v,anonymousOnly:true,asOf:x.asOf,stand:stands[0],size:'D10',members:stands.map(k=>members[k]),compatibility:{...v,size:'D10',status:'compatible',lineFitConfirmed:true,oldIdentities,replacementIdentities:newIdentities,replacementDiameters:Object.fromEntries(stands.map(k=>[k,420]))},assemblies:[]});
  else{const k=stands[0];x.singleInputs.push({...v,...members[k],demandId:did,compatibility:{...v,size:'D10',status:'compatible',oldIdentity:oldIdentities[k],newIdentity:newIdentities[k],replacementDiameter:420}});}
  if(stands.includes('17'))selection={...selection,17:[1,4]};
  path.exchangeSelections.push({...v,demandId:did,date,startMinute:480,endMinute:480+mm,selection:copy(selection),oldIdentities,newIdentities});
 }
 path.stopBatches=[{...v,id:'continuous-stop',noProductionConfirmed:true,demandIds:x.groups.map(g=>g.id),fromDate:x.days[0].date,toDate:x.days[3].date}];
 x.pathline=path;return x;
}
function makeCases(api){
 const x=fixture(api),before=JSON.stringify(x),variant=fn=>{const z=JSON.parse(JSON.stringify(x));fn(z);return z;};
 return {x,before,cases:{normal:x,
 off:variant(z=>{const m=z.pathline.masterRows.find(m=>m.rollId==='R17-1');m.calibers.find(c=>c.number===4).centerMm+=41;}),
 edge:variant(z=>{const m=z.pathline.masterRows.find(m=>m.rollId==='R17-1');m.calibers.find(c=>c.number===4).centerMm+=40;}),
 missing:variant(z=>{z.pathline.masterRows=z.pathline.masterRows.filter(m=>m.rollId!=='R17-1');}),
 noBatch:variant(z=>delete z.pathline.stopBatches),
 noWork:variant(z=>{z.workshopOptions=z.workshopOptions.filter(w=>w.stand!=='17');})}};
}
function evaluate(x,before,results){
 const {normal:r,off,edge,missing,noBatch,noWork}=results;
 const e=r.first?.verifiedExchangeEvents||[],prod=e.find(q=>q.type==='downstream-production-preview'),disp=r.first?.dispositions||[];
 const month=(k,m)=>r.annual?.rows.find(q=>q.stand===k)?.months.find(q=>q.month===m)?.forecastRework;
 return {tests:[
 ['All four physical exchange groups validated after batch',r.first?.pathlineComplete&&e.filter(q=>q.pathlineVerifiedAfterBatch).length===4],
 ['All six workshop handovers and three roles each',r.first?.allocations.length===6&&['12','13','14','15','16','17'].every(k=>r.first.projectedRoles.filter(q=>q.stand===k).length===3)],
 ['One shift consumes eight grooves not two shifts',prod?.operatingRuns===1&&prod.consumption.length===8&&prod.consumption.every(q=>q.before===0&&q.after===1)],
 ['17 uses new six-groove master and east 4',prod?.selection['17'].join(',')==='1,4'&&prod.consumption.filter(q=>q.stand==='17').every(q=>q.rollId==='R17-1')],
 ['Final-use 12 generates purchase guidance not rework',disp.find(q=>q.stand==='12')?.kind==='successor-needed'&&!disp.find(q=>q.stand==='12').rework&&r.purchase.rows.some(q=>q.stand==='12')&&month('12','2027-05')===null],
 ['30-day and 60-day inbound entries separate', ['13','14','15'].every(k=>month(k,'2027-05')===1)&&['16','17'].every(k=>month(k,'2027-06')===1)],
 ['40 mm east-side inclusive',edge.first?.pathlineComplete===true],
 ['41 mm east-side fails and no downstream dispositions',off.first?.pathlineComplete===false&&off.first.dispositions.length===0],
 ['Missing new master blocks',missing.first?.pathlineComplete===false&&missing.first.dispositions.length===0],
 ['No unproved uninterrupted shutdown',noBatch.first?.pathlineComplete===false],
 ['No workshop retains old 17 emergency spare and no rework',noWork.first?.projectedRoles.some(q=>q.rollId==='R17-0'&&q.status==='used-standby'&&q.emergencyEligible)&&!noWork.first.dispositions.find(q=>q.stand==='17')?.rework],
 ['Not annual completion, no mutation or authority',!r.periodComplete&&!r.complete&&!r.writeAllowed&&!r.operationAuthorized&&JSON.stringify(x)===before]
 ],result:r,edge,off,noBatch};
}
function selfTest(api){
 const {x,before,cases}=makeCases(api);
 return evaluate(x,before,Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,previewPcSharedCirculation(v,api)])));
}
module.exports={selfTest,fixture,makeCases,evaluate};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [n,ok] of tests)console.log((ok?'PASS ':'FAIL ')+n);if(tests.some(x=>!x[1]))process.exitCode=1;}
