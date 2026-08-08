const test = require('node:test');
const assert = require('node:assert/strict');
const safety = require('../../js/online-safety');
const { validateRolesOnlineTransition } = require('../src/lib/online-safety');

function role(id, name, status, active = true, extra = {}) {
  return { id, name, status, isActiveThreeSet: active, nextAssemblyPlanned: false, ...extra };
}

test('diagnoses missing, normal, duplicate and keeps three-set state separate', () => {
  const missing = safety.diagnoseStandOnlineState([role(1, '#2-1', '改削中')], '2');
  assert.equal(missing.onlineState, 'missing');
  assert.equal(missing.threeSetConfigured, false);
  const normal = safety.diagnoseStandOnlineState([role(1, '#2-1', 'オンライン')], '2');
  assert.equal(normal.onlineState, 'normal');
  const duplicate = safety.diagnoseStandOnlineState([
    role(1, '#2-1', 'オンライン'), role(2, '#2-2', 'オンライン')
  ], '2');
  assert.equal(duplicate.onlineState, 'duplicate');

  const outside = safety.diagnoseStandOnlineState([
    role(1, '#2-1', 'オンライン', false), role(2, '#2-2', '改削中', true)
  ], '2');
  assert.equal(outside.onlineCount, 1);
  assert.equal(outside.onlineState, 'normal');
  assert.equal(outside.threeSetOnlineState, 'outside');
  assert.equal(outside.threeSetOnlineLabel, 'オンラインが運用3セット対象外');
});

test('normal edit cannot remove or move the last active online role', () => {
  const before = [role(1, '#2-1', 'オンライン'), role(2, '#2-2', '改削中')];
  assert.ok(safety.wouldRemoveLastOnline(before, [role(1, '#2-1', '改削中'), before[1]], 1));
  assert.ok(safety.wouldRemoveLastOnline(before, [role(1, '#3-1', 'オンライン'), before[1]], 1));
  const activeFlagOnlyChange = [role(1, '#2-1', 'オンライン', false), before[1]];
  assert.equal(safety.wouldRemoveLastOnline(before, activeFlagOnlyChange, 1), null);
  assert.equal(safety.diagnoseStandOnlineState(activeFlagOnlyChange, '2').threeSetOnlineState, 'outside');
  assert.ok(safety.wouldRemoveLastOnline(before, [before[1]], 1));

  const inactiveOnline = [role(1, '#2-1', 'オンライン', false), role(2, '#2-2', '改削中', true)];
  assert.ok(safety.wouldRemoveLastOnline(
    inactiveOnline,
    [role(1, '#2-1', '改削中', false), inactiveOnline[1]],
    1
  ));
});

test('unrelated edits on an already missing stand remain allowed', () => {
  const before = [role(1, '#2-1', '改削中', true, { memo: '' })];
  const after = [role(1, '#2-1', '改削中', true, { memo: 'updated' })];
  assert.equal(safety.wouldRemoveLastOnline(before, after, 1), null);
  assert.doesNotThrow(() => validateRolesOnlineTransition(before, after));
});

