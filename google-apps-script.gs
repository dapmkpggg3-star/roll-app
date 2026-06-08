const SHEET_NAME = 'Roles';
const INPUT_SHEET_NAMES = ['入力シート', 'Input', '入力'];
const SPREADSHEET_ID = '1X07qQa7u9YPLvErT0D48goT5wYmvcpgNjqzK3FhRFeA';
const HEADER_VALUES = ['ID', 'スタンド番号', 'ステータス', 'メモ', '最終更新日', '作業依頼済み', '作業依頼進捗', '履歴', '現在径', '使用開始日'];
const STATUS_COLUMN_INDEX = 3;
const CURRENT_DIAMETER_COLUMN_INDEX = 9;
const USE_START_DATE_COLUMN_INDEX = 10;
const ADD_ROLE_ACTION_NAME = 'addRoleFromInputArea';
const HEADER_BACKGROUND = '#1f4e78';
const HEADER_FONT_COLOR = '#ffffff';
const LAST_SAVE_DEBUG_KEY = 'ROLL_LAST_SAVE_DEBUG';
const DEFAULT_STATUS = '中古予備（バラシ前）';
const STATUS_OPTIONS = [
  'オンライン',
  '中古予備（バラシ前）',
  '改削行き（搬出可能）',
  '改削中',
  '新品予備（組替可能）',
  '新品予備（組込完了）',
  '新品予備保管',
  '廃却待ち（ラック保管）',
  '廃棄'
];


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
      const writtenRoleCount = writeRoles(roles);
      const debug = buildSaveDebugState(roles.length, writtenRoleCount, 'doGet');
      storeLastSaveDebugState(debug);
      Logger.log('doGet save: write complete');
      
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          receivedRoleCount: debug.receivedRoleCount,
          writtenRoleCount: debug.writtenRoleCount,
          debug: debug
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet save error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'debug-formatting') {
    try {
      const debugState = getSheetFormattingDebugState();
      logSheetDebug('doGet debug-formatting: ' + JSON.stringify(debugState));
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, debug: debugState }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet debug-formatting error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'debug-update-status-dropdown') {
    try {
      const result = applyStatusDropdowns(getSheet());
      Logger.log('doGet debug-update-status-dropdown: ' + JSON.stringify(result));
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, debug: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet debug-update-status-dropdown error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'debug-sort-roles') {
    try {
      const result = debugSortRolesSheet();
      Logger.log('doGet debug-sort-roles: ' + JSON.stringify(result));
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, debug: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet debug-sort-roles error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'debug-last-save') {
    try {
      const debug = getLastSaveDebugState();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, debug: debug }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet debug-last-save error: ' + error.toString());
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

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents
      ? e.postData.contents
      : '';

    Logger.log('doPost body length: ' + body.length);

    const payload = body ? JSON.parse(body) : {};
    const action = String(payload.action || '').trim().toLowerCase();

    Logger.log('doPost action: [' + action + ']');

    if (action === 'save') {
      const roles = payload.roles;

      if (!Array.isArray(roles)) {
        throw new Error('roles must be an array');
      }

      Logger.log('ROLL_DEBUG_GAS_DO_POST_RECEIVED roles.length=' + roles.length);
      Logger.log('doPost save: writing ' + roles.length + ' roles');

      const writtenRoleCount = writeRoles(roles);
      const debug = buildSaveDebugState(roles.length, writtenRoleCount, 'doPost');
      storeLastSaveDebugState(debug);

      Logger.log('doPost save: write complete');

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          receivedRoleCount: debug.receivedRoleCount,
          writtenRoleCount: debug.writtenRoleCount,
          debug: debug
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Unsupported action'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function buildSaveDebugState(receivedRoleCount, writtenRoleCount, source) {
  return {
    source: source,
    receivedRoleCount: Number(receivedRoleCount),
    writtenRoleCount: Number(writtenRoleCount),
    savedAt: new Date().toISOString()
  };
}

function storeLastSaveDebugState(debug) {
  const text = JSON.stringify(debug || {});

  try {
    CacheService.getScriptCache().put(LAST_SAVE_DEBUG_KEY, text, 21600);
  } catch (error) {
    Logger.log('storeLastSaveDebugState cache error: ' + error.toString());
  }

  try {
    PropertiesService.getScriptProperties().setProperty(LAST_SAVE_DEBUG_KEY, text);
  } catch (error) {
    Logger.log('storeLastSaveDebugState properties error: ' + error.toString());
  }
}

function getLastSaveDebugState() {
  let text = '';

  try {
    text = CacheService.getScriptCache().get(LAST_SAVE_DEBUG_KEY) || '';
  } catch (error) {
    Logger.log('getLastSaveDebugState cache error: ' + error.toString());
  }

  if (!text) {
    try {
      text = PropertiesService.getScriptProperties().getProperty(LAST_SAVE_DEBUG_KEY) || '';
    } catch (error) {
      Logger.log('getLastSaveDebugState properties error: ' + error.toString());
    }
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    Logger.log('getLastSaveDebugState parse error: ' + error.toString());
    return null;
  }
}

function fetchRoles() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  Logger.log('fetchRoles: sheet has ' + values.length + ' rows');
  
  if (values.length <= 1) {
    return [];
  }
  
  const rows = values.slice(1);
  const result = rows.map(row => {
    const workProgress = parseWorkProgress(row[6]);
    const requestSent = row[5] === true || String(row[5]).toLowerCase() === 'true' || Boolean(workProgress.vendorSentAt);

    return {
      id: row[0],
      name: row[1],
      status: row[2],
      memo: row[3],
      updatedAt: row[4],
      requestSent: requestSent,
      workProgress: workProgress,
      history: parseHistory(row[7]),
      currentDiameter: normalizeCurrentDiameterForSheet(row[8]),
      useStartDate: normalizeUseStartDateForSheet(row[9])
    };
  }).filter(row => row.name && String(row.name).trim() !== '');
  
  Logger.log('fetchRoles: returning ' + result.length + ' roles');
  return result;
}

function writeRoles(roles) {
  const sheet = getSheet();
  Logger.log('writeRoles: clearing sheet contents');
  sheet.clearContents();
  applyStatusDropdowns(sheet);

  const sortedRoles = sortRolesByStandRoleForSheet(roles);
  const rows = sortedRoles.map((role, index) => {
    try {
      return [
        role.id || '',
        role.name || '',
        role.status || '',
        role.memo || '',
        role.updatedAt || '',
        role.requestSent === true,
        JSON.stringify(normalizeWorkProgressForSheet(role)),
        JSON.stringify(normalizeHistoryForSheet(role)),
        normalizeCurrentDiameterForSheet(role.currentDiameter),
        normalizeUseStartDateForSheet(role.useStartDate)
      ];
    } catch (err) {
      Logger.log('writeRoles error at row ' + index + ': ' + err.toString());
      return null;
    }
  }).filter(row => row);

  Logger.log('writeRoles: writing header and ' + rows.length + ' data rows');
  const values = [HEADER_VALUES].concat(rows);
  const invalidColumnRows = values
    .map(function(row, index) {
      return {
        index: index,
        length: row.length
      };
    })
    .filter(function(row) {
      return row.length !== HEADER_VALUES.length;
    });
  Logger.log('ROLL_DEBUG_GAS_WRITE_BEFORE_SET_VALUES values.length=' + values.length + ', expectedColumns=' + HEADER_VALUES.length + ', invalidColumnRows=' + JSON.stringify(invalidColumnRows));
  sheet.getRange(1, 1, values.length, HEADER_VALUES.length).setValues(values);
  applySheetFormatting(sheet, rows.length);

  Logger.log('writeRoles: complete');
  return rows.length;
}

function sortRolesByStandRoleForSheet(roles) {
  return (Array.isArray(roles) ? roles : []).slice().sort(function(a, b) {
    return compareStandRoleNamesForSheet(a && a.name, b && b.name);
  });
}

function compareStandRoleNamesForSheet(aName, bName) {
  const a = parseStandNumberForSort(aName);
  const b = parseStandNumberForSort(bName);

  if (a.stand !== b.stand) {
    return a.stand - b.stand;
  }

  if (a.number !== b.number) {
    return a.number - b.number;
  }

  return String(aName || '').localeCompare(String(bName || ''), 'ja');
}

function addRoleFromInputArea() {
  const inputSheet = getInputSheet();
  const inputValues = readRoleInputValues(inputSheet);
  const roleName = String(inputValues.name || '').trim();

  if (!roleName) {
    SpreadsheetApp.getUi().alert('スタンド番号を入力してください。');
    return;
  }

  const sheet = getSheet();
  ensureRolesHeader(sheet);
  const values = sheet.getDataRange().getValues();
  const rows = values.length > 1 ? values.slice(1) : [];
  const existingNames = rows
    .map(row => String(row[1] || '').trim())
    .filter(name => name);

  if (existingNames.indexOf(roleName) !== -1) {
    SpreadsheetApp.getUi().alert('このスタンド番号は既に登録されています。');
    return;
  }

  const ids = rows.map(row => Number(row[0]) || 0);
  const nextId = ids.length > 0 ? Math.max.apply(null, ids) + 1 : 1;
  const status = String(inputValues.status || '').trim() || DEFAULT_STATUS;
  const memo = String(inputValues.memo || '').trim();
  const now = new Date().toISOString();
  const row = [
    nextId,
    roleName,
    status,
    memo,
    now,
    false,
    JSON.stringify(normalizeWorkProgressForSheet({})),
    JSON.stringify([]),
    '',
    ''
  ];

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, HEADER_VALUES.length).setValues([row]);
  sortRolesSheet();
  clearRoleInputValues(inputSheet, inputValues.ranges);
  SpreadsheetApp.getUi().alert('Rolesシートに追加しました。');
}

function debugSortRolesSheet() {
  const sheet = getSheet();
  ensureRolesHeader(sheet);
  const beforeRowCount = Math.max(sheet.getLastRow() - 1, 0);
  const rowCount = sortRolesSheet();
  const afterRowCount = Math.max(sheet.getLastRow() - 1, 0);

  if (beforeRowCount !== afterRowCount) {
    throw new Error('Row count changed during sort: before=' + beforeRowCount + ', after=' + afterRowCount);
  }

  return {
    action: 'debug-sort-roles',
    rowCount: afterRowCount,
    sortedRows: rowCount
  };
}

function sortRolesSheet() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 2) {
    applySheetFormatting(sheet, Math.max(lastRow - 1, 0));
    return Math.max(lastRow - 1, 0);
  }

  const lastColumn = Math.max(sheet.getLastColumn(), HEADER_VALUES.length);
  const range = sheet.getRange(2, 1, lastRow - 1, lastColumn);
  const values = range.getValues();

  values.sort(function(a, b) {
    const aSort = parseStandNumberForSort(a[1]);
    const bSort = parseStandNumberForSort(b[1]);

    if (aSort.stand !== bSort.stand) {
      return aSort.stand - bSort.stand;
    }

    if (aSort.number !== bSort.number) {
      return aSort.number - bSort.number;
    }

    return String(a[1] || '').localeCompare(String(b[1] || ''), 'ja');
  });

  range.setValues(values);
  applySheetFormatting(sheet, values.length);
  return values.length;
}

