const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createSessionFence } = require('../js/identity');

function harness() {
    const fields = Object.fromEntries(['name', 'status', 'coating-status', 'current-diameter', 'dispatch-date',
        'order-expected-delivery-date', 'assembly-instruction-due', 'use-start-date', 'use-end-date', 'arrival-date',
        'memo', 'is-active-three-set', 'next-assembly-planned'].map(key => ['role-' + key, { id: 'role-' + key, value: '', checked: false }]));
    fields['role-name'].value = '#14-903'; fields['role-status'].value = '新品予備（組込完了）';
    const state = { calls: [], canceled: 0, rendered: 0, toasts: [], legacy: 0 }, fence = createSessionFence();
    const empty = () => '', identity = value => value || '';
    const context = vm.createContext({ editingId: 'C', roles: [{ id: 'C', name: '#14-903', status: '新品予備（組替可能）' }],
        NEW_INSTALLED_STATUS: '新品予備（組込完了）', ONLINE_STATUS: 'オンライン', ORDERED_WAITING_STATUS: '発注済み（納入待ち）',
        window: {}, localStorage: { getItem: () => null }, RollWorkshopClient: { storageKey: 'pending' },
        document: { getElementById: id => fields[id], querySelectorAll: () => Object.values(fields) },
        warnIfOperatorMissing: () => false, normalizeCoatingStatusValue: identity, normalizeCurrentDiameter: identity,
        getDiameterChangeReason: empty, isDispatchDateAllowedStatus: () => false, isAssemblyInstructionDueAllowedStatus: () => true,
        isUseEndDateAllowedStatus: () => true, isArrivalDateAllowedStatus: () => false, normalizeDateInputValue: identity,
        normalizeRoleStatusValue: identity, normalizeUseStartDate: identity, normalizeAssemblyInstructionDueDateInput: identity,
        getRoleDispatchDate: empty, getRoleArrivalDate: empty, getRoleOrderExpectedDeliveryDate: empty,
        getRoleAssemblyInstructionDue: empty, isWorkshopCompletionEnabled: () => true,
        captureSyncSession: fence.capture, getCurrentOperator: () => ({ id: 'operator-kibata' }), getTodayDateString: () => '2026-10-25',
        completeWorkshopFromStatusEdit: async (input, check) => { state.calls.push(input); check(); return { handled: true, task: { assemblyTask: 'completed' } }; },
        cancelEdit: () => { state.canceled++; }, renderRoles: () => { state.rendered++; },
        showToast: msg => state.toasts.push(msg), setSyncMessage() {}, scrollToRoleCard() {}, lastScrollY: 0,
        // The new branch must return before any of the old local-mutation paths.
        validateOnlineAssignment: () => { state.legacy++; return false; }
    });
    const source = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
    vm.runInContext(source.slice(source.indexOf('async function updateRole()'), source.indexOf('\nfunction cancelEdit()')), context);
    return { context, state, fields, fence };
}

test('real updateRole keeps current status selector/operator and exits before legacy broad donor changes', async () => {
    const x = harness(); await x.context.updateRole();
    assert.equal(x.state.calls.length, 1); assert.equal(x.state.calls[0].operatorId, 'operator-kibata');
    assert.equal(x.state.calls[0].hasOtherChanges, false); assert.equal(x.state.legacy, 0);
    assert.equal(x.state.canceled, 1); assert.equal(x.state.rendered, 1);
    assert.match(x.state.toasts[0], /反映を確認/);
});

test('unfinished save leaves edit form and local roll intact without a success toast', async () => {
    const x = harness(); x.context.completeWorkshopFromStatusEdit = async () => { throw new Error('未反映'); };
    await x.context.updateRole();
    assert.equal(x.state.canceled, 0); assert.equal(x.state.rendered, 0); assert.equal(x.state.legacy, 0);
    assert.equal(x.context.roles[0].status, '新品予備（組替可能）'); assert.deepEqual(x.state.toasts, ['未反映']);
});

test('edit form changes during request are retained; logout suppresses old-session UI output', async () => {
    for (const kind of ['form', 'logout']) {
        const x = harness(); x.context.completeWorkshopFromStatusEdit = async (input, check) => {
            if (kind === 'form') x.fields['role-memo'].value = '新しい入力'; else x.fence.invalidate();
            check(); return { handled: true };
        };
        await x.context.updateRole(); assert.equal(x.state.canceled, 0); assert.equal(x.state.legacy, 0);
        if (kind === 'logout') assert.equal(x.state.toasts.length, 0);
        else assert.equal(x.fields['role-memo'].value, '新しい入力');
    }
});

test('disabled feature or no formal instruction keeps the legacy path available', async () => {
    for (const kind of ['disabled', 'unissued']) {
        const x = harness();
        if (kind === 'disabled') x.context.isWorkshopCompletionEnabled = () => false;
        else x.context.completeWorkshopFromStatusEdit = async () => ({ handled: false });
        await x.context.updateRole(); assert.equal(x.state.legacy, 1); assert.equal(x.state.canceled, 0);
    }
});
