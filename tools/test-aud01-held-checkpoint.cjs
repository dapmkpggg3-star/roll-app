'use strict';
const {exchangeCheckpoint}=require('./repeated-following-rotation.cjs');
function selfTest(){
 const roles=['8','9'].flatMap(stand=>['used-standby','online','rework'].map((status,i)=>({stand,rollId:stand+'-'+i,generation:'g1',status,chockAssembled:i<2,emergencyEligible:i<2})));
 const n={rotationComplete:true,forecastOnly:true,operationAuthorized:false,writeAllowed:false,endingGroup:{stands:['8','9']},endingRoles:roles,reservations:[{date:'2027-04-05',slotId:'stop'}],sequence:{events:[{rollChanged:true,date:'2027-04-05'}]}};
 const b=JSON.stringify(n),c=exchangeCheckpoint(n),test=[];
 test.push(['Exchange date and phase retained',c.date==='2027-04-05'&&c.phase==='after-roll-exchange']);
 test.push(['Six roles and original reserve retained',c.roles.length===6&&c.roles.filter(r=>r.status==='used-standby'&&r.emergencyEligible).length===2]);
 test.push(['Rolling reservation retained',c.reservations.length===1&&c.reservations[0].slotId==='stop']);
 test.push(['No actual completion inferred',c.forecastOnly===true&&c.actualCompletion===false]);
 test.push(['Unverified rotation held',exchangeCheckpoint({...n,rotationComplete:false})===null]);
 test.push(['Missing event or ambiguous event held',exchangeCheckpoint({...n,sequence:{events:[]}})===null&&exchangeCheckpoint({...n,sequence:{events:[...n.sequence.events,...n.sequence.events]}})===null]);
 test.push(['Unsafe result held',exchangeCheckpoint({...n,writeAllowed:true})===null]);
 c.roles[0].status='new-standby';c.reservations[0].slotId='other';c.group.stands.pop();
 test.push(['Checkpoint is a detached copy',JSON.stringify(n)===b]);
 return test;
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
