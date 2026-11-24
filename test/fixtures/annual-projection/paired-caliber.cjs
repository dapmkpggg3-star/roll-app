'use strict';
function selfTest(api) {
 const day=(date,productionAmount,operatingHours,shift1Team='A',shift3Team='')=>({date,productionAmount,operatingHours,shift1Team,shift3Team,size:'D10'});
 const input={standKey:'6',size:'D10',members:[{standKey:'6',rollId:'anon-6-A',caliberId:'6-1',runs:14,spareCaliberIds:['6-2','6-3'],basis:'anonymous opening'},{standKey:'7',rollId:'anon-7-A',caliberId:'7-1',runs:14,spareCaliberIds:['7-2','7-3'],basis:'anonymous opening'}],days:[day('2027-04-01',10,8),day('2027-04-02',0,0)],workConfirmation:{stands:['6','7'],date:'2027-04-02',period:'day',reservedHours:4,workType:'caliberChange',requiredHours:4,people:3,continuous:'no',changeover:'yes',threeSet:'yes'}};
 const run=p=>api.previewPairedCaliberExchange({...input,...p});
 const before=JSON.stringify(input),r=run({});
 const m=(i,patch)=>input.members.map((v,j)=>j===i?{...v,...patch}:v);
 const w=patch=>({...input.workConfirmation,...patch});
 return [
 ['both members exchanged together',r.status==='preview'&&r.event.members.length===2&&r.event.members.every(x=>x.runs===0)],
 ['distinct caliber identities',r.event?.members.map(x=>x.nextCaliber).join(',')==='6-2,7-2'],
 ['same pair from stand 7',run({standKey:'7'}).status==='preview'],
 ['missing partner held',run({members:input.members.slice(0,1)}).status==='held'],
 ['unknown start held',run({members:m(0,{runs:null})}).status==='held'],
 ['one member not due held',run({members:m(1,{runs:12})}).status==='held'],
 ['no spare caliber held',run({members:m(1,{spareCaliberIds:[]})}).status==='held'],
 ['same caliber reuse rejected',run({members:m(1,{spareCaliberIds:['7-1']})}).status==='held'],
 ['night only held',run({days:[input.days[0],day('2027-04-02',0,0,'','B')]}).status==='held'],
 ['short work slot held',run({workConfirmation:w({reservedHours:3})}).status==='held'],
 ['one stand slot held',run({workConfirmation:w({stands:['6']})}).status==='held'],
 ['unconfirmed 8/9 held',run({standKey:'8'}).status==='held'],
 ['unknown production held',run({days:[{...input.days[0],productionAmount:null},input.days[1]]}).status==='held'],
 ['two producing shifts not counted as one',run({days:[day('2027-04-01',10,8,'A','B'),input.days[1]]}).status==='held'],
 ['overrun held',run({days:[day('2027-03-31',10,8),...input.days]}).status==='held'],
 ['size switch held',run({days:[{...input.days[0],size:'D13'},input.days[1]]}).status==='held'],
 ['duplicate date held',run({days:[input.days[0],...input.days]}).status==='held'],
 ['original input unchanged',JSON.stringify(input)===before],
 ['not annual complete',r.annualComplete===false]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
