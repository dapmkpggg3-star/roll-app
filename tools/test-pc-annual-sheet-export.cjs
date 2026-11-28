'use strict';
const {buildPcAnnualSheets}=require('./pc-annual-sheet-export.cjs');
function fixture(){
 const v={snapshotId:'anon',sourceRevision:'v1',basis:'匿名試験'},id='["8","D","g1"]';
 const d={stand:'8',identity:id,status:'conditional-rework',rework:{cycleId:'c1',dispatchDate:'2027-10-11',expectedInboundDate:'2027-10-31',leadDays:20,plannedReworkCostMonth:'2027-10',actualInboundDate:null,receiptConfirmed:false,basis:'匿名搬出根拠',forecastDiameterMm:413}};
 const u={stand:'8',identity:id,rollId:'D',generation:'g1',exchangeDate:'2027-09-29',firstUseDate:'2027-09-30',plannedIssueMonth:'2027-09',actualIssueDate:null,actualIssue:false,forecastOnly:true,basis:'匿名初回使用根拠'};
 const p={stand:'9',identity:'["9","A","g2"]',kind:'successor-needed',status:'successor-review',reason:'最終使用径予測',procurement:{status:'forecast-guidance',actualReceived:false,accountingMonth:null,latestOrderBy:'2027-06-01',latestArrivalBy:'2027-12-01',leadBasis:'匿名購入LT6か月'}};
 return {...v,anonymousOnly:true,fiscalYear:2027,startMonth:'2027-02',asOf:'2027-11-06',circulations:[{...v,result:{forecastOnly:true,writeAllowed:false,operationAuthorized:false,periodComplete:false,stages:[{stage:{dispositions:[d,p]},next:{plannedIssues:[u]}}]}}],actualEvents:[{...v,stand:'8',rollId:'D',kind:'rework-inbound',cycleId:'c1',date:'2027-11-05',status:'actual'}]};
}
function selfTest(){
 const x=fixture(),before=JSON.stringify(x),r=buildPcAnnualSheets(x),[a,readable,raw,c,d]=r.sheets; const b={values:raw.values.map(v=>v.slice(1))};
 const row=(k,t)=>a.values.find(v=>v[0]==='#'+k&&v[1]===t);
 return [
 ['Japanese readable labels and no raw identity',readable.values.slice(1).every(v=>['改削搬入','新品払出','後継発注期限'].includes(v[3])&&['実績','予測'].includes(v[4])&&!String(v[2]).startsWith('['))],
 ['raw IDs retained separately',raw.hiddenByDefault===true&&raw.values.some(v=>String(v[1]).includes('rework-inbound'))],
 ['readable reference and source link',r.cellLinks.length===3&&r.cellLinks.every(l=>readable.values.some(v=>v[0]===l.detailNo))&&r.cellLinks.some(l=>l.stand==='8'&&l.row===22&&l.column===10)],
 ['no missing life assumptions',readable.values.some(v=>v[3]==='改削搬入'&&v[4]==='予測'&&v[9]===413&&v[12].includes('別途確認'))],
 ['four sheet outputs',r.sheets.length===5&&a.name==='年間計画'],
 ['16 stands three lines 12 months',a.values.length===51&&a.values.slice(3).every(v=>v.length===14)],
 ['fiscal months',a.values[2][2]==='2027-04'&&a.values[2][13]==='2028-03'],
 ['November actual only',row(8,'改削搬入')[9]==='実1'&&row(8,'改削搬入')[8]===null],
 ['first issue and order guidance separate',row(8,'新品払出')[7]==='予1'&&row(9,'後継発注期限')[4]==='予1'],
 ['unknown stays empty',row(2,'改削搬入').slice(2).every(x=>x===null)],
 ['forecast evidence retained with diameter and dispatch',b.values.some(v=>v[5]==='rework-inbound'&&v[9]==='2027-10-11'&&v[10]===413&&v[15]==='参照履歴')],
 ['one counted actual record',b.values.filter(v=>v[5]==='rework-inbound'&&v[15]==='集計採用').length===1],
 ['separate unresolved and manual cost sheet',c.values.length>1&&d.values.length===17&&d.values.slice(1).every(v=>v[1]===null&&v[2]===null)],
 ['A3 print contract excludes costs',a.print.range==='A1:N51'&&a.print.paper==='A3'&&!a.print.includeCost],
 ['no mutation or writes',before===JSON.stringify(x)&&!r.writeAllowed&&!r.complete],
 ['invalid fiscal year does not crash',buildPcAnnualSheets({...x,fiscalYear:null}).sheets[3].values.some(v=>v[2]==='年度未確認')]
 ];
}
module.exports={fixture,selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
