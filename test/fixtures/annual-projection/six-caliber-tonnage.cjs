'use strict';
function selfTest(api){
 const date=i=>new Date(Date.UTC(2027,3,1+i)).toISOString().slice(0,10);
 const grooves=['1','2','3','4','5','6'],days=[],work=[],cap=[];
 // Six grooves per individual, two complete exchanges, 180 production shifts.
 for(let i=0;i<=220;i++){
   const producing=i<192&&i%16!==15;
   const tons=producing?(i%3===0?350:410):0;
   days.push({date:date(i),size:'D10',productionAmount:tons,nightProductionAmount:tons,shift1Team:producing?'':'A',shift3Team:'B',operatingHours:producing?8:0});
   if(i<192&&i%16===15){const roll=i===95||i===191,old=i<96?'A':'B';work.push({date:date(i),status:'forecast',basis:'anonymous',stands:['6','7'],onlineIds:{'6':'6'+old,'7':'7'+old},period:'day',requiredHours:roll?6:4,reservedHours:roll?6:4,people:3,startHour:8,endHour:roll?14:12,workType:roll?'rollChange':'caliberChange',continuous:'no',changeover:'yes',threeSet:'yes'});cap.push({date:date(i),period:'day',status:'forecast',basis:'anonymous',startHour:8,endHour:16,people:3});}
 }
 // Shift the second cycle by a day to leave an explicit day for first assembly.
 for(let i=96;i<=220;i++)days[i].date=date(i+1);
 for(const w of work)if(w.date>=date(96))w.date=date(Number((Date.parse(w.date)-Date.parse(date(0)))/86400000)+1);
 for(const c of cap)if(c.date>=date(96))c.date=date(Number((Date.parse(c.date)-Date.parse(date(0)))/86400000)+1);
 days.splice(96,0,{date:date(96),size:'D10',productionAmount:0,nightProductionAmount:0,shift1Team:'A',shift3Team:'B',operatingHours:0});
 for(const i of [96,193])cap.push({date:date(i),period:'day',status:'forecast',basis:'anonymous',startHour:8,endHour:16,people:3});
 const plan=(s,i,old,next)=>({standKey:s,status:'forecast',basis:'anonymous',oldRollId:s+old,counterpartId:s+next,exchangeDate:date(i),assemblyDate:date(i+1),disassemblyDate:date(i+1),dispatchDate:date(i+2),inboundDate:date(i+22),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:grooves.slice(),assemblySlot:{owner:{standKey:s,rollId:s+next},date:date(i+1),period:'day',requiredHours:4,reservedHours:4,people:3,startHour:s==='6'?8:12,endHour:s==='6'?12:16,prepared:'newSide',preparedTarget:s+next,preparedOn:date(i)}});
 const member=s=>({standKey:s,basis:'anonymous',reworkDays:20,adoptedCutMm:7,scrapDiameter:300,retainedOnExchange:true,spareCaliberIds:grooves.slice(1),resources:['A','B','C'].map((id,i)=>({id:s+id,standKey:s,frame:['online','installedSpare','usedSpare'][i],spareKind:[null,'新品予備（組込完了）','新品予備（組替可能）'][i],chockInstalled:i!==2,diameter:350+i*10,caliberId:'1',runs:0,spareCaliberIds:grooves.slice(1)})),physicalLifecycle:[plan(s,95,'A','C'),plan(s,192,'B','A')]});
 const members=['6','7'].map(member),input={standKey:'6',size:'D10',referenceAt:date(0),members,days,jointWork:work,capacity:cap,fullCaliberCycle:true};
 const before=JSON.stringify(input),run=p=>api.previewPairedPhysicalCycle({...input,...p}),r=run({});
 const m=(i,p)=>members.map((x,j)=>i===j?{...x,...p}:x);
 const rr=(i,j,p)=>m(i,{resources:members[i].resources.map((x,k)=>j===k?{...x,...p}:x)});
 const expectedTons=days.reduce((a,d)=>a+d.productionAmount,0);
 return [
 ['full cycle preview',r.status==='preview'],
 ['10 paired caliber changes',r.events?.filter(e=>e.kind==='カリバ替').length===10],
 ['two paired roll changes',r.events?.filter(e=>e.kind==='ロール替').length===2],
 ['full 90 shifts per roll',r.usage?.every(s=>s.cycles.length===2&&s.cycles.every(c=>c.projectedRuns===90))],
 ['six grooves 15 each',r.usage?.every(s=>s.cycles.every(c=>c.calibers.length===6&&c.calibers.every(g=>g.projectedRuns===15&&g.lastRuns===15)))],
 ['separate ton totals',r.usage?.every(s=>s.cycles.reduce((a,c)=>a+c.projectedTons,0)===expectedTons)],
 ['no 400t conversion',r.usage?.every(s=>s.cycles.every(c=>c.projectedTons!==c.projectedRuns*400))],
 ['each groove tons reconcile',r.usage?.every(s=>s.cycles.every(c=>c.calibers.reduce((a,g)=>a+g.projectedTons,0)===c.projectedTons))],
 ['historical basis not limit',r.usage?.every(s=>s.tonBasis.tons===null&&s.tonThresholdApplied===false&&s.totalLifetimeTons===null)],
 ['two returns per stand',r.memberResults?.every(x=>x.result.events.filter(e=>e.kind==='搬入').length===2)],
 ['final online resources correct',r.nextMembers?.every(m=>m.resources.find(x=>x.frame==='online').id===m.standKey+'C'&&m.resources.find(x=>x.frame==='online').runs===0)],
 ['duplicate groove rejected',run({members:rr(1,1,{spareCaliberIds:['2','2','4','5','6']})}).status==='held'],
 ['missing groove rejected',run({members:rr(0,2,{spareCaliberIds:['2','3']})}).status==='held'],
 ['partial opening deferred',run({members:rr(0,0,{runs:3})}).status==='held'],
 ['wrong initial order rejected',run({members:m(1,{spareCaliberIds:['3','2','4','5','6']})}).status==='held'],
 ['unknown return grooves rejected',run({members:m(0,{physicalLifecycle:members[0].physicalLifecycle.map((p,i)=>i===0?{...p,returnCalibers:['1']}:p)})}).status==='held'],
 ['input unchanged',JSON.stringify(input)===before],
 ['not annual complete',r.annualComplete===false]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
