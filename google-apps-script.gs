const SHEET_NAME = 'Roles';
const ROLL_MANAGEMENT_VIEW_SHEET_NAME = 'ロール管理表';
const STAND_MASTER_SHEET_NAME = 'StandMaster';
const INPUT_SHEET_NAMES = ['入力シート', 'Input', '入力'];
const SPREADSHEET_ID = '1X07qQa7u9YPLvErT0D48goT5wYmvcpgNjqzK3FhRFeA';
const SCRIPT_VERSION = 'roll-history-all-sheets-sync-v6';
const ROLES_EDIT_TRIGGER_HANDLER = 'handleRolesSheetEdit';
const ROLES_EDIT_TRIGGER_LOCK_TIMEOUT_MS = 300000;
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
const ROLL_HISTORY_SOURCE_SPREADSHEET_ID_PROPERTY = 'ROLL_HISTORY_SOURCE_SPREADSHEET_ID';
const ROLL_HISTORY_SHEET_NAMES = [
  '2,3',
  '4,5',
  '6,7',
  '8,9',
  '10,11',
  '12,13',
  '14,15',
  '16,17'
];
const ROLL_HISTORY_STATUS_NOTE_PREFIX = 'ROLL_STATUS_SYNC|';
const ROLL_HISTORY_STATUS_DISPLAY_SEPARATOR = '　ステータス：';
const ROLL_HISTORY_STATUS_OPERATOR = { id: 'sheet', name: 'スプレッドシート' };
const ROLL_HISTORY_ACTUAL_FONT_COLOR = '#000000';
const ROLL_HISTORY_PLANNED_FONT_COLORS = ['#ff0000', '#0000ff', '#1f4e78', '#7f8c8d'];
const ROLL_HISTORY_INCOMPLETE_WARNING_COLOR = '#fff2cc';
const ROLL_HISTORY_INCOMPLETE_WARNING_NOTE_PREFIX = 'ROLL_HISTORY_INCOMPLETE|';
const ROLL_HISTORY_INCOMPLETE_REQUIRED_FIELDS = [
  'dispatchDate',
  'arrivalDate',
  'currentDiameter',
  'useStartDate'
];
const ROLL_HISTORY_ACTUAL_FIELD_LABELS = {
  dispatchDate: '搬出日',
  arrivalDate: '搬入日',
  currentDiameter: 'ロール径',
  useStartDate: '使用開始日',
  useEndDate: '使用終了日'
};
const ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS = {
  dispatchDate: { offset: 2, width: 3, pairField: 'arrivalDate' },
  arrivalDate: { offset: 5, width: 3, pairField: 'dispatchDate' },
  currentDiameter: { offset: 10, width: 1, pairField: 'arrivalDate' },
  useStartDate: { offset: 11, width: 3, pairField: 'useEndDate' },
  useEndDate: { offset: 14, width: 3, pairField: 'useStartDate' }
};


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

