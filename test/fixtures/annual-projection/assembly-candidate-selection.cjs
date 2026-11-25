'use strict';
function selfTest(api){
 const stand='2',d=i=>'2027-04-'+String(i).padStart(2,'0');
 const day=i=>({date:d(i),productionAmount:0,nightProductionAmount:0,shift1Team:'A',shift3Team:'B',size:'D10',operatingHours:0});
 const online={id:'A',standKey:stand,frame:'online',chockInstalled:true,diameter:450,caliberId:'1',runs:2};
 const used={id:'B',standKey:stand,frame:'usedSpare',spareKind:'中古予備（バラシ前）',chockInstalled:true,diameter:440,caliberId:'1',runs:15};
 const raw={id:'C',standKey:stand,frame:'other',ledgerStatus:'新品予備（組替可能）',chockInstalled:false,diameter:430,caliberId:'1',runs:0};
 const transit={...raw,ledgerStatus:'改削中',chockInstalled:null};
 const resources=[online,used,transit];
 const plan={standKey:stand,status:'forecast',basis:'anonymous',oldRollId:'B',counterpartId:'C',exchangeDate:d(1),dispatchDate:d(10),inboundDate:d(30),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:['1']};
 const receipt={standKey:stand,rollId:'C',dispatchDate:'2027-03-15',dispatchStatus:'actual',dispatchBasis:'anonymous dispatch'};
 const slot=i=>({date:d(i),status:'forecast',basis:'anonymous work schedule',capacityConfirmed:true,capacityBasis:'anonymous crew allocation',owner:{standKey:stand,rollId:'C'},period:'day',requiredHours:4,reservedHours:4,people:3,availablePeople:3,startHour:8,endHour:12,prepared:'reworkInbound',preparedTarget:'C',preparedOn:d(1)});
 const days=[2,3,4,5,6,7,8,9,10].map(day);
 const slots=[slot(8),slot(4),slot(6),slot(5)], selection={slots,targetDeadline:d(7),deadlineBasis:'anonymous target'};
 const input={standKey:stand,asOf:d(2),resources,receipt,handover:plan,days,reworkDays:20,...selection};
 const select=x=>api.selectOpeningAssemblyCandidate({...input,...x});
 const cycle={standKey:stand,currentSize:'D10',maxRuns:35,resources,spareCaliberIds:[],reworkDays:20,adoptedCutMm:7,scrapDiameter:400,days,physicalLifecycle:[],openingHandover:plan,openingReceipt:receipt,openingAssemblySelection:selection,retainedOnExchange:true};
 const run=x=>api.simulateExchangeCycle({...cycle,...x});
 const r=run({}),ev=(r,k)=>r.events.some(e=>e.kind===k);
 const actual={standKey:stand,rollId:'C',status:'actual',basis:'anonymous receipt',date:d(1)};
 const ready=run({resources:[online,used,raw],openingReceipt:{...receipt,actualInbound:actual}});
 const late=run({openingAssemblySelection:{...selection,targetDeadline:d(4)}});
 const before=JSON.stringify(input);select({});
 return [
 ['earliest feasible sorted',select({}).selectedDate===d(5)&&select({}).alternatives.join(',')===[d(5),d(6),d(8)].join(',')],
 ['conditional only',select({}).status==='conditional'&&select({}).operationAuthorized===false],
 ['within explicit target',select({}).deadlineStatus==='within'],
 ['same day receipt excluded',select({slots:[slot(4)]}).status==='held'],
 ['later estimate shifts date',select({receipt:{...receipt,expectedInboundDate:d(6),expectedBasis:'anonymous delay'}}).selectedDate===d(8)],
 ['deadline late visible',select({targetDeadline:d(4)}).status==='late-review'],
 ['late not adopted',!!late.stopRecord&&!ev(late,'組替完了')&&late.resources[1].chockInstalled===true],
 ['unknown deadline explicit',select({targetDeadline:null}).deadlineStatus==='unknown'],
 ['invalid deadline held',select({targetDeadline:d(11)}).status==='held'],
 ['missing deadline basis held',select({deadlineBasis:''}).status==='held'],
 ['duplicate slot day not selected',select({slots:[slot(5),slot(5),slot(6)]}).selectedDate===d(6)],
 ['duplicate daily row not selected',select({days:[...days,day(5)]}).selectedDate===d(6)],
 ['no row not selected',select({days:days.filter(x=>x.date!==d(5))}).selectedDate===d(6)],
 ['capacity unconfirmed',select({slots:[{...slot(5),capacityConfirmed:false},slot(6)]}).selectedDate===d(6)],
 ['crew insufficient',select({slots:[{...slot(5),availablePeople:2},slot(6)]}).selectedDate===d(6)],
 ['time insufficient',select({slots:[{...slot(5),endHour:10},slot(6)]}).selectedDate===d(6)],
 ['night-only not selected',select({days:days.map(x=>x.date===d(5)?{...x,shift1Team:''}:x)}).selectedDate===d(6)],
 ['production day conservative hold',select({days:days.map(x=>x.date===d(5)?{...x,productionAmount:405}:x)}).selectedDate===d(6)],
 ['wrong owner rejected',select({slots:[{...slot(5),owner:{standKey:'3',rollId:'C'}},slot(6)]}).selectedDate===d(6)],
 ['dispatch date no timing excluded',select({slots:[slot(10)]}).status==='held'],
 ['missing dispatch date no selection',select({receipt:{...receipt,dispatchDate:null}}).selectedDate===null],
 ['no slots keeps old',run({openingAssemblySelection:{...selection,slots:[]}}).resources[1].chockInstalled===true],
 ['selected candidate integrated',r.assemblySelection?.selectedDate===d(5)&&ev(r,'組替候補')&&!ev(r,'組替完了')],
 ['actual receipt selects earlier valid slot',ready.assemblySelection?.selectedDate===d(4)&&ev(ready,'組替完了')],
 ['input unchanged',JSON.stringify(input)===before]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
