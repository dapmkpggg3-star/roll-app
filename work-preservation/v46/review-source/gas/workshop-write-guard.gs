// Loaded together with the recovery module. Existing installations without
// these modules keep their current behavior. No API is enabled by this file.
function readWorkshopOperationsForWrite_() {
  var ss = openRollManagementSpreadsheet_();
  var sheet = ss.getSheetByName('_WorkshopOperations_v1');
  if (!sheet) {
    if (PropertiesService.getScriptProperties().getProperty('ROLL_WORKSHOP_API_MODE') === 'validation') {
      throw new Error('工作機能が有効ですが未反映操作シートがありません。保存を停止しました。');
    }
    return null;
  }
  var lock = LockService.getScriptLock();
  if (!lock.hasLock()) throw new Error('未反映操作の確認には保存ロックが必要です。');
  if (typeof RollWorkshopRecovery === 'undefined' || typeof createWorkshopOperationStore_ !== 'function') {
    throw new Error('未反映操作の確認機能が不足しています。保存を停止しました。');
  }
  var recovery = RollWorkshopRecovery;
  var journal = createWorkshopOperationStore_(sheet, recovery, lock, function() { SpreadsheetApp.flush(); });
  return journal.list(); // Validates every record; unreadable is not zero pending.
}

function assertWorkshopMaintenanceAllowed_() {
  var records = readWorkshopOperationsForWrite_();
  if (records && records.some(function(record) { return record.status !== 'complete'; })) {
    throw new Error('工作の未反映操作があります。先に復旧してから管理操作を実行してください。');
  }
}

function assertWorkshopRolesWriteAllowed_(before, after, operationId, touchedNames) {
  var records = readWorkshopOperationsForWrite_();
  if (records === null) {
    if (operationId) throw new Error('復旧操作の記録がありません。');
    return;
  }
  var recovery = RollWorkshopRecovery;
  var pending = records.filter(function(record) { return record.status !== 'complete'; });
  // Direct edits have already happened. The row's old ID may be gone, so pause
  // propagation conservatively while any operation remains unresolved.
  if (before === null || after === null) {
    if (pending.length) throw new Error('工作の未反映操作があります。直接編集した内容は残し、他への反映を停止しました。');
    assertWorkshopInstructionRolesAllowed_(before, after);
    return;
  }
  var previous = new Map(before.map(function(role) { return [String(role.id), role]; }));
  var next = new Map(after.map(function(role) { return [String(role.id), role]; }));
  var changed = Array.from(new Set(Array.from(previous.keys()).concat(Array.from(next.keys())))).filter(function(id) {
    return !recovery.same(previous.get(id) || null, next.get(id) || null);
  });
  var targets = new Set(changed);
  before.concat(after).forEach(function(role) {
    if ((touchedNames || []).indexOf(role.name) >= 0) targets.add(String(role.id));
  });
  var own = operationId && records.filter(function(record) { return record.id === operationId; })[0];
  if (operationId) {
    if (!own || own.status === 'complete' || changed.length > 1) throw new Error('復旧操作の対象を確認してください。');
    changed.forEach(function(id) {
      var change = own.intent.roleChanges.filter(function(item) { return String(item.roleId) === id; })[0];
      if (!change || !recovery.same(previous.get(id), change.before) || !recovery.same(next.get(id), change.after)) {
        throw new Error('復旧記録と異なる更新は許可されません。');
      }
    });
  }
  pending.forEach(function(record) {
    if (record.id !== operationId && record.intent.roleChanges.some(function(change) { return targets.has(String(change.roleId)); })) {
      throw new Error('対象ロールに工作の未反映操作があります。先に復旧してください。');
    }
  });
  if (!operationId) assertWorkshopInstructionRolesAllowed_(before, after);
}

// Ordinary saves must not silently bypass an issued assembly instruction.
// This also protects history-sheet imports; direct Roles edits remain in the
// sheet, but propagation stops when their current state contradicts an order.
function assertWorkshopInstructionRolesAllowed_(before, after) {
  var ss = openRollManagementSpreadsheet_();
  var sheet = ss.getSheetByName('_WorkshopInstructions_v1');
  var enabled = PropertiesService.getScriptProperties().getProperty('ROLL_WORKSHOP_API_MODE') === 'validation';
  if (!sheet && !enabled) return;
  if (!sheet || typeof RollWorkshopInstructions === 'undefined') throw new Error('工作指示を確認できないため保存を停止しました。');
  var lock = LockService.getScriptLock();
  if (!lock.hasLock()) throw new Error('工作指示の確認には保存ロックが必要です。');
  var active = createWorkshopInstructionStore_(sheet, RollWorkshopInstructions, lock, function() {}).list()
    .map(function(record) { return RollWorkshopInstructions.project(record); })
    .filter(function(view) { return !view.actuals.prepared; });
  var current = after === null ? fetchRoles() : after;
  active.forEach(function(view) {
    var def = view.definition;
    [def.donorRoleId, def.recipientRoleId].forEach(function(id) {
      var next = current.filter(function(role) { return String(role.id) === id; });
      var previous = before && before.filter(function(role) { return String(role.id) === id; });
      if (next.length !== 1 || (previous && (previous.length !== 1 || previous[0].name !== next[0].name
          || previous[0].status !== next[0].status))
          || (id === def.recipientRoleId && ['新品予備（組替可能）', '新品予備保管'].indexOf(next[0].status) < 0)
          || (id === def.donorRoleId && next[0].status !== '中古予備（バラシ前）')) {
        throw new Error('正式な工作指示の対象です。組込完了はアプリの工作連携から記録してください。指示の変更が必要な場合は先に指示を確認してください。');
      }
    });
  });
}