function handleRolesSheetEdit(e) {
  const range = e && e.range;
  const sheet = range && range.getSheet ? range.getSheet() : null;

  if (!sheet) {
    return;
  }

  if (sheet.getName() !== SHEET_NAME) {
    const actualResult = handleRollHistoryActualEdit(e);
    if (!actualResult || !actualResult.handled) {
      handleRollHistoryStatusEdit(e);
    }
    return;
  }

  const lastEditedRow = range.getLastRow();
  const firstEditedColumn = range.getColumn();
  const lastEditedColumn = range.getLastColumn();
  const overlapsRolesDataRows = lastEditedRow >= 2;
  const overlapsRolesColumns = firstEditedColumn <= HEADER_VALUES.length && lastEditedColumn >= 1;

  if (!overlapsRolesDataRows || !overlapsRolesColumns) {
    return;
  }

  ensureRolesHeader(sheet);
  stampRolesSheetEditedAt(range);
  const firstRoleRow = Math.max(range.getRow(), 2);
  const editedRoleNames = firstRoleRow <= lastEditedRow
    ? sheet.getRange(firstRoleRow, 2, lastEditedRow - firstRoleRow + 1, 1).getDisplayValues().map(function(row) {
      return String(row[0] || '').trim();
    }).filter(Boolean)
    : [];

  const documentLock = LockService.getDocumentLock();
  const lock = documentLock || LockService.getScriptLock();

  try {
    lock.waitLock(ROLES_EDIT_TRIGGER_LOCK_TIMEOUT_MS);
    Logger.log('handleRolesSheetEdit: refreshing views for range ' + range.getA1Notation());
    const roles = fetchRoles();
    const onlineDiagnostics = diagnoseFieldStandOnlineStates(roles).filter(function(item) {
      return item.roleCount > 0
        && (item.onlineState !== 'normal' || item.threeSetOnlineState === 'outside');
    });
    if (onlineDiagnostics.length > 0) {
      Logger.log('handleRolesSheetEdit: online anomalies=' + JSON.stringify(onlineDiagnostics));
    }

    try {
      const actualSyncResult = syncRollHistoryActualsFromRoles(roles, editedRoleNames);
      Logger.log('handleRolesSheetEdit: history actuals updated: ' + JSON.stringify(actualSyncResult));
    } catch (actualSyncError) {
      Logger.log('handleRolesSheetEdit: history actual sync failed: ' + actualSyncError.toString());
    }

    try {
      const result = refreshRollManagementView();
      Logger.log('handleRolesSheetEdit: roll management view updated: ' + JSON.stringify(result));
    } catch (error) {
      Logger.log('handleRolesSheetEdit: roll management view update failed: ' + error.toString());
    }

    try {
      const result = refreshFieldRollManagementView();
      Logger.log('handleRolesSheetEdit: field roll management view updated: ' + JSON.stringify(result));
    } catch (error) {
      Logger.log('handleRolesSheetEdit: field roll management view update failed: ' + error.toString());
    }

  } catch (error) {
    Logger.log('handleRolesSheetEdit: lock wait or refresh failed: ' + error.toString());
  } finally {
    if (lock && lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function stampRolesSheetEditedAt(range) {
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || sheet.getName() !== SHEET_NAME) return;
  const startRow = Math.max(range.getRow(), 2);
  const endRow = range.getLastRow();
  if (endRow < startRow) return;
  const timestamp = new Date().toISOString();
  const values = new Array(endRow - startRow + 1).fill(null).map(function() {
    return [timestamp];
  });
  sheet.getRange(startRow, 5, values.length, 1).setValues(values);
}

function installRolesSheetEditTrigger() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const cleanup = removeDuplicateRolesEditTriggers();
  const existingTrigger = ScriptApp.getProjectTriggers().find(function(trigger) {
    return trigger.getHandlerFunction() === ROLES_EDIT_TRIGGER_HANDLER
      && trigger.getEventType() === ScriptApp.EventType.ON_EDIT
      && trigger.getTriggerSourceId() === ss.getId();
  });

  if (existingTrigger) {
    Logger.log('installRolesSheetEditTrigger: existing trigger kept; removedDuplicates=' + cleanup.removedCount);
    return {
      installed: false,
      existing: true,
      removedDuplicates: cleanup.removedCount,
      handler: ROLES_EDIT_TRIGGER_HANDLER
    };
  }

  const trigger = ScriptApp.newTrigger(ROLES_EDIT_TRIGGER_HANDLER)
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  Logger.log('installRolesSheetEditTrigger: installed trigger id=' + trigger.getUniqueId());
  return {
    installed: true,
    existing: false,
    removedDuplicates: cleanup.removedCount,
    handler: ROLES_EDIT_TRIGGER_HANDLER,
    triggerId: trigger.getUniqueId()
  };
}

function removeDuplicateRolesEditTriggers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const matchingTriggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === ROLES_EDIT_TRIGGER_HANDLER
      && trigger.getEventType() === ScriptApp.EventType.ON_EDIT
      && trigger.getTriggerSourceId() === ss.getId();
  });
  let removedCount = 0;

  matchingTriggers.slice(1).forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
    removedCount += 1;
    Logger.log('removeDuplicateRolesEditTriggers: removed trigger id=' + trigger.getUniqueId());
  });

  Logger.log('removeDuplicateRolesEditTriggers: found=' + matchingTriggers.length + ', removed=' + removedCount);
  return {
    foundCount: matchingTriggers.length,
    removedCount: removedCount,
    keptCount: matchingTriggers.length > 0 ? 1 : 0
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
      let mainRoleLabel = roleIndex === 0 && selections.onlineDisplayState !== 'normal'
        ? (selections.onlineDisplayState === 'missing'
          ? 'オンライン未設定'
          : (selections.onlineDisplayState === 'duplicate'
            ? 'オンライン重複'
            : 'オンラインが運用3セット対象外'))
        : definition.label;
      if (roleIndex === 0 && selections.activeThreeSetCount !== 3) {
        mainRoleLabel += ' / 3セット設定未完了';
      }
      mainRows.push(buildFieldRollManagementDisplayRow(
        selected ? selected.role : null,
        roleIndex === 0 ? '#' + standNumber + 'st' : '',
        mainRoleLabel
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
  result.activeThreeSetCount = activeEntries.length;
  const onlineEntries = entries.filter(function(entry) {
    return String(entry.role && entry.role.status || '').trim() === 'オンライン';
  }).sort(function(a, b) {
    const dateComparison = compareFieldRollDatesDesc(a.role && a.role.useStartDate, b.role && b.role.useStartDate);
    return dateComparison !== 0 ? dateComparison : compareFieldRollRoleIds(a.role, b.role);
  });

  result.onlineState = onlineEntries.length === 1
    ? 'normal'
    : (onlineEntries.length === 0 ? 'missing' : 'duplicate');
  result.onlineDisplayState = result.onlineState === 'normal'
    && !normalizeBooleanForFieldRollManagement(onlineEntries[0].role && onlineEntries[0].role.isActiveThreeSet)
      ? 'outside'
      : result.onlineState;

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

function diagnoseFieldStandOnlineStates(roles) {
  const roleList = Array.isArray(roles) ? roles : [];
  return FIELD_ROLL_MANAGEMENT_STANDS.map(function(standNumber) {
    const standRoles = roleList.filter(function(role) {
      return getRollManagementViewStandInfo(role && role.name).number === standNumber;
    });
    const activeRoles = standRoles.filter(function(role) {
      return normalizeBooleanForFieldRollManagement(role && role.isActiveThreeSet);
    });
    const onlineRoles = standRoles.filter(function(role) {
      return String(role && role.status || '').trim() === 'オンライン';
    });
    const onlineCount = onlineRoles.length;
    const onlineRoleIsActiveThreeSet = onlineCount === 1
      && normalizeBooleanForFieldRollManagement(onlineRoles[0] && onlineRoles[0].isActiveThreeSet);
    return {
      standNumber: standNumber,
      roleCount: standRoles.length,
      activeThreeSetCount: activeRoles.length,
      threeSetConfigured: activeRoles.length === 3,
      onlineCount: onlineCount,
      onlineState: onlineCount === 1 ? 'normal' : (onlineCount === 0 ? 'missing' : 'duplicate'),
      onlineLabel: onlineCount === 1 ? '正常' : (onlineCount === 0 ? 'オンライン未設定' : 'オンライン重複'),
      onlineRoleIsActiveThreeSet: onlineRoleIsActiveThreeSet,
      threeSetOnlineState: onlineCount === 1
        ? (onlineRoleIsActiveThreeSet ? 'normal' : 'outside')
        : 'not-applicable',
      threeSetOnlineLabel: onlineCount === 1 && !onlineRoleIsActiveThreeSet
        ? 'オンラインが運用3セット対象外'
        : ''
    };
  });
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
      const isOnlineAlert = item.values[1].indexOf('オンライン未設定') >= 0
        || item.values[1].indexOf('オンライン重複') >= 0
        || item.values[1].indexOf('オンラインが運用3セット対象外') >= 0;
      const color = isOnlineAlert ? '#fce8e6' : (item.empty ? '#f8fafc' : (roleColors[item.values[1]] || '#ffffff'));
      return new Array(columnCount).fill(color);
    }))
    .setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

  FIELD_ROLL_MANAGEMENT_STANDS.forEach(function(standNumber, index) {
    const bottomRow = positions.mainStartRow + index * 3 + 2;
    sheet.getRange(bottomRow, 1, 1, columnCount).setBorder(
      null, null, true, null, null, null, '#334155', SpreadsheetApp.BorderStyle.SOLID_THICK
    );
  });

  result.mainRows.forEach(function(item, index) {
    if (item.values[1].indexOf('オンライン未設定') >= 0
      || item.values[1].indexOf('オンライン重複') >= 0
      || item.values[1].indexOf('オンラインが運用3セット対象外') >= 0) {
      sheet.getRange(positions.mainStartRow + index, 1, 1, columnCount)
        .setFontColor('#9c0006')
        .setFontWeight('bold');
    }
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

function setRollHistorySourceSpreadsheetId(sourceSpreadsheetId) {
  const normalizedId = normalizeSpreadsheetIdForRollHistory(sourceSpreadsheetId);
  if (!normalizedId) {
    throw new Error('移行元GoogleスプレッドシートIDを指定してください。');
  }
  if (normalizedId === SPREADSHEET_ID) {
    throw new Error('移行元と移行先が同じです。別のGoogleスプレッドシートを指定してください。');
  }

  const preview = previewRollHistoryMigration(normalizedId);
  if (preview.missingSheets.length > 0) {
    throw new Error('移行元に必要なシートがありません: ' + preview.missingSheets.join(', '));
  }

  PropertiesService.getScriptProperties()
    .setProperty(ROLL_HISTORY_SOURCE_SPREADSHEET_ID_PROPERTY, normalizedId);

  return preview;
}

function previewRollHistoryMigration(sourceSpreadsheetId) {
  const normalizedId = normalizeSpreadsheetIdForRollHistory(sourceSpreadsheetId)
    || PropertiesService.getScriptProperties().getProperty(ROLL_HISTORY_SOURCE_SPREADSHEET_ID_PROPERTY)
    || '';
  if (!normalizedId) {
    throw new Error('先に setRollHistorySourceSpreadsheetId を実行してください。');
  }
  if (normalizedId === SPREADSHEET_ID) {
    throw new Error('移行元と移行先が同じです。');
  }

  const source = SpreadsheetApp.openById(normalizedId);
  const destination = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheetNames = source.getSheets().map(function(sheet) { return sheet.getName(); });
  const destinationSheetNames = destination.getSheets().map(function(sheet) { return sheet.getName(); });
  const sourceNameSet = new Set(sourceSheetNames);
  const destinationNameSet = new Set(destinationSheetNames);
  const missingSheets = ROLL_HISTORY_SHEET_NAMES.filter(function(name) { return !sourceNameSet.has(name); });
  const existingDestinationSheets = ROLL_HISTORY_SHEET_NAMES.filter(function(name) { return destinationNameSet.has(name); });

  return {
    success: missingSheets.length === 0,
    action: 'preview-roll-history-migration',
    sourceSpreadsheetId: normalizedId,
    sourceSpreadsheetName: source.getName(),
    destinationSpreadsheetId: destination.getId(),
    destinationSpreadsheetName: destination.getName(),
    requiredSheets: ROLL_HISTORY_SHEET_NAMES.slice(),
    missingSheets: missingSheets,
    existingDestinationSheets: existingDestinationSheets,
    readyToImport: missingSheets.length === 0 && existingDestinationSheets.length === 0
  };
}

function importRollHistorySheetsFromSource() {
  const preview = previewRollHistoryMigration();
  if (preview.missingSheets.length > 0) {
    throw new Error('移行元に必要なシートがありません: ' + preview.missingSheets.join(', '));
  }

  const source = SpreadsheetApp.openById(preview.sourceSpreadsheetId);
  const destination = SpreadsheetApp.openById(SPREADSHEET_ID);
  const copiedSheets = [];
  const skippedSheets = [];

  ROLL_HISTORY_SHEET_NAMES.forEach(function(sheetName) {
    if (destination.getSheetByName(sheetName)) {
      skippedSheets.push({ sheetName: sheetName, reason: '移行先に同名シートあり' });
      return;
    }

    const sourceSheet = source.getSheetByName(sheetName);
    if (!sourceSheet) {
      skippedSheets.push({ sheetName: sheetName, reason: '移行元シートなし' });
      return;
    }

    const copiedSheet = sourceSheet.copyTo(destination);
    copiedSheet.setName(sheetName);
    copiedSheets.push({
      sheetName: sheetName,
      rowCount: sourceSheet.getMaxRows(),
      columnCount: sourceSheet.getMaxColumns()
    });
  });

  const statusSync = initializeRollHistoryStatusSync();

  return {
    success: copiedSheets.length > 0 && skippedSheets.length === 0,
    action: 'import-roll-history-sheets',
    sourceSpreadsheetName: source.getName(),
    destinationSpreadsheetName: destination.getName(),
    copiedSheets: copiedSheets,
    skippedSheets: skippedSheets,
    statusSync: statusSync
  };
}

function normalizeSpreadsheetIdForRollHistory(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  const urlMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return urlMatch ? urlMatch[1] : text;
}

function getRollHistoryBaseSheetName(sheetName) {
  const normalizedName = String(sheetName || '').trim().replace(/_ステータス確認$/, '');
  return ROLL_HISTORY_SHEET_NAMES.indexOf(normalizedName) >= 0 ? normalizedName : '';
}

function getRollHistorySheetNameForStandNumber(standNumber) {
  const stand = Number(standNumber) || 0;
  if (stand < 2 || stand > 17) return '';
  const firstStand = stand % 2 === 0 ? stand : stand - 1;
  const sheetName = firstStand + ',' + (firstStand + 1);
  return ROLL_HISTORY_SHEET_NAMES.indexOf(sheetName) >= 0 ? sheetName : '';
}

function isRollHistoryActualDefinitionCompatible(definition) {
  if (!definition) return false;
  const requiredLastColumn = Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS).reduce(function(maxColumn, fieldName) {
    const field = ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS[fieldName];
    return Math.max(maxColumn, definition.startColumn + field.offset + field.width - 1);
  }, definition.startColumn);
  return requiredLastColumn <= definition.endColumn;
}

function getRollHistoryActualFieldNamesForStand(standNumber) {
  const stand = Number(standNumber) || 0;
  if (stand < 6) return [];
  return Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS);
}

function getRollHistoryIncompleteRequiredFieldNamesForStand(standNumber) {
  const allowedFieldNames = new Set(getRollHistoryActualFieldNamesForStand(standNumber));
  return ROLL_HISTORY_INCOMPLETE_REQUIRED_FIELDS.filter(function(fieldName) {
    return allowedFieldNames.has(fieldName);
  });
}

function parseRollHistoryStandNumber(value) {
  const text = String(value == null ? '' : value).trim().replace(/Ｓ/g, 'S').replace(/Ｔ/g, 'T');
  const match = text.match(/^#?\s*(\d+)\s*(?:S\.?\s*T\.?|ST)$/i);
  return match ? Number(match[1]) : 0;
}

function normalizeRollHistoryRoleName(value) {
  const text = String(value == null ? '' : value).trim().replace(/＃/g, '#');
  const match = text.match(/^#?\s*(\d+)\s*-\s*上\s*-\s*(\d+)$/);
  return match ? '#' + Number(match[1]) + '-' + Number(match[2]) : '';
}

function buildRollHistoryStatusDisplay(roleName, status) {
  const normalizedRoleName = String(roleName || '').trim();
  const normalizedStatus = String(status || '').trim();
  if (!normalizedRoleName || !normalizedStatus) return '';
  return normalizedRoleName + ROLL_HISTORY_STATUS_DISPLAY_SEPARATOR + normalizedStatus;
}

function parseRollHistoryStatusDisplay(value, roleName) {
  const text = String(value == null ? '' : value).trim();
  const prefix = String(roleName || '').trim() + ROLL_HISTORY_STATUS_DISPLAY_SEPARATOR;
  const status = text.indexOf(prefix) === 0 ? text.slice(prefix.length).trim() : text;
  return STATUS_OPTIONS.indexOf(status) >= 0 ? status : '';
}

function buildRollHistoryStatusFormula(roleName) {
  const escapedRoleName = String(roleName || '').replace(/"/g, '""');
  const prefix = (escapedRoleName + ROLL_HISTORY_STATUS_DISPLAY_SEPARATOR).replace(/"/g, '""');
  return '=IFERROR(LET(st,XLOOKUP("' + escapedRoleName + '",Roles!$B:$B,Roles!$C:$C,""),IF(st="","","' + prefix + '"&st)),"")';
}

function buildRollHistoryStatusDefinitionsFromValues(values, lastColumn) {
  const rows = Array.isArray(values) ? values : [];
  const totalColumns = Math.max(Number(lastColumn) || 0, 1);
  const definitions = [];

  rows.forEach(function(row, rowIndex) {
    if (rowIndex < 1) return;
    const standHeaders = [];
    const cells = Array.isArray(row) ? row : [];

    cells.forEach(function(value, columnIndex) {
      const standNumber = parseRollHistoryStandNumber(value);
      if (standNumber) {
        standHeaders.push({ standNumber: standNumber, columnIndex: columnIndex });
      }
    });

    standHeaders.forEach(function(header, headerIndex) {
      let roleName = '';
      let roleIdRow = 0;
      const searchEndRow = Math.min(rowIndex + 10, rows.length - 1);

      for (let candidateRowIndex = rowIndex + 1; candidateRowIndex <= searchEndRow; candidateRowIndex += 1) {
        const marker = normalizeRollHistoryRoleName((rows[candidateRowIndex] || [])[header.columnIndex]);
        if (marker && getRollManagementViewStandInfo(marker).number === header.standNumber) {
          roleName = marker;
          roleIdRow = candidateRowIndex + 1;
          break;
        }
      }

      if (!roleName) return;
      const nextHeader = standHeaders[headerIndex + 1];
      const endColumn = nextHeader ? nextHeader.columnIndex : totalColumns;
      if (endColumn <= header.columnIndex) return;

      definitions.push({
        standNumber: header.standNumber,
        roleName: roleName,
        bannerRow: rowIndex,
        headerRow: rowIndex + 1,
        roleIdRow: roleIdRow,
        startColumn: header.columnIndex + 1,
        endColumn: endColumn
      });
    });
  });

  return definitions;
}

function getRollHistoryStatusDefinitions(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  return buildRollHistoryStatusDefinitionsFromValues(values, lastColumn);
}

function normalizeRollHistoryActualDate(value) {
  if (value === undefined || value === null || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return [
      String(value.getFullYear()).padStart(4, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }
  const match = String(value).trim().match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:$|T)/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return [String(year).padStart(4, '0'), String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function parseRollHistoryDateCells(cells) {
  const parts = (Array.isArray(cells) ? cells : []).map(function(value) {
    return String(value == null ? '' : value).replace(/予/g, '').trim();
  });
  if (parts.length === 1) return normalizeRollHistoryActualDate(parts[0]);
  if (!parts[0] || !parts[1] || !parts[2]) return '';
  if (/^\d{1,2}$/.test(parts[0])) parts[0] = String(2000 + Number(parts[0]));
  return normalizeRollHistoryActualDate(parts[0] + '-' + parts[1] + '-' + parts[2]);
}

function parseRollHistoryDiameterCell(value) {
  const normalized = String(value == null ? '' : value).replace(/予/g, '').replace(/,/g, '').trim();
  if (!normalized) return '';
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return '';
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : '';
}

function isRollHistoryPlannedField(cells, colors) {
  const hasPlanText = (Array.isArray(cells) ? cells : []).some(function(value) {
    return String(value == null ? '' : value).indexOf('予') >= 0;
  });
  const hasPlanColor = (Array.isArray(colors) ? colors : []).some(function(color) {
    return ROLL_HISTORY_PLANNED_FONT_COLORS.indexOf(String(color || '').toLowerCase()) >= 0;
  });
  return hasPlanText || hasPlanColor;
}

function buildRollHistoryCycleRows(startRow, displayValues, fontColors) {
  const rows = [];
  (Array.isArray(displayValues) ? displayValues : []).forEach(function(row, rowIndex) {
    const colors = (fontColors || [])[rowIndex] || [];
    const fields = {};
    Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS).forEach(function(fieldName) {
      const definition = ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS[fieldName];
      const cells = row.slice(definition.offset, definition.offset + definition.width);
      const cellColors = colors.slice(definition.offset, definition.offset + definition.width);
      const isBlank = cells.every(function(value) { return String(value == null ? '' : value).trim() === ''; });
      fields[fieldName] = {
        value: fieldName === 'currentDiameter'
          ? parseRollHistoryDiameterCell(cells[0])
          : parseRollHistoryDateCells(cells),
        isBlank: isBlank,
        planned: !isBlank && isRollHistoryPlannedField(cells, cellColors)
      };
    });
    const hasContent = Object.keys(fields).some(function(fieldName) { return !fields[fieldName].isBlank; });
    if (hasContent) rows.push({ rowNumber: Number(startRow) + rowIndex, fields: fields });
  });
  return rows;
}

function normalizeRollHistoryActualSnapshot(role) {
  const progress = parseWorkProgress(role && role.workProgress);
  return {
    dispatchDate: normalizeRollHistoryActualDate(progress.dispatchDate),
    arrivalDate: normalizeRollHistoryActualDate(progress.arrivalDate),
    currentDiameter: parseRollHistoryDiameterCell(role && role.currentDiameter),
    useStartDate: normalizeRollHistoryActualDate(role && role.useStartDate),
    useEndDate: normalizeRollHistoryActualDate(role && role.useEndDate)
  };
}

function rollHistoryActualValuesEqual(fieldName, left, right) {
  if (left === '' || right === '' || left === undefined || right === undefined) return false;
  if (fieldName === 'currentDiameter') return Math.abs(Number(left) - Number(right)) < 0.051;
  return String(left) === String(right);
}

function getRollHistoryOpenCycleRow(cycleRows) {
  const rows = Array.isArray(cycleRows) ? cycleRows : [];
  let lastCompletedIndex = -1;
  rows.forEach(function(row, index) {
    const useEndField = row && row.fields && row.fields.useEndDate;
    if (useEndField && !useEndField.isBlank && !useEndField.planned) {
      lastCompletedIndex = index;
    }
  });
  return rows[lastCompletedIndex + 1] || null;
}

function rollHistoryCycleRowHasActualValues(cycleRow) {
  if (!cycleRow || !cycleRow.fields) return false;
  return Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS).some(function(fieldName) {
    const field = cycleRow.fields[fieldName];
    return field && !field.isBlank && !field.planned && field.value !== '' && field.value !== undefined;
  });
}

function getRollHistoryCurrentEditableCycleRow(cycleRows) {
  const rows = Array.isArray(cycleRows) ? cycleRows : [];
  const openCycleRow = getRollHistoryOpenCycleRow(rows);
  if (openCycleRow && rollHistoryCycleRowHasActualValues(openCycleRow)) return openCycleRow;
  const latestCompletedRow = rows.slice().reverse().find(function(row) {
    const useEndField = row && row.fields && row.fields.useEndDate;
    return useEndField && !useEndField.isBlank && !useEndField.planned && useEndField.value !== '';
  });
  return latestCompletedRow || openCycleRow || null;
}

function getRollHistoryIncompleteActualFieldNames(cycleRow, standNumber) {
  const useEndField = cycleRow && cycleRow.fields && cycleRow.fields.useEndDate;
  if (!useEndField || useEndField.isBlank || useEndField.planned || useEndField.value === '') return [];
  const requiredFieldNames = standNumber === undefined || standNumber === null
    ? ROLL_HISTORY_INCOMPLETE_REQUIRED_FIELDS
    : getRollHistoryIncompleteRequiredFieldNamesForStand(standNumber);
  return requiredFieldNames.filter(function(fieldName) {
    const field = cycleRow.fields[fieldName];
    return !field || field.isBlank || field.planned || field.value === '' || field.value === undefined;
  });
}

function encodeRollHistoryIncompleteWarningState(state) {
  return Utilities.base64EncodeWebSafe(
    Utilities.newBlob(JSON.stringify(state || {})).getBytes()
  );
}

function decodeRollHistoryIncompleteWarningState(note) {
  const firstLine = String(note || '').split('\n')[0];
  if (firstLine.indexOf(ROLL_HISTORY_INCOMPLETE_WARNING_NOTE_PREFIX) !== 0) return null;
  try {
    const encoded = firstLine.slice(ROLL_HISTORY_INCOMPLETE_WARNING_NOTE_PREFIX.length);
    return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString());
  } catch (error) {
    Logger.log('decodeRollHistoryIncompleteWarningState failed: ' + error.toString());
    return null;
  }
}

function getRollHistoryCycleRowFromSheet(sheet, definition, rowNumber) {
  const blockRange = sheet.getRange(
    rowNumber,
    definition.startColumn,
    1,
    definition.endColumn - definition.startColumn + 1
  );
  const rows = buildRollHistoryCycleRows(
    rowNumber,
    blockRange.getDisplayValues(),
    blockRange.getFontColors()
  );
  return rows[0] || null;
}

function updateRollHistoryIncompleteCycleWarning(sheet, definition, cycleRow) {
  if (!sheet || !definition || !cycleRow) return { missingFields: [], warnedRanges: [] };
  const requiredFieldNames = getRollHistoryIncompleteRequiredFieldNamesForStand(definition.standNumber);
  const missingFields = getRollHistoryIncompleteActualFieldNames(cycleRow, definition.standNumber);
  const missingSet = new Set(missingFields);
  const missingLabels = missingFields.map(function(fieldName) {
    return ROLL_HISTORY_ACTUAL_FIELD_LABELS[fieldName] || fieldName;
  });
  const warningMessage = '⚠ 使用終了済みですが、' + missingLabels.join('・') + 'の実績が未入力です。';
  const warnedRanges = [];

  requiredFieldNames.forEach(function(fieldName) {
    const fieldDefinition = ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS[fieldName];
    const range = sheet.getRange(
      cycleRow.rowNumber,
      definition.startColumn + fieldDefinition.offset,
      1,
      fieldDefinition.width
    );
    const firstCell = range.getCell(1, 1);
    const existingNote = String(firstCell.getNote() || '');
    const savedState = decodeRollHistoryIncompleteWarningState(existingNote);

    if (missingSet.has(fieldName)) {
      const state = savedState || {
        backgrounds: range.getBackgrounds(),
        note: existingNote
      };
      firstCell.setNote(
        ROLL_HISTORY_INCOMPLETE_WARNING_NOTE_PREFIX
          + encodeRollHistoryIncompleteWarningState(state)
          + '\n'
          + warningMessage
      );
      range.setBackground(ROLL_HISTORY_INCOMPLETE_WARNING_COLOR);
      warnedRanges.push(range.getA1Notation());
      return;
    }

    if (savedState) {
      if (Array.isArray(savedState.backgrounds)) range.setBackgrounds(savedState.backgrounds);
      firstCell.setNote(String(savedState.note || ''));
    }
  });

  return {
    missingFields: missingFields,
    missingLabels: missingLabels,
    warnedRanges: warnedRanges
  };
}

function rollHistoryCycleRowMatchesSnapshot(row, actualSnapshot, excludedFieldName, allowedFieldNames) {
  if (!row || !row.fields || !actualSnapshot) return false;
  const targetFieldNames = Array.isArray(allowedFieldNames)
    ? allowedFieldNames
    : Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS);
  return targetFieldNames.some(function(fieldName) {
    if (fieldName === excludedFieldName || fieldName === 'useEndDate') return false;
    const field = row.fields[fieldName];
    const desiredValue = actualSnapshot[fieldName];
    return field
      && !field.isBlank
      && !field.planned
      && desiredValue !== ''
      && desiredValue !== undefined
      && desiredValue !== null
      && rollHistoryActualValuesEqual(fieldName, field.value, desiredValue);
  });
}

function planRollHistoryActualWrites(cycleRows, actualSnapshot, allowedFieldNames) {
  const rows = Array.isArray(cycleRows) ? cycleRows : [];
  const writes = [];
  const unchanged = [];
  const conflicts = [];
  const openCycleRow = getRollHistoryOpenCycleRow(rows);

  const targetFieldNames = Array.isArray(allowedFieldNames)
    ? allowedFieldNames
    : Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS);

  targetFieldNames.forEach(function(fieldName) {
    const desiredValue = actualSnapshot && actualSnapshot[fieldName];
    if (desiredValue === '' || desiredValue === undefined || desiredValue === null) return;

    const openCycleField = openCycleRow && openCycleRow.fields[fieldName];
    const openCycleHasThisActual = openCycleField
      && !openCycleField.isBlank
      && !openCycleField.planned;
    const belongsToOpenCycle = openCycleRow && (
      fieldName === 'dispatchDate'
      || fieldName === 'arrivalDate'
      || openCycleHasThisActual
      || rollHistoryCycleRowMatchesSnapshot(openCycleRow, actualSnapshot, fieldName, targetFieldNames)
    );

    if (belongsToOpenCycle) {
      const openCycleField = openCycleRow.fields[fieldName];
      if (openCycleField && !openCycleField.planned
        && rollHistoryActualValuesEqual(fieldName, openCycleField.value, desiredValue)) {
        unchanged.push({ field: fieldName, rowNumber: openCycleRow.rowNumber, value: desiredValue });
      } else {
        writes.push({
          field: fieldName,
          rowNumber: openCycleRow.rowNumber,
          value: desiredValue
        });
      }
      return;
    }

    const exactActual = rows.slice().reverse().find(function(row) {
      const field = row.fields[fieldName];
      return field && !field.planned && rollHistoryActualValuesEqual(fieldName, field.value, desiredValue);
    });
    if (exactActual) {
      unchanged.push({ field: fieldName, rowNumber: exactActual.rowNumber, value: desiredValue });
      return;
    }

    const definition = ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS[fieldName];
    const pairFieldName = definition.pairField;
    const pairValue = actualSnapshot && actualSnapshot[pairFieldName];
    let targetRow = null;
    if (pairValue !== '' && pairValue !== undefined && pairValue !== null) {
      targetRow = rows.slice().reverse().find(function(row) {
        const pairField = row.fields[pairFieldName];
        return pairField && !pairField.planned
          && rollHistoryActualValuesEqual(pairFieldName, pairField.value, pairValue);
      }) || null;
    }

    if (targetRow) {
      const targetField = targetRow.fields[fieldName];
      if (targetField.isBlank || targetField.planned) {
        writes.push({ field: fieldName, rowNumber: targetRow.rowNumber, value: desiredValue });
      } else {
        conflicts.push({
          field: fieldName,
          rowNumber: targetRow.rowNumber,
          expected: desiredValue,
          existing: targetField.value,
          reason: 'paired-row-has-different-actual'
        });
      }
      return;
    }

    const plannedRow = rows.find(function(row) {
      return row.fields[fieldName] && row.fields[fieldName].planned;
    });
    if (plannedRow) {
      writes.push({ field: fieldName, rowNumber: plannedRow.rowNumber, value: desiredValue });
      return;
    }

    conflicts.push({
      field: fieldName,
      rowNumber: 0,
      expected: desiredValue,
      existing: '',
      reason: 'no-safe-cycle-row'
    });
  });

  return { writes: writes, unchanged: unchanged, conflicts: conflicts };
}

function getRollHistoryActualBlockEndRow(definition, definitions, lastRow) {
  const nextDefinition = (definitions || []).filter(function(candidate) {
    return candidate.startColumn === definition.startColumn && candidate.headerRow > definition.headerRow;
  }).sort(function(left, right) { return left.headerRow - right.headerRow; })[0];
  return nextDefinition ? nextDefinition.bannerRow - 1 : lastRow;
}

function writeRollHistoryActualValue(sheet, definition, write) {
  const fieldDefinition = ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS[write.field];
  const range = sheet.getRange(
    write.rowNumber,
    definition.startColumn + fieldDefinition.offset,
    1,
    fieldDefinition.width
  );
  if (write.field === 'currentDiameter') {
    range.setValue(Number(write.value)).setFontColor(ROLL_HISTORY_ACTUAL_FONT_COLOR);
  } else {
    const parts = String(write.value).split('-').map(Number);
    const existingYearText = String(range.getCell(1, 1).getDisplayValue() || '').replace(/予/g, '').trim();
    let usesTwoDigitYear = /^\d{1,2}$/.test(existingYearText);
    if (!existingYearText && write.rowNumber > definition.roleIdRow) {
      const previousYearValues = sheet.getRange(
        definition.roleIdRow,
        definition.startColumn + fieldDefinition.offset,
        write.rowNumber - definition.roleIdRow,
        1
      ).getDisplayValues().map(function(row) {
        return String(row[0] || '').replace(/予/g, '').trim();
      }).filter(Boolean);
      usesTwoDigitYear = previousYearValues.length > 0
        && /^\d{1,2}$/.test(previousYearValues[previousYearValues.length - 1]);
    }
    range.setValues([[usesTwoDigitYear ? parts[0] % 100 : parts[0], parts[1], parts[2]]])
      .setFontColor(ROLL_HISTORY_ACTUAL_FONT_COLOR);
  }
  return range.getA1Notation();
}

function syncRollHistoryActualsFromRolesSheet(sheet, roleMap) {
  const definitions = getRollHistoryStatusDefinitions(sheet);
  const result = { sheetName: sheet.getName(), written: [], unchanged: [], conflicts: [], warnings: [], skipped: [] };
  definitions.forEach(function(definition) {
    const role = roleMap.get(definition.roleName);
    if (!role) return;
    if (!isRollHistoryActualDefinitionCompatible(definition)) {
      result.skipped.push({ roleName: definition.roleName, reason: '実績欄の列幅不足' });
      return;
    }
    const endRow = getRollHistoryActualBlockEndRow(definition, definitions, sheet.getLastRow());
    const rowCount = Math.max(endRow - definition.roleIdRow + 1, 0);
    if (rowCount <= 0) {
      result.skipped.push({ roleName: definition.roleName, reason: '履歴行なし' });
      return;
    }
    const columnCount = definition.endColumn - definition.startColumn + 1;
    const blockRange = sheet.getRange(definition.roleIdRow, definition.startColumn, rowCount, columnCount);
    const cycleRows = buildRollHistoryCycleRows(
      definition.roleIdRow,
      blockRange.getDisplayValues(),
      blockRange.getFontColors()
    );
    const plan = planRollHistoryActualWrites(
      cycleRows,
      normalizeRollHistoryActualSnapshot(role),
      getRollHistoryActualFieldNamesForStand(definition.standNumber)
    );
    plan.writes.forEach(function(write) {
      result.written.push({
        roleName: definition.roleName,
        field: write.field,
        value: write.value,
        range: writeRollHistoryActualValue(sheet, definition, write)
      });
    });
    plan.unchanged.forEach(function(item) {
      result.unchanged.push({ roleName: definition.roleName, field: item.field, value: item.value, rowNumber: item.rowNumber });
    });
    plan.conflicts.forEach(function(item) {
      result.conflicts.push({
        roleName: definition.roleName,
        field: item.field,
        expected: item.expected,
        existing: item.existing,
        rowNumber: item.rowNumber,
        reason: item.reason
      });
    });
    if (plan.writes.length > 0) SpreadsheetApp.flush();
    Array.from(new Set(plan.writes.map(function(write) { return write.rowNumber; }))).forEach(function(rowNumber) {
      const cycleRow = getRollHistoryCycleRowFromSheet(sheet, definition, rowNumber);
      const warning = updateRollHistoryIncompleteCycleWarning(sheet, definition, cycleRow);
      if (warning.missingFields.length > 0) {
        result.warnings.push({
          roleName: definition.roleName,
          rowNumber: rowNumber,
          missingFields: warning.missingFields,
          missingLabels: warning.missingLabels,
          ranges: warning.warnedRanges
        });
      }
    });
  });
  return result;
}

function syncRollHistoryActualsFromRoles(roles, roleNames) {
  const roleList = Array.isArray(roles) ? roles : fetchRoles();
  const requestedNames = new Set((roleNames || []).map(function(name) { return String(name || '').trim(); }));
  const roleMap = new Map(roleList.filter(function(role) {
    const roleName = String(role && role.name || '').trim();
    const standNumber = getRollManagementViewStandInfo(roleName).number;
    return Boolean(getRollHistorySheetNameForStandNumber(standNumber))
      && getRollHistoryActualFieldNamesForStand(standNumber).length > 0
      && normalizeBooleanForFieldRollManagement(role && role.isActiveThreeSet)
      && (requestedNames.size === 0 || requestedNames.has(roleName));
  }).map(function(role) {
    return [String(role.name || '').trim(), role];
  }));
  const targetSheetNames = Array.from(new Set(Array.from(roleMap.values()).map(function(role) {
    return getRollHistorySheetNameForStandNumber(getRollManagementViewStandInfo(role && role.name).number);
  }))).filter(Boolean).sort(function(left, right) {
    return ROLL_HISTORY_SHEET_NAMES.indexOf(left) - ROLL_HISTORY_SHEET_NAMES.indexOf(right);
  });
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const summary = {
    sheetNames: targetSheetNames,
    sheets: [],
    written: [],
    unchanged: [],
    conflicts: [],
    warnings: [],
    skipped: []
  };

  targetSheetNames.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      summary.skipped.push({ sheetName: sheetName, roleName: '', reason: 'シートなし' });
      return;
    }
    const sheetResult = syncRollHistoryActualsFromRolesSheet(sheet, roleMap);
    summary.sheets.push(sheetResult);
    ['written', 'unchanged', 'conflicts', 'warnings', 'skipped'].forEach(function(key) {
      sheetResult[key].forEach(function(item) {
        summary[key].push(Object.assign({ sheetName: sheetName }, item));
      });
    });
  });
  Logger.log('syncRollHistoryActualsFromRoles: ' + JSON.stringify(summary));
  return summary;
}

