const test = require('node:test');
const assert = require('node:assert/strict');
const { assessReservations } = require('../js/rotation-reservations');
const asOf = '2026-10-26';
const row = (id, patch = {}) => ({ id, planItemId: 'plan-' + id, standId: '14', kind: 'roll', resourceId: 'fixture-roll-A',
    from: '2026-11-01', through: '2026-11-10', certainty: 'confirmed', ...patch });
const check = reservations => assessReservations({ asOf, reservations });
test('same roll cannot be silently reserved by two confirmed plans', () => {
    const result = check([row('a'), row('b', { from: '2026-11-05' })]);
    assert.equal(result.state, 'conflict'); assert.equal(result.conflicts[0].from, '2026-11-05');
    assert.deepEqual(result.conflicts[0].planItemIds, ['plan-a', 'plan-b']);
});
test('one explicitly identified chock used across stands is checked without assuming compatibility', () => {
    const result = check([row('a', { kind: 'chock', resourceId: 'fixture-chock-1' }),
        row('b', { kind: 'chock', resourceId: 'fixture-chock-1', standId: '15' })]);
    assert.deepEqual(result.conflicts[0].standIds, ['14', '15']); assert.equal(result.state, 'conflict');
});
test('shared boundary date requires shift/time review, not an invented same-day release', () => {
    const result = check([row('a'), row('b', { from: '2026-11-10', through: '2026-11-20' })]);
    assert.equal(result.state, 'needs_review'); assert.equal(result.conflicts[0].kind, 'same_day_review');
});
test('tentative demand remains a warning and is not issued as confirmed demand', () => {
    const result = check([row('a'), row('b', { certainty: 'tentative' })]);
    assert.equal(result.state, 'needs_review'); assert.equal(result.conflicts[0].bothConfirmed, false);
    assert.equal(result.conflicts[0].kind, 'unconfirmed_overlap');
});
test('missing identity, date or certainty never becomes a favourable empty result', () => {
    for (const patch of [{ resourceId: null }, { from: '' }, { through: null }, { through: '2026-10-30' }, { certainty: '' }]) {
        const result = check([row('a', patch)]); assert.equal(result.state, 'needs_review'); assert.equal(result.issues.length, 1);
    }
    assert.equal(check([]).state, 'needs_review'); assert.throws(() => check(null), /未取得/);
});
test('distinct resources and nonoverlapping reservations are only a supplied-data check, not a stock guarantee', () => {
    const result = check([row('a'), row('b', { from: '2026-11-11', through: '2026-11-20' }),
        row('c', { resourceId: 'fixture-roll-C' }), row('d', { kind: 'chock' })]);
    assert.equal(result.state, 'no_overlap_in_supplied_data'); assert.equal(result.conflicts.length, 0);
    assert.equal(result.scope, 'reservation-overlap-only'); assert.match(result.limitation, /3セット維持/);
});
test('continuing reservations from before the baseline are included, outside-window records are excluded', () => {
    const result = check([row('a', { from: '2026-09-01' }), row('b'),
        row('old', { from: '2026-09-01', through: '2026-09-30' }),
        row('later', { from: '2028-01-01', through: '2028-02-01' })]);
    assert.equal(result.inWindow, 2); assert.equal(result.conflicts.length, 1);
    assert.equal(result.through, '2027-10-26');
});
test('nested periods and reordered input preserve conflict identities and never mutate source', () => {
    const rows = [row('a', { through: '2027-01-31' }), row('b'), row('c', { from: '2026-12-01', through: '2026-12-10' })];
    const before = structuredClone(rows), first = check(rows), second = check([...rows].reverse());
    assert.deepEqual(rows, before); assert.deepEqual(first.conflicts, second.conflicts); assert.equal(first.conflicts.length, 2);
});
test('duplicate reservations stop the check instead of creating double alerts', () => {
    assert.throws(() => check([row('a'), row('a')]), /重複/);
});
