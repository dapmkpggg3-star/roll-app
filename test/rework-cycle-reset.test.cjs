const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const start = source.indexOf('function normalizeWorkProgressStepState');
const end = source.indexOf('function getReworkPickupDateSummaryHtml', start);
assert.ok(start > 0 && end > start, 'rework cycle functions must stay in app.js');

const steps = [
    { key: 'requestFormCreatedAt', label: '改削依頼書作成' },
    { key: 'sealConfirmedAt', label: '押印確認' },
    { key: 'pdfCreatedAt', label: 'PDF化' },
    { key: 'vendorSentAt', label: '業者へ送信' },
    { key: 'vendorContactedAt', label: '業者連絡' },
    { key: 'pickupAdjustedAt', label: '引き取り日設定' }
];

function done(at, by) {
    return { done: true, updatedAt: at, updatedBy: by };
}

function augustProgress() {
    return {
        requestFormCreatedAt: done('2026-08-03T01:00:00.000Z', 'anon-a'),
        sealConfirmedAt: done('2026-08-04T01:00:00.000Z', 'anon-a'),
        pdfCreatedAt: done('2026-08-05T01:00:00.000Z', 'anon-a'),
        vendorSentAt: done('2026-08-06T01:00:00.000Z', 'anon-a'),
        vendorContactedAt: done('2026-08-07T01:00:00.000Z', 'anon-a'),
        pickupAdjustedAt: { done: false, updatedAt: '', updatedBy: '' }
    };
}

function countDone(progress) {
    return steps.filter(step => progress[step.key] && progress[step.key].done).length;
}

const context = vm.createContext({
    REWORK_READY_STATUS: '改削行き（搬出可能）',
    REWORKING_STATUS: '改削中',
    PICKUP_ADJUSTED_STEP_KEY: 'pickupAdjustedAt',
    WORK_PROGRESS_STEPS: steps,
    LEGACY_REWORK_CHECKLIST_STEP_KEYS: {
        requestForm: 'requestFormCreatedAt',
        sealConfirmed: 'sealConfirmedAt',
        pdfCreated: 'pdfCreatedAt',
        vendorSent: 'vendorSentAt',
        vendorContacted: 'vendorContactedAt',
        pickupAdjusted: 'pickupAdjustedAt'
    },
    normalizeRoleStatusValue: status => String(status || '').trim(),
    normalizeDateInputValue: value => {
        const text = value === undefined || value === null ? '' : String(value).trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
    }
});
vm.runInContext(`${source.slice(start, end)}\nthis.api={settleReworkCycle,settleStoredReworkCycle,guardMergedReworkProgress,normalizeWorkProgress,applySettledReworkCycle,describeIncompleteReworkAdvance,openReworkCycleOnCreate,getReworkCycleReadout};`, context);

const api = context.api;
const ready = '改削行き（搬出可能）';
const reworking = '改削中';

test('a new regrind entry starts at 0/6 and keeps the August record in history', () => {
    const role = {
        id: 'anon-16',
        status: '中古予備（バラシ前）',
        updatedAt: '2026-08-07T01:00:00.000Z',
        requestSent: true,
        workProgress: augustProgress()
    };
    const settled = api.settleReworkCycle(role, role.status, ready, '2026-11-17T00:00:00.000Z');
    assert.equal(countDone(settled.progress), 0);
    assert.equal(settled.requestSent, false);
    assert.ok(settled.progress.cycleId);
    assert.equal(settled.history.length, 1);
    assert.equal(settled.history[0].completedCount, 5);
    assert.equal(settled.history[0].judgment, '判定不能');
    assert.deepEqual(settled.history[0].incomplete, ['引き取り日設定']);
    assert.equal(settled.history[0].steps[4].updatedAt, '2026-08-07T01:00:00.000Z');
    assert.equal(settled.history[0].steps[4].updatedBy, 'anon-a');
});

test('the same cycle keeps its checks when moving between rework statuses', () => {
    const progress = augustProgress();
    progress.cycleId = 'rework-anon-16-current';
    const role = { id: 'anon-16', status: ready, requestSent: true, workProgress: progress };
    const onward = api.settleReworkCycle(role, ready, reworking, '2026-11-17T01:00:00.000Z');
    assert.equal(onward.reset, false);
    assert.equal(countDone(onward.progress), 5);
    assert.equal(onward.progress.cycleId, 'rework-anon-16-current');
    assert.equal(onward.history.length, 0);
    const back = api.settleReworkCycle({ ...role, status: reworking }, reworking, ready, '2026-11-17T02:00:00.000Z');
    assert.equal(countDone(back.progress), 5);
});

