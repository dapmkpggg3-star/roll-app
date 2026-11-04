// Adapter for the EXISTING Roles functions, not a new roll inventory.
// Dependencies: fetchRoles, writeRoles, rolesRevision_, shared script lock.
// Do not enable in doPost until all other writers honor pending-operation guards
// and a verified legacy-history/view binding adapter has been supplied.
function createWorkshopRolesPort_(fetchRoles, writeRoles, rolesRevision, lock, recovery) {
  function list() {
    var roles = fetchRoles(), ids = Object.create(null);
    if (!Array.isArray(roles)) throw new Error('ロール一覧が読めません。');
    roles.forEach(function(role) {
      var id = role && role.id != null ? String(role.id) : '';
      if (!id || Object.prototype.hasOwnProperty.call(ids, id)) throw new Error('ロールIDが不足・重複しています。');
      ids[id] = true;
    });
    return roles;
  }
  function read(id) { return list().filter(function(role) { return String(role.id) === String(id); })[0] || null; }
  return {
    list: list, read: read, revision: rolesRevision,
    compareAndSet: function(id, expected, next, operationId) {
      if (!lock.hasLock()) throw new Error('ロール保存のロックがありません。');
      if (!expected || !next || String(expected.id) !== String(id) || String(next.id) !== String(id)) {
        throw new Error('更新するロールIDが一致しません。');
      }
      var currentRoles = list();
      var index = currentRoles.findIndex(function(role) { return String(role.id) === String(id); });
      if (index < 0) throw new Error('対象ロールがありません。');
      if (recovery.same(currentRoles[index], next)) return;
      if (!recovery.same(currentRoles[index], expected)) throw new Error('対象ロールが別途更新されています。上書きせず停止しました。');
      // Preserve unrelated rolls from the latest read; never submit the old
      // whole-list snapshot that was captured when the operation began.
      var merged = JSON.parse(JSON.stringify(currentRoles));
      merged[index] = JSON.parse(JSON.stringify(next));
      writeRoles(merged, operationId);
      if (!recovery.same(read(id), next)) throw new Error('ロールの反映内容を確認できません。');
    }
  };
}
