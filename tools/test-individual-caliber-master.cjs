'use strict';
function selfTest(m,api){
 const rev='anon-rev',snap='anon-snapshot',grade='SD295';
 const layout=(stand,rollId,totalCalibers,generation='g1')=>({stand,rollId,generation,totalCalibers,confirmed:true,sourceRevision:rev,basis:'anonymous layout',calibers:Array.from({length:totalCalibers},(_,i)=>({number:i+1,column:i<totalCalibers/2?'西':'東',size:i% (totalCalibers/2)<3?'D13':'D10',grades:[grade],basis:'anonymous groove',centerMm:100+(i%(totalCalibers/2))*10+(i>=totalCalibers/2?300:0),datumId:'common',positionVerified:true,positionBasis:'anonymous position'})),pairs:[]});
 const a=layout(17,'A',22),b=layout(17,'B',18),c=layout(15,'C',22),d=layout(16,'D',12);
 const online=x=>({stand:x.stand,rollId:x.rollId,generation:x.generation,status:'online',snapshotId:snap,sourceRevision:rev,basis:'anonymous online'});
 const usages=x=>x.calibers.map(g=>({stand:x.stand,rollId:x.rollId,generation:x.generation,number:g.number,runs:x===a&&g.number===1?5:x===a&&g.number===2?4:x===b&&g.number===1?2:0,available:true,basis:'anonymous usage',snapshotId:snap,sourceRevision:rev}));
 const base={anonymousOnly:true,snapshotId:snap,sourceRevision:rev,basis:'anonymous selection',size:'D13',grade,steelGrade:grade,onlineRows:[online(a),online(c),online(d)],masterRows:[a,b,c,d],usageRows:[...usages(a),...usages(b),...usages(c),...usages(d)],selection:{15:[1],16:[1],17:[1]},foldEvidence:[{confirmed:true,snapshotId:snap,sourceRevision:rev,size:'D13',grade,fromIdentity:JSON.stringify(['15','C','g1',1]),toIdentity:JSON.stringify(['16','D','g1',1]),basis:'anonymous fold'}]};
 const resolve=x=>m.resolveOnlineCaliberMaster(x,17),gate=x=>m.previewMasterPassline1517(x);
 const sw={...base,onlineRows:[online(b),online(c),online(d)]};
 const mutate=(x,id,fn)=>({...x,masterRows:x.masterRows.map(r=>r.rollId===id?fn(JSON.parse(JSON.stringify(r))):r)});
 const date=n=>'2027-04-'+String(n).padStart(2,'0');
 const row=(n,t)=>({date:date(n),size:'D13',steelGrade:grade,productionAmount:t,productionByTeam:{A:t,B:0},shift1Team:'A',shift3Team:'',operatingHours:t?8:0,recordKind:'plan',exchangeCapacity:t?null:1,exchangeCapacityBasis:t?null:'anonymous count'});
 const stage=(i,n,r,workType='caliberChange')=>({id:'stage'+i,stands:[17],size:'D13',standPass:'pass',inventoryBasis:'anonymous inventory',basis:'anonymous forecast',workType,selection:{15:[1],16:[1],17:[n]},members:[{standKey:'17',rollId:'A',generation:'g1',usageBasis:'anonymous usage',remainingBasis:'anonymous remaining',nextCaliberAvailable:workType==='caliberChange',activeCalibers:[{id:String(n),runs:r,column:'西',available:true,steelGrade:grade,compatibilityBasis:'anonymous checked'}]}]});
 const slot=(n,i)=>({id:'s'+n,date:date(n),team:'常昼',startMinute:480,endMinute:960,lineStopped:true,basis:'anonymous stop',eligibility:[{demandId:'stage'+i,basis:'anonymous eligibility',preparationReady:true,reserveReady:true,pairReady:true,additionalReady:true,safetyBlocked:false}]});
 const campaign={...base,referenceDate:date(1),throughDate:date(6),sourceBasis:'anonymous schedule',dateRowsVerified:true,days:[row(1,405),row(2,0),row(3,405),row(4,405),row(5,0),row(6,405)],stages:[stage(1,1,5),stage(2,2,4),stage(3,3,0,'rollChange')],slots:[slot(2,1),slot(5,2)]};
 const run=x=>m.previewMasterLinkedCampaign(x,api);
 const r=run(campaign);
 const before=JSON.stringify(base);
 const tests=[
 ['22 grooves resolved',resolve(base).totalCalibers===22],
 ['online swap 18 grooves resolved',resolve(sw).totalCalibers===18],
 ['usage from new identity only',resolve(sw).calibers[0].runs===2&&resolve(base).calibers[0].runs===5],
 ['unknown online does not default',resolve({...base,onlineRows:base.onlineRows.slice(1)}).totalCalibers===null],
 ['duplicate online held',resolve({...base,onlineRows:[...base.onlineRows,online(b)]}).status==='unconfirmed'],
 ['unknown generation held',resolve({...base,onlineRows:[{...online(a),generation:'g2'},online(c),online(d)]}).status==='unconfirmed'],
 ['wrong declared count held',resolve(mutate(base,'A',m=>({...m,totalCalibers:18}))).status==='unconfirmed'],
 ['duplicate number held',resolve(mutate(base,'A',m=>{m.calibers[1].number=1;return m})).status==='unconfirmed'],
 ['duplicate master held',resolve({...base,masterRows:[...base.masterRows,a]}).status==='unconfirmed'],
 ['missing usage unknown not zero',resolve({...base,usageRows:base.usageRows.filter(u=>!(u.rollId==='A'&&u.number===1))}).calibers[0].runs===null],
 ['stale usage unknown',resolve({...base,usageRows:base.usageRows.map(u=>u.rollId==='A'&&u.number===1?{...u,snapshotId:'old'}:u)}).calibers[0].runs===null],
 ['duplicate usage held',resolve({...base,usageRows:[...base.usageRows,base.usageRows[0]]}).status==='unconfirmed'],
 ['unknown selected groove blocked',gate({...sw,selection:{...sw.selection,17:[22]}}).status==='unconfirmed'],
 ['position from master checked',gate(base).status==='planning-match'],
 ['position difference over limit',gate(mutate(base,'A',m=>{m.calibers[0].centerMm=141;return m})).status==='incompatible'],
 ['missing master position held',gate(mutate(base,'A',m=>{m.calibers[0].centerMm=null;return m})).status==='unconfirmed'],
 ['grade restriction enforced',gate(mutate(base,'A',m=>{m.calibers[0].grades=['SD345'];return m})).status==='unconfirmed'],
 ['campaign two exchanges gated',r.complete&&r.events.length===2&&r.passlineResults.length===3],
 ['candidate mismatched usage held',!run({...campaign,stages:[stage(1,1,0),...campaign.stages.slice(1)]}).complete],
 ['later incompatible retains demand',(()=>{const x=run(mutate(campaign,'A',m=>{m.calibers[1].centerMm=141;return m}));return x.events.length===0&&x.unresolved[0]?.requiredExchange===true;})()],
 ['unchanged adjacent stand required',!run({...campaign,stages:[campaign.stages[0],{...campaign.stages[1],selection:{15:[1],16:[2],17:[2]}},campaign.stages[2]]}).complete],
 ['no operation permission',!r.operationAuthorized&&!r.writeAllowed],
 ['input unchanged',JSON.stringify(base)===before]
 ];
 const different=mutate(base,'A',m=>{for(const n of [4,15])m.calibers[n-1].size='D13';return m});
 const x=resolve(base),y=resolve(different);
 tests.push(['same total different size mix',x.totalCalibers===22&&y.totalCalibers===22&&x.sizeCounts.D10.total===16&&y.sizeCounts.D10.total===14&&x.sizeCounts.D13.total===6&&y.sizeCounts.D13.total===8]);
 tests.push(['east west counts from layout',y.sizeCounts.D13.west===4&&y.sizeCounts.D13.east===4]);
 tests.push(['shares from physical counts',Math.abs(y.sizeCounts.D13.share-8/22)<1e-12]);
 tests.push(['declared inconsistent count held',resolve(mutate(base,'A',m=>({...m,sizeCounts:{D10:12,D13:10}}))).status==='unconfirmed']);
 tests.push(['declared correct count accepted',resolve(mutate(base,'A',m=>({...m,sizeCounts:{D10:16,D13:6}}))).status==='resolved']);
 tests.push(['grade count separate from total',resolve(mutate(base,'A',m=>{m.calibers[3].grades=['SD345'];return m})).sizeCounts.D10.gradeCounts.SD295===15]);
 tests.push(['different online size mix recalculated',resolve(sw).sizeCounts.D10.total===12&&resolve(sw).sizeCounts.D13.total===6]);
 return {tests,result:r};
}
module.exports={selfTest};
if(require.main===module){
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/operating-plan.js'),'utf8'),ctx);
 const {tests}=selfTest(require('./individual-caliber-master.cjs'),ctx);
 for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