test('stored checks without a cycle id are not treated as the current cycle', () => {
    const stored = api.settleStoredReworkCycle({
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-08-07T01:00:00.000Z',
        requestSent: true,
        workProgress: augustProgress()
    }, '2026-08-07T01:00:00.000Z');
    assert.equal(countDone(stored.progress), 0);
    assert.equal(stored.history[0].judgment, '判定不能');
    assert.equal(stored.history[0].completedCount, 5);
    const again = api.settleStoredReworkCycle({
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-08-07T01:00:00.000Z',
        requestSent: false,
        workProgress: stored.progress,
        workProgressHistory: stored.history
    }, '2026-08-07T01:00:00.000Z');
    assert.equal(countDone(again.progress), 0);
    assert.equal(again.history.length, 1);
});

test('a legacy reimport does not restore old checks onto the new cycle', () => {
    const local = {
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-11-17T03:00:00.000Z',
        requestSent: false,
        workProgress: { cycleId: 'rework-anon-16-new', requestFormCreatedAt: { done: false, updatedAt: '', updatedBy: '' } },
        workProgressHistory: [{
            cycleId: '',
            closedAt: '2026-11-17T00:00:00.000Z',
            judgment: '判定不能',
            completedCount: 5,
            steps: []
        }]
    };
    const remote = {
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-11-17T04:00:00.000Z',
        requestSent: true,
        workProgress: augustProgress()
    };
    const merged = { ...remote, workProgress: { ...remote.workProgress } };
    api.guardMergedReworkProgress(merged, remote, local);
    assert.equal(merged.workProgress.cycleId, 'rework-anon-16-new');
    assert.notEqual(merged.workProgress.requestFormCreatedAt && merged.workProgress.requestFormCreatedAt.done, true);
    assert.ok(merged.workProgressHistory.some(item => item.completedCount === 5 && item.judgment === '判定不能'));
});

