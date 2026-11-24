'use strict';
function selfTest(api) {
 const day=(date,productionAmount,nightProductionAmount,shift1Team,shift3Team,operatingHours=0)=>({date,productionAmount,nightProductionAmount,shift1Team,shift3Team,operatingHours,size:'D10'});
 const member=(stand)=>({standKey:stand,rollId:'anon-'+stand+'-A',caliberId:stand+'-6',runs:14,spareCaliberIds:[],basis:'anonymous opening',reworkDays:20,resources:[{id:'anon-'+stand+'-A',standKey:stand,frame:'online',diameter:350,caliberId:stand+'-6',runs:14,spareCaliberIds:[]},{id:'anon-'+stand+'-B',standKey:stand,frame:'installedSpare',diameter:365,caliberId:stand+'-1',runs:0,prepared:true,preparedOn:'2027-04-01'},{id:'anon-'+stand+'-C',standKey:stand,frame:'usedSpare',diameter:345}]});
 const input={standKey:'6',size:'D10',referenceAt:'2027-04-01',members:[member('6'),member('7')],days:[day('2027-04-01',400,400,'','B',8),day('2027-04-02',0,0,'A',''),day('2027-04-03',0,0,'A','')],workConfirmation:{stands:['6','7'],date:'2027-04-03',period:'day',reservedHours:7,requiredHours:6,people:3,workType:'rollChange',continuous:'no',changeover:'yes',threeSet:'yes'}};
 const run=p=>api.previewPairedExchangeWithSetup({...input,...p});
 const initial=JSON.stringify(input),r=run({});
 const m=(i,patch)=>input.members.map((v,j)=>j===i?{...v,...patch}:v);
 const resources=(i,idx,patch)=>m(i,{resources:input.members[i].resources.map((v,j)=>j===idx?{...v,...patch}:v)});
 const w=patch=>({...input.workConfirmation,...patch});
 const instruction=(days,date='2027-04-03')=>api.previewSetupMaterialInstruction(days,date);
 const caliber={...input,members:input.members.map(x=>({...x,spareCaliberIds:[x.standKey+'-next']})),workConfirmation:{...input.workConfirmation,workType:'caliberChange',requiredHours:4,reservedHours:4}};
 return [
 ['both roll changes same day',r.status==='preview'&&r.event.kind==='ロール替'&&r.event.members.length===2],
 ['correct old and entering IDs',r.event?.members.every(x=>x.oldRollId==='anon-'+x.stand+'-A'&&x.newRollId==='anon-'+x.stand+'-B')],
 ['new caliber zero',r.event?.members.every(x=>x.runs===0)],
 ['stopped prior night moves back',r.setup?.instruction?.date==='2027-04-01'&&r.setup.instruction.team==='B'],
 ['instruction exact text',r.setup?.instruction?.text==='#6st用型決め材挿入'],
 ['immediately prior producing night',instruction([day('2027-04-02',400,400,'','A',8)]).instruction?.date==='2027-04-02'],
 ['unknown night not skipped',instruction([input.days[0],{...input.days[1],nightProductionAmount:null}]).status==='held'],
 ['missing intervening date not skipped',instruction([input.days[0]]).status==='held'],
 ['wrong night team held',instruction([day('2027-04-02',400,400,'','?',8)]).status==='held'],
 ['day-only production not night',instruction([input.days[0],day('2027-04-02',400,0,'A','',8)]).instruction?.date==='2027-04-01'],
 ['night amount greater than total rejected',instruction([day('2027-04-02',100,400,'','A',8)]).status==='held'],
 ['no prior producing night held',instruction([input.days[1]]).status==='held'],
 ['caliber change also creates instruction',api.previewPairedExchangeWithSetup(caliber).setup?.instruction?.date==='2027-04-01'],
 ['one pair not exhausted held',run({members:m(1,{spareCaliberIds:['7-extra']})}).status==='held'],
 ['missing installed spare held',run({members:resources(1,1,{frame:'other'})}).status==='held'],
 ['future preparation held',run({members:resources(0,1,{preparedOn:'2027-04-04'})}).status==='held'],
 ['unknown preparation held',run({members:resources(0,1,{prepared:false})}).status==='held'],
 ['nonzero incoming caliber held',run({members:resources(0,1,{runs:1})}).status==='held'],
 ['wrong stand identity held',run({members:resources(1,1,{standKey:'6'})}).status==='held'],
 ['duplicate identity held',run({members:resources(1,1,{id:'anon-6-B'})}).status==='held'],
 ['short paired roll slot held',run({workConfirmation:w({reservedHours:5})}).status==='held'],
 ['missing date held',run({days:[input.days[0],input.days[2]]}).status==='held'],
 ['8/9 not assumed',run({standKey:'8'}).status==='held'],
 ['original unchanged',JSON.stringify(input)===initial],
 ['not annual or night readiness confirmed',r.annualComplete===false&&r.reason.includes('夜勤安全は別途確認')]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