function syncRollHistoryActualsFromRoles16_17(roles, roleNames) {
  const roleList = Array.isArray(roles) ? roles : fetchRoles();
  const names = (roleNames || []).filter(function(name) {
    const standNumber = getRollManagementViewStandInfo(name).number;
    return standNumber === 16 || standNumber === 17;
  });
  const fallbackNames = names.length > 0 ? names : roleList.filter(function(role) {
    const standNumber = getRollManagementViewStandInfo(role && role.name).number;
    return standNumber === 16 || standNumber === 17;
  }).map(function(role) { return role.name; });
  return syncRollHistoryActualsFromRoles(roleList, fallbackNames);
}

function syncRollHistoryActuals16_17() {
  return syncRollHistoryActualsFromRoles16_17(fetchRoles());
}

function syncRollHistoryActualsAll() {
  return syncRollHistoryActualsFromRoles(fetchRoles());
}

function diagnoseRollHistoryActualSyncLayouts() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const roles = fetchRoles();
  const activeRoleNamesBySheet = new Map();
  roles.forEach(function(role) {
    if (!normalizeBooleanForFieldRollManagement(role && role.isActiveThreeSet)) return;
    const standNumber = getRollManagementViewStandInfo(role && role.name).number;
    if (getRollHistoryActualFieldNamesForStand(standNumber).length === 0) return;
    const sheetName = getRollHistorySheetNameForStandNumber(standNumber);
    if (!sheetName) return;
    if (!activeRoleNamesBySheet.has(sheetName)) activeRoleNamesBySheet.set(sheetName, []);
    activeRoleNamesBySheet.get(sheetName).push(String(role.name || '').trim());
  });

  const sheets = ROLL_HISTORY_SHEET_NAMES.map(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { sheetName: sheetName, missing: true, safe: false };
    const definitions = getRollHistoryStatusDefinitions(sheet);
    const compatibleDefinitions = definitions.filter(isRollHistoryActualDefinitionCompatible);
    const detectedRoleNames = new Set(compatibleDefinitions.map(function(definition) { return definition.roleName; }));
    const expectedActiveRoleNames = activeRoleNamesBySheet.get(sheetName) || [];
    const missingActiveRoleNames = expectedActiveRoleNames.filter(function(roleName) {
      return !detectedRoleNames.has(roleName);
    });
    const incompatibleRoleNames = definitions.filter(function(definition) {
      return !isRollHistoryActualDefinitionCompatible(definition);
    }).map(function(definition) { return definition.roleName; });
    return {
      sheetName: sheetName,
      missing: false,
      definitionCount: definitions.length,
      compatibleCount: compatibleDefinitions.length,
      expectedActiveRoleNames: expectedActiveRoleNames,
      missingActiveRoleNames: missingActiveRoleNames,
      incompatibleRoleNames: incompatibleRoleNames,
      protectedFields: sheetName === '2,3' || sheetName === '4,5'
        ? Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS)
        : [],
      safe: missingActiveRoleNames.length === 0 && incompatibleRoleNames.length === 0
    };
  });
  const result = {
    success: sheets.every(function(sheet) { return sheet.safe; }),
    scriptVersion: SCRIPT_VERSION,
    sheets: sheets
  };
  Logger.log('diagnoseRollHistoryActualSyncLayouts: ' + JSON.stringify(result));
  return result;
}

