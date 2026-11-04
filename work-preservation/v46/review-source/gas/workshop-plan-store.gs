// Explicitly installed validation adapter; no sheet creation or doPost wiring.
// A shared script lock must also be used by the instruction store.
function createWorkshopPlanStore_(sheet, domain, lock, flush, guard) {
  if (!sheet || sheet.getName() !== '_WorkshopPlans_v1') throw new Error('採用計画専用シートを指定してください。');
  function readAll() {
    var rows = sheet.getDataRange().getValues();
    if (!rows.length || JSON.stringify(rows[0].slice(0, 2)) !== JSON.stringify(['planId', 'recordJson'])) {
      throw new Error('採用計画シートの構成が一致しません。');
    }
    var seen = Object.create(null), records = [];
    rows.slice(1).forEach(function(row, index) {
      if (!row[0] && !row[1]) return;
      var record;
      try { record = JSON.parse(row[1]); } catch (_) { throw new Error('採用計画が読めません。'); }
      domain.project(record);
      if (row[0] !== record.id || Object.prototype.hasOwnProperty.call(seen, record.id)) throw new Error('計画IDが不正・重複しています。');
      seen[record.id] = true; records.push({ row: index + 2, record: record });
    });
    return records;
  }
  function read(id) {
    var match = readAll().filter(function(item) { return item.record.id === id; })[0];
    return match ? match.record : null;
  }
  return {
    list: function() { return readAll().map(function(item) { return item.record; }); },
    read: read,
    readAdoption: function(id) {
      var record = read(id);
      return record ? domain.project(record).adoption : null;
    },
    execute: function(command, resolveContext) {
      if (typeof resolveContext !== 'function') throw new Error('サーバーの認証情報が必要です。');
      if (!lock.tryLock(10000)) throw new Error('他の更新処理中です。');
      try {
        var rows = readAll(), current = rows.filter(function(item) { return item.record.id === command.planId; })[0];
        var result = domain.apply(current ? current.record : null, command, resolveContext());
        if (!result.changed) return result;
        if (guard) guard({ plans: [current && current.record, result.record] });
        var serialized = JSON.stringify(result.record);
        if (serialized.length > 45000) throw new Error('計画履歴の保全・分割が必要です。');
        var row = current ? current.row : sheet.getLastRow() + 1, range = sheet.getRange(row, 1, 1, 2);
        range.setValues([[result.record.id, serialized]]); flush();
        var verified = range.getValues()[0];
        if (verified[0] !== result.record.id || verified[1] !== serialized) throw new Error('採用計画の反映を確認できません。同じ要求IDで再確認してください。');
        return result;
      } finally { lock.releaseLock(); }
    }
  };
}
