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
