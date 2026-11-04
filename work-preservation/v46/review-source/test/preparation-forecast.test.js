const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../js/preparation-forecast');
const asOf = '2026-10-24';
const job = () => ({ id: 'cycle-1', rollId: 'C', donorId: 'A', neededOn: '2026-12-01',
    rollReadyOn: '2026-10-20', donorReleasedOn: '2026-10-20', assemblyDays: 2, bufferDays: 7,
    diameterChecked: true, usageKnown: true, calibersChecked: true, donorCompatible: true,
    machiningHistoryChecked: true });
test('preparation deadline precedes shortage day and includes explicit buffer', () => {
    const r = api.assessPreparation(job(), asOf);
    assert.equal(r.readyOn, '2026-10-26'); assert.equal(r.deadline, '2026-11-22');
    assert.equal(r.preparationDueOn, '2026-11-24'); assert.equal(r.state, 'feasible');
});
test('late regrinding, earlier demand and unavailable chock each expose shortage', () => {
    for (const patch of [{ rollReadyOn: '2026-12-06' }, { neededOn: '2026-10-25' }, { donorReleasedOn: '2026-12-02' }]) {
        assert.equal(api.assessPreparation({ ...job(), ...patch }, asOf).state, 'shortage');
    }
});
test('missing, blank, numeric-string and negative durations never default', () => {
    for (const value of [undefined, null, '', '2', -1, NaN]) {
        const r = api.assessPreparation({ ...job(), assemblyDays: value }, asOf);
        assert.equal(r.state, 'unknown'); assert.equal(r.deadline, null);
    }
    assert.equal(api.assessPreparation({ ...job(), assemblyDays: 0 }, asOf).state, 'feasible');
});
test('missing usage, caliber, diameter and chock knowledge block favourable result', () => {
    for (const key of ['usageKnown', 'calibersChecked', 'diameterChecked', 'donorCompatible', 'donorReleasedOn']) {
        assert.equal(api.assessPreparation({ ...job(), [key]: null }, asOf).state, 'unknown');
    }
});
test('confirmed preparation completion never changes roll status or usage', () => {
    const source = { ...job(), completedOn: asOf, completionReflected: true, status: '組替可能' };
    const r = api.assessPreparation(source, asOf);
    assert.equal(r.readyOn, asOf); assert.equal(r.status, '組替可能');
    assert.equal(source.status, '組替可能'); assert.equal(source.useStartDate, undefined);
});
test('impossible dates and future actuals are not accepted', () => {
    for (const patch of [{ neededOn: '2026-02-30' }, { completedOn: '2026-10-25' }, { assemblyNotBefore: '' }]) {
        assert.equal(api.assessPreparation({ ...job(), ...patch }, asOf).state, 'unknown');
    }
});
test('late cycle blocks dependent rotation; no independent green later cycles', () => {
    const result = api.assessWindow({ asOf, coverageThrough: '2027-10-24', jobs: [
        { ...job(), rollReadyOn: '2026-12-06' },
        { ...job(), id: 'cycle-2', neededOn: '2027-02-01', dependsOn: ['cycle-1'] }
    ] });
    assert.deepEqual(result.rows.map(r => r.state), ['shortage', 'blocked']);
    assert.equal(result.rows[1].readyOn, null);
});
test('no jobs or incomplete twelve-month coverage cannot be green', () => {
    assert.equal(api.assessWindow({ asOf, coverageThrough: '2027-10-24', jobs: [] }).state, 'unknown');
    assert.equal(api.assessWindow({ asOf, coverageThrough: '2027-06-01', jobs: [job()] }).state, 'unknown');
    assert.equal(api.horizonEnd('2028-02-29'), '2029-02-28');
});
test('read, partial completion, failed save and partial reflection do not hide tasks', () => {
    const task = { id: 'task-1', requirements: [{ done: true }], reflection: 'verified' };
    assert.equal(api.taskState({ ...task, requirements: [{ done: false }], acknowledged: true }), 'open');
    assert.equal(api.taskState({ ...task, requirements: [{ done: true }, { done: false }] }), 'open');
    for (const reflection of ['checking', 'error', 'partial', undefined]) {
        assert.equal(api.taskState({ ...task, reflection }), 'pending_confirmation');
    }
    assert.equal(api.taskState({ ...task, unresolvedAlert: true }), 'open');
    assert.equal(api.taskState({ ...task, requirements: [] }), 'open');
});
test('resolved tasks move to completed, recur under same id and match visible count', () => {
    const source = [{ id: 'assembly-1', requirements: [{ done: true }], reflection: 'verified' }];
    const complete = api.partitionTasks(source);
    assert.equal(complete.count, 0); assert.equal(complete.completed.length, 1);
    const recurring = api.partitionTasks([{ ...source[0], unresolvedAlert: true }]);
    assert.equal(recurring.count, recurring.active.length); assert.equal(recurring.count, 1);
    assert.equal(recurring.active[0].id, 'assembly-1');
    assert.equal(source[0].unresolvedAlert, undefined);
});
test('known late return stays a shortage even with unknown usage and assembly duration', () => {
    const source = { ...job(), rollReadyOn: '2026-12-06', usageKnown: null, assemblyDays: null };
    const r = api.assessPreparation(source, asOf);
    assert.equal(r.state, 'shortage'); assert.equal(r.timingState, 'shortage');
    assert.equal(r.readyOn, null); assert.equal(r.deadline, null);
    assert.ok(r.missing.includes('使用量')); assert.ok(r.missing.includes('組替所要日数'));
    assert.deepEqual(r.timingIssues.map(i => i.field), ['rollReadyOn']);
    assert.equal(r.timingIssues[0].availableOn, '2026-12-06');
    assert.equal(source.assemblyDays, null);
});
test('late chock or scheduled start remains visible while roll-ready date is unknown', () => {
    for (const key of ['donorReleasedOn', 'assemblyNotBefore']) {
        const r = api.assessPreparation({ ...job(), rollReadyOn: null, [key]: '2026-12-02' }, asOf);
        assert.equal(r.state, 'shortage'); assert.equal(r.readyOn, null);
        assert.ok(r.timingIssues.some(i => i.field === key));
    }
});
test('assembly duration can prove shortage without hiding unchecked caliber conditions', () => {
    const r = api.assessPreparation({ ...job(), rollReadyOn: '2026-11-30', calibersChecked: null }, asOf);
    assert.equal(r.state, 'shortage'); assert.equal(r.readyOn, null);
    assert.ok(r.missing.includes('残カリバ・使用条件'));
    assert.ok(r.timingIssues.some(i => i.field === 'projectedReadyOn' && i.availableOn === '2026-12-02'));
});
test('timing feasibility alone cannot approve unknown usage; known tightness is retained', () => {
    for (const [rollReadyOn, expected] of [['2026-11-01', 'feasible'], ['2026-11-24', 'tight']]) {
        const r = api.assessPreparation({ ...job(), rollReadyOn, usageKnown: null }, asOf);
        assert.equal(r.state, 'unknown'); assert.equal(r.timingState, expected);
        assert.equal(r.readyOn, null); assert.equal(r.deadline, '2026-11-22');
    }
});
test('unverified completion never falls back to a fresh optimistic assembly forecast', () => {
    for (const completionReflected of [false, undefined, 'true']) {
        const r = api.assessPreparation({ ...job(), completedOn: asOf, completionReflected }, asOf);
        assert.equal(r.state, 'unknown'); assert.equal(r.timingState, 'unknown');
        assert.equal(r.readyOn, null); assert.ok(r.missing.includes('組替完了の反映確認'));
    }
    const resolved = api.assessPreparation({ ...job(), completedOn: asOf, completionReflected: true }, asOf);
    assert.equal(resolved.state, 'feasible'); assert.equal(resolved.readyOn, asOf);
    const noActual = api.assessPreparation({ ...job(), completionReflected: true }, asOf);
    assert.equal(noActual.state, 'unknown'); assert.equal(noActual.readyOn, null);
});
test('contradictory and future actuals do not expose a usable ready date', () => {
    for (const patch of [{ rollReadyOn: '2026-12-06' }, { donorReleasedOn: '2026-10-25' },
        { assemblyNotBefore: '2026-10-25' }, { completedOn: '2026-10-25' }]) {
        const r = api.assessPreparation({ ...job(), completedOn: asOf, completionReflected: true, ...patch }, asOf);
        assert.equal(r.state, 'unknown'); assert.equal(r.readyOn, null); assert.equal(r.timingState, 'unknown');
    }
});
test('year-window review retains shortage and blocks later cycle despite other missing facts', () => {
    const r = api.assessWindow({ asOf, coverageThrough: '2027-10-24', jobs: [
        { ...job(), rollReadyOn: '2026-12-06', usageKnown: null },
        { ...job(), id: 'cycle-2', neededOn: '2027-02-01', dependsOn: ['cycle-1'] }
    ] });
    assert.equal(r.state, 'shortage');
    assert.deepEqual(r.rows.map(row => row.state), ['shortage', 'blocked']);
    assert.ok(r.rows[0].missing.includes('使用量'));
    assert.deepEqual(r.rows[1].blockedBy, ['cycle-1']);
});