function getRollHistoryActualEditedFieldNames(definition, range) {
  if (!definition || !range) return [];
  const firstEditedColumn = range.getColumn();
  const lastEditedColumn = range.getLastColumn();
  return Object.keys(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS).filter(function(fieldName) {
    const fieldDefinition = ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS[fieldName];
    const firstFieldColumn = definition.startColumn + fieldDefinition.offset;
    const lastFieldColumn = firstFieldColumn + fieldDefinition.width - 1;
    return firstEditedColumn <= lastFieldColumn && lastEditedColumn >= firstFieldColumn;
  });
}

function getRollHistoryActualValueFromSheet(sheet, definition, rowNumber, fieldName) {
  const fieldDefinition = ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS[fieldName];
  const range = sheet.getRange(
    rowNumber,
    definition.startColumn + fieldDefinition.offset,
    1,
    fieldDefinition.width
  );
  const cells = range.getDisplayValues()[0];
  const colors = range.getFontColors()[0];
  const isBlank = cells.every(function(value) {
    return String(value == null ? '' : value).trim() === '';
  });
  const value = fieldName === 'currentDiameter'
    ? parseRollHistoryDiameterCell(cells[0])
    : parseRollHistoryDateCells(cells);
  return {
    value: value,
    isBlank: isBlank,
    planned: !isBlank && isRollHistoryPlannedField(cells, colors),
    range: range
  };
}

