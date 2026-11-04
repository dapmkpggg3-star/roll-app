(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./workshop-instructions'));
    else root.RollWorkshopClient = factory(root.RollWorkshopInstructions);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(domain) {
    'use strict';
    const DONE = '新品予備（組込完了）';
    const KEY = 'rollWorkshopPending.v1';
    function fail(message) { throw new Error(message); }

    // Transport, storage, account and session boundaries are supplied by the app.
    // A persisted request is never regenerated after an uncertain response.
    function create(ports) {
        let busy = false;
        return { async complete(input) {
            if (busy) fail('工作完了を確認中です。少し待ってください。');
            busy = true;
            const session = ports.captureSession();
            try {
                const owner = ports.owner();
                if (!owner) fail('ログインしてください。');
                const localBefore = ports.localSnapshot();
                const assertLocal = () => {
                    session.assertCurrent();
                    if (localBefore !== ports.localSnapshot()) fail('確認中に端末の内容が変わりました。入力を残して停止しました。再度更新してください。');
                };
                let pending;
                try { pending = JSON.parse(ports.storage.getItem(KEY) || 'null'); }
                catch (_) { fail('工作の送信記録が読めません。削除せず確認してください。'); }
                if (pending && (pending.owner !== owner || !pending.request
                    || String(pending.request.recipientRoleId) !== String(input.roleId))) {
                    fail('別の工作完了が確認途中です。先にそのロールの更新を再確認してください。');
                }
                if (!pending) {
                    const snapshot = await ports.call({ action: 'fetchworkshop' });
                    assertLocal();
                    if (!Array.isArray(snapshot.instructions) || !Array.isArray(snapshot.roles) || !snapshot.rolesRevision) {
                        fail('工作指示とロールの状態を確認できません。');
                    }
                    const candidates = snapshot.instructions.filter(record => {
                        const view = domain.project(record);
                        return view.definition.recipientRoleId === String(input.roleId) && !view.actuals.prepared;
                    });
                    if (!candidates.length) return { handled: false };
                    if (candidates.length !== 1) fail('同じロールに複数の工作指示があります。指示を確認してください。');
                    if (input.hasOtherChanges) fail('工作指示の組込完了と、径・メモなどの変更を同時には保存できません。入力は残しています。分けて更新してください。');
                    if (ports.snapshot(snapshot.roles) !== localBefore) fail('表と端末に違いがあります。先に同期してから組込完了へ更新してください。');
                    const record = candidates[0], view = domain.project(record);
                    pending = { owner, baseline: localBefore, request: { instructionId: record.id, cycleId: view.definition.cycleId,
                        recipientRoleId: String(input.roleId), operatorId: input.operatorId,
                        requestId: ports.makeId(), expectedInstructionRevision: record.revision,
                        expectedRolesRevision: snapshot.rolesRevision, fromStatus: input.fromStatus,
                        toStatus: DONE, on: input.on } };
                    ports.storage.setItem(KEY, JSON.stringify(pending)); // Fail before POST if persistence fails.
                } else if (input.hasOtherChanges) {
                    fail('前回の工作完了を確認します。ほかの入力変更を分けてから再度更新してください。');
                }
                assertLocal();
                let receipt;
                try { receipt = await ports.call({ action: 'completeworkshop', request: pending.request }); }
                catch (error) {
                    session.assertCurrent();
                    if (error.workshopRejectedRequestId === pending.request.requestId) ports.storage.removeItem(KEY);
                    throw error;
                }
                assertLocal();
                if (!receipt || receipt.status !== 'complete' || !receipt.instruction
                    || receipt.instruction.id !== pending.request.instructionId) {
                    fail('工作完了の反映がまだ確認できません。入力を残しています。同じ更新操作で再確認してください。');
                }
                for (const target of ['roles', 'rollHistory']) {
                    if (!Array.isArray(receipt.effectReceipts) || !receipt.effectReceipts.some(item =>
                        item.target === target && item.state === 'verified' && item.instructionId === pending.request.instructionId
                        && item.instructionRevision === pending.request.expectedInstructionRevision + 1 && item.operationId === receipt.operationId)) {
                        fail('工作完了の反映確認が不足しています。同じ更新操作で再確認してください。');
                    }
                }
                const current = await ports.call({ action: 'fetchworkshop' });
                assertLocal();
                const record = current.instructions && current.instructions.find(item => item.id === pending.request.instructionId);
                if (!record || !domain.project(record).actuals.prepared || !record.events.some(event =>
                    event.requestId === pending.request.requestId && event.kind === 'actual_recorded' && event.stage === 'prepared') || !Array.isArray(current.roles)
                    || !current.rolesRevision || !Array.isArray(current.tasks)) fail('工作完了後の最新状態を確認できません。');
                if (localBefore !== pending.baseline && ports.snapshot(current.roles) !== localBefore) {
                    fail('前回送信後の端末変更が残っています。工作完了の記録は保持し、端末の入力を上書きせず停止しました。');
                }
                // Current data can legitimately be newer than the old receipt.
                ports.accept(current);
                ports.storage.removeItem(KEY);
                const task = current.tasks.find(item => item.instructionId === record.id);
                return { handled: true, task, instructionId: record.id };
            } finally { busy = false; }
        } };
    }
    return { create, storageKey: KEY };
});
