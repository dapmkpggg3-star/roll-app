'use strict';
function selfTest(api){
 const e=api.monthlyExchangeEffort,p=api.previewDeadlineFirstExchangePlan;
 const d=(id,stands,workType='rollChange',x={})=>({id,stands,workType,size:'D10',earliestDate:'2027-04-01',latestDate:'2027-04-02',latestMinute:1000,deadlineBasis:'anonymous usage',...x});
 const evidence=id=>({demandId:id,basis:'anonymous readiness',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false});
 const s=(id,date,ids,x={})=>({id,date,team:'常昼',startMinute:480,endMinute:960,lineStopped:true,basis:'anonymous stop',eligibility:ids.map(evidence),...x});
 const q=d('A',[12,13]),b=d('B',[17],'caliberChange'),c=d('C',[16],'caliberChange');
 const late=s('L','2027-04-02',['A','B','C']),early=s('E','2027-04-01',['A','B','C']);
 const run=(demands,slots)=>p({demands,slots});
 const one=run([q],[late]),both=run([q,b],[late]),split=run([q,b],[early,late]);
 const altered=x=>run([q],[{...late,...x}]);
 const checks=[
 ['roll 2',e('rollChange',[2]).minutes===360],['roll 3',e('rollChange',[3]).minutes===360],['roll 4',e('rollChange',[4]).minutes===360],['roll 5',e('rollChange',[5]).minutes===360],
 ['roll 6/7',e('rollChange',[6,7]).minutes===420],['roll 8/9',e('rollChange',[8,9]).minutes===420],['roll 10/11',e('rollChange',[10,11]).minutes===360],
 ['roll 12/13 D10',e('rollChange',[12,13],'D10').minutes===420],['roll 12/13 D13',e('rollChange',[12,13],'D13').minutes===420],['roll 14/15',e('rollChange',[14,15]).minutes===420],
 ['roll 16 alone',e('rollChange',[16],'D10').minutes===360],['roll 17 alone',e('rollChange',[17],'D10').minutes===360],['reject wrong roll grouping',e('rollChange',[12],'D10')===null&&e('rollChange',[16,17],'D10')===null],
 ['caliber 6/7 and 8/9',e('caliberChange',[6,7]).minutes===360&&e('caliberChange',[8,9]).minutes===360],
 ['caliber 10/11 and 14/15',e('caliberChange',[10,11]).minutes===60&&e('caliberChange',[14,15]).referencePeople===2],
 ['D10 red pass shared',e('caliberChange',[12,13],'D10').minutes===240&&e('caliberChange',[12],'D10').minutes===180],
 ['D13 pair only',e('caliberChange',[12],'D13')===null&&e('caliberChange',[12,13],'D13').minutes===240],
 ['16/17 size specific',e('caliberChange',[16],'D10').minutes===90&&e('caliberChange',[16],'D13').minutes===45&&e('caliberChange',[17],'D10').minutes===30&&e('caliberChange',[17],'D13').referencePeople===1],
 ['size change elapsed',e('sizeChange',[12,13,14,15,16,17]).minutes===390],
 ['no headcount input',one.complete&&one.allocations[0].reportedPeople===null],
 ['different headcount is reference',run([{...q,people:1}],[late]).complete],
 ['same day load preserved',both.complete&&both.allocations.length===2&&both.warnings.some(w=>w.kind==='同日同班の負荷集中')],
 ['no overlap within slot',both.allocations[0].endMinute===both.allocations[1].startMinute],
 ['alternate day distributes load',split.complete&&new Set(split.allocations.map(a=>a.date)).size===2],
 ['too short',altered({endMinute:899}).unresolved.length===1],
 ['deadline minute',run([{...q,latestMinute:899}],[late]).unresolved.length===1],
 ['later slot no postponement',run([q],[s('X','2027-04-03',['A'])]).unresolved[0].requiredExchange],
 ['no slots retains demand',run([q],[]).unresolved.length===1],
 ['missing stop evidence',altered({lineStopped:undefined}).unresolved.length===1],
 ['reserve unknown',altered({eligibility:[{...evidence('A'),reserveReady:undefined}]}).unresolved.length===1],
 ['safety block',altered({eligibility:[{...evidence('A'),safetyBlocked:true}]}).unresolved.length===1],
 ['additional prep unknown',altered({eligibility:[{...evidence('A'),additionalReady:undefined}]}).unresolved.length===1],
 ['duplicate demand not dropped',run([q,q],[late]).unresolved.length===2],
 ['overlap slots not invented',run([q],[late,{...late,id:'L2'}]).unresolved.length===1],
 ['no capacity cannot erase third demand',run([q,b,c],[late]).unresolved.length===1],
 ['never authorize operations',!one.operationAuthorized&&!one.allocations[0].operationAuthorized],
 ['inputs unchanged',(()=>{const x={demands:[q,b],slots:[early,late]},before=JSON.stringify(x);p(x);return JSON.stringify(x)===before;})()]
 ];
 return checks;
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