test('unchecked machining history cannot be replaced by a positive diameter check', () => {
    for (const value of [undefined, null, false, 'true', 1]) {
        const r = api.assessPreparation({ ...job(), machiningHistoryChecked: value }, asOf);
        assert.equal(r.state, 'unknown'); assert.equal(r.readyOn, null);
        assert.ok(r.missing.includes('加工履歴・今回サイクルとの対応'));
    }
    const late = api.assessPreparation({ ...job(), machiningHistoryChecked: false, rollReadyOn:'2026-12-06' }, asOf);
    assert.equal(late.state, 'shortage');
});
test('dependency uncertainty never hides a separately established shortage', () => {
    const r = api.assessWindow({ asOf, coverageThrough:'2027-10-24', jobs:[
        { ...job(), usageKnown:false },
        { ...job(), id:'cycle-2', neededOn:'2027-02-01', rollReadyOn:'2027-02-03', dependsOn:['cycle-1'] },
        { ...job(), id:'cycle-3', neededOn:'2027-04-01', dependsOn:['cycle-2'] }
    ] });
    assert.equal(r.state,'shortage');
    assert.deepEqual(r.rows.map(row=>row.state),['unknown','shortage','blocked']);
    assert.deepEqual(r.rows[1].blockedBy,['cycle-1']);
    assert.ok(r.rows[1].timingIssues.length > 0);
    assert.equal(r.rows[1].readyOn,null);
});
test('unrepresentable date arithmetic remains unknown instead of throwing or claiming readiness', () => {
    for (const assemblyDays of [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER, 100000000]) {
        const r = api.assessPreparation({ ...job(), assemblyDays }, asOf);
        assert.equal(r.state,'unknown'); assert.equal(r.readyOn,null);
        assert.doesNotMatch(r.reason,/間に合う見込み/);
    }
    assert.equal(api.addDays(asOf,Number.MAX_SAFE_INTEGER),null);
});
test('window result explicitly limits its claim to supplied preparation jobs', () => {
    const r = api.assessWindow({asOf,coverageThrough:'2027-10-24',jobs:[job()]});
    assert.equal(r.state,'feasible');
    assert.equal(r.scope,'supplied-preparation-jobs-only');
    assert.equal(r.annualReadiness,'not_assessed');
});
