const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const domain = require('../js/workshop-instructions');
const recovery = require('../js/workshop-recovery');
const clone = value => JSON.parse(JSON.stringify(value));
const revision = value => require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
const code = expected => error => error.code === expected;

function harness(configurePorts) {
    const state = { held: false, faults: new Set(), writes: {}, journalWrites: 0,
        roles: [
            { id: 'A', name: '#14-901', status: '中古予備（バラシ前）', history: [], memo: '保持' },
            { id: 'B', name: '#14-902', status: 'オンライン', history: [], useStartDate: '2031-01-01' },
            { id: 'C', name: '#14-903', status: '新品予備（組替可能）', history: [], useStartDate: '' }
        ], history: [{ bindingId: 'fixture-status-A', value: '中古予備（バラシ前）' },
            { bindingId: 'fixture-status-C', value: '新品予備（組替可能）' }] };
    const ctx = { actor: { id: 'fixture-user', role: 'editor' }, today: '2031-01-20', now: '2031-01-20T02:00:00Z',
        operators: [{ id: 'fixture-operator', name: '試験担当' }], adoption: { id: 'adopted', planVersionId: 'v1', status: 'adopted', items: [
            { id: 'item', cycleId: 'cycle', standId: '14', donorRoleId: 'A', recipientRoleId: 'C', readyBy: '2031-01-21' }
        ] } };
    const instruction = domain.apply(null, { instructionId: domain.instructionIdFor('cycle'), requestId: 'issue', expectedRevision: 0,
        kind: 'issue', payload: { adoptionId: 'adopted', planItemId: 'item' } }, ctx).record;
    const lock = { tryLock() { if (state.held) return false; state.held = true; return true; },
        hasLock: () => state.held, releaseLock() { state.held = false; } };
    function fault(label) {
        if (state.faults.delete(label)) throw new Error('injected failure: ' + label);
    }
    function sheet(name, rows) {
        return { getName: () => name, getLastRow: () => rows.length,
            getDataRange: () => ({ getValues: () => clone(rows) }),
            getRange: row => ({ setValues(values) { rows[row - 1] = clone(values[0]); if (name === '_WorkshopOperations_v1') state.journalWrites++; },
                getValues: () => [clone(rows[row - 1])] }) };
    }
    const box = vm.createContext({});
    for (const file of ['workshop-operation-store.gs', 'workshop-instruction-store.gs']) {
        vm.runInContext(fs.readFileSync(require.resolve('../gas/' + file), 'utf8'), box);
    }
    state.journalRows = [['operationId', 'recordJson']];
    state.instructionRows = [['instructionId', 'recordJson'], [instruction.id, JSON.stringify(instruction)]];
    const journal = box.createWorkshopOperationStore_(sheet('_WorkshopOperations_v1', state.journalRows), recovery, lock,
        () => fault('journal-flush:' + state.journalWrites));
    const instructionStore = box.createWorkshopInstructionStore_(sheet('_WorkshopInstructions_v1', state.instructionRows), domain, lock,
        () => fault('instruction-flush'));
    const before = clone(state.roles);
    const request = { requestId: 'complete-fixture', instructionId: instruction.id, cycleId: 'cycle', recipientRoleId: 'C',
        operatorId: 'fixture-operator', expectedRolesRevision: revision(before), expectedInstructionRevision: 1,
        fromStatus: '新品予備（組替可能）', toStatus: '新品予備（組込完了）', on: '2031-01-20' };
    const ports = { lock,
        journal: { list: () => journal.list(), read: id => journal.read(id), put(expected, next) {
            assert.equal(state.held, true);
            const label = !expected ? 'journal:create' : next.status === 'complete' ? 'journal:complete'
                : next.status === 'blocked' ? 'journal:blocked' : 'journal:check:' + next.checks[next.checks.length - 1];
            fault(label + ':before'); journal.put(expected, next); fault(label + ':after');
        } },
        roles: { list: () => clone(state.roles), revision,
            read: id => { fault('role:' + id + ':read'); return clone(state.roles.find(role => role.id === id) || null); },
            compareAndSet(id, expected, next) {
                assert.equal(state.held, true); fault('role:' + id + ':before');
                const index = state.roles.findIndex(role => role.id === id);
                assert.deepEqual(state.roles[index], expected);
                state.roles[index] = clone(next); state.writes['role:' + id] = (state.writes['role:' + id] || 0) + 1;
                fault('role:' + id + ':after');
            } },
        history: { prepare(changes) {
            return { before: clone(state.history), after: state.history.map((entry, index) => ({ ...entry, value: changes[index].after.status })) };
        }, read(bindings) {
            fault('history:read');
            return bindings.map(entry => clone(state.history.find(current => current.bindingId === entry.bindingId) || null));
        }, compareAndSet(expected, next) {
            assert.equal(state.held, true);
            const key = 'history:' + next[0].bindingId; fault(key + ':before');
            const index = state.history.findIndex(entry => entry.bindingId === next[0].bindingId);
            assert.deepEqual(state.history[index], expected[0]); state.history[index] = clone(next[0]);
            state.writes[key] = (state.writes[key] || 0) + 1; fault(key + ':after');
        } },
        instructions: { read: id => instructionStore.read(id), compareAndSet(id, expected, next) {
            fault('instruction:before'); instructionStore.compareAndSet(id, expected, next);
            state.writes.instruction = (state.writes.instruction || 0) + 1; fault('instruction:after');
        } }
    };
    if (configurePorts) configurePorts(ports, state, lock);
    const coordinator = recovery.createCoordinator(ports);
    return { state, ctx, request, before, ports, coordinator, journal, instructionStore, lock,
        resolve: () => { assert.equal(state.held, true); return ctx; } };
}

