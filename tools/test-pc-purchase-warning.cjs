'use strict';
const {previewPcPurchaseWarnings,orderDeadline}=require('./pc-purchase-warning.cjs');
const {fixture}=require('./test-pc-annual-sheet-export.cjs');
function selfTest(){
 const x=fixture();x.asOf='2027-02-01';x.actualEvents=[];
 const p=x.circulations[0].result.stages[0].stage.dispositions[1];
 p.procurement.latestOrderBy='2027-05-20';p.procurement.latestArrivalBy='2027-11-20';
 const copy=v=>JSON.parse(JSON.stringify(v)),run=(v=x)=>previewPcPurchaseWarnings(v),row=v=>run(v).rows[0],k=row(x).demandKey;
 const record=(v,over={})=>({...v,procurementRecords:[{demandKey:k,state:'not-ordered',checkedOn:v.asOf,basis:'匿名購買照合',...over}]});
 const at=(date,settings)=>record({...copy(x),asOf:date,warningSettings:settings});
 const ordered=(v,over={})=>record(v,{state:'ordered',orderDate:'2027-02-01',orderReference:'anon-po',...over});
 const before=JSON.stringify(x),cases=[];
 const add=(n,ok)=>cases.push([n,!!ok]);
 add('Display demand on first forecast beyond 90 days',row(x).daysRemaining===108&&row(x).warnings.includes('期限目安：購入予定'));
 add('Unknown is not not-ordered',row(x).state==='発注状況未確認'&&!row(x).warnings.includes('未発注'));
 for(const [date,n,label] of [['2027-02-18',91,'購入予定'],['2027-02-19',90,'購入準備'],['2027-03-20',61,'購入準備'],['2027-03-21',60,'発注準備確認'],['2027-04-19',31,'発注準備確認'],['2027-04-20',30,'発注注意'],['2027-05-19',1,'発注注意'],['2027-05-20',0,'発注期限当日'],['2027-05-21',-1,'期限超過']]){
  const r=row(at(date));add('Boundary '+date,r.daysRemaining===n&&r.state==='未発注'&&r.warnings.includes(label));
 }
 add('Per stand warning override',row(at('2027-04-20',{days:[90,60,30],byStand:{9:[90,30,7]}})).warnings.includes('発注準備確認'));
 add('Invalid warning config not silently accepted',row(at('2027-04-20',{days:[30,60,90]})).warnings.includes('警告設定未確認'));
 add('No policy approval from settings',row(at('2027-04-20',{approved:true})).warningSettingsApproved===false);
 add('Past order not treated as missed',row(ordered(at('2027-05-21'))).warnings.includes('納期未回答')&&!row(ordered(at('2027-05-21'))).warnings.includes('期限超過'));
 add('Confirmed delivery late',row(ordered(at('2027-05-21'),{confirmedDeliveryDate:'2027-12-02'})).lateDays===12);
 add('Estimated delivery late is forecast',row(ordered(at('2027-05-21'),{estimatedDeliveryDate:'2027-12-02'})).estimateLateDays===12&&!row(ordered(at('2027-05-21'),{estimatedDeliveryDate:'2027-12-02'})).warnings.includes('確定納期遅延'));
 add('Required date passed, no receipt',row(ordered(at('2027-11-21'))).warnings.includes('必要搬入期限超過・未搬入'));
 add('Confirmed date passed, no receipt',row(ordered(at('2027-11-21'),{confirmedDeliveryDate:'2027-11-19'})).warnings.includes('確定納期超過・未搬入'));
 const received=row(ordered(at('2027-11-22'),{state:'received',actualArrivalDate:'2027-11-22'}));
 add('Actual receipt not assembled spare',received.actualLateDays===2&&received.spareStatus==='別途循環・現物確認'&&received.warnings.includes('組込・適合は別途確認'));
 add('Missing order reference held',row(ordered(at('2027-05-21'),{orderReference:null})).state==='発注状況未確認');
 add('Future order actual rejected',row(ordered(at('2027-05-21'),{orderDate:'2027-05-22'})).state==='発注状況未確認');
 add('Stale unplaced state unknown',row(record(at('2027-05-21'),{checkedOn:'2027-05-20'})).state==='発注状況未確認');
 const dup=copy(x);dup.circulations.push(copy(dup.circulations[0]));add('Duplicate forecast one warning row',run(dup).rows.length===1&&row(dup).evidence.length===2);
 const conf=copy(dup);conf.circulations[1].result.stages[0].stage.dispositions[1].procurement.latestOrderBy='2027-05-19';add('Conflicting demand kept, deadline held',run(conf).rows.length===1&&row(conf).deadline===null&&row(conf).warnings.includes('購入期限競合・要確認'));
 const g=copy(dup);g.circulations[1].result.stages[0].stage.dispositions[1].identity='["9","A","g3"]';add('Same physical predecessor different generation held',run(g).rows.length===1&&row(g).deadline===null);
 const r=ordered(at('2027-05-21'),{confirmedDeliveryDate:'2027-11-20'}),prev=row(r);r.circulations[0].result.stages[0].stage.dispositions[1].procurement.latestArrivalBy='2027-11-10';r.circulations[0].result.stages[0].stage.dispositions[1].procurement.latestOrderBy='2027-05-10';const now=row(r);
 add('Replan preserves actual order, recomputes delivery risk',prev.lateDays===0&&now.lateDays===10&&now.orderDate===prev.orderDate&&now.orderReference===prev.orderReference&&now.demandKey===prev.demandKey);
 const conflict=ordered(at('2027-05-21'));conflict.procurementRecords.push({...conflict.procurementRecords[0],orderReference:'other'});add('Procurement conflict stays unknown',row(conflict).state==='発注状況未確認');
 const unmatched=ordered(at('2027-05-21'));unmatched.circulations=[];add('Unmatched order history retained',run(unmatched).held.some(h=>h.reason==='購入需要未接続の購買履歴'&&h.records[0].orderReference==='anon-po'));
 const outside=copy(x);outside.fiscalYear=2029;add('Fiscal filter does not remove demand',run(outside).rows.length===1);
 add('Calendar month not 180 days',orderDeadline('2027-06-25',{unit:'months',value:6})==='2026-12-25'&&orderDeadline('2027-06-25',{unit:'days',value:180})==='2026-12-27');
 add('Leap and month end clamp',orderDeadline('2028-08-31',{unit:'months',value:6})==='2028-02-29'&&orderDeadline('2027-08-31',{unit:'months',value:6})==='2027-02-28');
 add('Invalid date and unit rejected',orderDeadline('2027-02-30',{unit:'months',value:6})===null&&orderDeadline('2027-05-20',{unit:'x',value:6})===null);
 add('No authorization or input mutation',JSON.stringify(x)===before&&!run(x).writeAllowed&&!run(x).operationAuthorized&&!run(x).notificationAuthorized);
 return cases;
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
