const SHEET_NAME = 'Roles';

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  if (action === 'fetch') {
    try {
      const roles = fetchRoles();
      Logger.log('doGet fetch: returning ' + roles.length + ' roles');
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          roles: roles
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet fetch error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: error.toString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'save') {
    try {
      const dataParam = e.parameter.data;
      if (!dataParam) {
        throw new Error('No data parameter');
      }
      const payload = JSON.parse(decodeURIComponent(dataParam));
      if (!Array.isArray(payload.roles)) {
        throw new Error('roles must be an array, got: ' + typeof payload.roles);
      }
      
      Logger.log('doGet save: writing ' + payload.roles.length + ' roles');
      writeRoles(payload.roles);
      Logger.log('doGet save: write complete');
      
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet save error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: error.toString()
        }))
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('getSheet: active spreadsheet: ' + ss.getName());
  
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log('getSheet: creating new sheet named: ' + SHEET_NAME);
    sheet = ss.insertSheet(SHEET_NAME);
  } else {
    Logger.log('getSheet: found existing sheet: ' + SHEET_NAME);
  }
  
  return sheet;
}
