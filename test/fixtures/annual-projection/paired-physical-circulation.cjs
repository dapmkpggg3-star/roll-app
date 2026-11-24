'use strict';
function selfTest(api){
 const date=i=>new Date(Date.UTC(2027,3,1+i)).toISOString().slice(0,10);
 const days=Array.from({length:83},(_,i)=>{const producing=i===0||(i>=10&&i<=24)||(i>=36&&i<=50);return {date:date(i),size:'D10',productionAmount:producing?400:0,nightProductionAmount:producing?400:0,shift1Team:producing?'':'A',shift3Team:'B',operatingHours:producing?8:0}});
 const w=(i,id)=>({date:date(i),status:'forecast',basis:'anonymous joint crew',stands:['6','7'],onlineIds:{'6':'6'+id,'7':'7'+id},period:'day',requiredHours:6,reservedHours:6,people:3,startHour:8,endHour:14,workType:'rollChange',continuous:'no',changeover:'yes',threeSet:'yes'});
 const work=[w(2,'A'),w(28,'B'),w(54,'C')];
 const plan=(s,i,old,next)=>({standKey:s,status:'forecast',basis:'anonymous lifecycle',oldRollId:s+old,counterpartId:s+next,exchangeDate:date(i),assemblyDate:date(i+1),disassemblyDate:date(i+1),dispatchDate:date(i+2),inboundDate:date(i+22),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:['1'],assemblySlot:{owner:{standKey:s,rollId:s+next},date:date(i+1),period:'day',requiredHours:4,reservedHours:4,people:3,startHour:s==='6'?8:12,endHour:s==='6'?12:16,prepared:'newSide',preparedTarget:s+next,preparedOn:date(i)}});
 const member=s=>({standKey:s,basis:'anonymous',reworkDays:20,adoptedCutMm:7,scrapDiameter:300,retainedOnExchange:true,spareCaliberIds:[],resources:[{id:s+'A',standKey:s,frame:'online',chockInstalled:true,diameter:350,caliberId:'6',runs:14,spareCaliberIds:[]},{id:s+'B',standKey:s,frame:'installedSpare',spareKind:'新品予備（組込完了）',chockInstalled:true,diameter:360,caliberId:'1',runs:0,spareCaliberIds:[]},{id:s+'C',standKey:s,frame:'usedSpare',spareKind:'新品予備（組替可能）',chockInstalled:false,diameter:370,caliberId:'1',runs:0,spareCaliberIds:[]}],physicalLifecycle:[plan(s,2,'A','C'),plan(s,28,'B','A'),plan(s,54,'C','B')]});
 const members=['6','7'].map(member),capacity=[2,3,28,29,54,55].map(i=>({date:date(i),period:'day',status:'forecast',basis:'anonymous capacity',startHour:8,endHour:16,people:3}));
 const input={standKey:'6',size:'D10',referenceAt:date(0),members,days,jointWork:work,capacity};
 const before=JSON.stringify(input),run=p=>api.previewPairedPhysicalCycle({...input,...p}),r=run({});
 const m=(i,p)=>members.map((x,j)=>j===i?{...x,...p}:x);
 const l=(i,j,p)=>m(i,{physicalLifecycle:members[i].physicalLifecycle.map((x,k)=>k===j?{...x,...p}:x)});
 const slot=(i,j,p)=>l(i,j,{assemblySlot:{...members[i].physicalLifecycle[j].assemblySlot,...p}});
 const failed=run({members:l(1,1,{assemblyCompletedByDayEnd:false})});
 return [
 ['joint three exchanges',r.status==='preview'&&r.events.length===3],
 ['both sides aligned',r.events?.every(e=>e.members.length===2&&e.members.every(m=>m.date===e.date))],
 ['15-run rule',r.memberResults?.every(x=>x.result.events.filter(e=>e.kind==='操業'&&e.caliberRuns===15).length===3)],
 ['both three complete returns',r.memberResults?.every(x=>x.result.events.filter(e=>e.kind==='搬入').length===3)],
 ['six distinct IDs retained',r.nextMembers?.flatMap(x=>x.resources).length===6&&new Set(r.nextMembers.flatMap(x=>x.resources.map(y=>y.id))).size===6],
 ['paired setup prior operating night',r.events?.map(x=>x.setup.date).join(',')===[0,24,50].map(date).join(',')],
 ['reserve after first exchange',r.memberResults?.every(x=>x.result.nightReserveTimeline.find(y=>y.date===date(2)).emergencyIds[0]===x.stand+'A')],
 ['reserve after first assembly',r.memberResults?.every(x=>x.result.nightReserveTimeline.find(y=>y.date===date(3)).emergencyIds[0]===x.stand+'C')],
 ['serial shared crew passes',r.status==='preview'],
 ['overlapping assembly fails',run({members:slot(1,0,{startHour:10,endHour:14})}).status==='held'],
 ['parallel with sufficient people passes',run({members:slot(1,0,{startHour:10,endHour:14}),capacity:capacity.map(c=>c.date===date(3)?{...c,people:6}:c)}).status==='preview'],
 ['missing capacity held',run({capacity:capacity.slice(1)}).status==='held'],
 ['short joint roll slot held',run({jointWork:work.map((x,i)=>i===0?{...x,requiredHours:5}:x)}).status==='held'],
 ['wrong pair held',run({jointWork:work.map((x,i)=>i===0?{...x,stands:['6','8']}:x)}).status==='held'],
 ['one side failure atomic',failed.status==='held'&&failed.events.length===0&&failed.nextMembers===null],
 ['missing one side lifecycle held',run({members:m(1,{physicalLifecycle:members[1].physicalLifecycle.slice(1)})}).status==='held'],
 ['wrong old roll held',run({members:l(1,0,{oldRollId:'7C'})}).status==='held'],
 ['same id between stands held',run({members:m(1,{resources:members[1].resources.map((x,i)=>i===0?{...x,id:'6A'}:x)})}).status==='held'],
 ['unknown production held',run({days:days.map((x,i)=>i===0?{...x,nightProductionAmount:null}:x)}).status==='held'],
 ['missing date held',run({days:days.filter((x,i)=>i!==4)}).status==='held'],
 ['size change held',run({days:days.map((x,i)=>i===10?{...x,size:'D13'}:x)}).status==='held'],
 ['8/9 not assumed',run({standKey:'8'}).status==='held'],
 ['no actual mutation',before===JSON.stringify(input)],
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
