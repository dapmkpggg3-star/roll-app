const test = require('node:test');
const assert = require('node:assert/strict');
const { assessSameDayAssembly: assess } = require('../js/preparation-forecast');
const today = '2026-10-26';
const job = () => ({ workDate:today, nightProduction:'operating' });
test('night-operation requirement is due on the same day, never plus one calendar day', () => {
    const r = assess(job(),today);
    assert.equal(r.dueOn,today); assert.equal(r.state,'due_today');
    assert.equal(r.requirement,'required_for_night_operation'); assert.equal(r.deadlineTime,null);
    assert.equal(r.assemblyCompletionVerified,false); assert.equal(r.readinessAssessed,false);
});
test('a future assembly is planned, not automatically completed or ready', () => {
    const r = assess({...job(),workDate:'2026-10-27'},today);
    assert.equal(r.state,'planned'); assert.equal(r.dueOn,'2026-10-27'); assert.equal(r.sameDayMet,null);
});
test('night shutdown preserves usual same-day target without inventing an allowed extension', () => {
    const r = assess({...job(),nightProduction:'stopped'},today);
    assert.equal(r.requirement,'same_day_target'); assert.equal(r.dueOn,today); assert.equal(r.state,'due_today');
});
test('unknown night production never becomes shutdown, including truthy invalid values', () => {
    for (const nightProduction of [undefined,null,'',true,'unknown']) {
        const r = assess({...job(),nightProduction},today);
        assert.equal(r.state,'night_schedule_unknown'); assert.equal(r.requirement,'night_schedule_unknown');
        assert.equal(r.needsAttention,true);
    }
});
test('acknowledgement and unreflected completion never hide a missed-day review', () => {
    for (const patch of [{acknowledged:true},{completedOn:today,completionReflected:false}]) {
        const r = assess({...job(),...patch},'2026-10-27');
        assert.equal(r.state,'overdue_unconfirmed'); assert.equal(r.needsAttention,true);
        assert.equal(r.assemblyCompletionVerified,false);
    }
    assert.equal(assess({...job(),completedOn:today,completionReflected:false},today).state,'pending_confirmation');
});
test('verified same-day completion resolves this review without changing online status or usage', () => {
    const source = {...job(),completedOn:today,completionReflected:true,status:'組込完了'};
    const before = JSON.stringify(source), r = assess(source,today);
    assert.equal(r.state,'completed_same_day'); assert.equal(r.sameDayMet,true); assert.equal(r.needsAttention,false);
    assert.equal(r.readinessAssessed,false); assert.equal(JSON.stringify(source),before);
});
test('late completion remains reviewable instead of erasing the missed same-day requirement', () => {
    const r = assess({...job(),completedOn:'2026-10-27',completionReflected:true},'2026-10-27');
    assert.equal(r.state,'completed_late'); assert.equal(r.assemblyCompletionVerified,true);
    assert.equal(r.sameDayMet,false); assert.equal(r.needsAttention,true);
});
test('missing date, future actual and contradictory earlier completion cannot be accepted', () => {
    for (const patch of [{workDate:null},{workDate:'2026-02-30'},
        {completedOn:'2026-10-27',completionReflected:true},
        {completedOn:'2026-10-25',completionReflected:true},{completionReflected:true}]) {
        const r = assess({...job(),...patch},today);
        assert.equal(r.state,'unknown'); assert.equal(r.needsAttention,true);
    }
});
test('same-day completion does not dispose of a separate unknown night schedule', () => {
    const r = assess({...job(),nightProduction:null,completedOn:today,completionReflected:true},today);
    assert.equal(r.sameDayMet,true); assert.equal(r.assemblyCompletionVerified,true);
    assert.equal(r.state,'night_schedule_unknown'); assert.equal(r.needsAttention,true);
});
