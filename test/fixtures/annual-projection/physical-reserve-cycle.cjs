'use strict';
function selfTest(api){
 const d=i=>'2027-04-'+String(i).padStart(2,'0');
 const mk=(i,night=false,amount=0)=>({date:d(i),productionAmount:amount,nightProductionAmount:night?amount:0,shift1Team:'A',shift3Team:night?'B':'',size:'D10',operatingHours:amount?8:0});
 const days=Array.from({length:27},(_,i)=>mk(i+1));days[0]=mk(1,false,400);days[2]=mk(3,true);days[3]=mk(4,true);days[24]=mk(25,true);
 const stand='10',resources=[
 {id:'A',standKey:stand,frame:'online',chockInstalled:true,diameter:100,caliberId:'6',runs:7},
 {id:'B',standKey:stand,frame:'installedSpare',spareKind:'新品予備（組込完了）',chockInstalled:true,diameter:110,caliberId:'1',runs:0,spareCaliberIds:['2']},
 {id:'C',standKey:stand,frame:'usedSpare',spareKind:'新品予備（組替可能）',chockInstalled:false,diameter:105,caliberId:'1',runs:0,spareCaliberIds:['2']}
 ];
 const plan={standKey:stand,status:'forecast',basis:'anonymous',oldRollId:'A',counterpartId:'C',exchangeDate:d(3),assemblyDate:d(4),disassemblyDate:d(4),dispatchDate:d(5),inboundDate:d(25),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:['1','2'],assemblySlot:{owner:{standKey:stand,rollId:'C'},date:d(4),period:'day',requiredHours:4,reservedHours:4,people:3,prepared:'newSide',preparedTarget:'C',preparedOn:d(2)}};
 const input={standKey:stand,currentSize:'D10',maxRuns:8,resources,spareCaliberIds:[],reworkDays:20,adoptedCutMm:7,scrapDiameter:80,workConfirmation:{date:d(3),period:'day',reservedHours:7,requiredHours:6,people:3,workType:'rollChange',continuous:'no',changeover:'yes',threeSet:'yes'},days,physicalLifecycle:[plan],retainedOnExchange:true};
 const run=p=>api.simulateExchangeCycle({...input,...p});const before=JSON.stringify(input),r=run({});const event=(k,date)=>r.events.find(e=>e.kind===k&&e.date===date);const night=(date,x=r)=>x.nightReserveTimeline?.find(e=>e.date===date);
 const patch=p=>[ {...plan,...p} ];
 const rr=(i,p)=>resources.map((x,j)=>i===j?{...x,...p}:x);
 const noPlan=run({physicalLifecycle:[],days:days.slice(0,4)});
 const zero=run({resources:rr(1,{frame:'usedSpare',spareKind:'新品予備（組替可能）',chockInstalled:false}),physicalLifecycle:[],days:[mk(1,true)]});
 const unknown=run({physicalLifecycle:[],days:[mk(1,true)],resources:rr(1,{frame:'other',spareKind:'不明',chockInstalled:null})});
 return [
 ['physical mode',r.reserveMode==='physical-forecast'],
 ['exchange',!!event('ロール替',d(3))],
 ['old retained',night(d(3))?.normalSpare===0&&night(d(3))?.emergencySpare===1&&night(d(3))?.emergencyIds[0]==='A'],
 ['assembly transferred',night(d(4))?.normalSpare===1&&night(d(4))?.emergencyIds[0]==='C'],
 ['dispatch separate',!!event('搬出',d(5))],
 ['return on inbound',!!event('搬入',d(25))&&r.resources?.find(x=>x.id==='A').diameter===93],
 ['return is raw',r.resources?.find(x=>x.id==='A').chockInstalled===false&&r.resources.find(x=>x.id==='A').runs===0],
 ['no false night warning',!r.events.some(e=>e.kind==='夜勤予備不足')],
 ['no plan keeps old reserve',night(d(4),noPlan)?.emergencyIds[0]==='A'],
 ['no auto dispatch',!noPlan.events.some(e=>e.kind==='搬出')],
 ['real zero warning',zero.events.some(e=>e.kind==='夜勤予備不足')],
 ['unknown initial held',!!unknown.stopRecord],
 ['late chock removal held',!!run({physicalLifecycle:patch({disassemblyDate:d(3)})}).stopRecord],
 ['missing physical part held',!!run({physicalLifecycle:patch({counterpartPresent:false})}).stopRecord],
 ['unfinished assembly held',!!run({physicalLifecycle:patch({assemblyCompletedByDayEnd:false})}).stopRecord],
 ['short slot held',!!run({physicalLifecycle:patch({assemblySlot:{...plan.assemblySlot,reservedHours:1}})}).stopRecord],
 ['early return held',!!run({physicalLifecycle:patch({inboundDate:d(24)})}).stopRecord],
 ['bad stand held',!!run({physicalLifecycle:patch({standKey:'11'})}).stopRecord],
 ['missing date held',!!run({days:days.filter(x=>x.date!==d(2))}).stopRecord],
 ['missing night held',!!run({days:days.map((x,i)=>i===2?{...x,nightProductionAmount:null}:x)}).stopRecord],
 ['unsuitable old held',!!run({resources:rr(0,{emergencyUsable:false})}).stopRecord],
 ['missing retention held',!!run({retainedOnExchange:false}).stopRecord],
 ['wrong leaving identity held',!!run({physicalLifecycle:patch({oldRollId:'other'})}).stopRecord],
 ['size transition held',!!run({days:days.map((x,i)=>i===5?{...x,size:'D13'}:x)}).stopRecord],
 ['no actual mutation',r.statusChanged===false&&JSON.stringify(input)===before],
 ['forecast events only',r.events.every(e=>e.status==='forecast')]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
