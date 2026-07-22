const SHEET_NAME = 'Roles';
const ROLL_MANAGEMENT_VIEW_SHEET_NAME = 'ロール管理表';
const STAND_MASTER_SHEET_NAME = 'StandMaster';
const INPUT_SHEET_NAMES = ['入力シート', 'Input', '入力'];
const SPREADSHEET_ID = '1X07qQa7u9YPLvErT0D48goT5wYmvcpgNjqzK3FhRFeA';
const SCRIPT_VERSION = 'three-set-fields-v1';
const HEADER_VALUES = ['ID', 'スタンド番号', 'ステータス', 'メモ', '最終更新日', '作業依頼済み', '作業依頼進捗', '履歴', '現在径', '使用開始日', '溶射状態', '納入予定日', '組替指示期限', '使用終了日', '運用3セット対象', '次回組み込み予定'];
const STATUS_COLUMN_INDEX = 3;
const CURRENT_DIAMETER_COLUMN_INDEX = 9;
const USE_START_DATE_COLUMN_INDEX = 10;
const COATING_STATUS_COLUMN_INDEX = 11;
const ADD_ROLE_ACTION_NAME = 'addRoleFromInputArea';
const HEADER_BACKGROUND = '#1f4e78';
const HEADER_FONT_COLOR = '#ffffff';
const LAST_SAVE_DEBUG_KEY = 'ROLL_LAST_SAVE_DEBUG';
const ROLL_MASTER_HEADER_BACKGROUND = '#334155';
const ROLL_MASTER_HEADER_FONT_COLOR = '#ffffff';
const ROLL_MASTER_SHEET_DEFINITIONS = [
  {
    name: '改削マスタ',
    legacyName: 'CuttingMaster',
    columns: [
      { key: 'stand', label: 'スタンド', type: 'text' },
      { key: 'standardCutMm', label: '標準改削量(mm)', type: 'number' },
      { key: 'actualAverageCutMm', label: '実績平均改削量(mm)', type: 'number' },
      { key: 'recentAverageCutMm', label: '直近平均改削量(mm)', type: 'number' },
      { key: 'calculationCutMm', label: '計算採用改削量(mm)', type: 'number' },
      { key: 'actualSampleCount', label: '集計対象件数', type: 'number' },
      { key: 'recentSampleCount', label: '直近集計件数', type: 'number' },
      { key: 'standardDiffMm', label: '標準との差(mm)', type: 'number' },
      { key: 'standardDiffRate', label: '標準との差率(%)', type: 'number' },
      { key: 'warningRemainingCuts', label: '警告残回数', type: 'number' },
      { key: 'dangerRemainingCuts', label: '危険残回数', type: 'number' },
      { key: 'effectiveFrom', label: '適用開始日', type: 'text' },
      { key: 'updatedAt', label: '最終更新日', type: 'text' },
      { key: 'autoUpdate', label: '自動更新', type: 'boolean' },
      { key: 'active', label: '有効', type: 'boolean' },
      { key: 'note', label: '備考', type: 'text' },
      { key: 'anomalyJudgment', label: '異常判定', type: 'text' },
      { key: 'anomalyReason', label: '判定理由', type: 'text' }
    ],
    legacyKeys: [
      'stand',
      'standardCutMm',
      'minCutMm',
      'maxCutMm',
      'warningRemainingCuts',
      'dangerRemainingCuts',
      'effectiveFrom',
      'active',
      'note'
    ],
    rows: [
      ['#2', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#3', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#4', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#5', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#6', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#7', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#8', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#9', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#10', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#11', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#12', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#13', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#14', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#15', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#16', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', ''],
      ['#17', '', '', '', '', '', 5, '', '', 2, 1, '', '', true, true, '', '', '']
    ]
  },
  {
    name: 'ステータスマスタ',
    legacyName: 'StatusMaster',
    columns: [
      { key: 'status', label: 'ステータス', type: 'text' },
      { key: 'category', label: '分類', type: 'text' },
      { key: 'sortOrder', label: '表示順', type: 'number' },
      { key: 'visibleDefault', label: '標準表示', type: 'boolean' },
      { key: 'countsAsUsableStock', label: '使用可能在庫', type: 'boolean' },
      { key: 'countsAsRework', label: '改削対象', type: 'boolean' },
      { key: 'countsAsScrapWaiting', label: '廃却待ち対象', type: 'boolean' },
      { key: 'countsAsScrap', label: '廃棄対象', type: 'boolean' },
      { key: 'active', label: '有効', type: 'boolean' },
      { key: 'color', label: '色', type: 'text' },
      { key: 'note', label: '備考', type: 'text' }
    ],
    rows: []
  },
  {
    name: '通知マスタ',
    legacyName: 'NotificationMaster',
    columns: [
      { key: 'notificationId', label: '通知ID', type: 'text' },
      { key: 'name', label: '通知名', type: 'text' },
      { key: 'enabled', label: '通知ON', type: 'boolean' },
      { key: 'triggerType', label: '条件種別', type: 'text' },
      { key: 'thresholdValue', label: 'しきい値', type: 'number' },
      { key: 'thresholdUnit', label: '単位', type: 'text' },
      { key: 'targetStatusCategory', label: '対象分類', type: 'text' },
      { key: 'recipients', label: '通知先', type: 'text' },
      { key: 'leadDays', label: '事前日数', type: 'number' },
      { key: 'messageTemplate', label: 'メッセージ', type: 'text' },
      { key: 'active', label: '有効', type: 'boolean' }
    ],
    rows: [
      ['cut-warning', 'Cut warning', false, 'remainingCuts', 2, 'cuts', '', '', '', '', true],
      ['cut-danger', 'Cut danger', false, 'remainingCuts', 1, 'cuts', '', '', '', '', true],
      ['lead-days', 'Lead days', false, 'leadDays', '', 'days', '', '', '', '', true]
    ]
  },
  {
    name: 'RotationMaster',
    columns: [
      { key: 'roleId', label: 'ロールID', type: 'text' },
      { key: 'rollName', label: 'ロール名', type: 'text' },
      { key: 'stand', label: 'スタンド', type: 'text' },
      { key: 'rotationOrder', label: '使用順', type: 'number' },
      { key: 'isCoreSet', label: '3セット内', type: 'boolean' },
      { key: 'rotationActive', label: '予測対象', type: 'boolean' },
      { key: 'forecastAnchorDate', label: '予測基準日', type: 'text' },
      { key: 'forecastNote', label: '備考', type: 'text' },
      { key: 'updatedAt', label: '更新日時', type: 'text' }
    ],
    rows: []
  },
  {
    name: '作業履歴',
    legacyName: 'WorkHistory',
    columns: [
      { key: 'eventId', label: '履歴ID', type: 'text' },
      { key: 'roleId', label: 'ロールID', type: 'text' },
      { key: 'standRollName', label: 'ロール名', type: 'text' },
      { key: 'stand', label: 'スタンド', type: 'text' },
      { key: 'eventType', label: 'イベント種別', type: 'text' },
      { key: 'eventAt', label: '日時', type: 'text' },
      { key: 'beforeValue', label: '変更前', type: 'text' },
      { key: 'afterValue', label: '変更後', type: 'text' },
      { key: 'currentDiameter', label: '現在径', type: 'number' },
      { key: 'cutMm', label: '改削量', type: 'number' },
      { key: 'operator', label: '担当者', type: 'text' },
      { key: 'source', label: '登録元', type: 'text' },
      { key: 'note', label: '備考', type: 'text' },
      { key: 'active', label: '有効', type: 'boolean' },
      { key: 'invalidatedAt', label: '無効化日時', type: 'text' },
      { key: 'invalidationReason', label: '無効化理由', type: 'text' },
      { key: 'invalidatedBy', label: '無効化元', type: 'text' }
    ],
    rows: []
  }
];
const DEFAULT_STATUS = '中古予備（バラシ前）';
const STATUS_OPTIONS = [
  'オンライン',
  '中古予備（バラシ前）',
  '改削行き（搬出可能）',
  '改削中',
  '新品予備（組替可能）',
  '新品予備（組込完了）',
  '新品予備保管',
  '発注済み（納入待ち）',
  '廃却待ち（ラック保管）',
  '廃棄'
];
const ROLL_MANAGEMENT_VIEW_HEADERS = [
  'スタンド',
  'ロールID',
  '搬出日',
  '搬入日',
  'ロール径',
  '使用開始日',
  '使用終了日',
  'ステータス',
  'メモ'
];
const ROLL_MANAGEMENT_VIEW_STATUS_ORDER = [
  'オンライン',
  '新品予備（組込完了）',
  '新品予備（組替可能）',
  '中古予備（バラシ前）',
  '改削行き（搬出可能）',
  '改削中',
  '新品予備保管',
  '発注済み（納入待ち）',
  '廃却待ち（ラック保管）',
  '廃棄'
];
const ROLL_MANAGEMENT_VIEW_STATUS_COLORS = {
  'オンライン': '#e2f0d9',
  '新品予備（組込完了）': '#d9eaf7',
  '新品予備（組替可能）': '#e8f1fb',
  '中古予備（バラシ前）': '#eeeeee',
  '改削行き（搬出可能）': '#fff2cc',
  '改削中': '#fce4d6',
  '新品予備保管': '#e4dfec',
  '発注済み（納入待ち）': '#d9ead3',
  '廃却待ち（ラック保管）': '#f4cccc',
  '廃棄': '#d9d9d9'
};
const ROLL_MANAGEMENT_VIEW_HEADER_BACKGROUND = '#1f4e78';
const ROLL_MANAGEMENT_VIEW_HEADER_FONT_COLOR = '#ffffff';
const ROLL_MANAGEMENT_VIEW_PLANNED_FONT_COLOR = '#7f8c8d';
const ROLL_MANAGEMENT_VIEW_INBOUND_PLAN_DAYS = 25;
const FIELD_ROLL_MANAGEMENT_VIEW_SHEET_NAME = 'ロール管理表（現場）';
const FIELD_ROLL_MANAGEMENT_VIEW_TITLE = '現場用 3セットロール管理表';
const FIELD_ROLL_MANAGEMENT_VIEW_HEADERS = [
  'スタンド',
  '役割',
  'ロールID',
  '搬出日',
  '搬入日',
  'ロール径',
  '使用開始日',
  '使用終了日',
  'ステータス',
  'メモ'
];
const FIELD_ROLL_MANAGEMENT_STANDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const FIELD_ROLL_MANAGEMENT_ROLE_DEFINITIONS = [
  { label: '使用中' },
  { label: '次回組み込み' },
  { label: '改削待ち' }
];
const FIELD_ROLL_MANAGEMENT_DIRECT_EXCEPTION_STATUSES = [
  '新品予備保管',
  '発注済み（納入待ち）',
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
  } else if (action === 'fetchstandmaster') {
    try {
      const standMaster = fetchStandMaster();
      Logger.log('doGet fetchStandMaster: returning ' + standMaster.length + ' rows');
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, standMaster: standMaster }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet fetchStandMaster error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'fetchcuttingmaster') {
    try {
      const cuttingMaster = fetchCuttingMaster();
      Logger.log('doGet fetchCuttingMaster: returning ' + cuttingMaster.length + ' rows');
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, cuttingMaster: cuttingMaster }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet fetchCuttingMaster error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'analyzecuttinghistory') {
    try {
      const analysis = analyzeCuttingHistory();
      Logger.log('doGet analyzeCuttingHistory: returning ' + analysis.length + ' rows');
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, cuttingHistoryAnalysis: analysis }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet analyzeCuttingHistory error: ' + error.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'updatecuttingmasterfromhistory') {
    try {
      const result = updateCuttingMasterFromHistory();
      Logger.log('doGet updateCuttingMasterFromHistory: ' + JSON.stringify(result));
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet updateCuttingMasterFromHistory error: ' + error.toString());
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
  } else if (action === 'debug-three-set-fields') {
    try {
      return ContentService
        .createTextOutput(JSON.stringify(getThreeSetFieldsDebugState()))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log('doGet debug-three-set-fields error: ' + error.toString());
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
      logThreeSetFieldsPostDebug(roles);
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
    } else if (action === 'appendworkhistory') {
      const event = appendWorkHistoryEvent(payload.event || {});
      const cuttingMasterUpdate = event.eventType === '\u6539\u524a'
        ? updateCuttingMasterFromHistoryAfterWorkHistoryAppend()
        : null;

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          event: event,
          cuttingMasterUpdate: cuttingMasterUpdate
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'invalidatelatestcuttinghistoryforinputcorrection') {
      const result = invalidateLatestCuttingHistoryForInputCorrection(payload.event || {});
      const cuttingMasterUpdate = result.invalidated
        ? updateCuttingMasterFromHistoryAfterWorkHistoryInvalidation()
        : null;

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          result: result,
          cuttingMasterUpdate: cuttingMasterUpdate
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'updatecuttingmasterfromhistory') {
      const result = updateCuttingMasterFromHistory();

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          result: result
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

function updateCuttingMasterFromHistoryAfterWorkHistoryAppend() {
  return updateCuttingMasterFromHistorySafely('updateCuttingMasterFromHistoryAfterWorkHistoryAppend');
}

function updateCuttingMasterFromHistoryAfterWorkHistoryInvalidation() {
  return updateCuttingMasterFromHistorySafely('updateCuttingMasterFromHistoryAfterWorkHistoryInvalidation');
}

function updateCuttingMasterFromHistorySafely(source) {
  try {
    const result = updateCuttingMasterFromHistory();
    Logger.log(source + ': ' + JSON.stringify(result));
    return {
      success: true,
      result: result
    };
  } catch (error) {
    Logger.log(source + ' error: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
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
      useStartDate: normalizeUseStartDateForSheet(row[9]),
      coatingStatus: normalizeCoatingStatusForSheet(row[10], row[2]),
      orderExpectedDeliveryDate: normalizeDateInputValueForSheet(row[11]),
      assemblyInstructionDue: normalizeTextForSheet(row[12]),
      useEndDate: normalizeDateInputValueForSheet(row[13]),
      isActiveThreeSet: normalizeBooleanForFieldRollManagement(row[14]),
      nextAssemblyPlanned: normalizeBooleanForFieldRollManagement(row[15])
    };
  }).filter(row => row.name && String(row.name).trim() !== '');
  
  Logger.log('fetchRoles: returning ' + result.length + ' roles');
  return result;
}

function fetchStandMaster() {
  const sheet = getStandMasterSheet();
  const values = sheet.getDataRange().getValues();
  Logger.log('fetchStandMaster: sheet has ' + values.length + ' rows');

  if (values.length <= 1) {
    return [];
  }

  const rows = values.slice(1);
  const result = rows.map(row => {
    return {
      stand: normalizeStandMasterStandValue(row[0]),
      newDiameter: normalizeStandMasterNumericValue(row[1]),
      scrapDiameter: normalizeStandMasterNumericValue(row[2]),
      leadTimeMonths: normalizeStandMasterNumericValue(row[3])
    };
  }).filter(row => row.stand && String(row.stand).trim() !== '');

  Logger.log('fetchStandMaster: returning ' + result.length + ' rows');
  return result;
}

function fetchCuttingMaster() {
  const definition = getRollMasterDefinitionByLegacyName('CuttingMaster');
  const sheet = getRollMasterSheetForRead(definition);
  const values = sheet.getDataRange().getValues();
  Logger.log('fetchCuttingMaster: sheet has ' + values.length + ' rows');

  if (values.length <= 1) {
    return [];
  }

  const standIndex = getRollMasterColumnIndexByKey(definition, 'stand') - 1;
  const standardCutMmIndex = getRollMasterColumnIndexByKey(definition, 'standardCutMm') - 1;
  const actualAverageCutMmIndex = getRollMasterColumnIndexByKey(definition, 'actualAverageCutMm') - 1;
  const recentAverageCutMmIndex = getRollMasterColumnIndexByKey(definition, 'recentAverageCutMm') - 1;
  const calculationCutMmIndex = getRollMasterColumnIndexByKey(definition, 'calculationCutMm') - 1;
  const actualSampleCountIndex = getRollMasterColumnIndexByKey(definition, 'actualSampleCount') - 1;
  const standardDiffMmIndex = getRollMasterColumnIndexByKey(definition, 'standardDiffMm') - 1;
  const standardDiffRateIndex = getRollMasterColumnIndexByKey(definition, 'standardDiffRate') - 1;
  const activeIndex = getRollMasterColumnIndexByKey(definition, 'active') - 1;
  const anomalyJudgmentIndex = getRollMasterColumnIndexByKey(definition, 'anomalyJudgment') - 1;
  const anomalyReasonIndex = getRollMasterColumnIndexByKey(definition, 'anomalyReason') - 1;
  const rows = values.slice(1);
  const result = rows.map(function(row) {
    const standardCutMm = normalizeStandMasterNumericValue(row[standardCutMmIndex]);
    const calculationCutMm = normalizeStandMasterNumericValue(row[calculationCutMmIndex]);

    return {
      stand: normalizeStandMasterStandValue(row[standIndex]),
      standardCutMm: standardCutMm,
      calculationCutMm: calculationCutMm,
      actualAverageCutMm: normalizeStandMasterNumericValue(row[actualAverageCutMmIndex]),
      recentAverageCutMm: normalizeStandMasterNumericValue(row[recentAverageCutMmIndex]),
      actualSampleCount: normalizeStandMasterNumericValue(row[actualSampleCountIndex]),
      standardDiffMm: normalizeStandMasterNumericValue(row[standardDiffMmIndex]),
      standardDiffRate: normalizeStandMasterNumericValue(row[standardDiffRateIndex]),
      anomalyJudgment: row[anomalyJudgmentIndex] || '',
      anomalyReason: row[anomalyReasonIndex] || '',
      active: normalizeRollMasterBooleanValue(row[activeIndex])
    };
  }).filter(function(row) {
    return row.stand && String(row.stand).trim() !== '';
  });

  Logger.log('fetchCuttingMaster: returning ' + result.length + ' rows');
  return result;
}

function analyzeCuttingHistory() {
  const cuttingMasterDefinition = getRollMasterDefinitionByLegacyName('CuttingMaster');
  const workHistoryDefinition = getRollMasterDefinitionByLegacyName('WorkHistory');
  const recentSampleCountsByStand = getCuttingMasterRecentSampleCountsByStand(cuttingMasterDefinition);
  const eventsByStand = getCuttingHistoryEventsByStand(workHistoryDefinition);
  const stands = Object.keys(eventsByStand).sort(compareNormalizedStandValues);

  return stands.map(function(stand) {
    const events = eventsByStand[stand].slice().sort(compareCuttingHistoryEventsByDateDesc);
    const recentSampleCount = recentSampleCountsByStand[stand] || 5;
    const recentEvents = events.slice(0, recentSampleCount);
    const cutValues = events.map(function(event) {
      return event.cutMm;
    });
    const recentCutValues = recentEvents.map(function(event) {
      return event.cutMm;
    });

    return {
      stand: stand,
      sampleCount: cutValues.length,
      actualAverageCutMm: roundCuttingHistoryNumber(averageCuttingHistoryValues(cutValues)),
      recentAverageCutMm: roundCuttingHistoryNumber(averageCuttingHistoryValues(recentCutValues)),
      recentSampleCount: recentCutValues.length,
      recentSampleLimit: recentSampleCount,
      maxCutMm: roundCuttingHistoryNumber(Math.max.apply(null, cutValues)),
      minCutMm: roundCuttingHistoryNumber(Math.min.apply(null, cutValues))
    };
  });
}

function updateCuttingMasterFromHistory() {
  const definition = getRollMasterDefinitionByLegacyName('CuttingMaster');
  const sheet = getRollMasterSheetForRead(definition);
  ensureRollMasterSheetColumns(sheet, definition);
  const values = sheet.getDataRange().getValues();
  const analysisByStand = {};
  const now = new Date().toISOString();
  const columnIndexes = getCuttingMasterHistoryUpdateColumnIndexes(definition);
  let updatedCount = 0;
  const skippedStands = [];

  if (values.length <= 1) {
    return {
      updatedCount: 0,
      skippedStands: [],
      updatedAt: now
    };
  }

  analyzeCuttingHistory().forEach(function(item) {
    analysisByStand[normalizeCuttingHistoryStandValue(item.stand)] = item;
  });

  values.slice(1).forEach(function(row, index) {
    const rowNumber = index + 2;
    const stand = normalizeCuttingHistoryStandValue(row[columnIndexes.stand - 1]);
    const analysis = analysisByStand[stand];

    if (!stand || !analysis) {
      if (stand) {
        skippedStands.push(stand);
        sheet.getRange(rowNumber, columnIndexes.anomalyJudgment).setValue('判定保留');
        sheet.getRange(rowNumber, columnIndexes.anomalyReason).setValue('履歴なし');
        sheet.getRange(rowNumber, columnIndexes.updatedAt).setValue(now);
      }
      return;
    }

    const standardCutMm = normalizeStandMasterNumericValue(row[columnIndexes.standardCutMm - 1]);
    const diffSourceCutMm = analysis.recentAverageCutMm !== ''
      ? analysis.recentAverageCutMm
      : analysis.actualAverageCutMm;
    const standardDiffMm = standardCutMm !== '' && diffSourceCutMm !== ''
      ? roundCuttingHistoryNumber(diffSourceCutMm - standardCutMm)
      : '';
    const standardDiffRate = standardCutMm !== '' && standardCutMm !== 0 && standardDiffMm !== ''
      ? roundCuttingHistoryNumber(standardDiffMm / standardCutMm)
      : '';
    const anomaly = getCuttingMasterAnomalyJudgment(analysis.sampleCount, standardDiffRate);

    sheet.getRange(rowNumber, columnIndexes.actualAverageCutMm).setValue(analysis.actualAverageCutMm);
    sheet.getRange(rowNumber, columnIndexes.recentAverageCutMm).setValue(analysis.recentAverageCutMm);
    sheet.getRange(rowNumber, columnIndexes.actualSampleCount).setValue(analysis.sampleCount);
    sheet.getRange(rowNumber, columnIndexes.standardDiffMm).setValue(standardDiffMm);
    sheet.getRange(rowNumber, columnIndexes.standardDiffRate).setValue(standardDiffRate);
    sheet.getRange(rowNumber, columnIndexes.updatedAt).setValue(now);
    sheet.getRange(rowNumber, columnIndexes.anomalyJudgment).setValue(anomaly.judgment);
    sheet.getRange(rowNumber, columnIndexes.anomalyReason).setValue(anomaly.reason);
    updatedCount += 1;
  });

  applyRollMasterSheetFormatting(sheet, definition);

  return {
    updatedCount: updatedCount,
    skippedStands: skippedStands,
    updatedAt: now
  };
}

function getCuttingMasterHistoryUpdateColumnIndexes(definition) {
  const keys = [
    'stand',
    'standardCutMm',
    'actualAverageCutMm',
    'recentAverageCutMm',
    'actualSampleCount',
    'standardDiffMm',
    'standardDiffRate',
    'updatedAt',
    'anomalyJudgment',
    'anomalyReason'
  ];
  const indexes = {};

  keys.forEach(function(key) {
    const index = getRollMasterColumnIndexByKey(definition, key);

    if (index <= 0) {
      throw new Error('CuttingMaster column not found: ' + key);
    }

    indexes[key] = index;
  });

  return indexes;
}

function getCuttingMasterAnomalyJudgment(sampleCount, standardDiffRate) {
  const normalizedSampleCount = Number(sampleCount) || 0;
  const normalizedDiffRate = normalizeStandMasterNumericValue(standardDiffRate);

  if (normalizedSampleCount < 3) {
    return {
      judgment: '判定保留',
      reason: 'サンプル不足'
    };
  }

  if (normalizedDiffRate !== '' && Math.abs(normalizedDiffRate) >= 0.25) {
    return {
      judgment: '異常',
      reason: '標準との差率 ' + formatCuttingMasterDiffRateForReason(normalizedDiffRate)
    };
  }

  if (normalizedDiffRate !== '' && Math.abs(normalizedDiffRate) >= 0.15) {
    return {
      judgment: '注意',
      reason: '標準との差率 ' + formatCuttingMasterDiffRateForReason(normalizedDiffRate)
    };
  }

  return {
    judgment: '正常',
    reason: '標準範囲内'
  };
}

function formatCuttingMasterDiffRateForReason(value) {
  const rate = Number(value);

  if (!isFinite(rate)) {
    return '';
  }

  const percent = Math.round(rate * 1000) / 10;
  const sign = percent > 0 ? '+' : '';
  return sign + percent.toFixed(1) + '%';
}

function getCuttingMasterRecentSampleCountsByStand(definition) {
  const sheet = getRollMasterSheetForRead(definition);
  const values = sheet.getDataRange().getValues();
  const standIndex = getRollMasterColumnIndexByKey(definition, 'stand') - 1;
  const recentSampleCountIndex = getRollMasterColumnIndexByKey(definition, 'recentSampleCount') - 1;
  const result = {};

  if (values.length <= 1 || standIndex < 0 || recentSampleCountIndex < 0) {
    return result;
  }

  values.slice(1).forEach(function(row) {
    const stand = normalizeCuttingHistoryStandValue(row[standIndex]);
    const recentSampleCount = normalizeStandMasterNumericValue(row[recentSampleCountIndex]);

    if (!stand) {
      return;
    }

    result[stand] = recentSampleCount !== '' && recentSampleCount > 0
      ? Math.floor(recentSampleCount)
      : 5;
  });

  return result;
}

function getCuttingHistoryEventsByStand(definition) {
  const sheet = getRollMasterSheetForRead(definition);
  const values = sheet.getDataRange().getValues();
  const standIndex = getRollMasterColumnIndexByKey(definition, 'stand') - 1;
  const eventTypeIndex = getRollMasterColumnIndexByKey(definition, 'eventType') - 1;
  const eventAtIndex = getRollMasterColumnIndexByKey(definition, 'eventAt') - 1;
  const cutMmIndex = getRollMasterColumnIndexByKey(definition, 'cutMm') - 1;
  const activeIndex = getRollMasterColumnIndexByKey(definition, 'active') - 1;
  const result = {};

  if (values.length <= 1 || standIndex < 0 || eventTypeIndex < 0 || cutMmIndex < 0) {
    return result;
  }

  values.slice(1).forEach(function(row) {
    const eventType = String(row[eventTypeIndex] || '').trim();
    const cutMm = normalizeStandMasterNumericValue(row[cutMmIndex]);
    const stand = normalizeCuttingHistoryStandValue(row[standIndex]);
    const active = activeIndex >= 0 ? normalizeRollMasterBooleanValue(row[activeIndex]) : true;

    if (!active || eventType !== '\u6539\u524a' || cutMm === '' || cutMm <= 0 || cutMm >= 30 || !stand) {
      return;
    }

    if (!result[stand]) {
      result[stand] = [];
    }

    result[stand].push({
      stand: stand,
      eventAt: eventAtIndex >= 0 ? row[eventAtIndex] : '',
      cutMm: cutMm
    });
  });

  return result;
}

function normalizeCuttingHistoryStandValue(value) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  const match = text.match(/#?\s*(\d+)/);

  return match ? '#' + Number(match[1]) : '';
}

function compareNormalizedStandValues(a, b) {
  const aNumber = Number(String(a || '').replace('#', '')) || 999999;
  const bNumber = Number(String(b || '').replace('#', '')) || 999999;

  if (aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  return String(a || '').localeCompare(String(b || ''));
}

function compareCuttingHistoryEventsByDateDesc(a, b) {
  const aTime = new Date(a && a.eventAt ? a.eventAt : '').getTime();
  const bTime = new Date(b && b.eventAt ? b.eventAt : '').getTime();
  const safeATime = isFinite(aTime) ? aTime : 0;
  const safeBTime = isFinite(bTime) ? bTime : 0;

  return safeBTime - safeATime;
}

function averageCuttingHistoryValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '';
  }

  const total = values.reduce(function(sum, value) {
    return sum + value;
  }, 0);

  return total / values.length;
}

function roundCuttingHistoryNumber(value) {
  if (value === '' || !isFinite(value)) {
    return '';
  }

  return Math.round(Number(value) * 1000) / 1000;
}

function initializeStandMaster() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(STAND_MASTER_SHEET_NAME);
  let createdSheet = false;

  if (!sheet) {
    sheet = ss.insertSheet(STAND_MASTER_SHEET_NAME);
    createdSheet = true;
  }

  const headers = ['スタンド', '新径', '廃却径', '購入リードタイム月'];
  const rows = [
    ['#2', 450, 400, 6],
    ['#3', 450, 400, 6],
    ['#4', 450, 400, 6],
    ['#5', 450, 400, 6],
    ['#6', 365, 320, 6],
    ['#7', 365, 320, 6],
    ['#8', 365, 320, 6],
    ['#9', 365, 320, 6],
    ['#10', 340, 292, 6],
    ['#11', 340, 292, 6],
    ['#12', 340, 292, 6],
    ['#13', 340, 292, 6],
    ['#14', 340, 292, 6],
    ['#15', 335, 292, 6],
    ['#16', 340, 292, 6],
    ['#17', 340, 292, 6]
  ];
  const dataRows = getStandMasterDataRows(sheet);

  if (dataRows.length === rows.length && isStandMasterCanonicalRows(dataRows)) {
    Logger.log('initializeStandMaster: skipped because StandMaster is already canonical');
    return {
      success: false,
      skipped: true,
      reason: 'StandMaster is already canonical',
      createdSheet: createdSheet,
      insertedRows: 0
    };
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1 + rows.length, headers.length).setValues([headers].concat(rows));

  Logger.log('initializeStandMaster: wrote headers and ' + rows.length + ' rows');
  return {
    success: true,
    skipped: false,
    createdSheet: createdSheet,
    insertedRows: rows.length
  };
}

function initializeRollMasterSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const results = ROLL_MASTER_SHEET_DEFINITIONS.map(function(definition) {
    return initializeRollMasterSheet(ss, definition);
  });

  Logger.log('initializeRollMasterSheets: ' + JSON.stringify(results));
  return {
    success: true,
    sheets: results
  };
}

