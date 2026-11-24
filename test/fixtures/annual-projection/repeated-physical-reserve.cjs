'use strict';
function selfTest(api){
 const date=i=>new Date(Date.UTC(2027,3,1+i)).toISOString().slice(0,10);
 const stand='10',R=(id,frame,diameter,kind,chock,caliberId,runs,spareCaliberIds)=>({id,standKey:stand,frame,diameter,spareKind:kind,chockInstalled:chock,caliberId,runs,spareCaliberIds});
 const resources=[R('A','online',120,null,true,'1',1,[]),R('B','installedSpare',125,'新品予備（組込完了）',true,'1',0,[]),R('C','usedSpare',130,'新品予備（組替可能）',false,'1',0,[])];
 const days=Array.from({length:83},(_,i)=>({date:date(i),size:'D10',productionAmount:[0,26,27,52,53].includes(i)?400:0,nightProductionAmount:0,shift1Team:'A',shift3Team:'B',operatingHours:8}));
 const slot=(i,id)=>({date:date(i),owner:{standKey:stand,rollId:id,size:'D10',referenceAt:date(0)},period:'day',reservedHours:7,requiredHours:6,people:3,workType:'rollChange',continuous:'no',changeover:'yes',threeSet:'yes'});
 const plan=(i,oldRollId,counterpartId)=>({standKey:stand,status:'forecast',basis:'anonymous',oldRollId,counterpartId,exchangeDate:date(i),assemblyDate:date(i+1),disassemblyDate:date(i+1),dispatchDate:date(i+2),inboundDate:date(i+22),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:['1'],assemblySlot:{owner:{standKey:stand,rollId:counterpartId},date:date(i+1),period:'day',requiredHours:4,reservedHours:4,people:3,prepared:'newSide',preparedTarget:counterpartId,preparedOn:date(i)}});
 const input={standKey:stand,currentSize:'D10',referenceAt:date(0),maxRuns:2,resources,spareCaliberIds:[],reworkDays:20,adoptedCutMm:7,scrapDiameter:80,workSlots:[slot(2,'A'),slot(28,'B'),slot(54,'C')],days,physicalLifecycle:[plan(2,'A','C'),plan(28,'B','A'),plan(54,'C','B')],retainedOnExchange:true};
 const original=JSON.stringify(input),run=p=>api.simulateExchangeCycle({...input,...p}),r=run({}),ev=(kind,x=r)=>x.events.filter(e=>e.kind===kind),night=(i,x=r)=>x.nightReserveTimeline?.find(e=>e.date===date(i));
 const zeroResources=resources.map(x=>x.id==='B'?{...x,frame:'usedSpare',spareKind:'新品予備（組替可能）',chockInstalled:false}:x);
 const zero=run({resources:zeroResources,physicalLifecycle:[],workSlots:[]});
 const missingSlot=run({workSlots:input.workSlots.slice(0,1)});
 const delayed=run({physicalLifecycle:input.physicalLifecycle.map((p,i)=>i===0?{...p,inboundDate:date(31)}:p)});
 const maxed=run({workSlots:[],physicalLifecycle:[],days:days.map((x,i)=>i===1?{...x,productionAmount:400}:x)});
 const invalid=run({physicalLifecycle:input.physicalLifecycle.map((p,i)=>i===1?{...p,assemblyCompletedByDayEnd:false}:p)});
 return [
 ['three exchanges',ev('ロール替').length===3],
 ['three assemblies',ev('組替完了').length===3],
 ['three dispatches',ev('搬出').length===3],
 ['three returns',ev('搬入').length===3],
 ['online sequence',ev('ロール替').map(e=>e.onlineId).join(',')==='B,C,A'],
 ['no fabricated fourth set',r.resources?.length===3&&new Set(r.resources.map(x=>x.id)).size===3],
 ['three diameters cut once',r.resources?.every(x=>x.diameter===resources.find(y=>y.id===x.id).diameter-7)],
 ['used reserve A B C',[[2,'A'],[28,'B'],[54,'C']].every(([i,id])=>night(i)?.emergencyIds[0]===id&&night(i)?.normalSpare===0)],
 ['new reserve C A B',[[3,'C'],[29,'A'],[55,'B']].every(([i,id])=>night(i)?.emergencyIds[0]===id&&night(i)?.normalSpare===1)],
 ['night on assembly-before-dispatch exact count',night(3)?.emergencySpare===1&&night(29)?.normalSpare===1],
 ['normal circulation no shortages',!r.stopRecord&&ev('夜勤予備不足').length===0],
 ['no actual mutation',JSON.stringify(input)===original&&r.statusChanged===false],
 ['real zero stops',zero.stopRecord?.date===date(0)&&ev('夜勤予備不足',zero).length===1],
 ['no later coverage after zero',zero.confirmedThrough===null&&zero.nightReserveTimeline.length===1],
 ['missing second slot stops',missingSlot.stopRecord?.date===date(28)&&ev('ロール替',missingSlot).length===1],
 ['delayed prior return blocks overlap',delayed.stopRecord?.date===date(28)&&ev('ロール替',delayed).length===1],
 ['above max stops',maxed.stopRecord?.date===date(1)],
 ['second assembly fails without third exchange',invalid.stopRecord?.date===date(29)&&ev('ロール替',invalid).length===2],
 ['forecast only',r.events.every(e=>e.status==='forecast')],
 ['no annual coverage claim',r.reason.includes('13か月全体の不足なしは判定できません')]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