function parseStandNumberForSort(value) {
  const text = String(value || '');
  const match = text.match(/#?\s*(\d+)(?:\s*-\s*(\d+))?/);

  if (!match) {
    return {
      stand: 999999,
      number: 999999
    };
  }

  return {
    stand: Number(match[1]),
    number: match[2] ? Number(match[2]) : 0
  };
}

function getInputSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  for (var i = 0; i < INPUT_SHEET_NAMES.length; i++) {
    const sheet = ss.getSheetByName(INPUT_SHEET_NAMES[i]);
    if (sheet) {
      return sheet;
    }
  }

  throw new Error('入力シートが見つかりません。対象シート名: ' + INPUT_SHEET_NAMES.join(', '));
}

function readRoleInputValues(sheet) {
  const values = sheet.getRange('A2:C2').getValues()[0];

  const result = {
    name: values[0],
    status: values[1],
    memo: values[2],
    ranges: [sheet.getRange('A2:C2')]
  };

  return result;
}

function clearRoleInputValues(sheet, ranges) {
  if (!Array.isArray(ranges)) {
    return;
  }

  ranges.forEach(function(range) {
    if (range) {
      range.clearContent();
    }
  });
}

function ensureRolesHeader(sheet) {
  const currentHeader = sheet.getRange(1, 1, 1, HEADER_VALUES.length).getValues()[0];
  const needsHeader = HEADER_VALUES.some(function(header, index) {
    return String(currentHeader[index] || '') !== header;
  });

  if (needsHeader) {
    sheet.getRange(1, 1, 1, HEADER_VALUES.length).setValues([HEADER_VALUES]);
  }
}

