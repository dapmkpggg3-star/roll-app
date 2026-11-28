'use strict';
const {previewPcStandYear}=require('./pc-stand-year-matrix.cjs');
function selfTest(){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'anon'},s={...v,anonymousOnly:true,fiscalYear:2027,startMonth:'2027-02',asOf:'2027-11-06'};
 const d={stand:'8',identity:'["8","D","g1"]',status:'conditional-rework',rework:{cycleId:'c1',dispatchDate:'2027-10-11',expectedInboundDate:'2027-10-31',leadDays:20,plannedReworkCostMonth:'2027-10',actualInboundDate:null,receiptConfirmed:false,basis:'anon dispatch',forecastDiameterMm:413}};
 const u={stand:'8',identity:d.identity,rollId:'D',generation:'g1',exchangeDate:'2027-09-29',firstUseDate:'2027-09-30',plannedIssueMonth:'2027-09',actualIssueDate:null,actualIssue:false,forecastOnly:true,basis:'anon first use'};
 const p={stand:'9',identity:'["9","A","g2"]',kind:'successor-needed',status:'successor-review',reason:'final use',procurement:{status:'forecast-guidance',actualReceived:false,accountingMonth:null,latestOrderBy:'2027-06-01',latestArrivalBy:'2027-12-01',leadBasis:'anon 6 months'}};
 const root={forecastOnly:true,writeAllowed:false,operationAuthorized:false,periodComplete:false,stages:[{stage:{dispositions:[d,p,p]},next:{plannedIssues:[u]}}]};
 const input={...s,circulations:[{...v,result:root}],actualEvents:[{...v,stand:'8',rollId:'D',kind:'rework-inbound',cycleId:'c1',date:'2027-11-05',status:'actual'},{...v,stand:'17',rollId:'X',kind:'first-use',date:'2027-03-01',status:'actual'}]};
 const before=JSON.stringify(input),r=previewPcStandYear(input),c=(k,m)=>r.rows.find(x=>x.stand===k).months.find(x=>x.month===m);
 const run=fn=>{const a=JSON.parse(before);fn(a);return previewPcStandYear(a);};
 return [
 ['16 stands and 12 fiscal months',r.rows.length===16&&r.rows[0].stand==='2'&&r.rows[15].stand==='17'&&r.rows.every(x=>x.months.length===12)&&r.months[0]==='2027-04'&&r.months[11]==='2028-03'],
 ['18 month ledger separate',r.ledger.months.length===18&&r.ledger.months[0].month==='2027-02'],
 ['actual replaces old month forecast',c('8','2027-11').actualRework===1&&c('8','2027-10').forecastRework===null],
 ['individual stand issue count',c('8','2027-09').forecastIssue===1&&c('9','2027-09').forecastIssue===null],
 ['purchase deadline deduplicated and separate from expense',c('9','2027-06').latestOrderGuidance===1&&r.purchaseGuidance.length===1&&r.purchaseGuidance[0].accountingMonth===null],
 ['detail key links',c('8','2027-11').detailKeys.every(k=>r.detail.some(d=>d.key===k))&&c('9','2027-06').detailKeys.every(k=>r.detail.some(d=>d.key===k))],
 ['outside fiscal events preserved',r.detail.some(e=>e.stand==='17'&&e.inFiscalYear===false)],
 ['unknown stays blank',c('2','2027-04').actualRework===null&&c('2','2027-04').forecastIssue===null&&!r.complete],
 ['purchase conflict held',run(a=>{a.circulations[0].result.stages[0].stage.dispositions[2].procurement.latestOrderBy='2027-07-01';}).held.some(h=>h.reason==='同一後継購入期限競合')],
 ['short horizon flagged',run(a=>a.startMonth='2026-01').held.some(h=>h.reason==='年度全12月が18か月予測範囲に含まれない')],
 ['A3 layout contract only',r.print.paper==='A3'&&r.print.orientation==='landscape'&&r.print.pagesWide===1&&r.print.pagesTall===1&&!r.print.includeCost],
 ['no mutation or writes',JSON.stringify(input)===before&&!r.writeAllowed&&!r.operationAuthorized]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
