const SHEET_NAME = 'Roles';

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  if (action === 'fetch') {
    try {
      const roles = fetchRoles();
      return HtmlService.createHtmlOutput(JSON.stringify({
        success: true,
        roles: roles
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .addMetaTag('Access-Control-Allow-Origin', '*')
      .addMetaTag('Access-Control-Allow-Methods', 'GET, POST')
      .addMetaTag('Access-Control-Allow-Headers', 'Content-Type');
    } catch (error) {
      return HtmlService.createHtmlOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .addMetaTag('Access-Control-Allow-Origin', '*')
      .addMetaTag('Access-Control-Allow-Methods', 'GET, POST')
      .addMetaTag('Access-Control-Allow-Headers', 'Content-Type');
    }
  }

  return HtmlService.createHtmlOutput(JSON.stringify({
    success: false,
    error: 'Unsupported action'
  }))
  .setMimeType(ContentService.MimeType.JSON)
  .addMetaTag('Access-Control-Allow-Origin', '*')
  .addMetaTag('Access-Control-Allow-Methods', 'GET, POST')
  .addMetaTag('Access-Control-Allow-Headers', 'Content-Type');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    if (!Array.isArray(payload.roles)) {
      throw new Error('roles must be an array');
    }
    writeRoles(payload.roles);
    return HtmlService.createHtmlOutput(JSON.stringify({
      success: true
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .addMetaTag('Access-Control-Allow-Origin', '*')
    .addMetaTag('Access-Control-Allow-Methods', 'GET, POST')
    .addMetaTag('Access-Control-Allow-Headers', 'Content-Type');
  } catch (error) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      success: false,
      error: error.message
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .addMetaTag('Access-Control-Allow-Origin', '*')
    .addMetaTag('Access-Control-Allow-Methods', 'GET, POST')
    .addMetaTag('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function fetchRoles() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  const rows = values.slice(1);
  return rows.map(row => ({
    id: row[0],
    name: row[1],
    status: row[2],
    memo: row[3],
    updatedAt: row[4]
  })).filter(row => row.name);
}

function writeRoles(roles) {
  const sheet = getSheet();
  sheet.clearContents();
  sheet.appendRow(['ID', 'スタンド番号', 'ステータス', 'メモ', '最終更新日']);
  roles.forEach(role => {
    sheet.appendRow([
      role.id || '',
      role.name || '',
      role.status || '',
      role.memo || '',
      role.updatedAt || ''
    ]);
  });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}
