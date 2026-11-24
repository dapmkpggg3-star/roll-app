// Anonymous integration fixture. Never writes ledger, schedule, or actual records.
'use strict';
const dateOK=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const idOK=v=>typeof v==='string'&&v.length>0&&v.trim()===v;
const standOK=v=>/^(?:[2-9]|1[0-7])$/.test(String(v));
const clone=v=>JSON.parse(JSON.stringify(v));
function bridgeAnnualTransitions(input, simulate, evidenceBuilder) {
  const issues=[], events=[], stand=String(input.stand);
  const src=input.simulation||{}, roster=Array.isArray(src.resources)?src.resources:[];
  const ids=roster.map(r=>r.id);
  const result=()=>({issues,events,summary:evidenceBuilder(events),complete:false});
  if(!standOK(stand)||roster.length!==3||ids.some(x=>!idOK(x))||new Set(ids).size!==3||roster.filter(r=>r.frame==='online').length!==1||roster.some(r=>r.standKey!=null&&String(r.standKey)!==stand)){issues.push('three distinct same-stand rolls required');return result();}
  const start=input.opening;
  const online=roster.find(r=>r.frame==='online').id;
  if(!start||start.rollId!==online||!idOK(start.cycleId)||!dateOK(start.date)||!idOK(start.basis)||!dateOK(input.referenceAt)||start.date>input.referenceAt){issues.push('opening cycle unknown');return result();}
  const known=new Map(roster.map(r=>[r.id,r]));
  let active=online, cycle=start.cycleId, last=start.date;
  const ev=(rollId,cycleId,kind,date,status,basis,extra={})=>({stand,rollId,cycleId,kind,date,status,basis,...extra});
  events.push(ev(active,cycle,'useStart',start.date,'actual',start.basis));
  const simulation=simulate(clone(src));
  let transitions=0, invalid=false;
  const stop=simulation.stopRecord?.date;
  for(const e of simulation.events||[]){
    if(e.kind!=='ロール替')continue;
    if(!dateOK(e.date)||e.date<input.referenceAt||e.date<last||!known.has(e.onlineId)||e.onlineId===active||(stop&&e.date>=stop)){issues.push('unverified exchange transition');invalid=true;break;}
    events.push(ev(active,cycle,'useEnd',e.date,'forecast','existing simulator exchange: '+e.date));
    active=e.onlineId;cycle='forecast-'+e.date;last=e.date;
    const firsts=(input.newRolls||[]).filter(r=>r.rollId===active);
    const hadFirst=events.some(v=>v.rollId===active&&v.kind==='useStart');
    let firstUse=false;
    if(firsts.length&& !hadFirst){
      const n=firsts[0];
      if(firsts.length===1&&n.neverUsed===true&&dateOK(n.readyOn)&&n.readyOn<=e.date&&idOK(n.basis)&&known.get(active).frame==='installedSpare'){firstUse=true;}
      else issues.push('first use evidence unknown '+active);
    }
    events.push(ev(active,cycle,'useStart',e.date,'forecast','existing simulator exchange: '+e.date+(firstUse?'; '+firsts[0].basis:''),{firstUse}));
    transitions++;
  }
  if(stop)issues.push('simulation stopped '+stop);
  // Old simulator's inbound is emitted at assembly, and rework completion is not a dispatch record.
  // Never promote these strings to annual accounting events.
  const supplied=Array.isArray(input.lifecycle)?input.lifecycle:[];
  const byCycle=new Map();
  for(const e of supplied){
    if(!e||String(e.stand)!==stand||!known.has(e.rollId)||!idOK(e.cycleId)||!idOK(e.basis)||!dateOK(e.date)||!['actual','forecast'].includes(e.status)||!['assembly','dispatch','inbound'].includes(e.kind)){issues.push('invalid lifecycle evidence');continue;}
    const key=JSON.stringify([e.rollId,e.cycleId]);const list=byCycle.get(key)||[];list.push(e);byCycle.set(key,list);
  }
  for(const [key,list] of byCycle){
    const [rollId,cycleId]=JSON.parse(key);
    const end=events.find(e=>e.rollId===rollId&&e.cycleId===cycleId&&e.kind==='useEnd');
    const get=k=>list.filter(e=>e.kind===k);
    const [assembly,dispatch,inbound]=['assembly','dispatch','inbound'].map(k=>get(k)[0]);
    if(invalid||!end||!assembly||!dispatch||!inbound||list.length!==3||['assembly','dispatch','inbound'].some(k=>get(k).length!==1)||assembly.date<end.date||dispatch.date<assembly.date||inbound.date<dispatch.date||(stop&&inbound.date>=stop)){issues.push('lifecycle chain incomplete '+rollId);continue;}
    if(!known.has(assembly.counterpartId)||assembly.counterpartId===rollId||assembly.daytime!==true||assembly.disassemblyOn!==assembly.date||!dateOK(assembly.counterpartReadyOn)||assembly.counterpartReadyOn>assembly.date||assembly.counterpartReadyStatus!==assembly.status){issues.push('assembly evidence incomplete '+rollId);continue;}
    // All generated exchange transitions are predictions. Actual lifecycle cannot depend on one.
    if(list.some(e=>e.status!=='forecast')){issues.push('actual lifecycle needs actual opening and end records '+rollId);continue;}
    for(const e of [assembly,dispatch,inbound])events.push(ev(rollId,cycleId,e.kind,e.date,e.status,e.basis));
  }
  return {...result(),transitions,simulatedThrough:simulation.confirmedThrough||null,stopRecord:simulation.stopRecord||null};
}
function buildHorizon(startMonth,records) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth))throw new Error('invalid start month');
  const priorities=['actual','confirmed','annual'];
  const validTons=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const data=Array.isArray(records)?records:[];
  const months=[];
  const year=Number(startMonth.slice(0,4)),month=Number(startMonth.slice(5));
  for(let i=0;i<18;i++){
    const offset=month-1+i,k=String(year+Math.floor(offset/12)).padStart(4,'0')+'-'+String(offset%12+1).padStart(2,'0');
    const entries=data.filter(r=>r&&r.month===k);
    const chosen=priorities.find(p=>entries.some(r=>r.source===p));
    if(!entries.length){months.push({month:k,source:'provisional',tons:10000,d10:3500,d13:6500,basis:'approved provisional assumption'});continue;}
    const matches=entries.filter(r=>r.source===chosen);
    if(!chosen||matches.length!==1||!idOK(matches[0].basis)||!validTons(matches[0].tons)){months.push({month:k,source:'unknown',tons:null,d10:null,d13:null,basis:'missing or conflicting month record'});continue;}
    const r=matches[0];
    const split=validTons(r.d10)&&validTons(r.d13)&&Math.abs(r.d10+r.d13-r.tons)<1e-7;
    months.push({month:k,source:chosen,tons:r.tons,d10:split?r.d10:null,d13:split?r.d13:null,basis:r.basis});
  }
  return months;
}
function freezeSubmission(months) {return clone(months);}
function selfTest(simulate,evidenceBuilder){
  const day=(date,productionAmount,operatingHours)=>({date,productionAmount,operatingHours,shift1Team:'A',shift3Team:'',size:'D10'});
  const src={standKey:'10',maxRuns:8,reworkDays:1,scrapDiameter:400,adoptedCutMm:7,leadMonths:6,leadStatus:'provisional',workConfirmation:{date:'2027-04-02',period:'day',reservedHours:5,workType:'rollChange',requiredHours:5,people:1,continuous:'no',changeover:'yes',threeSet:'yes'},resources:[{id:'anon-A',standKey:'10',frame:'online',caliberId:'a',runs:7,diameter:421},{id:'anon-B',standKey:'10',frame:'installedSpare',caliberId:'b',runs:0,diameter:430},{id:'anon-C',standKey:'10',frame:'usedSpare',caliberId:'c',runs:0,diameter:421}],days:[day('2027-04-01',10,8),day('2027-04-02',0,0),day('2027-04-03',0,0)]};
  const input={stand:'10',referenceAt:'2027-04-01',opening:{rollId:'anon-A',cycleId:'opening-A',date:'2027-03-20',basis:'anonymous opening record'},simulation:src};
  const run=patch=>bridgeAnnualTransitions({...input,...patch},simulate,evidenceBuilder);
  const original=JSON.stringify(input);
  const r=run({});
  const item=(kind,date,extra={})=>({stand:'10',rollId:'anon-A',cycleId:'opening-A',status:'forecast',basis:'explicit anonymous projection',kind,date,...extra});
  const lifecycle=[item('assembly','2027-04-20',{counterpartId:'anon-C',daytime:true,disassemblyOn:'2027-04-20',counterpartReadyOn:'2027-04-19',counterpartReadyStatus:'forecast'}),item('dispatch','2027-04-28'),item('inbound','2027-05-20')];
  const newRolls=[{rollId:'anon-B',neverUsed:true,readyOn:'2027-03-31',basis:'anonymous never-used ledger'}];
  const ready=run({newRolls,lifecycle});
  const badAssembly=patch=>run({lifecycle:[{...lifecycle[0],...patch},...lifecycle.slice(1)]});
  const records=[{month:'2027-04',source:'annual',tons:11000,d10:4000,d13:7000,basis:'annual mock'},{month:'2027-05',source:'confirmed',tons:0,d10:0,d13:0,basis:'known shutdown'},{month:'2027-06',source:'annual',tons:12000,basis:'monthly total only'}];
  const h=buildHorizon('2027-04',records),fixed=freezeSubmission(h);
  const newer=buildHorizon('2027-04',[...records,{month:'2027-04',source:'confirmed',tons:12500,d10:4500,d13:8000,basis:'monthly revised mock'}]);
  return [
    ['real simulator transition old ID',r.events.some(e=>e.kind==='useEnd'&&e.rollId==='anon-A'&&e.date==='2027-04-02')],
    ['real simulator transition new ID',r.events.some(e=>e.kind==='useStart'&&e.rollId==='anon-B'&&e.date==='2027-04-02')],
    ['no invented inbound or payout',Object.keys(r.summary.months).length===0],
    ['explicit inbound counted only in May',ready.summary.months['2027-05']?.forecast.inbound===1&&ready.summary.months['2027-04']?.forecast.inbound===0],
    ['new payout on first use',ready.summary.months['2027-04']?.forecast.payout===1],
    ['new arrival after use not counted',Object.keys(run({newRolls:[{...newRolls[0],readyOn:'2027-04-03'}]}).summary.months).length===0],
    ['self counterpart rejected',Object.keys(badAssembly({counterpartId:'anon-A'}).summary.months).length===0],
    ['future counterpart rejected',Object.keys(badAssembly({counterpartReadyOn:'2027-04-21'}).summary.months).length===0],
    ['night assembly rejected',Object.keys(badAssembly({daytime:false}).summary.months).length===0],
    ['separate-day disassembly rejected',Object.keys(badAssembly({disassemblyOn:'2027-04-19'}).summary.months).length===0],
    ['duplicate lifecycle rejected',Object.keys(run({lifecycle:[...lifecycle,lifecycle[2]]}).summary.months).length===0],
    ['missing dispatch rejected',Object.keys(run({lifecycle:[lifecycle[0],lifecycle[2]]}).summary.months).length===0],
    ['actual cannot derive from forecast',Object.keys(run({lifecycle:lifecycle.map(e=>({...e,status:'actual'}))}).summary.months).length===0],
    ['missing opening rejected',run({opening:null}).events.length===0],
    ['wrong stand roster rejected',run({simulation:{...src,resources:src.resources.map((r,i)=>i===0?{...r,standKey:'11'}:r)}}).events.length===0],
    ['input unchanged',JSON.stringify(input)===original],
    ['18 months',h.length===18&&h[17].month==='2028-09'],
    ['confirmed zero preserved',h[1].tons===0&&h[1].source==='confirmed'],
    ['annual data priority',h[0].tons===11000&&h[0].source==='annual'],
    ['missing size split stays unknown',h[2].d10===null&&h[2].d13===null],
    ['missing month provisional',h[3].tons===10000&&h[3].d10===3500&&h[3].d13===6500],
    ['revision selects confirmed',newer[0].tons===12500&&newer[0].source==='confirmed'],
    ['other confirmed month unchanged',newer[1].tons===0],
    ['fixed copy unchanged',fixed[0].tons===11000],
    ['conflicting rows blocked',buildHorizon('2027-04',[records[0],records[0]])[0].source==='unknown'],
    ['missing ton record not provisional',buildHorizon('2027-04',[{...records[0],tons:null}])[0].tons===null],
    ['coverage not asserted',r.complete===false&&ready.complete===false]
  ];
}
if(typeof module!=='undefined')module.exports={bridgeAnnualTransitions,buildHorizon,freezeSubmission,selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const code=fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8');
  const ctx=vm.createContext({});vm.runInContext(code,ctx);
  const results=selfTest(ctx.simulateExchangeCycle,require('./evidence.cjs').buildEvidence);
  for(const [name,ok] of results)console.log((ok?'PASS ':'FAIL ')+name);
  if(results.some(x=>!x[1]))process.exitCode=1;
}
