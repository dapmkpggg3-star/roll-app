'use strict';
function selfTest(api,output){
 const date=n=>'2027-04-'+String(n).padStart(2,'0');
 const days=Array.from({length:30},(_,i)=>{const n=i+1,t=n===2?0:405;return {date:date(n),size:t?'D13':'休止',productionAmount:t,productionByTeam:{A:t,B:0},shift1Team:'A',shift3Team:'',operatingHours:t?8:0,teamRest:{B:true},teamRestBasis:'anonymous roster'};});
 const member=(stand,runs,tons)=>({standKey:String(stand),rollId:'anon-'+stand,usageBasis:'anonymous usage',openingUsedTons:tons,nextCaliberAvailable:true,remainingBasis:'anonymous inventory',activeCalibers:[{id:'g-'+stand,runs}]});
 const groups=[{id:'R',stands:[4],members:[member(4,0,14595)],workType:'rollChange',size:'D13',basis:'anonymous roll demand',standPass:'pass'},{id:'C',stands:[17],members:[member(17,5,0)],workType:'caliberChange',size:'D13',basis:'anonymous caliber demand',standPass:'pass'}];
 const ev=id=>({demandId:id,basis:'anonymous eligibility',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false});
 const summary={...api.summarizeMonthlyProductionSchedule(days,date(1)),days,referenceDate:date(1)};
 const input={summary,referenceDate:date(1),throughDate:date(30),sourceKind:'plan',sourceBasis:'anonymous confirmed schedule',dateRowsVerified:true,sourceRevision:'source-1',previewRevision:'preview-1',groups,capacityRecords:[{date:date(2),count:2,kind:'exchange-capacity',confirmed:true,basis:'anonymous verified count'}],slots:[{id:'S',date:date(2),team:'常昼',startMinute:480,endMinute:960,lineStopped:true,basis:'anonymous stop',eligibility:['R','C'].map(ev)}],manualEntries:[{id:'M',date:date(2),team:'常昼',text:'既存手入力 <script>alert(1)</script>'}]};
 const before=JSON.stringify(input),out=api.previewImportedMonthlyExchangeSheet(input),sheet=out.sheet,cell=sheet.rows[1].teams.day;
 const base={period:{year:2027,month:4},sourceRevision:'source-1',previewRevision:'preview-1',schedule:days,manualEntries:input.manualEntries,plan:out.plan};
 const build=x=>output.buildMonthlyExchangePreview({...base,...x});
 const blocked=api.previewImportedMonthlyExchangeSheet({...input,capacityRecords:[]});
 const actual=api.previewImportedMonthlyExchangeSheet({...input,sourceKind:'actual'});
 const missing=build({schedule:days.slice(1)});
 const duplicate=build({schedule:[...days,days[1]]});
 const wrongTeam=build({plan:{...out.plan,allocations:out.plan.allocations.map(a=>({...a,team:'Ⅲ勤B'}))}});
 const overlap=build({plan:{...out.plan,allocations:out.plan.allocations.map(a=>({...a,startMinute:480,endMinute:480+a.minutes}))}});
 const absent=build({plan:{...out.plan,allocations:[]}});
 const exportData=output.buildExportPayload({schedule:days,planning:{}},{period:{year:2027,month:4},now:1,random:0});
 return [
 ['end-to-end first exchange to sheet',out.plan.allocations.length===2&&cell.proposals.length===2],
 ['30 calendar rows',sheet.rows.length===30&&sheet.rows[0].weekday==='木'],
 ['manual unchanged and separate',cell.manual[0].text===input.manualEntries[0].text&&cell.proposals.every(x=>x.reviewRequired)],
 ['manual conflict visible',sheet.issues.some(x=>x.kind==='manual-conflict')],
 ['roll red only',cell.proposals.find(x=>x.id==='R').style==='roll-red'&&cell.proposals.find(x=>x.id==='C').style==='normal'],
 ['normal shift and explicit rest',sheet.rows[0].teams.A.shift==='Ⅰ'&&sheet.rows[0].teams.A.operating===true&&sheet.rows[0].teams.B.rest===true],
 ['zero production not colored',sheet.rows[1].teams.A.operating===false],
 ['no assumed holiday',!build({schedule:days.map(({teamRest,...x})=>x)}).rows[0].teams.B.rest],
 ['manual script escaped',out.html.includes('&lt;script&gt;')&&!out.html.includes('<script>')],
 ['html roll span red',out.html.includes('class="roll-red">#4 ロール替')],
 ['html dates and manual',out.html.includes('手入力：既存手入力')&&out.html.includes('交換根拠')],
 ['evidence maintained',sheet.evidence.length===2&&sheet.evidence.every(x=>x.deadlineDate===date(3)&&x.slotBasis==='anonymous stop')],
 ['missing capacity shows demands',blocked.sheet.issues.filter(x=>x.kind==='exchange-unresolved').length===2&&blocked.sheet.rows[1].teams.day.proposals.length===0],
 ['blocked plan visible',actual.sheet.issues.some(x=>x.kind==='usage-unresolved')],
 ['missing date marked',missing.rows[0].sourceState==='unconfirmed'&&missing.issues.some(x=>x.date===date(1))],
 ['duplicate date blocks proposal',duplicate.rows[1].sourceState==='unconfirmed'&&duplicate.rows[1].teams.day.proposals.length===0],
 ['wrong shift held',wrongTeam.issues.some(x=>x.kind==='allocation')],
 ['overlap held',overlap.rows[1].teams.day.proposals.length===0],
 ['missing required allocation detected',absent.issues.some(x=>x.kind==='exchange-unresolved')],
 ['version must be distinct',build({previewRevision:'source-1'}).rows.length===0],
 ['existing export guard unchanged',exportData.suggestions.length===0],
 ['no writes or operating permission',!out.writeAllowed&&!sheet.writeAllowed&&!out.operationAuthorized&&!sheet.operationAuthorized],
 ['original input untouched',JSON.stringify(input)===before]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});for(const file of ['planning-sheet-output.js','operating-plan.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js',file),'utf8'),ctx);
 const tests=selfTest(ctx,ctx.RollPlanningSheetOutput);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
