// Anonymous annual report adapter. Counts forecast sets, never physical rolls or actual costs.
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const validId=x=>typeof x==='string'&&x.trim()===x&&x.length>0;
const standKeys=Array.from({length:16},(_,i)=>String(i+2));
const knownTonnage=new Set(['2','3','4','5']);
function annualReport(input,buildHorizon,projectTonnage){
  if(!input||!/^20\d{2}-04$/.test(input.fiscalStart)||!validId(input.revision))throw new Error('fiscal start or revision missing');
  const monthRecords=Array.isArray(input.monthRecords)?input.monthRecords:[];
  // Only explicitly completed monthly actuals may replace a full-month plan.
  const excludedPartial=monthRecords.filter(r=>r&&r.source==='actual'&&r.monthComplete!==true);
  const records=monthRecords.filter(r=>r&&!(r.source==='actual'&&r.monthComplete!==true));
  const months=buildHorizon(input.fiscalStart,records);
  const inputs=Array.isArray(input.stands)?input.stands:[];
  const report={revision:input.revision,fiscalStart:input.fiscalStart,scenario:'anonymous coarse forecast; not an operating instruction',months,rows:[],detail:[],purchaseNeeds:[],warnings:[],complete:false};
  for(const r of excludedPartial)report.warnings.push({month:r.month,reason:'partial actual excluded from full-month total'});
  const allIds=new Map();
  for(const r of inputs)for(const obj of [...(Array.isArray(r.roster)?r.roster:[]),...(Array.isArray(r.replacements)?r.replacements:[])]){
    if(!validId(obj.id))continue;const a=allIds.get(obj.id)||[];a.push(String(r.stand));allIds.set(obj.id,a);
  }
  for(const stand of standKeys){
    const configs=inputs.filter(r=>String(r.stand)===stand);
    const row={stand,status:'held',reason:'',coverageThrough:null,monthly:months.map(m=>({month:m.month,inbound:null,payout:null,purchase:null,amount:null,knownInbound:[],knownPayout:[]})),meanCut:null};
    report.rows.push(row);
    if(configs.length!==1){row.reason=configs.length?'duplicate stand inputs':'stand inputs not supplied';continue;}
    const c=configs[0];
    if(!knownTonnage.has(stand)){row.reason=Number(stand)<=9?'tonnage plus linked caliber cycle not integrated':'size/caliber and paired or east-west rules not integrated';continue;}
    const ids=[...(Array.isArray(c.roster)?c.roster:[]),...(Array.isArray(c.replacements)?c.replacements:[])].map(r=>r.id);
    if(ids.some(id=>!validId(id)||(allIds.get(id)||[]).length!==1)){row.reason='ambiguous roll identity';continue;}
    const targets=(c.replacements||[]).map(r=>r.replacesId);
    if(targets.some(id=>!validId(id)||!ids.includes(id))||new Set(targets).size!==targets.length||(c.replacements||[]).some(r=>r.id===r.replacesId)){row.reason='ambiguous successor mapping';continue;}
    let p;
    try{p=projectTonnage({...copy(c),stand,startMonth:input.fiscalStart,monthRecords:copy(records)},buildHorizon);}
    catch(e){row.reason='projection input invalid';continue;}
    row.meanCut=p.cut||null;row.status=p.scenarioComplete?'scenario':'partial';row.reason=(p.issues||[]).join('; ')||'hypothetical five-part distribution and work opportunities';
    row.coverageThrough=Number.isInteger(p.lastBucket)?p.lastBucket:null;
    for(const e of p.events||[]){
      if(e.stand!==stand||e.status!=='forecast'||!validId(e.rollId))continue;
      const detailed={...copy(e),sourceRevision:input.revision,meanCut:row.meanCut?.value??null,coverage:'coarse scenario; work slot unconfirmed'};
      report.detail.push(detailed);
      if(e.kind==='purchaseNeed'){report.purchaseNeeds.push({...detailed,orderMonth:null,accountingMonth:null,reason:e.reason});continue;}
      const m=row.monthly.find(m=>m.month===e.month);
      if(!m)continue;
      if(e.kind==='inbound')m.knownInbound.push(e.rollId);
      if(e.kind==='payout')m.knownPayout.push(e.rollId);
    }
    for(let i=0;i<row.monthly.length;i++){
      const m=row.monthly[i];
      if(row.coverageThrough!==null&&row.coverageThrough>=(i+1)*5-1){
        m.inbound=m.knownInbound.length;m.payout=m.knownPayout.length;
      }
    }
    for(const warning of p.issues||[])report.warnings.push({stand,reason:warning});
  }
  // The full report stays incomplete; never infer an all-stand zero or money amount from partial coverage.
  report.fiscalRows=report.rows.map(r=>({...r,monthly:r.monthly.slice(0,12)}));
  report.totals=months.slice(0,12).map((m,i)=>({month:m.month,knownInbound:report.rows.reduce((s,r)=>s+r.monthly[i].knownInbound.length,0),knownPayout:report.rows.reduce((s,r)=>s+r.monthly[i].knownPayout.length,0),complete:false,amount:null}));
  return report;
}
function submittedCopy(report){return copy(report);}
function selfTest(buildHorizon,projectTonnage){
 const hist=(stand,id,before,after)=>({stand,rollId:id,cycleId:'cycle-'+id,before,after,status:'actual',kind:'rework',basis:'anon history'});
 function fixture(stand,capacityTons=14000){
   const a='anon-'+stand+'-A',b='anon-'+stand+'-B',c='anon-'+stand+'-C',d='anon-'+stand+'-D';
   return {stand,capacityTons,dispatchLag:1,returnLag:2,history:[hist(stand,a,435,428),hist(stand,b,440,434),hist(stand,c,450,442)],roster:[{id:a,diameter:405,scrap:400,state:'online',usedTons:0,startBucket:-1},{id:b,diameter:500,scrap:400,state:'installed'},{id:c,diameter:500,scrap:400,state:'raw'}],replacements:[{id:d,replacesId:a,diameter:500,scrap:400,readyBucket:-2,basis:'anon successor'}]};
 }
 const x={fiscalStart:'2027-04',revision:'anon-v1',monthRecords:[],stands:[fixture('2'),fixture('3',12000),fixture('4',12000),fixture('5',12000),fixture('6'),fixture('10'),fixture('17')]};
 const run=p=>annualReport({...x,...p},buildHorizon,projectTonnage);
 const original=JSON.stringify(x),r=run({}),row=(p,s)=>p.rows.find(r=>r.stand===s),fixed=submittedCopy(r);
 const revised=run({revision:'anon-v2',monthRecords:[{month:'2027-04',source:'confirmed',tons:14000,d10:4900,d13:9100,basis:'anon revision'}]});
 const partial=run({monthRecords:[{month:'2027-04',source:'confirmed',tons:10000,d10:3500,d13:6500,basis:'plan'},{month:'2027-04',source:'actual',tons:5000,d10:1750,d13:3250,basis:'midmonth',monthComplete:false}]});
 const stopped=run({stands:[{...fixture('2'),replacements:[]},fixture('3')]});
 const bad=fixture('2');bad.replacements.push({...bad.replacements[0],id:'anon-alt'});
 const cross=fixture('3');cross.roster[0].id=x.stands[0].roster[0].id;
 return [
 ['all 16 stands represented',r.rows.length===16&&r.rows[0].stand==='2'&&r.rows[15].stand==='17'],
 ['four tonnage scenarios run',r.rows.filter(r=>r.status==='scenario').length===4],
 ['6-9 not invented',row(r,'6').status==='held'&&row(r,'6').monthly.every(m=>m.inbound===null)],
 ['10-17 not invented',row(r,'17').status==='held'&&row(r,'17').monthly.every(m=>m.payout===null)],
 ['no data stand held',row(r,'7').reason==='stand inputs not supplied'],
 ['18-month horizon and 12-month fiscal form',r.months.length===18&&r.fiscalRows.every(r=>r.monthly.length===12)],
 ['separate sets by stand',r.detail.every(e=>e.rollId.startsWith('anon-'+e.stand+'-'))],
 ['inbound counted by return month',row(r,'2').monthly.find(m=>m.month==='2027-07').inbound===1],
 ['first payout month',row(r,'2').monthly.find(m=>m.month==='2027-08').knownPayout.includes('anon-2-D')],
 ['purchase demand not order or accounting',r.purchaseNeeds.length===4&&r.purchaseNeeds.every(e=>e.orderMonth===null&&e.accountingMonth===null)],
 ['cost unavailable not zero',r.totals.every(m=>m.amount===null&&!m.complete)],
 ['partial actual does not replace plan',partial.months[0].tons===10000&&partial.warnings.some(w=>w.reason.includes('partial actual'))],
 ['completed actual preferred',run({monthRecords:[{month:'2027-04',source:'actual',tons:9000,d10:3000,d13:6000,basis:'closed',monthComplete:true}]}).months[0].tons===9000],
 ['monthly revision changes dates',r.detail.find(e=>e.stand==='2'&&e.kind==='useEnd').month!==revised.detail.find(e=>e.stand==='2'&&e.kind==='useEnd').month],
 ['fixed report unchanged',fixed.revision==='anon-v1'&&fixed.months[0].tons===10000&&revised.months[0].tons===14000],
 ['stopped stand not zero beyond coverage',row(stopped,'2').monthly[5].inbound===null],
 ['another stand still calculated',row(stopped,'3').status==='scenario'],
 ['ambiguous replacement rejected',row(run({stands:[bad]}),'2').status==='held'],
 ['cross-stand duplicate identity rejected',row(run({stands:[x.stands[0],cross]}),'2').status==='held'],
 ['duplicate stand rejected',row(run({stands:[x.stands[0],x.stands[0]]}),'2').status==='held'],
 ['input unchanged',JSON.stringify(x)===original],
 ['no complete operational assertion',r.complete===false]
 ];
}
if(typeof module!=='undefined')module.exports={annualReport,submittedCopy,selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const tests=selfTest(require('./transition-horizon.cjs').buildHorizon,require('./tonnage-circulation.cjs').projectTonnage);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
