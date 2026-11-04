const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const clone = x => JSON.parse(JSON.stringify(x));
const revision = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('offline GAS bundle loads every dependency in order without enabling or contacting any service', () => {
    const gas = vm.createContext({});
    vm.runInContext(require('../scripts/build-workshop-gas.cjs').build(), gas);
    assert.equal(typeof gas.doPost, 'function');
    assert.equal(typeof gas.handleWorkshopRequest_, 'function');
    assert.equal(typeof gas.RollWorkshopRecovery.createCoordinator, 'function');
    assert.equal(typeof gas.RollWorkshopStatusBridge.prepare, 'function');
    assert.equal(typeof gas.RollOnlineSafety, 'object');
});

const { fixture } = require('./helpers/workshop-api-fixture.cjs');

test('formal instructions cannot be bypassed by generic save, history import or deletion', () => {
    const h = fixture(); h.issue(); h.lock.tryLock();
    const writes = h.state.writes;
    for (const mutate of [roles => { roles[2].status = '新品予備（組込完了）'; },
        roles => { roles[0].status = '改削行き（搬出可能）'; }, roles => { roles[2].status = 'オンライン'; },
        roles => roles.splice(2, 1), roles => { roles[2].name = '#14-999'; }, roles => { roles[2].id = 'new-id'; }]) {
        const next = clone(h.state.roles); mutate(next);
        assert.throws(() => h.gas.writeRoles(next), /正式な工作指示/);
    }
    const next = clone(h.state.roles); next[2].memo = '整備メモ'; next[1].memo = '無関係';
    assert.doesNotThrow(() => h.gas.assertWorkshopRolesWriteAllowed_(h.state.roles, next));
    assert.equal(h.state.writes, writes); h.lock.releaseLock();
});

test('a direct Roles edit conflicting with an instruction is preserved but propagation stops', () => {
    const h = fixture(); h.issue(); h.state.roles[2].status = '新品予備（組込完了）'; h.lock.tryLock();
    assert.throws(() => h.gas.assertWorkshopRolesWriteAllowed_(null, null), /正式な工作指示/);
    assert.equal(h.state.roles[2].status, '新品予備（組込完了）'); h.lock.releaseLock();
});

test('missing or unreadable instruction sheet is not treated as no formal instructions', () => {
    for (const corrupt of [false, true]) {
        const h = fixture();
        if (corrupt) h.state.tables.get('_WorkshopInstructions_v1').rows.push(['bad', '{}']);
        else h.state.tables.delete('_WorkshopInstructions_v1');
        h.lock.tryLock();
        assert.throws(() => h.gas.writeRoles(h.state.roles)); assert.equal(h.state.writes, 0);
        h.lock.releaseLock();
    }
});

