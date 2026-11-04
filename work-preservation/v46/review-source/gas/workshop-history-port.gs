// Existing paired history sheets: verify the formula-driven status band.
// No cell writes, layout changes, or automatic formula repair. A formula that
// was replaced by a user must never be silently overwritten by recovery.
// Install with the existing history helpers and the coordinator's script lock.
function createWorkshopHistoryPort_(spreadsheet, lock, flush) {
  function fail(message) { throw new Error(message); }
  function requireLock() {
    if (!lock.hasLock()) fail('履歴表の確認ロックがありません。');
  }
  function resolve(roleName) {
    var match = /^#(\d+)-\d+$/.exec(roleName);
    if (!match) fail('履歴表のロール番号を確認してください。');
    var name = getRollHistorySheetNameForStandNumber(Number(match[1]));
    var sheet = name && spreadsheet.getSheetByName(name);
    if (!sheet) fail(roleName + ' の履歴表がありません。');
    var definitions = getRollHistoryStatusDefinitions(sheet).filter(function(item) {
      return item.roleName === roleName;
    });
    if (definitions.length !== 1) fail(roleName + ' の履歴欄が不足・重複しています。');
    var definition = definitions[0];
    if (definition.bannerRow < 1 || definition.startColumn < 1) fail('履歴表の対応位置を確認してください。');
    return { sheet: sheet, definition: definition };
  }
  function binding(found) {
    var d = found.definition;
    return JSON.stringify(['history-status-v1', found.sheet.getSheetId(), d.bannerRow, d.startColumn, d.roleName]);
  }
  function locate(id) {
    var parts;
    try { parts = JSON.parse(id); } catch (_) { fail('履歴表の対応先が読めません。'); }
    if (!Array.isArray(parts) || parts.length !== 5 || parts[0] !== 'history-status-v1'
        || !parts.slice(1, 4).every(Number.isSafeInteger) || typeof parts[4] !== 'string') {
      fail('履歴表の対応先が不正です。');
    }
    var found = resolve(parts[4]);
    // Sheet ID plus row/column and current role block must still agree.
    // Renames, shifted blocks, copies and duplicates require review.
    if (binding(found) !== id) fail('履歴表の位置が変更されています。自動反映せず確認してください。');
    return found;
  }
  function value(found) {
    var d = found.definition, cell = found.sheet.getRange(d.bannerRow, d.startColumn);
    return { formula: cell.getFormula(), note: cell.getNote(), display: cell.getDisplayValue() };
  }
  function expected(roleName, status) {
    return { formula: buildRollHistoryStatusFormula(roleName),
      note: ROLL_HISTORY_STATUS_NOTE_PREFIX + roleName,
      display: buildRollHistoryStatusDisplay(roleName, status) };
  }
  function read(bindings) {
    requireLock();
    if (!Array.isArray(bindings) || !bindings.length) fail('履歴表の確認対象がありません。');
    flush();
    return bindings.map(function(entry) {
      return { bindingId: entry.bindingId, value: JSON.stringify(value(locate(entry.bindingId))) };
    });
  }
  return {
    prepare: function(changes) {
      requireLock();
      if (!Array.isArray(changes) || changes.length !== 2) fail('工作組替の元・先を確認してください。');
      flush();
      var seen = Object.create(null), before = [], after = [];
      changes.forEach(function(change) {
        if (!change || !change.before || !change.after || change.before.name !== change.after.name
            || String(change.roleId) !== String(change.before.id) || String(change.roleId) !== String(change.after.id)) {
          fail('履歴表と組替ロールが一致しません。');
        }
        var name = change.before.name, found = resolve(name), id = binding(found);
        if (seen[id]) fail('工作組替の履歴欄が重複しています。');
        seen[id] = true;
        var current = value(found), expectedBefore = expected(name, change.before.status);
        if (JSON.stringify(current) !== JSON.stringify(expectedBefore)) {
          fail(name + ' の履歴表の数式・表示を確認できません。ロール更新前に停止しました。');
        }
        before.push({ bindingId: id, value: JSON.stringify(expectedBefore) });
        after.push({ bindingId: id, value: JSON.stringify(expected(name, change.after.status)) });
      });
      return { before: before, after: after };
    },
    read: read,
    compareAndSet: function(before, after) {
      requireLock();
      if (!Array.isArray(before) || !Array.isArray(after) || !before.length || before.length !== after.length
          || before.some(function(entry, i) { return !after[i] || entry.bindingId !== after[i].bindingId; })) {
        fail('履歴表の比較対象が一致しません。');
      }
      var current = read(after);
      if (JSON.stringify(current) === JSON.stringify(after)) return;
      // Roles has already been saved. Allow Sheets to recalculate, then verify.
      // Never replace a formula with a literal merely to make a check pass.
      if (JSON.stringify(current) !== JSON.stringify(before)) fail('履歴表が別途更新されています。上書きせず停止しました。');
      if (JSON.stringify(read(after)) !== JSON.stringify(after)) {
        fail('履歴表の計算結果がまだ一致しません。未反映のまま再確認してください。');
      }
    }
  };
}
