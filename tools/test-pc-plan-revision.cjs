'use strict';
const {previewPcPlanRevision}=require('./pc-plan-revision.cjs');
const {fixture}=require('./test-pc-annual-sheet-export.cjs');
function selfTest(){
 const old=fixture();old.asOf='2027-11-06';const k=JSON.stringify(['successor','9','A']);
 old.procurementRecords=[{demandKey:k,state:'ordered',orderDate:'2027-06-01',orderReference:'anon-po',checkedOn:old.asOf,basis:'匿名購買照合',confirmedDeliveryDate:'2027-12-01'}];
 const clone=x=>JSON.parse(JSON.stringify(x)),next=clone(old);next.snapshotId='anon-next';next.sourceRevision='v2';next.asOf='2027-11-07';
 for(const c of next.circulations){c.snapshotId=next.snapshotId;c.sourceRevision=next.sourceRevision;}
 for(const e of next.actualEvents){e.snapshotId=next.snapshotId;e.sourceRevision=next.sourceRevision;}
 const d=next.circulations[0].result.stages[0].stage.dispositions[1];d.procurement.latestArrivalBy='2027-11-20';d.procurement.latestOrderBy='2027-05-20';
 const opts={changedMonth:'2027-12',archiveId:'submitted-v1'};
 const run=(n=next,o=opts,p=old)=>previewPcPlanRevision(p,n,o),r=run(),before=JSON.stringify(old),after=JSON.stringify(next);
 const bad=fn=>{const n=clone(next);fn(n);return run(n);};
 const has=(r,s)=>r.held.some(h=>h.reason.includes(s));
 const more=clone(next);more.asOf='2027-11-10';more.actualEvents.push({...more.actualEvents[0],rollId:'F',cycleId:'c9',date:'2027-11-09'});
 const oldReceived=clone(old);oldReceived.procurementRecords[0]={...oldReceived.procurementRecords[0],state:'received',actualArrivalDate:'2027-11-01'};
 const a=r.archive;
 return [
 ['New revision eligible for anonymous preview',r.eligibleForPreview&&!!r.nextPreview],
 ['Previous archive preserves complete input and report',a.archiveId==='submitted-v1'&&JSON.stringify(a.input)===before&&a.annual.ledger.entries.some(e=>e.status==='actual'&&e.date==='2027-11-05')&&!a.storageVerified],
 ['Forwarded date triggers delivery late warning',r.nextPreview.purchaseWarnings.rows[0].lateDays===11&&r.nextPreview.purchaseWarnings.rows[0].orderDate==='2027-06-01'],
 ['Removed actual blocks revision',has(bad(n=>n.actualEvents=[]),'確定実績の削除')],
 ['Changed actual date blocked',has(bad(n=>n.actualEvents[0].date='2027-11-04'),'確定実績の削除')],
 ['Changed original evidence blocked',has(bad(n=>n.actualEvents[0].basis='changed'),'確定実績の削除')],
 ['Late historical new actual requires review',has(bad(n=>n.actualEvents.push({...n.actualEvents[0],rollId:'F',cycleId:'c9',date:'2027-11-01'})),'過去実績追加')],
 ['New actual after cutoff accepted',run(more).eligibleForPreview],
 ['Removed actual order blocked',has(bad(n=>n.procurementRecords=[]),'発注・搬入実績の削除')],
 ['Changed order date blocked',has(bad(n=>n.procurementRecords[0].orderDate='2027-05-01'),'発注・搬入実績の削除')],
 ['Changed order reference blocked',has(bad(n=>n.procurementRecords[0].orderReference='changed'),'発注・搬入実績の削除')],
 ['Actual receipt rollback blocked',has(run(next,opts,oldReceived),'発注・搬入実績の削除')],
 ['Disappearing requirement held',has(bad(n=>n.circulations[0].result.stages[0].stage.dispositions.pop()),'旧購入需要消失')],
 ['Past month change held',has(run(next,{...opts,changedMonth:'2027-10'}),'過去月差替')],
 ['Same revision held',has(bad(n=>n.sourceRevision=old.sourceRevision),'新旧版識別')],
 ['Archive is independent and no write permission',a.input!==old&&a.input.actualEvents!==old.actualEvents&&JSON.stringify(old)===before&&JSON.stringify(next)===after&&!r.writeAllowed&&!r.operationAuthorized],
 ['Failed revision has no candidate',bad(n=>n.actualEvents=[]).nextPreview===null],
 ['Purchase accounting month remains unknown',r.nextPreview.annual.purchaseGuidance.every(p=>p.accountingMonth===null)]
 ];
}
module.exports={selfTest};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