function parseWorkProgress(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    Logger.log('parseWorkProgress error: ' + error.toString());
    return {};
  }
}

function normalizeWorkProgressForSheet(role) {
  const progress = parseWorkProgress(role && role.workProgress);

  if (role && role.requestSent === true && !progress.vendorSentAt) {
    progress.vendorSentAt = role.updatedAt || new Date().toISOString();
  }

  return {
    requestFormCreatedAt: progress.requestFormCreatedAt || '',
    sealConfirmedAt: progress.sealConfirmedAt || '',
    pdfCreatedAt: progress.pdfCreatedAt || '',
    vendorSentAt: progress.vendorSentAt || ''
  };
}

function parseHistory(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    Logger.log('parseHistory error: ' + error.toString());
    return [];
  }
}

function normalizeHistoryForSheet(role) {
  return parseHistory(role && role.history).filter(function(entry) {
    return entry && typeof entry === 'object';
  });
}

function normalizeCurrentDiameterForSheet(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return '';
  }

  const numericValue = Number(value);
  return isFinite(numericValue) ? numericValue : '';
}

function normalizeUseStartDateForSheet(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return formatUseStartDateForSheet(value);
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  const ymdMatch = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return formatUseStartDateForSheet(date);
    }
  }

  const monthNameMatch = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (monthNameMatch) {
    const monthIndexes = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11
    };
    const monthIndex = monthIndexes[monthNameMatch[1].slice(0, 3).toLowerCase()];
    const day = Number(monthNameMatch[2]);
    const year = monthNameMatch[3] ? Number(monthNameMatch[3]) : new Date().getFullYear();

    if (monthIndex !== undefined) {
      const date = new Date(year, monthIndex, day);
      if (
        date.getFullYear() === year &&
        date.getMonth() === monthIndex &&
        date.getDate() === day
      ) {
        return formatUseStartDateForSheet(date);
      }
    }
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return formatUseStartDateForSheet(parsed);
  }

  return text;
}

