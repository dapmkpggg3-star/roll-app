'use strict';
const {buildPcPurchasePanel,renderPcPurchasePanel}=require('./pc-purchase-panel.cjs');
const {fixture}=require('./test-pc-annual-sheet-export.cjs');
function selfTest(){
 const x=fixture();x.asOf='2027-04-20';x.actualEvents=[];
 const p=x.circulations[0].result.stages[0].stage.dispositions[1];
 p.procurement.latestOrderBy='2027-05-20';p.procurement.latestArrivalBy='2027-11-20';
 const q=JSON.parse(JSON.stringify(p));q.identity='["9","B","g1"]';q.procurement.latestOrderBy='2027-04-19';q.procurement.latestArrivalBy='2027-10-19';
 const z=JSON.parse(JSON.stringify(p));z.identity='["9","C","g1"]';z.procurement.latestOrderBy='2027-09-20';z.procurement.latestArrivalBy='2028-03-20';
 x.circulations[0].result.stages[0].stage.dispositions.push(q,z);
 const k=JSON.stringify(['successor','9','A']);
 x.procurementRecords=[{demandKey:k,state:'ordered',checkedOn:x.asOf,basis:'<script>unsafe</script>',orderDate:'2027-02-01',orderReference:'anon-po',confirmedDeliveryDate:'2027-12-02'}];
 const before=JSON.stringify(x),m=buildPcPurchasePanel(x),html=renderPcPurchasePanel(x),empty=renderPcPurchasePanel({...x,circulations:[]});
 return [
 ['Three distinct physical demands',m.rows.length===3],
 ['Critical warning prioritized',m.rows.slice(0,2).every(r=>r.warnings.some(w=>w.includes('期限超過')||w==='確定納期遅延'))],
 ['Ordered late and unknown distinguished',html.includes('発注済み・納期確定')&&html.includes('確定納期遅延')&&html.includes('発注状況未確認')],
 ['Order actual and delivery date shown',html.includes('2027-02-01')&&html.includes('確定 2027-12-02')],
 ['Future demand beyond threshold visible',html.includes('2027-09-20')],
 ['Japanese evidence expandable',html.includes('<details><summary>購入期限の根拠・購買照合</summary>')&&html.includes('警告日数（未承認）：90・60・30')],
 ['HTML escaped, no script injection',html.includes('&lt;script&gt;unsafe&lt;/script&gt;')&&!html.includes('<script>')],
 ['No network or purchase action',html.includes("default-src 'none'")&&!/<(?:script|form|button|iframe)\b/.test(html)&&!m.writeAllowed&&!m.notificationAuthorized&&!m.operationAuthorized],
 ['Unknown spare is never marked sufficient',html.includes('別途循環・現物確認')],
 ['Empty is not confirmed zero',empty.includes('需要ゼロの確定ではありません')&&empty.includes('未接続購買記録 1件')],
 ['Review and no authorization visible',html.includes('現場使用未承認')&&html.includes('要確認')],
 ['Does not change input',before===JSON.stringify(x)]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