function initializeRollMasterSheet(ss, definition) {
  const sheetResult = getOrCreateRollMasterSheet(ss, definition);
  const sheet = sheetResult.sheet;
  const rows = getRollMasterInitialRows(definition);
  const columnCount = getRollMasterColumnCount(definition);
  const labels = getRollMasterColumnLabels(definition);

  if (sheetResult.createdSheet) {
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, columnCount).setValues(rows);
    }
  } else if (definition.legacyName === 'CuttingMaster') {
    upgradeCuttingMasterSheetRows(sheet, definition);
  }

  sheet.getRange(1, 1, 1, columnCount).setValues([labels]);
  applyRollMasterSheetFormatting(sheet, definition);

  return {
    name: definition.name,
    legacyName: definition.legacyName || '',
    createdSheet: sheetResult.createdSheet,
    renamedSheet: sheetResult.renamedSheet,
    insertedRows: sheetResult.createdSheet ? rows.length : 0,
    formatted: true
  };
}

function getOrCreateRollMasterSheet(ss, definition) {
  let sheet = ss.getSheetByName(definition.name);

  if (sheet) {
    return {
      sheet: sheet,
      createdSheet: false,
      renamedSheet: false
    };
  }

  if (definition.legacyName) {
    sheet = ss.getSheetByName(definition.legacyName);
    if (sheet) {
      sheet.setName(definition.name);
      return {
        sheet: sheet,
        createdSheet: false,
        renamedSheet: true
      };
    }
  }

  return {
    sheet: ss.insertSheet(definition.name),
    createdSheet: true,
    renamedSheet: false
  };
}

