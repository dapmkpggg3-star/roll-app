'use strict';
function selfTest(api){
 const stand='2',d=i=>'2027-04-'+String(i).padStart(2,'0');
 const day=i=>({date:d(i),productionAmount:i===5?405:0,nightProductionAmount:0,shift1Team:i===5?'':'A',shift3Team:'B',size:'D10',operatingHours:i===5?8:0});
 const days=[2,3,4,5,6,7,8,9,10].map(day);
 const online={id:'A',standKey:stand,frame:'online',chockInstalled:true,diameter:450,caliberId:'1',runs:2};
 const used={id:'B',standKey:stand,frame:'usedSpare',spareKind:'中古予備（バラシ前）',chockInstalled:true,diameter:440,caliberId:'1',runs:15};
 const raw={id:'C',standKey:stand,frame:'other',ledgerStatus:'新品予備（組替可能）',chockInstalled:false,diameter:430,caliberId:'1',runs:0};
 const transit={...raw,ledgerStatus:'改削中',chockInstalled:null};
 const resources=[online,used,raw], receipt={standKey:stand,rollId:'C',dispatchDate:'2027-03-15',dispatchStatus:'actual',dispatchBasis:'anonymous',actualInbound:{standKey:stand,rollId:'C',status:'actual',basis:'anonymous receipt',date:d(1)}};
 const plan={standKey:stand,status:'forecast',basis:'anonymous',oldRollId:'B',counterpartId:'C',exchangeDate:d(1),dispatchDate:d(10),inboundDate:d(30),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:['1']};
 const slot=i=>({date:d(i),status:'forecast',basis:'anonymous work schedule',capacityConfirmed:true,capacityBasis:'anonymous crew allocation',owner:{standKey:stand,rollId:'C'},period:'day',requiredHours:4,reservedHours:4,people:3,availablePeople:3,startHour:8,endHour:12,prepared:'reworkInbound',preparedTarget:'C',preparedOn:d(1),workArea:'workshop',workshopWorking:true,workshopCalendarBasis:'anonymous workshop schedule',offlineIsolated:true,isolationBasis:'anonymous isolation',independentOfLineCrew:true,workshopStartHour:7.75,workshopEndHour:16.75});
 const s=slot(5),s2=slot(6),selection={slots:[s,s2],targetDeadline:d(7),deadlineBasis:'anonymous target'};
 const input={standKey:stand,asOf:d(2),resources,receipt,handover:plan,days,reworkDays:20,...selection};
 const select=x=>api.selectOpeningAssemblyCandidate({...input,...x});
 const cycle={standKey:stand,currentSize:'D10',maxRuns:35,resources,spareCaliberIds:[],reworkDays:20,adoptedCutMm:7,scrapDiameter:400,days,physicalLifecycle:[],openingHandover:plan,openingReceipt:receipt,openingAssemblySelection:selection,retainedOnExchange:true};
 const run=x=>api.simulateExchangeCycle({...cycle,...x});
 const r=run({}),before=JSON.stringify(cycle);
 const patch=x=>select({slots:[{...s,...x},s2]}).selectedDate===d(6);
 const legacy={...s};delete legacy.workArea;
 const result=[
 ['workshop during line production',select({}).selectedDate===d(5)],
 ['physical forecast uses workshop',r.assemblySelection?.selectedDate===d(5)&&r.events.some(e=>e.kind==='組替完了'&&e.date===d(5))],
 ['old reserve retained before work',r.nightReserveTimeline?.find(e=>e.date===d(4))?.emergencyIds[0]==='B'],
 ['new reserve after work',r.nightReserveTimeline?.find(e=>e.date===d(5))?.emergencyIds[0]==='C'],
 ['production unchanged',days[3].productionAmount===405],
 ['legacy line gate unchanged',!api.assemblySlotReady(legacy,day(5)).ok&&select({slots:[legacy,s2]}).selectedDate===d(6)],
 ['workshop holiday',patch({workshopWorking:false})],
 ['missing workshop calendar',patch({workshopCalendarBasis:''})],
 ['isolation not confirmed',patch({offlineIsolated:false})],
 ['isolation basis missing',patch({isolationBasis:''})],
 ['shared line crew unknown',patch({independentOfLineCrew:false})],
 ['capacity not confirmed',patch({capacityConfirmed:false})],
 ['not daytime',patch({period:'night'})],
 ['after workshop hours',patch({startHour:15,endHour:19})],
 ['outside daylight boundary',patch({workshopEndHour:23})],
 ['insufficient crew',patch({availablePeople:2})],
 ['insufficient time',patch({reservedHours:2})],
 ['unknown work area',patch({workArea:'other'})],
 ['unknown production held',select({days:days.map(x=>x.date===d(5)?{...x,productionAmount:null}:x)}).selectedDate===d(6)],
 ['unconfirmed receipt conditional',select({resources:[online,used,transit],receipt:{...receipt,actualInbound:null}}).status==='conditional'],
 ['no change of actual records',r.statusChanged===false&&JSON.stringify(cycle)===before],
 ['no operating permission',select({}).operationAuthorized===false]
 ];
 return result;
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
