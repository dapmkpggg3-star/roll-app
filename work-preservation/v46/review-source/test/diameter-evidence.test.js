const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../js/preparation-forecast');
const criteria = () => [
    { id: 'common', scope: 'stand', targetId: 'example-stand', valueMm: 292, confirmed: true, confirmedOn: '2026-10-01', source: 'fixture common criterion' },
    { id: 'individual', scope: 'roll', targetId: 'example-roll', valueMm: 290, confirmed: true, confirmedOn: '2026-10-26', source: 'fixture individual confirmation' }
];
const input = () => ({ rollId: 'example-roll', standId: 'example-stand', asOf: '2026-10-26', criteria: criteria() });
const measured = () => ({ rollId: 'example-roll', valueMm: 295, measuredOn: '2026-10-26', currentCycleConfirmed: true, source: 'fixture measurement' });
test('confirmed individual criterion overrides common value for that individual only', () => {
    const i = input(), before = JSON.stringify(i);
    assert.equal(api.resolveDiameterCriterion(i).criterion.valueMm, 290);
    assert.equal(api.resolveDiameterCriterion({ ...i, rollId: 'other-roll' }).criterion.valueMm, 292);
    assert.equal(api.resolveDiameterCriterion({ ...i, rollId: 'other-roll', standId: 'other-stand' }).state, 'unknown');
    assert.equal(JSON.stringify(i), before);
});
test('unconfirmed, invalid and future individual rules cannot silently use common default', () => {
    for (const patch of [{ confirmed: false }, { valueMm: null }, { valueMm: '290' }, { valueMm: 0 },
        { source: '' }, { confirmedOn: '2026-10-27' }, { confirmedOn: '2026-02-30' }]) {
        const i = input(); Object.assign(i.criteria[1], patch);
        const r = api.resolveDiameterCriterion(i);
        assert.equal(r.state, 'unknown'); assert.equal(r.criterion.id, 'individual');
    }
});
test('duplicate applicable rules require resolution rather than choosing array order', () => {
    const i = input(); i.criteria.push({ ...i.criteria[1], id: 'conflicting', valueMm: 291 });
    assert.equal(api.resolveDiameterCriterion(i).state, 'unknown');
    i.criteria.reverse(); assert.equal(api.resolveDiameterCriterion(i).state, 'unknown');
});
test('missing IDs, criteria and unconfirmed common master remain unknown', () => {
    assert.equal(api.resolveDiameterCriterion({ ...input(), rollId: '' }).state, 'unknown');
    assert.equal(api.resolveDiameterCriterion({ ...input(), criteria: null }).state, 'unknown');
    const c = criteria().slice(0, 1); c[0].confirmed = false;
    assert.equal(api.resolveDiameterCriterion({ ...input(), criteria: c }).state, 'unknown');
});
test('recorded old diameter never becomes measured current-cycle margin', () => {
    const r = api.assessDiameterEvidence({ ...input(), measurement: { ...measured(), currentCycleConfirmed: false } });
    assert.equal(r.criterionState, 'resolved'); assert.equal(r.criterion.valueMm, 290);
    assert.equal(r.state, 'unknown'); assert.equal(r.currentDiameterMm, null); assert.equal(r.marginMm, null);
});
test('missing, other-roll and future measurements cannot approve diameter', () => {
    for (const patch of [{ rollId: 'other-roll' }, { valueMm: '' }, { valueMm: null }, { measuredOn: null },
        { measuredOn: '2026-10-27' }, { source: '' }]) {
        const r = api.assessDiameterEvidence({ ...input(), measurement: { ...measured(), ...patch } });
        assert.equal(r.state, 'unknown'); assert.equal(r.marginMm, null);
    }
});
test('valid measurement compares above, equal and below without deciding online readiness', () => {
    for (const [valueMm, state, margin] of [[295, 'above_limit', 5], [290, 'at_limit', 0], [289.9, 'below_limit', -0.1]]) {
        const r = api.assessDiameterEvidence({ ...input(), measurement: { ...measured(), valueMm } });
        assert.equal(r.state, state); assert.equal(r.marginMm, margin);
        assert.equal(r.readinessAssessed, false); assert.equal(r.criterion.source, 'fixture individual confirmation');
    }
});