function getRollMasterInitialRows(definition) {
  if (definition.legacyName === 'StatusMaster') {
    return STATUS_OPTIONS.map(function(status, index) {
      return [
        status,
        '',
        index + 1,
        true,
        false,
        false,
        false,
        false,
        true,
        '',
        ''
      ];
    });
  }

  return (definition.rows || []).map(function(row) {
    return row.slice();
  });
}

function upgradeCuttingMasterSheetRows(sheet, definition) {
  const values = sheet.getDataRange().getValues();
  const currentColumnCount = values.length > 0 ? values[0].length : 0;
  const sourceKeys = currentColumnCount <= (definition.legacyKeys || []).length
    ? definition.legacyKeys
    : definition.columns.map(function(column) {
      return column.key;
    });
  const existingRecords = values.slice(1).map(function(row) {
    return getRollMasterRecordFromRow(row, sourceKeys);
  }).filter(function(record) {
    return normalizeStandMasterStandValue(record.stand) !== '';
  });
  const recordsByStand = {};

  existingRecords.forEach(function(record) {
    recordsByStand[normalizeStandMasterStandValue(record.stand)] = record;
  });

  const canonicalRows = getCuttingMasterCanonicalStands().map(function(stand) {
    return normalizeCuttingMasterRecord(recordsByStand[stand] || { stand: stand });
  });
  const extraRows = existingRecords.filter(function(record) {
    return getCuttingMasterCanonicalStands().indexOf(normalizeStandMasterStandValue(record.stand)) === -1;
  }).map(function(record) {
    return normalizeCuttingMasterRecord(record);
  });
  const rows = canonicalRows.concat(extraRows).map(function(record) {
    return getRollMasterRowFromRecord(record, definition);
  });
  const columnCount = getRollMasterColumnCount(definition);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, columnCount).setValues(rows);
  }
}