test('an empty new-cycle dispatch date does not revive the August role date', () => {
    const progress = api.normalizeWorkProgress({
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        workProgress: { cycleId: 'rework-anon-16-new', dispatchDate: '', arrivalDate: '' }
    });
    assert.equal(progress.dispatchDate, '');
    assert.equal(progress.arrivalDate, '');
    const role = {
        id: 'anon-16',
        status: '中古予備（バラシ前）',
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        requestSent: true,
        workProgress: augustProgress()
    };
    const entered = api.settleReworkCycle(role, role.status, ready, '2026-11-17T00:00:00.000Z');
    assert.equal(entered.progress.dispatchDate, '');
    assert.equal(entered.progress.arrivalDate, '');
    assert.equal(entered.history[0].dispatchDate, '2026-08-01');
    assert.equal(entered.history[0].arrivalDate, '2026-08-20');
    const loaded = api.settleStoredReworkCycle({
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-11-17T00:00:00.000Z',
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        workProgress: entered.progress,
        workProgressHistory: entered.history
    }, '2026-11-17T00:00:00.000Z');
    const applied = api.applySettledReworkCycle({ dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' }, loaded);
    assert.equal(applied.dispatchDate, '');
    assert.equal(applied.arrivalDate, '');
    assert.equal(applied.workProgress.dispatchDate, '');
});

test('the same cycle keeps a newly entered dispatch date across save and sync', () => {
    const progress = augustProgress();
    progress.cycleId = 'rework-anon-16-current';
    progress.dispatchDate = '2026-11-20';
    progress.arrivalDate = '2026-12-01';
    const role = {
        id: 'anon-16',
        status: ready,
        dispatchDate: '2026-11-20',
        arrivalDate: '2026-12-01',
        requestSent: true,
        workProgress: progress
    };
    const onward = api.settleReworkCycle(role, ready, reworking, '2026-11-17T01:00:00.000Z');
    assert.equal(onward.reset, false);
    assert.equal(onward.progress.dispatchDate, '2026-11-20');
    assert.equal(onward.progress.arrivalDate, '2026-12-01');
    const current = {
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-11-17T03:00:00.000Z',
        dispatchDate: '2026-11-20',
        arrivalDate: '2026-12-01',
        requestSent: false,
        workProgress: {
            cycleId: 'rework-anon-16-current',
            dispatchDate: '2026-11-20',
            arrivalDate: '2026-12-01',
            requestFormCreatedAt: { done: false, updatedAt: '', updatedBy: '' }
        }
    };
    const remote = {
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-11-17T04:00:00.000Z',
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        requestSent: true,
        workProgress: augustProgress()
    };
    const merged = { ...remote, workProgress: { ...remote.workProgress } };
    api.guardMergedReworkProgress(merged, remote, current);
    assert.equal(merged.workProgress.cycleId, 'rework-anon-16-current');
    assert.equal(merged.dispatchDate, '2026-11-20');
    assert.equal(merged.arrivalDate, '2026-12-01');
    assert.notEqual(merged.workProgress.requestFormCreatedAt && merged.workProgress.requestFormCreatedAt.done, true);
    assert.ok(merged.workProgressHistory.some(item => item.dispatchDate === '2026-08-01' && item.arrivalDate === '2026-08-20'));
});

test('advancing with item 6 incomplete returns a warning and does not block the history', () => {
    const progress = augustProgress();
    progress.dispatchDate = '2026-08-01';
    const warning = api.describeIncompleteReworkAdvance(progress);
    assert.match(warning, /⑥/);
    assert.match(warning, /未完了/);
    assert.doesNotMatch(warning, /前回の搬出日/);
    const withHistory = api.describeIncompleteReworkAdvance(progress, [{
        recordKind: 'cycle-close',
        cycleId: 'rework-anon-old',
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        incomplete: ['引き取り日設定']
    }]);
    assert.match(withHistory, /引き取り日設定（⑥）は未完了です/);
    assert.match(withHistory, /前回の搬出日・搬入日は履歴に残しています/);
    const closedWithoutDates = api.describeIncompleteReworkAdvance({
        recordKind: 'cycle-close',
        incomplete: ['引き取り日設定'],
        dispatchDate: '',
        arrivalDate: ''
    });
    assert.match(closedWithoutDates, /引き取り日設定（⑥）は未完了です/);
    assert.doesNotMatch(closedWithoutDates, /前回の搬出日/);
    const closedWithDates = api.describeIncompleteReworkAdvance({
        recordKind: 'cycle-close',
        incomplete: ['引き取り日設定'],
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20'
    });
    assert.match(closedWithDates, /前回の搬出日・搬入日は履歴に残しています/);
    const done = api.describeIncompleteReworkAdvance({
        ...progress,
        dispatchDate: '2026-11-20',
        pickupAdjustedAt: { done: true, updatedAt: '2026-11-20T00:00:00.000Z', updatedBy: 'anon-b' }
    });
    assert.equal(done, '');
});

function currentCycle(doneFirst) {
    const progress = {
        cycleId: 'rework-anon-16-current',
        dispatchDate: '',
        arrivalDate: '',
        requestFormCreatedAt: { done: doneFirst, updatedAt: doneFirst ? '2026-11-17T01:00:00.000Z' : '', updatedBy: doneFirst ? 'anon-b' : '' }
    };
    return {
        id: 'anon-16',
        status: ready,
        updatedAt: '2026-11-17T02:00:00.000Z',
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        requestSent: true,
        reworkCycleWarning: '',
        workProgress: progress,
        workProgressHistory: []
    };
}

function doneCount(progress) {
    return steps.filter(step => progress[step.key] && progress[step.key].done).length;
}

test('load and repeated sync keep the open cycle at 1/6 and record August dates once', () => {
    const role = currentCycle(true);
    const loaded = api.applySettledReworkCycle({ ...role }, api.settleStoredReworkCycle(role, role.updatedAt));
    assert.equal(loaded.workProgress.cycleId, 'rework-anon-16-current');
    assert.equal(doneCount(loaded.workProgress), 1);
    assert.equal(loaded.dispatchDate, '');
    assert.equal(loaded.arrivalDate, '');
    assert.equal(loaded.workProgress.vendorSentAt.done, false);
    assert.equal(loaded.reworkCycleWarning, '');
    const notes = loaded.workProgressHistory.filter(item => item.recordKind === 'date-reference');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].cycleId, '');
    assert.equal(notes[0].dispatchDate, '2026-08-01');
    assert.equal(notes[0].arrivalDate, '2026-08-20');

    function syncPair(local, remote) {
        const merged = { ...remote, workProgress: { ...remote.workProgress }, workProgressHistory: (remote.workProgressHistory || []).slice() };
        api.guardMergedReworkProgress(merged, remote, local);
        return merged;
    }
    const remote = { ...loaded, updatedAt: '2026-11-17T03:00:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20', requestSent: true };
    const synced = syncPair(loaded, remote);
    const reversed = syncPair(remote, loaded);
    const reloaded = api.applySettledReworkCycle({ ...synced, dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' }, api.settleStoredReworkCycle({ ...synced, dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' }, synced.updatedAt));
    const resynced = syncPair(reloaded, { ...reloaded, updatedAt: '2026-11-17T04:00:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20', requestSent: true });
    for (const result of [synced, reversed, reloaded, resynced]) {
        assert.equal(result.workProgress.cycleId, 'rework-anon-16-current');
        assert.equal(doneCount(result.workProgress), 1);
        assert.equal(result.dispatchDate, '');
        assert.equal(result.arrivalDate, '');
        assert.equal(result.workProgress.vendorSentAt.done, false);
        assert.equal(result.workProgressHistory.filter(item => item.recordKind === 'date-reference').length, 1);
        assert.equal(result.workProgressHistory.filter(item => item.recordKind !== 'date-reference' && item.cycleId === 'rework-anon-16-current').length, 0);
    }
});

