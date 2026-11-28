'use strict';
const {fixture}=require('./test-pc-annual-sheet-export.cjs');
const {previewPcCirculationEvents}=require('./pc-circulation-event-bridge.cjs');
const {buildPcPurchasePanel,renderPcPurchasePanel}=require('./pc-purchase-panel.cjs');
function selfTest(){
 const x=fixture(),root=x.circulations[0].result,stage=root.stages[0].stage,next=root.stages[0].next;
 stage.held=[{stand:'8',reason:'現物見込み後の同日組替・共通枠未成立',oldReserveRetained:true},{stand:'9',reason:'改削戻りの新世代・個体・全カリバ未確認',oldReserveRetained:false}];
 stage.workshopInstructions=[{stand:'8',status:'held',assemblyDeadline:'2027-11-04',dispatchDeadline:'2027-11-07',oldReserveRetained:true,warnings:['搬入遅延・組替期限内成立せず','搬出予定が期限超過']},{stand:'9',status:'held',oldReserveRetained:true,warnings:['3セット個体未確認']}];
 next.held=[{reason:'交換需要残存',stand:'8',requiredExchange:true,demandId:'anon-demand',date:'2027-11-06'},{reason:'次回個体未確認',stand:'9',requiredExchange:null}];
 root.held=[{reason:'次回交換未成立',requiredExchange:true,details:[{stand:'8',reason:'緊急交換後の予備未確認',oldReserveRetained:false}]}];
 const before=JSON.stringify(x),r=previewPcCirculationEvents(x),p=buildPcPurchasePanel(x),html=renderPcPurchasePanel(x);
 const find=reason=>r.held.find(h=>h.reason===reason),deadline=r.held.find(h=>h.assemblyDeadline),unknown=r.held.find(h=>h.warnings?.includes('3セット個体未確認'));
 const empty=renderPcPurchasePanel({...x,circulations:[]});
 return [
 ['Unfulfilled exchange demand retained with id and date',find('交換需要残存').requiredExchange===true&&find('交換需要残存').demandId==='anon-demand'&&find('交換需要残存').date==='2027-11-06'],
 ['Unknown exchange not interpreted as false',find('次回個体未確認').requiredExchange===null&&find('次回個体未確認').exchangeStatus==='交換需要の判定未確認'],
 ['Old spare retained forecast not actual',find('現物見込み後の同日組替・共通枠未成立').oldReserveRetained===true&&find('現物見込み後の同日組替・共通枠未成立').spareStatus.includes('現物別確認')],
 ['False retained flag not equated to zero',find('改削戻りの新世代・個体・全カリバ未確認').oldReserveRetained===false&&!find('改削戻りの新世代・個体・全カリバ未確認').spareStatus.includes('0')],
 ['Nested hold retained with stand',find('緊急交換後の予備未確認').stand==='8'&&find('緊急交換後の予備未確認').oldReserveRetained===false],
 ['Workshop multiple warnings and both deadlines retained',deadline.dispatchDeadline==='2027-11-07'&&deadline.assemblyDeadline==='2027-11-04'&&deadline.warnings.length===2],
 ['Workshop default retained flag not evidence',!Object.hasOwn(unknown,'oldReserveRetained')&&!Object.hasOwn(unknown,'spareStatus')],
 ['Warnings and procurement demand coexist',p.rows.length===1&&html.includes('交換需要・工作期限・予備保持の警告')&&html.includes('購入需要一覧')&&html.includes('交換需要あり・未成立')&&html.includes('搬入遅延・組替期限内成立せず')&&html.includes('2027-11-04')],
 ['No fabricated current reserve status',html.includes('実際の予備不足・現物状態は別途確認')&&p.rows.every(q=>q.spareStatus==='別途循環・現物確認')],
 ['Empty is not safe',empty.includes('安全確定ではありません')],
 ['Source input not changed',JSON.stringify(x)===before],
 ['No authorization',!r.writeAllowed&&!p.writeAllowed&&!p.operationAuthorized&&!p.notificationAuthorized]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
