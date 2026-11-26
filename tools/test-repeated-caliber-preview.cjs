'use strict';
function selfTest(api,preview){
 const date=n=>'2027-04-'+String(n).padStart(2,'0');
 const row=(n,t,h=8)=>({date:date(n),size:'D13',steelGrade:'SD295',productionAmount:t,productionByTeam:{A:t,B:0},shift1Team:'A',shift3Team:'',operatingHours:t?h:0,recordKind:'plan',exchangeCapacity:t?null:1,exchangeCapacityBasis:t?null:'anonymous count'});
 const days=[row(1,405),row(2,0),row(3,405),row(4,405),row(5,0),row(6,405)];
 const g=(id,groove,runs,workType='caliberChange')=>({id,stands:[17],size:'D13',workType,standPass:'pass',basis:'anonymous limit',inventoryBasis:'anonymous ordered inventory',members:[{standKey:'17',rollId:'anonymous-roll',generation:'g1',usageBasis:'anonymous runs',remainingBasis:'anonymous remaining',nextCaliberAvailable:workType==='caliberChange',activeCalibers:[{id:groove,runs,available:true,steelGrade:'SD295',compatibilityBasis:'anonymous passline'}]}]});
 const stages=[g('A','a',5),g('B','b',4),g('C','c',0,'rollChange')];
 const slot=(n,id)=>({id:'s'+n,date:date(n),team:'常昼',startMinute:480,endMinute:960,lineStopped:true,basis:'anonymous stop',eligibility:[{demandId:id,basis:'anonymous confirmed eligibility',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false}]});
 const base={anonymousOnly:true,referenceDate:date(1),throughDate:date(6),sourceBasis:'anonymous schedule',dateRowsVerified:true,size:'D13',steelGrade:'SD295',days,stages,slots:[slot(2,'A'),slot(5,'B')]};
 const run=x=>preview({...base,...x},api);
 const r=run({}),before=JSON.stringify(base);
 const mutate=(i,fn)=>stages.map((g,j)=>j===i?fn(JSON.parse(JSON.stringify(g))):g);
 const f=(i,fn)=>mutate(i,g=>{fn(g.members[0]);return g});
 const tests=[
 ['two exchanges in same campaign',r.complete&&r.events.map(x=>x.date).join(',')===date(2)+','+date(5)],
 ['prior use not reset',r.events[1]?.fromCalibers[0].calibers[0].runs===6],
 ['next opening uses existing count',r.events[0]?.toCalibers[0].activeCalibers[0].runs===4],
 ['ending usage 1',r.endingUsage?.[0].calibers[0].runs===1],
 ['same physical roll',r.events.every(x=>x.toCalibers[0].rollId==='anonymous-roll')],
 ['no permission',!r.operationAuthorized&&!r.writeAllowed&&r.events.every(x=>!x.operationAuthorized&&x.conditional)],
 ['missing later slot holds second demand',(()=>{const v=run({slots:[base.slots[0]]});return v.events.length===1&&v.unresolved[0].requiredExchange===true;})()],
 ['first slot missing holds',run({slots:[]}).events.length===0],
 ['zero capacity not used',run({days:days.map(d=>d.date===date(2)?{...d,exchangeCapacity:0}:d)}).events.length===0],
 ['unknown capacity not used',run({days:days.map(d=>d.date===date(2)?{...d,exchangeCapacity:null}:d)}).events.length===0],
 ['missing next groove',run({stages:stages.slice(0,1)}).unresolved[0].requiredExchange===true],
 ['damaged groove unavailable',run({stages:f(1,m=>m.activeCalibers[0].available=false)}).events.length===0],
 ['wrong steel grade',run({stages:f(1,m=>m.activeCalibers[0].steelGrade='SD345')}).events.length===0],
 ['passline not evidenced',run({stages:f(1,m=>m.activeCalibers[0].compatibilityBasis='')}).events.length===0],
 ['no duplicate caliber use',run({stages:f(1,m=>m.activeCalibers[0].id='a')}).events.length===0],
 ['no generation reset',run({stages:f(1,m=>m.generation='g2')}).events.length===0],
 ['no implicit roll replacement',run({stages:f(1,m=>m.rollId='different')}).events.length===0],
 ['short shift held',run({days:[row(1,405,3),...days.slice(1)]}).events.length===0],
 ['missing day held',run({days:days.filter((_,i)=>i!==2)}).events.length===0],
 ['unknown production held',run({days:[{...days[0],productionAmount:null},...days.slice(1)]}).events.length===0],
 ['size switch held',run({days:[{...days[0],size:'D10'},...days.slice(1)]}).events.length===0],
 ['steel switch held',run({days:[{...days[0],steelGrade:'SD345'},...days.slice(1)]}).events.length===0],
 ['final caliber rolls demand stays unresolved',(()=>{const v=run({stages:[stages[0],g('B','b',5,'rollChange')]});return v.events.length===1&&v.unresolved[0].forecast.demand.workType==='rollChange';})()],
 ['input unchanged',JSON.stringify(base)===before],
 ['no nonanonymous input',run({anonymousOnly:false}).events.length===0],
 ['no actual schedule accepted',run({days:[{...days[0],recordKind:'actual'},...days.slice(1)]}).events.length===0]
 ];
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);
 const {tests}=selfTest(ctx,require('./repeated-caliber-preview.cjs').previewRepeatedCaliberCampaign);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