test('an older date note that reused the open cycle id does not close that cycle', () => {
    const role = currentCycle(true);
    role.dispatchDate = '';
    role.arrivalDate = '';
    role.workProgressHistory = [{
        cycleId: 'rework-anon-16-current',
        reason: '前回の搬出日・搬入日は今回の欄へ戻しません',
        completedCount: 1,
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        steps: [{ key: 'requestFormCreatedAt', done: true }]
    }];
    const merged = { ...role, workProgress: { ...role.workProgress } };
    api.guardMergedReworkProgress(merged, { ...role, updatedAt: '2026-11-17T05:00:00.000Z' }, role);
    assert.equal(merged.workProgress.cycleId, 'rework-anon-16-current');
    assert.equal(doneCount(merged.workProgress), 1);
    assert.equal(merged.workProgressHistory.filter(item => item.recordKind === 'date-reference' && item.cycleId === '').length, 1);
});

test('repeated sync keeps the cycle created at registration and records August dates once', () => {
    const createdAt = '2026-11-17T12:44:01.727Z';
    const created = api.openReworkCycleOnCreate({
        id: 'anon-new',
        status: ready,
        dispatchDate: '',
        arrivalDate: '',
        workProgress: { dispatchDate: '', arrivalDate: '' }
    }, createdAt);
    created.progress.requestFormCreatedAt = { done: true, updatedAt: createdAt, updatedBy: 'anon-b' };
    const local = {
        id: 'anon-new',
        name: '#16-anon-new',
        status: ready,
        updatedAt: createdAt,
        dispatchDate: '',
        arrivalDate: '',
        requestSent: false,
        workProgress: created.progress,
        workProgressHistory: created.history
    };
    function sync(localRole, remoteRole) {
        const merged = {
            ...remoteRole,
            workProgress: { ...remoteRole.workProgress },
            workProgressHistory: (remoteRole.workProgressHistory || []).slice()
        };
        api.guardMergedReworkProgress(merged, remoteRole, localRole);
        return merged;
    }
    const remote = { ...local, updatedAt: '2026-11-17T13:00:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' };
    const once = sync(local, remote);
    const twice = sync(once, { ...once, updatedAt: '2026-11-17T13:05:00.000Z', dispatchDate: '2026-08-01', arrivalDate: '2026-08-20' });
    for (const result of [once, twice]) {
        assert.equal(result.workProgress.cycleId, created.progress.cycleId);
        assert.equal(result.workProgress.requestFormCreatedAt.done, true);
        assert.equal(result.dispatchDate, '');
        assert.equal(result.arrivalDate, '');
        assert.equal(result.workProgressHistory.filter(item => item.recordKind === 'date-reference').length, 1);
    }
});