function getRoleRollHistoryActualValue(role, fieldName) {
  const progress = parseWorkProgress(role && role.workProgress);
  if (fieldName === 'dispatchDate' || fieldName === 'arrivalDate') {
    return normalizeRollHistoryActualDate(progress[fieldName]);
  }
  if (fieldName === 'currentDiameter') {
    return parseRollHistoryDiameterCell(role && role.currentDiameter);
  }
  return normalizeRollHistoryActualDate(role && role[fieldName]);
}

function applyRollHistoryActualChangeToRoles(roles, roleName, updates, changedAt) {
  const roleList = JSON.parse(JSON.stringify(Array.isArray(roles) ? roles : []));
  const normalizedRoleName = String(roleName || '').trim();
  const target = roleList.find(function(role) {
    return String(role && role.name || '').trim() === normalizedRoleName;
  });
  if (!target) throw new Error(normalizedRoleName + ' がRolesに見つかりません。');

  const labels = {
    dispatchDate: '搬出日変更（ロール管理表）',
    arrivalDate: '搬入日変更（ロール管理表）',
    currentDiameter: '現在径変更（ロール管理表）',
    useStartDate: '使用開始日変更（ロール管理表）',
    useEndDate: '使用終了日変更（ロール管理表）'
  };
  const eventAt = String(changedAt || new Date().toISOString());
  const progress = parseWorkProgress(target.workProgress);
  const changedFields = [];

  Object.keys(updates || {}).forEach(function(fieldName) {
    if (!Object.prototype.hasOwnProperty.call(ROLL_HISTORY_ACTUAL_FIELD_DEFINITIONS, fieldName)) return;
    const nextValue = updates[fieldName];
    const beforeValue = getRoleRollHistoryActualValue(target, fieldName);
    const sameValue = beforeValue === '' && nextValue === ''
      ? true
      : rollHistoryActualValuesEqual(fieldName, beforeValue, nextValue);
    if (sameValue) return;

    if (fieldName === 'dispatchDate' || fieldName === 'arrivalDate') {
      progress[fieldName] = nextValue;
    } else {
      target[fieldName] = nextValue;
    }
    appendRollHistoryStatusEntry(
      target,
      fieldName,
      labels[fieldName] || fieldName + '変更（ロール管理表）',
      beforeValue,
      nextValue,
      eventAt
    );
    changedFields.push(fieldName);
  });

  if (changedFields.length === 0) {
    return { changed: false, roles: roleList, updatedRoleNames: [], changedFields: [] };
  }
  target.workProgress = progress;
  target.updatedAt = eventAt;
  return {
    changed: true,
    roles: roleList,
    updatedRoleNames: [normalizedRoleName],
    changedFields: changedFields
  };
}

function handleRollHistoryActualEdit(e) {
  const range = e && e.range;
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || ROLL_HISTORY_SHEET_NAMES.indexOf(sheet.getName()) < 0) return { handled: false };

  const definitions = getRollHistoryStatusDefinitions(sheet);
  const definition = definitions.find(function(candidate) {
    const blockEndRow = getRollHistoryActualBlockEndRow(candidate, definitions, sheet.getLastRow());
    return range.getRow() >= candidate.roleIdRow
      && range.getLastRow() <= blockEndRow
      && range.getColumn() <= candidate.endColumn
      && range.getLastColumn() >= candidate.startColumn;
  });
  if (!definition) return { handled: false };
  if (!isRollHistoryActualDefinitionCompatible(definition)) {
    sheet.getParent().toast(definition.roleName + ' の実績欄配置を確認してください。', '連動対象外', 8);
    return { handled: true, updated: false, reason: 'incompatible-layout' };
  }

  const blockEndRow = getRollHistoryActualBlockEndRow(definition, definitions, sheet.getLastRow());
  const blockRange = sheet.getRange(
    definition.roleIdRow,
    definition.startColumn,
    blockEndRow - definition.roleIdRow + 1,
    definition.endColumn - definition.startColumn + 1
  );
  const cycleRows = buildRollHistoryCycleRows(
    definition.roleIdRow,
    blockRange.getDisplayValues(),
    blockRange.getFontColors()
  );
  const editableCycleRow = getRollHistoryCurrentEditableCycleRow(cycleRows);
  if (!editableCycleRow
    || range.getRow() > editableCycleRow.rowNumber
    || range.getLastRow() < editableCycleRow.rowNumber) {
    return { handled: false };
  }

  const editedFieldNames = getRollHistoryActualEditedFieldNames(definition, range);
  const allowedFieldNames = new Set(getRollHistoryActualFieldNamesForStand(definition.standNumber));
  const protectedFieldNames = editedFieldNames.filter(function(fieldName) {
    return !allowedFieldNames.has(fieldName);
  });
  const fieldNames = editedFieldNames.filter(function(fieldName) {
    return allowedFieldNames.has(fieldName);
  });
  if (protectedFieldNames.length > 0 && fieldNames.length === 0) {
    sheet.getParent().toast(
      '#2〜5は上下2本分の実績が別々のため、実績欄はアプリ連動の対象外です。',
      '上下2本分の実績を保護しました',
      8
    );
    return { handled: true, updated: false, reason: 'protected-field', fields: protectedFieldNames };
  }
  if (fieldNames.length === 0) return { handled: false };

  const updates = {};
  const actualRanges = [];
  const invalidFields = [];
  fieldNames.forEach(function(fieldName) {
    const field = getRollHistoryActualValueFromSheet(
      sheet,
      definition,
      editableCycleRow.rowNumber,
      fieldName
    );
    if (!field.isBlank && (field.value === '' || field.value === undefined)) {
      invalidFields.push(fieldName);
      return;
    }
    updates[fieldName] = field.isBlank ? '' : field.value;
    actualRanges.push(field.range);
  });

  if (invalidFields.length > 0) {
    sheet.getParent().toast('年月日を3セルすべて入力するか、3セルすべて削除してください。', '実績の入力が未完了です', 8);
    return { handled: true, updated: false, reason: 'incomplete-actual', fields: invalidFields };
  }

  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  try {
    lock.waitLock(ROLES_EDIT_TRIGGER_LOCK_TIMEOUT_MS);
    const result = applyRollHistoryActualChangeToRoles(
      fetchRoles(),
      definition.roleName,
      updates,
      new Date().toISOString()
    );
    if (result.changed) updateChangedRolesRows(result.roles, result.updatedRoleNames);
    actualRanges.forEach(function(actualRange) {
      actualRange.setFontColor(ROLL_HISTORY_ACTUAL_FONT_COLOR);
    });
    SpreadsheetApp.flush();
    const refreshedCycleRow = getRollHistoryCycleRowFromSheet(
      sheet,
      definition,
      editableCycleRow.rowNumber
    );
    const incompleteWarning = updateRollHistoryIncompleteCycleWarning(
      sheet,
      definition,
      refreshedCycleRow
    );
    SpreadsheetApp.flush();

    if (result.changed) {
      try {
        refreshRollManagementView();
        refreshFieldRollManagementView();
      } catch (refreshError) {
        Logger.log('handleRollHistoryActualEdit view refresh failed: ' + refreshError.toString());
      }
    }

    if (incompleteWarning.missingFields.length > 0) {
      sheet.getParent().toast(
        definition.roleName + '：' + incompleteWarning.missingLabels.join('・') + 'の実績が未入力です。',
        '反映完了・不足項目あり',
        8
      );
    } else {
      sheet.getParent().toast(definition.roleName + ' の実績をアプリへ反映しました。', 'ロール管理連動', 5);
    }
    return {
      handled: true,
      updated: result.changed,
      reason: result.changed ? '' : 'unchanged',
      roleName: definition.roleName,
      fields: result.changedFields
    };
  } catch (error) {
    Logger.log('handleRollHistoryActualEdit failed: ' + error.toString());
    sheet.getParent().toast(error.message || String(error), '実績の反映に失敗しました', 10);
    return { handled: true, updated: false, reason: error.message || String(error) };
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function syncRollHistoryActualsToRolesAll(sheetNames) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let roles = fetchRoles();
  const roleMap = new Map(roles.map(function(role) {
    return [String(role && role.name || '').trim(), role];
  }));
  const updatedRoleNames = [];
  const changedFields = [];
  const sheetResults = [];
  const changedAt = new Date().toISOString();

  const targetSheetNames = (Array.isArray(sheetNames) && sheetNames.length > 0)
    ? sheetNames.filter(function(sheetName) { return ROLL_HISTORY_SHEET_NAMES.indexOf(sheetName) >= 0; })
    : ROLL_HISTORY_SHEET_NAMES.slice();

  targetSheetNames.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheetResults.push({ sheetName: sheetName, missing: true, checked: 0, updated: 0 });
      return;
    }
    const definitions = getRollHistoryStatusDefinitions(sheet);
    let checked = 0;
    let updated = 0;
    definitions.forEach(function(definition) {
      const role = roleMap.get(definition.roleName);
      if (!role || !normalizeBooleanForFieldRollManagement(role.isActiveThreeSet)) return;
      if (!isRollHistoryActualDefinitionCompatible(definition)) return;
      checked += 1;
      const blockEndRow = getRollHistoryActualBlockEndRow(definition, definitions, sheet.getLastRow());
      const blockRange = sheet.getRange(
        definition.roleIdRow,
        definition.startColumn,
        blockEndRow - definition.roleIdRow + 1,
        definition.endColumn - definition.startColumn + 1
      );
      const cycleRows = buildRollHistoryCycleRows(
        definition.roleIdRow,
        blockRange.getDisplayValues(),
        blockRange.getFontColors()
      );
      const editableCycleRow = getRollHistoryCurrentEditableCycleRow(cycleRows);
      if (!editableCycleRow) return;
      const updates = {};
      getRollHistoryActualFieldNamesForStand(definition.standNumber).forEach(function(fieldName) {
        const field = editableCycleRow.fields[fieldName];
        if (field && !field.isBlank && !field.planned && field.value !== '') {
          updates[fieldName] = field.value;
        }
      });
      const result = applyRollHistoryActualChangeToRoles(
        roles,
        definition.roleName,
        updates,
        changedAt
      );
      if (!result.changed) return;
      roles = result.roles;
      updated += 1;
      updatedRoleNames.push(definition.roleName);
      changedFields.push({ sheetName: sheetName, roleName: definition.roleName, fields: result.changedFields });
    });
    sheetResults.push({ sheetName: sheetName, missing: false, checked: checked, updated: updated });
  });

  if (updatedRoleNames.length > 0) {
    updateChangedRolesRows(roles, Array.from(new Set(updatedRoleNames)));
    SpreadsheetApp.flush();
    refreshRollManagementView();
    refreshFieldRollManagementView();
  }
  return {
    success: true,
    updatedRoleNames: Array.from(new Set(updatedRoleNames)),
    changedFields: changedFields,
    sheets: sheetResults
  };
}

