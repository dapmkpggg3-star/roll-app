const SHEET_NAME = 'Roles';
const SPREADSHEET_ID = '1X07qQa7u9YPLvErT0D48goT5wYmvcpgNjqzK3FhRFeA';
const HEADER_VALUES = ['ID', 'スタンド番号', 'ステータス', 'メモ', '最終更新日'];
const STATUS_COLUMN_INDEX = 3;
const HEADER_BACKGROUND = '#1f4e78';
const HEADER_FONT_COLOR = '#ffffff';
const DEFAULT_COLUMN_WIDTH = 100;
const INITIAL_COLUMN_WIDTHS = [60, 120, 190, 260, 180];



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
  sheet.clear();

  const rows = roles.map((role, index) => {
    try {
      return [
        role.id || '',
        role.name || '',
        role.status || '',
        role.memo || '',
        role.updatedAt || ''
      ];
    } catch (err) {
      Logger.log('writeRoles error at row ' + index + ': ' + err.toString());
      return null;
    }
  }).filter(row => row);

  Logger.log('writeRoles: writing header and ' + rows.length + ' data rows');
  const values = [HEADER_VALUES].concat(rows);
  sheet.getRange(1, 1, values.length, HEADER_VALUES.length).setValues(values);
  applySheetFormatting(sheet, rows.length);

  Logger.log('writeRoles: complete');
}


function applySheetFormatting(sheet, dataRowCount) {
  const columnCount = HEADER_VALUES.length;
  const totalRows = Math.max(dataRowCount + 1, 1);
  const maxRows = Math.max(sheet.getMaxRows(), 2);

  Logger.log('applySheetFormatting: formatting ' + totalRows + ' rows');

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight('bold')
    .setFontColor(HEADER_FONT_COLOR)
    .setBackground(HEADER_BACKGROUND)
    .setHorizontalAlignment('center');

  sheet.getRange(1, 1, totalRows, columnCount)
    .setBorder(true, true, true, true, true, true, '#d9e2f3', SpreadsheetApp.BorderStyle.SOLID);

  const existingFilter = sheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }
  sheet.getRange(1, 1, totalRows, columnCount).createFilter();

  const statusRange = sheet.getRange(2, STATUS_COLUMN_INDEX, maxRows - 1, 1);
  const firstStatusCell = sheet.getRange(2, STATUS_COLUMN_INDEX).getA1Notation();
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('オンライン')
      .setBackground('#d9ead3')
      .setFontColor('#274e13')
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('改削中')
      .setBackground('#f4cccc')
      .setFontColor('#990000')
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('中古予備')
      .setBackground('#e7e6e6')
      .setFontColor('#444444')
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(' + firstStatusCell + '<>"",' + firstStatusCell + '<>"オンライン",' + firstStatusCell + '<>"改削中",ISERROR(SEARCH("中古予備",' + firstStatusCell + ')))')
      .setBackground('#fff2cc')
      .setFontColor('#7f6000')
      .setRanges([statusRange])
      .build()
  ];
  sheet.setConditionalFormatRules(rules);

  applyInitialColumnWidthsIfNeeded(sheet);
  sheet.getRange(1, 1, totalRows, columnCount).setVerticalAlignment('middle');
  if (dataRowCount > 0) {
    sheet.getRange(2, 1, dataRowCount, columnCount).setWrap(true);
  }
}


function applyInitialColumnWidthsIfNeeded(sheet) {
  const propertyKey = 'columnWidthsInitialized_' + sheet.getSheetId();
  const scriptProperties = PropertiesService.getScriptProperties();

  // 初心者向けメモ:
  // 列幅を毎回設定すると、利用者がスプレッドシート上で手動調整した幅まで同期時に戻ってしまいます。
  // そのため、列幅は「まだ一度も初期設定していないシート」だけに設定し、以降の同期では触りません。
  if (scriptProperties.getProperty(propertyKey) === 'true') {
    Logger.log('applyInitialColumnWidthsIfNeeded: column widths already initialized');
    return;
  }

  const hasCustomColumnWidth = INITIAL_COLUMN_WIDTHS.some((_, index) => {
    return sheet.getColumnWidth(index + 1) !== DEFAULT_COLUMN_WIDTH;
  });

  if (hasCustomColumnWidth) {
    Logger.log('applyInitialColumnWidthsIfNeeded: custom column widths found; keeping existing widths');
    scriptProperties.setProperty(propertyKey, 'true');
    return;
  }

  Logger.log('applyInitialColumnWidthsIfNeeded: applying initial column widths');
  INITIAL_COLUMN_WIDTHS.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });
  scriptProperties.setProperty(propertyKey, 'true');
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