test('a role created as rework ready keeps step 1 on the same cycle after reload', () => {
    const createdAt = '2026-11-17T12:44:01.727Z';
    const created = api.openReworkCycleOnCreate({
        id: 'anon-new',
        status: ready,
        dispatchDate: '',
        arrivalDate: '',
        workProgress: { dispatchDate: '', arrivalDate: '' }
    }, createdAt);
    assert.ok(created.progress.cycleId);
    created.progress.requestFormCreatedAt = { done: true, updatedAt: createdAt, updatedBy: 'anon-b' };
    const reloaded = api.settleStoredReworkCycle({
        id: 'anon-new',
        status: ready,
        updatedAt: createdAt,
        dispatchDate: '',
        arrivalDate: '',
        requestSent: false,
        workProgress: created.progress,
        workProgressHistory: created.history
    }, createdAt);
    assert.equal(reloaded.progress.cycleId, created.progress.cycleId);
    assert.equal(reloaded.progress.requestFormCreatedAt.done, true);
    assert.equal(steps.filter(step => reloaded.progress[step.key] && reloaded.progress[step.key].done).length, 1);
    const continued = api.settleReworkCycle({
        id: 'anon-new',
        status: ready,
        requestSent: false,
        workProgress: reloaded.progress,
        workProgressHistory: reloaded.history
    }, ready, reworking, '2026-11-17T13:00:00.000Z');
    assert.equal(continued.reset, false);
    assert.equal(continued.progress.cycleId, created.progress.cycleId);
    assert.equal(continued.progress.requestFormCreatedAt.done, true);
});

test('stored checks without a cycle id stay out of the current cycle after a new role is created', () => {
    const legacy = api.settleStoredReworkCycle({
        id: 'anon-old',
        status: ready,
        updatedAt: '2026-08-07T01:00:00.000Z',
        requestSent: true,
        dispatchDate: '2026-08-01',
        arrivalDate: '2026-08-20',
        workProgress: augustProgress()
    }, '2026-08-07T01:00:00.000Z');
    assert.equal(legacy.progress.requestFormCreatedAt.done, false);
    assert.equal(legacy.history[0].judgment, '判定不能');
    assert.equal(legacy.history[0].completedCount, 5);
});

test('requestSent alone does not mark the current vendor step done without a cycle id', () => {
    const progress = api.normalizeWorkProgress({
        requestSent: true,
        updatedAt: '2026-08-06T01:00:00.000Z',
        workProgress: {}
    });
    assert.equal(progress.vendorSentAt.done, false);
    const withCycle = api.normalizeWorkProgress({
        requestSent: true,
        updatedAt: '2026-08-06T01:00:00.000Z',
        workProgress: { cycleId: 'rework-anon-16-current', dispatchDate: '', arrivalDate: '' }
    });
    assert.equal(withCycle.vendorSentAt.done, false);
});

test('a reworking readout shows 1/6, the incomplete items, and the confirmer without completing anything', () => {
    const confirmedAt = '2026-11-17T12:44:01.727Z';
    const readout = api.getReworkCycleReadout({
        id: 'anon-reworking',
        status: reworking,
        dispatchDate: '',
        arrivalDate: '',
        requestSent: false,
        workProgress: {
            cycleId: 'rework-anon-reworking',
            dispatchDate: '',
            arrivalDate: '',
            requestFormCreatedAt: { done: true, updatedAt: confirmedAt, updatedBy: '樋渡' },
            sealConfirmedAt: { done: false, updatedAt: '', updatedBy: '' },
            pdfCreatedAt: { done: false, updatedAt: '', updatedBy: '' },
            vendorSentAt: { done: false, updatedAt: '', updatedBy: '' },
            vendorContactedAt: { done: false, updatedAt: '', updatedBy: '' },
            pickupAdjustedAt: { done: false, updatedAt: '', updatedBy: '' }
        }
    });
    assert.equal(readout.cycleId, 'rework-anon-reworking');
    assert.equal(readout.completedCount, 1);
    assert.equal(readout.totalCount, 6);
    assert.deepEqual(readout.incomplete, ['押印確認', 'PDF化', '業者へ送信', '業者連絡', '引き取り日設定']);
    assert.equal(readout.items[0].updatedAt, confirmedAt);
    assert.equal(readout.items[0].updatedBy, '樋渡');
    assert.equal(readout.items[5].done, false);
});
