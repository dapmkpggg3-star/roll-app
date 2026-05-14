const SHEET_NAME = 'Roles';
const SPREADSHEET_ID = '1X07qQa7u9YPLvErT0D48goT5wYmvcpgNjqzK3FhRFeA';

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  Logger.log('doGet params: ' + JSON.stringify(params));
  const action = String(params.action || '').trim().toLowerCase();
  Logger.log('doGet action: [' + action + ']');
  if (action === 'fetch') {
    try {
      const roles = fetchRoles();
      Logger.log('doGet fetch: returning ' + roles.length + ' roles');
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, roles: roles }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet fetch error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'save') {
    try {
      const rolesParam = params.roles;
      if (!rolesParam) {
        throw new Error('No roles parameter');
      }
      Logger.log('doGet save: received roles param (length=' + rolesParam.length + ')');
      const roles = JSON.parse(decodeURIComponent(rolesParam));
      if (!Array.isArray(roles)) {
        throw new Error('roles must be an array, got: ' + typeof roles);
      }

      Logger.log('doGet save: writing ' + roles.length + ' roles');
      writeRoles(roles);
      Logger.log('doGet save: write complete');

      return ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet save error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === '') {
    // テスト用レスポンス
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: "Apps Script connected"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      error: 'Unsupported action'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchRoles() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  Logger.log('fetchRoles: sheet has ' + values.length + ' rows');

  if (values.length <= 1) {
    return [];
  }

  const rows = values.slice(1);
  const result = rows.map(row => ({
    id: row[0],
    name: row[1],
    status: row[2],
    memo: row[3],
    updatedAt: row[4]
  })).filter(row => row.name && String(row.name).trim() !== '');

  Logger.log('fetchRoles: returning ' + result.length + ' roles');
  return result;
}

function writeRoles(roles) {
  const sheet = getSheet();
  Logger.log('writeRoles: clearing sheet');
  sheet.clearContents();

  Logger.log('writeRoles: appending header');
  sheet.appendRow(['ID', 'スタンド番号', 'ステータス', 'メモ', '最終更新日']);

  Logger.log('writeRoles: appending ' + roles.length + ' rows');
  roles.forEach((role, index) => {
    try {
      sheet.appendRow([
        role.id || '',
        role.name || '',
        role.status || '',
        role.memo || '',
        role.updatedAt || ''
      ]);
    } catch (err) {
      Logger.log('writeRoles error at row ' + index + ': ' + err.toString());
    }
  });

  Logger.log('writeRoles: complete');
}

function getSheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('getSheet: opened spreadsheet: ' + ss.getName());

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log('getSheet: creating new sheet named: ' + SHEET_NAME);
      sheet = ss.insertSheet(SHEET_NAME);
    } else {
      Logger.log('getSheet: found existing sheet: ' + SHEET_NAME);
    }

    return sheet;
  } catch (error) {
    Logger.log('getSheet error: ' + error.toString());
    throw new Error('Failed to open spreadsheet or get sheet: ' + error.toString());
  }
}