function formatUseStartDateForSheet(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
}

function applyStatusDropdowns(sheet) {
  const targetSheet = sheet || getSheet();
  const maxRows = Math.max(targetSheet.getMaxRows(), 2);
  const statusRange = targetSheet.getRange(2, STATUS_COLUMN_INDEX, maxRows - 1, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .build();

  statusRange.setDataValidation(rule);

  return {
    action: 'debug-update-status-dropdown',
    sheetName: targetSheet.getName(),
    column: STATUS_COLUMN_INDEX,
    startRow: 2,
    rowCount: maxRows - 1,
    statusOptions: STATUS_OPTIONS.slice()
  };
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

  sheet.showColumns(1, columnCount);
  sheet.setColumnWidth(1, 60);
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 190);
  sheet.setColumnWidth(4, 260);
  sheet.setColumnWidth(5, 170);
  sheet.setColumnWidth(6, 95);
  sheet.setColumnWidth(7, 80);
  sheet.setColumnWidth(8, 80);
  sheet.setColumnWidth(CURRENT_DIAMETER_COLUMN_INDEX, 95);
  sheet.setColumnWidth(USE_START_DATE_COLUMN_INDEX, 115);
  sheet.hideColumns(1);
  sheet.hideColumns(7);
  sheet.hideColumns(8);

  sheet.getRange(2, CURRENT_DIAMETER_COLUMN_INDEX, maxRows - 1, 1)
    .setHorizontalAlignment('right')
    .setNumberFormat('"Φ"0.0');

  sheet.getRange(2, USE_START_DATE_COLUMN_INDEX, maxRows - 1, 1)
    .setHorizontalAlignment('center')
    .setNumberFormat('yyyy/mm/dd');

  sheet.getRange(1, 1, totalRows, columnCount).setVerticalAlignment('middle');
  if (dataRowCount > 0) {
    sheet.getRange(2, 1, dataRowCount, columnCount).setWrap(true);
    sheet.getRange(2, 7, dataRowCount, 1).setWrap(false);
    sheet.getRange(2, 8, dataRowCount, 1).setWrap(false);
    sheet.getRange(2, CURRENT_DIAMETER_COLUMN_INDEX, dataRowCount, 1).setWrap(false);
    sheet.getRange(2, USE_START_DATE_COLUMN_INDEX, dataRowCount, 1).setWrap(false);
  }

  hideAddRoleButtons(sheet);
  applyStandGroupSeparators(sheet, dataRowCount, columnCount);
}

