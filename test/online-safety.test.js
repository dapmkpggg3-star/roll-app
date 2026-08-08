const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

function getFunctionSource(source, functionName, nextFunctionName) {
    const start = source.indexOf(`function ${functionName}(`);
    const end = source.indexOf(`\nfunction ${nextFunctionName}(`, start);
    assert.notEqual(start, -1, `${functionName} must exist`);
    assert.notEqual(end, -1, `${nextFunctionName} must follow ${functionName}`);
    return source.slice(start, end);
}

test('Google edit flow gives old and new history the same exchange context', () => {
    const appSource = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
    const updateRoleSource = getFunctionSource(appSource, 'updateRole', 'cancelEdit');

    assert.match(updateRoleSource, /exchangeId:\s*`online-exchange-\$\{changedAt\}-\$\{prepared\.oldRole\.id\}-\$\{prepared\.newRole\.id\}`/);
    assert.match(updateRoleSource, /exchangeHistoryOptions\s*=\s*exchangeContext\s*\?\s*\{\s*exchangeId:\s*exchangeContext\.exchangeId,\s*force:\s*true\s*\}/);
    assert.match(updateRoleSource, /addRoleHistoryEntry\(exchangeContext\.oldRole,\s*'onlineExchange',[\s\S]*?changedAt,\s*exchangeHistoryOptions\)/);
    assert.match(updateRoleSource, /addRoleHistoryEntry\(role,\s*'onlineExchange',[\s\S]*?changedAt,\s*exchangeHistoryOptions\)/);
});

test('Google edit flow validates the cloned roles before one local save and one sync', () => {
    const appSource = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
    const updateRoleSource = getFunctionSource(appSource, 'updateRole', 'cancelEdit');
    const countCalls = name => (updateRoleSource.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length;

    assert.equal(countCalls('prepareAutomaticOnlineAssignment'), 1);
    assert.equal(countCalls('validateLastOnlineRemoval'), 1);
    assert.equal(countCalls('saveLocalRoles'), 1);
    assert.equal(countCalls('syncRoles'), 1);

    const validationIndex = updateRoleSource.indexOf('validateLastOnlineRemoval(');
    const replaceIndex = updateRoleSource.indexOf('roles = rolesAfterEdit;');
    const saveIndex = updateRoleSource.indexOf('saveLocalRoles();');
    const syncIndex = updateRoleSource.indexOf('syncRoles();');
    assert.ok(validationIndex < replaceIndex, 'final state must be validated before replacing roles');
    assert.ok(replaceIndex < saveIndex, 'roles must be replaced before the single local save');
    assert.ok(saveIndex < syncIndex, 'local save must precede the single Google sync');
});
