const test = require('node:test');
const assert = require('node:assert/strict');
const {adaptUsageOpening: adapt,assessMachiningEvidence: machining} = require('../js/forecast-evidence');
const {summarizePlan} = require('../js/planning-usage');
const context = {rollId:'roll-test',cycleId:'cycle-test',asOf:'2026-10-29'};
const fact = { ...context,id:'fact-test',source:'fixture:record',recordType:'actual',confirmed:true,confirmedOn:'2026-10-29' };
function usage() {return {...context,plan:{calibers:[{id:'caliber-test',rollId:context.rollId,cycleId:context.cycleId,maxRuns:6,openingUsedRuns:0}],
    periods:[{id:'plan-test',recordType:'plan',certainty:'reference',quantityKind:'incremental',caliberIds:['caliber-test'],runs:2}]},
    actuals:[{...fact,caliberId:'caliber-test',quantityKind:'cumulative',runs:3}]};}
function history() {return {...context,measurement:{...fact,id:'measurement-test',measuredOn:'2026-10-28',valueMm:310},
    review:{...fact,id:'review-test',historyComplete:true,reviewedThrough:'2026-10-29',measurementId:'measurement-test',flatAdjustmentState:'completed',
        events:[{...fact,id:'event-test',kind:'flat_adjustment',completedOn:'2026-10-27',includedInMeasurement:true}]}};}
test('only bound actual cumulative usage becomes opening; plan quantity remains a plan',()=>{
    const i=usage(), before=JSON.stringify(i), a=adapt(i), r=summarizePlan(a.plan);
    assert.equal(a.usageKnown,true); assert.equal(a.readinessAssessed,false);
    assert.equal(r.calibers[0].openingUsedRuns,3); assert.equal(r.calibers[0].projectedUsedRuns,5);
    assert.equal(a.plan.periods[0].certainty,'reference'); assert.equal(JSON.stringify(i),before);
});
test('unbound plan opening is erased; other rolls/cycles/calibers never fill it',()=>{
    for(const patch of [{rollId:'other'},{cycleId:'old'},{caliberId:'other'}]){
        const i=usage();Object.assign(i.actuals[0],patch);const a=adapt(i);
        assert.equal(a.usageKnown,false);assert.equal(a.plan.calibers[0].openingUsedRuns,null);
    }
    const i=usage();i.cycleId=null;assert.equal(adapt(i).usageKnown,false);
});
test('planned, stale, future, unconfirmed or unsupported cumulative evidence stays unknown',()=>{
    for(const patch of [{recordType:'plan'},{asOf:'2026-10-28'},{confirmedOn:'2026-10-30'},
        {confirmedOn:'2026-10-28'},{confirmed:false},{source:''},{quantityKind:'incremental'}]){
        const i=usage();Object.assign(i.actuals[0],patch);assert.equal(adapt(i).usageKnown,false);
    }
});
test('explicit zero is retained; absent and malformed usage never becomes zero',()=>{
    const i=usage();i.actuals[0].runs=0;assert.equal(adapt(i).plan.calibers[0].openingUsedRuns,0);
    for(const value of [null,undefined,'',false,'0',-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]){
        i.actuals[0].runs=value;assert.equal(adapt(i).usageKnown,false);
    }
});
test('duplicate actual snapshots are not resolved by order; cumulative is not reset on reuse',()=>{
    const i=usage();i.actuals.push({...i.actuals[0],id:'other',runs:4});assert.equal(adapt(i).usageKnown,false);
    i.actuals.pop();i.actuals[0].runs=7;assert.equal(summarizePlan(adapt(i).plan).calibers[0].usageStatus,'exceeded');
});
test('plan identity and evidence IDs cannot be silently reused for another caliber',()=>{
    const i=usage();i.plan.calibers[0].cycleId='reference-only';assert.equal(adapt(i).usageKnown,false);
    const j=usage();j.actuals.push({...j.actuals[0],caliberId:'other'});assert.equal(adapt(j).usageKnown,false);
});
test('machining review binds actual events to the same cycle and subsequent measurement',()=>{
    const i=history(),before=JSON.stringify(i),r=machining(i);
    assert.equal(r.machiningHistoryChecked,true);assert.equal(r.readinessAssessed,false);
    assert.equal(r.additionalPastLossMm,null);assert.equal(JSON.stringify(i),before);
});
test('missing, stale, wrong-cycle and unconfirmed review cannot assert history checked',()=>{
    for(const patch of [{historyComplete:false},{cycleId:'old'},{reviewedThrough:'2026-10-28'},
        {confirmed:false},{source:''},{recordType:'plan'},{measurementId:'other'},{events:[]}]){
        const i=history();Object.assign(i.review,patch);assert.equal(machining(i).machiningHistoryChecked,false);
    }
    assert.equal(machining(context).machiningHistoryChecked,false);
});
test('future or earlier measurement and unreflected machining do not prove present diameter',()=>{
    for(const patch of [{completedOn:'2026-10-30'},{completedOn:'2026-10-29'},
        {cycleId:'old'},{recordType:'plan'},{includedInMeasurement:false},{kind:'unknown'}]){
        const i=history();Object.assign(i.review.events[0],patch);assert.equal(machining(i).machiningHistoryChecked,false);
    }
});
test('flat status must match actual history and duplicate events do not count twice',()=>{
    const i=history();i.review.flatAdjustmentState='pending';assert.equal(machining(i).state,'unknown');
    i.review.flatAdjustmentState='completed';i.review.events.push({...i.review.events[0]});assert.equal(machining(i).state,'unknown');
    i.review.events=[{...i.review.events[0],kind:'normal'}];i.review.flatAdjustmentState='pending';
    assert.equal(machining(i).state,'resolved'); // History known; pending machining is NOT preparation approval.
});