test('completion cannot silently choose between overlapping instructions across plans', () => {
    const h = fixture(), first = h.issue();
    const request = h.plan(null, 'second-draft', 'save_draft', { items: [{ standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2026-11-01' }], reason: 'duplicate' });
    request.command.planId = 'second-plan';
    const draft = h.ok(request).record;
    const adopt = h.plan(draft, 'second-adopt', 'adopt', { planVersionId: h.gas.RollWorkshopAdoption.project(draft).draft.planVersionId });
    adopt.command.planId = draft.id; h.ok(adopt);
    h.ok({ action: 'issueworkshopplan', planId: draft.id, request: { requestId: 'second-issue' } });
    const writes = h.state.writes;
    const result = h.post({ action: 'completeworkshop', request: first.request });
    assert.equal(result.success, false); assert.match(result.error, /複数の工作指示/);
    assert.equal(result.workshopRejectedRequestId, first.request.requestId);
    assert.equal(h.state.writes, writes);
});

test('multiple completed instructions each use only their own reflection receipts', () => {
    const h = fixture(), first = h.issue(); h.ok({ action: 'completeworkshop', request: first.request });
    // Simulate a later rotation and issue a distinct, adopted next cycle.
    h.state.roles[0].status = '中古予備（バラシ前）'; h.state.roles[2].status = '新品予備（組替可能）';
    const request = h.plan(null, 'next-draft', 'save_draft', { items: [{ standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2026-11-01' }], reason: 'next cycle fixture' });
    request.command.planId = 'next-plan';
    const draft = h.ok(request).record;
    const adopt = h.plan(draft, 'next-adopt', 'adopt', { planVersionId: h.gas.RollWorkshopAdoption.project(draft).draft.planVersionId });
    adopt.command.planId = draft.id; h.ok(adopt);
    const instruction = h.ok({ action: 'issueworkshopplan', planId: draft.id, request: { requestId: 'next-issue' } }).records.find(record => record.id !== first.instruction.id);
    const def = h.gas.RollWorkshopInstructions.project(instruction).definition;
    h.ok({ action: 'completeworkshop', request: { ...first.request, requestId: 'next-complete', instructionId: instruction.id,
        cycleId: def.cycleId, expectedInstructionRevision: instruction.revision, expectedRolesRevision: revision(h.state.roles) } });
    const snapshot = h.ok({ action: 'fetchworkshop' });
    assert.equal(snapshot.tasks.length, 2); assert.ok(snapshot.tasks.every(task => task.assemblyTask === 'completed'));
    assert.equal(snapshot.rolesRevision, revision(snapshot.roles));
    h.lock.tryLock(); const next = clone(h.state.roles); next[2].status = 'オンライン';
    assert.doesNotThrow(() => h.gas.assertWorkshopRolesWriteAllowed_(h.state.roles, next)); h.lock.releaseLock();
});

test('authenticated route: draft → adoption → issue → completion verifies both rolls and formula views', () => {
    const h = fixture(), x = h.issue(), online = clone(h.state.roles[1]);
    const result = h.ok({ action: 'completeworkshop', request: x.request });
    assert.equal(result.status, 'complete'); assert.equal(result.effectReceipts.length, 2);
    assert.equal(h.state.roles[0].status, '改削行き（搬出可能）');
    assert.equal(h.state.roles[2].status, '新品予備（組込完了）'); assert.equal(h.state.roles[2].useStartDate, '');
    assert.deepEqual(h.state.roles[1], online);
    const snapshot = h.ok({ action: 'fetchworkshop' });
    assert.equal(snapshot.tasks[0].assemblyTask, 'completed'); assert.equal(snapshot.pendingOperations.length, 0);
    const writes = h.state.writes;
    delete h.state.props.ROLL_WORKSHOP_OPERATORS;
    assert.equal(h.ok({ action: 'completeworkshop', request: x.request }).status, 'complete');
    assert.equal(h.state.writes, writes); assert.equal(h.state.held, false);
});

test('disabled mode, wrong workbook, missing setup and anonymous requests never mutate data', () => {
    for (const mutate of [h => { delete h.state.props.ROLL_WORKSHOP_API_MODE; },
        h => { h.state.spreadsheetId = 'production-is-not-allowed'; },
        h => { h.state.tables.delete('_WorkshopOperations_v1'); }]) {
        const h = fixture(); mutate(h);
        assert.equal(h.post({ action: 'fetchworkshop' }).success, false); assert.equal(h.state.writes, 0);
    }
    const h = fixture(); assert.equal(h.post({ action: 'fetchworkshop', authToken: '' }).success, false);
});

test('reader may view but cannot save, issue, complete or resume; client identity cannot elevate rights', () => {
    const h = fixture(); h.state.principal.role = 'reader';
    assert.equal(h.post({ action: 'fetchworkshop' }).success, true);
    for (const action of ['saveworkshopplan', 'issueworkshopplan', 'completeworkshop', 'resumeworkshop']) {
        assert.equal(h.post({ action }).success, false);
    }
    assert.equal(h.post({ action: 'fetchworkshop', actor: { role: 'admin' } }).success, false);
    assert.equal(h.state.writes, 0);
});

test('pending save blocks same-plan removal and cross-plan pair reuse; authorized recovery completes it', () => {
    const h = fixture(), x = h.issue(); h.state.stale = true;
    assert.equal(h.post({ action: 'completeworkshop', request: x.request }).success, false);
    const snapshot = h.ok({ action: 'fetchworkshop' });
    assert.equal(snapshot.tasks[0].assemblyTask, 'active'); assert.equal(snapshot.pendingOperations.length, 1);
    const writes = h.state.writes;
    const removal = h.plan(x.adopted, 'remove', 'save_draft', { items: [], reason: 'remove' });
    assert.match(h.post(removal).error, /先に復旧/);
    const other = h.plan(null, 'other', 'save_draft', { items: [{ standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2026-11-01' }], reason: 'other' });
    other.command.planId = 'another-plan'; assert.match(h.post(other).error, /先に復旧/);
    assert.equal(h.state.writes, writes);
    h.state.stale = false; h.state.principal = { id: 'google:second-editor', role: 'editor' };
    assert.equal(h.ok({ action: 'resumeworkshop', operationId: snapshot.pendingOperations[0].id }).status, 'complete');
    const event = h.ok({ action: 'fetchworkshop' }).instructions[0].events.at(-1);
    assert.equal(event.actorId, 'google:fixture'); assert.equal(event.source.operatorName, '試験担当');
});

test('a changed adopted plan requires refreshed instructions before starting completion', () => {
    const h = fixture(), x = h.issue();
    const item = clone(h.gas.RollWorkshopAdoption.project(x.adopted).draft.items[0]); delete item.cycleId; item.readyBy = '2026-11-02';
    const draft = h.ok(h.plan(x.adopted, 'change', 'save_draft', { items: [item], reason: 'date change' })).record;
    const version = h.gas.RollWorkshopAdoption.project(draft).draft.planVersionId;
    h.ok(h.plan(draft, 'readopt', 'adopt', { planVersionId: version }));
    const before = clone(h.state.roles), writes = h.state.writes;
    assert.match(h.post({ action: 'completeworkshop', request: x.request }).error, /採用計画と工作指示が一致/);
    assert.equal(h.state.writes, writes); assert.deepEqual(h.state.roles, before);
});

test('unknown operator and tampered role revision reject completion before side effects', () => {
    const h = fixture(), x = h.issue(), writes = h.state.writes;
    assert.equal(h.post({ action: 'completeworkshop', request: { ...x.request, operatorId: 'forged' } }).success, false);
    assert.equal(h.post({ action: 'completeworkshop', request: { ...x.request, expectedRolesRevision: 'stale' } }).success, false);
    assert.equal(h.state.writes, writes);
});

test('mutation guard stops instruction edits inside the lock while a completion is pending', () => {
    const h = fixture(), x = h.issue(); h.state.failRoleWrite = true;
    assert.equal(h.post({ action: 'completeworkshop', request: x.request }).success, false);
    const journal = h.gas.createWorkshopOperationStore_(h.state.tables.get('_WorkshopOperations_v1'), h.gas.RollWorkshopRecovery, h.lock, () => {});
    const guard = h.gas.createWorkshopMutationGuard_(journal, h.lock, h.gas.RollWorkshopRecovery, h.gas.RollWorkshopInstructions, h.gas.RollWorkshopAdoption);
    const store = h.gas.createWorkshopInstructionStore_(h.state.tables.get('_WorkshopInstructions_v1'), h.gas.RollWorkshopInstructions, h.lock, () => {}, guard);
    const writes = h.state.writes;
    assert.throws(() => store.execute({ instructionId: x.instruction.id, requestId: 'ack', expectedRevision: 1,
        kind: 'acknowledge', payload: {} }, () => ({ actor: h.state.principal, today: '2026-10-25', now: '2026-10-25T02:00:00Z' })), /先に復旧/);
    assert.equal(h.state.writes, writes); assert.equal(h.state.held, false);
});

test('batch issue checks every target before writing even its first unrelated instruction', () => {
    const h = fixture(), x = h.issue();
    const body = h.plan(null, 'draft-batch', 'save_draft', { items: [
        { standId: '16', donorRoleId: 'D', recipientRoleId: 'F', readyBy: '2026-11-01' },
        { standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2026-11-01' }
    ], reason: 'batch' }); body.command.planId = 'batch-plan';
    const draft = h.ok(body).record;
    body.command = { planId: draft.id, requestId: 'adopt-batch', kind: 'adopt', expectedRevision: draft.revision,
        payload: { planVersionId: h.gas.RollWorkshopAdoption.project(draft).draft.planVersionId } };
    h.ok(body); h.state.failRoleWrite = true;
    assert.equal(h.post({ action: 'completeworkshop', request: x.request }).success, false);
    const writes = h.state.writes;
    assert.match(h.post({ action: 'issueworkshopplan', planId: draft.id, request: { requestId: 'issue-batch' } }).error, /先に復旧/);
    assert.equal(h.state.writes, writes); assert.equal(h.ok({ action: 'fetchworkshop' }).instructions.length, 1);
});

for (const method of ['addRoleFromInputArea', 'sortRolesSheet', 'debugSortRolesSheet',
    'updateRolesHeader', 'importRollHistorySheetsFromSource', 'initializeRollHistoryStatusSync',
    'refreshRollManagementView', 'refreshFieldRollManagementView', 'syncRollHistoryActuals16_17', 'syncRollHistoryActualsAll']) {
    test('pending completion blocks maintenance before any mutation: ' + method, () => {
        const h = fixture(), x = h.issue(); h.state.failRoleWrite = true;
        assert.equal(h.post({ action: 'completeworkshop', request: x.request }).success, false);
        const writes = h.state.writes;
        assert.throws(() => h.gas[method](), /先に復旧してから管理操作/);
        assert.equal(h.state.writes, writes); assert.equal(h.state.held, false);
    });
}

test('enabled workshop mode with deleted operation sheet fails closed for ordinary and maintenance writes', () => {
    const h = fixture(); h.state.tables.delete('_WorkshopOperations_v1'); h.lock.tryLock();
    assert.throws(() => h.gas.assertWorkshopRolesWriteAllowed_(h.state.roles, h.state.roles), /未反映操作シートがありません/);
    h.lock.releaseLock();
    assert.throws(() => h.gas.sortRolesSheet(), /未反映操作シートがありません/);
    assert.equal(h.state.held, false); assert.equal(h.state.writes, 0);
});

test('maintenance can proceed after recovery and does not keep a save lock while showing an alert', () => {
    const h = fixture(), x = h.issue(); h.state.failRoleWrite = true;
    assert.equal(h.post({ action: 'completeworkshop', request: x.request }).success, false);
    h.state.failRoleWrite = false;
    assert.equal(h.ok({ action: 'completeworkshop', request: x.request }).status, 'complete');
    h.gas.addRoleFromInputAreaLocked_ = () => { assert.equal(h.state.held, true); return { added: true, message: 'fixture added' }; };
    let alerts = 0;
    h.gas.SpreadsheetApp.getUi = () => ({ alert(message) { alerts++; assert.equal(h.state.held, false); assert.equal(message, 'fixture added'); } });
    assert.equal(h.gas.addRoleFromInputArea().added, true); assert.equal(alerts, 1);
});
