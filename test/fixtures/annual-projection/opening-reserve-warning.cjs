'use strict';
function selfTest(api){
 const stand='2',d=i=>'2027-04-'+String(i).padStart(2,'0');
 const day=(i,night=true)=>({date:d(i),productionAmount:0,nightProductionAmount:0,shift1Team:'A',shift3Team:night?'B':'',size:'D10',operatingHours:0});
 const online={id:'A',standKey:stand,frame:'online',chockInstalled:true,diameter:450,caliberId:'1',runs:2};
 const used={id:'B',standKey:stand,frame:'usedSpare',spareKind:'中古予備（バラシ前）',chockInstalled:true,diameter:440,caliberId:'1',runs:15};
 const raw={id:'C',standKey:stand,frame:'other',ledgerStatus:'新品予備（組替可能）',chockInstalled:false,diameter:430,caliberId:'1',runs:0};
 const transit={...raw,ledgerStatus:'改削中',chockInstalled:null};
 const dispatch={...used,frame:'other',spareKind:null,ledgerStatus:'改削行き（搬出可能）',chockInstalled:null};
 const resources=[online,used,raw];
 const p={standKey:stand,status:'forecast',basis:'anonymous dated work',oldRollId:'B',counterpartId:'C',exchangeDate:d(1),assemblyDate:d(3),disassemblyDate:d(3),dispatchDate:d(4),inboundDate:d(24),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:['1'],assemblySlot:{owner:{standKey:stand,rollId:'C'},date:d(3),period:'day',requiredHours:4,reservedHours:4,people:3,prepared:'newSide',preparedTarget:'C',preparedOn:d(2)}};
 const input={standKey:stand,currentSize:'D10',maxRuns:35,resources,spareCaliberIds:[],reworkDays:20,adoptedCutMm:7,scrapDiameter:400,days:[day(2),day(3),day(4)],physicalLifecycle:[],openingHandover:p,retainedOnExchange:true};
 const run=x=>api.simulateExchangeCycle({...input,...x}),r=run({}),night=(x,i)=>x.nightReserveTimeline?.find(e=>e.date===d(i)),event=(x,k)=>x.events.some(e=>e.kind===k);
 const absent=run({resources:[online,used,transit],openingHandover:{...p,counterpartPresent:false}});
 const unfinished=run({openingHandover:{...p,assemblyCompletedByDayEnd:false}});
 const zero=run({resources:[online,dispatch,raw],openingHandover:null,reserveEvidence:'ledger-only'});
 const projected=run({resources:[online,dispatch,raw],openingHandover:null});
 const keep=run({resources:[online,used,transit],openingHandover:null});
 const ledger=api.readLedgerResources([{id:'A',name:'#2-A',status:'オンライン'},{id:'B',name:'#2-B',status:'中古予備（バラシ前）'},{id:'C',name:'#2-C',status:'改削中'}]);
 const assess=resources=>api.assessEmergencyReserve({standKey:stand,resources});
 const before=JSON.stringify(input);run({});
 return [
 ['opening handover existing cycle',r.reserveMode==='physical-forecast'&&!r.stopRecord],
 ['used retained before assembly',night(r,2)?.emergencyIds[0]==='B'],
 ['same-day assembled reserve',night(r,3)?.emergencyIds[0]==='C'&&night(r,3)?.normalSpare===1],
 ['dispatch after assembly',event(r,'搬出')&&r.resources.find(x=>x.id==='B').frame==='rework'],
 ['missing returned counterpart held',!!absent.stopRecord&&absent.resources.find(x=>x.id==='B').chockInstalled===true],
 ['not assembled held',!!unfinished.stopRecord&&unfinished.resources.find(x=>x.id==='B').frame==='usedSpare'],
 ['missing completion warning',event(unfinished,'夜勤予備未確認')],
 ['known rework not spare',assess(ledger).emergencySpare===1],
 ['known dispatch not spare',assess([online,dispatch,raw]).emergencySpare===0],
 ['ledger zero confirmation warning',event(zero,'夜勤予備未確認')&&!event(zero,'夜勤予備不足')],
 ['ledger zero count retained',night(zero,2)?.warning.registeredOrProjectedCount===0&&night(zero,2)?.warning.fieldConfirmedCount===null],
 ['ledger zero stops further projection',!!zero.stopRecord],
 ['forecast zero warning',event(projected,'夜勤予備不足')],
 ['forecast not actual',night(projected,2)?.warning.operationAuthorized===false&&night(projected,2)?.warning.fieldConfirmedCount===null],
 ['no work plan retain old',night(keep,4)?.emergencyIds[0]==='B'&&!event(keep,'搬出')],
 ['no invented inbound',!event(keep,'搬入')],
 ['invalid opening previous date held',!!run({openingHandover:{...p,exchangeDate:d(2)}}).stopRecord],
 ['wrong counterpart held',!!run({openingHandover:{...p,counterpartId:'Z'}}).stopRecord],
 ['wrong old held',!!run({openingHandover:{...p,oldRollId:'A'}}).stopRecord],
 ['no night no warning',!event(run({resources:[online,dispatch,raw],openingHandover:null,days:[day(2,false)]}),'夜勤予備不足')],
 ['input unchanged',JSON.stringify(input)===before],
 ['inbound alone never spare',assess([online,dispatch,raw]).normalSpare===0],
 ['missing ledger status unknown',assess([online,dispatch,{...raw,ledgerStatus:null,chockInstalled:null}]).status==='unknown']
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
