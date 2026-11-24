// Anonymous-only annual forecast evidence prototype. No ledger or UI writes.
'use strict';
function buildEvidence(events) {
  if (!Array.isArray(events)) throw new Error('events required');
  const kinds = ['useStart','useEnd','assembly','dispatch','inbound','retire','replacementReady'];
  const rank = Object.fromEntries(kinds.map((k,i)=>[k,i]));
  const rows = new Map(), months = {}, issues = [], seen = new Set();
  const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T00:00:00Z')) && new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const valid = [];
  for (const e of events) {
    if (!e || typeof e.rollId !== 'string' || !e.rollId.trim() || typeof e.cycleId !== 'string' || !e.cycleId.trim() || !isDate(e.date) || !kinds.includes(e.kind) || !['actual','forecast'].includes(e.status) || !String(e.basis||'').trim() || !/^([2-9]|1[0-7])$/.test(String(e.stand))) { issues.push('invalid event'); continue; }
    if (e.firstUse === true && e.kind !== 'useStart') { issues.push('invalid first use'); continue; }
    valid.push({...e,stand:String(e.stand)});
  }
  valid.sort((a,b)=>a.date.localeCompare(b.date)||rank[a.kind]-rank[b.kind]);
  for (const e of valid) {
    const key=JSON.stringify([e.stand,e.rollId,e.cycleId]);
    let row=rows.get(key);
    if(!row){row={stand:e.stand,rollId:e.rollId,cycleId:e.cycleId,events:{},invalid:false};rows.set(key,row);}
    if(row.events[e.kind]){row.invalid=true;issues.push('duplicate event '+key+' '+e.kind);continue;}
    row.events[e.kind]={date:e.date,status:e.status,basis:e.basis,firstUse:e.firstUse===true};
  }
  function bump(e,field){
    const month=e.date.slice(0,7), key=e.status;
    months[month] ||= {actual:{inbound:0,payout:0},forecast:{inbound:0,payout:0}};
    months[month][key][field]++;
  }
  for(const row of rows.values()){
    const e=row.events;
    const chain=['useStart','useEnd','assembly','dispatch','inbound'].map(k=>e[k]).filter(Boolean);
    if(chain.some((v,i)=>i&&v.date<chain[i-1].date) || (e.retire && e.useEnd && e.retire.date<e.useEnd.date) || (e.retire && (e.dispatch||e.inbound))){row.invalid=true;issues.push('inconsistent sequence '+row.rollId);}
    if(e.inbound && !e.dispatch){row.invalid=true;issues.push('inbound without dispatch '+row.rollId);}
    if(e.dispatch && !e.assembly){row.invalid=true;issues.push('dispatch without assembly '+row.rollId);}
    if(e.inbound && e.inbound.status==='actual' && e.dispatch?.status!=='actual'){row.invalid=true;issues.push('actual inbound without actual dispatch '+row.rollId);}
    if(e.firstUse){row.invalid=true;issues.push('invalid firstUse');}
    if(e.useStart?.firstUse){
      const k=JSON.stringify([row.stand,row.rollId]);if(seen.has(k)){row.invalid=true;issues.push('duplicate first use '+row.rollId);}seen.add(k);
    }
  }
  // Reject all duplicate first-use rows, not just the second.
  const firsts=new Map();
  for(const row of rows.values())if(row.events.useStart?.firstUse){const k=JSON.stringify([row.stand,row.rollId]);const a=firsts.get(k)||[];a.push(row);firsts.set(k,a);}
  for(const a of firsts.values())if(a.length>1)for(const row of a)row.invalid=true;
  for(const row of rows.values()){
    if(row.invalid)continue;
    if(row.events.inbound)bump(row.events.inbound,'inbound');
    if(row.events.useStart?.firstUse)bump(row.events.useStart,'payout');
  }
  return {rows:[...rows.values()],months,issues,complete:false};
}
function selfTest(){
  const e=(kind,date,extra={})=>({stand:'2',rollId:'anon-A',cycleId:'cycle-1',status:'forecast',basis:'anonymous fixture',kind,date,...extra});
  const base=[e('useStart','2027-04-01'),e('useEnd','2027-04-29'),e('assembly','2027-05-03'),e('dispatch','2027-05-10'),e('inbound','2027-06-01')];
  const fresh=e('useStart','2027-07-01',{rollId:'anon-D',firstUse:true});
  const original=JSON.stringify(base);
  const r=buildEvidence([...base,fresh]);
  const tests=[
    ['inbound month not dispatch month',r.months['2027-06']?.forecast.inbound===1&&!r.months['2027-05']],
    ['payout first use month',r.months['2027-07']?.forecast.payout===1],
    ['original untouched',JSON.stringify(base)===original],
    ['actual separated',buildEvidence(base.map(x=>({...x,status:'actual'}))).months['2027-06']?.actual.inbound===1],
    ['missing dispatch blocked',buildEvidence(base.filter(x=>x.kind!=='dispatch')).issues.length>0],
    ['missing assembly blocked',buildEvidence(base.filter(x=>x.kind!=='assembly')).issues.length>0],
    ['backwards dates blocked',!buildEvidence(base.map(x=>x.kind==='inbound'?{...x,date:'2027-05-01'}:x)).months['2027-05']],
    ['invalid calendar date blocked',buildEvidence([e('useStart','2027-02-30')]).issues.length===1],
    ['duplicate inbound blocked',!buildEvidence([...base,base[4]]).months['2027-06']],
    ['duplicate payout both blocked',Object.keys(buildEvidence([fresh,{...fresh,cycleId:'cycle-2'}]).months).length===0],
    ['retired roll no rework',Object.keys(buildEvidence([e('useStart','2027-04-01'),e('useEnd','2027-05-01'),e('retire','2027-05-01')]).months).length===0],
    ['retire and rework conflict',buildEvidence([...base,e('retire','2027-05-01')]).issues.length>0],
    ['no inferred zero or full coverage',buildEvidence([]).complete===false&&Object.keys(buildEvidence([]).months).length===0],
    ['forecast cannot supply actual dispatch',buildEvidence(base.map(x=>x.kind==='inbound'?{...x,status:'actual'}:x)).issues.length>0],
    ['replacement ready not payout',Object.keys(buildEvidence([e('replacementReady','2027-04-01')]).months).length===0]
  ];
  return tests;
}
if(typeof module!=='undefined')module.exports={buildEvidence,selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
  const tests=selfTest();for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
  if(tests.some(x=>!x[1]))process.exitCode=1;
}
