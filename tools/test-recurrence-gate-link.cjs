'use strict';
const {checkWorkshopBatch}=require('./repeated-following-rotation.cjs');
function selfTest(){
 const s={snapshotId:'anon',sourceRevision:'v1',workshopReservationBasis:'fixture',sharedRecurrenceCalendar:{verified:true,basis:'fixture'}};
 const a={stand:'8',oldIdentity:'A',targetIdentity:'C',date:'2027-05-01',startHour:8,endHour:10,basis:'fixture'};
 const stage={conditionalHandoverComplete:true,allocations:[a],handovers:[a]};
 const ext={snapshotId:'anon',sourceRevision:'v1',basis:'fixture',id:'external',date:a.date,area:'workshop',startMinute:540,endMinute:660};
 const before=JSON.stringify({s,stage,ext}),t=[];
 const check=(n,v)=>t.push([n,!!v]);
 const good=checkWorkshopBatch(s,[],stage),bad=checkWorkshopBatch(s,[ext],stage);
 check('valid batch accepted',good.accepted&&good.calendar.length===1);
 check('overlap blocked',!bad.accepted&&bad.held.length>0);
 check('prior reservation unchanged',JSON.stringify(bad.calendar)===JSON.stringify([ext]));
 check('partial handover rejected',!checkWorkshopBatch(s,[],{...stage,conditionalHandoverComplete:false}).accepted);
 check('missing counterpart rejected',!checkWorkshopBatch(s,[],{...stage,handovers:[]}).accepted);
 check('wrong identity rejected',!checkWorkshopBatch(s,[],{...stage,handovers:[{...a,targetIdentity:'D'}]}).accepted);
 check('repeat rejected',!checkWorkshopBatch(s,good.calendar,stage).accepted);
 check('unverified calendar rejected',!checkWorkshopBatch({...s,sharedRecurrenceCalendar:{...s.sharedRecurrenceCalendar,verified:false}},[],stage).accepted);
 check('input unchanged',JSON.stringify({s,stage,ext})===before);
 return t;
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
