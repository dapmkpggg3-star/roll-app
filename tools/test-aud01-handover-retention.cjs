'use strict';
const {previewReturnHandover}=require('./return-handover-stage.cjs');
function selfTest(){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'fixture'},s={...v,anonymousOnly:true,asOf:'2027-04-01',throughDate:'2027-04-30',workshopReservationsVerified:true,workshopReservationBasis:'fixture'};
 const roles=['8','9'].flatMap(stand=>['used-standby','online','rework'].map((status,i)=>({stand,rollId:stand+'-'+i,generation:'g1',status,chockAssembled:i<2,emergencyEligible:i<2})));
 const stage={roles,event:{date:'2027-04-05',endMinute:720},group:{stands:['8','9'],size:'D10'},busy:[],priorCycles:[],dispositions:[]},plan={...v,returnMasters:[],workshopOptions:[],members:[],dispatchPlans:[]};
 const clone=x=>JSON.parse(JSON.stringify(x)),run=x=>previewReturnHandover(s,x,plan,{}),before=JSON.stringify(stage),r=run(stage),t=[];
 t.push(['Missing return retains both old usable spares',r.held.length===2&&r.held.every(h=>h.oldReserveRetained&&h.oldPhysicalRetained)]);
 t.push(['No phantom assembly or next rotation',r.handovers.length===0&&!r.readyForNextRotation&&r.roles.every((q,i)=>JSON.stringify(q)===JSON.stringify(roles[i]))]);
 for(const [key,val] of [['condition','broken'],['ledgerStatus','折損'],['spareKind','折損']]){
  const x=clone(stage);x.roles[0][key]=val;const y=run(x),h=y.held.find(h=>h.stand==='8');
  t.push([key+' broken reserve retained physically only',h.oldReserveRetained===false&&h.oldPhysicalRetained===true&&h.reason.includes('折損')&&y.handovers.length===0&&y.held.find(h=>h.stand==='9').oldReserveRetained===true]);
 }
 const b=clone(stage);b.roles[1].condition='broken';const y=run(b);
 t.push(['Broken online blocks handover',y.held.find(h=>h.stand==='8').reason.includes('折損')&&!y.readyForNextRotation]);
 t.push(['No input mutation or operational authorization',JSON.stringify(stage)===before&&!r.operationAuthorized&&!r.writeAllowed&&!r.actualAssembly]);
 return t;
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
