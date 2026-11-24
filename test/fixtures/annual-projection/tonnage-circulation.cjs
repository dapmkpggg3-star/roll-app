// Anonymous coarse annual tonnage projection only. Not a shift schedule or work instruction.
'use strict';
const validId=s=>typeof s==='string'&&s.trim()===s&&s.length>0;
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const nonnegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const copy=x=>JSON.parse(JSON.stringify(x));
const fixed=n=>Math.round(n*1000000)/1000000;
function meanCut(stand,records){
  const rows=Array.isArray(records)?records.filter(r=>r&&String(r.stand)===String(stand)):[];
  const counts=new Map();
  for(const r of rows)if(validId(r.rollId)&&validId(r.cycleId)){const k=JSON.stringify([r.rollId,r.cycleId]);counts.set(k,(counts.get(k)||0)+1);}
  const accepted=rows.filter(r=>validId(r.rollId)&&validId(r.cycleId)&&counts.get(JSON.stringify([r.rollId,r.cycleId]))===1&&r.status==='actual'&&r.kind==='rework'&&positive(r.before)&&positive(r.after)&&r.before>r.after&&validId(r.basis));
  const value=accepted.length?fixed(accepted.reduce((s,r)=>s+(r.before-r.after),0)/accepted.length):null;
  return {value,count:accepted.length,rejected:rows.length-accepted.length,basis:accepted.map(r=>({rollId:r.rollId,cycleId:r.cycleId,source:r.basis,cut:fixed(r.before-r.after)}))};
}
function finalState(diameter,scrap,cut){
  if(!positive(diameter)||!positive(scrap)||!positive(cut)||diameter<scrap)return 'unknown';
  const next=fixed(diameter-cut);
  // At equality the existing code and new rule differ. Conservatively flag final; do not authorize use at the boundary.
  return next<scrap?'final':next===scrap?'boundary':'rework';
}
function projectTonnage(input,buildHorizon){
  const stand=String(input.stand),issues=[],events=[],cut=meanCut(stand,input.history);
  const horizon=buildHorizon(input.startMonth,input.monthRecords);
  const rows=copy(input.roster||[]), replacements=copy(input.replacements||[]);
  const result=()=>({stand,horizon,cut,events,issues,roster:rows,complete:false,coverage:'coarse five-part forecast only'});
  if(!/^[2-5]$/.test(stand)||!positive(input.capacityTons)||!Number.isInteger(input.dispatchLag)||input.dispatchLag<0||!Number.isInteger(input.returnLag)||input.returnLag<1||!positive(cut.value)||rows.length!==3||new Set(rows.map(r=>r.id)).size!==3||rows.some(r=>!validId(r.id)||!positive(r.diameter)||!positive(r.scrap)||r.diameter<r.scrap)||rows.filter(r=>r.state==='online').length!==1||rows.filter(r=>r.state==='installed').length!==1||rows.filter(r=>r.state==='raw').length!==1){issues.push('opening inputs missing or invalid');return result();}
  let active=rows.find(r=>r.state==='online');
  if(!nonnegative(active.usedTons)||active.usedTons>input.capacityTons||!Number.isInteger(active.startBucket)||active.startBucket>0){issues.push('opening usage unknown');return result();}
  const allIds=new Set(rows.map(r=>r.id));
  if(replacements.some(r=>!validId(r.id)||allIds.has(r.id)||!positive(r.diameter)||!positive(r.scrap)||r.diameter<r.scrap||!Number.isInteger(r.readyBucket)||!validId(r.basis))||new Set(replacements.map(r=>r.id)).size!==replacements.length){issues.push('replacement input invalid');return result();}
  const labels=i=>i<0?{month:null,part:null,bucket:i}:i>=90?{month:null,part:null,bucket:i}:{month:horizon[Math.floor(i/5)].month,part:i%5+1,bucket:i};
  const emit=(kind,roll,bucket,extra={})=>events.push({stand,rollId:roll.id,kind,...labels(bucket),status:'forecast',...extra});
  const retired=[],usedReplacement=new Set(),demanded=new Set();
  function successor(roll){
    return replacements.find(r=>r.replacesId===roll.id&&!usedReplacement.has(r.id));
  }
  function demand(roll,bucket){
    const decision=finalState(roll.diameter,roll.scrap,cut.value);
    if(decision==='unknown'){issues.push('diameter decision unknown '+roll.id);return false;}
    if((decision==='final'||decision==='boundary')&&!demanded.has(roll.id)){
      demanded.add(roll.id);
      const n=successor(roll);
      emit('purchaseNeed',roll,bucket,{idealReadyBucket:roll.startBucket,successorId:n?.id??null,readyBucket:n?.readyBucket??null,idealMet:n? n.readyBucket<roll.startBucket:null,reason:decision==='boundary'?'conservative equality; confirmation required':'next average cut below approved diameter'});
      if(!n||n.readyBucket>=roll.startBucket)issues.push('early procurement not verified '+roll.id);
    }
    return true;
  }
  if(!demand(active,0))return result();
  let stopped=null,lastBucket=null;
  // Equal distribution is a coarse scenario, not a daily production plan.
  for(let bucket=0;bucket<90;bucket++){
    const m=horizon[Math.floor(bucket/5)];
    if(!nonnegative(m.tons)){issues.push('unknown production '+m.month);stopped=bucket;break;}
    for(const r of rows){
      if(r.state==='dispatchPending'&&r.dispatchAt<=bucket){r.state='rework';emit('dispatch',r,bucket);}
      if(r.state==='rework'&&r.returnAt<=bucket){r.diameter=fixed(r.diameter-cut.value);r.state='raw';emit('inbound',r,bucket,{diameter:r.diameter});}
    }
    let remaining=m.tons/5;
    // No fabricated work slots: boundaries are only coarse demand timing.
    let exchanges=0;
    while(active.usedTons+remaining>=input.capacityTons&&remaining>0){
      if(++exchanges>3){issues.push('too many exchanges in one forecast bucket');stopped=bucket;break;}
      const next=rows.find(r=>r.state==='installed'),raw=rows.find(r=>r.state==='raw');
      const decision=finalState(active.diameter,active.scrap,cut.value);
      if(!next||!raw||decision==='unknown'){issues.push('three-set readiness not verified '+active.id);stopped=bucket;break;}
      const leaving=active, isFinal=decision!=='rework', replacement=isFinal?successor(leaving):null;
      if(isFinal&&(!replacement||replacement.readyBucket>bucket)){issues.push('successor not ready '+leaving.id);stopped=bucket;break;}
      remaining=fixed(remaining-(input.capacityTons-leaving.usedTons));
      emit('useEnd',leaving,bucket,{diameter:leaving.diameter});
      next.state='online';next.usedTons=0;next.startBucket=bucket;active=next;
      emit('useStart',next,bucket,{diameter:next.diameter});
      if(next.neverUsed===true){emit('payout',next,bucket);next.neverUsed=false;}
      // This is a hypothetical coarse assembly opportunity, not a confirmed work slot.
      raw.state='installed';emit('assemblyCandidate',leaving,bucket,{counterpartId:raw.id,workSlot:'unconfirmed'});
      if(isFinal){
        emit('retire',leaving,bucket,{diameter:leaving.diameter});retired.push(leaving.id);usedReplacement.add(replacement.id);
        const index=rows.indexOf(leaving);
        rows[index]={id:replacement.id,diameter:replacement.diameter,scrap:replacement.scrap,state:'raw',neverUsed:true};
        emit('replacementJoin',rows[index],bucket,{replacesId:leaving.id});
      }else{
        leaving.state='dispatchPending';leaving.dispatchAt=bucket+input.dispatchLag;leaving.returnAt=leaving.dispatchAt+input.returnLag;
        if(input.dispatchLag===0){leaving.state='rework';emit('dispatch',leaving,bucket);}
      }
      if(!demand(active,bucket)){stopped=bucket;break;}
    }
    if(stopped!==null)break;
    active.usedTons=fixed(active.usedTons+remaining);
    lastBucket=bucket;
  }
  const totals={};
  for(const e of events){
    if(!e.month||!['inbound','payout','purchaseNeed'].includes(e.kind))continue;
    totals[e.month]??={inbound:0,payout:0,purchaseNeed:0};
    totals[e.month][e.kind]++;
  }
  return {...result(),retired,totals,lastBucket,stopped,scenarioComplete:lastBucket===89&&stopped===null,operationallyConfirmed:false};
}
function selfTest(buildHorizon){
 const hist=(rollId,cycleId,before,after,extra={})=>({stand:'2',rollId,cycleId,before,after,status:'actual',kind:'rework',basis:'anon history',...extra});
 const history=[hist('A','a',435,428),hist('B','b',440,434),hist('C','c',450,442)];
 const input={stand:'2',startMonth:'2027-04',capacityTons:14000,dispatchLag:1,returnLag:2,history,monthRecords:[],roster:[{id:'A',diameter:405,scrap:400,state:'online',usedTons:0,startBucket:-1},{id:'B',diameter:500,scrap:400,state:'installed'},{id:'C',diameter:500,scrap:400,state:'raw'}],replacements:[{id:'D',replacesId:'A',diameter:500,scrap:400,readyBucket:-2,basis:'anon planned successor'}]};
 const initial=JSON.stringify(input),r=projectTonnage(input,buildHorizon);
 const rev=projectTonnage({...input,monthRecords:[{month:'2027-04',source:'confirmed',tons:14000,d10:4900,d13:9100,basis:'anon revision'}]},buildHorizon);
 const no=projectTonnage({...input,replacements:[]},buildHorizon);
 const late=projectTonnage({...input,replacements:[{...input.replacements[0],readyBucket:20}]},buildHorizon);
 const get=(res,kind,id)=>res.events.find(e=>e.kind===kind&&(!id||id===e.rollId));
 const missing=projectTonnage({...input,history:[]},buildHorizon);
 return [
 ['three actual sets mean 7',meanCut('2',history).value===7&&meanCut('2',history).count===3],
 ['wrong stand excluded',meanCut('2',[...history,hist('X','x',500,400,{stand:'3'})]).value===7],
 ['forecast cut excluded',meanCut('2',[...history,hist('X','x',500,400,{status:'forecast'})]).value===7],
 ['duplicate cycle both excluded',meanCut('2',[...history,history[0]]).count===2],
 ['non-decreasing diameter excluded',meanCut('2',[...history,hist('X','x',400,401)]).count===3],
 ['missing history not zero',missing.cut.value===null&&missing.events.length===0],
 ['405 final under average',finalState(405,400,7)==='final'],
 ['equality marked conservative',finalState(407,400,7)==='boundary'],
 ['normal diameter rework',finalState(421,400,7)==='rework'],
 ['individual boundary',finalState(405,398,7)==='boundary'],
 ['purchase need before exit',get(r,'purchaseNeed','A')?.bucket===0&&get(r,'purchaseNeed','A')?.idealReadyBucket===-1&&get(r,'purchaseNeed','A')?.idealMet===true],
 ['no new rework for retired A',!get(r,'dispatch','A')&&!get(r,'inbound','A')&&get(r,'retire','A')?.diameter===405],
 ['replacement same slot',r.retired?.includes('A')&&r.roster.length===3&&!r.roster.some(x=>x.id==='A')&&r.roster.some(x=>x.id==='D')],
 ['missing replacement stops',no.stopped!==null&&!get(no,'retire','A')&&!no.scenarioComplete],
 ['late replacement stops',late.stopped!==null&&!get(late,'replacementJoin','D')],
 ['first use payout not arrival',get(r,'payout','D')?.bucket===get(r,'useStart','D')?.bucket&&get(r,'payout','D')?.bucket>get(r,'replacementJoin','D')?.bucket],
 ['payout one time',r.events.filter(e=>e.kind==='payout'&&e.rollId==='D').length===1],
 ['normal return later than dispatch',get(r,'inbound','B')?.bucket>get(r,'dispatch','B')?.bucket],
 ['90 five-part segments executed',r.scenarioComplete&&r.lastBucket===89],
 ['month revision advances exit',get(rev,'useEnd','A')?.bucket<get(r,'useEnd','A')?.bucket],
 ['month revision propagates downstream',get(rev,'inbound','B')?.bucket<get(r,'inbound','B')?.bucket],
 ['prior result unchanged',get(r,'useEnd','A')?.bucket===6],
 ['input unchanged',JSON.stringify(input)===initial],
 ['no day work claims',!r.operationallyConfirmed&&r.events.filter(e=>e.kind==='assemblyCandidate').every(e=>e.workSlot==='unconfirmed')],
 ['unverified month stops',projectTonnage({...input,monthRecords:[{month:'2027-04',source:'confirmed',tons:null,basis:'unknown'}]},buildHorizon).stopped===0]
 ];
}
if(typeof module!=='undefined')module.exports={meanCut,finalState,projectTonnage,selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const tests=selfTest(require('./transition-horizon.cjs').buildHorizon);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