function getCuttingMasterCanonicalStands() {
  return ['#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11', '#12', '#13', '#14', '#15', '#16', '#17'];
}

function getRollMasterRecordFromRow(row, keys) {
  const record = {};

  keys.forEach(function(key, index) {
    record[key] = row[index];
  });

  return record;
}

function getRollMasterRowFromRecord(record, definition) {
  return definition.columns.map(function(column) {
    return record[column.key] === undefined || record[column.key] === null ? '' : record[column.key];
  });
}

function normalizeCuttingMasterRecord(record) {
  const normalized = {};

  normalized.stand = normalizeStandMasterStandValue(record.stand);
  normalized.standardCutMm = normalizeStandMasterNumericValue(record.standardCutMm);
  normalized.actualAverageCutMm = normalizeStandMasterNumericValue(record.actualAverageCutMm);
  normalized.recentAverageCutMm = normalizeStandMasterNumericValue(record.recentAverageCutMm);
  normalized.calculationCutMm = normalizeStandMasterNumericValue(record.calculationCutMm);
  normalized.actualSampleCount = normalizeStandMasterNumericValue(record.actualSampleCount);
  normalized.recentSampleCount = normalizeStandMasterNumericValue(record.recentSampleCount);
  normalized.standardDiffMm = normalizeStandMasterNumericValue(record.standardDiffMm);
  normalized.standardDiffRate = normalizeStandMasterNumericValue(record.standardDiffRate);
  normalized.warningRemainingCuts = normalizeStandMasterNumericValue(record.warningRemainingCuts);
  normalized.dangerRemainingCuts = normalizeStandMasterNumericValue(record.dangerRemainingCuts);
  normalized.effectiveFrom = record.effectiveFrom || '';
  normalized.updatedAt = record.updatedAt || '';
  normalized.autoUpdate = normalizeRollMasterBooleanValue(record.autoUpdate);
  normalized.active = normalizeRollMasterBooleanValue(record.active);
  normalized.note = record.note || '';
  normalized.anomalyJudgment = record.anomalyJudgment || '';
  normalized.anomalyReason = record.anomalyReason || '';

  if (normalized.calculationCutMm === '' && normalized.standardCutMm !== '') {
    normalized.calculationCutMm = normalized.standardCutMm;
  }

  if (normalized.recentSampleCount === '') {
    normalized.recentSampleCount = 5;
  }

  if (normalized.warningRemainingCuts === '') {
    normalized.warningRemainingCuts = 2;
  }

  if (normalized.dangerRemainingCuts === '') {
    normalized.dangerRemainingCuts = 1;
  }

  return normalized;
}

function applyRollMasterSheetFormatting(sheet, definition) {
  const columnCount = getRollMasterColumnCount(definition);
  const totalRows = Math.max(sheet.getLastRow(), 1);
  const maxRows = Math.max(sheet.getMaxRows(), 2);

  ensureRollMasterSheetColumns(sheet, definition);
  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight('bold')
    .setFontColor(ROLL_MASTER_HEADER_FONT_COLOR)
    .setBackground(ROLL_MASTER_HEADER_BACKGROUND)
    .setHorizontalAlignment('center');

  sheet.getRange(1, 1, totalRows, columnCount)
    .setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID)
    .setVerticalAlignment('middle');

  const existingFilter = sheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }
  sheet.getRange(1, 1, totalRows, columnCount).createFilter();

  applyRollMasterBooleanValidation(sheet, definition, maxRows);
  applyRollMasterNumberFormats(sheet, definition, maxRows);
  applyRollMasterTextFormats(sheet, definition, maxRows);
  applyCuttingMasterAnomalyFormatting(sheet, definition, maxRows);
  applyRollMasterColumnWidths(sheet, definition);
}

function ensureRollMasterSheetColumns(sheet, definition) {
  const labels = getRollMasterColumnLabels(definition);
  sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
}

function getRollMasterColumnCount(definition) {
  return definition.columns.length;
}

function getRollMasterColumnLabels(definition) {
  return definition.columns.map(function(column) {
    return column.label;
  });
}

function getRollMasterColumnIndexByKey(definition, key) {
  const index = definition.columns.findIndex(function(column) {
    return column.key === key;
  });

  return index >= 0 ? index + 1 : 0;
}

function getRollMasterColumnIndexesByType(definition, type) {
  return definition.columns.map(function(column, index) {
    return column.type === type ? index + 1 : 0;
  }).filter(function(columnIndex) {
    return columnIndex > 0;
  });
}

function applyRollMasterBooleanValidation(sheet, definition, maxRows) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .build();

  getRollMasterColumnIndexesByType(definition, 'boolean').forEach(function(columnIndex) {
    sheet.getRange(2, columnIndex, maxRows - 1, 1)
      .setDataValidation(rule)
      .setHorizontalAlignment('center');
  });
}

function applyRollMasterNumberFormats(sheet, definition, maxRows) {
  definition.columns.forEach(function(column, index) {
    if (column.type !== 'number') {
      return;
    }

    const numberFormat = column.key === 'standardDiffRate'
      ? '0.00%'
      : '0.########';

    sheet.getRange(2, index + 1, maxRows - 1, 1)
      .setNumberFormat(numberFormat)
      .setHorizontalAlignment('right');
  });
}

function applyRollMasterTextFormats(sheet, definition, maxRows) {
  getRollMasterColumnIndexesByType(definition, 'text').forEach(function(columnIndex) {
    sheet.getRange(2, columnIndex, maxRows - 1, 1)
      .setNumberFormat('@')
      .setHorizontalAlignment('left');
  });
}

function applyRollMasterColumnWidths(sheet, definition) {
  const widthsByLegacyName = {
    CuttingMaster: {
      stand: 80,
      standardCutMm: 120,
      actualAverageCutMm: 130,
      recentAverageCutMm: 130,
      calculationCutMm: 130,
      actualSampleCount: 100,
      recentSampleCount: 100,
      standardDiffMm: 120,
      standardDiffRate: 120,
      warningRemainingCuts: 100,
      dangerRemainingCuts: 100,
      effectiveFrom: 130,
      updatedAt: 160,
      autoUpdate: 90,
      active: 80,
      note: 260,
      anomalyJudgment: 100,
      anomalyReason: 220
    },
    WorkHistory: {
      eventId: 220,
      roleId: 90,
      standRollName: 100,
      stand: 80,
      eventType: 100,
      eventAt: 160,
      beforeValue: 100,
      afterValue: 100,
      currentDiameter: 100,
      cutMm: 100,
      operator: 100,
      source: 120,
      note: 260,
      active: 80,
      invalidatedAt: 160,
      invalidationReason: 160,
      invalidatedBy: 120
    },
    StatusMaster: {
      status: 150,
      category: 130,
      sortOrder: 80,
      visibleDefault: 90,
      countsAsUsableStock: 110,
      countsAsRework: 100,
      countsAsScrapWaiting: 120,
      countsAsScrap: 100,
      active: 80,
      color: 100,
      note: 260
    },
    NotificationMaster: {
      notificationId: 180,
      name: 180,
      enabled: 90,
      triggerType: 130,
      thresholdValue: 90,
      thresholdUnit: 80,
      targetStatusCategory: 130,
      recipients: 220,
      leadDays: 100,
      messageTemplate: 300,
      active: 80
    },
    RotationMaster: {
      roleId: 120,
      rollName: 120,
      stand: 80,
      rotationOrder: 80,
      isCoreSet: 90,
      rotationActive: 90,
      forecastAnchorDate: 130,
      forecastNote: 250,
      updatedAt: 150
    }
  };
  const widthsByKey = widthsByLegacyName[definition.legacyName] || widthsByLegacyName[definition.name] || {};

  definition.columns.forEach(function(column, index) {
    const width = widthsByKey[column.key];

    if (width) {
      sheet.setColumnWidth(index + 1, width);
    }
  });
}

function applyCuttingMasterAnomalyFormatting(sheet, definition, maxRows) {
  if (definition.legacyName !== 'CuttingMaster') {
    return;
  }

  const anomalyJudgmentColumn = getRollMasterColumnIndexByKey(definition, 'anomalyJudgment');
  const anomalyReasonColumn = getRollMasterColumnIndexByKey(definition, 'anomalyReason');

  if (anomalyJudgmentColumn <= 0) {
    return;
  }

  const rowCount = maxRows - 1;
  const range = sheet.getRange(2, anomalyJudgmentColumn, rowCount, 1);
  const colorsByJudgment = {
    '判定保留': { background: '#e5e7eb', font: '#374151' },
    '正常': { background: '#dcfce7', font: '#166534' },
    '注意': { background: '#fef3c7', font: '#92400e' },
    '異常': { background: '#fee2e2', font: '#991b1b' }
  };
  const values = range.getValues();
  const backgrounds = values.map(function(row) {
    const colors = colorsByJudgment[String(row[0] || '')];
    return [colors ? colors.background : '#ffffff'];
  });
  const fontColors = values.map(function(row) {
    const colors = colorsByJudgment[String(row[0] || '')];
    return [colors ? colors.font : '#111827'];
  });

  range
    .setBackgrounds(backgrounds)
    .setFontColors(fontColors)
    .setHorizontalAlignment('center')
    .setFontWeight('bold');

  if (anomalyReasonColumn > 0) {
    sheet.getRange(2, anomalyReasonColumn, rowCount, 1)
      .setHorizontalAlignment('left')
      .setWrap(true);
  }
}

