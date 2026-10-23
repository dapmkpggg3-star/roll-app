// Run only in a copied, private spreadsheet. Never install this file in production.
// Set ROLL_VALIDATION_SPREADSHEET_ID separately to the verified copy's ID.
function validationSpreadsheet_() {
  const expected = PropertiesService.getScriptProperties().getProperty('ROLL_VALIDATION_SPREADSHEET_ID');
  if (!expected || expected !== getRollManagementSpreadsheetId_()) {
    throw new Error('検証先IDが未設定、または通常の接続先と一致しません。');
  }
  const ss = openRollManagementSpreadsheet_();
  if (!ss.getName().startsWith('検証用_') || !ss.getName().includes('実運用禁止')) {
    throw new Error('検証用・実運用禁止のコピー以外では実行できません。');
  }
  return ss;
}

function runValidationReadOnly() {
  const ss = validationSpreadsheet_();
  const roles = fetchRoles();
  validateRolesForSave_(roles);
  const result = {
    mode: 'READ_ONLY', version: SCRIPT_VERSION, spreadsheetId: ss.getId(),
    roles: roles.length, revision: rolesRevision_(roles),
    historySheets: ROLL_HISTORY_SHEET_NAMES.map(function(name) {
      const sheet = ss.getSheetByName(name);
      if (!sheet) return { name: name, exists: false };
      const definitions = getRollHistoryStatusDefinitions(sheet);
      return {
        name: name, exists: true, blocks: definitions.length,
        compatible: definitions.filter(isRollHistoryActualDefinitionCompatible).length
      };
    })
  };
  console.log('ROLL_VALIDATION_RESULT ' + JSON.stringify(result));
  return result;
}

// Writes a temporary memo to Roles in the verified copy, then restores that cell.
// This checks the live revision comparison, not frontend communication or triggers.
function runValidationStaleSave() {
  const ss = validationSpreadsheet_();
  const roles = fetchRoles();
  validateRolesForSave_(roles);
  const revision = rolesRevision_(roles);
  const cell = ss.getSheetByName(SHEET_NAME).getRange(2, 4);
  const previous = cell.getFormula() || cell.getValue();
  let rejected = false;
  try {
    cell.setValue('VALIDATION_ONLY_' + Utilities.getUuid());
    SpreadsheetApp.flush();
    try {
      saveRolesWithRevision_(roles, revision);
    } catch (error) {
      if (!/更新|競合/.test(String(error.message))) throw error;
      rejected = true;
    }
    if (!rejected) throw new Error('古いrevisionの保存が拒否されませんでした。');
  } finally {
    cell.setValue(previous);
    SpreadsheetApp.flush();
  }
  if (rolesRevision_(fetchRoles()) !== revision) {
    throw new Error('検証後に元のRoles内容へ戻っていません。コピーを確認してください。');
  }
  const result = { mode: 'LIVE_REVISION_CHECK', staleSaveRejected: rejected, restored: true };
  console.log('ROLL_VALIDATION_RESULT ' + JSON.stringify(result));
  return result;
}

