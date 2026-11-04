// Recovery journal. Must be installed explicitly on a protected internal sheet.
// It does not acquire a second lock: the coordinator owns the shared script lock.
function createWorkshopOperationStore_(sheet, recovery, lock, flush) {
  if (!sheet || sheet.getName() !== '_WorkshopOperations_v1') throw new Error('未反映操作専用シートを指定してください。');
  function readAll() {
    var values = sheet.getDataRange().getValues();
    if (!values.length || JSON.stringify(values[0].slice(0, 2)) !== JSON.stringify(['operationId', 'recordJson'])) {
      throw new Error('未反映操作シートの構成が一致しません。');
    }
    var seen = Object.create(null), records = [];
    values.slice(1).forEach(function(row, index) {
      if (!row[0] && !row[1]) return;
      var record;
      try { record = JSON.parse(row[1]); } catch (_) { throw new Error('未反映操作が読めません。'); }
      recovery.validate(record);
      if (row[0] !== record.id || Object.prototype.hasOwnProperty.call(seen, record.id)) throw new Error('未反映操作IDが不正・重複しています。');
      seen[record.id] = true; records.push({ row: index + 2, record: record });
    });
    return records;
  }
  return {
    list: function() { return readAll().map(function(item) { return item.record; }); },
    read: function(id) {
      var found = readAll().filter(function(item) { return item.record.id === id; })[0];
      return found ? found.record : null;
    },
    put: function(expected, next) {
      if (!lock.hasLock()) throw new Error('未反映操作の保存ロックがありません。');
      recovery.validate(next);
      var found = readAll().filter(function(item) { return item.record.id === next.id; })[0];
      var current = found ? found.record : null;
      if (recovery.same(current, next)) return;
      if (!recovery.same(current, expected)) throw new Error('未反映操作が更新されています。上書きせず停止しました。');
      if (next.revision !== (current ? current.revision + 1 : 1)
          || (current && (!recovery.same(current.intent, next.intent) || current.status === 'complete'))) {
        throw new Error('未反映操作の変更前後を確認してください。');
      }
      var serialized = JSON.stringify(next);
      // Reserve room for ALL checks, including each history binding, before the
      // first side effect. A large journal must not fail only at the final ack.
      var requiredSize = serialized.length;
      if (!current) {
        var keys = recovery.requiredChecks(next);
        var longestKey = keys.reduce(function(longest, key) { return key.length > longest.length ? key : longest; }, '');
        var envelope = Object.assign({}, next, { revision: 9007199254740991, checks: keys,
          verifiedAt: 'x'.repeat(40), lastAttemptBy: 'x'.repeat(180),
          problem: { code: 'REFLECTION_CONFLICT', target: longestKey } });
        requiredSize = Math.max(requiredSize, JSON.stringify(envelope).length + 128);
      }
      if (requiredSize > 45000) throw new Error('未反映操作の保存容量を超えます。ロール更新前に記録の保全・分割が必要です。');
      var range = sheet.getRange(found ? found.row : sheet.getLastRow() + 1, 1, 1, 2);
      range.setValues([[next.id, serialized]]); flush();
      var verified = range.getValues()[0];
      if (verified[0] !== next.id || verified[1] !== serialized) throw new Error('未反映操作の保存を確認できません。同じ要求IDで再確認してください。');
    }
  };
}
