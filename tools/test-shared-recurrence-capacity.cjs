'use strict';
const {reserveRecurrenceBatch:run}=require('./shared-recurrence-capacity.cjs');
function selfTest(){
 const v={snapshotId:'anonymous',sourceRevision:'v1',basis:'fixture'},r=(id,startMinute,endMinute,extra={})=>({...v,id,date:'2027-04-05',area:'workshop',startMinute,endMinute,...extra});
 const b={...v,calendarVerified:true,calendarBasis:'fixture',existing:[r('A',480,600)],candidates:[r('B',600,720)]};
 const t=[],check=(name,ok)=>t.push([name,!!ok]),before=JSON.stringify(b);
 check('adjacent intervals',run(b).accepted);
 check('input unchanged',JSON.stringify(b)===before);
 for(const [name,c] of [['overlap',r('B',590,720)],['duplicate',r('A',600,720)],['wrong revision',r('B',600,720,{sourceRevision:'v2'})],['invalid day',r('B',600,720,{date:'2027-02-30'})],['reverse interval',r('B',720,600)],['missing basis',r('B',600,720,{basis:''})]]){
 const z=run({...b,candidates:[c]});check(name,!z.accepted&&JSON.stringify(z.calendar)===JSON.stringify(b.existing));
 }
 check('separate area',run({...b,candidates:[r('B',490,550,{area:'rolling'})]}).accepted);
 check('next day',run({...b,candidates:[r('B',490,550,{date:'2027-04-06'})]}).accepted);
 check('candidate conflict atomic',!run({...b,candidates:[r('B',600,720),r('C',650,780)]}).accepted);
 check('unverified calendar',!run({...b,calendarVerified:false}).accepted);
 check('existing conflict',!run({...b,existing:[...b.existing,r('C',500,550)]}).accepted);
 check('no authorization',!run(b).operationAuthorized&&!run(b).writeAllowed);
 return t;
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
