'use strict';
function selfTest(api){
 const d=n=>'2027-04-'+String(n).padStart(2,'0');
 const row=(n,tons,size='D13',hours=8)=>({date:d(n),size,productionAmount:tons,productionByTeam:{A:tons,B:0},shift1Team:'A',shift3Team:'',operatingHours:tons?hours:0,recordKind:'plan',exchangeCapacity:tons?null:2,exchangeCapacityBasis:tons?null:'anonymous count'});
 const days=[row(1,405),row(2,0),row(3,405)];
 const member=(stand,runs=5,tons=0,extra={})=>({standKey:String(stand),rollId:'anon-'+stand,usageBasis:'anonymous usage sheet',openingUsedTons:tons,nextCaliberAvailable:true,remainingBasis:'anonymous groove inventory',activeCalibers:[{id:'g-'+stand,runs}],...extra});
 const g=(id,stands,members,workType='caliberChange',size='D13')=>({id,stands,members,workType,size,basis:'anonymous group source',standPass:'pass'});
 const q=g('Q',[17],[member(17)]),v=g('V',[16],[member(16,13)]),roll=g('R',[4],[member(4,0,14595)],'rollChange');
 const evidence=id=>({demandId:id,basis:'anonymous eligibility',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false});
 const slot=(id,ids,startMinute=480,endMinute=960)=>({id,date:d(2),team:'常昼',startMinute,endMinute,lineStopped:true,basis:'anonymous stop evidence',eligibility:ids.map(evidence)});
 const base={referenceDate:d(1),throughDate:d(3),days,groups:[q],slots:[slot('S',['Q'])]};
 const plan=x=>api.previewUsageLinkedMonthlyPlan({...base,...x});
 const forecast=(group=q,over={})=>api.deriveFirstMonthlyExchange({...base,group,...over});
 const f=forecast(),p=plan({}),r=forecast(roll);
 const pair=g('P',[6,7],[member(6,14,5670),member(7,12,4860)]);
 const eight=g('E',[8,9],[member(8,0,4860),member(9,0,4000)]);
 const ten=g('T',[10,11],[member(10,7),member(11,5)]);
 const two=g('D',[16],[member(16,0,0,{columnBasis:'anonymous correspondence',activeCalibers:[{id:'west',column:'西',runs:12},{id:'east',column:'東',runs:8}]})],'caliberChange','D10');
 const ds10=days.map(x=>({...x,size:'D10'}));
 const capRecords=[{date:d(2),count:1,kind:'exchange-capacity',confirmed:true,basis:'anonymous separately verified count'}];
 const importedDays=days.map(({recordKind,exchangeCapacity,exchangeCapacityBasis,...rest})=>rest);
 const summary={...api.summarizeMonthlyProductionSchedule(importedDays,d(1)),days:importedDays,referenceDate:d(1)};
 const imported={...base,summary,sourceKind:'plan',sourceBasis:'anonymous confirmed schedule',dateRowsVerified:true,capacityRecords:capRecords};
 const from=x=>api.previewImportedMonthlyExchangePlan({...imported,...x});
 const check=[
 ['stand 2-5 current ton figures', [14000,12000,15000,12500].every((n,i)=>api.monthlyUsageThreshold(String(i+2),'D13').tons===n)],
 ['6/7 6075 and 15',api.monthlyUsageThreshold('6','D13').tons===6075&&api.monthlyUsageThreshold('7','D13').runs===15],
 ['8/9 5265 no assumed run limit',api.monthlyUsageThreshold('9','D13').tons===5265&&api.monthlyUsageThreshold('8','D13').runs===null],
 ['normal vs max remain distinct',api.monthlyUsageThreshold('13','D10').kind==='通常直数'&&api.monthlyUsageThreshold('13','D13').runs===12],
 ['first reach at end, next production deadline',f.status==='required'&&f.reached.date===d(1)&&f.demand.latestDate===d(3)&&f.demand.latestMinute===0],
 ['usage automatically connected to stop',p.complete&&p.allocations[0].date===d(2)&&p.allocations[0].minutes===45&&p.allocations[0].reportedPeople===null],
 ['ton exact threshold 15000',r.reached.triggers[0].value===15000&&r.demand.latestDate===d(3)],
 ['ton would exceed before that day',forecast(g('R',[4],[member(4,0,14800)],'rollChange')).demand.latestDate===d(1)],
 ['6/7 earliest member and two units independent',forecast(pair).reached.triggers.length===2&&forecast(pair).reached.triggers.some(t=>t.measure==='tons')&&forecast(pair).reached.triggers.some(t=>t.measure==='runs')],
 ['8/9 ton-based pair',forecast(eight).reached.triggers[0].limit===5265],
 ['10/11 8 runs',forecast(ten).reached.triggers[0].limit===8],
 ['D10 two columns count each once',forecast(two,{days:ds10}).usage[0].calibers.map(x=>x.runs).join(',')==='13,9'],
 ['D10 missing column held',forecast({...two,members:[member(16,12)]},{days:ds10}).status==='unresolved'],
 ['actual rows not plan',forecast(q,{days:[{...days[0],recordKind:'actual'},...days.slice(1)]}).status==='unresolved'],
 ['opening unknown not zero',forecast({...q,members:[member(17,undefined,0,{activeCalibers:[{id:'g',runs:null}]})]}).status==='unresolved'],
 ['missing ton not zero',forecast(q,{days:[{...days[0],productionAmount:null},...days.slice(1)]}).status==='unresolved'],
 ['short shift suggestion only',forecast(q,{days:[row(1,405,'D13',3),...days.slice(1)]}).reason.includes('提案')],
 ['under two not counted',forecast(q,{days:[row(1,10,'D13',1.5)],throughDate:d(1)}).usage[0].calibers[0].runs===5],
 ['two shifts with total hours held',forecast(q,{days:[{...days[0],shift3Team:'B'},...days.slice(1)]}).status==='unresolved'],
 ['size boundary held',forecast(q,{days:[{...days[0],size:'D10'},...days.slice(1)]}).status==='unresolved'],
 ['duplicate day held',forecast(q,{days:[days[0],days[1],days[2],days[2]]}).status==='unresolved'],
 ['gap held',forecast(q,{days:[days[0],days[2]]}).status==='unresolved'],
 ['unknown after reach preserves demand',forecast(q,{days:[days[0],{...days[1],productionAmount:null},days[2]]}).requiredExchange===true],
 ['end reach next operation unknown',forecast(q,{days:days.slice(0,2),throughDate:d(2)}).requiredExchange===true],
 ['already exceeded retained',forecast({...q,members:[member(17,7)]}).demand.latestDate===d(1)],
 ['no reach not due',forecast({...q,members:[member(17,0)]}).status==='not-due-in-window'],
 ['roll type not inferred from mismatched inventory',forecast({...q,workType:'rollChange'}).status==='unresolved'],
 ['day capacity zero retains required exchange',plan({days:[days[0],{...days[1],exchangeCapacity:0},days[2]]}).unresolved.length===1],
 ['unknown count retains demand',plan({days:[days[0],{...days[1],exchangeCapacity:null},days[2]]}).unresolved.length===1],
 ['two slots share date count',plan({groups:[q,v],days:[days[0],{...days[1],exchangeCapacity:1},days[2]],slots:[slot('S',['Q','V'],480,720),slot('T',['Q','V'],720,960)]}).unresolved.length===1],
 ['load concentration allowed',plan({groups:[q,v],slots:[slot('S',['Q','V'])]}).allocations.length===2],
 ['overlapping targets held',plan({groups:[q,{...q,id:'another'}]}).unresolvedUsage.length===2],
 ['stop with contradictory tons rejected',plan({days:[days[0],{...days[1],productionByTeam:{A:10,B:0}},days[2]]}).allocations.length===0],
 ['no eligibility no automatic proposal',plan({slots:[slot('S',[])]}).unresolved.length===1],
 ['imported actual parser shape connected',from({}).allocations[0]?.date===d(2)],
 ['imported date verification required',from({dateRowsVerified:false}).status==='source-unresolved'],
 ['imported source not marked as plan',from({sourceKind:'actual'}).status==='source-unresolved'],
 ['no capacity records not inferred',from({capacityRecords:[]}).unresolved.length===1],
 ['scheduled works are not free capacity',from({capacityRecords:[],summary:{...summary,days:importedDays.map(x=>({...x,requiredWorks:[{type:'caliberChange'}]}))}}).unresolved.length===1],
 ['missing source month held',from({summary:{...summary,referenceDate:'2027-05-01'}}).status==='source-unresolved'],
 ['no operating permission',!p.operationAuthorized&&!p.allocations[0].operationAuthorized],
 ['input unchanged',(()=>{const before=JSON.stringify(base);api.previewUsageLinkedMonthlyPlan(base);return JSON.stringify(base)===before;})()]
 ];
 return check;
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
