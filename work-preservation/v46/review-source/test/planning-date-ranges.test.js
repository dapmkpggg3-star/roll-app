const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../js/planning-date-ranges');
const asOf = '2026-10-26';
const month = (year,month) => ({ year, month, day:null });
const day = (year,month,day) => ({ year,month,day });
const job = () => ({ recordType:'plan', certainty:'reference', needed:month(2027,11),
    rollReady:month(2027,9), donorReleased:day(2027,8,31), assemblyDays:2, bufferDays:7, durationBasis:'calendar_days' });
test('month-only cells retain precision and no adopted exact date, including leap years', () => {
    for (const [year,m,last] of [[2027,7,31],[2027,9,30],[2028,2,29],[2027,2,28]]) {
        const r = api.parseCalendarParts({year,month:m,day:''});
        assert.equal(r.state,'known'); assert.equal(r.precision,'month'); assert.equal(r.date,null);
        assert.equal(r.latest,`${year}-${String(m).padStart(2,'0')}-${last}`);
        assert.equal(r.raw.day,'');
    }
});
test('exact date preserves exactness and input numeric strings are accepted without mutation', () => {
    const input = {year:'2027',month:' 09 ',day:'03'};
    const r = api.parseCalendarParts(input);
    assert.equal(r.precision,'day'); assert.equal(r.date,'2027-09-03');
    assert.equal(r.earliest,r.latest); assert.equal(input.month,' 09 ');
});
test('blank, malformed, shorthand year and invalid day never default to first of month', () => {
    for (const p of [{year:null,month:9},{year:2027,month:null},{}]) assert.equal(api.parseCalendarParts(p).state,'unknown');
    for (const p of [{year:27,month:9},{year:2027,month:13},{year:2027,month:9,day:0},
        {year:2027,month:2,day:29},{year:2027,month:9,day:'#VALUE!'},{year:2027,month:9,day:1.5}]) {
        const r = api.parseCalendarParts(p); assert.equal(r.state,'invalid'); assert.equal(r.date,null);
        assert.equal(r.earliest,null);
    }
});
test('future month timing uses worst case for readiness and earliest need for buffer', () => {
    const source = job(), before = JSON.stringify(source);
    const r = api.assessCalendarPreparation(source,asOf);
    assert.deepEqual(r.readyRange,{earliest:'2027-09-03',latest:'2027-10-02'});
    assert.deepEqual(r.startDeadlineRange,{earliest:'2027-10-23',latest:'2027-11-21'});
    assert.equal(r.state,'within_supplied_ranges'); assert.equal(r.readinessAssessed,false);
    assert.equal(r.inputs.needed.date,null); assert.equal(JSON.stringify(source),before);
});
test('return and need in same month require dates; not silently ready on first day', () => {
    const r = api.assessCalendarPreparation({...job(),needed:month(2027,9)},asOf);
    assert.equal(r.state,'needs_date_confirmation'); assert.equal(r.readinessAssessed,false);
});
test('known late prerequisite is visible despite unknown durations and chock release', () => {
    const r = api.assessCalendarPreparation({...job(),rollReady:month(2027,12),assemblyDays:null,donorReleased:null},asOf);
    assert.equal(r.state,'late_for_all_dates'); assert.equal(r.readyRange,null); assert.equal(r.startDeadlineRange,null);
    assert.ok(r.missing.includes('組替所要日数')); assert.ok(r.timingIssues.some(i=>i.field==='rollReady'));
});
test('missing duration is not zero and working-day counts are not calendar days', () => {
    for (const patch of [{assemblyDays:null},{assemblyDays:''},{bufferDays:null},{durationBasis:'working_days'},{durationBasis:null}]) {
        const r = api.assessCalendarPreparation({...job(),...patch},asOf);
        assert.equal(r.state,'unknown'); assert.equal(r.startDeadlineRange,null);
    }
    assert.equal(api.assessCalendarPreparation({...job(),assemblyDays:0,bufferDays:0},asOf).state,'within_supplied_ranges');
});
test('exact dates distinguish missed buffer from missed need and respect not-before constraints', () => {
    const base = {...job(),needed:day(2027,11,10),rollReady:day(2027,11,5)};
    assert.equal(api.assessCalendarPreparation(base,asOf).state,'buffer_not_assured');
    assert.equal(api.assessCalendarPreparation({...base,assemblyNotBefore:day(2027,11,11)},asOf).state,'late_for_all_dates');
    const r = api.assessCalendarPreparation({...base,assemblyNotBefore:{}},asOf);
    assert.equal(r.state,'unknown'); assert.equal(r.readyRange,null);
});
test('preparation inside horizon is retained when use starts after the twelve-month horizon', () => {
    const r = api.assessCalendarPreparation(job(),asOf);
    assert.equal(r.through,'2027-10-26'); assert.equal(r.windowRelations.needed,'after');
    assert.equal(r.windowRelations.rollReady,'inside'); assert.equal(r.inputs.needed.raw.month,11);
    assert.equal(api.windowRelation(api.parseCalendarParts(month(2027,10)),asOf),'overlaps_boundary');
});
test('actuals cannot be smuggled into month-level plans; tentative and reference remain labelled', () => {
    for (const patch of [{recordType:'actual'},{certainty:undefined},{completedOn:'2026-10-26'},{completionReflected:true}]) {
        assert.throws(()=>api.assessCalendarPreparation({...job(),...patch},asOf));
    }
    for (const certainty of ['reference','tentative','confirmed']) {
        const r = api.assessCalendarPreparation({...job(),certainty},asOf);
        assert.equal(r.certainty,certainty); assert.equal(r.scope,'calendar-timing-only');
    }
});