// Runs the server-side date path on one matching active cycle in the copy.
// Calls the edit handler explicitly; it does not prove an installed onEdit trigger
// or the browser's POST/status-poll transport. Other editors must remain idle.
function runValidationDateRoundTrip() {
  const ss = validationSpreadsheet_();
  const originalRoles = fetchRoles();
  const revision = rolesRevision_(originalRoles);
  let target = null;
  for (const name of ROLL_HISTORY_SHEET_NAMES) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) continue;
    const definitions = getRollHistoryStatusDefinitions(sheet);
    for (const definition of definitions) {
      const role = originalRoles.find(function(item) {
        return item.name === definition.roleName && item.isActiveThreeSet
          && item.useStartDate && !item.useEndDate;
      });
      if (!role || !isRollHistoryActualDefinitionCompatible(definition)) continue;
      const range = sheet.getRange(definition.roleIdRow, definition.startColumn,
        getRollHistoryActualBlockEndRow(definition, definitions, sheet.getLastRow()) - definition.roleIdRow + 1,
        definition.endColumn - definition.startColumn + 1);
      const cycleRows = buildRollHistoryCycleRows(definition.roleIdRow, range.getDisplayValues(), range.getFontColors());
      const cycle = getRollHistoryCurrentEditableCycleRow(cycleRows);
      if (cycle && (cycle.fields.useEndDate.isBlank || cycle.fields.useEndDate.planned) && !cycle.fields.useStartDate.planned
        && cycle.fields.useStartDate.value === normalizeRollHistoryActualDate(role.useStartDate)) {
        target = { sheet: sheet, definition: definition, role: role, range: range, cycle: cycle, count: cycleRows.length };
        break;
      }
    }
    if (target) break;
  }
  if (!target) throw new Error('開始日が一致する使用中サイクルがありません。変更せず停止します。');
  const range = target.range;
  const formulas = range.getFormulas();
  const rawValues = range.getValues();
  const values = rawValues.map(function(row, r) {
    return row.map(function(value, c) { return formulas[r][c] || value; });
  });
  const colors = range.getFontColors(), backgrounds = range.getBackgrounds(), notes = range.getNotes();
  const rolesRange = ss.getSheetByName(SHEET_NAME).getRange(1, 1, originalRoles.length + 1, HEADER_VALUES.length);
  const rolesValues = rolesRange.getValues();
  const fieldRange = target.sheet.getRange(target.cycle.rowNumber,
    target.definition.startColumn + ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS.useStartDate.offset, 1, 3);
  const originalDate = normalizeRollHistoryActualDate(target.role.useStartDate);
  const parts = originalDate.split('-').map(Number);
  const changedDate = Utilities.formatDate(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1)), 'UTC', 'yyyy-MM-dd');
  let result;
  try {
    const changedRoles = JSON.parse(JSON.stringify(originalRoles));
    changedRoles.find(function(role) { return role.id === target.role.id; }).useStartDate = changedDate;
    saveRolesWithRevision_(changedRoles, revision);
    SpreadsheetApp.flush();
    const forward = getRollHistoryActualValueFromSheet(target.sheet, target.definition, target.cycle.rowNumber, 'useStartDate');
    if (forward.value !== changedDate) throw new Error('保存した開始日が元の履歴行に反映されませんでした。');
    writeRollHistoryActualValue(target.sheet, target.definition,
      { field: 'useStartDate', rowNumber: target.cycle.rowNumber, value: originalDate });
    SpreadsheetApp.flush();
    const reverse = handleRollHistoryActualEdit({ range: fieldRange });
    const after = fetchRoles().find(function(role) { return role.id === target.role.id; });
    if (!reverse.updated || normalizeRollHistoryActualDate(after.useStartDate) !== originalDate) {
      throw new Error('表側の日付訂正がRolesへ反映されませんでした。');
    }
    const repeated = handleRollHistoryActualEdit({ range: fieldRange });
    const repeatedRole = fetchRoles().find(function(role) { return role.id === target.role.id; });
    if (repeated.updated || repeatedRole.history.length !== after.history.length) {
      throw new Error('同じ訂正の再処理で履歴が増えました。');
    }
    const afterCycles = buildRollHistoryCycleRows(target.definition.roleIdRow, range.getDisplayValues(), range.getFontColors());
    if (afterCycles.length !== target.count) throw new Error('日付訂正でサイクル行が増減しました。');
    result = { mode: 'LIVE_SERVER_DATE_ROUND_TRIP', roleName: target.role.name,
      sheet: target.sheet.getName(), range: fieldRange.getA1Notation(),
      forward: true, reverse: true, duplicateHistoryPrevented: true, cycleRowsUnchanged: true };
  } finally {
    range.setValues(values).setFontColors(colors).setBackgrounds(backgrounds).setNotes(notes);
    rolesRange.setValues(rolesValues);
    SpreadsheetApp.flush();
    refreshRollManagementView();
    refreshFieldRollManagementView();
    if (rolesRevision_(fetchRoles()) !== revision) throw new Error('検証後のRoles復元確認に失敗しました。');
    if (JSON.stringify(range.getValues()) !== JSON.stringify(rawValues)
      || JSON.stringify(range.getFormulas()) !== JSON.stringify(formulas)
      || JSON.stringify(range.getFontColors()) !== JSON.stringify(colors)
      || JSON.stringify(range.getBackgrounds()) !== JSON.stringify(backgrounds)
      || JSON.stringify(range.getNotes()) !== JSON.stringify(notes)) {
      throw new Error('検証後の履歴値・書式の復元確認に失敗しました。');
    }
  }
  result.restored = true;
  console.log('ROLL_VALIDATION_RESULT ' + JSON.stringify(result));
  return result;
}

function runValidationCycleAudit() {
  const ss = validationSpreadsheet_();
  const roles = fetchRoles();
  const result = [];
  ROLL_HISTORY_SHEET_NAMES.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const definitions = getRollHistoryStatusDefinitions(sheet);
    definitions.forEach(function(definition) {
      const role = roles.find(function(item) {
        return item.name === definition.roleName && item.isActiveThreeSet && item.useStartDate && !item.useEndDate;
      });
      if (!role) return;
      const range = sheet.getRange(definition.roleIdRow, definition.startColumn,
        getRollHistoryActualBlockEndRow(definition, definitions, sheet.getLastRow()) - definition.roleIdRow + 1,
        definition.endColumn - definition.startColumn + 1);
      const cycles = buildRollHistoryCycleRows(definition.roleIdRow, range.getDisplayValues(), range.getFontColors());
      const current = getRollHistoryCurrentEditableCycleRow(cycles);
      const entry = { role: role.name, sheet: name, appStart: role.useStartDate,
        row: current && current.rowNumber, start: current && current.fields.useStartDate,
        end: current && current.fields.useEndDate };
      result.push(entry);
      console.log('ROLL_VALIDATION_CYCLE ' + JSON.stringify(entry));
    });
  });
  console.log('ROLL_VALIDATION_AUDIT_COUNT ' + result.length);
  return result;
}
