'use strict';
const {deriveInitialDeadline}=require('./shared-workshop-handover.cjs');
function selfTest(){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'fixture'},id=r=>JSON.stringify([r.stand,r.rollId,r.generation]),roll=(stand,rollId,status)=>({stand,rollId,generation:'g1',status,chockAssembled:status==='online',emergencyEligible:status==='online'});
 const make=(k='8',life='rework-candidate')=>{
 const old=roll(k,'A','online'),next=roll(k,'B','new-standby'),target=roll(k,'C','unassembled-return');
 const d={k,old,next,target,a:{id:'g'+k,date:'2027-04-01'},single:{life:{status:life}}};
 const spec={...v,demandId:d.a.id,stand:k,oldIdentity:id(old),targetIdentity:id(target),inboundRequiredBy:'2027-05-10',nextExchangeDeadline:'2027-05-01',leadDays:20,leadBasis:'fixture',needBasis:'fixture',preDispatchDays:5,bufferBasis:'fixture'};
 const o={...v,request:{receipt:{...v,date:'2027-03-30'},slot:{date:'2027-04-05'},dispatchPlan:{...v,identity:id(old),status:'planned',date:'2027-04-20',dispatchCapacityConfirmed:true,vendorAcceptanceConfirmed:true}}};
 return {d,s:{...v,workshopDeadlineInputs:[spec]},o,spec};
 };
 const api={provisionalReworkCalendarDays:()=>20,addDays:(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)};
 const a=make(),b=make('9'),run=(x,opts=[x.o])=>deriveInitialDeadline(x.s,x.d,opts,api),r=run(a),r2=run(b),before=JSON.stringify(a);
 const late=make();late.o.request.dispatchPlan.date='2027-04-21';
 const bad=make();bad.spec.targetIdentity='wrong';
 const missing=make();delete missing.spec.bufferBasis;
 const retired=make('8','final-use');delete retired.o.request.dispatchPlan;
 const nul=make();nul.o.request.dispatchPlan.leadOverride=null;
 return [['reverse calculation',r.status==='conditional-deadline'&&r.dispatchDeadline==='2027-04-20'&&r.assemblyDeadline==='2027-04-15'],['same deadline other stand',r2.status==='conditional-deadline'&&r2.assemblyDeadline===r.assemblyDeadline],['no actual date or completion',r.workDate===null&&!r.actualCompletion],['late dispatch rejected',run(late).status==='held'],['identity mismatch rejected',run(bad).status==='held'],['missing buffer rejected',run(missing).status==='held'],['retirement no rework deadline',run(retired).status==='conditional-deadline'&&run(retired).dispatchDeadline===null],['null override rejected',run(nul).status==='held'],['input unchanged',JSON.stringify(a)===before]];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