function hideAddRoleButtons(sheet) {
  removeDrawingsByAction(sheet, ADD_ROLE_ACTION_NAME);
  removeImagesByAction(sheet, ADD_ROLE_ACTION_NAME);
}

function removeDrawingsByAction(sheet, actionName) {
  if (!sheet.getDrawings) {
    return;
  }

  sheet.getDrawings().forEach(function(drawing) {
    try {
      if (drawing.getOnAction && drawing.getOnAction() === actionName && drawing.remove) {
        drawing.remove();
      }
    } catch (error) {
      Logger.log('removeDrawingsByAction error: ' + error.toString());
    }
  });
}

function removeImagesByAction(sheet, actionName) {
  if (!sheet.getImages) {
    return;
  }

  sheet.getImages().forEach(function(image) {
    try {
      if (image.getScript && image.getScript() === actionName && image.remove) {
        image.remove();
      }
    } catch (error) {
      Logger.log('removeImagesByAction error: ' + error.toString());
    }
  });
}

function applyStandGroupSeparators(sheet, dataRowCount, columnCount) {
  if (dataRowCount <= 0) {
    return;
  }

  const standValues = sheet.getRange(2, 2, dataRowCount, 1).getValues();

  standValues.forEach(function(row, index) {
    const currentStand = parseStandNumberForSort(row[0]).stand;
    const nextRow = standValues[index + 1];
    const nextStand = nextRow ? parseStandNumberForSort(nextRow[0]).stand : null;
    const isKnownStand = currentStand !== 999999;
    const isLastInGroup = !nextRow || currentStand !== nextStand;

    if (isKnownStand && isLastInGroup) {
      const sheetRow = index + 2;
      sheet.getRange(sheetRow, 1, 1, columnCount)
        .setBorder(
          null,
          null,
          true,
          null,
          null,
          null,
          '#64748b',
          SpreadsheetApp.BorderStyle.SOLID_MEDIUM
        );
    }
  });
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