function getRollMasterDefinitionByLegacyName(legacyName) {
  const definition = ROLL_MASTER_SHEET_DEFINITIONS.find(function(item) {
    return item.legacyName === legacyName;
  });

  if (!definition) {
    throw new Error('Roll master definition not found: ' + legacyName);
  }

  return definition;
}

function getRollMasterSheetForRead(definition) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(definition.name)
    || (definition.legacyName ? ss.getSheetByName(definition.legacyName) : null);

  if (!sheet) {
    throw new Error('Roll master sheet not found: ' + definition.name);
  }

  return sheet;
}

function normalizeRollMasterBooleanValue(value) {
  if (value === true || String(value).trim().toLowerCase() === 'true') {
    return true;
  }

  if (value === false || String(value).trim().toLowerCase() === 'false') {
    return false;
  }

  return true;
}

function appendWorkHistoryEvent(event) {
  const definition = getRollMasterDefinitionByLegacyName('WorkHistory');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetResult = getOrCreateRollMasterSheet(ss, definition);
  const sheet = sheetResult.sheet;
  const columnCount = getRollMasterColumnCount(definition);
  const labels = getRollMasterColumnLabels(definition);
  const normalizedEvent = normalizeWorkHistoryEventForSheet(event);
  const row = getRollMasterRowFromRecord(normalizedEvent, definition);

  ensureRollMasterSheetColumns(sheet, definition);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, columnCount).setValues([labels]);
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, columnCount).setValues([row]);
  applyRollMasterSheetFormatting(sheet, definition);

  Logger.log('appendWorkHistoryEvent: appended ' + normalizedEvent.eventId);
  return normalizedEvent;
}

function normalizeWorkHistoryEventForSheet(event) {
  const eventAt = event.eventAt || new Date().toISOString();
  const roleId = event.roleId || '';
  const standRollName = event.standRollName || '';
  const beforeValue = normalizeStandMasterNumericValue(event.beforeValue);
  const afterValue = normalizeStandMasterNumericValue(event.afterValue);
  const currentDiameter = normalizeStandMasterNumericValue(event.currentDiameter);
  const cutMm = normalizeStandMasterNumericValue(event.cutMm);

  return {
    eventId: event.eventId || createWorkHistoryEventId(roleId, eventAt),
    roleId: roleId,
    standRollName: standRollName,
    stand: event.stand || '',
    eventType: event.eventType || '',
    eventAt: eventAt,
    beforeValue: beforeValue,
    afterValue: afterValue,
    currentDiameter: currentDiameter,
    cutMm: cutMm,
    operator: event.operator || '',
    source: event.source || '',
    note: event.note || '',
    active: event.active === false || String(event.active).trim().toLowerCase() === 'false' ? false : true,
    invalidatedAt: event.invalidatedAt || '',
    invalidationReason: event.invalidationReason || '',
    invalidatedBy: event.invalidatedBy || ''
  };
}

function invalidateLatestCuttingHistoryForInputCorrection(event) {
  try {
    return invalidateLatestCuttingHistoryForInputCorrectionCore(event);
  } catch (error) {
    Logger.log('invalidateLatestCuttingHistoryForInputCorrection error: ' + error.toString());
    return {
      success: false,
      invalidated: false,
      reason: error.toString()
    };
  }
}

function invalidateLatestCuttingHistoryForInputCorrectionCore(event) {
  const definition = getRollMasterDefinitionByLegacyName('WorkHistory');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetResult = getOrCreateRollMasterSheet(ss, definition);
  const sheet = sheetResult.sheet;
  ensureRollMasterSheetColumns(sheet, definition);

  const values = sheet.getDataRange().getValues();
  const indexes = getWorkHistoryInvalidationColumnIndexes(definition);
  const targetRoleId = String(event && event.roleId || '').trim();
  const targetBeforeValue = normalizeStandMasterNumericValue(event && event.beforeValue);

  if (!targetRoleId) {
    return {
      success: true,
      invalidated: false,
      reason: 'roleId is empty'
    };
  }

  if (targetBeforeValue === '') {
    return {
      success: true,
      invalidated: false,
      reason: 'beforeValue is empty'
    };
  }

  if (values.length <= 1) {
    return {
      success: true,
      invalidated: false,
      reason: 'work history is empty'
    };
  }

  for (var index = values.length - 1; index >= 1; index--) {
    const row = values[index];
    const roleId = String(row[indexes.roleId - 1] || '').trim();
    const eventType = String(row[indexes.eventType - 1] || '').trim();
    const active = normalizeRollMasterBooleanValue(row[indexes.active - 1]);

    if (roleId !== targetRoleId || eventType !== '\u6539\u524a' || !active) {
      continue;
    }

    const afterValue = normalizeStandMasterNumericValue(row[indexes.afterValue - 1]);

    if (afterValue !== targetBeforeValue) {
      return {
        success: true,
        invalidated: false,
        reason: 'latest active cutting history afterValue does not match correction beforeValue',
        latestEventId: row[indexes.eventId - 1] || '',
        latestAfterValue: afterValue,
        correctionBeforeValue: targetBeforeValue
      };
    }

    const rowNumber = index + 1;
    const invalidatedAt = new Date().toISOString();
    sheet.getRange(rowNumber, indexes.active).setValue(false);
    sheet.getRange(rowNumber, indexes.invalidatedAt).setValue(invalidatedAt);
    sheet.getRange(rowNumber, indexes.invalidationReason).setValue('入力ミス修正');
    sheet.getRange(rowNumber, indexes.invalidatedBy).setValue('web-app');
    applyRollMasterSheetFormatting(sheet, definition);

    return {
      success: true,
      invalidated: true,
      eventId: row[indexes.eventId - 1] || '',
      rowNumber: rowNumber,
      invalidatedAt: invalidatedAt
    };
  }

  return {
    success: true,
    invalidated: false,
    reason: 'matching active cutting history not found'
  };
}

function getWorkHistoryInvalidationColumnIndexes(definition) {
  const keys = [
    'eventId',
    'roleId',
    'eventType',
    'afterValue',
    'active',
    'invalidatedAt',
    'invalidationReason',
    'invalidatedBy'
  ];
  const indexes = {};

  keys.forEach(function(key) {
    const index = getRollMasterColumnIndexByKey(definition, key);

    if (index <= 0) {
      throw new Error('WorkHistory column not found: ' + key);
    }

    indexes[key] = index;
  });

  return indexes;
}

function createWorkHistoryEventId(roleId, eventAt) {
  const safeRoleId = String(roleId || 'role').replace(/[^A-Za-z0-9_-]/g, '');
  const safeTime = String(eventAt || new Date().toISOString()).replace(/[^0-9A-Za-z]/g, '');
  return 'wh-' + safeRoleId + '-' + safeTime;
}

function getStandMasterDataRows(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, 4).getValues().map(function(row) {
    return {
      stand: normalizeStandMasterStandValue(row[0]),
      newDiameter: normalizeStandMasterNumericValue(row[1]),
      scrapDiameter: normalizeStandMasterNumericValue(row[2]),
      leadTimeMonths: normalizeStandMasterNumericValue(row[3])
    };
  }).filter(function(row) {
    return row.stand !== '';
  });
}

function isStandMasterCanonicalRows(rows) {
  const canonicalStands = ['#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11', '#12', '#13', '#14', '#15', '#16', '#17'];

  if (!Array.isArray(rows) || rows.length !== canonicalStands.length) {
    return false;
  }

  return rows.every(function(row, index) {
    return String(row.stand || '') === canonicalStands[index];
  });
}

function initializeRollManagementView() {
  const result = refreshRollManagementView();

  return {
    success: true,
    action: 'initialize-roll-management-view',
    sheetName: result.sheetName,
    rowCount: result.rowCount
  };
}

function refreshRollManagementView() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ROLL_MANAGEMENT_VIEW_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(ROLL_MANAGEMENT_VIEW_SHEET_NAME);
  }

  const roles = fetchRoles();
  const viewRoles = sortRolesForRollManagementView(roles);
  const rows = [];
  const plannedArrivalRowIndexes = [];
  let previousStandKey = '';

  viewRoles.forEach(function(role, index) {
    const standInfo = getRollManagementViewStandInfo(role && role.name);
    const workProgress = parseWorkProgress(role && role.workProgress);
    const dispatchDate = normalizeRollManagementViewDate(workProgress.dispatchDate);
    const arrivalDate = normalizeRollManagementViewDate(workProgress.arrivalDate);
    const plannedArrivalDate = !arrivalDate && dispatchDate
      ? addDaysForRollManagementView(dispatchDate, ROLL_MANAGEMENT_VIEW_INBOUND_PLAN_DAYS)
      : '';
    const useCycleDates = getRollManagementViewUseCycleDates(role, dispatchDate);
    const standLabel = standInfo.key !== previousStandKey ? standInfo.label : '';

    if (plannedArrivalDate) {
      plannedArrivalRowIndexes.push(index + 2);
    }

    rows.push([
      standLabel,
      normalizeTextForSheet(role && role.name),
      formatRollManagementViewDate(dispatchDate),
      arrivalDate
        ? formatRollManagementViewDate(arrivalDate)
        : (plannedArrivalDate ? formatRollManagementViewDate(plannedArrivalDate) + '予' : ''),
      normalizeCurrentDiameterForSheet(role && role.currentDiameter),
      formatRollManagementViewDate(useCycleDates.useStartDate),
      formatRollManagementViewDate(useCycleDates.useEndDate),
      normalizeTextForSheet(role && role.status),
      normalizeTextForSheet(role && role.memo)
    ]);

    previousStandKey = standInfo.key;
  });

  const existingFilter = sheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }

  sheet.clear();
  sheet.setConditionalFormatRules([]);

  const values = [ROLL_MANAGEMENT_VIEW_HEADERS].concat(rows);
  sheet.getRange(1, 1, values.length, ROLL_MANAGEMENT_VIEW_HEADERS.length).setValues(values);
  applyRollManagementViewFormatting(sheet, rows, plannedArrivalRowIndexes);

  return {
    success: true,
    action: 'refresh-roll-management-view',
    sheetName: sheet.getName(),
    rowCount: rows.length
  };
}

