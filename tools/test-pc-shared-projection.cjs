'use strict';
const {projectPcSharedCirculation}=require('./pc-shared-circulation.cjs');
function selfTest(){
 const tag={snapshotId:'anon',sourceRevision:'v1',basis:'匿名'},s={...tag,anonymousOnly:true,asOf:'2027-04-01',throughDate:'2028-09-30',startMonth:'2027-04',fiscalYear:2027,actualEvents:[],groups:['2','3','4','5','6,7','8,9','10,11','12,13','14,15','16','17'].map(k=>({...tag,id:'g'+k,stands:k.split(','),workType:'rollChange'}))};
 const first={status:'shared-workshop-preview',writeAllowed:false,operationAuthorized:false,held:[],exchangeUnresolved:[{id:'g8,9',stands:['8','9'],requiredExchange:true,latestDate:'2027-05-10',reason:'停止枠なし'}],pathlineIssues:[],dispositions:[{stand:'2',identity:'["2","A","g1"]',status:'conditional-rework',rework:{cycleId:'c1',dispatchDate:'2027-05-11',expectedInboundDate:'2027-05-31',leadDays:20,plannedReworkCostMonth:'2027-05',actualInboundDate:null,receiptConfirmed:false,basis:'匿名'}},{stand:'17',identity:'["17","D","g1"]',kind:'successor-needed',status:'successor-review',actualDisposition:false,actualOrderDate:null,procurement:{status:'forecast-guidance',latestOrderBy:'2027-06-01',latestArrivalBy:'2027-12-01',actualReceiptDate:null,accountingMonth:null,leadBasis:'匿名暫定6か月'}}]};
 const before=JSON.stringify([s,first]),run=(x=s,f=first)=>projectPcSharedCirculation(x,()=>f),r=run(),at=k=>r.coverage.find(c=>c.stand===k),bad=x=>run({...s,...x});
 return [
 ['All 16 rows but no full-horizon claim',r.coverage.length===16&&r.coverage.every(c=>!c.fullHorizonVerified)&&!r.complete&&!r.periodComplete],
 ['First-stage inbound month from existing calculation',r.annual.rows.find(c=>c.stand==='2').months.find(m=>m.month==='2027-05').forecastRework===1],
 ['First-stage purchase reaches warning without actual receipt assertion',r.purchase.rows.some(p=>p.stand==='17'&&p.state==='発注状況未確認'&&p.accountingMonth===null)],
 ['Unresolved pair demand retained on both stands', ['8','9'].every(k=>r.annual.held.some(h=>h.stand===k&&h.requiredExchange===true&&h.demandId==='g8,9'&&h.date==='2027-05-10'))],
 ['Coverage distinguishes missing disposition',at('3').state==='初回処遇未確認'&&at('2').state==='初回処遇の予測あり'],
 ['Missing stand visible and out-of-scope disposition not counted',bad({groups:s.groups.slice(1)}).coverage[0].state==='対象入力なし'&&bad({groups:s.groups.slice(1)}).annual.detail.every(d=>d.stand!=='2')],
 ['Duplicate held before upstream call',bad({groups:[...s.groups,s.groups[0]]}).first===null],
 ['Wrong pair held',bad({groups:[{...s.groups[0],stands:['6','8']}]}).first===null],
 ['No false read-only result',run(s,{...first,writeAllowed:true}).annual===null],
 ['No inferred receipts',run(s,{...first,dispositions:[{...first.dispositions[1],procurement:{...first.dispositions[1].procurement,actualReceiptDate:'2027-04-01'}}]}).purchase.rows.length===0],
 ['Unknown month remains blank',r.annual.rows.find(c=>c.stand==='3').months.every(m=>m.forecastRework===null)],
 ['No mutation or permission',before===JSON.stringify([s,first])&&!r.writeAllowed&&!r.operationAuthorized]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
