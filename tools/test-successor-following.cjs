'use strict';
const {fixture,selfTest:prior}=require('./test-successor-three-set.cjs');
const {previewSuccessorAdmission}=require('./successor-three-set.cjs');
const {previewFollowingUpperSequence}=require('./following-upper-rotation.cjs');
function selfTest(api){
 const {s,stage,event,group,plans,known}=fixture(api),v={snapshotId:s.snapshotId,sourceRevision:s.sourceRevision,basis:'anonymous'},id=r=>JSON.stringify([String(r.stand),r.rollId,r.generation]),a=previewSuccessorAdmission(s,stage,event,group,plans,known,api);
 const members=[],replacementMasters=[],usage=[];
 for(const k of group.stands){
  const online=a.roles.find(r=>String(r.stand)===k&&r.status==='online'),spare=a.roles.find(r=>String(r.stand)===k&&r.status==='new-standby');
  const ledger=(r,rows)=>({...v,standKey:k,rollId:r.rollId,generation:r.generation,identity:id(r),size:'D10',usageBasis:'anonymous',remainingBasis:'anonymous',openingUsedTons:rows[0].tons,activeCalibers:[],caliberLedger:{...v,identity:id(r),complete:true,totalCalibers:rows.length,calibers:rows.map((c,i)=>({...v,id:String(i+1),runs:null,...c}))}});
  usage.push(ledger(online,[{state:'active',tons:5190}]));
  replacementMasters.push(ledger(spare,[{state:'active',tons:0},{state:'unused',tons:0}]));
  members.push({...v,stand:k,onlineIdentity:id(online),replacementIdentity:id(spare),diameter:{...v,stand:k,rollId:online.rollId,generation:online.generation,identity:id(online),status:'actual',limitApproved:true,limitBasis:'anonymous',measuredDate:s.asOf,currentMm:online.diameterMm,limitMm:400},diameterHistory:[{...v,stand:k,rollId:'history-'+k,cycleId:'past-'+k,status:'actual',kind:'rework',before:430,after:423,inboundDate:'2027-03-01'}]});
 }
 const g={...v,...group,id:'paired-8-9',standPass:'pass',workType:'rollChange',members:usage},cursor='2027-11-16';
 s.throughDate='2027-11-20';s.days=[];
 for(let date=cursor;date<=s.throughDate;date=api.addDays(date,1)){const production=date===s.throughDate?400:0;s.days.push({...v,date,dateRowVerified:true,recordKind:'plan',productionAmount:production,nightProductionAmount:0,size:'D10',grade:'SD295',shift1Team:production?'A':'',operatingHours:production?5:0,exchangeCapacity:1,reservedExchangeCount:0,capacityBasis:'anonymous'});}
 const compatibility={...v,size:'D10',status:'compatible',lineFitConfirmed:true,oldIdentities:Object.fromEntries(members.map(m=>[m.stand,m.onlineIdentity])),replacementIdentities:Object.fromEntries(members.map(m=>[m.stand,m.replacementIdentity])),replacementDiameters:Object.fromEntries(members.map(m=>[m.stand,413]))};
 const plan={...v,members,compatibility};
 s.slots=[{...v,id:'stop',date:'2027-11-19',startMinute:480,endMinute:1000,team:'常昼',lineStopped:true,stopTimeVerified:true,afterRegularDay:false,nightOnlyStop:false,reserved:[],eligibility:[{...v,demandId:g.id,deadlineBasis:g.basis+'／当日の予定使用量で計画基準超過見込み・操業前に交換',compatibilityBasis:v.basis,preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false,workAllowed:true}]}];
 s.upperCaliberSelections=[];s.setupNightHistory=[];
 const state={group:g,cursor,stage:a,replacementMasters,original:{...v,anonymousOnly:true,stand:8,size:'D10'},reservations:[]},r=previewFollowingUpperSequence(s,state,plan,api),before=JSON.stringify([s,state,plan]);
 const run=fn=>{const [x,y,z]=JSON.parse(before);fn(x,y,z);return previewFollowingUpperSequence(x,y,z,api);};
 return {result:r,tests:[...prior(api),
 ['next physical rotation after D admission',r.rotationComplete&&r.sequence.events.find(e=>e.rollChanged)?.date==='2027-11-19'],
 ['C online B used spare D still unassembled',r.endingRoles?.length===6&&group.stands.every(k=>{const own=r.endingRoles.filter(t=>String(t.stand)===k);return own.some(t=>t.rollId===k+'C'&&t.status==='online')&&own.some(t=>t.rollId===k+'B'&&t.status==='used-standby'&&t.emergencyEligible)&&own.some(t=>t.rollId===k+'D'&&t.status==='new-unassembled'&&!t.emergencyEligible&&!t.chockAssembled);})],
 ['D may not become replacement before assembly',run((x,y,z)=>z.members[0].replacementIdentity=plans[0].master.identity).held.length>0],
 ['admission date delays next exchange',run((x,y)=>y.stage.admissions[0].date='2027-11-20').held.some(h=>h.requiredExchange===true)],
 ['no fake purchase issue',!r.operationAuthorized&&!r.writeAllowed&&!r.annualComplete&&JSON.stringify([s,state,plan])===before]
 ]};
}
module.exports={selfTest};
if(require.main===module){const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),api);const {tests}=selfTest(api);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);if(tests.some(x=>!x[1]))process.exitCode=1;}
