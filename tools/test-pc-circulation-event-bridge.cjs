'use strict';
const {previewPcCirculationEvents}=require('./pc-circulation-event-bridge.cjs');
function selfTest(){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'anon'},s={...v,anonymousOnly:true,startMonth:'2027-04',asOf:'2027-11-06',actualEvents:[]},id=JSON.stringify(['8','D','g1']);
 const d={stand:'8',identity:id,status:'conditional-rework',rework:{cycleId:'c1',dispatchDate:'2027-10-11',expectedInboundDate:'2027-10-31',leadDays:20,plannedReworkCostMonth:'2027-10',actualInboundDate:null,receiptConfirmed:false,basis:'anon dispatch',forecastDiameterMm:413}};
 const u={stand:'8',identity:id,rollId:'D',generation:'g1',exchangeDate:'2027-09-29',firstUseDate:'2027-09-30',plannedIssueMonth:'2027-09',actualIssueDate:null,actualIssue:false,forecastOnly:true,basis:'anon first use'};
 const p={stand:'9',identity:JSON.stringify(['9','A','g2']),kind:'successor-needed',status:'successor-review',reason:'final use',procurement:{status:'forecast-guidance',actualReceived:false,accountingMonth:null,latestOrderBy:'2027-06-01',latestArrivalBy:'2027-12-01',leadBasis:'anon 6 months'}};
 const root={forecastOnly:true,writeAllowed:false,operationAuthorized:false,periodComplete:false,initial:{third:{third:{second:{first:{dispositions:[d]}},dispositions:[p]}},fourth:{plannedIssues:[u]}},stages:[{stage:{dispositions:[d]},next:{plannedIssues:[u],pendingFirstUse:[{stand:'9',reason:'no production'}]}}],held:[{reason:'later rotation missing'}]};
 const input={...s,circulations:[{...v,result:root}],actualEvents:[{...v,stand:'8',rollId:'D',kind:'rework-inbound',cycleId:'c1',date:'2027-11-05',status:'actual'}]},before=JSON.stringify(input);
 const r=previewPcCirculationEvents(input),m=k=>r.ledger.months.find(x=>x.month===k);
 const run=fn=>{const a=JSON.parse(before);fn(a);return previewPcCirculationEvents(a);};
 return [
 ['repeated dispositions reconcile with actual in November',m('2027-11').actualReworkKnown===1&&m('2027-10').forecastReworkKnown===null&&r.ledger.entries.find(x=>x.cycleId==='c1').supersededForecastDates[0]==='2027-10-31'],
 ['same issue across output paths counted once',m('2027-09').forecastIssueKnown===1],
 ['procurement guidance separate from money',r.purchaseGuidance.length===1&&r.purchaseGuidance[0].accountingMonth===null],
 ['pending issue stays pending',r.pending.length===1],
 ['incomplete circulation remains visible',!r.complete&&r.held.some(x=>x.reason==='期間内の全循環未確認')&&r.held.some(x=>x.reason==='later rotation missing')],
 ['mismatched lead time held',run(a=>a.circulations[0].result.stages[0].stage.dispositions[0].rework.leadDays=30).held.some(x=>x.reason==='改削搬入予測根拠未確認')],
 ['fabricated actual inbound held',run(a=>a.circulations[0].result.stages[0].stage.dispositions[0].rework.receiptConfirmed=true).held.some(x=>x.reason==='改削搬入予測根拠未確認')],
 ['wrong first use month held',run(a=>a.circulations[0].result.stages[0].next.plannedIssues[0].plannedIssueMonth='2027-10').held.some(x=>x.reason==='初回使用予測根拠未確認')],
 ['stale source held',run(a=>a.circulations[0].sourceRevision='old').held.some(x=>x.reason==='循環出力・版未確認')],
 ['input unchanged and no writes',JSON.stringify(input)===before&&!r.writeAllowed&&!r.operationAuthorized]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