test('online exchange is valid only when final state has exactly one online', () => {
  const before = [
    role(1, '#2-1', 'オンライン', true, { useStartDate: '2026-07-01', useEndDate: '' }),
    role(2, '#2-2', '中古予備（バラシ前）', true, {
      nextAssemblyPlanned: true,
      useStartDate: '2026-02-01',
      useEndDate: '2026-03-01'
    })
  ];
  const after = [
    role(1, '#2-1', '中古予備（バラシ前）', true, { useEndDate: '2026-08-05' }),
    role(2, '#2-2', 'オンライン', true, { useStartDate: '2026-08-05', nextAssemblyPlanned: false })
  ];
  assert.equal(safety.diagnoseStandOnlineState(after, '2').onlineCount, 1);
  assert.doesNotThrow(() => validateRolesOnlineTransition(before, after));

  const prepared = safety.prepareAutomaticOnlineAssignment(before, {
    newRoleId: 2,
    newRoleName: '#2-2',
    oldStatus: '中古予備（バラシ前）',
    useEndDate: '2026-08-05',
    useStartDate: '2026-08-06',
    updatedAt: '2026-08-05T00:00:00.000Z'
  });
  assert.equal(prepared.oldRole.status, '中古予備（バラシ前）');
  assert.equal(prepared.oldRole.useStartDate, '2026-07-01');
  assert.equal(prepared.oldRole.useEndDate, '2026-08-05');
  assert.equal(prepared.newRole.status, 'オンライン');
  assert.equal(prepared.newRole.useStartDate, '2026-08-06');
  assert.equal(prepared.newRole.useEndDate, '');
  assert.equal(prepared.newRole.nextAssemblyPlanned, false);
  assert.equal(prepared.diagnosis.onlineCount, 1);
  assert.equal(before[0].status, 'オンライン', 'input roles are not partially mutated');

  const inactiveOld = [
    role(1, '#2-1', 'オンライン', false),
    role(2, '#2-2', '中古予備（バラシ前）', true)
  ];
  const repaired = safety.prepareAutomaticOnlineAssignment(inactiveOld, {
    newRoleId: 2,
    newRoleName: '#2-2',
    oldStatus: '中古予備（バラシ前）',
    useEndDate: '2026-08-05',
    useStartDate: '2026-08-05',
    updatedAt: '2026-08-05T00:00:00.000Z'
  });
  assert.equal(repaired.diagnosis.onlineCount, 1);
  assert.equal(repaired.diagnosis.onlineRoleIsActiveThreeSet, true);

  const missingBefore = [role(2, '#2-2', '新品予備（組込完了）', false, {
    useStartDate: '2026-02-01', useEndDate: '2026-03-01'
  })];
  const recovered = safety.prepareAutomaticOnlineAssignment(missingBefore, {
    newRoleId: 2,
    newRoleName: '#2-2',
    useStartDate: '2026-08-05',
    useEndDate: '2026-08-05',
    updatedAt: '2026-08-05T00:00:00.000Z'
  });
  assert.equal(recovered.oldRole, null);
  assert.equal(recovered.newRole.isActiveThreeSet, true);
  assert.equal(recovered.newRole.useStartDate, '2026-08-05');
  assert.equal(recovered.newRole.useEndDate, '');
  assert.equal(recovered.diagnosis.onlineCount, 1);

  const duplicateBefore = [
    role(1, '#2-1', 'オンライン'),
    role(2, '#2-2', 'オンライン'),
    role(3, '#2-3', '新品予備（組込完了）')
  ];
  assert.throws(() => safety.prepareAutomaticOnlineAssignment(duplicateBefore, {
    newRoleId: 3,
    newRoleName: '#2-3',
    useStartDate: '2026-08-05',
    useEndDate: '2026-08-05',
    updatedAt: '2026-08-05T00:00:00.000Z'
  }), /オンラインが重複しています。先に異常を解消してください/);
});

test('API transition rejects a newly created zero or duplicate state', () => {
  const before = [role(1, '#2-1', 'オンライン'), role(2, '#2-2', '改削中')];
  assert.throws(() => validateRolesOnlineTransition(before, [role(1, '#2-1', '改削中'), before[1]]), /#2st/);
  assert.throws(() => validateRolesOnlineTransition(before, [before[0], role(2, '#2-2', 'オンライン')]), /#2st/);
  const alreadyMissing = [role(1, '#2-1', '改削中'), role(2, '#2-2', '改削中')];
  assert.throws(() => validateRolesOnlineTransition(alreadyMissing, [
    role(1, '#2-1', 'オンライン'), role(2, '#2-2', 'オンライン')
  ]), /#2st/);
  assert.doesNotThrow(() => validateRolesOnlineTransition(before, [
    role(1, '#2-1', 'オンライン', false), before[1]
  ]), 'three-set consistency is diagnosed separately from online count');
});

test('stand keys normalize full-width hash characters', () => {
  assert.equal(safety.getStandKey('＃3-14'), '3');
});
