'use strict';
function selfTest(api) {
 const out=[], check=(n,ok)=>out.push([n,Boolean(ok)]);
 const assess=api.assessEmergencyReserve;
 const row=(stand,id,frame,spareKind,chockInstalled,emergencyUsable)=>({standKey:stand,id,frame,spareKind,chockInstalled,emergencyUsable});
 for(let s=2;s<=17;s++){
  const stand=String(s), online=row(stand,'A','online'), raw=row(stand,'C','usedSpare','新品予備（組替可能）',false);
  const used=row(stand,'B','usedSpare','中古予備（バラシ前）',true);
  const fresh=row(stand,'B','installedSpare','新品予備（組込完了）',true);
  const get=resources=>assess({standKey:stand,resources});
  let r=get([online,used,raw]);check('#'+s+' used emergency only',r.normalSpare===0&&r.emergencySpare===1&&r.status==='available');
  r=get([online,fresh,raw]);check('#'+s+' assembled normal and emergency',r.normalSpare===1&&r.emergencySpare===1&&r.status==='available');
  r=get([online,{...used,chockInstalled:false},raw]);check('#'+s+' actual zero',r.normalSpare===0&&r.emergencySpare===0&&r.status==='shortage');
  r=get([online,{...used,emergencyUsable:false},raw]);check('#'+s+' unsuitable used',r.emergencySpare===0&&r.status==='shortage');
  r=get([online,row(stand,'B','usedSpare'),raw]);check('#'+s+' ambiguous used not zero',r.emergencySpare===null&&r.status==='unknown');
  r=get([online,used,{...raw,chockInstalled:true}]);check('#'+s+' contradictory raw held',r.status==='unknown');
  check('#'+s+' duplicate id held',get([online,used,{...raw,id:'B'}]).status==='unknown');
  check('#'+s+' wrong stand held',get([online,used,{...raw,standKey:'99'}]).status==='unknown');
  check('#'+s+' missing set held',get([online,used]).status==='unknown');
  check('#'+s+' multiple online held',get([online,used,{...raw,frame:'online'}]).status==='unknown');
  const snapshot=[online,used,raw],before=JSON.stringify(snapshot);get(snapshot);check('#'+s+' input unchanged',JSON.stringify(snapshot)===before);
 }
 const rr=api.readLedgerResources([{id:'A',name:'#10-A',status:'オンライン'},{id:'B',name:'#10-B',status:'中古予備（バラシ前）'},{id:'C',name:'#10-C',status:'新品予備（組替可能）'}]);
 check('ledger maps explicit chock states',rr[1].chockInstalled===true&&rr[2].chockInstalled===false&&assess({standKey:'10',resources:rr}).emergencySpare===1);
 return out;
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