function writeGuard(h) {
    const box = vm.createContext({ RollWorkshopRecovery: recovery,
        PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
        LockService: { getScriptLock: () => h.lock }, SpreadsheetApp: { flush() {} },
        openRollManagementSpreadsheet_: () => ({ getSheetByName: name => name === '_WorkshopOperations_v1' ? ({
            getName: () => '_WorkshopOperations_v1',
            getDataRange: () => ({ getValues: () => clone(h.state.journalRows) })
        }) : null })
    });
    for (const file of ['workshop-operation-store.gs', 'workshop-write-guard.gs']) {
        vm.runInContext(fs.readFileSync(require.resolve('../gas/' + file), 'utf8'), box);
    }
    return box.assertWorkshopRolesWriteAllowed_;
}

test('pending completion blocks normal edits, deletion and renaming but allows unrelated rolls', () => {
    const h = harness(); h.state.faults.add('role:A:before');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), /injected failure/);
    const guard = writeGuard(h); h.lock.tryLock();
    for (const change of [roles => { roles[0].memo = 'new'; }, roles => roles.splice(0, 1),
        roles => { roles[0].name = '#14-999'; }, roles => { roles[2].status = 'オンライン'; }]) {
        const next = clone(h.state.roles); change(next);
        assert.throws(() => guard(h.state.roles, next), /先に復旧/);
    }
    const unrelated = clone(h.state.roles); unrelated[1].memo = '別ロール';
    assert.doesNotThrow(() => guard(h.state.roles, unrelated));
    assert.throws(() => guard(null, null), /直接編集した内容は残し/);
    assert.throws(() => guard(h.state.roles, h.state.roles, null, ['#14-901']), /先に復旧/);
    h.lock.releaseLock();
});

test('guard permits only exact journal effects, not an operation ID used to bypass conflict checks', () => {
    const h = harness(); h.state.faults.add('role:A:before');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    const guard = writeGuard(h), record = h.journal.list()[0]; h.lock.tryLock();
    const next = clone(h.state.roles); next[0] = clone(record.intent.roleChanges[0].after);
    assert.doesNotThrow(() => guard(h.state.roles, next, record.id));
    next[0].memo = 'unauthorized extra change';
    assert.throws(() => guard(h.state.roles, next, record.id), /異なる更新/);
    assert.throws(() => guard(h.state.roles, next, 'nonexistent'), /対象を確認/);
    h.lock.releaseLock();
});

