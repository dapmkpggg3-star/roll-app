'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
function inputFor(month){
 const ym='2027-'+String(month).padStart(2,'0'), n=new Date(Date.UTC(2027,month,0)).getUTCDate();
 const date=i=>ym+'-'+String(i).padStart(2,'0');
 const days=Array.from({length:n},(_,i)=>{const t=i===1?0:405;return {date:date(i+1),size:t?'D13':'休止',productionAmount:t,productionByTeam:{A:t,B:0},shift1Team:'A',shift3Team:'',operatingHours:t?8:0,teamRest:{B:true},teamRestBasis:'anonymous roster'};});
 const member=(stand,runs,tons)=>({standKey:String(stand),rollId:'anon-'+stand,usageBasis:'anonymous usage',openingUsedTons:tons,nextCaliberAvailable:true,remainingBasis:'anonymous inventory',activeCalibers:[{id:'g-'+stand,runs}]});
 const groups=[{id:'R',stands:[4],members:[member(4,0,14595)],workType:'rollChange',size:'D13',basis:'anonymous roll demand',standPass:'pass'},{id:'C',stands:[17],members:[member(17,5,0)],workType:'caliberChange',size:'D13',basis:'anonymous caliber demand',standPass:'pass'}];
 const vm=require('node:vm'),ctx=vm.createContext({});
 for(const f of ['planning-sheet-output.js','operating-plan.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),ctx);
 const summary={...ctx.summarizeMonthlyProductionSchedule(days,date(1)),days,referenceDate:date(1)};
 const ev=id=>({demandId:id,basis:'anonymous eligibility',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false});
 return {summary,referenceDate:date(1),throughDate:date(n),sourceKind:'plan',sourceBasis:'anonymous confirmed schedule',dateRowsVerified:true,sourceRevision:'source-1',previewRevision:'preview-1',groups,capacityRecords:[{date:date(2),count:2,kind:'exchange-capacity',confirmed:true,basis:'anonymous verified count'}],slots:[{id:'S',date:date(2),team:'常昼',startMinute:480,endMinute:960,lineStopped:true,basis:'anonymous stop',eligibility:['R','C'].map(ev)}],manualEntries:[{id:'M',date:date(2),team:'常昼',text:'既存手入力 <script>alert(1)</script>'}]};
}
function run(cmd,args,input){
 return spawnSync(cmd,args,{input:JSON.stringify(input),encoding:'utf8',maxBuffer:4*1024*1024});
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'roll-anon-'));
try {
 for(const month of [4,5]){
  const input=inputFor(month);
  const r=run(process.execPath,[path.join(__dirname,'pc-workbook-model.cjs'),'--anonymous-only'],input);
  assert.equal(r.status,0,r.stderr);const p=JSON.parse(r.stdout);
  assert.equal(p.rows.length,month===4?30:31);
  assert.equal(p.rows[1].red.join(','),'12');
  assert.match(p.rows[1].values[12],/#4/);assert.match(p.rows[1].values[13],/#17/);
  assert.equal(p.manual[0].text,input.manualEntries[0].text);
  assert.equal(p.evidence.length,2);assert.equal(p.issues.length,4);
  assert.equal(p.writeAllowed,false);assert.equal(p.operationAuthorized,false);
  if(process.argv.includes('--xlsx')){
   const dest=path.join(tmp,month+'.xlsx'),writer=path.join(__dirname,'pc-workbook-export.py'),python=process.env.PYTHON||'python3';
   const args=[writer,'--anonymous-only','--output',dest];
   const x=run(python,args,p);assert.equal(x.status,0,x.stderr);
   const bytes=fs.readFileSync(dest);assert.equal(bytes.subarray(0,2).toString(),'PK');
   assert.notEqual(run(python,args,p).status,0);assert.deepEqual(fs.readFileSync(dest),bytes);
   for(const [i,bad] of [{...p,writeAllowed:true},{...p,operationAuthorized:true},{...p,rows:p.rows.slice(1)},{...p,previewRevision:p.sourceRevision}].entries()){
    const rejected=path.join(tmp,month+'-reject-'+i+'.xlsx');
    assert.notEqual(run(python,[writer,'--anonymous-only','--output',rejected],bad).status,0);
    assert.equal(fs.existsSync(rejected),false);
   }
  }
  console.log('PASS anonymous month '+month+(process.argv.includes('--xlsx')?' with XLSX':' model'));
 }
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
