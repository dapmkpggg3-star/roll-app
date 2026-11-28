'use strict';
const {selectWorkshopOptions}=require('./shared-workshop-handover.cjs');
function selfTest(){
 const o=(date,startHour=8,endHour=10)=>({request:{slot:{date,startHour,endHour}}});
 const opts=[o('2027-04-05'),o('2027-04-06'),o('2027-04-20')],busy=[{date:'2027-04-05',startHour:8,endHour:12}],s={workshopDeadlineMode:true};
 const go=(input=s,filter=()=>true,target='2027-04-15')=>selectWorkshopOptions(input,opts,busy,filter,target);
 const before=JSON.stringify({opts,busy,s});
 return [['same deadline and day allowed',go().length===2&&go()[0]===opts[0]],['second stand same date independently allowed',go()[0]===opts[0]],['after deadline excluded',!go().includes(opts[2])],['missing target held',go(s,()=>true,null).length===0],['invalid target held',go(s,()=>true,'2027-02-30').length===0],['safety eligibility retained',go(s,()=>false).length===0],['legacy overlap still blocked',go({}).length===2&&go({})[0]===opts[1]],['input unchanged',JSON.stringify({opts,busy,s})===before]];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