test('coordinator passes the durable operation ID through role writes to the guard', () => {
    let guard;
    const h = harness((ports, state) => {
        const write = ports.roles.compareAndSet;
        ports.roles.compareAndSet = (id, before, after, operationId) => {
            const next = clone(state.roles); next[next.findIndex(role => role.id === id)] = after;
            guard(state.roles, next, operationId); write(id, before, after);
        };
    });
    guard = writeGuard(h);
    assert.equal(h.coordinator.execute(h.request, h.resolve).status, 'complete');
    h.lock.tryLock();
    const next = clone(h.state.roles); next[2].status = 'オンライン';
    assert.doesNotThrow(() => guard(h.state.roles, next));
    assert.throws(() => guard(h.state.roles, next, recovery.operationIdFor(h.request.requestId)), /対象を確認/);
    h.lock.releaseLock();
});

test('guard refuses unlocked or corrupt journals and never interprets them as no pending work', () => {
    const h = harness(), guard = writeGuard(h);
    assert.throws(() => guard(h.state.roles, h.state.roles), /ロック/);
    h.lock.tryLock(); h.state.journalRows.push(['bad', '{}']);
    assert.throws(() => guard(h.state.roles, h.state.roles));
    h.lock.releaseLock();
});

function formulaHistory(ports, state, lock) {
    const box = vm.createContext({});
    for (const file of ['google-apps-script.gs', 'gas/workshop-history-port.gs']) {
        vm.runInContext(fs.readFileSync(require.resolve('../' + file), 'utf8'), box);
    }
    const rows = Array.from({ length: 40 }, () => Array(36).fill(''));
    const ids = ['A', 'C'];
    ids.forEach((id, i) => {
        rows[2 + i * 16][0] = '#14st';
        rows[4 + i * 16][0] = state.roles.find(role => role.id === id).name.replace('#14-', '14-上-');
    });
    const sheet = { getSheetId: () => 456, getLastRow: () => 40, getLastColumn: () => 36,
        getRange(row, column, height) {
            if (height) return { getDisplayValues: () => rows };
            const id = ids[(row - 2) / 16], role = state.roles.find(role => role.id === id);
            assert.ok(role);
            return { getFormula: () => state.badFormula ? '' : box.buildRollHistoryStatusFormula(role.name),
                getNote: () => 'ROLL_STATUS_SYNC|' + role.name,
                getDisplayValue: () => box.buildRollHistoryStatusDisplay(role.name,
                    state.staleFormula ? (id === 'A' ? '中古予備（バラシ前）' : '新品予備（組替可能）') : role.status) };
        }
    };
    ports.history = box.createWorkshopHistoryPort_({ getSheetByName: () => sheet }, lock, () => {});
}

test('real history adapter participates in durable completion and retry after recalculation delay', () => {
    const h = harness(formulaHistory); h.state.staleFormula = true;
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), /未反映のまま/);
    assert.equal(domain.project(h.instructionStore.read(h.request.instructionId)).progress, 'issued');
    assert.equal(h.journal.list()[0].status, 'pending');
    assert.equal(h.state.roles[2].status, '新品予備（組込完了）');
    h.state.staleFormula = false;
    const result = h.coordinator.execute(h.request, h.resolve);
    assert.equal(result.status, 'complete'); assert.equal(result.effectReceipts.length, 2);
    assert.equal(h.state.writes['role:A'], 1); assert.equal(h.state.writes['role:C'], 1);
});

test('missing live status formula fails before durable operation creation and all role writes', () => {
    const h = harness(formulaHistory); h.state.badFormula = true;
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), /ロール更新前に停止/);
    assert.equal(h.journal.list().length, 0); assert.deepEqual(h.state.roles, h.before);
});

test('one status edit saves recovery intent first, then verifies pair, history cells and instruction', () => {
    const h = harness(), result = h.coordinator.execute(h.request, h.resolve);
    assert.equal(result.status, 'complete'); assert.equal(result.effectReceipts.length, 2);
    assert.equal(h.state.roles[0].status, '改削行き（搬出可能）');
    assert.equal(h.state.roles[2].status, '新品予備（組込完了）');
    assert.deepEqual(h.state.roles[1], h.before[1]); assert.equal(h.state.roles[2].useStartDate, '');
    assert.equal(domain.project(h.instructionStore.read(h.request.instructionId)).progress, 'prepared');
    assert.equal(domain.taskView(result.instruction, h.instructionStore.read(result.instruction.id), h.ctx.today, result.effectReceipts).assemblyTask, 'completed');
    assert.equal(h.state.held, false);
});

