'use strict';
function selfTest(api){
 const stand='2',d=i=>'2027-04-'+String(i).padStart(2,'0');
 const day=i=>({date:d(i),productionAmount:0,nightProductionAmount:0,shift1Team:'A',shift3Team:'B',size:'D10',operatingHours:0});
 const online={id:'A',standKey:stand,frame:'online',chockInstalled:true,diameter:450,caliberId:'1',runs:2};
 const used={id:'B',standKey:stand,frame:'usedSpare',spareKind:'中古予備（バラシ前）',chockInstalled:true,diameter:440,caliberId:'1',runs:15};
 const raw={id:'C',standKey:stand,frame:'other',ledgerStatus:'新品予備（組替可能）',chockInstalled:false,diameter:430,caliberId:'1',runs:0};
 const transit={...raw,ledgerStatus:'改削中',chockInstalled:null};
 const p={standKey:stand,status:'forecast',basis:'anonymous',oldRollId:'B',counterpartId:'C',exchangeDate:d(1),assemblyDate:d(5),disassemblyDate:d(5),dispatchDate:d(6),inboundDate:d(26),counterpartPresent:true,assemblyCompletedByDayEnd:true,returnCalibers:['1'],assemblySlot:{owner:{standKey:stand,rollId:'C'},date:d(5),period:'day',requiredHours:4,reservedHours:4,people:3,prepared:'reworkInbound',preparedTarget:'C',preparedOn:d(4)}};
 const receipt={standKey:stand,rollId:'C',dispatchDate:'2027-03-15',dispatchStatus:'actual',dispatchBasis:'anonymous dispatch'};
 const days=[2,3,4,5,6].map(day),resources=[online,used,transit];
 const input={standKey:stand,currentSize:'D10',maxRuns:35,resources,spareCaliberIds:[],reworkDays:20,adoptedCutMm:7,scrapDiameter:400,days,physicalLifecycle:[],openingHandover:p,openingReceipt:receipt,retainedOnExchange:true};
 const preview=x=>api.previewOpeningReceiptLink({standKey:stand,asOf:d(2),receipt,handover:p,resources,reworkDays:20,days,...x}),run=x=>api.simulateExchangeCycle({...input,...x});
 const r=run({}),ev=(r,k)=>r.events.some(e=>e.kind===k),a={standKey:stand,rollId:'C',status:'actual',basis:'anonymous signed receipt',date:d(1)};
 const ready=run({resources:[online,used,raw],openingReceipt:{...receipt,actualInbound:a}});
 const before=JSON.stringify(input);run({});
 return [
 ['20 calendar days',preview({}).expectedInboundDate===d(4)],
 ['conditional slot candidate',preview({}).assemblyCandidateDate===d(5)&&preview({}).status==='conditional'],
 ['no authority',preview({}).operationAuthorized===false&&!preview({}).arrivalConfirmed],
 ['receipt estimate event',ev(r,'搬入見込')&&!ev(r,'搬入')],
 ['candidate event',ev(r,'組替候補')],
 ['conditional stops assembly',!!r.stopRecord&&!ev(r,'組替完了')],
 ['old retained through candidate',r.resources.find(x=>x.id==='B').chockInstalled===true],
 ['estimated arrival not inventory',r.resources.find(x=>x.id==='C').ledgerStatus==='改削中'],
 ['no false dispatch',!ev(r,'搬出')],
 ['night warning on blocked candidate',ev(r,'夜勤予備未確認')],
 ['missing dispatch no estimate',preview({receipt:{...receipt,dispatchDate:null}}).expectedInboundDate===null],
 ['missing dispatch evidence held',preview({receipt:{...receipt,dispatchStatus:'forecast'}}).status==='unknown'],
 ['wrong receipt id held',preview({receipt:{...receipt,rollId:'Z'}}).status==='unknown'],
 ['early proposed arrival held',preview({receipt:{...receipt,expectedInboundDate:d(3),expectedBasis:'estimate'}}).status==='unknown'],
 ['same day conservative hold',preview({handover:{...p,assemblyDate:d(4)}}).status==='held'],
 ['later receipt moves candidate',preview({receipt:{...receipt,expectedInboundDate:d(5),expectedBasis:'later estimate'}}).status==='held'],
 ['overdue not actual',preview({asOf:d(5)}).status==='held'],
 ['insufficient assembly slot',preview({handover:{...p,assemblySlot:{...p.assemblySlot,reservedHours:1}}}).status==='held'],
 ['actual receipt inconsistent ledger held',preview({receipt:{...receipt,actualInbound:a}}).status==='unknown'],
 ['future confirmation held',preview({resources:[online,used,raw],receipt:{...receipt,actualInbound:{...a,date:d(4)}}}).status==='unknown'],
 ['actual date and raw ledger enable forecast',ready.receiptLink?.status==='ready-for-forecast'&&ev(ready,'組替完了')],
 ['actual receipt not new spare before assembly',ready.nightReserveTimeline?.find(e=>e.date===d(2))?.emergencyIds[0]==='B'],
 ['handover after assembly',ready.nightReserveTimeline?.find(e=>e.date===d(5))?.emergencyIds[0]==='C'],
 ['no input mutation',JSON.stringify(input)===before]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