function syncRollHistoryActualsToRoles16_17() {
  return syncRollHistoryActualsToRolesAll(['16,17']);
}

function initializeRollHistoryStatusSync() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const roleMap = new Map(fetchRoles().map(function(role) {
    return [String(role && role.name || '').trim(), role];
  }));
  const results = [];

  ROLL_HISTORY_SHEET_NAMES.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      results.push({ sheetName: sheetName, configured: 0, skipped: 0, missing: true });
      return;
    }
    results.push(configureRollHistoryStatusBands(sheet, roleMap));
  });

  return {
    success: results.some(function(result) { return result.configured > 0; }),
    action: 'initialize-roll-history-status-sync',
    sheets: results
  };
}

function configureRollHistoryStatusBands(sheet, roleMap) {
  const definitions = getRollHistoryStatusDefinitions(sheet);
  const configuredRanges = [];
  const skipped = [];

  definitions.forEach(function(definition) {
    const role = roleMap.get(definition.roleName);
    if (!role) return;

    const columnCount = definition.endColumn - definition.startColumn + 1;
    const bandRange = sheet.getRange(definition.bannerRow, definition.startColumn, 1, columnCount);
    const topLeft = bandRange.getCell(1, 1);
    const note = String(topLeft.getNote() || '');
    const isOwnedBand = note.indexOf(ROLL_HISTORY_STATUS_NOTE_PREFIX) === 0;
    const hasExistingContent = bandRange.getDisplayValues()[0].some(function(value) {
      return String(value || '').trim() !== '';
    });

    if (bandRange.isPartOfMerge() && !isOwnedBand) {
      skipped.push({ roleName: definition.roleName, reason: '既存の結合セルあり' });
      return;
    }
    if (hasExistingContent && !isOwnedBand) {
      skipped.push({ roleName: definition.roleName, reason: 'ステータス行に既存データあり' });
      return;
    }

    if (bandRange.isPartOfMerge()) bandRange.breakApart();
    bandRange.merge();
    bandRange
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(false)
      .setFontFamily('MS PGothic')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#ffffff')
      .setBorder(true, true, true, true, false, false, '#7f8c8d', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    topLeft
      .setFormula(buildRollHistoryStatusFormula(definition.roleName))
      .setNote(ROLL_HISTORY_STATUS_NOTE_PREFIX + definition.roleName);

    const validationValues = STATUS_OPTIONS.map(function(status) {
      return buildRollHistoryStatusDisplay(definition.roleName, status);
    });
    const validation = SpreadsheetApp.newDataValidation()
      .requireValueInList(validationValues, true)
      .setAllowInvalid(false)
      .setHelpText('選択するとRolesとアプリへ同期されます。')
      .build();
    bandRange.setDataValidation(validation);
    sheet.setRowHeight(definition.bannerRow, 28);
    configuredRanges.push(bandRange);
  });

  applyRollHistoryStatusConditionalFormats(sheet, configuredRanges);
  return {
    sheetName: sheet.getName(),
    configured: configuredRanges.length,
    skipped: skipped.length,
    skippedDetails: skipped
  };
}

function applyRollHistoryStatusConditionalFormats(sheet, ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return;
  const statusTokens = STATUS_OPTIONS.map(function(status) {
    return ROLL_HISTORY_STATUS_DISPLAY_SEPARATOR + status;
  });
  const existingRules = sheet.getConditionalFormatRules().filter(function(rule) {
    const condition = rule.getBooleanCondition();
    if (!condition) return true;
    const type = condition.getCriteriaType();
    const values = condition.getCriteriaValues();
    const firstValue = values && values.length > 0 ? String(values[0]) : '';
    return !(type === SpreadsheetApp.BooleanCriteria.TEXT_CONTAINS
      && statusTokens.indexOf(firstValue) >= 0);
  });

  STATUS_OPTIONS.forEach(function(status) {
    const background = ROLL_MANAGEMENT_VIEW_STATUS_COLORS[status] || '#ffffff';
    const fontColor = status === 'オンライン' || status === '発注済み（納入待ち）'
      ? '#274e13'
      : (status === '改削中' || status === '廃却待ち（ラック保管）' ? '#990000' : '#444444');
    existingRules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains(ROLL_HISTORY_STATUS_DISPLAY_SEPARATOR + status)
        .setBackground(background)
        .setFontColor(fontColor)
        .setBold(true)
        .setRanges(ranges)
        .build()
    );
  });
  sheet.setConditionalFormatRules(existingRules);
}

