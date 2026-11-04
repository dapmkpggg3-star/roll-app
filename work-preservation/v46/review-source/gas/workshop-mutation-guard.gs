// Caller owns the shared script lock. Inspect the whole batch before writing.
function createWorkshopMutationGuard_(journal, lock, recovery, instructionDomain, planDomain) {
  return function(changes) {
    if (!lock.hasLock()) throw new Error('工作指示・計画の保存ロックがありません。');
    var instructionIds = new Set(), planIds = new Set(), roleIds = new Set();
    function roles(item) {
      [item.donorRoleId, item.recipientRoleId].forEach(function(id) { if (id != null) roleIds.add(String(id)); });
    }
    (changes.instructions || []).filter(Boolean).forEach(function(record) {
      var definition = instructionDomain.project(record).definition;
      instructionIds.add(record.id); if (definition.planId) planIds.add(definition.planId); roles(definition);
    });
    (changes.plans || []).filter(Boolean).forEach(function(record) {
      var view = planDomain.project(record); planIds.add(record.id);
      [view.draft, view.adoption].filter(Boolean).forEach(function(version) { version.items.forEach(roles); });
    });
    journal.list().forEach(function(record) {
      recovery.validate(record);
      if (record.status === 'complete') return;
      var instruction = record.intent.instructionAfter;
      var definition = instructionDomain.project(instruction).definition;
      if (instructionIds.has(instruction.id) || planIds.has(definition.planId)
          || record.intent.roleChanges.some(function(change) { return roleIds.has(String(change.roleId)); })) {
        throw new Error('関連する工作完了が未反映です。先に復旧してから指示・計画を変更してください。');
      }
    });
  };
}
