// Editor-only, read-only check of the specified Google validation copy.
// Does not issue, complete, retry, repair, or delete any operation.
function runWorkshopValidationPreflight() {
  var ss = workshopValidationEnvironment_(), lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var names = ['_WorkshopPlans_v1', '_WorkshopInstructions_v1', '_WorkshopOperations_v1'];
    function snapshot() {
      return JSON.stringify(names.map(function(name) {
        var sheet = ss.getSheetByName(name);
        if (!sheet) throw new Error('検証記録シートがありません：' + name);
        return sheet.getDataRange().getValues();
      }));
    }
    var before = snapshot(), roles = fetchRoles(), revision = rolesRevision_(roles);
    var operations = createWorkshopOperationStore_(ss.getSheetByName(names[2]), RollWorkshopRecovery, lock, function() {}).list();
    var instructions = createWorkshopInstructionStore_(ss.getSheetByName(names[1]), RollWorkshopInstructions, lock, function() {}).list();
    var plans = createWorkshopPlanStore_(ss.getSheetByName(names[0]), RollWorkshopAdoption, lock, function() {}).list();
    var history = createWorkshopHistoryPort_(ss, lock, function() { SpreadsheetApp.flush(); });
    var issues = [], verified = 0;
    operations.forEach(function(operation) {
      if (operation.status !== 'complete') { issues.push({ kind: 'pending', operationId: operation.id }); return; }
      var receipt = RollWorkshopRecovery.receipt(operation), intent = operation.intent;
      var record = instructions.filter(function(item) { return item.id === intent.instructionAfter.id; })[0];
      if (!record) { issues.push({ kind: 'missing_instruction', operationId: operation.id }); return; }
      var version = RollWorkshopInstructions.reflectionRevision(record);
      var prefix = Object.assign({}, record, { revision: version, events: record.events.slice(0, version) });
      if (!RollWorkshopRecovery.same(prefix, intent.instructionAfter)) {
        issues.push({ kind: 'instruction_changed', operationId: operation.id }); return;
      }
      var matches = intent.roleChanges.every(function(change) {
        var current = roles.filter(function(role) { return String(role.id) === change.roleId; });
        return current.length === 1 && RollWorkshopRecovery.same(current[0], change.after);
      });
      if (!matches) { issues.push({ kind: 'roles_changed', operationId: operation.id }); return; }
      if (!RollWorkshopRecovery.same(history.read(intent.historyProjection.after), intent.historyProjection.after)) {
        issues.push({ kind: 'history_changed', operationId: operation.id }); return;
      }
      if (receipt.status !== 'complete') throw new Error('保存証拠を検証できません。');
      verified++;
    });
    if (before !== snapshot() || revision !== rolesRevision_(fetchRoles())) {
      throw new Error('確認中にデータが変わりました。更新せず再確認してください。');
    }
    var result = { mode: 'READ_ONLY_GOOGLE_PREFLIGHT', unchanged: true,
      planCount: plans.length, instructionCount: instructions.length, operationCount: operations.length,
      verifiedCompletions: verified, issues: issues, ready: issues.length === 0,
      scriptOwnerExecution: true, firebaseBrowserTest: false };
    console.log('WORKSHOP_PREFLIGHT_RESULT ' + JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}
