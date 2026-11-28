'use strict';
const {previewPcReserveReview}=require('./pc-reserve-review.cjs');
function selfTest(){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'fixture'},asOf='2027-04-01',safe={forecastOnly:true,writeAllowed:false,operationAuthorized:false};
 const roles=k=>[{...v,stand:k,rollId:'A',generation:'g1',status:'online',actualStateVerified:true},{...v,stand:k,rollId:'B',generation:'g1',status:'used-standby',chockAssembled:true,emergencyEligible:true,normalEligible:true,actualStateVerified:true},{...v,stand:k,rollId:'C',generation:'g1',status:'rework',chockAssembled:false,emergencyEligible:false,actualStateVerified:true}];
 const snap=(k,rs)=>({...v,stand:k,date:asOf,kind:'actual',complete:true,roles:rs});
 const make=()=>({...v,anonymousOnly:true,asOf,circulations:[],reserveActualSnapshots:[snap('8',roles('8')),snap('9',roles('9'))]});
 const cur=(s,k='8')=>previewPcReserveReview(s).current.find(x=>x.stand===k),t=[];
 for(const [key,value] of [['condition','broken'],['ledgerStatus','折損'],['spareKind','折損']]){
  const s=make();s.reserveActualSnapshots[0].roles[1][key]=value;
  const r=cur(s);t.push([key+' overrides stale flags',r.emergencyCount===0&&r.normalCount===0&&r.brokenIdentities.length===1]);
  t.push([key+' pair held',previewPcReserveReview(s).pairReview.find(p=>p.stands.join(',')==='8,9').state==='片側予備不足・ペア未成立']);
 }
 const s=make(),before=JSON.stringify(s);
 t.push(['healthy used reserve retained',cur(s).emergencyCount===1&&cur(s).normalCount===0]);
 const u=make();u.reserveActualSnapshots.pop();t.push(['unknown pair not zero',previewPcReserveReview(u).pairReview.find(p=>p.stands.join(',')==='8,9').state==='片側予備情報不足・ペア適合未確認']);
 const f=make(),broken=roles('8');broken[1].condition='broken';const restored=roles('8');restored[1].status='new-standby';restored[1].conditionalAssembly=true;
 f.circulations=[{...v,result:{...safe,initial:{fourth:{...safe,rotationComplete:true,endingRoles:broken,sequence:{events:[{rollChanged:true,date:'2027-04-02'}]}}},stages:[{stage:{...safe,roles:restored,handovers:[{stand:'8',targetIdentity:'["8","B","g1"]',status:'conditional-on-future-receipt',forecastOnly:true,actualCompletion:false,date:'2027-04-03'}]}}]}}];
 const r=previewPcReserveReview(f);
 t.push(['forecast broken reserve excluded',r.forecast.find(x=>x.date==='2027-04-02')?.emergencyCount===0]);
 t.push(['later recovery preserves prior zero',r.forecast.find(x=>x.date==='2027-04-03')?.emergencyCount===1&&r.forecast.find(x=>x.date==='2027-04-02')?.emergencyCount===0]);
 t.push(['input and authority unchanged',JSON.stringify(s)===before&&!r.writeAllowed&&!r.operationAuthorized]);
 return t;
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
