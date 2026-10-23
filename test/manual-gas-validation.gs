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
  const startedAt = Date.now();
  console.log('ROLL_VALIDATION_STAGE starting-read');
  const ss = validationSpreadsheet_();
  const originalRoles = fetchRoles();
  if (readPendingRollHistoryReflections_().length) {
    throw new Error('未反映の履歴があるため、検証を開始できません。先に反映状態を確認してください。');
  }
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
  if (Date.now() - startedAt > 60000) {
    throw new Error('読み取りに時間がかかったため、復元時間を確保できません。変更せず停止します。');
  }
  console.log('ROLL_VALIDATION_STAGE before-write');
  let result;
  try {
    const changedRoles = JSON.parse(JSON.stringify(originalRoles));
    changedRoles.find(function(role) { return role.id === target.role.id; }).useStartDate = changedDate;
    saveRolesWithRevision_(changedRoles, revision);
    SpreadsheetApp.flush();
    const forward = getRollHistoryActualValueFromSheet(target.sheet, target.definition, target.cycle.rowNumber, 'useStartDate');
    if (forward.value !== changedDate) throw new Error('保存した開始日が元の履歴行に反映されませんでした。');
    console.log('ROLL_VALIDATION_STAGE forward-verified');
    writeRollHistoryActualValue(target.sheet, target.definition,
      { field: 'useStartDate', rowNumber: target.cycle.rowNumber, value: originalDate });
    SpreadsheetApp.flush();
    const reverse = handleRollHistoryActualEdit({ range: fieldRange });
    const after = fetchRoles().find(function(role) { return role.id === target.role.id; });
    if (!reverse.updated || normalizeRollHistoryActualDate(after.useStartDate) !== originalDate) {
      throw new Error('表側の日付訂正がRolesへ反映されませんでした。');
    }
    console.log('ROLL_VALIDATION_STAGE reverse-verified');
    const repeated = handleRollHistoryActualEdit({ range: fieldRange });
    const repeatedRole = fetchRoles().find(function(role) { return role.id === target.role.id; });
    if (repeated.updated || repeatedRole.history.length !== after.history.length) {
      throw new Error('同じ訂正の再処理で履歴が増えました。');
    }
    const beforeClear = fetchRoles();
    const clearRoles = JSON.parse(JSON.stringify(beforeClear));
    clearRoles.find(function(role) { return role.id === target.role.id; }).useStartDate = '';
    const endBeforeClear = getRollHistoryActualValueFromSheet(target.sheet, target.definition, target.cycle.rowNumber, 'useEndDate');
    saveRolesWithRevision_(clearRoles, rolesRevision_(beforeClear));
    SpreadsheetApp.flush();
    const cleared = getRollHistoryActualValueFromSheet(target.sheet, target.definition, target.cycle.rowNumber, 'useStartDate');
    const endAfterClear = getRollHistoryActualValueFromSheet(target.sheet, target.definition, target.cycle.rowNumber, 'useEndDate');
    if (!cleared.isBlank || endBeforeClear.value !== endAfterClear.value || endBeforeClear.planned !== endAfterClear.planned) {
      throw new Error('空欄への訂正、または隣接する終了日の保護に失敗しました。');
    }
    if (readPendingRollHistoryReflections_().length) throw new Error('完了後に未反映記録が残っています。');
    console.log('ROLL_VALIDATION_STAGE explicit-clear-verified');
    const afterCycles = buildRollHistoryCycleRows(target.definition.roleIdRow, range.getDisplayValues(), range.getFontColors());
    if (afterCycles.length !== target.count) throw new Error('日付訂正でサイクル行が増減しました。');
    result = { mode: 'LIVE_SERVER_DATE_ROUND_TRIP', roleName: target.role.name,
      sheet: target.sheet.getName(), range: fieldRange.getA1Notation(),
      forward: true, reverse: true, explicitClear: true, adjacentEndPreserved: true,
      pendingReflectionCleared: true, duplicateHistoryPrevented: true, cycleRowsUnchanged: true };
  } finally {
    console.log('ROLL_VALIDATION_STAGE restoring');
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
    // The copy has been verified back at its baseline; remove only this test's retry record.
    PropertiesService.getScriptProperties().deleteProperty(ROLL_HISTORY_PENDING_PREFIX + encodeURIComponent(String(target.role.id)));
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

// Creates a calendar-only test draft in the private copy. This is not a production plan.
// Configure ROLL_HISTORY_SOURCE_SPREADSHEET_ID to the read-only native template workbook.
function runValidationPlanningDraft() {
  const ss = validationSpreadsheet_();
  const now = new Date();
  const period = { year: Number(Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy')),
    month: Number(Utilities.formatDate(now, 'Asia/Tokyo', 'M')) };
  if (ss.getSheetByName(planningSheetName_(period))) throw new Error('同月の検証シートが既にあります。上書きせず停止します。');
  const template = findPlanningTemplateSheet_(ss, period);
  const source = template.sheet;
  const sourceValues = JSON.stringify(source.getRange('A1:AM70').getValues());
  const dayCount = new Date(period.year, period.month, 0).getDate();
  const plan = { year: period.year, month: period.month, calendarRows: [], suggestions: [], capabilities: { caliberConnected: false } };
  for (let day = 1; day <= dayCount; day++) {
    plan.calendarRows.push({ date: period.year + '-' + String(period.month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
      weekday: '日月火水木金土'[new Date(Date.UTC(period.year, period.month - 1, day)).getUTCDay()], size: '' });
  }
  plan.suggestions.push({ date: plan.calendarRows[0].date, column: 'K', text: '検証用：作業指示ではありません' });
  const first = writePlanningDraft_(plan, 'planning-validation-first-' + Date.now());
  const sheet = ss.getSheetByName(first.sheetName);
  const firstWork = sheet.getRange('K5').getValue();
  const second = writePlanningDraft_(plan, 'planning-validation-repeat-' + Date.now());
  if (second.created || sheet.getRange('K5').getValue() !== firstWork) throw new Error('再出力で提案またはシートが重複しました。');
  const expectedCarry = readPlanningCarryForward_(source, template.period, period);
  Object.keys(expectedCarry).forEach(function(a1) {
    if (a1 !== 'K5' && sheet.getRange(a1).getValue() !== expectedCarry[a1]) throw new Error('繰越予定が一致しません: ' + a1);
  });
  const geometry = function(item, extendExpected) {
    const merges = item.getRange('A1:AM70').getMergedRanges().map(function(range) { return range.getA1Notation(); });
    const rows = Array.from({ length: 70 }, function(_, i) { return item.getRowHeight(i + 1); });
    const templateDays = new Date(template.period.year, template.period.month, 0).getDate();
    if (extendExpected) {
      for (let day = templateDays + 1; day <= dayCount; day++) {
        const row = day + 4;
        ['E' + row + ':F' + row, 'H' + row + ':I' + row, 'K' + row + ':L' + row].forEach(function(a1) {
          if (merges.indexOf(a1) < 0) merges.push(a1);
        });
        rows[row - 1] = rows[templateDays + 3];
      }
    }
    return JSON.stringify({ merges: merges.sort(),
      columns: Array.from({ length: 39 }, function(_, i) { return item.getColumnWidth(i + 1); }),
      rows: rows,
      frozenRows: item.getFrozenRows(), frozenColumns: item.getFrozenColumns() });
  };
  if (geometry(source, true) !== geometry(sheet, false)) throw new Error('月末補完を除く元表の結合・列幅・行高が一致しません。');
  const originalDay = sheet.getRange('B5').getValue();
  let rejected = false;
  try {
    sheet.getRange('B5').setValue('検証用手修正');
    try { writePlanningDraft_(plan, 'planning-validation-conflict-' + Date.now()); }
    catch (error) { if (!/手修正/.test(error.message)) throw error; rejected = true; }
    if (!rejected || sheet.getRange('B5').getValue() !== '検証用手修正') throw new Error('手修正が保護されませんでした。');
  } finally { sheet.getRange('B5').setValue(originalDay); }
  if (sourceValues !== JSON.stringify(source.getRange('A1:AM70').getValues())) throw new Error('ひな形の内容が変化しています。');
  sheet.getRange('N1').setValue('検証用の暦・出力確認。生産・作業指示には使わない');
  const result = { mode: 'LIVE_PLANNING_TEMPLATE', sheetName: first.sheetName, sheetId: sheet.getSheetId(),
    template: source.getName(), created: true, repeatedWithoutDuplicates: true, carryForwardPreserved: true,
    layoutPreservedWithMonthEndExtension: true, manualCalendarEditRejected: rejected, sourceUnchanged: true,
    actualProductionImported: false, printLayoutVerified: false };
  console.log('ROLL_VALIDATION_RESULT ' + JSON.stringify(result));
  return result;
}

// Repairs only the calendar test draft created above; does not generate or adopt work orders.
function runValidationPlanningMonthEnd() {
  const ss = validationSpreadsheet_(), now = new Date();
  const period = { year: Number(Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy')),
    month: Number(Utilities.formatDate(now, 'Asia/Tokyo', 'M')) };
  const sheet = ss.getSheetByName(planningSheetName_(period));
  if (!sheet || String(sheet.getRange('N1').getValue()).indexOf('検証用の暦・出力確認') !== 0) {
    throw new Error('この検証で作成した暦シート以外は変更できません。');
  }
  const template = findPlanningTemplateSheet_(ss, period);
  const sourceDays = new Date(template.period.year, template.period.month, 0).getDate();
  const targetDays = new Date(period.year, period.month, 0).getDate();
  const before = JSON.stringify(sheet.getRange('A1:AM70').getValues());
  for (let day = sourceDays + 1; day <= targetDays; day++) {
    ['F', 'I', 'L'].forEach(function(column) {
      if (sheet.getRange(column + (day + 4)).getValue() !== '') throw new Error('結合予定の右セルに値があるため停止します。');
    });
  }
  const expanded = extendPlanningCalendarRows_(sheet, template.period, period);
  SpreadsheetApp.flush();
  for (let day = sourceDays + 1; day <= targetDays; day++) {
    const row = day + 4;
    const merges = sheet.getRange('B' + row + ':M' + row).getMergedRanges().map(function(range) { return range.getA1Notation(); }).sort();
    if (JSON.stringify(merges) !== JSON.stringify(['E' + row + ':F' + row, 'H' + row + ':I' + row, 'K' + row + ':L' + row])) {
      throw new Error('月末の結合セルが一致しません。');
    }
    if (sheet.getRowHeight(row) !== sheet.getRowHeight(sourceDays + 4)) throw new Error('月末の行高が一致しません。');
  }
  if (before !== JSON.stringify(sheet.getRange('A1:AM70').getValues())) throw new Error('書式補完で既存値が変化しました。');
  const result = { mode: 'LIVE_MONTH_END_FORMAT', expandedDays: expanded, valuesUnchanged: true,
    pairedWorkCellsVerified: true, rowHeightsVerified: true, sheetId: sheet.getSheetId() };
  console.log('ROLL_VALIDATION_RESULT ' + JSON.stringify(result));
  return result;
}
