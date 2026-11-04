// Integration foundation only: not called by doPost or installed automatically.
// Caller must authenticate, resolve the adopted plan from trusted shared data,
// and supply the existing script lock. Never pass request.actor as context.actor.
function createWorkshopInstructionStore_(sheet, domain, lock, flush, guard) {
  var sheetName = '_WorkshopInstructions_v1';
  var headers = ['instructionId', 'recordJson'];
  if (!sheet || sheet.getName() !== sheetName) throw new Error('工作指示専用シートを指定してください。');
  function readAll() {
    var values = sheet.getDataRange().getValues();
    if (!values.length || JSON.stringify(values[0].slice(0, 2)) !== JSON.stringify(headers)) {
      throw new Error('工作指示シートの構成が一致しません。自動修復はしません。');
    }
    var seen = Object.create(null), records = [];
    values.slice(1).forEach(function(row, index) {
      if (!row[0] && !row[1]) return;
      var record;
      try { record = JSON.parse(row[1]); } catch (_) { throw new Error('工作指示記録が読めません。保存を停止しました。'); }
      domain.project(record);
      if (row[0] !== record.id || Object.prototype.hasOwnProperty.call(seen, record.id)) throw new Error('工作指示IDの不一致・重複があります。');
      seen[record.id] = true;
      records.push({ row: index + 2, record: record });
    });
    return records;
  }
  function writeVerified(row, record) {
    var serialized = JSON.stringify(record);
    if (serialized.length > 45000) throw new Error('指示履歴の保存上限に近づいています。履歴の保全・分割が必要です。');
    var range = sheet.getRange(row, 1, 1, 2);
    range.setValues([[record.id, serialized]]);
    flush();
    var verified = range.getValues()[0];
    if (verified[0] !== record.id || verified[1] !== serialized) throw new Error('指示の反映を確認できません。同じ要求IDで再確認してください。');
  }
  function same(left, right) {
    function canonical(value) {
      if (Array.isArray(value)) return value.map(canonical);
      if (value && typeof value === 'object') {
        var result = {};
        Object.keys(value).sort().forEach(function(key) { result[key] = canonical(value[key]); });
        return result;
      }
      return value;
    }
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
  }
  return {
    list: function() { return readAll().map(function(item) { return item.record; }); },
    read: function(id) {
      var rows = readAll().filter(function(item) { return item.record.id === id; });
      return rows.length ? rows[0].record : null;
    },
    // Only the recovery coordinator calls this while owning the shared lock.
    compareAndSet: function(id, expected, next) {
      if (typeof lock.hasLock !== 'function' || !lock.hasLock()) throw new Error('工作指示の保存ロックがありません。');
      domain.project(expected); domain.project(next);
      if (expected.id !== id || next.id !== id || next.revision !== expected.revision + 1
          || !same(next.events.slice(0, -1), expected.events)) throw new Error('工作指示の変更前後が不正です。');
      var found = readAll().filter(function(item) { return item.record.id === id; })[0];
      if (!found) throw new Error('対象の工作指示がありません。');
      if (same(found.record, next)) return;
      if (!same(found.record, expected)) throw new Error('工作指示が更新されています。上書きせず停止しました。');
      writeVerified(found.row, next);
    },
    issueAdoptedPlan: function(request, resolveContext, planLink) {
      if (typeof resolveContext !== 'function' || !planLink || typeof planLink.prepare !== 'function') {
        throw new Error('サーバー側の採用計画確認が必要です。');
      }
      if (!lock.tryLock(10000)) throw new Error('他の更新処理中です。時間をおいて再試行してください。');
      try {
        var current = readAll();
        var result = planLink.prepare(current.map(function(item) { return item.record; }), request, resolveContext());
        if (!result.ready) return result;
        var changed = result.records.filter(function(record) {
          var previous = current.filter(function(item) { return item.record.id === record.id; })[0];
          return !previous || JSON.stringify(previous.record) !== JSON.stringify(record);
        });
        // Validate every record's capacity before the first write. A storage
        // failure can still leave a partial batch: retry reuses saved cycle IDs.
        if (changed.some(function(record) { return JSON.stringify(record).length > 45000; })) {
          throw new Error('指示履歴の保存上限に近づいています。履歴の保全・分割が必要です。');
        }
        if (guard) guard({ instructions: changed });
        changed.forEach(function(record) {
          var previous = current.filter(function(item) { return item.record.id === record.id; })[0];
          writeVerified(previous ? previous.row : sheet.getLastRow() + 1, record);
        });
        return result;
      } finally { lock.releaseLock(); }
    },
    execute: function(command, resolveContext) {
      if (typeof resolveContext !== 'function') throw new Error('サーバー側の採用計画確認が必要です。');
      if (!lock.tryLock(10000)) throw new Error('他の更新処理中です。時間をおいて再試行してください。');
      try {
        var records = readAll();
        var current = records.filter(function(item) { return item.record.id === command.instructionId; })[0];
        // Resolve adoption/version and server identity inside the same lock.
        var result = domain.apply(current ? current.record : null, command, resolveContext());
        if (!result.changed) return result;
        if (guard) guard({ instructions: [current && current.record, result.record] });
        var row = current ? current.row : sheet.getLastRow() + 1;
        // The record and its request receipt/history live in one JSON value.
        writeVerified(row, result.record);
        return result;
      } finally {
        lock.releaseLock();
      }
    }
  };
}