function sortRolesForRollManagementView(roles) {
  return (Array.isArray(roles) ? roles : []).slice().sort(function(a, b) {
    const aStand = getRollManagementViewStandInfo(a && a.name);
    const bStand = getRollManagementViewStandInfo(b && b.name);

    if (aStand.number !== bStand.number) {
      return aStand.number - bStand.number;
    }

    if (aStand.key !== bStand.key) {
      return aStand.key.localeCompare(bStand.key, 'ja');
    }

    const aStatusOrder = getRollManagementViewStatusOrder(a && a.status);
    const bStatusOrder = getRollManagementViewStatusOrder(b && b.status);

    if (aStatusOrder !== bStatusOrder) {
      return aStatusOrder - bStatusOrder;
    }

    return compareStandRoleNamesForSheet(a && a.name, b && b.name);
  });
}

function getRollManagementViewStatusOrder(status) {
  const index = ROLL_MANAGEMENT_VIEW_STATUS_ORDER.indexOf(String(status || '').trim());
  return index >= 0 ? index : ROLL_MANAGEMENT_VIEW_STATUS_ORDER.length;
}

function getRollManagementViewStandInfo(roleName) {
  const parsed = parseStandNumberForSort(roleName);
  const roleNameText = String(roleName || '').trim();

  if (parsed.stand === 999999) {
    return {
      key: 'unknown:' + roleNameText,
      number: 999999,
      label: ''
    };
  }

  return {
    key: String(parsed.stand),
    number: parsed.stand,
    label: '#' + parsed.stand + 'st'
  };
}

function normalizeRollManagementViewDate(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  const ymdMatch = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:$|T)/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
    ) {
      return [
        String(year).padStart(4, '0'),
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0')
      ].join('-');
    }
  }

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    return '';
  }

  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatRollManagementViewDate(value) {
  const normalized = normalizeRollManagementViewDate(value);
  return normalized ? normalized.replace(/-/g, '/') : '';
}

function addDaysForRollManagementView(value, days) {
  const normalized = normalizeRollManagementViewDate(value);
  if (!normalized) {
    return '';
  }

  const parts = normalized.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + Number(days || 0));
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function getRollManagementViewUseCycleDates(role, dispatchDate) {
  const normalizedDispatchDate = normalizeRollManagementViewDate(dispatchDate);
  const storedUseStartDate = normalizeRollManagementViewDate(role && role.useStartDate);
  const useStartDate = normalizedDispatchDate
    && storedUseStartDate
    && storedUseStartDate < normalizedDispatchDate
      ? ''
      : storedUseStartDate;
  const useEndDate = getRollManagementViewUseEndDate(role, useStartDate, normalizedDispatchDate);
  const isUseEndInCurrentCycle = useStartDate
    && useEndDate
    && useEndDate >= useStartDate
    && (!normalizedDispatchDate || useEndDate >= normalizedDispatchDate);

  return {
    useStartDate: useStartDate,
    useEndDate: isUseEndInCurrentCycle ? useEndDate : ''
  };
}

function getRollManagementViewUseEndDate(role, useStartDate, dispatchDate) {
  if (!role || String(role.status || '').trim() === 'オンライン') {
    return '';
  }

  const storedUseEndDate = normalizeRollManagementViewDate(role.useEndDate);
  if (storedUseEndDate
      && (!useStartDate || storedUseEndDate >= useStartDate)
      && (!dispatchDate || storedUseEndDate >= dispatchDate)) {
    return storedUseEndDate;
  }
  if (role.useEndDate !== undefined && role.useEndDate !== null && String(role.useEndDate).trim() !== '') {
    return '';
  }

  const matchingHistory = parseHistory(role.history).filter(function(entry) {
    return entry
      && String(entry.type || '').trim() === 'status'
      && String(entry.before || '').trim() === 'オンライン'
      && String(entry.after || '').trim() === '中古予備（バラシ前）'
      && normalizeRollManagementViewDate(entry.at);
  }).sort(function(a, b) {
    return normalizeRollManagementViewDate(b.at)
      .localeCompare(normalizeRollManagementViewDate(a.at));
  });

  return matchingHistory.length > 0
    ? normalizeRollManagementViewDate(matchingHistory[0].at)
    : '';
}

