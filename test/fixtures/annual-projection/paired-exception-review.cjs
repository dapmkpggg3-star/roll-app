'use strict';
function selfTest(api){
 const date='2027-04-01',member=s=>({standKey:s,adoptedCutMm:7,resources:[{id:s+'A',standKey:s,frame:'online',diameter:350},{id:s+'B',standKey:s,frame:'installedSpare',spareKind:'新品予備（組込完了）',chockInstalled:true,diameter:360},{id:s+'C',standKey:s,frame:'usedSpare',spareKind:'新品予備（組替可能）',chockInstalled:false,diameter:370}]});
 const members=['6','7'].map(member),input={members,referenceAt:date};
 const m=(i,p)=>members.map((x,j)=>i===j?{...x,...p}:x);
 const rr=(i,j,p)=>m(i,{resources:members[i].resources.map((x,k)=>j===k?{...x,...p}:x)});
 const assess=p=>api.assessPairException({...input,...p});
 const compatible={status:'compatible',basis:'anonymous evidence',referenceAt:date,rollIds:{'6':'6A','7':'7A'},diameters:{'6':350,'7':350}};
 const original=JSON.stringify(input),r=assess({}),broken=assess({members:rr(0,0,{condition:'broken'})}),diff=assess({members:m(1,{adoptedCutMm:8})});
 const reserve=api.assessEmergencyReserve({standKey:'6',resources:rr(0,1,{condition:'broken'})[0].resources});
 const minimal={...input,standKey:'6',size:'D10',days:[{date}],jointWork:[],capacity:[]};
 const gate=api.previewPairedPhysicalCycle({...minimal,members:rr(0,0,{condition:'broken'})});
 return [
 ['routine not authorized',r.status==='routine-candidate'&&r.operationAuthorized===false&&r.futureCompatibility==='unconfirmed'],
 ['no invented compatibility',r.openingCompatibility==='unconfirmed'],
 ['online break individual review',broken.status==='individual-review'&&broken.affected[0].id==='6A'],
 ['unaffected side record kept',broken.individualRecords.filter(x=>x.standKey==='7').length===3],
 ['broken reserve excluded',reserve.status==='shortage'&&reserve.emergencySpare===0&&reserve.normalSpare===0],
 ['broken reserve exception',assess({members:rr(0,1,{condition:'broken'})}).status==='individual-review'],
 ['explicit ledger fracture',assess({members:rr(1,0,{ledgerStatus:'折損'})}).affected[0]?.id==='7A'],
 ['different cut review no numeric tolerance',diff.status==='individual-review'&&diff.individualRecords.find(x=>x.id==='7A').adoptedCutMm===8],
 ['current evidence not future approval',assess({members:m(1,{adoptedCutMm:8}),compatibility:compatible}).status==='individual-review'],
 ['explicit incompatible',assess({compatibility:{...compatible,status:'incompatible'}}).status==='individual-review'],
 ['explicit unknown',assess({compatibility:{...compatible,status:'unknown'}}).status==='unconfirmed'],
 ['explicit matching evidence',assess({compatibility:compatible}).openingCompatibility==='confirmed-input'],
 ['stale date held',assess({compatibility:{...compatible,referenceAt:'2027-03-31'}}).status==='unconfirmed'],
 ['wrong roll held',assess({compatibility:{...compatible,rollIds:{'6':'6B','7':'7A'}}}).status==='unconfirmed'],
 ['wrong diameter held',assess({compatibility:{...compatible,diameters:{'6':349,'7':350}}}).status==='unconfirmed'],
 ['different diameters not automatic incompatibility',assess({members:rr(1,0,{diameter:352})}).status==='routine-candidate'],
 ['missing diameter held',assess({members:rr(1,0,{diameter:null})}).status==='unconfirmed'],
 ['duplicate ID held',assess({members:rr(1,0,{id:'6A'})}).status==='unconfirmed'],
 ['unknown cut held',assess({members:m(1,{adoptedCutMm:null})}).status==='unconfirmed'],
 ['paired gate separate exception',gate.status==='exception-review'&&gate.events.length===0&&gate.exception.affected[0].id==='6A'],
 ['no automatic release',broken.automaticRelease===false&&diff.operationAuthorized===false],
 ['input unchanged',JSON.stringify(input)===original]
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