for (const point of ['journal:create:before', 'journal:create:after', 'journal-flush:1',
    'role:A:before', 'role:A:after', 'journal:check:role:A:after', 'role:C:after',
    'history:fixture-status-A:after', 'history:fixture-status-C:before', 'instruction:after',
    'instruction-flush', 'journal:complete:before', 'journal:complete:after']) {
    test('lost write/response recovers without duplicate side effects: ' + point, () => {
        const h = harness(); h.state.faults.add(point);
        assert.throws(() => h.coordinator.execute(h.request, h.resolve), /injected failure/);
        assert.equal(h.state.held, false);
        const pending = h.journal.read(recovery.operationIdFor(h.request.requestId));
        if (pending && pending.status !== 'complete') assert.equal(recovery.receipt(pending).effectReceipts.length, 0);
        const result = h.coordinator.execute(h.request, h.resolve);
        assert.equal(result.status, 'complete');
        for (const key of ['role:A', 'role:C', 'history:fixture-status-A', 'history:fixture-status-C']) assert.equal(h.state.writes[key], 1);
        assert.equal(h.state.roles[0].history.length, 1); assert.equal(h.state.roles[2].history.length, 1);
        assert.equal(h.instructionStore.read(h.request.instructionId).events.length, 2);
        assert.equal(h.journal.list().length, 1);
    });
}
test('failure to durably save the operation leaves every business destination unchanged', () => {
    const h = harness(); h.state.faults.add('journal:create:before');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    assert.deepEqual(h.state.roles, h.before); assert.deepEqual(h.state.writes, {});
    assert.equal(h.instructionStore.read(h.request.instructionId).revision, 1);
});
test('manual edit during a partial operation blocks all remaining writes instead of overwriting', () => {
    const h = harness(); h.state.faults.add('role:A:after');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    h.state.roles[2].memo = '別の人による訂正'; const writes = clone(h.state.writes);
    const result = h.coordinator.execute(h.request, h.resolve);
    assert.equal(result.status, 'blocked'); assert.equal(result.problem.target, 'role:C');
    assert.deepEqual(h.state.writes, writes); assert.equal(h.state.roles[2].memo, '別の人による訂正');
    assert.equal(result.effectReceipts.length, 0); assert.equal(h.instructionStore.read(h.request.instructionId).revision, 1);
});
test('a new status request cannot bypass an outstanding operation on the same pair', () => {
    const h = harness(); h.state.faults.add('role:A:after');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    assert.throws(() => h.coordinator.execute({ ...h.request, requestId: 'second-request' }, h.resolve), code('PENDING_OPERATION'));
    assert.throws(() => h.coordinator.assertNoPending({ roleIds: ['A'] }), code('LOCK_REQUIRED'));
    h.state.held = true;
    assert.throws(() => h.coordinator.assertNoPending({ roleIds: ['A'] }), code('PENDING_OPERATION'));
    assert.doesNotThrow(() => h.coordinator.assertNoPending({ roleIds: ['unrelated'] })); h.state.held = false;
});
test('completed retries never roll back a later online exchange or rewrite history', () => {
    const h = harness(), initial = h.coordinator.execute(h.request, h.resolve), writes = clone(h.state.writes);
    h.state.roles[2].status = 'オンライン'; h.state.roles[2].useStartDate = '2031-01-22';
    const result = h.coordinator.execute(h.request, h.resolve);
    assert.deepEqual(h.state.writes, writes); assert.equal(h.state.roles[2].status, 'オンライン');
    assert.equal(h.state.roles[2].useStartDate, '2031-01-22'); assert.deepEqual(result.effectReceipts, initial.effectReceipts);
});
test('completed retries return the current instruction without certifying a later unverified revision', () => {
    const h = harness(), first = h.coordinator.execute(h.request, h.resolve);
    const current = h.instructionStore.execute({ instructionId: h.request.instructionId, requestId: 'correction',
        expectedRevision: 2, kind: 'correct_actual', payload: { targetEventId: domain.project(first.instruction).actualEventIds.prepared,
            on: '2031-01-19', reason: '日付訂正' } }, h.resolve).record;
    const result = h.coordinator.execute(h.request, h.resolve);
    assert.deepEqual(result.instruction, current); assert.equal(result.effectReceipts[0].instructionRevision, 2);
    assert.equal(domain.taskView(result.instruction, current, h.ctx.today, result.effectReceipts).assemblyTask, 'pending_confirmation');
});
test('pending recovery after a later exchange stops rather than restoring old roll snapshots', () => {
    const h = harness(); h.state.faults.add('history:fixture-status-A:before');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    h.state.roles[2].status = 'オンライン'; const writes = clone(h.state.writes);
    const result = h.coordinator.execute(h.request, h.resolve);
    assert.equal(result.status, 'blocked'); assert.deepEqual(h.state.writes, writes);
    assert.equal(h.state.roles[2].status, 'オンライン');
});
test('instruction changes while recovery is pending block before further roll writes', () => {
    const h = harness(); h.state.faults.add('journal:create:after');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    h.instructionStore.execute({ instructionId: h.request.instructionId, requestId: 'ack-other', expectedRevision: 1,
        kind: 'acknowledge', payload: {} }, h.resolve);
    const result = h.coordinator.execute(h.request, h.resolve);
    assert.equal(result.status, 'blocked'); assert.equal(result.problem.target, 'instruction');
    assert.deepEqual(h.state.roles, h.before);
});
test('a second authorized editor can explicitly resume but cannot reuse the original save request', () => {
    const h = harness(); h.state.faults.add('role:A:after');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    h.ctx.actor = { id: 'second-editor', role: 'editor' };
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), code('REQUEST_REUSED'));
    const result = h.coordinator.resume(recovery.operationIdFor(h.request.requestId), h.resolve);
    assert.equal(result.status, 'complete');
    const record = h.journal.read(result.operationId);
    assert.equal(record.intent.actorId, 'fixture-user'); assert.equal(record.lastAttemptBy, 'second-editor');
    assert.equal(h.state.roles[2].history[0].authenticatedActorId, 'fixture-user');
});
test('changed payload, extra client authority or reader identity cannot execute or resume', () => {
    const h = harness(); h.coordinator.execute(h.request, h.resolve);
    assert.throws(() => h.coordinator.execute({ ...h.request, on: '2031-01-19' }, h.resolve), code('REQUEST_REUSED'));
    assert.throws(() => h.coordinator.execute({ ...h.request, actor: { role: 'admin' } }, h.resolve), code('INVALID_INPUT'));
    h.ctx.actor.role = 'reader';
    assert.throws(() => h.coordinator.resume(recovery.operationIdFor(h.request.requestId), h.resolve), code('FORBIDDEN'));
    assert.equal(h.state.held, false);
});
test('missing or duplicated history bindings prevent the first business write', () => {
    for (const projection of [null, { before: [], after: [] }, { before: [{ bindingId: 'x', value: 1 }], after: [{ bindingId: 'y', value: 2 }] }]) {
        const h = harness(); h.ports.history.prepare = () => projection;
        assert.throws(() => h.coordinator.execute(h.request, h.resolve));
        assert.equal(h.journal.list().length, 0); assert.deepEqual(h.state.roles, h.before);
    }
});
test('existing instruction actual without its operation log is not blindly reconstructed', () => {
    const h = harness(); h.coordinator.execute(h.request, h.resolve); h.state.journalRows.splice(1);
    const writes = clone(h.state.writes);
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), code('MISSING_OPERATION'));
    assert.deepEqual(h.state.writes, writes);
});
test('a read failure leaves the operation pending without fabricated success receipts', () => {
    const h = harness(); h.state.faults.add('history:read');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    const record = h.journal.read(recovery.operationIdFor(h.request.requestId));
    assert.equal(record.status, 'pending'); assert.deepEqual(recovery.receipt(record).effectReceipts, []);
    assert.deepEqual(h.state.roles, h.before);
});
test('corrupted operation intent and duplicate rows stop recovery without touching rolls', () => {
    const h = harness(); h.state.faults.add('journal:create:after');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    const row = clone(h.state.journalRows[1]), broken = JSON.parse(row[1]);
    broken.intent.roleChanges[0].after.memo = '勝手な上書き'; h.state.journalRows[1][1] = JSON.stringify(broken);
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), code('INVALID_OPERATION'));
    h.state.journalRows[1] = row; h.state.journalRows.push(clone(row));
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), /重複/);
    assert.deepEqual(h.state.roles, h.before);
});
test('journal capacity is checked before effects and includes space for final verification', () => {
    const h = harness(); h.state.roles[0].memo = 'a'.repeat(22000);
    h.request.expectedRolesRevision = revision(h.state.roles);
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), /保存容量/);
    assert.deepEqual(h.state.writes, {}); assert.equal(h.journal.list().length, 0);
});
test('journal and instruction compare-and-set reject stale snapshots or missing lock', () => {
    const h = harness(); h.state.faults.add('journal:create:after');
    assert.throws(() => h.coordinator.execute(h.request, h.resolve));
    const current = h.journal.list()[0], changed = { ...clone(current), revision: current.revision + 1 };
    assert.throws(() => h.journal.put(current, changed), /ロック/);
    assert.throws(() => h.instructionStore.compareAndSet(h.request.instructionId, current.intent.instructionBefore, current.intent.instructionAfter), /ロック/);
    h.state.held = true; h.journal.put(current, changed);
    assert.throws(() => h.journal.put(current, { ...changed, status: 'blocked' }), /更新されています/);
    h.state.held = false;
});
test('final content verification catches edits even after every step was marked verified', () => {
    const h = harness(), write = h.ports.instructions.compareAndSet;
    h.ports.instructions.compareAndSet = (...args) => { write(...args); h.state.roles[0].memo = '確認途中の変更'; };
    const result = h.coordinator.execute(h.request, h.resolve);
    assert.equal(result.status, 'blocked'); assert.equal(result.problem.target, 'role:A');
    assert.deepEqual(result.effectReceipts, []); assert.equal(h.state.roles[0].memo, '確認途中の変更');
});
test('a port that fails to reflect its write cannot manufacture a completion receipt', () => {
    const h = harness(); h.ports.roles.compareAndSet = () => {};
    assert.throws(() => h.coordinator.execute(h.request, h.resolve), code('UNCONFIRMED'));
    const pending = h.journal.list()[0]; assert.equal(pending.status, 'pending');
    assert.equal(pending.checks.length, 0); assert.deepEqual(recovery.receipt(pending).effectReceipts, []);
});
function rolesPortHarness() {
    const state = { held: true, writes: 0, roles: [{ id: 'A', status: 'before' }, { id: 'B', memo: '最新の他ロール情報' }], loseWrite: false };
    const box = vm.createContext({});
    vm.runInContext(fs.readFileSync(require.resolve('../gas/workshop-roles-port.gs'), 'utf8'), box);
    const port = box.createWorkshopRolesPort_(() => clone(state.roles), roles => {
        state.writes++; if (!state.loseWrite) state.roles = clone(roles);
    }, revision, { hasLock: () => state.held }, recovery);
    return { state, port };
}
test('legacy Roles adapter merges one target into fresh data and preserves unrelated edits', () => {
    const { state, port } = rolesPortHarness(), expected = clone(state.roles[0]), next = { ...expected, status: 'after' };
    port.compareAndSet('A', expected, next);
    assert.equal(state.roles[0].status, 'after'); assert.equal(state.roles[1].memo, '最新の他ロール情報');
    port.compareAndSet('A', expected, next); assert.equal(state.writes, 1);
});
test('legacy Roles adapter rejects changed targets, duplicate IDs and missing locks', () => {
    const { state, port } = rolesPortHarness(), expected = clone(state.roles[0]), next = { ...expected, status: 'after' };
    state.roles[0].memo = '他の人の変更'; assert.throws(() => port.compareAndSet('A', expected, next), /別途更新/);
    state.roles.push(clone(state.roles[0])); assert.throws(() => port.list(), /重複/);
    state.held = false; assert.throws(() => port.compareAndSet('A', expected, next), /ロック/);
    assert.equal(state.writes, 0);
});
test('legacy Roles adapter confirms saved content rather than trusting the write return', () => {
    const { state, port } = rolesPortHarness(); state.loseWrite = true;
    assert.throws(() => port.compareAndSet('A', clone(state.roles[0]), { id: 'A', status: 'after' }), /反映内容/);
    assert.equal(state.roles[0].status, 'before');
});
