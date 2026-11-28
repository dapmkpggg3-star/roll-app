'use strict';
const {previewPcEventMonths}=require('./pc-event-month-ledger.cjs');
function selfTest(){
 const s={anonymousOnly:true,startMonth:'2027-04',asOf:'2027-11-06',snapshotId:'anon',sourceRevision:'v1'};
 const base={snapshotId:'anon',sourceRevision:'v1',stand:8,rollId:'D',basis:'anon'};
 const e=(kind,date,status,extra={})=>({...base,kind,date,status,...extra});
 const input={...s,events:[e('rework-inbound','2027-10-31','forecast',{cycleId:'c1'}),e('rework-inbound','2027-11-05','actual',{cycleId:'c1'}),e('first-use','2027-09-30','actual',{generation:'g1'}),e('first-use','2027-09-30','actual',{generation:'g2'}),e('rework-inbound','2028-01-14','forecast',{cycleId:'c2'})]};
 const before=JSON.stringify(input),r=previewPcEventMonths(input),m=k=>r.months.find(x=>x.month===k),run=events=>previewPcEventMonths({...s,events});
 return [
 ['18 months across fiscal years',r.months.length===18&&r.months[0].month==='2027-04'&&r.months[17].month==='2028-09'],
 ['actual November replaces October forecast',m('2027-10').forecastReworkKnown===null&&m('2027-11').actualReworkKnown===1],
 ['original forecast retained for trace',r.entries.find(x=>x.cycleId==='c1').supersededForecastDates[0]==='2027-10-31'],
 ['physical issue across generations once',m('2027-09').actualIssueKnown===1&&r.entries.length===3],
 ['next independent rework count',m('2028-01').forecastReworkKnown===1],
 ['missing data not zero',m('2027-04').actualIssueKnown===null&&!r.complete],
 ['conflicting actual dates held',run([e('first-use','2027-09-01','actual'),e('first-use','2027-10-01','actual')]).held.length===1&&run([e('first-use','2027-09-01','actual'),e('first-use','2027-10-01','actual')]).entries.length===0],
 ['future actual rejected',run([e('first-use','2028-01-01','actual')]).held.length===1],
 ['no cycle rejected',run([e('rework-inbound','2027-10-01','actual')]).held.length===1],
 ['outside horizon retained',run([e('first-use','2027-03-01','actual')]).outside.length===1],
 ['no fake amounts or writes',r.entries.every(x=>x.accountingAmount===null)&&!r.writeAllowed&&!r.operationAuthorized],
 ['input unchanged',before===JSON.stringify(input)]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [name,ok] of t)console.log((ok?'PASS ':'FAIL ')+name);if(t.some(x=>!x[1]))process.exitCode=1;}