function applyRollManagementViewFormatting(sheet, rows, plannedArrivalRowIndexes) {
  const columnCount = ROLL_MANAGEMENT_VIEW_HEADERS.length;
  const dataRowCount = rows.length;
  const totalRowCount = dataRowCount + 1;

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground(ROLL_MANAGEMENT_VIEW_HEADER_BACKGROUND)
    .setFontColor(ROLL_MANAGEMENT_VIEW_HEADER_FONT_COLOR)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.getRange(1, 1, totalRowCount, columnCount)
    .setBorder(true, true, true, true, true, true, '#b7c9dc', SpreadsheetApp.BorderStyle.SOLID)
    .setVerticalAlignment('middle');

  sheet.getRange(1, 1, totalRowCount, columnCount).createFilter();

  sheet.setColumnWidth(1, 85);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 105);
  sheet.setColumnWidth(4, 115);
  sheet.setColumnWidth(5, 95);
  sheet.setColumnWidth(6, 105);
  sheet.setColumnWidth(7, 105);
  sheet.setColumnWidth(8, 190);
  sheet.setColumnWidth(9, 280);
  sheet.setRowHeight(1, 32);

  if (dataRowCount <= 0) {
    return;
  }

  const dataRange = sheet.getRange(2, 1, dataRowCount, columnCount);
  const backgrounds = rows.map(function(row) {
    const color = ROLL_MANAGEMENT_VIEW_STATUS_COLORS[String(row[7] || '').trim()] || '#ffffff';
    return new Array(columnCount).fill(color);
  });
  dataRange.setBackgrounds(backgrounds);
  dataRange.setWrap(false);

  sheet.getRange(2, 1, dataRowCount, 2).setHorizontalAlignment('center');
  sheet.getRange(2, 3, dataRowCount, 2).setHorizontalAlignment('center');
  sheet.getRange(2, 5, dataRowCount, 1)
    .setHorizontalAlignment('right')
    .setNumberFormat('0.0 "mm"');
  sheet.getRange(2, 6, dataRowCount, 2).setHorizontalAlignment('center');
  sheet.getRange(2, 8, dataRowCount, 1).setHorizontalAlignment('left');
  sheet.getRange(2, 9, dataRowCount, 1).setWrap(true);

  plannedArrivalRowIndexes.forEach(function(rowNumber) {
    sheet.getRange(rowNumber, 4).setFontColor(ROLL_MANAGEMENT_VIEW_PLANNED_FONT_COLOR);
  });

  rows.forEach(function(row, index) {
    const nextRow = rows[index + 1];
    const isLastInStand = !nextRow || String(nextRow[0] || '') !== '';

    if (isLastInStand) {
      sheet.getRange(index + 2, 1, 1, columnCount)
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

function initializeFieldRollManagementView() {
  const result = refreshFieldRollManagementView();

  return {
    success: true,
    action: 'initialize-field-roll-management-view',
    sheetName: result.sheetName,
    mainRowCount: result.mainRowCount,
    additionalRowCount: result.additionalRowCount
  };
}

function refreshFieldRollManagementView() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(FIELD_ROLL_MANAGEMENT_VIEW_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(FIELD_ROLL_MANAGEMENT_VIEW_SHEET_NAME);
  }

  const result = buildFieldRollManagementRows(fetchRoles());
  const mainHeaderRow = 3;
  const mainStartRow = 4;
  const additionalTitleRow = mainStartRow + result.mainRows.length + 1;
  const additionalHeaderRow = additionalTitleRow + 1;
  const additionalStartRow = additionalHeaderRow + 1;
  const existingFilter = sheet.getFilter();

  if (existingFilter) {
    existingFilter.remove();
  }

  sheet.clear();
  sheet.setConditionalFormatRules([]);
  sheet.getRange(1, 1).setValue(FIELD_ROLL_MANAGEMENT_VIEW_TITLE);
  sheet.getRange(2, 1).setValue('更新日時');
  sheet.getRange(2, 2).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'));
  sheet.getRange(mainHeaderRow, 1, 1, FIELD_ROLL_MANAGEMENT_VIEW_HEADERS.length)
    .setValues([FIELD_ROLL_MANAGEMENT_VIEW_HEADERS]);
  sheet.getRange(mainStartRow, 1, result.mainRows.length, FIELD_ROLL_MANAGEMENT_VIEW_HEADERS.length)
    .setValues(result.mainRows.map(function(item) { return item.values; }));
  sheet.getRange(additionalTitleRow, 1).setValue('追加・例外ロール');
  sheet.getRange(additionalHeaderRow, 1, 1, FIELD_ROLL_MANAGEMENT_VIEW_HEADERS.length)
    .setValues([['スタンド', '例外理由', 'ロールID', '搬出日', '搬入日', 'ロール径', '使用開始日', '使用終了日', 'ステータス', 'メモ']]);

  if (result.additionalRows.length > 0) {
    sheet.getRange(additionalStartRow, 1, result.additionalRows.length, FIELD_ROLL_MANAGEMENT_VIEW_HEADERS.length)
      .setValues(result.additionalRows.map(function(item) { return item.values; }));
  }

  applyFieldRollManagementFormatting(sheet, result, {
    mainHeaderRow: mainHeaderRow,
    mainStartRow: mainStartRow,
    additionalTitleRow: additionalTitleRow,
    additionalHeaderRow: additionalHeaderRow,
    additionalStartRow: additionalStartRow
  });

  return {
    success: true,
    action: 'refresh-field-roll-management-view',
    sheetName: sheet.getName(),
    mainRowCount: result.mainRows.length,
    additionalRowCount: result.additionalRows.length,
    roleCount: result.roleCount
  };
}

function buildFieldRollManagementRows(roles) {
  const roleList = Array.isArray(roles) ? roles : [];
  const occurrenceCounts = {};
  const entries = roleList.map(function(role, index) {
    const baseKey = role && role.id !== undefined && role.id !== null && String(role.id).trim() !== ''
      ? 'id:' + String(role.id).trim()
      : 'row:' + index;
    occurrenceCounts[baseKey] = (occurrenceCounts[baseKey] || 0) + 1;
    return {
      role: role,
      key: baseKey + ':occurrence:' + occurrenceCounts[baseKey]
    };
  });
  const selectedKeys = new Set();
  const exceptionReasons = {};
  const mainRows = [];

  FIELD_ROLL_MANAGEMENT_STANDS.forEach(function(standNumber) {
    const standEntries = entries.filter(function(entry) {
      return getRollManagementViewStandInfo(entry.role && entry.role.name).number === standNumber;
    });
    const selections = selectPrimaryRollsForStand(standEntries);

    FIELD_ROLL_MANAGEMENT_ROLE_DEFINITIONS.forEach(function(definition, roleIndex) {
      const selected = selections[definition.label] || null;
      if (selected) {
        selectedKeys.add(selected.key);
      }
      mainRows.push(buildFieldRollManagementDisplayRow(
        selected ? selected.role : null,
        roleIndex === 0 ? '#' + standNumber + 'st' : '',
        definition.label
      ));
    });

    Object.keys(selections.exceptionReasons).forEach(function(key) {
      exceptionReasons[key] = selections.exceptionReasons[key];
    });
  });

  const additionalRows = buildAdditionalRollRows(entries, selectedKeys, exceptionReasons);
  const displayedKeys = new Set();
  entries.forEach(function(entry) {
    const isDisplayed = selectedKeys.has(entry.key) || additionalRows.some(function(row) { return row.key === entry.key; });
    if (!isDisplayed || displayedKeys.has(entry.key)) {
      throw new Error('現場用ロール管理表の表示整合性エラー: ' + entry.key);
    }
    displayedKeys.add(entry.key);
  });

  return {
    mainRows: mainRows,
    additionalRows: additionalRows,
    roleCount: entries.length
  };
}

function selectPrimaryRollsForStand(entries) {
  const result = { exceptionReasons: {} };
  const activeEntries = entries.filter(function(entry) {
    return normalizeBooleanForFieldRollManagement(entry.role && entry.role.isActiveThreeSet);
  });
  const selectedKeys = new Set();
  const onlineEntries = activeEntries.filter(function(entry) {
    return String(entry.role && entry.role.status || '').trim() === 'オンライン';
  }).sort(function(a, b) {
    const dateComparison = compareFieldRollDatesDesc(a.role && a.role.useStartDate, b.role && b.role.useStartDate);
    return dateComparison !== 0 ? dateComparison : compareFieldRollRoleIds(a.role, b.role);
  });

  result['使用中'] = onlineEntries.length > 0 ? onlineEntries[0] : null;
  if (result['使用中']) selectedKeys.add(result['使用中'].key);
  onlineEntries.slice(1).forEach(function(entry) {
    result.exceptionReasons[entry.key] = 'オンライン重複';
  });

  const plannedEntries = activeEntries.filter(function(entry) {
    return !selectedKeys.has(entry.key)
      && normalizeBooleanForFieldRollManagement(entry.role && entry.role.nextAssemblyPlanned);
  }).sort(function(a, b) {
    const updatedComparison = compareFieldRollUpdatedAtDesc(a.role && a.role.updatedAt, b.role && b.role.updatedAt);
    return updatedComparison !== 0 ? updatedComparison : compareFieldRollRoleIds(a.role, b.role);
  });

  result['次回組み込み'] = plannedEntries.length > 0 ? plannedEntries[0] : null;
  if (result['次回組み込み']) selectedKeys.add(result['次回組み込み'].key);
  plannedEntries.slice(1).forEach(function(entry) {
    result.exceptionReasons[entry.key] = '次回組み込み指定が複数';
  });

  const waitingEntries = activeEntries.filter(function(entry) {
    return !selectedKeys.has(entry.key) && !result.exceptionReasons[entry.key];
  }).sort(function(a, b) {
    return compareFieldRollRoleIds(a.role, b.role);
  });

  result['改削待ち'] = waitingEntries.length > 0 ? waitingEntries[0] : null;
  if (result['改削待ち']) selectedKeys.add(result['改削待ち'].key);
  waitingEntries.slice(1).forEach(function(entry) {
    result.exceptionReasons[entry.key] = activeEntries.length > 3
      ? '運用3セット指定が4本以上'
      : '運用3セット内（役割未確定）';
  });

  return result;
}

function compareFieldRollRoleIds(a, b) {
  return String(a && a.name || '').localeCompare(String(b && b.name || ''), 'ja', { numeric: true });
}

function compareFieldRollDatesDesc(a, b) {
  const normalizedA = normalizeRollManagementViewDate(a);
  const normalizedB = normalizeRollManagementViewDate(b);
  if (normalizedA && normalizedB) return normalizedB.localeCompare(normalizedA);
  if (normalizedA) return -1;
  if (normalizedB) return 1;
  return 0;
}

function compareFieldRollUpdatedAtDesc(a, b) {
  const timestampA = a ? new Date(a).getTime() : NaN;
  const timestampB = b ? new Date(b).getTime() : NaN;
  const validA = !isNaN(timestampA);
  const validB = !isNaN(timestampB);
  if (validA && validB && timestampA !== timestampB) return timestampB - timestampA;
  if (validA && !validB) return -1;
  if (!validA && validB) return 1;
  return 0;
}

function normalizeBooleanForFieldRollManagement(value) {
  if (value === true || value === 1) return true;
  const text = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  return text === 'true' || text === '1';
}

function buildAdditionalRollRows(entries, selectedKeys, exceptionReasons) {
  return entries.filter(function(entry) {
    return !selectedKeys.has(entry.key);
  }).map(function(entry) {
    const role = entry.role || {};
    const standInfo = getRollManagementViewStandInfo(role.name);
    let reason = exceptionReasons[entry.key] || '';

    if (!reason && FIELD_ROLL_MANAGEMENT_DIRECT_EXCEPTION_STATUSES.indexOf(String(role.status || '').trim()) >= 0) {
      reason = String(role.status || '').trim();
    }
    if (!reason && FIELD_ROLL_MANAGEMENT_STANDS.indexOf(standInfo.number) < 0) {
      reason = '対象スタンド外';
    }
    if (!reason) {
      reason = normalizeBooleanForFieldRollManagement(role.isActiveThreeSet)
        ? '運用3セット内（役割未確定）'
        : '運用3セット外';
    }

    const row = buildFieldRollManagementDisplayRow(role, standInfo.label, reason);
    row.key = entry.key;
    row.reason = reason;
    return row;
  }).sort(function(a, b) {
    const aStand = getRollManagementViewStandInfo(a.values[2]);
    const bStand = getRollManagementViewStandInfo(b.values[2]);
    if (aStand.number !== bStand.number) return aStand.number - bStand.number;
    if (a.reason !== b.reason) return a.reason.localeCompare(b.reason, 'ja');
    return String(a.values[2] || '').localeCompare(String(b.values[2] || ''), 'ja', { numeric: true });
  });
}

function buildFieldRollManagementDisplayRow(role, standLabel, roleOrReason) {
  if (!role) {
    return {
      values: [standLabel, roleOrReason, '', '', '', '', '', '', '', ''],
      plannedArrival: false,
      empty: true
    };
  }

  const workProgress = parseWorkProgress(role.workProgress);
  const dispatchDate = normalizeRollManagementViewDate(workProgress.dispatchDate);
  const arrivalDate = normalizeRollManagementViewDate(workProgress.arrivalDate);
  const plannedArrivalDate = !arrivalDate && dispatchDate
    ? addDaysForRollManagementView(dispatchDate, ROLL_MANAGEMENT_VIEW_INBOUND_PLAN_DAYS)
    : '';
  const useCycleDates = getRollManagementViewUseCycleDates(role, dispatchDate);

  return {
    values: [
      standLabel,
      roleOrReason,
      normalizeTextForSheet(role.name),
      formatRollManagementViewDate(dispatchDate),
      arrivalDate
        ? formatRollManagementViewDate(arrivalDate)
        : (plannedArrivalDate ? formatRollManagementViewDate(plannedArrivalDate) + '予' : ''),
      normalizeCurrentDiameterForSheet(role.currentDiameter),
      formatRollManagementViewDate(useCycleDates.useStartDate),
      formatRollManagementViewDate(useCycleDates.useEndDate),
      normalizeTextForSheet(role.status),
      normalizeTextForSheet(role.memo)
    ],
    plannedArrival: Boolean(plannedArrivalDate),
    empty: false
  };
}

function applyFieldRollManagementFormatting(sheet, result, positions) {
  const columnCount = FIELD_ROLL_MANAGEMENT_VIEW_HEADERS.length;
  const mainRowCount = result.mainRows.length;
  const additionalRowCount = result.additionalRows.length;
  const lastRow = Math.max(positions.additionalHeaderRow, positions.additionalStartRow + additionalRowCount - 1);
  const roleColors = {
    '使用中': '#eaf5e4',
    '次回組み込み': '#eaf3fb',
    '改削待ち': '#fff3e6'
  };

  sheet.setFrozenRows(3);
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold').setFontColor('#17365d');
  sheet.getRange(2, 1, 1, 2).setFontSize(9).setFontColor('#64748b');
  [positions.mainHeaderRow, positions.additionalHeaderRow].forEach(function(rowNumber) {
    sheet.getRange(rowNumber, 1, 1, columnCount)
      .setBackground('#1f4e78')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  });
  sheet.getRange(positions.additionalTitleRow, 1)
    .setFontSize(13)
    .setFontWeight('bold')
    .setFontColor('#9c0006');
  sheet.getRange(positions.mainHeaderRow, 1, lastRow - positions.mainHeaderRow + 1, columnCount)
    .setVerticalAlignment('middle');
  sheet.getRange(positions.mainStartRow, 1, mainRowCount, columnCount)
    .setBackgrounds(result.mainRows.map(function(item) {
      const color = item.empty ? '#f8fafc' : (roleColors[item.values[1]] || '#ffffff');
      return new Array(columnCount).fill(color);
    }))
    .setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

  FIELD_ROLL_MANAGEMENT_STANDS.forEach(function(standNumber, index) {
    const bottomRow = positions.mainStartRow + index * 3 + 2;
    sheet.getRange(bottomRow, 1, 1, columnCount).setBorder(
      null, null, true, null, null, null, '#334155', SpreadsheetApp.BorderStyle.SOLID_THICK
    );
  });

  if (additionalRowCount > 0) {
    const additionalRange = sheet.getRange(positions.additionalStartRow, 1, additionalRowCount, columnCount);
    additionalRange
      .setBackgrounds(result.additionalRows.map(function(item) {
        const isAlert = item.reason.indexOf('重複') >= 0
          || item.reason.indexOf('廃却') >= 0
          || item.reason === '廃棄'
          || item.reason.indexOf('対象スタンド外') >= 0
          || item.reason.indexOf('運用3セット指定') >= 0
          || item.reason.indexOf('役割未確定') >= 0;
        return new Array(columnCount).fill(isAlert ? '#fce8e6' : '#fffdf5');
      }))
      .setBorder(true, true, true, true, true, true, '#d6c9c6', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(positions.additionalHeaderRow, 1, additionalRowCount + 1, columnCount).createFilter();
  }

  sheet.getRange(positions.mainStartRow, 1, mainRowCount, 2).setHorizontalAlignment('center');
  if (additionalRowCount > 0) {
    sheet.getRange(positions.additionalStartRow, 1, additionalRowCount, 2).setHorizontalAlignment('center');
  }
  sheet.getRange(positions.mainStartRow, 3, mainRowCount, 7).setHorizontalAlignment('center');
  if (additionalRowCount > 0) {
    sheet.getRange(positions.additionalStartRow, 3, additionalRowCount, 7).setHorizontalAlignment('center');
  }
  sheet.getRange(positions.mainStartRow, 6, mainRowCount, 1).setNumberFormat('0.0 "mm"');
  if (additionalRowCount > 0) {
    sheet.getRange(positions.additionalStartRow, 6, additionalRowCount, 1).setNumberFormat('0.0 "mm"');
  }
  sheet.getRange(positions.mainStartRow, 10, mainRowCount, 1).setWrap(true);
  if (additionalRowCount > 0) {
    sheet.getRange(positions.additionalStartRow, 10, additionalRowCount, 1).setWrap(true);
  }

  result.mainRows.forEach(function(item, index) {
    if (item.plannedArrival) sheet.getRange(positions.mainStartRow + index, 5).setFontColor(ROLL_MANAGEMENT_VIEW_PLANNED_FONT_COLOR);
  });
  result.additionalRows.forEach(function(item, index) {
    if (item.plannedArrival) sheet.getRange(positions.additionalStartRow + index, 5).setFontColor(ROLL_MANAGEMENT_VIEW_PLANNED_FONT_COLOR);
  });

  [78, 112, 124, 100, 110, 88, 110, 110, 190, 270].forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
  sheet.setRowHeight(1, 30);
  sheet.setRowHeight(positions.mainHeaderRow, 28);
  sheet.setRowHeight(positions.additionalHeaderRow, 28);
}

function writeRoles(roles) {
  const sheet = getSheet();
  ensureRolesColumnCapacity(sheet);
  Logger.log('writeRoles: clearing sheet contents');
  sheet.clearContents();
  applyStatusDropdowns(sheet);

  const sortedRoles = sortRolesByStandRoleForSheet(roles);
  const rows = sortedRoles.map((role, index) => {
    try {
      return buildRoleRowForSheet(role);
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

  try {
    const viewResult = refreshRollManagementView();
    Logger.log('writeRoles: roll management view updated: ' + JSON.stringify(viewResult));
  } catch (error) {
    Logger.log('writeRoles: roll management view update failed: ' + error.toString());
  }

  try {
    const fieldViewResult = refreshFieldRollManagementView();
    Logger.log('writeRoles: field roll management view updated: ' + JSON.stringify(fieldViewResult));
  } catch (error) {
    Logger.log('writeRoles: field roll management view update failed: ' + error.toString());
  }

  Logger.log('writeRoles: complete');
  return rows.length;
}

function buildRoleRowForSheet(role) {
  const isActiveThreeSet = normalizeBooleanForFieldRollManagement(role && role.isActiveThreeSet);
  const nextAssemblyPlanned = isActiveThreeSet
    && normalizeBooleanForFieldRollManagement(role && role.nextAssemblyPlanned);

  return [
    role && role.id || '',
    role && role.name || '',
    role && role.status || '',
    role && role.memo || '',
    role && role.updatedAt || '',
    Boolean(role && role.requestSent === true),
    JSON.stringify(normalizeWorkProgressForSheet(role || {})),
    JSON.stringify(normalizeHistoryForSheet(role || {})),
    normalizeCurrentDiameterForSheet(role && role.currentDiameter),
    normalizeUseStartDateForSheet(role && role.useStartDate),
    normalizeCoatingStatusForSheet(role && role.coatingStatus, role && role.status),
    normalizeDateInputValueForSheet(role && role.orderExpectedDeliveryDate),
    normalizeTextForSheet(role && role.assemblyInstructionDue),
    normalizeDateInputValueForSheet(role && role.useEndDate),
    isActiveThreeSet,
    nextAssemblyPlanned
  ];
}

function getThreeSetFieldsDebugState() {
  const sheet = getSheet();
  const maxColumns = sheet.getMaxColumns();
  const expectedRow = buildRoleRowForSheet({
    id: 'debug',
    name: '#debug',
    isActiveThreeSet: true,
    nextAssemblyPlanned: true
  });

  return {
    success: true,
    scriptVersion: SCRIPT_VERSION,
    webAppUrl: getWebAppUrlForThreeSetDebug(),
    spreadsheetId: SPREADSHEET_ID,
    rolesSheetName: sheet.getName(),
    HEADER_VALUES: HEADER_VALUES.slice(),
    headerValues: HEADER_VALUES.slice(),
    headerLength: HEADER_VALUES.length,
    rolesSheetLastColumn: sheet.getLastColumn(),
    rolesSheetMaxColumns: maxColumns,
    o1: maxColumns >= 15 ? sheet.getRange(1, 15).getValue() : '',
    p1: maxColumns >= 16 ? sheet.getRange(1, 16).getValue() : '',
    supportsThreeSetFields: HEADER_VALUES.length === 16
      && HEADER_VALUES[14] === '運用3セット対象'
      && HEADER_VALUES[15] === '次回組み込み予定'
      && expectedRow.length === 16,
    expectedWriteRowLength: expectedRow.length,
    expectedActiveThreeSetValue: expectedRow[14],
    expectedNextAssemblyPlannedValue: expectedRow[15]
  };
}

function getWebAppUrlForThreeSetDebug() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (error) {
    return '';
  }
}

function logThreeSetFieldsPostDebug(roles) {
  const target = (Array.isArray(roles) ? roles : []).find(function(role) {
    return String(role && role.name || '').trim() === '#2-13';
  });

  if (!target) {
    Logger.log('THREE_SET_FIELDS_POST_DEBUG #2-13 not found');
    return;
  }

  const row = buildRoleRowForSheet(target);
  Logger.log('THREE_SET_FIELDS_POST_DEBUG ' + JSON.stringify({
    id: target.id,
    name: target.name,
    isActiveThreeSet: target.isActiveThreeSet,
    isActiveThreeSetType: typeof target.isActiveThreeSet,
    nextAssemblyPlanned: target.nextAssemblyPlanned,
    nextAssemblyPlannedType: typeof target.nextAssemblyPlanned,
    writeRowLength: row.length,
    writeColumnO: row[14],
    writeColumnP: row[15]
  }));
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
  const row = buildRoleRowForSheet({
    id: nextId,
    name: roleName,
    status: status,
    memo: memo,
    updatedAt: now,
    requestSent: false,
    workProgress: {},
    history: [],
    isActiveThreeSet: false,
    nextAssemblyPlanned: false
  });

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

function updateRolesHeader() {
  const sheet = getSheet();
  ensureRolesHeader(sheet);
  applySheetFormatting(sheet, Math.max(sheet.getLastRow() - 1, 0));

  return {
    action: 'update-roles-header',
    sheetName: sheet.getName(),
    headers: HEADER_VALUES.slice()
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
  ensureRolesColumnCapacity(sheet);
  const currentHeader = sheet.getRange(1, 1, 1, HEADER_VALUES.length).getValues()[0];
  const needsHeader = HEADER_VALUES.some(function(header, index) {
    return String(currentHeader[index] || '') !== header;
  });

  if (needsHeader) {
    sheet.getRange(1, 1, 1, HEADER_VALUES.length).setValues([HEADER_VALUES]);
  }
}

function ensureRolesColumnCapacity(sheet) {
  const missingColumnCount = HEADER_VALUES.length - sheet.getMaxColumns();
  if (missingColumnCount > 0) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), missingColumnCount);
    Logger.log('ensureRolesColumnCapacity: added ' + missingColumnCount + ' columns');
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
    vendorSentAt: progress.vendorSentAt || '',
    vendorContactedAt: progress.vendorContactedAt || '',
    pickupAdjustedAt: progress.pickupAdjustedAt || '',
    dispatchDate: progress.dispatchDate || '',
    arrivalDate: progress.arrivalDate || '',
    pickupAdjustedBy: progress.pickupAdjustedBy || ''
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

function normalizeTextForSheet(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function normalizeCoatingStatusForSheet(value, status) {
  const normalizedStatus = String(status || '').trim();
  const normalizedValue = String(value || '').trim();

  if (normalizedStatus !== '新品予備保管') {
    return '';
  }

  return normalizedValue === 'coated' || normalizedValue === 'uncoated' ? normalizedValue : '';
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

function normalizeDateInputValueForSheet(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
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
      return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return '';
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
  sheet.setColumnWidth(COATING_STATUS_COLUMN_INDEX, 110);
  sheet.hideColumns(1);
  sheet.hideColumns(7);
  sheet.hideColumns(8);

  sheet.getRange(2, CURRENT_DIAMETER_COLUMN_INDEX, maxRows - 1, 1)
    .setHorizontalAlignment('right')
    .setNumberFormat('"Φ"0.0');

  sheet.getRange(2, USE_START_DATE_COLUMN_INDEX, maxRows - 1, 1)
    .setHorizontalAlignment('center')
    .setNumberFormat('yyyy/mm/dd');

  sheet.getRange(2, COATING_STATUS_COLUMN_INDEX, maxRows - 1, 1)
    .setHorizontalAlignment('center');

  sheet.getRange(1, 1, totalRows, columnCount).setVerticalAlignment('middle');
  if (dataRowCount > 0) {
    sheet.getRange(2, 1, dataRowCount, columnCount).setWrap(true);
    sheet.getRange(2, 7, dataRowCount, 1).setWrap(false);
    sheet.getRange(2, 8, dataRowCount, 1).setWrap(false);
    sheet.getRange(2, CURRENT_DIAMETER_COLUMN_INDEX, dataRowCount, 1).setWrap(false);
    sheet.getRange(2, USE_START_DATE_COLUMN_INDEX, dataRowCount, 1).setWrap(false);
    sheet.getRange(2, COATING_STATUS_COLUMN_INDEX, dataRowCount, 1).setWrap(false);
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

function getStandMasterSheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('getStandMasterSheet: opened spreadsheet: ' + ss.getName());

    const sheet = ss.getSheetByName(STAND_MASTER_SHEET_NAME);
    if (!sheet) {
      throw new Error('StandMasterシートが見つかりません。');
    }

    return sheet;
  } catch (error) {
    Logger.log('getStandMasterSheet error: ' + error.toString());
    throw new Error('Failed to open StandMaster sheet: ' + error.toString());
  }
}

function normalizeStandMasterStandValue(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function normalizeStandMasterNumericValue(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return '';
  }

  const numericValue = Number(value);
  return isFinite(numericValue) ? numericValue : '';
}
