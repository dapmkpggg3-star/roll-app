const test = require('node:test');
const assert = require('node:assert/strict');
const safety = require('../js/online-safety');

function role(id, name, status, active = true, extra = {}) {
    return { id, name, status, isActiveThreeSet: active, nextAssemblyPlanned: false, ...extra };
}

test('online count and three-set diagnosis stay separate', () => {
    const missing = safety.diagnoseStandOnlineState([role(1, '#2-1', '改削中')], '2');
    assert.equal(missing.onlineState, 'missing');

    const duplicate = safety.diagnoseStandOnlineState([
        role(1, '#2-1', 'オンライン'),
        role(2, '#2-2', 'オンライン')
    ], '2');
    assert.equal(duplicate.onlineState, 'duplicate');

    const outside = safety.diagnoseStandOnlineState([
        role(1, '#2-1', 'オンライン', false),
        role(2, '#2-2', '改削中', true)
    ], '2');
    assert.equal(outside.onlineCount, 1);
    assert.equal(outside.onlineState, 'normal');
    assert.equal(outside.threeSetOnlineState, 'outside');
    assert.equal(outside.threeSetOnlineLabel, 'オンラインが運用3セット対象外');
});

test('automatic replacement updates both roles atomically without mutating input', () => {
    const before = [
        role(1, '#2-11', 'オンライン', true, {
            useStartDate: '2026-07-01',
            useEndDate: ''
        }),
        role(2, '#2-12', '新品予備（組込完了）', true, {
            nextAssemblyPlanned: true,
            useStartDate: '2026-02-01',
            useEndDate: '2026-03-01'
        })
    ];

    const prepared = safety.prepareAutomaticOnlineAssignment(before, {
        newRoleId: 2,
        newRoleName: '#2-12',
        oldStatus: '中古予備（バラシ前）',
        useEndDate: '2026-08-08',
        useStartDate: '2026-08-09',
        updatedAt: '2026-08-08T12:00:00.000Z'
    });

    assert.equal(prepared.oldRole.status, '中古予備（バラシ前）');
    assert.equal(prepared.oldRole.isActiveThreeSet, true);
    assert.equal(prepared.oldRole.useStartDate, '2026-07-01');
    assert.equal(prepared.oldRole.useEndDate, '2026-08-08');
    assert.equal(prepared.newRole.status, 'オンライン');
    assert.equal(prepared.newRole.isActiveThreeSet, true);
    assert.equal(prepared.newRole.nextAssemblyPlanned, false);
    assert.equal(prepared.newRole.useStartDate, '2026-08-09');
    assert.equal(prepared.newRole.useEndDate, '');
    assert.equal(prepared.diagnosis.onlineCount, 1);
    assert.equal(before[0].status, 'オンライン');
    assert.equal(before[1].status, '新品予備（組込完了）');
});

test('missing online is repaired without selecting another role', () => {
    const prepared = safety.prepareAutomaticOnlineAssignment([
        role(2, '#2-12', '新品予備（組込完了）', false, {
            useStartDate: '2026-02-01',
            useEndDate: '2026-03-01'
        })
    ], {
        newRoleId: 2,
        newRoleName: '#2-12',
        useStartDate: '2026-08-08',
        useEndDate: '2026-08-08',
        updatedAt: '2026-08-08T12:00:00.000Z'
    });

    assert.equal(prepared.oldRole, null);
    assert.equal(prepared.newRole.status, 'オンライン');
    assert.equal(prepared.newRole.isActiveThreeSet, true);
    assert.equal(prepared.newRole.useStartDate, '2026-08-08');
    assert.equal(prepared.newRole.useEndDate, '');
});

test('duplicate online blocks automatic replacement', () => {
    const before = [
        role(1, '#2-11', 'オンライン'),
        role(2, '#2-12', 'オンライン'),
        role(3, '#2-13', '新品予備（組込完了）')
    ];
    assert.throws(() => safety.prepareAutomaticOnlineAssignment(before, {
        newRoleId: 3,
        newRoleName: '#2-13',
        useStartDate: '2026-08-08',
        useEndDate: '2026-08-08',
        updatedAt: '2026-08-08T12:00:00.000Z'
    }), /オンラインが重複しています。先に異常を解消してください/);
    assert.equal(before.filter(safety.isOnline).length, 2);
});

test('removing, moving, or deleting the only online role is detected', () => {
    const before = [role(1, '#2-11', 'オンライン'), role(2, '#2-12', '改削中')];
    assert.ok(safety.wouldRemoveLastOnline(before, [role(1, '#2-11', '改削中'), before[1]], 1));
    assert.ok(safety.wouldRemoveLastOnline(before, [role(1, '#3-11', 'オンライン'), before[1]], 1));
    assert.ok(safety.wouldRemoveLastOnline(before, [before[1]], 1));

    const activeFlagOnly = [role(1, '#2-11', 'オンライン', false), before[1]];
    assert.equal(safety.wouldRemoveLastOnline(before, activeFlagOnly, 1), null);
    assert.equal(safety.diagnoseStandOnlineState(activeFlagOnly, '2').threeSetOnlineState, 'outside');
});

test('full-width stand names normalize correctly', () => {
    assert.equal(safety.getStandKey('＃3-14'), '3');
});
