'use strict';
function selfTest(api){
 const date=i=>'2027-04-'+String(i).padStart(2,'0');
 const day=(i,night='',amount=0)=>({date:date(i),productionAmount:amount,nightProductionAmount:night?amount:0,shift1Team:night?'':'A',shift3Team:night,operatingHours:amount?8:0,size:'D10'});
 const days=Array.from({length:27},(_,i)=>day(i+1));
 days[0]=day(1,'B',400);days[25]=day(26,'B',400);
 const member=s=>({standKey:s,rollId:s+'A',caliberId:'6',runs:14,spareCaliberIds:[],basis:'anonymous',reworkDays:20,resources:[{id:s+'A',standKey:s,frame:'online',diameter:350,caliberId:'6',runs:14,spareCaliberIds:[]},{id:s+'B',standKey:s,frame:'installedSpare',diameter:365,caliberId:'1',runs:0,prepared:true,preparedOn:date(1),spareCaliberIds:['2','3','4','5','6']},{id:s+'C',standKey:s,frame:'usedSpare',diameter:345}]});
 const members=['6','7'].map(member);
 const work={stands:['6','7'],date:date(3),period:'day',reservedHours:7,requiredHours:6,people:3,workType:'rollChange',continuous:'no',changeover:'yes',threeSet:'yes'};
 const exchange=api.previewPairedRollExchange({standKey:'6',size:'D10',referenceAt:date(1),members,days,workConfirmation:work});
 const lifecycle=['6','7'].map(s=>({standKey:s,oldRollId:s+'A',counterpartId:s+'C',status:'forecast',basis:'anonymous projected evidence',assemblyDate:date(4),disassemblyDate:date(4),dispatchDate:date(5),inboundDate:date(25),counterpartReadyOn:date(3),counterpartCaliberId:'1',counterpartRuns:0,counterpartSpareCaliberIds:['2','3','4','5','6'],cutMm:7,scrapDiameter:320,returnCalibers:['1','2','3','4','5','6'],assemblySlot:{owner:{standKey:s,rollId:s+'C'},date:date(4),period:'day',requiredHours:4,reservedHours:4,people:3,prepared:'reworkInbound',preparedTarget:s+'C',preparedOn:date(3)}}));
 const input={exchange,members,lifecycle,days,through:date(27),size:'D10'};
 const run=p=>api.previewPairedReworkWindow({...input,...p});
 const l=(i,patch)=>lifecycle.map((v,j)=>i===j?{...v,...patch}:v);
 const d=(i,row)=>days.map((v,j)=>j===i-1?row:v);
 const initial=JSON.stringify(input),r=run({});
 const night=run({days:d(3,day(3,'B'))});
 return [
 ['pair old/new identity verified',exchange.status==='preview'],
 ['paired lifecycle accepted',r.status==='preview'&&r.events.length===6],
 ['dispatch date separate',r.events.filter(x=>x.kind==='dispatch').every(x=>x.date===date(5))],
 ['inbound date and cut',r.events.filter(x=>x.kind==='inbound').every(x=>x.date===date(25)&&x.diameter===343)],
 ['three sets and next online',r.nextMembers?.every(m=>m.resources.length===3&&m.rollId===m.standKey+'B'&&m.runs===1)],
 ['next installed counterpart',r.nextMembers?.every(m=>m.resources.find(x=>x.frame==='installedSpare').id===m.standKey+'C')],
 ['returned roll reset not installed',r.nextMembers?.every(m=>m.resources.find(x=>x.id===m.standKey+'A').frame==='usedSpare'&&m.resources.find(x=>x.id===m.standKey+'A').runs===0)],
 ['night without spare stops pair',night.status==='held'&&night.warnings.length===2&&night.events.length===0],
 ['no guessing unknown night',run({days:d(3,{...day(3),nightProductionAmount:null})}).status==='held'],
 ['no guessing missing date',run({days:days.filter(x=>x.date!==date(7))}).status==='held'],
 ['wrong counterpart rejected',run({lifecycle:l(1,{counterpartId:'7B'})}).status==='held'],
 ['same day disassembly required',run({lifecycle:l(0,{disassemblyDate:date(3)})}).status==='held'],
 ['lead counted after dispatch',run({lifecycle:l(0,{inboundDate:date(24)})}).status==='held'],
 ['future counterpart rejected',run({lifecycle:l(0,{counterpartReadyOn:date(5)})}).status==='held'],
 ['wrong owner rejected',run({lifecycle:l(0,{assemblySlot:{...lifecycle[0].assemblySlot,owner:{standKey:'7',rollId:'6C'}}})}).status==='held'],
 ['short assembly held',run({lifecycle:l(0,{assemblySlot:{...lifecycle[0].assemblySlot,reservedHours:1}})}).status==='held'],
 ['unsafe diameter held',run({lifecycle:l(0,{scrapDiameter:345})}).status==='held'],
 ['duplicate returned groove held',run({lifecycle:l(0,{returnCalibers:['1','1']})}).status==='held'],
 ['no actual promotion',r.events.every(x=>x.status==='forecast')&&run({lifecycle:l(0,{status:'actual'})}).status==='held'],
 ['next reference after through',r.nextReferenceAt===date(28)],
 ['input untouched',JSON.stringify(input)===initial],
 ['annual not complete',r.annualComplete===false]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