function handleRollHistoryStatusEdit(e) {
  const range = e && e.range;
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet || !getRollHistoryBaseSheetName(sheet.getName())) return { handled: false };

  const topLeft = range.getCell(1, 1);
  const note = String(topLeft.getNote() || '');
  if (note.indexOf(ROLL_HISTORY_STATUS_NOTE_PREFIX) !== 0) return { handled: false };

  const roleName = note.slice(ROLL_HISTORY_STATUS_NOTE_PREFIX.length).trim();
  const editedValue = e && Object.prototype.hasOwnProperty.call(e, 'value') ? e.value : topLeft.getDisplayValue();
  const nextStatus = parseRollHistoryStatusDisplay(editedValue, roleName);
  const restoreFormula = function() {
    topLeft.setFormula(buildRollHistoryStatusFormula(roleName));
  };

  if (!nextStatus) {
    restoreFormula();
    sheet.getParent().toast('許可されていないステータスです。変更を取り消しました。', 'ステータス変更', 8);
    return { handled: true, updated: false, reason: 'invalid-status' };
  }

  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  try {
    lock.waitLock(ROLES_EDIT_TRIGGER_LOCK_TIMEOUT_MS);
    const changedAt = new Date().toISOString();
    const today = Utilities.formatDate(new Date(changedAt), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const result = applyRollHistoryStatusChangeToRoles(fetchRoles(), roleName, nextStatus, changedAt, today);
    if (!result.changed) {
      restoreFormula();
      return { handled: true, updated: false, reason: 'unchanged' };
    }

    updateChangedRolesRows(result.roles, result.updatedRoleNames);
    SpreadsheetApp.flush();
    restoreFormula();

    try {
      const actualSyncResult = syncRollHistoryActualsFromRoles(result.roles, result.updatedRoleNames);
      Logger.log('handleRollHistoryStatusEdit: history actuals updated: ' + JSON.stringify(actualSyncResult));
    } catch (actualSyncError) {
      Logger.log('handleRollHistoryStatusEdit: history actual sync failed: ' + actualSyncError.toString());
    }

    try {
      refreshRollManagementView();
      refreshFieldRollManagementView();
    } catch (refreshError) {
      Logger.log('handleRollHistoryStatusEdit view refresh failed: ' + refreshError.toString());
    }

    sheet.getParent().toast(roleName + ' を「' + nextStatus + '」へ変更しました。', 'アプリ連動ステータス', 5);
    return {
      handled: true,
      updated: true,
      roleName: roleName,
      status: nextStatus,
      updatedRoleNames: result.updatedRoleNames
    };
  } catch (error) {
    restoreFormula();
    Logger.log('handleRollHistoryStatusEdit failed: ' + error.toString());
    sheet.getParent().toast(error.message || String(error), 'ステータス変更を取り消しました', 10);
    return { handled: true, updated: false, reason: error.message || String(error) };
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function applyRollHistoryStatusChangeToRoles(roles, roleName, nextStatus, changedAt, today) {
  const normalizedRoleName = String(roleName || '').trim();
  const normalizedStatus = String(nextStatus || '').trim();
  if (STATUS_OPTIONS.indexOf(normalizedStatus) < 0) {
    throw new Error('許可されていないステータスです。');
  }

  const roleList = JSON.parse(JSON.stringify(Array.isArray(roles) ? roles : []));
  const target = roleList.find(function(role) {
    return String(role && role.name || '').trim() === normalizedRoleName;
  });
  if (!target) throw new Error(normalizedRoleName + ' がRolesに見つかりません。');

  const beforeStatus = String(target.status || '').trim();
  if (beforeStatus === normalizedStatus) {
    return { changed: false, roles: roleList, updatedRoleNames: [] };
  }

  const standNumber = getRollManagementViewStandInfo(target.name).number;
  const standRoles = roleList.filter(function(role) {
    return getRollManagementViewStandInfo(role && role.name).number === standNumber;
  });
  const otherOnlineRoles = standRoles.filter(function(role) {
    return String(role && role.name || '').trim() !== normalizedRoleName
      && String(role && role.status || '').trim() === 'オンライン';
  });
  const updatedRoleNames = [];
  const eventAt = String(changedAt || new Date().toISOString());
  const useDate = String(today || '').trim();

  if (beforeStatus === 'オンライン' && normalizedStatus !== 'オンライン' && otherOnlineRoles.length === 0) {
    throw new Error('この変更では#' + standNumber + 'stのオンラインが0本になるため取り消しました。先に次のオンラインを指定してください。');
  }

  let exchangedOldRole = null;
  if (normalizedStatus === 'オンライン' && beforeStatus !== 'オンライン') {
    if (otherOnlineRoles.length >= 2) {
      throw new Error('#' + standNumber + 'stのオンラインが重複しています。先に異常を解消してください。');
    }
    const activeCount = standRoles.filter(function(role) {
      return normalizeBooleanForFieldRollManagement(role && role.isActiveThreeSet);
    }).length;
    if (!normalizeBooleanForFieldRollManagement(target.isActiveThreeSet) && activeCount >= 3) {
      throw new Error('#' + standNumber + 'stの運用3セット対象が既に3本です。アプリ側で対象ロールを確認してください。');
    }

    exchangedOldRole = otherOnlineRoles[0] || null;
    if (exchangedOldRole) {
      const oldStatus = exchangedOldRole.status;
      const oldUseEndDate = exchangedOldRole.useEndDate || '';
      exchangedOldRole.status = '中古予備（バラシ前）';
      exchangedOldRole.useEndDate = useDate;
      exchangedOldRole.nextAssemblyPlanned = false;
      exchangedOldRole.updatedAt = eventAt;
      appendRollHistoryStatusEntry(exchangedOldRole, 'status', 'ステータス変更', oldStatus, exchangedOldRole.status, eventAt);
      appendRollHistoryStatusEntry(exchangedOldRole, 'useEndDate', '使用終了日設定', oldUseEndDate, useDate, eventAt);
      appendRollHistoryStatusEntry(exchangedOldRole, 'onlineExchange', 'オンライン交代', exchangedOldRole.name, target.name, eventAt, true);
      updatedRoleNames.push(String(exchangedOldRole.name));
    }

    const beforeUseStartDate = target.useStartDate || '';
    target.status = 'オンライン';
    target.isActiveThreeSet = true;
    target.nextAssemblyPlanned = false;
    target.useStartDate = useDate;
    target.useEndDate = '';
    target.updatedAt = eventAt;
    appendRollHistoryStatusEntry(target, 'status', 'ステータス変更', beforeStatus, normalizedStatus, eventAt);
    appendRollHistoryStatusEntry(target, 'useStartDate', '使用開始日設定', beforeUseStartDate, useDate, eventAt);
    appendRollHistoryStatusEntry(target, 'onlineExchange', 'オンライン交代', exchangedOldRole ? exchangedOldRole.name : '-', target.name, eventAt, true);
  } else {
    target.status = normalizedStatus;
    target.updatedAt = eventAt;
    appendRollHistoryStatusEntry(target, 'status', 'ステータス変更（ロール管理表）', beforeStatus, normalizedStatus, eventAt);
  }

  updatedRoleNames.push(normalizedRoleName);
  return {
    changed: true,
    roles: roleList,
    updatedRoleNames: Array.from(new Set(updatedRoleNames)),
    onlineExchange: Boolean(exchangedOldRole)
  };
}

function appendRollHistoryStatusEntry(role, type, label, beforeValue, afterValue, eventAt, force) {
  if (!role || (!force && String(beforeValue || '') === String(afterValue || ''))) return;
  const history = parseHistory(role.history);
  history.push({
    at: eventAt,
    roleName: role.name,
    type: type,
    label: label,
    before: beforeValue || '-',
    after: afterValue || '-',
    operator: ROLL_HISTORY_STATUS_OPERATOR
  });
  role.history = history;
}

function updateChangedRolesRows(roles, updatedRoleNames) {
  const rolesSheet = getSheet();
  const values = rolesSheet.getDataRange().getValues();
  const rowByName = new Map();
  values.slice(1).forEach(function(row, index) {
    rowByName.set(String(row[1] || '').trim(), index + 2);
  });
  const roleByName = new Map((Array.isArray(roles) ? roles : []).map(function(role) {
    return [String(role && role.name || '').trim(), role];
  }));

  (updatedRoleNames || []).forEach(function(roleName) {
    const rowNumber = rowByName.get(roleName);
    const role = roleByName.get(roleName);
    if (!rowNumber || !role) throw new Error(roleName + ' のRoles行を更新できませんでした。');
    rolesSheet.getRange(rowNumber, 1, 1, HEADER_VALUES.length).setValues([buildRoleRowForSheet(role)]);
  });
}

function initializePairedRollManagementViews() {
  throw new Error('この簡易生成処理は廃止しました。最新ExcelをGoogle Sheetsへ変換し、importRollHistorySheetsFromSource を使用してください。');
}

function refreshPairedRollManagementViews(roles) {
  throw new Error('この簡易生成処理は廃止しました。最新Excelの履歴シートを使用してください。');
  /* istanbul ignore next */
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const roleList = Array.isArray(roles) ? roles : fetchRoles();
  const standMasterByNumber = buildPairedRollStandMasterMap(fetchStandMaster());
  const cuttingMasterByNumber = buildPairedRollCuttingMasterMap(fetchCuttingMaster());
  const results = PAIRED_ROLL_MANAGEMENT_VIEW_DEFINITIONS.map(function(definition) {
    let sheet = ss.getSheetByName(definition.sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(definition.sheetName);
    }

    const data = buildPairedRollManagementViewData(
      roleList,
      definition,
      standMasterByNumber,
      cuttingMasterByNumber
    );
    writePairedRollManagementView(sheet, definition, data);

    return {
      sheetName: definition.sheetName,
      leftStand: definition.leftStand,
      rightStand: definition.rightStand,
      leftCount: data.leftEntries.length,
      rightCount: data.rightEntries.length
    };
  });

  return {
    success: true,
    action: 'refresh-paired-roll-management-views',
    sheetCount: results.length,
    sheets: results
  };
}

function buildPairedRollStandMasterMap(rows) {
  const result = {};
  (Array.isArray(rows) ? rows : []).forEach(function(item) {
    const standNumber = getPairedRollStandNumber(item && item.stand);
    if (standNumber) result[standNumber] = item;
  });
  return result;
}

function buildPairedRollCuttingMasterMap(rows) {
  const result = {};
  (Array.isArray(rows) ? rows : []).forEach(function(item) {
    const standNumber = getPairedRollStandNumber(item && item.stand);
    if (standNumber) result[standNumber] = item;
  });
  return result;
}

function getPairedRollStandNumber(value) {
  const match = String(value == null ? '' : value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function buildPairedRollManagementViewData(roles, definition, standMasterByNumber, cuttingMasterByNumber) {
  const leftEntries = buildPairedRollManagementStandEntries(
    roles,
    definition.leftStand,
    cuttingMasterByNumber[definition.leftStand]
  );
  const rightEntries = buildPairedRollManagementStandEntries(
    roles,
    definition.rightStand,
    cuttingMasterByNumber[definition.rightStand]
  );
  const rowCount = Math.max(leftEntries.length, rightEntries.length, 1);
  const totalColumns = PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND * 2
    + PAIRED_ROLL_MANAGEMENT_SPACER_COLUMNS;
  const values = [];

  for (let index = 0; index < rowCount; index += 1) {
    const left = leftEntries[index];
    const right = rightEntries[index];
    values.push(
      (left ? left.values : new Array(PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND).fill(''))
        .concat(new Array(PAIRED_ROLL_MANAGEMENT_SPACER_COLUMNS).fill(''))
        .concat(right ? right.values : new Array(PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND).fill(''))
    );
  }

  return {
    values: values,
    rowCount: rowCount,
    totalColumns: totalColumns,
    leftEntries: leftEntries,
    rightEntries: rightEntries,
    leftTitle: buildPairedRollManagementStandTitle(definition.leftStand, standMasterByNumber[definition.leftStand]),
    rightTitle: buildPairedRollManagementStandTitle(definition.rightStand, standMasterByNumber[definition.rightStand])
  };
}

function buildPairedRollManagementStandEntries(roles, standNumber, cuttingMaster) {
  return (Array.isArray(roles) ? roles : [])
    .filter(function(role) {
      return getRollManagementViewStandInfo(role && role.name).number === standNumber;
    })
    .sort(function(a, b) {
      return compareStandRoleNamesForSheet(a && a.name, b && b.name);
    })
    .map(function(role) {
      return buildPairedRollManagementStandEntry(role, cuttingMaster);
    });
}

function buildPairedRollManagementStandEntry(role, cuttingMaster) {
  const workProgress = parseWorkProgress(role && role.workProgress);
  const dispatchDate = normalizeRollManagementViewDate(workProgress.dispatchDate);
  const arrivalDate = normalizeRollManagementViewDate(workProgress.arrivalDate);
  const plannedArrivalDate = !arrivalDate && dispatchDate
    ? addDaysForRollManagementView(dispatchDate, ROLL_MANAGEMENT_VIEW_INBOUND_PLAN_DAYS)
    : '';
  const useCycleDates = getRollManagementViewUseCycleDates(role, dispatchDate);
  const currentDiameter = normalizeCurrentDiameterForSheet(role && role.currentDiameter);
  const plannedDiameter = calculatePairedRollPlannedDiameter(role, cuttingMaster, currentDiameter);

  return {
    values: [
      normalizeTextForSheet(role && role.name),
      normalizeTextForSheet(role && role.status),
      formatRollManagementViewDate(dispatchDate),
      arrivalDate
        ? formatRollManagementViewDate(arrivalDate)
        : (plannedArrivalDate ? formatRollManagementViewDate(plannedArrivalDate) + '予' : ''),
      currentDiameter,
      formatRollManagementViewDate(useCycleDates.useStartDate),
      formatRollManagementViewDate(useCycleDates.useEndDate),
      plannedDiameter,
      normalizeTextForSheet(role && role.memo)
    ],
    status: normalizeTextForSheet(role && role.status),
    plannedArrival: Boolean(plannedArrivalDate),
    hasPlannedDiameter: plannedDiameter !== ''
  };
}

function calculatePairedRollPlannedDiameter(role, cuttingMaster, currentDiameter) {
  const status = String(role && role.status || '').trim();
  const isReworkTarget = status === '改削行き（搬出可能）' || status === '改削中';
  const current = Number(currentDiameter);
  const calculationCutMm = cuttingMaster && cuttingMaster.active !== false
    ? normalizeStandMasterNumericValue(cuttingMaster.calculationCutMm)
    : '';
  const standardCutMm = cuttingMaster
    ? normalizeStandMasterNumericValue(cuttingMaster.standardCutMm)
    : '';
  const adoptedCutMm = calculationCutMm !== '' ? calculationCutMm : standardCutMm;
  const cut = Number(adoptedCutMm);

  if (!isReworkTarget || currentDiameter === '' || adoptedCutMm === '' || !Number.isFinite(current) || !Number.isFinite(cut)) {
    return '';
  }

  return Math.round((current - cut) * 100) / 100;
}

function buildPairedRollManagementStandTitle(standNumber, standMaster) {
  const parts = ['#' + standNumber + ' ST'];
  const newDiameter = normalizeStandMasterNumericValue(standMaster && standMaster.newDiameter);
  const scrapDiameter = normalizeStandMasterNumericValue(standMaster && standMaster.scrapDiameter);
  if (newDiameter !== '') parts.push('新径 Φ' + newDiameter);
  if (scrapDiameter !== '') parts.push('廃却径 Φ' + scrapDiameter);
  return parts.join('　');
}

function writePairedRollManagementView(sheet, definition, data) {
  const leftStartColumn = 1;
  const rightStartColumn = PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND
    + PAIRED_ROLL_MANAGEMENT_SPACER_COLUMNS + 1;
  const maxRows = sheet.getMaxRows();
  const maxColumns = sheet.getMaxColumns();

  sheet.getRange(1, 1, maxRows, maxColumns).breakApart();
  sheet.clear();
  sheet.setConditionalFormatRules([]);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(3);

  const headerValues = new Array(3).fill(null).map(function() {
    return new Array(data.totalColumns).fill('');
  });
  setPairedRollManagementHeaderValues(headerValues, leftStartColumn, data.leftTitle);
  setPairedRollManagementHeaderValues(headerValues, rightStartColumn, data.rightTitle);
  sheet.getRange(1, 1, 3, data.totalColumns).setValues(headerValues);
  mergePairedRollManagementHeaders(sheet, leftStartColumn);
  mergePairedRollManagementHeaders(sheet, rightStartColumn);

  sheet.getRange(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, 1, data.rowCount, data.totalColumns)
    .setValues(data.values);
  applyPairedRollManagementFormatting(sheet, definition, data, leftStartColumn, rightStartColumn);
}

function setPairedRollManagementHeaderValues(rows, startColumn, title) {
  const offset = startColumn - 1;
  rows[0][offset] = title;
  rows[1][offset] = PAIRED_ROLL_MANAGEMENT_HEADERS[0];
  rows[1][offset + 1] = PAIRED_ROLL_MANAGEMENT_HEADERS[1];
  rows[1][offset + 2] = '修削';
  rows[1][offset + 4] = 'ロール径';
  rows[1][offset + 5] = '圧延期間';
  rows[1][offset + 7] = '予定径';
  rows[1][offset + 8] = PAIRED_ROLL_MANAGEMENT_HEADERS[8];
  rows[2][offset + 2] = PAIRED_ROLL_MANAGEMENT_HEADERS[2];
  rows[2][offset + 3] = PAIRED_ROLL_MANAGEMENT_HEADERS[3];
  rows[2][offset + 5] = PAIRED_ROLL_MANAGEMENT_HEADERS[5];
  rows[2][offset + 6] = PAIRED_ROLL_MANAGEMENT_HEADERS[6];
}

function mergePairedRollManagementHeaders(sheet, startColumn) {
  sheet.getRange(1, startColumn, 1, PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND).merge();
  sheet.getRange(2, startColumn, 2, 1).merge();
  sheet.getRange(2, startColumn + 1, 2, 1).merge();
  sheet.getRange(2, startColumn + 2, 1, 2).merge();
  sheet.getRange(2, startColumn + 4, 2, 1).merge();
  sheet.getRange(2, startColumn + 5, 1, 2).merge();
  sheet.getRange(2, startColumn + 7, 2, 1).merge();
  sheet.getRange(2, startColumn + 8, 2, 1).merge();
}

function applyPairedRollManagementFormatting(sheet, definition, data, leftStartColumn, rightStartColumn) {
  const headerRange = sheet.getRange(1, 1, 3, data.totalColumns);
  const dataRange = sheet.getRange(
    PAIRED_ROLL_MANAGEMENT_DATA_START_ROW,
    1,
    data.rowCount,
    data.totalColumns
  );

  headerRange
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontWeight('bold');
  sheet.getRange(1, leftStartColumn, 1, PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND)
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setFontSize(13);
  sheet.getRange(1, rightStartColumn, 1, PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND)
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setFontSize(13);
  sheet.getRange(2, leftStartColumn, 2, PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND)
    .setBackground('#d9e2f3')
    .setBorder(true, true, true, true, true, true, '#7f8c8d', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(2, rightStartColumn, 2, PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND)
    .setBackground('#d9e2f3')
    .setBorder(true, true, true, true, true, true, '#7f8c8d', SpreadsheetApp.BorderStyle.SOLID);

  const backgrounds = [];
  for (let index = 0; index < data.rowCount; index += 1) {
    const left = data.leftEntries[index];
    const right = data.rightEntries[index];
    const leftColor = left ? (ROLL_MANAGEMENT_VIEW_STATUS_COLORS[left.status] || '#ffffff') : '#ffffff';
    const rightColor = right ? (ROLL_MANAGEMENT_VIEW_STATUS_COLORS[right.status] || '#ffffff') : '#ffffff';
    backgrounds.push(
      new Array(PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND).fill(leftColor)
        .concat(['#ffffff'])
        .concat(new Array(PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND).fill(rightColor))
    );
  }
  dataRange
    .setBackgrounds(backgrounds)
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#a6a6a6', SpreadsheetApp.BorderStyle.SOLID);

  for (let index = 0; index < data.rowCount; index += 1) {
    const rowNumber = PAIRED_ROLL_MANAGEMENT_DATA_START_ROW + index;
    sheet.getRange(rowNumber, leftStartColumn, 1, PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND)
      .setBorder(null, null, true, null, null, null, '#f4b183', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(rowNumber, rightStartColumn, 1, PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND)
      .setBorder(null, null, true, null, null, null, '#f4b183', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    const left = data.leftEntries[index];
    const right = data.rightEntries[index];
    if (left && left.plannedArrival) sheet.getRange(rowNumber, leftStartColumn + 3).setFontColor(ROLL_MANAGEMENT_VIEW_PLANNED_FONT_COLOR);
    if (right && right.plannedArrival) sheet.getRange(rowNumber, rightStartColumn + 3).setFontColor(ROLL_MANAGEMENT_VIEW_PLANNED_FONT_COLOR);
    if (left && left.hasPlannedDiameter) sheet.getRange(rowNumber, leftStartColumn + 7).setFontColor('#1f4e78').setFontWeight('bold');
    if (right && right.hasPlannedDiameter) sheet.getRange(rowNumber, rightStartColumn + 7).setFontColor('#1f4e78').setFontWeight('bold');
  }

  [leftStartColumn, rightStartColumn].forEach(function(startColumn) {
    sheet.getRange(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, startColumn, data.rowCount, 2)
      .setHorizontalAlignment('center');
    sheet.getRange(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, startColumn + 2, data.rowCount, 6)
      .setHorizontalAlignment('center');
    sheet.getRange(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, startColumn + 4, data.rowCount, 1)
      .setNumberFormat('0.00');
    sheet.getRange(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, startColumn + 7, data.rowCount, 1)
      .setNumberFormat('0.00');
    sheet.getRange(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, startColumn + 1, data.rowCount, 1).setWrap(true);
    sheet.getRange(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, startColumn + 8, data.rowCount, 1).setWrap(true);
  });

  const widths = [126, 180, 84, 84, 84, 94, 94, 94, 250];
  [leftStartColumn, rightStartColumn].forEach(function(startColumn) {
    widths.forEach(function(width, index) {
      sheet.setColumnWidth(startColumn + index, width);
    });
  });
  sheet.setColumnWidth(PAIRED_ROLL_MANAGEMENT_COLUMNS_PER_STAND + 1, 18);
  sheet.setRowHeight(1, 32);
  sheet.setRowHeights(2, 2, 26);
  sheet.setRowHeights(PAIRED_ROLL_MANAGEMENT_DATA_START_ROW, data.rowCount, 30);
  sheet.setTabColor('#5b9bd5');
}

function getRollHistoryActualChangedRoleNames(beforeRoles, afterRoles) {
  const beforeMap = new Map((Array.isArray(beforeRoles) ? beforeRoles : []).map(function(role) {
    return [String(role && role.name || '').trim(), role];
  }));
  return (Array.isArray(afterRoles) ? afterRoles : []).filter(function(role) {
    const roleName = String(role && role.name || '').trim();
    if (!roleName || !getRollHistorySheetNameForStandNumber(getRollManagementViewStandInfo(roleName).number)) return false;
    const beforeRole = beforeMap.get(roleName);
    if (!beforeRole) return true;
    const beforeSnapshot = normalizeRollHistoryActualSnapshot(beforeRole);
    const afterSnapshot = normalizeRollHistoryActualSnapshot(role);
    const standNumber = getRollManagementViewStandInfo(roleName).number;
    const actualChanged = getRollHistoryActualFieldNamesForStand(standNumber).some(function(fieldName) {
      const beforeValue = beforeSnapshot[fieldName];
      const afterValue = afterSnapshot[fieldName];
      if ((beforeValue === '' || beforeValue === undefined) && (afterValue === '' || afterValue === undefined)) return false;
      return !rollHistoryActualValuesEqual(fieldName, beforeValue, afterValue);
    });
    return actualChanged
      || normalizeBooleanForFieldRollManagement(beforeRole.isActiveThreeSet)
        !== normalizeBooleanForFieldRollManagement(role.isActiveThreeSet);
  }).map(function(role) {
    return String(role.name || '').trim();
  });
}

function writeRoles(roles) {
  const sheet = getSheet();
  const previousRoles = fetchRoles();
  const changedActualRoleNames = getRollHistoryActualChangedRoleNames(previousRoles, roles);
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
    SpreadsheetApp.flush();
    const actualSyncResult = changedActualRoleNames.length > 0
      ? syncRollHistoryActualsFromRoles(sortedRoles, changedActualRoleNames)
      : { sheetNames: [], written: [], unchanged: [], conflicts: [], warnings: [], skipped: [] };
    Logger.log('writeRoles: history actuals updated: ' + JSON.stringify(actualSyncResult));
  } catch (actualSyncError) {
    Logger.log('writeRoles: history actual sync failed: ' + actualSyncError.toString());
  }

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
  sheet.getRange(1, 3).setNote('オンラインを通常編集で外すと、対象スタンドがオンライン未設定になる危険があります。交代はアプリの「オンライン交代」を使用してください。');
  sheet.getRange(1, 15).setNote('運用3セット対象のオンラインからチェックを外すと、オンライン未設定になる危険があります。現場表の警告を確認してください。');
  sheet.getRange(1, 16).setNote('次回組み込み予定はオンライン交代時に解除されます。オンライン状態はステータス列と運用3セット列で決まります。');
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
