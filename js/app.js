console.log("STATUS FILTER VERSION 6");
const CORRECT_PASSWORD = '1234';
const CURRENT_OPERATOR_KEY = 'currentOperator';
const OPERATORS = [
    { id: 'hiwatashi', name: '樋渡' },
    { id: 'ohno', name: '大野' }
];
const MOBILE_LAYOUT_MAX_WIDTH = 767;
const MOBILE_NARROW_MAX_WIDTH = 360;
const REWORK_JUDGMENT_AVERAGE_CUT_MM = 7;
const REWORK_JUDGMENT_SCRAP_DIAMETERS = {
    2: 400,
    3: 400,
    4: 400,
    5: 400
};
const WORKSHOP_BOARD_REPLACEMENT_DAYS = 90;
const WORKSHOP_BOARD_PRIORITY_THRESHOLD_DAYS = {
    high: 30,
    medium: 60
};
const WORKSHOP_BOARD_PRIORITY_LABELS = {
    high: '高',
    medium: '中',
    low: '低'
};
const WORKSHOP_BOARD_PRIORITY_ORDER = {
    high: 1,
    medium: 2,
    low: 3
};
const TODAY_TASK_DASHBOARD_OPEN_KEY = 'todayTaskDashboardOpen';
const THREE_SET_FORECAST_DASHBOARD_OPEN_KEY = 'threeSetForecastDashboardOpen';
const REWORK_SETUP_DASHBOARD_OPEN_KEY = 'reworkSetupDashboardOpen';
const CUTTING_ANOMALY_DASHBOARD_OPEN_KEY = 'cuttingAnomalyDashboardOpen';
const DANGER_ROLL_DASHBOARD_OPEN_KEY = 'dangerRollDashboardOpen';
const FUTURE_WORK_DASHBOARD_OPEN_KEY = 'futureWorkDashboardOpen';
const PURCHASE_CONFIRMATION_DASHBOARD_OPEN_KEY = 'purchaseConfirmationDashboardOpen';
const COUNT_SUMMARY_OPEN_KEY = 'countSummaryOpen';
const DEFAULT_PURCHASE_LEAD_TIME_MONTHS = 6;
const PURCHASE_CONFIRMATION_WINDOW_MONTHS = 3;
const THREE_SET_MANAGEMENT_PURCHASE_DECISION_MONTHS = 8;
const REWORK_SETUP_TASK_LEAD_DAYS = 21;
const REWORK_SETUP_DISPATCH_READY_DAYS = 2;
const REWORK_SETUP_REWORK_DAYS = 30;
const REWORK_SETUP_DISPLAY_WINDOW_DAYS = 30;
const THREE_SET_FORECAST_MIN_STAND = 2;
const THREE_SET_FORECAST_MAX_STAND = 17;
const DASHBOARD_DISPLAY_SETTINGS_OPEN_KEY = 'dashboardDisplaySettingsOpen';
const DASHBOARD_VISIBILITY_STORAGE_PREFIX = 'dashboardVisibility.';
const THREE_SET_MANAGEMENT_ACTIVE_TAB_KEY = 'threeSetManagementActiveTab';
const THREE_SET_MANAGEMENT_REWORK_CHECKLIST_KEY = 'threeSetManagementReworkChecklist';
const THREE_SET_MANAGEMENT_PURCHASE_EXPANDED_STANDS_KEY = 'threeSetManagementPurchaseExpandedStands';
const THREE_SET_MANAGEMENT_DEFAULT_TAB = 'assembly';
const DASHBOARD_VISIBILITY_OPTIONS = [
    {
        key: 'priorityStand',
        label: '最優先確認',
        targetId: 'priority-stand-panel',
        inputId: 'dashboard-visibility-priority-stand',
        defaultVisible: false
    },
    {
        key: 'standRisk',
        label: 'スタンド別リスク',
        targetId: 'stand-risk-panel',
        inputId: 'dashboard-visibility-stand-risk',
        defaultVisible: false
    },
    {
        key: 'dangerRoll',
        label: '危険ロール一覧',
        targetId: 'danger-roll-dashboard',
        inputId: 'dashboard-visibility-danger-roll',
        defaultVisible: false
    },
    {
        key: 'threeSetForecast',
        label: '3セット維持予測',
        targetId: 'three-set-forecast-dashboard',
        inputId: 'dashboard-visibility-three-set-forecast',
        defaultVisible: false
    },
    {
        key: 'reworkSetup',
        label: '改削段取り予定',
        targetId: 'rework-setup-dashboard',
        inputId: 'dashboard-visibility-rework-setup',
        defaultVisible: false
    },
    {
        key: 'purchaseConfirmation',
        label: '購入確認候補',
        targetId: 'purchase-confirmation-board',
        inputId: 'dashboard-visibility-purchase-confirmation',
        defaultVisible: false
    },
    {
        key: 'futureWork',
        label: '未来作業依頼',
        targetId: 'incomplete-work-dashboard',
        inputId: 'dashboard-visibility-future-work',
        defaultVisible: false
    },
    {
        key: 'cuttingAnomaly',
        label: '改削異常チェック',
        targetId: 'cutting-anomaly-dashboard',
        inputId: 'dashboard-visibility-cutting-anomaly',
        defaultVisible: true
    }
];

function getEffectiveViewportWidth() {
    const widths = [
        window.innerWidth,
        document.documentElement ? document.documentElement.clientWidth : null,
        window.visualViewport ? window.visualViewport.width : null,
        window.screen ? window.screen.width : null,
        window.screen ? window.screen.availWidth : null
    ]
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value > 0);

    return widths.length > 0 ? Math.min(...widths) : window.innerWidth;
}

function applyResponsiveLayoutMode() {
    const width = getEffectiveViewportWidth();
    document.body.classList.toggle('mobile-layout', width <= MOBILE_LAYOUT_MAX_WIDTH);
    document.body.classList.toggle('mobile-narrow-layout', width <= MOBILE_NARROW_MAX_WIDTH);
}

// ログイン状態チェック
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');

    if (isLoggedIn) {
        loginScreen.style.display = 'none';
        mainScreen.style.display = 'block';
        setupOperatorSelect();
        loadLocalRoles();
        renderRoles();
        if (isRemoteConfigured()) {
            loadRemoteRoles();
            Promise.all([loadStandMaster(), loadCuttingMaster()]).then(() => renderRoles());
        }
    } else {
        loginScreen.style.display = 'flex';
        mainScreen.style.display = 'none';
    }
}

// ログイン関数
function login() {
    const password = document.getElementById('password-input').value;
    if (password === CORRECT_PASSWORD) {
        localStorage.setItem('isLoggedIn', 'true');
        checkLoginStatus();
        document.getElementById('password-input').value = ''; // パスワード入力クリア
    } else {
        alert('パスワードが間違っています');
        document.getElementById('password-input').value = '';
        document.getElementById('password-input').focus();
    }
}

// ログアウト関数
function logout() {
    if (confirm('ログアウトしますか？')) {
        localStorage.removeItem('isLoggedIn');
        checkLoginStatus();
    }
}

// Enterキーでログイン
document.addEventListener('DOMContentLoaded', function() {
    applyResponsiveLayoutMode();
    applyTabletModePreference();
    installSyncDiagnosticHeaderIntegration();
    updateSyncStatusBadge();
    setupOperatorSelect();
    setupCountSummaryToggle();
    setupDashboardDisplaySettings();
    loadRemoteRoles();
    Promise.all([loadStandMaster(), loadCuttingMaster()]).then(() => renderRoles());
    document.getElementById('password-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    const roleStatusSelect = document.getElementById('role-status');
    if (roleStatusSelect) {
        updateStatusPreview(roleStatusSelect);
        roleStatusSelect.addEventListener('change', function(e) {
            updateStatusPreview(e.target);
        });
    }
    setRoleFormOpen(false);
    applyDashboardVisibilitySettings();
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDetailModal();
            closeSyncStatusPopup();
        }
    });
    applyAdminMode(false);
    updatePageScrollButton();
});

window.addEventListener('online', updateSyncStatusBadge);
window.addEventListener('offline', updateSyncStatusBadge);
window.addEventListener('load', applyResponsiveLayoutMode);
window.addEventListener('load', updatePageScrollButton);
window.addEventListener('scroll', updatePageScrollButton, { passive: true });
window.addEventListener('resize', function() {
    applyResponsiveLayoutMode();
    updatePageScrollButton();
});
window.addEventListener('orientationchange', function() {
    applyResponsiveLayoutMode();
    updatePageScrollButton();
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
        applyResponsiveLayoutMode();
        updatePageScrollButton();
    });
}

function getStoredOperator() {
    try {
        const value = JSON.parse(localStorage.getItem(CURRENT_OPERATOR_KEY) || 'null');
        if (!value || typeof value !== 'object') {
            return null;
        }

        return OPERATORS.find(operator => operator.id === value.id) || null;
    } catch (error) {
        console.error('getStoredOperator error:', error);
        return null;
    }
}

function saveCurrentOperator(operatorId) {
    const operator = OPERATORS.find(item => item.id === operatorId);

    if (!operator) {
        localStorage.removeItem(CURRENT_OPERATOR_KEY);
        return null;
    }

    localStorage.setItem(CURRENT_OPERATOR_KEY, JSON.stringify(operator));
    return operator;
}

function getCurrentOperator() {
    const select = document.getElementById('operator-select');
    const selectedId = select ? select.value : '';
    return OPERATORS.find(operator => operator.id === selectedId) || getStoredOperator();
}

function getSelectedOperator() {
    const select = document.getElementById('operator-select');
    const selectedId = select ? select.value : '';
    return OPERATORS.find(operator => operator.id === selectedId) || null;
}

function focusOperatorSelect() {
    const select = document.getElementById('operator-select');

    if (!select) {
        return;
    }

    const target = select.closest('.operator-select-wrap') || select;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    select.focus({ preventScroll: true });
    target.classList.add('is-operator-attention');

    window.setTimeout(() => {
        target.classList.remove('is-operator-attention');
    }, 1600);
}

function getHistoryOperator() {
    const operator = getCurrentOperator();

    if (!operator) {
        return null;
    }

    return {
        id: operator.id,
        name: operator.name
    };
}

function getOperatorNameForDisplay(entry) {
    const operator = entry && entry.operator;

    if (operator && typeof operator === 'object' && operator.name) {
        return operator.name;
    }

    if (typeof operator === 'string' && operator.trim()) {
        return operator.trim();
    }

    return '-';
}

function warnIfOperatorMissing() {
    if (getSelectedOperator()) {
        return false;
    }

    alert('担当者を選択してください');
    focusOperatorSelect();
    setSyncMessage('担当者を選択してください', true);
    if (typeof showToast === 'function') {
        showToast('担当者を選択してください');
    }
    return true;
}

function setupOperatorSelect() {
    const select = document.getElementById('operator-select');

    if (!select) {
        return;
    }

    const selected = getStoredOperator();
    select.innerHTML = [
        '<option value="">選択してください</option>',
        ...OPERATORS.map(operator => `<option value="${operator.id}">${operator.name}</option>`)
    ].join('');
    select.value = selected ? selected.id : '';
}

function changeOperator(event) {
    const operator = saveCurrentOperator(event.target.value);

    if (operator) {
        setSyncMessage(`担当者: ${operator.name}`);
    } else {
        setSyncMessage('担当者を選択してください', true);
    }
}

const ALLOWED_STATUSES = [
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

const REWORK_READY_STATUS = '改削行き（搬出可能）';
const LEGACY_SCRAP_WAITING_STATUS = '廃却待ち';
const SCRAP_WAITING_STATUS = '廃却待ち（ラック保管）';
const DISCARDED_STATUS = '廃棄';
const REWORKING_STATUS = '改削中';
const USED_STANDBY_STATUS = '中古予備（バラシ前）';
const NEW_READY_STATUS = '新品予備（組替可能）';
const NEW_INSTALLED_STATUS = '新品予備（組込完了）';
const NEW_STORAGE_STATUS = '新品予備保管';
const ONLINE_STATUS = 'オンライン';
const COATING_STATUS_OPTIONS = {
    coated: '溶射有り',
    uncoated: '溶射無し'
};
const UNCOATED_STATUS = 'uncoated';
const REWORKING_CONFIRM_THRESHOLD_DAYS = 25;
const PICKUP_ADJUSTED_STEP_KEY = 'pickupAdjustedAt';
const TEMP_INBOUND_PLAN_DAYS = 25;
const TASK_PRIORITY_LABELS = {
    high: '高優先',
    medium: '中優先',
    low: '低優先'
};
const TASK_PRIORITY_ORDER = {
    high: 1,
    medium: 2,
    low: 3
};
const WORK_REQUEST_ACTION_LABEL = '作業依頼';
const REWORK_CHECKLIST_STEPS = [
    { key: 'requestFormCreatedAt', label: '改削依頼書作成' },
    { key: 'sealConfirmedAt', label: '押印確認' },
    { key: 'pdfCreatedAt', label: 'PDF化' },
    { key: 'vendorSentAt', label: '業者へ送信' },
    { key: 'vendorContactedAt', label: '業者連絡' },
    { key: 'pickupAdjustedAt', label: '引き取り日調整' }
];
const WORK_PROGRESS_STEPS = REWORK_CHECKLIST_STEPS;
const THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS = REWORK_CHECKLIST_STEPS;
const LEGACY_REWORK_CHECKLIST_STEP_KEYS = {
    requestForm: 'requestFormCreatedAt',
    sealConfirmed: 'sealConfirmedAt',
    pdfCreated: 'pdfCreatedAt',
    vendorSent: 'vendorSentAt',
    vendorContacted: 'vendorContactedAt',
    pickupAdjusted: 'pickupAdjustedAt'
};

function normalizeRoleStatusValue(status) {
    const normalizedStatus = String(status || '');

    if (normalizedStatus === LEGACY_SCRAP_WAITING_STATUS) {
        return SCRAP_WAITING_STATUS;
    }

    return ALLOWED_STATUSES.includes(normalizedStatus) ? normalizedStatus : '中古予備（バラシ前）';
}

function normalizeCoatingStatusValue(value, status = NEW_STORAGE_STATUS) {
    const normalizedStatus = normalizeRoleStatusValue(status);
    const normalizedValue = String(value || '').trim();

    if (normalizedStatus !== NEW_STORAGE_STATUS) {
        return '';
    }

    return Object.prototype.hasOwnProperty.call(COATING_STATUS_OPTIONS, normalizedValue)
        ? normalizedValue
        : '';
}

function getCoatingStatusLabel(value) {
    return COATING_STATUS_OPTIONS[normalizeCoatingStatusValue(value)] || '未設定';
}

function getCoatingStatusDisplay(role) {
    if (!role || normalizeRoleStatusValue(role.status) !== NEW_STORAGE_STATUS) {
        return null;
    }

    const coatingStatus = normalizeCoatingStatusValue(role.coatingStatus, role.status);

    if (!coatingStatus) {
        return null;
    }

    return {
        key: coatingStatus,
        label: getCoatingStatusLabel(coatingStatus),
        note: coatingStatus === UNCOATED_STATUS ? '溶射搬出必要' : '',
        isWarning: coatingStatus === UNCOATED_STATUS
    };
}

let roles = [];
let nextId = 1;
let searchQuery = '';
let statusFilter = 'all';
let watchStandFilter = null;
let sortOption = 'name';
let editingId = null; // 編集中のID
let lastScrollY = 0;
let updatedRoleId = null;
let isWorkshopBoardOpen = false;
let workshopBoardSortOption = 'stand';
let cuttingMasterRows = [];
let cuttingMasterByStand = new Map();
const RENDER_STATUS_DEBUG_ROLE_NAME = '#11-44';

function getDebugRoleSnapshot(role) {
    if (!role) {
        return null;
    }

    return {
        id: role.id,
        name: role.name,
        status: role.status
    };
}

function findDebugRoleIndex(roleList, roleName = '#11-44') {
    return (Array.isArray(roleList) ? roleList : []).findIndex(role => String(role.name || '') === roleName);
}

function getDebugRoleSlice(roleList, startIndex, count = 5) {
    if (!Array.isArray(roleList) || startIndex < 0) {
        return [];
    }

    return roleList.slice(startIndex, startIndex + count).map(getDebugRoleSnapshot);
}

function logRenderStatusDebug(roleList, roleName = RENDER_STATUS_DEBUG_ROLE_NAME) {
    const role = (Array.isArray(roleList) ? roleList : []).find(item => String(item && item.name || '') === roleName);

    console.log(`RENDER_STATUS:\n${roleName}\n${role ? role.status : 'NOT_FOUND'}`);
}

function setRoleFormOpen(isOpen) {
    const roleForm = document.getElementById('role-form');
    const toggleBtn = document.getElementById('toggleRoleFormBtn');

    if (roleForm) {
        roleForm.classList.toggle('is-collapsed', !isOpen);
    }

    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggleBtn.textContent = isOpen ? '− フォームを閉じる' : '＋ 新規ロール追加';
    }
}

function toggleRoleForm() {
    const roleForm = document.getElementById('role-form');
    const isOpen = roleForm ? !roleForm.classList.contains('is-collapsed') : false;

    if (isOpen && editingId !== null) {
        cancelEdit();
        return;
    }

    setRoleFormOpen(!isOpen);
}

function getStoredDashboardOpen(storageKey) {
    try {
        return localStorage.getItem(storageKey) === 'true';
    } catch (error) {
        console.error('getStoredDashboardOpen error:', error);
        return false;
    }
}

function saveDashboardOpen(storageKey, isOpen) {
    try {
        localStorage.setItem(storageKey, isOpen ? 'true' : 'false');
    } catch (error) {
        console.error('saveDashboardOpen error:', error);
    }
}

function setCountSummaryOpen(isOpen, options = {}) {
    const summary = document.getElementById('count-summary');
    const toggle = document.getElementById('count-summary-toggle');

    if (summary) {
        summary.classList.toggle('is-collapsed', !isOpen);
    }

    if (toggle) {
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggle.textContent = `件数サマリー ${isOpen ? '▲' : '▼'}`;
    }

    if (options.save !== false) {
        saveDashboardOpen(COUNT_SUMMARY_OPEN_KEY, isOpen);
    }
}

function toggleCountSummary() {
    const summary = document.getElementById('count-summary');
    const isOpen = summary ? summary.classList.contains('is-collapsed') : false;
    setCountSummaryOpen(isOpen);
}

function setupCountSummaryToggle() {
    setCountSummaryOpen(getStoredDashboardOpen(COUNT_SUMMARY_OPEN_KEY), { save: false });
}

function getDashboardVisibilityStorageKey(key) {
    return `${DASHBOARD_VISIBILITY_STORAGE_PREFIX}${key}`;
}

function getDashboardVisibilityOption(key) {
    return DASHBOARD_VISIBILITY_OPTIONS.find(option => option.key === key) || null;
}

function getStoredDashboardVisibility(option) {
    try {
        const value = localStorage.getItem(getDashboardVisibilityStorageKey(option.key));

        if (value === null) {
            return option.defaultVisible === true;
        }

        return value === 'true';
    } catch (error) {
        console.error('getStoredDashboardVisibility error:', error);
        return option.defaultVisible === true;
    }
}

function saveDashboardVisibility(option, isVisible) {
    try {
        localStorage.setItem(getDashboardVisibilityStorageKey(option.key), isVisible ? 'true' : 'false');
    } catch (error) {
        console.error('saveDashboardVisibility error:', error);
    }
}

function getDashboardVisibilityState() {
    return DASHBOARD_VISIBILITY_OPTIONS.reduce((state, option) => {
        state[option.key] = getStoredDashboardVisibility(option);
        return state;
    }, {});
}

function setDashboardDisplaySettingsOpen(isOpen, options = {}) {
    const panel = document.getElementById('dashboard-display-settings-options');
    const toggle = document.getElementById('dashboard-display-settings-toggle');

    if (panel) {
        panel.hidden = !isOpen;

        if (isOpen) {
            panel.removeAttribute('hidden');
        } else {
            panel.setAttribute('hidden', '');
        }

        panel.classList.toggle('is-open', isOpen);
    }

    if (toggle) {
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggle.textContent = `表示設定 ${isOpen ? '▲' : '▼'}`;
    }

    if (options.save !== false) {
        saveDashboardOpen(DASHBOARD_DISPLAY_SETTINGS_OPEN_KEY, isOpen);
    }
}

function updatePriorityRiskOverviewVisibility(state) {
    const overview = document.getElementById('priority-risk-overview');

    if (!overview) {
        return;
    }

    const priorityVisible = state.priorityStand === true;
    const standRiskVisible = state.standRisk === true;
    const visibleCount = [priorityVisible, standRiskVisible].filter(Boolean).length;

    overview.hidden = visibleCount === 0;
    overview.classList.toggle('is-single-panel', visibleCount === 1);
    overview.classList.toggle('is-priority-hidden', !priorityVisible);
    overview.classList.toggle('is-stand-risk-hidden', !standRiskVisible);
}

function applyDashboardVisibilitySettings() {
    const state = getDashboardVisibilityState();

    DASHBOARD_VISIBILITY_OPTIONS.forEach(option => {
        const target = document.getElementById(option.targetId);
        const input = document.getElementById(option.inputId);
        const isVisible = state[option.key] === true;

        if (target) {
            target.hidden = !isVisible;
        }

        if (input) {
            input.checked = isVisible;
        }
    });

    updatePriorityRiskOverviewVisibility(state);
}

function setDashboardVisibility(key, isVisible) {
    const option = getDashboardVisibilityOption(key);

    if (!option) {
        return;
    }

    saveDashboardVisibility(option, isVisible);
    applyDashboardVisibilitySettings();
}

function toggleDashboardDisplaySettings() {
    const panel = document.getElementById('dashboard-display-settings-options');
    const isOpen = panel ? panel.hidden : false;
    setDashboardDisplaySettingsOpen(isOpen);
}

function setupDashboardDisplaySettings() {
    const isOpen = getStoredDashboardOpen(DASHBOARD_DISPLAY_SETTINGS_OPEN_KEY);
    setDashboardDisplaySettingsOpen(isOpen, { save: false });

    DASHBOARD_VISIBILITY_OPTIONS.forEach(option => {
        const input = document.getElementById(option.inputId);

        if (!input) {
            return;
        }

        input.checked = getStoredDashboardVisibility(option);
        input.addEventListener('change', event => {
            setDashboardVisibility(option.key, event.target.checked);
        });
    });

    applyDashboardVisibilitySettings();
}

function setCollapsibleDashboardOpen(config, isOpen, options = {}) {
    const dashboard = document.getElementById(config.dashboardId);
    const toggleBtn = document.getElementById(config.toggleId);
    const countEl = document.getElementById(config.countId);
    const countText = countEl ? countEl.textContent || '0件' : '0件';

    if (dashboard) {
        dashboard.classList.toggle('is-collapsed', !isOpen);
    }

    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggleBtn.textContent = `${config.label}（${countText}） ${isOpen ? '▲' : '▼'}`;
    }

    if (options.save !== false) {
        saveDashboardOpen(config.storageKey, isOpen);
    }
}

function syncCollapsibleDashboardState(config) {
    setCollapsibleDashboardOpen(config, getStoredDashboardOpen(config.storageKey), { save: false });
}

function toggleCollapsibleDashboard(config) {
    const dashboard = document.getElementById(config.dashboardId);
    const isOpen = dashboard ? dashboard.classList.contains('is-collapsed') : false;
    setCollapsibleDashboardOpen(config, isOpen);
}

const TODAY_TASK_DASHBOARD_CONFIG = {
    dashboardId: 'today-task-dashboard',
    toggleId: 'today-task-toggle',
    countId: 'today-task-count',
    storageKey: TODAY_TASK_DASHBOARD_OPEN_KEY,
    label: '本日のタスク'
};

const THREE_SET_FORECAST_DASHBOARD_CONFIG = {
    dashboardId: 'three-set-forecast-dashboard',
    toggleId: 'three-set-forecast-toggle',
    countId: 'three-set-forecast-count',
    storageKey: THREE_SET_FORECAST_DASHBOARD_OPEN_KEY,
    label: '3セット維持予測'
};

const REWORK_SETUP_DASHBOARD_CONFIG = {
    dashboardId: 'rework-setup-dashboard',
    toggleId: 'rework-setup-toggle',
    countId: 'rework-setup-count',
    storageKey: REWORK_SETUP_DASHBOARD_OPEN_KEY,
    label: '改削段取り予定'
};

const CUTTING_ANOMALY_DASHBOARD_CONFIG = {
    dashboardId: 'cutting-anomaly-dashboard',
    toggleId: 'cutting-anomaly-toggle',
    countId: 'cutting-anomaly-count',
    storageKey: CUTTING_ANOMALY_DASHBOARD_OPEN_KEY,
    label: '改削異常チェック'
};

const DANGER_ROLL_DASHBOARD_CONFIG = {
    dashboardId: 'danger-roll-dashboard',
    toggleId: 'danger-roll-toggle',
    countId: 'danger-roll-count',
    storageKey: DANGER_ROLL_DASHBOARD_OPEN_KEY,
    label: '危険ロール一覧'
};

const FUTURE_WORK_DASHBOARD_CONFIG = {
    dashboardId: 'incomplete-work-dashboard',
    toggleId: 'future-work-toggle',
    countId: 'incomplete-work-count',
    storageKey: FUTURE_WORK_DASHBOARD_OPEN_KEY,
    label: '未来作業依頼'
};

const PURCHASE_CONFIRMATION_DASHBOARD_CONFIG = {
    dashboardId: 'purchase-confirmation-board',
    toggleId: 'purchase-confirmation-toggle',
    countId: 'purchase-confirmation-count',
    storageKey: PURCHASE_CONFIRMATION_DASHBOARD_OPEN_KEY,
    label: '購入確認候補'
};

function toggleTodayTaskDashboard() {
    toggleCollapsibleDashboard(TODAY_TASK_DASHBOARD_CONFIG);
}

function toggleThreeSetForecastDashboard() {
    toggleCollapsibleDashboard(THREE_SET_FORECAST_DASHBOARD_CONFIG);
}

function toggleReworkSetupDashboard() {
    toggleCollapsibleDashboard(REWORK_SETUP_DASHBOARD_CONFIG);
}

function toggleCuttingAnomalyDashboard() {
    toggleCollapsibleDashboard(CUTTING_ANOMALY_DASHBOARD_CONFIG);
}

function toggleDangerRollDashboard() {
    toggleCollapsibleDashboard(DANGER_ROLL_DASHBOARD_CONFIG);
}

function toggleFutureWorkDashboard() {
    toggleCollapsibleDashboard(FUTURE_WORK_DASHBOARD_CONFIG);
}

function togglePurchaseConfirmationDashboard() {
    toggleCollapsibleDashboard(PURCHASE_CONFIRMATION_DASHBOARD_CONFIG);
}

function getSyncHeaderCounts() {
    if (typeof getSyncDiagnosticCounts === 'function') {
        return getSyncDiagnosticCounts();
    }

    return {
        lastSuccessful: 0,
        local: Array.isArray(roles) ? roles.length : 0,
        remote: null,
        merged: null,
        hasRemote: false
    };
}

function getSyncHeaderStatus(counts) {
    if (typeof getSyncDiagnosticStatus === 'function') {
        return getSyncDiagnosticStatus(counts);
    }

    return {
        level: 'warning',
        statusText: '状態: 要確認',
        detail: '同期診断を準備中です'
    };
}

function getSyncPendingCount(counts) {
    const comparableCounts = [
        counts && Number.isFinite(counts.local) ? counts.local : null,
        counts && Number.isFinite(counts.remote) ? counts.remote : null,
        counts && Number.isFinite(counts.merged) ? counts.merged : null
    ].filter(value => Number.isFinite(value));

    if (comparableCounts.length <= 1) {
        return 0;
    }

    return Math.max(...comparableCounts) - Math.min(...comparableCounts);
}

function formatSyncHeaderCount(value) {
    return Number.isFinite(value) ? `${value}件` : '未取得';
}

function getLastSyncAtLabel() {
    const value = localStorage.getItem('lastSyncAt');

    if (typeof formatLastSyncAt === 'function') {
        return formatLastSyncAt(value);
    }

    return value || '未同期';
}

function setSyncStatusBadgeState(label, stateClass) {
    const badge = document.getElementById('sync-status-badge');

    if (!badge) {
        return;
    }

    badge.textContent = label;
    badge.classList.remove('sync-status-normal', 'sync-status-warning', 'sync-status-danger', 'sync-status-offline');
    badge.classList.add(stateClass);
}

function updateSyncStatusBadge() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setSyncStatusBadgeState('⚫オフライン', 'sync-status-offline');
        return;
    }

    const counts = getSyncHeaderCounts();
    const status = getSyncHeaderStatus(counts);

    if (status.level === 'normal') {
        setSyncStatusBadgeState('同期正常', 'sync-status-normal');
        return;
    }

    if (status.level === 'danger') {
        setSyncStatusBadgeState('同期エラー', 'sync-status-danger');
        return;
    }

    const pendingCount = getSyncPendingCount(counts);
    setSyncStatusBadgeState(pendingCount > 0 ? `未同期 ${pendingCount}件` : '未同期あり', 'sync-status-warning');
}

function getSyncStatusPopupRows() {
    const counts = getSyncHeaderCounts();
    const pendingCount = getSyncPendingCount(counts);

    return [
        ['Local', formatSyncHeaderCount(counts.local)],
        ['Remote', formatSyncHeaderCount(counts.remote)],
        ['Merged', formatSyncHeaderCount(counts.merged)],
        ['未同期件数', `${pendingCount}件`],
        ['最終同期日時', getLastSyncAtLabel()]
    ];
}

function updateSyncStatusPopup() {
    const listEl = document.getElementById('sync-status-popup-list');

    if (!listEl) {
        return;
    }

    listEl.innerHTML = getSyncStatusPopupRows().map(([label, value]) => `
        <div class="sync-status-popup-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `).join('');
}

function openSyncStatusPopup() {
    const popup = document.getElementById('sync-status-popup');

    if (!popup) {
        return;
    }

    updateSyncStatusBadge();
    updateSyncStatusPopup();
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeSyncStatusPopup() {
    const popup = document.getElementById('sync-status-popup');

    if (!popup) {
        return;
    }

    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function installSyncDiagnosticHeaderIntegration() {
    if (typeof updateSyncDiagnosticPanel !== 'function' || updateSyncDiagnosticPanel.__headerIntegrated) {
        return;
    }

    const originalUpdateSyncDiagnosticPanel = updateSyncDiagnosticPanel;
    updateSyncDiagnosticPanel = function(options = {}) {
        const result = originalUpdateSyncDiagnosticPanel(options);
        updateSyncStatusBadge();
        return result;
    };
    updateSyncDiagnosticPanel.__headerIntegrated = true;
}

function setEditModeUi(role = null) {
    const isEditing = Boolean(role);
    const addRoleBtn = document.getElementById('addRoleBtn');
    const updateRoleBtn = document.getElementById('updateRoleBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editingBanner = document.getElementById('editing-banner');
    const editingLabel = document.querySelector('#editing-banner .editing-label');
    const editingStandName = document.getElementById('editing-stand-name');
    const editingStatusBadge = document.getElementById('editing-status-badge');
    const editingHelp = document.querySelector('#editing-banner .editing-help');
    const diameterChangeReasonField = document.querySelector('.diameter-change-reason-field');

    document.body.classList.toggle('editing-mode', isEditing);
    setRoleFormOpen(isEditing);

    if (addRoleBtn) addRoleBtn.style.display = isEditing ? 'none' : 'inline-block';
    if (updateRoleBtn) updateRoleBtn.style.display = isEditing ? 'inline-block' : 'none';
    if (cancelEditBtn) cancelEditBtn.style.display = isEditing ? 'inline-block' : 'none';
    if (editingBanner) editingBanner.style.display = isEditing ? 'block' : 'none';
    if (editingLabel) editingLabel.textContent = '編集中：';
    if (editingStandName) editingStandName.textContent = role ? role.name || '-' : '-';
    if (editingStatusBadge) editingStatusBadge.innerHTML = role ? getStatusBadge(role.status) : '';
    if (editingHelp) editingHelp.textContent = '内容を変更したら「入力内容を更新」を押してください。';
    if (diameterChangeReasonField) diameterChangeReasonField.style.display = isEditing ? 'grid' : 'none';
}

function updateCoatingStatusFieldState(status) {
    const field = document.querySelector('.coating-status-field');
    const select = document.getElementById('role-coating-status');
    const isAllowed = normalizeRoleStatusValue(status) === NEW_STORAGE_STATUS;

    if (!field || !select) {
        return;
    }

    field.classList.toggle('is-hidden', !isAllowed);
    field.setAttribute('aria-hidden', isAllowed ? 'false' : 'true');
    select.disabled = !isAllowed;

    if (!isAllowed) {
        select.value = '';
    }
}

function saveLocalRoles() {

    const currentRoles = localStorage.getItem('roles');

if (currentRoles) {
    localStorage.setItem('roles_backup_latest', currentRoles);

    localStorage.setItem('roles_backup_saved_at', new Date().toISOString());
}
const historyKey = `roles_backup_${new Date().toISOString()}`;
localStorage.setItem(historyKey, currentRoles || '[]');
const backupKeys = Object.keys(localStorage)
    .filter(key => key.startsWith('roles_backup_') && !key.startsWith('roles_backup_before_restore_'))
    .sort();

if (backupKeys.length > 20) {
    const oldKeys = backupKeys.slice(0, backupKeys.length - 20);

    oldKeys.forEach(key => {
        localStorage.removeItem(key);
    });
}
    console.log('ROLL_DEBUG_SAVE_LOCAL_BEFORE_WRITE', {
        rolesLength: roles.length,
        tail5: roles.slice(-5).map(getDebugRoleSnapshot)
    });
    localStorage.setItem('roles', JSON.stringify(roles));
}

function normalizeWorkProgressStepState(value) {
    if (value && typeof value === 'object') {
        return {
            done: value.done === true,
            updatedAt: value.updatedAt || '',
            updatedBy: value.updatedBy || ''
        };
    }

    if (value) {
        return {
            done: true,
            updatedAt: String(value),
            updatedBy: ''
        };
    }

    return {
        done: false,
        updatedAt: '',
        updatedBy: ''
    };
}

function normalizeWorkProgress(role) {
    const source = role && role.workProgress && typeof role.workProgress === 'object'
        ? { ...role.workProgress }
        : {};
    const progress = {};

    Object.entries(LEGACY_REWORK_CHECKLIST_STEP_KEYS).forEach(([legacyKey, currentKey]) => {
        if (source[legacyKey] !== undefined && source[currentKey] === undefined) {
            source[currentKey] = source[legacyKey];
        }
    });

    if (role && role.requestSent === true && !source.vendorSentAt) {
        source.vendorSentAt = role.updatedAt || new Date().toISOString();
    }

    WORK_PROGRESS_STEPS.forEach(step => {
        progress[step.key] = normalizeWorkProgressStepState(source[step.key]);
    });

    progress.dispatchDate = normalizeDateInputValue(source.dispatchDate || (role && role.dispatchDate));
    progress.arrivalDate = normalizeDateInputValue(source.arrivalDate);
    progress.pickupAdjustedBy = source.pickupAdjustedBy || progress[PICKUP_ADJUSTED_STEP_KEY].updatedBy || '';

    if (progress.pickupAdjustedBy && !progress[PICKUP_ADJUSTED_STEP_KEY].updatedBy) {
        progress[PICKUP_ADJUSTED_STEP_KEY].updatedBy = progress.pickupAdjustedBy;
    }

    if (!progress.dispatchDate) {
        progress[PICKUP_ADJUSTED_STEP_KEY] = {
            done: false,
            updatedAt: '',
            updatedBy: ''
        };
        progress.pickupAdjustedBy = '';
    }

    return progress;
}

function isWorkProgressStepDone(progress, stepKey) {
    const state = progress && progress[stepKey];
    if (stepKey === PICKUP_ADJUSTED_STEP_KEY && !normalizeDateInputValue(progress && progress.dispatchDate)) {
        return false;
    }
    return Boolean(state && typeof state === 'object' ? state.done : state);
}

function getWorkProgressStepUpdatedAt(progress, stepKey) {
    const state = progress && progress[stepKey];

    if (!state) {
        return '';
    }

    return typeof state === 'object' ? state.updatedAt || '' : String(state);
}

function getWorkProgressStepUpdatedBy(progress, stepKey) {
    const state = progress && progress[stepKey];
    if (stepKey === PICKUP_ADJUSTED_STEP_KEY && progress && progress.pickupAdjustedBy) {
        return progress.pickupAdjustedBy;
    }
    return state && typeof state === 'object' ? state.updatedBy || '' : '';
}

function getReworkPickupDateSummaryHtml(progress) {
    const dispatchDate = normalizeDateInputValue(progress && progress.dispatchDate);
    const arrivalDate = normalizeDateInputValue(progress && progress.arrivalDate);
    const temporaryInboundPlanDate = dispatchDate && !arrivalDate
        ? getTemporaryInboundPlanDate(dispatchDate)
        : '';

    if (!dispatchDate) {
        return '<span class="rework-pickup-help is-required">搬出日を入力してください</span>';
    }

    return `
        <span class="rework-pickup-date-line">搬出日：${escapeHtml(formatDateForDisplay(dispatchDate))}</span>
        <span class="rework-pickup-date-line">搬入日：${escapeHtml(arrivalDate ? formatDateForDisplay(arrivalDate) : '未定')}</span>
        ${temporaryInboundPlanDate ? `
            <span class="rework-pickup-date-line">仮搬入予定：${escapeHtml(formatDateForDisplay(temporaryInboundPlanDate))}</span>
            <span class="rework-pickup-help">目安：搬出日から20〜30日</span>
        ` : ''}
    `;
}

function getReworkPickupChecklistItemHtml(roleKey, step, index, progress, options = {}) {
    const isDone = isWorkProgressStepDone(progress, step.key);
    const isEnabled = options.isEnabled === true;
    const completedAt = getWorkProgressStepUpdatedAt(progress, step.key);
    const completedBy = getWorkProgressStepUpdatedBy(progress, step.key);
    const dispatchDate = normalizeDateInputValue(progress.dispatchDate);
    const arrivalDate = normalizeDateInputValue(progress.arrivalDate);
    const containerClass = options.containerClass || 'rework-pickup-fields';
    const itemClass = options.itemClass || 'progress-step-btn';
    const encodedRoleKey = encodeURIComponent(String(roleKey || ''));

    return `
        <div class="${escapeHtml(itemClass)} rework-pickup-step ${isDone ? 'is-done' : ''} ${isEnabled ? '' : 'is-disabled'}">
            <span class="progress-step-index">${escapeHtml(String(index + 1))}</span>
            <span class="progress-step-label">${escapeHtml(step.label)}</span>
            ${isDone ? `
                <span class="progress-step-date">完了：${escapeHtml(formatProgressTimestamp(completedAt))}</span>
                <span class="progress-step-date">更新者：${escapeHtml(completedBy || '未設定')}</span>
            ` : ''}
            <div class="${escapeHtml(containerClass)}" data-role-key="${escapeHtml(encodedRoleKey)}">
                <label class="rework-pickup-date-field">
                    <span>搬出日 <strong>必須</strong></span>
                    <input
                        type="date"
                        class="rework-pickup-dispatch-date"
                        value="${escapeHtml(dispatchDate)}"
                        onchange="saveReworkPickupDates('${escapeHtml(encodedRoleKey)}', this.closest('.${escapeHtml(containerClass)}'))"
                        oninput="saveReworkPickupDates('${escapeHtml(encodedRoleKey)}', this.closest('.${escapeHtml(containerClass)}'))"
                        ${isEnabled ? '' : 'disabled'}
                    >
                </label>
                <label class="rework-pickup-date-field">
                    <span>搬入日 <small>任意</small></span>
                    <input
                        type="date"
                        class="rework-pickup-arrival-date"
                        value="${escapeHtml(arrivalDate)}"
                        onchange="saveReworkPickupDates('${escapeHtml(encodedRoleKey)}', this.closest('.${escapeHtml(containerClass)}'))"
                        oninput="saveReworkPickupDates('${escapeHtml(encodedRoleKey)}', this.closest('.${escapeHtml(containerClass)}'))"
                        ${isEnabled ? '' : 'disabled'}
                    >
                </label>
                <div class="rework-pickup-date-summary">
                    ${getReworkPickupDateSummaryHtml(progress)}
                </div>
            </div>
        </div>
    `;
}

function normalizeRoleHistory(role) {
    return Array.isArray(role && role.history)
        ? role.history.filter(entry => entry && typeof entry === 'object')
        : [];
}

function normalizeCurrentDiameter(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return '';
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : '';
}

function formatCurrentDiameter(value) {
    const normalized = normalizeCurrentDiameter(value);
    return normalized === '' ? '-' : `φ${normalized.toFixed(1)}`;
}

function formatMillimeterValue(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return '-';
    }

    const roundedValue = Math.round(numericValue);

    return Math.abs(numericValue - roundedValue) < 0.000001
        ? `${roundedValue}mm`
        : `${numericValue.toFixed(1)}mm`;
}

function normalizeCuttingMasterNumericValue(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return '';
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : '';
}

function normalizeCuttingMasterRow(row) {
    const stand = String(row && row.stand !== undefined && row.stand !== null ? row.stand : '').trim();

    return {
        stand,
        standKey: getStandKey(stand),
        standardCutMm: normalizeCuttingMasterNumericValue(row && row.standardCutMm),
        calculationCutMm: normalizeCuttingMasterNumericValue(row && row.calculationCutMm),
        actualAverageCutMm: normalizeCuttingMasterNumericValue(row && row.actualAverageCutMm),
        recentAverageCutMm: normalizeCuttingMasterNumericValue(row && row.recentAverageCutMm),
        actualSampleCount: normalizeCuttingMasterNumericValue(row && row.actualSampleCount),
        standardDiffMm: normalizeCuttingMasterNumericValue(row && row.standardDiffMm),
        standardDiffRate: normalizeCuttingMasterNumericValue(row && row.standardDiffRate),
        anomalyJudgment: String(row && row.anomalyJudgment !== undefined && row.anomalyJudgment !== null ? row.anomalyJudgment : '').trim(),
        anomalyReason: String(row && row.anomalyReason !== undefined && row.anomalyReason !== null ? row.anomalyReason : '').trim(),
        active: row && row.active !== false && String(row && row.active).toLowerCase() !== 'false'
    };
}

function setCuttingMasterRows(rows) {
    const normalizedRows = (Array.isArray(rows) ? rows : [])
        .map(normalizeCuttingMasterRow)
        .filter(row => row.standKey !== '')
        .sort((a, b) => Number(a.standKey) - Number(b.standKey));

    cuttingMasterRows = normalizedRows;
    cuttingMasterByStand = new Map(normalizedRows.map(row => [row.standKey, row]));
    return cuttingMasterRows;
}

function getCuttingMaster(standKey) {
    const key = getStandKey(standKey);
    return key ? (cuttingMasterByStand.get(key) || null) : null;
}

async function fetchCuttingMaster() {
    if (!isRemoteConfigured()) {
        return setCuttingMasterRows([]);
    }

    try {
        const url = `${SHEETS_ENDPOINT}?action=fetchCuttingMaster&t=${Date.now()}`;
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();

        if (!data || data.success !== true || !Array.isArray(data.cuttingMaster)) {
            const detail = data && data.error ? `詳細: ${data.error}` : 'cuttingMaster配列が見つかりません。';
            throw new Error(`改削マスタ取得に失敗しました。${detail}`);
        }

        return setCuttingMasterRows(data.cuttingMaster);
    } catch (error) {
        console.error('fetchCuttingMaster error:', error);
        return setCuttingMasterRows([]);
    }
}

function loadCuttingMaster() {
    return fetchCuttingMaster();
}

function normalizeCuttingAnomalyJudgment(value) {
    const normalized = String(value || '').trim();
    const judgmentMap = {
        '異常': 'abnormal',
        '注意': 'warning',
        '判定保留': 'pending'
    };

    return judgmentMap[normalized] || '';
}

function formatCuttingMasterRate(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return '';
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return '';
    }

    const percent = Math.round(numericValue * 1000) / 10;
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
}

function getCuttingAnomalyItems() {
    const displayOrder = {
        abnormal: 1,
        warning: 2,
        pending: 3
    };

    return cuttingMasterRows
        .map(row => ({
            ...row,
            judgmentKey: normalizeCuttingAnomalyJudgment(row.anomalyJudgment)
        }))
        .filter(row => row.judgmentKey)
        .sort((a, b) => {
            const orderDiff = displayOrder[a.judgmentKey] - displayOrder[b.judgmentKey];

            if (orderDiff !== 0) {
                return orderDiff;
            }

            return Number(a.standKey) - Number(b.standKey);
        });
}

function updateCuttingAnomalyDashboard() {
    const dashboard = document.getElementById('cutting-anomaly-dashboard');
    const countEl = document.getElementById('cutting-anomaly-count');
    const listEl = document.getElementById('cutting-anomaly-list');

    if (!dashboard || !countEl || !listEl) {
        return;
    }

    const items = getCuttingAnomalyItems();
    countEl.textContent = `${items.length}件`;
    dashboard.classList.toggle('is-empty', items.length === 0);
    syncCollapsibleDashboardState(CUTTING_ANOMALY_DASHBOARD_CONFIG);

    if (items.length === 0) {
        listEl.innerHTML = '<div class="cutting-anomaly-empty">改削異常はありません</div>';
        return;
    }

    const groups = [
        { key: 'abnormal', label: '異常' },
        { key: 'warning', label: '注意' },
        { key: 'pending', label: '判定保留' }
    ];

    listEl.innerHTML = groups.map(group => {
        const groupItems = items.filter(item => item.judgmentKey === group.key);

        if (groupItems.length === 0) {
            return '';
        }

        return `
            <section class="cutting-anomaly-group cutting-anomaly-${group.key}">
                <div class="cutting-anomaly-group-title">
                    <span>${escapeHtml(group.label)}</span>
                    <span>${groupItems.length}件</span>
                </div>
                <div class="cutting-anomaly-items">
                    ${groupItems.map(item => {
                        const diffRate = formatCuttingMasterRate(item.standardDiffRate);
                        const diffRateHtml = diffRate
                            ? `<span class="cutting-anomaly-rate">標準との差率 ${escapeHtml(diffRate)}</span>`
                            : '';
                        const reason = item.anomalyReason || '理由未設定';

                        return `
                            <div class="cutting-anomaly-item">
                                <div class="cutting-anomaly-main">
                                    <span class="cutting-anomaly-stand">${escapeHtml(item.stand || '-')}</span>
                                    ${diffRateHtml}
                                </div>
                                <div class="cutting-anomaly-reason">理由：${escapeHtml(reason)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    }).join('');
}

function getDiameterChangeReason() {
    const select = document.getElementById('diameter-change-reason');
    return select ? String(select.value || '').trim() : '';
}

function clearDiameterChangeReason() {
    const select = document.getElementById('diameter-change-reason');
    if (select) {
        select.value = '';
    }
}

function buildWorkHistoryDiameterEvent(role, beforeDiameter, afterDiameter, eventAt) {
    const beforeValue = normalizeCurrentDiameter(beforeDiameter);
    const afterValue = normalizeCurrentDiameter(afterDiameter);
    const operator = getCurrentOperator();

    return {
        roleId: role.id || '',
        standRollName: role.name || '',
        stand: getStandKey(role.name) ? `#${getStandKey(role.name)}` : '',
        eventType: '改削',
        eventAt: eventAt || new Date().toISOString(),
        beforeValue: beforeValue,
        afterValue: afterValue,
        currentDiameter: afterValue,
        cutMm: beforeValue !== '' && afterValue !== '' ? beforeValue - afterValue : '',
        operator: operator ? operator.name : '',
        source: 'web-app',
        note: '径変更理由: 改削'
    };
}

function buildCuttingHistoryInputCorrectionInvalidationEvent(role, beforeDiameter, afterDiameter, eventAt) {
    const beforeValue = normalizeCurrentDiameter(beforeDiameter);
    const afterValue = normalizeCurrentDiameter(afterDiameter);
    const operator = getCurrentOperator();

    return {
        roleId: role.id || '',
        standRollName: role.name || '',
        stand: getStandKey(role.name) ? `#${getStandKey(role.name)}` : '',
        eventAt: eventAt || new Date().toISOString(),
        beforeValue: beforeValue,
        afterValue: afterValue,
        currentDiameter: afterValue,
        operator: operator ? operator.name : '',
        source: 'web-app',
        note: '径変更理由: 入力ミス修正'
    };
}

async function appendWorkHistoryEvent(event) {
    if (!isRemoteConfigured()) {
        return false;
    }

    try {
        await fetch(SHEETS_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'appendWorkHistory',
                event
            })
        });
        return true;
    } catch (error) {
        console.error('appendWorkHistoryEvent error:', error);
        return false;
    }
}

async function invalidateLatestCuttingHistoryForInputCorrection(event) {
    if (!isRemoteConfigured()) {
        return false;
    }

    try {
        await fetch(SHEETS_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'invalidateLatestCuttingHistoryForInputCorrection',
                event
            })
        });
        return true;
    } catch (error) {
        console.error('invalidateLatestCuttingHistoryForInputCorrection error:', error);
        return false;
    }
}

function getRemainingDiameterInfo(role) {
    const currentDiameter = normalizeCurrentDiameter(role && role.currentDiameter);

    if (currentDiameter === '') {
        return null;
    }

    const standMaster = typeof getStandMaster === 'function'
        ? getStandMaster(getStandKey(role && role.name))
        : null;
    const scrapDiameterValue = standMaster ? standMaster.scrapDiameter : '';
    const scrapDiameter = scrapDiameterValue === '' || scrapDiameterValue === null || scrapDiameterValue === undefined
        ? Number.NaN
        : Number(scrapDiameterValue);

    if (!Number.isFinite(scrapDiameter)) {
        return null;
    }

    const remainingDiameter = currentDiameter - scrapDiameter;
    const cuttingMaster = getCuttingMaster(getStandKey(role && role.name));
    const calculationCutMm = cuttingMaster && cuttingMaster.active
        ? normalizeCuttingMasterNumericValue(cuttingMaster.calculationCutMm)
        : '';
    const standardCutMm = cuttingMaster && cuttingMaster.active
        ? normalizeCuttingMasterNumericValue(cuttingMaster.standardCutMm)
        : '';
    const adoptedCutMm = calculationCutMm !== '' ? calculationCutMm : standardCutMm;
    const remainingCutCount = adoptedCutMm !== '' && adoptedCutMm > 0
        ? Math.floor(remainingDiameter / adoptedCutMm)
        : null;

    return {
        currentDiameter,
        scrapDiameter,
        remainingDiameter,
        standardCutMm,
        calculationCutMm,
        adoptedCutMm,
        remainingCutCount,
        isScrapArea: remainingDiameter <= 0
    };
}

function getRemainingDiameterHtml(role) {
    const info = getRemainingDiameterInfo(role);

    if (!info || !Number.isFinite(info.remainingCutCount)) {
        return '';
    }

    const levelClass = info.remainingCutCount >= 3
        ? 'is-safe'
        : (info.remainingCutCount === 2 ? 'is-warning' : 'is-danger');

    return `
        <span class="remaining-diameter-info">
            <span class="remaining-cut-count-value ${levelClass}">残り改削回数：${escapeHtml(String(info.remainingCutCount))}回</span>
        </span>
    `;
}

function getStandOnlineUseMonths(standKey) {
    const standNumber = Number(getStandKey(standKey));

    if (standNumber >= 2 && standNumber <= 5) {
        return 1;
    }

    if (standNumber >= 6 && standNumber <= 17) {
        return 3;
    }

    return 3;
}

function getPurchasePlanningInfo(role) {
    const standKey = getStandKey(role && role.name);
    const currentDiameter = normalizeCurrentDiameter(role && role.currentDiameter);

    if (!standKey || currentDiameter === '' || role.status === DISCARDED_STATUS) {
        return null;
    }

    const standMaster = typeof getStandMaster === 'function' ? getStandMaster(standKey) : null;
    const scrapDiameter = standMaster && standMaster.scrapDiameter !== ''
        ? Number(standMaster.scrapDiameter)
        : Number.NaN;

    if (!Number.isFinite(scrapDiameter)) {
        return null;
    }

    if (currentDiameter < scrapDiameter) {
        return null;
    }

    const cuttingMaster = getCuttingMaster(standKey);
    const calculationCutMm = cuttingMaster && cuttingMaster.active
        ? normalizeCuttingMasterNumericValue(cuttingMaster.calculationCutMm)
        : '';
    const standardCutMm = cuttingMaster && cuttingMaster.active
        ? normalizeCuttingMasterNumericValue(cuttingMaster.standardCutMm)
        : '';
    const adoptedCutMm = calculationCutMm !== '' ? calculationCutMm : standardCutMm;

    if (adoptedCutMm === '' || adoptedCutMm <= 0) {
        return null;
    }

    const onlineUseMonths = getStandOnlineUseMonths(standKey);
    const leadTimeMonths = standMaster && standMaster.leadTimeMonths !== ''
        ? Number(standMaster.leadTimeMonths)
        : DEFAULT_PURCHASE_LEAD_TIME_MONTHS;
    const usableOnlineCount = Math.floor((currentDiameter - scrapDiameter) / adoptedCutMm) + 1;
    const useStartDate = normalizeUseStartDate(role && role.useStartDate);
    const forecastStartDate = useStartDate || getTodayDateString();
    const disposalForecastDate = addMonthsToDateString(forecastStartDate, usableOnlineCount * onlineUseMonths);
    const purchaseDecisionDate = addMonthsToDateString(disposalForecastDate, -leadTimeMonths);

    return {
        standKey,
        roleName: role.name || '',
        status: role.status || '',
        currentDiameter,
        scrapDiameter,
        adoptedCutMm,
        usableOnlineCount,
        useStartDate,
        disposalForecastDate,
        leadTimeMonths,
        purchaseDecisionDate
    };
}

function getPurchaseConfirmationLevel(info) {
    const today = getTodayDateString();
    const warningLimit = addMonthsToDateString(today, PURCHASE_CONFIRMATION_WINDOW_MONTHS);
    const decisionDate = normalizeDateInputValue(info && info.purchaseDecisionDate);

    if (!decisionDate) {
        return null;
    }

    if (decisionDate <= today) {
        return {
            key: 'urgent',
            label: '要確認',
            memo: '購入判断期限を過ぎています'
        };
    }

    if (warningLimit && decisionDate <= warningLimit) {
        return {
            key: 'soon',
            label: '早期確認',
            memo: '3か月以内に購入判断期限です'
        };
    }

    return null;
}

function getPurchaseConfirmationItems(allRoles = roles) {
    const excludedStandKeys = new Set((Array.isArray(allRoles) ? allRoles : [])
        .filter(role => role && role.status === NEW_STORAGE_STATUS)
        .map(role => getStandKey(role.name))
        .filter(Boolean));

    return (Array.isArray(allRoles) ? allRoles : [])
        .filter(role => !excludedStandKeys.has(getStandKey(role && role.name)))
        .map(role => {
            const info = getPurchasePlanningInfo(role);
            const level = getPurchaseConfirmationLevel(info);

            if (!info || !level) {
                return null;
            }

            return {
                ...info,
                level
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.purchaseDecisionDate !== b.purchaseDecisionDate) {
                return String(a.purchaseDecisionDate).localeCompare(String(b.purchaseDecisionDate));
            }

            const standDiff = (Number(a.standKey) || 999999) - (Number(b.standKey) || 999999);

            if (standDiff !== 0) {
                return standDiff;
            }

            return compareStandRoleNames(a.roleName, b.roleName);
        });
}

function formatPurchaseDiameter(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? `φ${numericValue.toFixed(1)}` : '-';
}

function formatPurchaseMonth(value) {
    const normalized = normalizeDateInputValue(value);

    if (!normalized) {
        return '-';
    }

    const [year, month] = normalized.split('-');
    return `${year}年${Number(month)}月`;
}

function updatePurchaseConfirmationBoard(allRoles = roles) {
    const board = document.getElementById('purchase-confirmation-board');
    const countEl = document.getElementById('purchase-confirmation-count');
    const listEl = document.getElementById('purchase-confirmation-list');

    if (!board || !countEl || !listEl) {
        return;
    }

    const items = getPurchaseConfirmationItems(allRoles);
    countEl.textContent = `${items.length}件`;
    board.classList.toggle('is-empty', items.length === 0);
    syncCollapsibleDashboardState(PURCHASE_CONFIRMATION_DASHBOARD_CONFIG);

    if (items.length === 0) {
        listEl.innerHTML = '<div class="purchase-confirmation-empty">購入確認候補はありません</div>';
        return;
    }

    listEl.innerHTML = items.map(item => `
        <article class="purchase-confirmation-card purchase-confirmation-${escapeHtml(item.level.key)}">
            <div class="purchase-confirmation-card-header">
                <div>
                    <span class="purchase-confirmation-stand">#${escapeHtml(item.standKey)}</span>
                    <strong class="purchase-confirmation-role">${escapeHtml(item.roleName || '-')}</strong>
                </div>
                <span class="purchase-confirmation-level">${escapeHtml(item.level.label)}</span>
            </div>
            <div class="purchase-confirmation-focus">
                <div>
                    <span>廃却予想</span>
                    <strong>${escapeHtml(formatPurchaseMonth(item.disposalForecastDate))}</strong>
                </div>
                <div>
                    <span>購入判断期限</span>
                    <strong>${escapeHtml(formatPurchaseMonth(item.purchaseDecisionDate))}</strong>
                </div>
            </div>
            <div class="purchase-confirmation-grid">
                <span>スタンド</span><strong>#${escapeHtml(item.standKey)}</strong>
                <span>ロール名</span><strong>${escapeHtml(item.roleName || '-')}</strong>
                <span>現在径</span><strong>${escapeHtml(formatPurchaseDiameter(item.currentDiameter))}</strong>
                <span>廃却径</span><strong>${escapeHtml(formatPurchaseDiameter(item.scrapDiameter))}</strong>
                <span>廃却予想</span><strong>${escapeHtml(formatPurchaseMonth(item.disposalForecastDate))}</strong>
                <span>購入判断期限</span><strong>${escapeHtml(formatPurchaseMonth(item.purchaseDecisionDate))}</strong>
                <span>理由</span><strong>購入LT${escapeHtml(String(item.leadTimeMonths))}か月</strong>
            </div>
        </article>
    `).join('');
}

function isDangerRollTargetStatus(status) {
    const normalizedStatus = String(status || '').trim();
    const targetStatuses = new Set([
        ONLINE_STATUS,
        USED_STANDBY_STATUS,
        '中古予備',
        REWORK_READY_STATUS,
        '改削待ち',
        NEW_READY_STATUS,
        '新品予備（組込可）',
        NEW_INSTALLED_STATUS
    ]);

    return targetStatuses.has(normalizedStatus);
}

function getDangerRollLevel(remainingCutCount) {
    if (!Number.isFinite(remainingCutCount)) {
        return null;
    }

    if (remainingCutCount <= 0) {
        return {
            key: 'danger',
            label: '危険',
            reason: '廃却径まで余裕なし',
            order: 1
        };
    }

    if (remainingCutCount === 1) {
        return {
            key: 'action',
            label: '要対応',
            reason: '次回改削後に廃却候補',
            order: 2
        };
    }

    if (remainingCutCount === 2) {
        return {
            key: 'warning',
            label: '注意',
            reason: '早めに予備状況確認',
            order: 3
        };
    }

    return null;
}

function getDangerRollItems(allRoles = roles) {
    return (Array.isArray(allRoles) ? allRoles : [])
        .filter(role => role && isDangerRollTargetStatus(role.status))
        .map(role => {
            const remainingInfo = getRemainingDiameterInfo(role);
            const remainingCutCount = remainingInfo && Number.isFinite(remainingInfo.remainingCutCount)
                ? remainingInfo.remainingCutCount
                : null;
            const level = getDangerRollLevel(remainingCutCount);

            return level ? {
                role,
                level,
                remainingInfo,
                remainingCutCount
            } : null;
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.level.order !== b.level.order) {
                return a.level.order - b.level.order;
            }

            if (a.remainingCutCount !== b.remainingCutCount) {
                return a.remainingCutCount - b.remainingCutCount;
            }

            return compareRolesByStandRole(a.role, b.role);
        });
}

function updateDangerRollDashboard(allRoles = roles) {
    const dashboard = document.getElementById('danger-roll-dashboard');
    const countEl = document.getElementById('danger-roll-count');
    const listEl = document.getElementById('danger-roll-list');

    if (!dashboard || !countEl || !listEl) {
        return;
    }

    const items = getDangerRollItems(allRoles);
    countEl.textContent = `${items.length}件`;
    dashboard.classList.toggle('is-empty', items.length === 0);
    syncCollapsibleDashboardState(DANGER_ROLL_DASHBOARD_CONFIG);

    if (items.length === 0) {
        listEl.innerHTML = '<div class="danger-roll-empty">危険ロールはありません</div>';
        return;
    }

    const groups = [
        { key: 'danger', label: '危険' },
        { key: 'action', label: '要対応' },
        { key: 'warning', label: '注意' }
    ];

    listEl.innerHTML = groups.map(group => {
        const groupItems = items.filter(item => item.level.key === group.key);

        if (groupItems.length === 0) {
            return '';
        }

        return `
            <section class="danger-roll-group danger-roll-${group.key}">
                <div class="danger-roll-group-title">
                    <span>${escapeHtml(group.label)}</span>
                    <span>${groupItems.length}件</span>
                </div>
                <div class="danger-roll-items">
                    ${groupItems.map(item => {
                        const roleId = encodeURIComponent(String(item.role.id || ''));

                        return `
                            <button type="button" class="danger-roll-item" onclick="focusDangerRollRole('${roleId}')">
                                <span class="danger-roll-name">${escapeHtml(item.role.name || '-')}</span>
                                <span class="danger-roll-count-text">残り改削回数：${escapeHtml(String(item.remainingCutCount))}回</span>
                                <span class="danger-roll-reason">理由：${escapeHtml(item.level.reason)}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    }).join('');
}

function focusDangerRollRole(encodedRoleId) {
    const roleId = decodeURIComponent(String(encodedRoleId || ''));
    const role = roles.find(item => String(item.id) === String(roleId));

    if (!role) {
        showToast('対象ロールが見つかりません');
        return;
    }

    scrollToRoleCard(role.id, null, {
        highlight: true,
        notifyMissing: true,
        priority: 'high'
    });
}

const STAND_RISK_STANDS = Array.from({ length: 16 }, (_, index) => String(index + 2));
const STAND_RISK_LEVELS = {
    danger: { key: 'danger', label: '危険', order: 1 },
    action: { key: 'action', label: '要対応', order: 2 },
    warning: { key: 'warning', label: '注意', order: 3 },
    pending: { key: 'pending', label: '保留', order: 4 },
    normal: { key: 'normal', label: '正常', order: 5 }
};

function getStandRiskFromDangerRollLevel(levelKey) {
    if (levelKey === 'danger') {
        return STAND_RISK_LEVELS.danger;
    }

    if (levelKey === 'action') {
        return STAND_RISK_LEVELS.action;
    }

    if (levelKey === 'warning') {
        return STAND_RISK_LEVELS.warning;
    }

    return null;
}

function getStandRiskReasonFromDangerRollLevel(levelKey) {
    if (levelKey === 'danger') {
        return '残り改削回数0回以下';
    }

    if (levelKey === 'action') {
        return '残り改削回数1回';
    }

    if (levelKey === 'warning') {
        return '残り改削回数2回';
    }

    return '';
}

function getStandRiskFromCuttingAnomaly(judgmentKey) {
    if (judgmentKey === 'abnormal') {
        return STAND_RISK_LEVELS.danger;
    }

    if (judgmentKey === 'warning') {
        return STAND_RISK_LEVELS.warning;
    }

    if (judgmentKey === 'pending') {
        return STAND_RISK_LEVELS.pending;
    }

    return null;
}

function getStandRiskReasonFromCuttingAnomaly(judgmentKey) {
    if (judgmentKey === 'abnormal') {
        return '改削異常あり';
    }

    if (judgmentKey === 'warning') {
        return '改削注意あり';
    }

    if (judgmentKey === 'pending') {
        return '改削異常チェック判定保留';
    }

    return '';
}

function createInitialStandRiskState() {
    return {
        risk: STAND_RISK_LEVELS.normal,
        reasons: ['供給リスクなし']
    };
}

function applyWorseStandRisk(riskByStand, standKey, risk, reason) {
    if (!standKey || !risk) {
        return;
    }

    const currentState = riskByStand.get(standKey) || createInitialStandRiskState();

    if (risk.order < currentState.risk.order) {
        riskByStand.set(standKey, {
            risk,
            reasons: reason ? [reason] : []
        });
        return;
    }

    if (risk.order === currentState.risk.order && reason && !currentState.reasons.includes(reason)) {
        currentState.reasons.push(reason);
    }
}

function createStandSupplySummary() {
    return {
        onlineCount: 0,
        newSpareCount: 0,
        usedSpareCount: 0,
        reworkingCount: 0,
        reworkWaitingCount: 0,
        dangerRollCount: 0,
        actionRollCount: 0,
        warningRollCount: 0,
        onlineDangerRollCount: 0,
        onlineActionRollCount: 0,
        onlineWarningRollCount: 0
    };
}

function isNewSpareStatus(status) {
    return status === NEW_READY_STATUS || status === NEW_INSTALLED_STATUS || status === '新品予備（組込可）';
}

function isUsedSpareStatus(status) {
    return status === USED_STANDBY_STATUS || status === '中古予備';
}

function isReworkWaitingStatus(status) {
    return status === REWORK_READY_STATUS || status === '改削待ち';
}

function getStandSupplySummaries(allRoles, dangerItems) {
    const summaryByStand = new Map(STAND_RISK_STANDS.map(standKey => [standKey, createStandSupplySummary()]));

    (Array.isArray(allRoles) ? allRoles : []).forEach(role => {
        const standKey = getStandKey(role && role.name);
        const summary = summaryByStand.get(standKey);

        if (!summary) {
            return;
        }

        const status = String(role.status || '').trim();

        if (status === ONLINE_STATUS) {
            summary.onlineCount += 1;
        } else if (isNewSpareStatus(status)) {
            summary.newSpareCount += 1;
        } else if (isUsedSpareStatus(status)) {
            summary.usedSpareCount += 1;
        } else if (status === REWORKING_STATUS) {
            summary.reworkingCount += 1;
        } else if (isReworkWaitingStatus(status)) {
            summary.reworkWaitingCount += 1;
        }
    });

    (Array.isArray(dangerItems) ? dangerItems : []).forEach(item => {
        const standKey = getStandKey(item.role && item.role.name);
        const summary = summaryByStand.get(standKey);

        if (!summary) {
            return;
        }

        const levelKey = item.level && item.level.key;
        const isOnline = item.role && item.role.status === ONLINE_STATUS;

        if (levelKey === 'danger') {
            summary.dangerRollCount += 1;
            if (isOnline) {
                summary.onlineDangerRollCount += 1;
            }
        } else if (levelKey === 'action') {
            summary.actionRollCount += 1;
            if (isOnline) {
                summary.onlineActionRollCount += 1;
            }
        } else if (levelKey === 'warning') {
            summary.warningRollCount += 1;
            if (isOnline) {
                summary.onlineWarningRollCount += 1;
            }
        }
    });

    return summaryByStand;
}

function getStandSupplyRisk(summary) {
    const usableSpareCount = summary.newSpareCount + summary.usedSpareCount;
    const pendingSpareCount = summary.reworkingCount + summary.reworkWaitingCount;

    if (summary.onlineDangerRollCount > 0 && usableSpareCount === 0) {
        return {
            risk: STAND_RISK_LEVELS.danger,
            reason: 'オンライン危険ロールあり、使用可能予備なし'
        };
    }

    if (summary.onlineCount === 0) {
        return {
            risk: STAND_RISK_LEVELS.danger,
            reason: 'オンラインロールなし'
        };
    }

    if (summary.onlineActionRollCount > 0 && usableSpareCount === 0) {
        return {
            risk: STAND_RISK_LEVELS.action,
            reason: 'オンライン残り1回、使用可能予備なし'
        };
    }

    if (usableSpareCount === 0 && pendingSpareCount > 0) {
        return {
            risk: STAND_RISK_LEVELS.warning,
            reason: '予備はあるが即使用可能予備なし'
        };
    }

    if (summary.onlineCount > 0 && usableSpareCount <= 1) {
        return {
            risk: STAND_RISK_LEVELS.action,
            reason: usableSpareCount === 0 ? 'オンラインあり、使用可能予備なし' : 'オンラインあり、予備1本のみ'
        };
    }

    if (summary.onlineWarningRollCount > 0) {
        return {
            risk: STAND_RISK_LEVELS.warning,
            reason: 'オンライン残り2回'
        };
    }

    return null;
}

function getStandRiskMapItems() {
    const riskByStand = new Map(STAND_RISK_STANDS.map(standKey => [standKey, createInitialStandRiskState()]));
    const dangerItems = getDangerRollItems(roles);
    const supplySummaries = getStandSupplySummaries(roles, dangerItems);

    dangerItems.forEach(item => {
        const standKey = getStandKey(item.role && item.role.name);
        const levelKey = item.level && item.level.key;
        applyWorseStandRisk(
            riskByStand,
            standKey,
            getStandRiskFromDangerRollLevel(levelKey),
            getStandRiskReasonFromDangerRollLevel(levelKey)
        );
    });

    getCuttingAnomalyItems().forEach(item => {
        const standKey = getStandKey(item.stand);
        applyWorseStandRisk(
            riskByStand,
            standKey,
            getStandRiskFromCuttingAnomaly(item.judgmentKey),
            getStandRiskReasonFromCuttingAnomaly(item.judgmentKey)
        );
    });

    supplySummaries.forEach((summary, standKey) => {
        const supplyRisk = getStandSupplyRisk(summary);
        if (supplyRisk) {
            applyWorseStandRisk(riskByStand, standKey, supplyRisk.risk, supplyRisk.reason);
        }
    });

    return STAND_RISK_STANDS.map(standKey => {
        const state = riskByStand.get(standKey) || createInitialStandRiskState();
        const summary = supplySummaries.get(standKey) || createStandSupplySummary();

        return {
            standKey,
            risk: state.risk,
            reasons: state.reasons.length > 0 ? state.reasons : ['供給リスクなし'],
            summary
        };
    });
}

function updateStandRiskMap() {
    const listEl = document.getElementById('stand-risk-map-list');

    if (!listEl) {
        return;
    }

    listEl.innerHTML = getStandRiskMapItems().map(item => `
        <button type="button" class="stand-risk-item stand-risk-${escapeHtml(item.risk.key)}" onclick="filterWatchStand('${escapeHtml(item.standKey)}')">
            <span class="stand-risk-main">
                <span class="stand-risk-stand">#${escapeHtml(item.standKey)}</span>
                <span class="stand-risk-label">${escapeHtml(item.risk.label)}</span>
            </span>
            <span class="stand-risk-reason">理由：${escapeHtml(item.reasons.join('・'))}</span>
        </button>
    `).join('');
}

function getTopPriorityStandRiskGroup() {
    const items = getStandRiskMapItems()
        .filter(item => item.risk && item.risk.key !== 'normal')
        .slice()
        .sort((a, b) => {
            if (a.risk.order !== b.risk.order) {
                return a.risk.order - b.risk.order;
            }

            return Number(a.standKey) - Number(b.standKey);
        });

    if (items.length === 0) {
        return null;
    }

    const topOrder = items[0].risk.order;
    const topItems = items.filter(item => item.risk.order === topOrder);

    return {
        risk: topItems[0].risk,
        items: topItems,
        firstItem: topItems[0]
    };
}

function updatePriorityStandCard() {
    const cardEl = document.getElementById('priority-stand-card');

    if (!cardEl) {
        return;
    }

    const group = getTopPriorityStandRiskGroup();

    if (!group) {
        cardEl.innerHTML = `
            <div class="priority-stand-empty">現在、優先対応スタンドはありません</div>
        `;
        cardEl.classList.add('is-empty');
        return;
    }

    cardEl.classList.remove('is-empty');
    const standListText = group.items.map(item => `#${escapeHtml(item.standKey)}`).join(' / ');
    const countText = `${escapeHtml(group.risk.label)} ${group.items.length}件`;
    cardEl.innerHTML = `
        <div class="priority-stand-level">${countText}</div>
        <div class="priority-stand-stands">${standListText}</div>
        <div class="priority-stand-name">まず見る：#${escapeHtml(group.firstItem.standKey)}</div>
        <div class="priority-stand-reason">理由：${escapeHtml(group.firstItem.reasons.join('・'))}</div>
        <button type="button" class="priority-stand-button" onclick="filterWatchStand('${escapeHtml(group.firstItem.standKey)}')">このスタンドを見る</button>
    `;
}

function normalizeDateInputValue(value) {
    const normalized = value === undefined || value === null ? '' : String(value).trim();

    if (!normalized) {
        return '';
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDaysToDateString(dateValue, days) {
    const normalized = normalizeDateInputValue(dateValue);

    if (!normalized) {
        return '';
    }

    const date = new Date(`${normalized}T00:00:00`);
    date.setDate(date.getDate() + days);
    return normalizeDateInputValue(date.toISOString());
}

function formatDateForDisplay(value) {
    const normalized = normalizeDateInputValue(value);

    if (!normalized) {
        return '-';
    }

    const [year, month, day] = normalized.split('-');
    return `${year}/${month}/${day}`;
}

function getInboundPlanDate(dispatchDate) {
    return addDaysToDateString(dispatchDate, REWORKING_CONFIRM_THRESHOLD_DAYS);
}

function getTemporaryInboundPlanDate(dispatchDate) {
    return addDaysToDateString(dispatchDate, TEMP_INBOUND_PLAN_DAYS);
}

function getRoleWorkProgress(role) {
    return normalizeWorkProgress(role);
}

function getRoleDispatchDate(role) {
    const progress = getRoleWorkProgress(role);
    return progress.dispatchDate || normalizeDateInputValue(role && role.dispatchDate);
}

function getRoleArrivalDate(role) {
    const progress = getRoleWorkProgress(role);
    return progress.arrivalDate || '';
}

function addMonthsToDateString(dateValue, months) {
    const normalized = normalizeDateInputValue(dateValue);
    const monthCount = Number(months);

    if (!normalized || !Number.isFinite(monthCount)) {
        return '';
    }

    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const originalDay = date.getDate();
    date.setMonth(date.getMonth() + monthCount);

    if (date.getDate() !== originalDay) {
        date.setDate(0);
    }

    return normalizeDateInputValue(date.toISOString());
}

function isDispatchDateAllowedStatus(status) {
    return status === REWORK_READY_STATUS || status === REWORKING_STATUS;
}

function getTodayDateString() {
    const now = new Date();
    const pad = number => String(number).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeUseStartDate(value) {
    if (value === undefined || value === null) {
        return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatUseStartDateDate(value);
    }

    const text = String(value).trim();

    if (!text) {
        return '';
    }

    const ymdMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
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
            return formatUseStartDateDate(date);
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
                return formatUseStartDateDate(date);
            }
        }
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        return formatUseStartDateDate(parsed);
    }

    return text;
}

function formatUseStartDateDate(date) {
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function formatUseStartDate(value) {
    const normalized = normalizeUseStartDate(value);

    if (!normalized) {
        return '-';
    }

    return normalized;
}

function setUseStartDateIfNeeded(role, at = new Date().toISOString(), options = {}) {
    if (!role || role.status !== ONLINE_STATUS || normalizeUseStartDate(role.useStartDate)) {
        return false;
    }

    const useStartDate = getTodayDateString();
    role.useStartDate = useStartDate;
    addRoleHistoryEntry(role, 'useStartDate', '使用開始日自動設定', '-', formatUseStartDate(useStartDate), at, options);
    return true;
}

function addRoleHistoryEntry(role, type, label, beforeValue, afterValue, at = new Date().toISOString(), options = {}) {
    if (!role) {
        return;
    }

    const beforeText = String(beforeValue || '');
    const afterText = String(afterValue || '');

    if (beforeText === afterText) {
        return;
    }

    const entry = {
        at,
        roleName: role.name || '',
        type,
        label,
        before: beforeText || '-',
        after: afterText || '-'
    };
    const operator = getHistoryOperator();

    if (operator && !options.skipOperator) {
        entry.operator = operator;
    }

    role.history = normalizeRoleHistory(role);
    role.history.push(entry);
}

function loadLocalRoles() {
    roles = JSON.parse(localStorage.getItem('roles')) || [];
    roles = roles.map(role => {
        const workProgress = normalizeWorkProgress(role);

        return {
            ...role,
            updatedAt: role.updatedAt || new Date().toISOString(),
            memo: role.memo || '',
            status: normalizeRoleStatusValue(role.status),
            coatingStatus: normalizeCoatingStatusValue(role.coatingStatus, role.status),
            useStartDate: normalizeUseStartDate(role.useStartDate),
            dispatchDate: workProgress.dispatchDate || normalizeDateInputValue(role.dispatchDate),
            currentDiameter: normalizeCurrentDiameter(role.currentDiameter),
            workProgress,
            history: normalizeRoleHistory(role),
            requestSent: role.requestSent === true || isWorkProgressStepDone(workProgress, 'vendorSentAt')
        };
    });
    migrateLegacyThreeSetManagementReworkChecklistToRoles();
    fixOnlineDuplicates();
    const ids = roles.map(r => Number(r.id) || 0);
    nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
}
window.loadRoles = loadLocalRoles;
function fixOnlineDuplicates() {
    const groups = {};
    roles.forEach(role => {
        const group = getGroup(role.name);
        if (!groups[group]) groups[group] = [];
        groups[group].push(role);
    });
    Object.values(groups).forEach(groupRoles => {
        const onlineRoles = groupRoles.filter(r => r.status === 'オンライン').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        if (onlineRoles.length > 1) {
            for (let i = 1; i < onlineRoles.length; i++) {
                addRoleHistoryEntry(onlineRoles[i], 'status', 'ステータス変更', onlineRoles[i].status, '中古予備（バラシ前）', new Date().toISOString(), { skipOperator: true });
                onlineRoles[i].status = '中古予備（バラシ前）';
            }
        }
    });
    saveLocalRoles();
}

function getGroup(name) {
    return String(name || '').split('-')[0];
}

loadLocalRoles();

function changeSort(event) {
    sortOption = event.target.value;
    renderRoles();
}

function getUpdatedTimestamp(role) {
    const timestamp = new Date(role.updatedAt).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

function compareUpdatedAt(a, b, direction = 'desc') {
    const aTime = getUpdatedTimestamp(a);
    const bTime = getUpdatedTimestamp(b);
    if (aTime === null && bTime === null) {
        return 0;
    }
    if (aTime === null) {
        return 1;
    }
    if (bTime === null) {
        return -1;
    }
    return direction === 'asc' ? aTime - bTime : bTime - aTime;
}

function formatUpdatedAt(updatedAt) {
    const updatedDate = new Date(updatedAt);
    if (Number.isNaN(updatedDate.getTime())) {
        return '-';
    }
    return updatedDate.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getWorkProgressCompletedCount(role) {
    const progress = normalizeWorkProgress(role);
    return WORK_PROGRESS_STEPS.filter(step => isWorkProgressStepDone(progress, step.key)).length;
}

function getWorkProgressState(role) {
    const progress = normalizeWorkProgress(role);
    const completedCount = getWorkProgressCompletedCount(role);
    const totalCount = WORK_PROGRESS_STEPS.length;
    const hasProgressValue = WORK_PROGRESS_STEPS.some(step => isWorkProgressStepDone(progress, step.key));
    const hasWorkRequest = role.status === REWORK_READY_STATUS || hasProgressValue || role.requestSent === true;

    return {
        hasWorkRequest,
        completedCount,
        totalCount,
        isIncomplete: hasWorkRequest && completedCount < totalCount,
        isComplete: hasWorkRequest && completedCount >= totalCount
    };
}

function isWorkProgressStepEnabled(role, index) {
    if (!role || role.status !== REWORK_READY_STATUS) {
        return false;
    }

    if (index === 0) {
        return true;
    }

    const progress = normalizeWorkProgress(role);
    const previousStep = WORK_PROGRESS_STEPS[index - 1];
    return isWorkProgressStepDone(progress, previousStep.key);
}

function formatProgressTimestamp(value) {
    const updatedAt = value && typeof value === 'object' ? value.updatedAt : value;
    return updatedAt ? formatUpdatedAt(updatedAt) : '';
}

function getWorkProgressHtml(role) {
    if (role.status !== REWORK_READY_STATUS) {
        return '';
    }

    const progress = normalizeWorkProgress(role);
    const roleKey = getThreeSetManagementReworkRoleKey(role);
    const completedCount = getWorkProgressCompletedCount(role);
    const stepsHtml = WORK_PROGRESS_STEPS.map((step, index) => {
        const completedAt = getWorkProgressStepUpdatedAt(progress, step.key);
        const completedBy = getWorkProgressStepUpdatedBy(progress, step.key);
        const isDone = isWorkProgressStepDone(progress, step.key);
        const isEnabled = isWorkProgressStepEnabled(role, index);
        const disabled = isDone || !isEnabled;
        const title = isDone
            ? `${step.label}: ${formatProgressTimestamp(completedAt)}`
            : step.label;

        if (step.key === PICKUP_ADJUSTED_STEP_KEY) {
            return getReworkPickupChecklistItemHtml(roleKey, step, index, progress, {
                isEnabled,
                itemClass: 'progress-step-btn'
            });
        }

        return `
            <button
                type="button"
                class="progress-step-btn ${isDone ? 'is-done' : ''}"
                onclick="completeWorkProgressStep('${role.id}', '${step.key}')"
                ${disabled ? 'disabled' : ''}
                title="${escapeHtml(title)}"
            >
                <span class="progress-step-index">${index + 1}</span>
                <span class="progress-step-label">${escapeHtml(step.label)}</span>
                ${isDone ? `
                    <span class="progress-step-date">${escapeHtml(formatProgressTimestamp(completedAt))}</span>
                    <span class="progress-step-date">更新者：${escapeHtml(completedBy || '未設定')}</span>
                ` : ''}
            </button>
        `;
    }).join('');

    return `
        <div class="work-progress" aria-label="作業依頼進捗">
            <div class="work-progress-summary">作業依頼進捗 ${completedCount}/${WORK_PROGRESS_STEPS.length}</div>
            <div class="work-progress-steps">${stepsHtml}</div>
        </div>
    `;
}

function getLevelBadge(level) {
    const badges = {
        '管理者': '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">👑 管理者</span>',
        '編集者': '<span style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">✏️ 編集者</span>',
        '閲覧者': '<span style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">👁️ 閲覧者</span>'
    };
    return badges[level] || '-';
}

function getStatusClass(status) {
    const statusClasses = {
        'オンライン': 'status-online',
        '中古予備（バラシ前）': 'status-used-standby',
        '改削行き（搬出可能）': 'status-rework-ready',
        '改削中': 'status-reworking',
        '新品予備（組替可能）': 'status-new-ready',
        '新品予備（組込完了）': 'status-new-done',
        '新品予備保管': 'status-new-storage',
        '廃却待ち（ラック保管）': 'status-scrap-waiting',
        '廃棄': 'status-discarded'
    };
    return statusClasses[status] || 'status-other';
}

function getStatusBadge(status) {
    const className = getStatusClass(status);
    return `<span class="status-badge ${className}">${escapeHtml(status || '-')}</span>`;
}

function getReworkJudgment(role) {
    const standNumber = Number(getStandKey(role.name));
    const scrapDiameter = REWORK_JUDGMENT_SCRAP_DIAMETERS[standNumber];
    const currentDiameter = normalizeCurrentDiameter(role.currentDiameter);

    if (!scrapDiameter || currentDiameter === '') {
        return null;
    }

    const predictedDiameter = currentDiameter - REWORK_JUDGMENT_AVERAGE_CUT_MM;
    const isReworkable = predictedDiameter > scrapDiameter;

    return {
        label: isReworkable ? '改削可能' : '廃却待ち候補',
        className: isReworkable ? 'is-reworkable' : 'is-scrap-candidate'
    };
}

function getReworkJudgmentHtml(role) {
    const judgment = getReworkJudgment(role);

    if (!judgment) {
        return '';
    }

    return `<div class="rework-judgment ${judgment.className}">${escapeHtml(judgment.label)}</div>`;
}

function updateStatusPreview(selectEl) {
    if (!selectEl) {
        return;
    }
    const statusClasses = [
        'status-empty',
        'status-online',
        'status-used-standby',
        'status-rework-ready',
        'status-reworking',
        'status-new-ready',
        'status-new-done',
        'status-new-storage',
        'status-scrap-waiting',
        'status-discarded',
        'status-other'
    ];
    const previewEl = document.getElementById('role-status-preview');
    const selectedStatus = selectEl.value;

    selectEl.classList.toggle('status-empty', !selectedStatus);
    if (!previewEl) {
        return;
    }

    previewEl.classList.remove(...statusClasses);
    previewEl.classList.add(selectedStatus ? getStatusClass(selectedStatus) : 'status-empty');
    previewEl.textContent = `現在のステータス：${selectedStatus || '未選択'}`;
    updateDispatchDateFieldState(selectedStatus);
    updateCoatingStatusFieldState(selectedStatus);
}

function updateDispatchDateFieldState(status) {
    const field = document.querySelector('.dispatch-date-field');
    const dispatchInput = document.getElementById('role-dispatch-date');
    const isAllowed = isDispatchDateAllowedStatus(status);

    if (!field || !dispatchInput) {
        return;
    }

    field.classList.toggle('is-hidden', !isAllowed);
    field.setAttribute('aria-hidden', isAllowed ? 'false' : 'true');
    dispatchInput.disabled = !isAllowed;

    if (!isAllowed) {
        dispatchInput.value = '';
    }

    updateInboundPlanPreview();
}

function updateInboundPlanPreview() {
    const dispatchInput = document.getElementById('role-dispatch-date');
    const previewEl = document.getElementById('role-inbound-plan-preview');

    if (!dispatchInput || !previewEl) {
        return;
    }

    const inboundPlanDate = getInboundPlanDate(dispatchInput.value);
    previewEl.textContent = formatDateForDisplay(inboundPlanDate);
}

function getMemoPreview(memo) {
    const normalized = (memo || '').replace(/\n/g, ' ').trim();
    if (!normalized) {
        return '-';
    }
    return normalized.length > 50 ? normalized.slice(0, 50) + '…' : normalized;
}

function hasDisplayMemo(memo) {
    const normalized = (memo || '').replace(/\n/g, ' ').trim();
    return Boolean(normalized) && normalized !== '-';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getRollSymbol(roleName) {
    const parts = String(roleName || '')
        .replace(/^#/, '')
        .split('-')
        .map(part => part.trim())
        .filter(Boolean);
    const symbol = parts.length > 2 ? parts[parts.length - 1] : '';
    return symbol && /[^\d.]/.test(symbol) ? symbol : '-';
}

function getRoleInfoHtml(role, formattedDate) {
    const memo = getMemoPreview(role.memo);
    const dispatchDate = getRoleDispatchDate(role);
    const arrivalDate = getRoleArrivalDate(role);
    const coatingDisplay = getCoatingStatusDisplay(role);
    const rows = [
        ['使用開始日', formatUseStartDate(role.useStartDate)],
        ['最終更新', formattedDate]
    ];

    if (coatingDisplay) {
        rows.push(['溶射状態', coatingDisplay.note ? `${coatingDisplay.label} / ${coatingDisplay.note}` : coatingDisplay.label]);
    }

    if (dispatchDate) {
        rows.push(['搬出日', formatDateForDisplay(dispatchDate)]);
        if (arrivalDate) {
            rows.push(['搬入日', formatDateForDisplay(arrivalDate)]);
        } else {
            rows.push(['仮搬入予定', formatDateForDisplay(getTemporaryInboundPlanDate(dispatchDate))]);
        }
    }

    if (hasDisplayMemo(role.memo)) {
        rows.push(['備考', memo]);
    }

    return rows.map(([label, value]) => `
        <div class="role-info-item">
            <span class="role-info-label">${escapeHtml(label)}</span>
            <span class="role-info-value">${escapeHtml(value)}</span>
        </div>
    `).join('');
}

function showMemo(id) {
    const role = roles.find(r => String(r.id) === String(id));
    if (!role) {
        alert('ロールが見つかりません');
        return;
    }

    document.getElementById('detail-stand-name').textContent = role.name || '-';
    document.getElementById('detail-status').innerHTML = getStatusBadge(role.status);
    document.getElementById('detail-updated-at').textContent = formatUpdatedAt(role.updatedAt);
    document.getElementById('detail-memo').textContent = role.memo || 'メモはありません';

    const modal = document.getElementById('detail-modal');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function showHistory(id) {
    const role = roles.find(r => String(r.id) === String(id));
    if (!role) {
        alert('ロールが見つかりません');
        return;
    }

    const modal = document.getElementById('history-modal');
    const title = document.getElementById('history-stand-name');
    const list = document.getElementById('history-list');
    const history = normalizeRoleHistory(role).slice().sort((a, b) => {
        return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    if (!modal || !title || !list) {
        return;
    }

    title.textContent = role.name || '-';

    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">履歴はありません</div>';
    } else {
        list.innerHTML = history.map(entry => `
            <div class="history-entry">
                <div class="history-entry-header">
                    <strong>${escapeHtml(entry.label || '変更')}</strong>
                    <span>${escapeHtml(formatUpdatedAt(entry.at))}</span>
                </div>
                <div class="history-entry-body">
                    <div><span>対象</span>${escapeHtml(entry.roleName || role.name || '-')}</div>
                    <div><span>担当者</span>${escapeHtml(getOperatorNameForDisplay(entry))}</div>
                    <div><span>変更前</span>${escapeHtml(entry.before || '-')}</div>
                    <div><span>変更後</span>${escapeHtml(entry.after || '-')}</div>
                </div>
            </div>
        `).join('');
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (!modal) {
        return;
    }
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (!modal) {
        return;
    }
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    closeHistoryModal();
}

function searchRoles(event) {
    searchQuery = event.target.value || '';
    watchStandFilter = null;

    if (searchQuery.trim().length > 0) {
        resetStatusFilter();
    }

    renderRoles();
}

function clearSearch() {
    searchQuery = '';
    watchStandFilter = null;
    const searchInput = document.getElementById('role-search');
    if (searchInput) {
        searchInput.value = '';
    }
    renderRoles();
}

function changeStatusFilter(event) {
    statusFilter = event.target.value || 'all';
    watchStandFilter = null;
    renderRoles();
}

function resetStatusFilter() {
    statusFilter = 'all';
    const statusFilterSelect = document.getElementById('status-filter');
    if (statusFilterSelect) {
        statusFilterSelect.value = 'all';
    }
}
function setSummaryFilter(filterValue) {
    statusFilter = filterValue || 'all';
    watchStandFilter = null;

    const statusFilterSelect = document.getElementById('status-filter');

    if (statusFilterSelect) {
        statusFilterSelect.value = statusFilter;
    }

    renderRoles();
}

function showAllRoles() {
    searchQuery = '';
    watchStandFilter = null;
    const searchInput = document.getElementById('role-search');
    if (searchInput) {
        searchInput.value = '';
    }
    resetStatusFilter();
    renderRoles();
}

function isStatusMatched(role) {
    const status = normalizeRoleStatusValue(role.status);

    if (statusFilter === 'all') {
        return true;
    }

    return status === normalizeRoleStatusValue(statusFilter);
}

function getStatusSummaryCategory(role) {
    const status = normalizeRoleStatusValue(role.status);

    if (status === 'オンライン') {
        return 'online';
    }

    if (status === '改削中') {
        return 'reworking';
    }

    if (status === '中古予備（バラシ前）') {
        return 'used';
    }

    if (status === '改削行き（搬出可能）') {
        return 'remove';
    }

    if (status === '新品予備（組替可能）') {
        return 'newReady';
    }

    if (status === '新品予備（組込完了）') {
        return 'newInstalled';
    }

    if (status === NEW_STORAGE_STATUS) {
        return 'newStorage';
    }

    if (status === SCRAP_WAITING_STATUS) {
        return 'scrapWaiting';
    }

    if (status === DISCARDED_STATUS) {
        return 'discarded';
    }

    return 'other';
}

function updateCountSummary(allRoles = roles) {
    const summary = {
    total: allRoles.length,
    online: 0,
    reworking: 0,
    used: 0,
    remove: 0,
    newReady: 0,
    newInstalled: 0,
    newStorage: 0,
    scrapWaiting: 0,
    discarded: 0,
    other: 0
};

    allRoles.forEach(role => {
        const category = getStatusSummaryCategory(role);
        if (Object.prototype.hasOwnProperty.call(summary, category)) {
            summary[category] += 1;
        }
    });

    Object.entries(summary).forEach(([key, value]) => {

    const summaryMap = {
        remove: 'summary-remove',
        newReady: 'summary-new-ready',
        newInstalled: 'summary-new-installed',
        newStorage: 'summary-new-storage',
        scrapWaiting: 'summary-scrap-waiting',
        discarded: 'summary-discarded'
    };

    const targetId = summaryMap[key] || `summary-${key}`;

    const summaryEl = document.getElementById(targetId);

    if (summaryEl) {
        summaryEl.textContent = `${value}件`;
    }
});
}

function getStandKey(roleName) {
    const match = String(roleName || '').match(/#?(\d+)(?:-|$)/);
    return match ? match[1] : '';
}

function isWatchStandMatched(role) {
    if (!watchStandFilter) {
        return true;
    }

    return getStandKey(role.name) === watchStandFilter;
}

function isThreeSetForecastStandKey(standKey) {
    const standNumber = Number(getStandKey(standKey));
    return standNumber >= THREE_SET_FORECAST_MIN_STAND && standNumber <= THREE_SET_FORECAST_MAX_STAND;
}

function getThreeSetForecastStandKeys() {
    const standKeys = [];

    for (let standNumber = THREE_SET_FORECAST_MIN_STAND; standNumber <= THREE_SET_FORECAST_MAX_STAND; standNumber += 1) {
        standKeys.push(String(standNumber));
    }

    return standKeys;
}

function getThreeSetForecastRoleLabel(role) {
    if (!role) {
        return '-';
    }

    return role.name || `#${getStandKey(role.name) || '-'}`;
}

function getThreeSetForecastCutInfo(role) {
    const info = getRemainingDiameterInfo(role);

    if (!info || info.adoptedCutMm === '' || !Number.isFinite(info.adoptedCutMm)) {
        return {
            isKnown: false,
            isReworkableAfterNextCut: null
        };
    }

    return {
        isKnown: true,
        isReworkableAfterNextCut: (info.currentDiameter - info.adoptedCutMm) > info.scrapDiameter
    };
}

function getThreeSetForecastReworkReturnDate(role, today = getTodayDateString()) {
    if (!role) {
        return '';
    }

    const dispatchDate = getRoleDispatchDate(role);

    if (role.status === REWORKING_STATUS) {
        if (dispatchDate) {
            return addDaysToDateString(dispatchDate, REWORK_SETUP_REWORK_DAYS);
        }

        const startedAt = normalizeDateInputValue(getRoleStatusChangedAt(role, REWORKING_STATUS));
        return startedAt ? addDaysToDateString(startedAt, REWORK_SETUP_REWORK_DAYS) : '';
    }

    if (role.status === REWORK_READY_STATUS) {
        const pickupDate = dispatchDate || addDaysToDateString(today, REWORK_SETUP_DISPATCH_READY_DAYS);
        return pickupDate ? addDaysToDateString(pickupDate, REWORK_SETUP_REWORK_DAYS) : '';
    }

    if (role.status === USED_STANDBY_STATUS) {
        const pickupDate = addDaysToDateString(today, REWORK_SETUP_DISPATCH_READY_DAYS);
        return pickupDate ? addDaysToDateString(pickupDate, REWORK_SETUP_REWORK_DAYS) : '';
    }

    return '';
}

function sortThreeSetForecastRoleCandidates(a, b) {
    const aDate = a.readyDate || '9999-12-31';
    const bDate = b.readyDate || '9999-12-31';

    if (aDate !== bDate) {
        return aDate.localeCompare(bDate);
    }

    return compareUpdatedAt(a.role, b.role, 'desc');
}

function getThreeSetForecastCandidate(standRoles, useEndDate, today = getTodayDateString()) {
    const availableStatuses = [
        {
            status: NEW_INSTALLED_STATUS,
            judgment: '維持可能',
            className: 'is-maintainable',
            reason: '',
            action: '次回オンライン候補を確認'
        },
        {
            status: NEW_READY_STATUS,
            judgment: '要段取り',
            className: 'is-action',
            reason: '新品予備（組替可能）あり',
            action: '組替予定を確認'
        }
    ];

    for (const candidateStatus of availableStatuses) {
        const role = standRoles
            .filter(item => item.status === candidateStatus.status)
            .sort(compareRolesByStandRole)[0];

        if (role) {
            return {
                role,
                readyDate: useEndDate,
                judgment: candidateStatus.judgment,
                className: candidateStatus.className,
                reason: candidateStatus.reason,
                action: `${getThreeSetForecastRoleLabel(role)}の${candidateStatus.action}`
            };
        }
    }

    const reworkCandidates = standRoles
        .filter(role => role.status === REWORKING_STATUS || role.status === REWORK_READY_STATUS)
        .map(role => ({
            role,
            readyDate: getThreeSetForecastReworkReturnDate(role, today),
            cutInfo: getThreeSetForecastCutInfo(role)
        }))
        .sort(sortThreeSetForecastRoleCandidates);
    const reworkCandidate = reworkCandidates[0];

    if (reworkCandidate) {
        if (!reworkCandidate.cutInfo.isKnown) {
            return {
                role: reworkCandidate.role,
                readyDate: reworkCandidate.readyDate,
                judgment: '要確認',
                className: 'is-check',
                reason: '改削可否データ不足',
                action: `${getThreeSetForecastRoleLabel(reworkCandidate.role)}の現在径・廃却径・改削量を確認`
            };
        }

        if (reworkCandidate.cutInfo.isReworkableAfterNextCut === false) {
            return {
                role: reworkCandidate.role,
                readyDate: reworkCandidate.readyDate,
                judgment: '不足見込み',
                className: 'is-shortage',
                reason: '改削後に廃却径以下となる見込み',
                action: '購入確認または4セット目確認'
            };
        }

        if (!reworkCandidate.readyDate) {
            return {
                role: reworkCandidate.role,
                readyDate: '',
                judgment: '要確認',
                className: 'is-check',
                reason: '改削戻り予定を算出できません',
                action: `${getThreeSetForecastRoleLabel(reworkCandidate.role)}の搬出日・改削状況を確認`
            };
        }

        if (reworkCandidate.readyDate <= useEndDate) {
            return {
                role: reworkCandidate.role,
                readyDate: reworkCandidate.readyDate,
                judgment: '要段取り',
                className: 'is-action',
                reason: `改削戻り見込み ${formatDateForDisplay(reworkCandidate.readyDate)}`,
                action: `${getThreeSetForecastRoleLabel(reworkCandidate.role)}の改削戻り・組替確認`
            };
        }

        return {
            role: reworkCandidate.role,
            readyDate: reworkCandidate.readyDate,
            judgment: '不足見込み',
            className: 'is-shortage',
            reason: `改削戻りが次回終了予定を超過（${formatDateForDisplay(reworkCandidate.readyDate)}戻り見込み）`,
            action: '購入確認または4セット目確認'
        };
    }

    const storageRole = standRoles
        .filter(role => role.status === NEW_STORAGE_STATUS)
        .sort(compareRolesByStandRole)[0];

    if (storageRole) {
        return {
            role: storageRole,
            readyDate: useEndDate,
            judgment: '要確認',
            className: 'is-check',
            reason: '新品予備保管あり',
            action: `${getThreeSetForecastRoleLabel(storageRole)}を組替候補にできるか確認`
        };
    }

    const usedCandidates = standRoles
        .filter(role => role.status === USED_STANDBY_STATUS)
        .map(role => ({
            role,
            readyDate: getThreeSetForecastReworkReturnDate(role, today),
            cutInfo: getThreeSetForecastCutInfo(role)
        }))
        .sort(sortThreeSetForecastRoleCandidates);
    const usedCandidate = usedCandidates[0];

    if (usedCandidate) {
        if (!usedCandidate.cutInfo.isKnown) {
            return {
                role: usedCandidate.role,
                readyDate: usedCandidate.readyDate,
                judgment: '要確認',
                className: 'is-check',
                reason: '中古予備の改削可否データ不足',
                action: `${getThreeSetForecastRoleLabel(usedCandidate.role)}の現在径・廃却径・改削量を確認`
            };
        }

        if (usedCandidate.cutInfo.isReworkableAfterNextCut === false) {
            return {
                role: usedCandidate.role,
                readyDate: usedCandidate.readyDate,
                judgment: '不足見込み',
                className: 'is-shortage',
                reason: '中古予備が改削後に廃却径以下となる見込み',
                action: '購入確認または4セット目確認'
            };
        }

        if (usedCandidate.readyDate && usedCandidate.readyDate <= useEndDate) {
            return {
                role: usedCandidate.role,
                readyDate: usedCandidate.readyDate,
                judgment: '要段取り',
                className: 'is-action',
                reason: `中古予備を改削すれば間に合う見込み（${formatDateForDisplay(usedCandidate.readyDate)}戻り）`,
                action: `${getThreeSetForecastRoleLabel(usedCandidate.role)}のバラシ・搬出・改削手配`
            };
        }
    }

    return null;
}

function getThreeSetForecastPurchaseAction(standKey) {
    const standMaster = typeof getStandMaster === 'function' ? getStandMaster(standKey) : null;
    const leadTimeMonths = standMaster && standMaster.leadTimeMonths !== ''
        ? Number(standMaster.leadTimeMonths)
        : null;

    return Number.isFinite(leadTimeMonths)
        ? `購入確認または4セット目確認（購入LT${leadTimeMonths}か月）`
        : '購入確認または4セット目確認';
}

function getThreeSetForecastItem(standKey, allRoles = roles) {
    const standRoles = (Array.isArray(allRoles) ? allRoles : [])
        .filter(role => getStandKey(role && role.name) === String(standKey))
        .filter(role => role.status !== DISCARDED_STATUS)
        .sort(compareRolesByStandRole);
    const onlineRoles = standRoles
        .filter(role => role.status === ONLINE_STATUS)
        .sort((a, b) => compareUpdatedAt(a, b, 'desc'));
    const onlineRole = onlineRoles[0] || null;
    const useEndDate = getOnlineUseEndDate(onlineRole);

    if (!onlineRole) {
        return {
            standKey,
            judgment: 'データ不足',
            className: 'is-missing',
            useEndDate: '',
            onlineRoleName: '-',
            nextCandidateName: '-',
            reason: 'オンラインロールがありません',
            action: 'オンラインロールを確認'
        };
    }

    if (!normalizeUseStartDate(onlineRole.useStartDate) || !useEndDate) {
        return {
            standKey,
            judgment: 'データ不足',
            className: 'is-missing',
            useEndDate: '',
            onlineRoleName: getThreeSetForecastRoleLabel(onlineRole),
            nextCandidateName: '-',
            reason: 'オンラインロールの使用開始日がありません',
            action: `${getThreeSetForecastRoleLabel(onlineRole)}の使用開始日を確認`
        };
    }

    const candidate = getThreeSetForecastCandidate(standRoles.filter(role => role !== onlineRole), useEndDate);

    if (candidate) {
        return {
            standKey,
            judgment: candidate.judgment,
            className: candidate.className,
            useEndDate,
            onlineRoleName: getThreeSetForecastRoleLabel(onlineRole),
            nextCandidateName: getThreeSetForecastRoleLabel(candidate.role),
            reason: candidate.reason || '次回オンライン候補あり',
            action: candidate.action
        };
    }

    return {
        standKey,
        judgment: '不足見込み',
        className: 'is-shortage',
        useEndDate,
        onlineRoleName: getThreeSetForecastRoleLabel(onlineRole),
        nextCandidateName: '-',
        reason: '次回オンライン候補が見つかりません',
        action: getThreeSetForecastPurchaseAction(standKey)
    };
}

function getThreeSetForecastItems(allRoles = roles) {
    return getThreeSetForecastStandKeys()
        .map(standKey => getThreeSetForecastItem(standKey, allRoles))
        .sort(compareThreeSetForecastItems);
}

function getThreeSetForecastPriorityRank(judgment) {
    const priority = {
        '不足見込み': 1,
        '要段取り': 2,
        '要確認': 3,
        'データ不足': 4,
        '維持可能': 5
    };

    return priority[judgment] || 99;
}

function compareThreeSetForecastItems(a, b) {
    const priorityDiff = getThreeSetForecastPriorityRank(a && a.judgment) - getThreeSetForecastPriorityRank(b && b.judgment);

    if (priorityDiff !== 0) {
        return priorityDiff;
    }

    return (Number(a && a.standKey) || 999999) - (Number(b && b.standKey) || 999999);
}

function getThreeSetForecastSummaryFieldHtml(label, value) {
    return `
        <div class="three-set-forecast-summary-field">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function getThreeSetForecastSupplement(item) {
    if (!item) {
        return '-';
    }

    if (item.judgment === '維持可能') {
        return '次回オンライン候補を確保済み';
    }

    if (item.judgment === '要段取り') {
        return '期限までに段取り状況を確認';
    }

    if (item.judgment === '要確認') {
        return '判断に必要な情報を確認';
    }

    if (item.judgment === 'データ不足') {
        return '予測に必要な登録情報を確認';
    }

    if (item.judgment === '不足見込み') {
        return '3セット維持が崩れる前に代替手段を確認';
    }

    return '-';
}

function normalizeThreeSetManagementTab(value) {
    const normalized = String(value || '').trim();
    return ['assembly', 'rework', 'purchase'].includes(normalized)
        ? normalized
        : THREE_SET_MANAGEMENT_DEFAULT_TAB;
}

function getStoredThreeSetManagementTab() {
    try {
        return normalizeThreeSetManagementTab(localStorage.getItem(THREE_SET_MANAGEMENT_ACTIVE_TAB_KEY));
    } catch (error) {
        console.error('getStoredThreeSetManagementTab error:', error);
        return THREE_SET_MANAGEMENT_DEFAULT_TAB;
    }
}

function saveThreeSetManagementTab(tabKey) {
    const normalized = normalizeThreeSetManagementTab(tabKey);

    try {
        localStorage.setItem(THREE_SET_MANAGEMENT_ACTIVE_TAB_KEY, normalized);
    } catch (error) {
        console.error('saveThreeSetManagementTab error:', error);
    }

    return normalized;
}

function getStoredThreeSetManagementReworkChecklist() {
    try {
        const value = JSON.parse(localStorage.getItem(THREE_SET_MANAGEMENT_REWORK_CHECKLIST_KEY) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
        console.error('getStoredThreeSetManagementReworkChecklist error:', error);
        return {};
    }
}

function saveThreeSetManagementReworkChecklist(checklist) {
    try {
        localStorage.setItem(THREE_SET_MANAGEMENT_REWORK_CHECKLIST_KEY, JSON.stringify(checklist || {}));
    } catch (error) {
        console.error('saveThreeSetManagementReworkChecklist error:', error);
        showToast('チェックリストの保存に失敗しました');
    }
}

function migrateLegacyThreeSetManagementReworkChecklistToRoles() {
    const checklist = getStoredThreeSetManagementReworkChecklist();

    if (!checklist || Object.keys(checklist).length === 0) {
        return false;
    }

    let migrated = false;

    roles.forEach(role => {
        if (!role || normalizeRoleStatusValue(role.status) !== REWORK_READY_STATUS) {
            return;
        }

        const roleKey = getThreeSetManagementReworkRoleKey(role);
        const legacyEntry = normalizeThreeSetManagementReworkChecklistEntry(checklist[roleKey]);

        if (!roleKey || !legacyEntry) {
            return;
        }

        role.workProgress = normalizeWorkProgress(role);

        THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.forEach(step => {
            if (!isWorkProgressStepDone(role.workProgress, step.key) && legacyEntry[step.key] && legacyEntry[step.key].done) {
                role.workProgress[step.key] = legacyEntry[step.key];
                migrated = true;
            }
        });
    });

    return migrated;
}

function getThreeSetManagementReworkRoleKey(role) {
    if (!role) {
        return '';
    }

    return String(role.id || role.name || '').trim();
}

function normalizeThreeSetManagementReworkChecklistEntry(entry) {
    const source = entry && typeof entry === 'object' ? { ...entry } : {};
    const normalized = {};

    Object.entries(LEGACY_REWORK_CHECKLIST_STEP_KEYS).forEach(([legacyKey, currentKey]) => {
        if (source[legacyKey] !== undefined && source[currentKey] === undefined) {
            source[currentKey] = source[legacyKey];
        }
    });

    THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.forEach(step => {
        const value = source[step.key];
        normalized[step.key] = normalizeWorkProgressStepState(value);
    });

    return normalized;
}

function getThreeSetManagementReworkRoleByKey(roleKey, allRoles = roles) {
    const key = String(roleKey || '').trim();

    if (!key) {
        return null;
    }

    return (Array.isArray(allRoles) ? allRoles : []).find(role => getThreeSetManagementReworkRoleKey(role) === key) || null;
}

function getLegacyThreeSetManagementReworkChecklistEntry(roleKey) {
    const checklist = getStoredThreeSetManagementReworkChecklist();
    return normalizeThreeSetManagementReworkChecklistEntry(checklist[roleKey]);
}

function getThreeSetManagementReworkChecklistEntry(roleOrKey) {
    const role = roleOrKey && typeof roleOrKey === 'object'
        ? roleOrKey
        : getThreeSetManagementReworkRoleByKey(roleOrKey);
    const progress = normalizeWorkProgress(role);

    if (!role) {
        return normalizeThreeSetManagementReworkChecklistEntry(null);
    }

    const legacyEntry = getLegacyThreeSetManagementReworkChecklistEntry(getThreeSetManagementReworkRoleKey(role));
    const merged = { ...progress };

    THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.forEach(step => {
        if (!isWorkProgressStepDone(merged, step.key) && legacyEntry[step.key] && legacyEntry[step.key].done) {
            merged[step.key] = legacyEntry[step.key];
        }
    });

    return normalizeThreeSetManagementReworkChecklistEntry(merged);
}

function getThreeSetManagementReworkChecklistCompletedCount(entry) {
    const normalized = normalizeThreeSetManagementReworkChecklistEntry(entry);
    return THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.filter(step => isWorkProgressStepDone(normalized, step.key)).length;
}

function getThreeSetManagementReworkNextChecklistStep(entry) {
    const normalized = normalizeThreeSetManagementReworkChecklistEntry(entry);
    return THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.find(step => !normalized[step.key].done) || null;
}

function getThreeSetManagementEmptySummary(label) {
    return {
        count: 0,
        status: '対応なし',
        nextAction: `${label}タスクはありません`
    };
}

function getThreeSetManagementAssemblyItems(allRoles = roles) {
    return getAssemblyCandidateItems(allRoles)
        .map(candidate => ({
            ...candidate,
            details: getWorkshopBoardCandidateDetails(candidate)
        }))
        .sort(compareWorkshopBoardCandidates)
        .map(candidate => ({
            key: `assembly-${candidate.standKey}`,
            standKey: candidate.standKey,
            title: `#${candidate.standKey} 組替`,
            removeSide: candidate.usedRoles
                .map(role => `${role.name || '-'} ${USED_STANDBY_STATUS}`)
                .join('\n') || '-',
            installSide: candidate.newReadyRoles
                .map(role => `${role.name || '-'} ${NEW_READY_STATUS}`)
                .join('\n') || '-',
            deadline: candidate.details.estimatedReplacementDate,
            status: '依頼前',
            action: '工作課へ組替依頼',
            meta: candidate.details.remainingDaysLabel
        }));
}

function getThreeSetManagementReworkFieldHtml(label, value) {
    return `
        <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function getThreeSetManagementReworkItems(allRoles = roles) {
    return (Array.isArray(allRoles) ? allRoles : [])
        .filter(role => role && normalizeRoleStatusValue(role.status) === REWORK_READY_STATUS)
        .map(role => {
            const status = normalizeRoleStatusValue(role.status);
            const standKey = getStandKey(role.name);
            const roleKey = getThreeSetManagementReworkRoleKey(role);
            const checklist = getThreeSetManagementReworkChecklistEntry(role);
            const nextChecklistStep = getThreeSetManagementReworkNextChecklistStep(checklist);
            const checklistAction = nextChecklistStep ? nextChecklistStep.label : '引き取り日調整まで完了';
            const checklistCompletedCount = getThreeSetManagementReworkChecklistCompletedCount(checklist);

            return {
                key: `rework-${role.id || role.name || standKey}`,
                roleKey,
                standKey,
                title: role.name || `#${standKey || '-'}`,
                currentStatus: status,
                status,
                action: checklistAction,
                checklist,
                checklistCompletedCount,
                checklistTotalCount: THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.length,
                updatedAt: role.updatedAt
            };
        })
        .sort((a, b) => {
            const standDiff = (Number(a.standKey) || 999999) - (Number(b.standKey) || 999999);

            if (standDiff !== 0) {
                return standDiff;
            }

            return compareStandRoleNames(a.title, b.title);
        });
}

function getThreeSetManagementPurchasePlanningInfo(role) {
    const standKey = getStandKey(role && role.name);
    const currentDiameter = normalizeCurrentDiameter(role && role.currentDiameter);

    if (!standKey || currentDiameter === '' || role.status === DISCARDED_STATUS) {
        return null;
    }

    const remainingInfo = getRemainingDiameterInfo(role);

    if (!remainingInfo || remainingInfo.adoptedCutMm === '' || !Number.isFinite(remainingInfo.adoptedCutMm) || remainingInfo.adoptedCutMm <= 0) {
        return null;
    }

    const onlineUseMonths = getStandOnlineUseMonths(standKey);
    const usableOnlineCount = Math.max(0, Math.floor((remainingInfo.currentDiameter - remainingInfo.scrapDiameter) / remainingInfo.adoptedCutMm) + 1);
    const useStartDate = normalizeUseStartDate(role && role.useStartDate);
    const forecastStartDate = useStartDate || getTodayDateString();
    const disposalForecastDate = usableOnlineCount <= 0
        ? getTodayDateString()
        : addMonthsToDateString(forecastStartDate, usableOnlineCount * onlineUseMonths);
    const purchaseDecisionDate = addMonthsToDateString(disposalForecastDate, -THREE_SET_MANAGEMENT_PURCHASE_DECISION_MONTHS);

    if (!disposalForecastDate || !purchaseDecisionDate) {
        return null;
    }

    return {
        standKey,
        role,
        roleName: role.name || '',
        currentDiameter,
        scrapDiameter: remainingInfo.scrapDiameter,
        remainingCutCount: remainingInfo.remainingCutCount,
        usableOnlineCount,
        disposalForecastDate,
        purchaseDecisionDate
    };
}

function getThreeSetManagementPurchaseDecisionLevel(purchaseDecisionDate, today = getTodayDateString()) {
    const decisionDate = normalizeDateInputValue(purchaseDecisionDate);
    const warningLimit = addMonthsToDateString(today, THREE_SET_MANAGEMENT_PURCHASE_DECISION_MONTHS);

    if (!decisionDate) {
        return null;
    }

    if (decisionDate <= today) {
        return {
            key: 'urgent',
            label: '判断期限超過',
            memo: '購入判断期限を過ぎています'
        };
    }

    if (warningLimit && decisionDate <= warningLimit) {
        return {
            key: 'soon',
            label: '判断期限8か月以内',
            memo: '8か月以内に購入判断期限です'
        };
    }

    return null;
}

function groupRolesByStand(allRoles = roles) {
    const groups = new Map();

    (Array.isArray(allRoles) ? allRoles : []).forEach(role => {
        const standKey = getStandKey(role && role.name);

        if (!standKey) {
            return;
        }

        if (!groups.has(standKey)) {
            groups.set(standKey, []);
        }

        groups.get(standKey).push(role);
    });

    return groups;
}

function getPurchaseRoleAlert(role, basisRole) {
    const alerts = [];
    const status = normalizeRoleStatusValue(role && role.status);
    const info = getRemainingDiameterInfo(role);
    const isBasisRole = basisRole && role && (
        (basisRole.id && role.id && basisRole.id === role.id)
        || (basisRole.name && role.name && basisRole.name === role.name)
    );

    if (status === SCRAP_WAITING_STATUS) {
        alerts.push({ key: 'scrap-waiting', label: '廃却待ち' });
        alerts.push({ key: 'out-of-service', label: '戦力外' });
    }

    if (status === NEW_STORAGE_STATUS) {
        alerts.push({ key: 'new-storage', label: '新品予備保管あり' });
        if (normalizeCoatingStatusValue(role && role.coatingStatus, status) === UNCOATED_STATUS) {
            alerts.push({ key: 'coating-required', label: '溶射無しあり' });
            alerts.push({ key: 'coating-dispatch', label: '溶射搬出必要' });
        }
    }

    if (info) {
        if (info.currentDiameter < info.scrapDiameter) {
            alerts.push({ key: 'scrap', label: '廃却径以下' });
        } else if (Math.abs(info.currentDiameter - info.scrapDiameter) < 0.0001) {
            alerts.push({ key: 'scrap', label: '廃却径' });
        } else if (info.remainingCutCount === 1) {
            alerts.push({ key: 'remaining-one', label: '残1回' });
        }
    }

    if (isBasisRole) {
        alerts.push({ key: 'purchase-attention', label: '購入注意' });
    }

    return alerts;
}

function getThreeSetManagementPurchaseRoleRows(standRoles, basisRole) {
    return (Array.isArray(standRoles) ? standRoles : [])
        .filter(role => role && normalizeRoleStatusValue(role.status) !== DISCARDED_STATUS)
        .sort(compareRolesByStandRole)
        .map(role => {
            const alerts = getPurchaseRoleAlert(role, basisRole);
            const coatingDisplay = getCoatingStatusDisplay(role);
            return {
                name: role.name || '-',
                status: normalizeRoleStatusValue(role.status),
                coatingLabel: coatingDisplay ? coatingDisplay.label : '',
                coatingNote: coatingDisplay ? coatingDisplay.note : '',
                currentDiameter: normalizeCurrentDiameter(role.currentDiameter),
                diameterLabel: formatPurchaseDiameter(role.currentDiameter),
                alerts,
                isAlert: alerts.length > 0
            };
        });
}

function getThreeSetManagementPurchaseStandItems(allRoles = roles) {
    const today = getTodayDateString();
    const groups = groupRolesByStand(allRoles);
    const items = [];

    groups.forEach((standRoles, standKey) => {
        const activeStandRoles = standRoles.filter(role => normalizeRoleStatusValue(role.status) !== DISCARDED_STATUS);
        const purchasePlans = activeStandRoles
            .map(role => getThreeSetManagementPurchasePlanningInfo(role))
            .filter(Boolean)
            .sort((a, b) => {
                if (a.disposalForecastDate !== b.disposalForecastDate) {
                    return String(a.disposalForecastDate).localeCompare(String(b.disposalForecastDate));
                }

                return compareStandRoleNames(a.roleName, b.roleName);
            });
        const basisPlan = purchasePlans[0] || null;

        if (!basisPlan) {
            return;
        }

        const level = getThreeSetManagementPurchaseDecisionLevel(basisPlan.purchaseDecisionDate, today);

        if (!level) {
            return;
        }

        const hasNewStorage = activeStandRoles.some(role => normalizeRoleStatusValue(role.status) === NEW_STORAGE_STATUS);
        const hasUncoatedStorage = activeStandRoles.some(role =>
            normalizeRoleStatusValue(role.status) === NEW_STORAGE_STATUS
            && normalizeCoatingStatusValue(role.coatingStatus, role.status) === UNCOATED_STATUS
        );
        const roleRows = getThreeSetManagementPurchaseRoleRows(activeStandRoles, basisPlan.role);

        items.push({
            key: `purchase-stand-${standKey}`,
            standKey,
            title: `#${standKey} 購入判断`,
            deadline: basisPlan.purchaseDecisionDate,
            disposalForecastDate: basisPlan.disposalForecastDate,
            status: level.label,
            action: hasNewStorage
                ? '新品予備保管を含めて購入要否を確認'
                : '3セット維持可否と購入要否を確認',
            reason: [
                level.memo,
                `${basisPlan.roleName || `#${standKey}`} が廃却見込みです`,
                hasNewStorage
                    ? '新品予備保管を含めて3セット維持確認が必要です'
                    : '3セット維持確認が必要です'
            ].join('\n'),
            meta: level.memo,
            basisRoleName: basisPlan.roleName || '',
            hasNewStorage,
            storageLabel: hasNewStorage
                ? `新品予備保管あり${hasUncoatedStorage ? ' / 溶射無しあり' : ''}`
                : '新品予備保管なし',
            roleRows
        });
    });

    return items.sort((a, b) => {
        if (a.deadline !== b.deadline) {
            return String(a.deadline).localeCompare(String(b.deadline));
        }

        return (Number(a.standKey) || 999999) - (Number(b.standKey) || 999999);
    });
}

function getThreeSetManagementPurchaseItems(allRoles = roles) {
    return getThreeSetManagementPurchaseStandItems(allRoles);
}

function getThreeSetManagementSummary(label, items) {
    if (!Array.isArray(items) || items.length === 0) {
        return getThreeSetManagementEmptySummary(label);
    }

    const first = items[0];
    return {
        count: items.length,
        status: first.status || '確認あり',
        nextAction: first.action || `${label}を確認`
    };
}

function getThreeSetManagementData(allRoles = roles) {
    const assemblyItems = getThreeSetManagementAssemblyItems(allRoles);
    const reworkItems = getThreeSetManagementReworkItems(allRoles);
    const purchaseItems = getThreeSetManagementPurchaseItems(allRoles);

    return [
        {
            key: 'assembly',
            label: '組替',
            summary: getThreeSetManagementSummary('組替', assemblyItems),
            items: assemblyItems
        },
        {
            key: 'rework',
            label: '搬入出・改削',
            summary: getThreeSetManagementSummary('搬入出・改削', reworkItems),
            items: reworkItems,
            totalCount: reworkItems.length
        },
        {
            key: 'purchase',
            label: '購入',
            summary: getThreeSetManagementSummary('購入', purchaseItems),
            items: purchaseItems
        }
    ];
}

function getThreeSetManagementDeadlineLabel(item, activeTab) {
    if (!item || !item.deadline) {
        return '-';
    }

    if (activeTab === 'purchase') {
        return formatPurchaseMonth(item.deadline);
    }

    return formatDateForDisplay(item.deadline);
}

function getThreeSetManagementItemTitle(activeTab) {
    if (activeTab === 'assembly') {
        return '組替タスク一覧';
    }

    if (activeTab === 'rework') {
        return '搬入出・改削タスク一覧';
    }

    return '購入タスク一覧';
}

function getThreeSetManagementPanelHeaderMetaHtml(activeGroup) {
    const count = activeGroup && Array.isArray(activeGroup.items) ? activeGroup.items.length : 0;

    return `<span>${escapeHtml(String(count))}件</span>`;
}

function isThreeSetManagementReworkChecklistStepEnabled(entry, index) {
    if (index === 0) {
        return true;
    }

    const previousStep = THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS[index - 1];
    return Boolean(entry && entry[previousStep.key] && entry[previousStep.key].done);
}

function getThreeSetManagementReworkChecklistHtml(item) {
    if (!item || item.currentStatus !== REWORK_READY_STATUS) {
        return '';
    }

    const entry = normalizeThreeSetManagementReworkChecklistEntry(item.checklist);
    const roleKey = item.roleKey || item.title || '';
    const encodedRoleKey = encodeURIComponent(roleKey);
    const completedCount = getThreeSetManagementReworkChecklistCompletedCount(entry);

    return `
        <div class="three-set-management-checklist" aria-label="チェックリスト進捗">
            <div class="three-set-management-checklist-head">
                <span>チェックリスト進捗</span>
                <strong>${escapeHtml(String(completedCount))}/${escapeHtml(String(THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.length))}</strong>
            </div>
            <div class="three-set-management-checklist-steps">
                ${THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.map((step, index) => {
                    const state = entry[step.key];
                    const isDone = Boolean(state && state.done);
                    const isEnabled = step.key === PICKUP_ADJUSTED_STEP_KEY
                        ? isThreeSetManagementReworkChecklistStepEnabled(entry, index)
                        : isDone || isThreeSetManagementReworkChecklistStepEnabled(entry, index);

                    if (step.key === PICKUP_ADJUSTED_STEP_KEY) {
                        return getReworkPickupChecklistItemHtml(roleKey, step, index, entry, {
                            isEnabled,
                            itemClass: 'three-set-management-check-step'
                        });
                    }

                    return `
                        <button
                            type="button"
                            class="three-set-management-check-step ${isDone ? 'is-done' : ''}"
                            onclick="toggleThreeSetManagementReworkChecklistStep('${encodedRoleKey}', '${escapeHtml(step.key)}')"
                            ${isEnabled ? '' : 'disabled'}
                            aria-pressed="${isDone ? 'true' : 'false'}"
                        >
                            <span class="three-set-management-check-index">${escapeHtml(String(index + 1))}</span>
                            <span class="three-set-management-check-body">
                                <strong>${escapeHtml(step.label)}</strong>
                                ${isDone ? `
                                    <span>完了：${escapeHtml(formatUpdatedAt(state.updatedAt))}</span>
                                    <span>更新者：${escapeHtml(state.updatedBy || '未設定')}</span>
                                ` : ''}
                            </span>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function getThreeSetManagementPurchaseRowsHtml(item) {
    const rows = item && Array.isArray(item.roleRows) ? item.roleRows : [];

    if (rows.length === 0) {
        return '<div class="three-set-management-purchase-empty">ロール状況がありません</div>';
    }

    return `
        <div class="three-set-management-purchase-rolls">
            ${rows.map(row => `
                <div class="three-set-management-purchase-roll ${row.isAlert ? 'is-alert' : ''}">
                    <span class="three-set-management-purchase-roll-name">${escapeHtml(row.name || '-')}</span>
                    <span class="three-set-management-purchase-roll-status">
                        ${escapeHtml(row.status || '-')}
                        ${row.coatingLabel ? `<span class="three-set-management-purchase-roll-coating ${row.coatingNote ? 'is-warning' : ''}">${escapeHtml(row.coatingNote ? `${row.coatingLabel} / ${row.coatingNote}` : row.coatingLabel)}</span>` : ''}
                    </span>
                    <span class="three-set-management-purchase-roll-diameter">${escapeHtml(row.diameterLabel || '-')}</span>
                    <span class="three-set-management-purchase-roll-alerts">
                        ${row.alerts.map(alert => `
                            <span class="three-set-management-purchase-alert is-${escapeHtml(alert.key)}">${escapeHtml(alert.label)}</span>
                        `).join('')}
                    </span>
                </div>
            `).join('')}
        </div>
    `;
}

function normalizeThreeSetManagementPurchaseStandKey(standKey) {
    return String(standKey || '').trim();
}

function getStoredThreeSetManagementPurchaseExpandedStands() {
    try {
        const rawValue = localStorage.getItem(THREE_SET_MANAGEMENT_PURCHASE_EXPANDED_STANDS_KEY);
        const parsedValue = rawValue ? JSON.parse(rawValue) : [];

        if (!Array.isArray(parsedValue)) {
            return new Set();
        }

        return new Set(parsedValue.map(normalizeThreeSetManagementPurchaseStandKey).filter(Boolean));
    } catch (error) {
        console.error('getStoredThreeSetManagementPurchaseExpandedStands error:', error);
        return new Set();
    }
}

function saveThreeSetManagementPurchaseExpandedStands(expandedStands) {
    try {
        const values = Array.from(expandedStands || [])
            .map(normalizeThreeSetManagementPurchaseStandKey)
            .filter(Boolean)
            .sort((a, b) => (Number(a) || 999999) - (Number(b) || 999999) || a.localeCompare(b));
        localStorage.setItem(THREE_SET_MANAGEMENT_PURCHASE_EXPANDED_STANDS_KEY, JSON.stringify(values));
    } catch (error) {
        console.error('saveThreeSetManagementPurchaseExpandedStands error:', error);
    }
}

function isThreeSetManagementPurchaseStandExpanded(standKey) {
    const normalizedStandKey = normalizeThreeSetManagementPurchaseStandKey(standKey);

    if (!normalizedStandKey) {
        return false;
    }

    return getStoredThreeSetManagementPurchaseExpandedStands().has(normalizedStandKey);
}

function toggleThreeSetManagementPurchaseStand(standKey) {
    let decodedStandKey = String(standKey || '');

    try {
        decodedStandKey = decodeURIComponent(decodedStandKey);
    } catch (error) {
        console.error('toggleThreeSetManagementPurchaseStand decode error:', error);
    }

    const normalizedStandKey = normalizeThreeSetManagementPurchaseStandKey(decodedStandKey);

    if (!normalizedStandKey) {
        return;
    }

    const expandedStands = getStoredThreeSetManagementPurchaseExpandedStands();

    if (expandedStands.has(normalizedStandKey)) {
        expandedStands.delete(normalizedStandKey);
    } else {
        expandedStands.add(normalizedStandKey);
    }

    saveThreeSetManagementPurchaseExpandedStands(expandedStands);
    updateThreeSetManagementDashboard(roles);
}

function hasThreeSetManagementPurchaseRollAttention(item) {
    const attentionAlertKeys = new Set([
        'purchase-attention',
        'scrap',
        'remaining-one',
        'scrap-waiting'
    ]);
    const rows = item && Array.isArray(item.roleRows) ? item.roleRows : [];

    return rows.some(row => Array.isArray(row.alerts)
        && row.alerts.some(alert => attentionAlertKeys.has(alert && alert.key)));
}

function getThreeSetManagementPurchaseRollSummary(item) {
    const rows = item && Array.isArray(item.roleRows) ? item.roleRows : [];
    const alertCounts = new Map();

    rows.forEach(row => {
        (Array.isArray(row.alerts) ? row.alerts : []).forEach(alert => {
            const label = alert && alert.label;

            if (!label || label === '戦力外') {
                return;
            }

            alertCounts.set(label, (alertCounts.get(label) || 0) + 1);
        });
    });

    const summaryItems = Array.from(alertCounts.entries()).map(([label, count]) => {
        const text = label === '新品予備保管あり'
            ? label
            : `${label} ${count}件`;
        return `<span class="three-set-management-purchase-summary-chip">${escapeHtml(text)}</span>`;
    });

    if (summaryItems.length === 0) {
        return '';
    }

    return `<div class="three-set-management-purchase-summary">${summaryItems.join('')}</div>`;
}

function getThreeSetManagementItemHtml(item, activeTab) {
    if (activeTab === 'assembly') {
        return `
            <article class="three-set-management-task">
                <div class="three-set-management-task-head">
                    <span class="three-set-management-task-stand">#${escapeHtml(item.standKey || '-')} 組替</span>
                    <span class="three-set-management-task-status">${escapeHtml(item.status || '-')}</span>
                </div>
                <div class="three-set-management-task-main">
                    <div>
                        <span>外す側</span>
                        <strong>${escapeHtml(item.removeSide || '-')}</strong>
                    </div>
                    <div>
                        <span>組む側</span>
                        <strong>${escapeHtml(item.installSide || '-')}</strong>
                    </div>
                </div>
                <div class="three-set-management-task-action">
                    <span>次にやること</span>
                    <strong>${escapeHtml(item.action || '-')}</strong>
                </div>
                <div class="three-set-management-task-meta">${escapeHtml(item.meta || '-')}</div>
            </article>
        `;
    }

    if (activeTab === 'rework') {
        return `
            <article class="three-set-management-task">
                <div class="three-set-management-task-head">
                    <span class="three-set-management-task-stand">${escapeHtml(item.title || '-')}</span>
                </div>
                <div class="three-set-management-task-main three-set-management-task-main-single">
                    ${getThreeSetManagementReworkFieldHtml('現在状態', item.currentStatus)}
                </div>
                <div class="three-set-management-task-action">
                    <span>次にやること</span>
                    <strong>${escapeHtml(item.action || '-')}</strong>
                </div>
                ${getThreeSetManagementReworkChecklistHtml(item)}
            </article>
        `;
    }

    if (activeTab === 'purchase') {
        const hasRollAttention = hasThreeSetManagementPurchaseRollAttention(item);
        const standKey = normalizeThreeSetManagementPurchaseStandKey(item.standKey);
        const encodedStandKey = encodeURIComponent(standKey);
        const isRollExpanded = isThreeSetManagementPurchaseStandExpanded(standKey);
        const rollSummary = getThreeSetManagementPurchaseRollSummary(item);
        const rollDetailsId = `three-set-management-purchase-rolls-${encodedStandKey || 'unknown'}`;
        return `
            <article class="three-set-management-task three-set-management-purchase-task ${hasRollAttention ? 'has-roll-attention' : ''}">
                <div class="three-set-management-task-head">
                    <span class="three-set-management-task-stand">${escapeHtml(item.title || `#${item.standKey || '-'}`)}</span>
                    <span class="three-set-management-task-status">${escapeHtml(item.status || '-')}</span>
                </div>
                <div class="three-set-management-task-main">
                    <div>
                        <span>購入判断期限</span>
                        <strong>${escapeHtml(formatPurchaseMonth(item.deadline))}</strong>
                    </div>
                    <div>
                        <span>新品予備保管</span>
                        <strong>${escapeHtml(item.storageLabel || '-')}</strong>
                    </div>
                </div>
                <div class="three-set-management-task-meta">
                    <span>理由</span>
                    <strong>${escapeHtml(item.reason || '-')}</strong>
                </div>
                <div class="three-set-management-task-action">
                    <span>次にやること</span>
                    <strong>${escapeHtml(item.action || '-')}</strong>
                </div>
                <div class="three-set-management-purchase-section ${hasRollAttention ? 'has-attention' : ''} ${isRollExpanded ? 'is-expanded' : 'is-collapsed'}">
                    <button
                        type="button"
                        class="three-set-management-purchase-section-title"
                        onclick="toggleThreeSetManagementPurchaseStand('${escapeHtml(encodedStandKey)}')"
                        aria-expanded="${isRollExpanded ? 'true' : 'false'}"
                        aria-controls="${escapeHtml(rollDetailsId)}"
                    >
                        <span class="three-set-management-purchase-section-label">${isRollExpanded ? 'ロール状況を閉じる' : 'ロール状況を見る'}</span>
                        <span class="three-set-management-purchase-section-arrow" aria-hidden="true">${isRollExpanded ? '▲' : '▼'}</span>
                    </button>
                    ${rollSummary}
                    <div id="${escapeHtml(rollDetailsId)}" ${isRollExpanded ? '' : 'hidden'}>
                        ${getThreeSetManagementPurchaseRowsHtml(item)}
                    </div>
                </div>
            </article>
        `;
    }

    return `
        <article class="three-set-management-task">
            <div class="three-set-management-task-head">
                <span class="three-set-management-task-stand">#${escapeHtml(item.standKey || '-')}</span>
                <span class="three-set-management-task-status">${escapeHtml(item.status || '-')}</span>
            </div>
            <div class="three-set-management-task-main">
                <div>
                    <span>${activeTab === 'assembly' ? '対象' : '対象ロール'}</span>
                    <strong>${escapeHtml(item.title || '-')}</strong>
                </div>
                <div>
                    <span>工作課期限</span>
                    <strong>${escapeHtml(getThreeSetManagementDeadlineLabel(item, activeTab))}</strong>
                </div>
            </div>
            <div class="three-set-management-task-meta">${escapeHtml(item.target || '-')}</div>
            <div class="three-set-management-task-action">
                <span>次にやること</span>
                <strong>${escapeHtml(item.action || '-')}</strong>
            </div>
            <div class="three-set-management-task-meta">${escapeHtml(item.meta || '-')}</div>
        </article>
    `;
}

function updateThreeSetManagementDashboard(allRoles = roles) {
    const root = document.getElementById('three-set-management');
    const cardsEl = document.getElementById('three-set-management-cards');
    const detailEl = document.getElementById('three-set-management-detail');

    if (!root || !cardsEl || !detailEl) {
        return;
    }

    const data = getThreeSetManagementData(allRoles);
    const activeTab = normalizeThreeSetManagementTab(getStoredThreeSetManagementTab());
    const activeGroup = data.find(group => group.key === activeTab) || data[0];

    cardsEl.innerHTML = data.map(group => {
        const isActive = group.key === activeGroup.key;
        return `
            <button
                type="button"
                class="three-set-management-card ${isActive ? 'is-active' : ''}"
                onclick="changeThreeSetManagementTab('${escapeHtml(group.key)}')"
                role="tab"
                aria-selected="${isActive ? 'true' : 'false'}"
                aria-controls="three-set-management-detail"
            >
                <span class="three-set-management-card-label">${escapeHtml(group.label)}</span>
                <strong class="three-set-management-card-count">${escapeHtml(String(group.summary.count))}件</strong>
                <span class="three-set-management-card-status">${escapeHtml(group.summary.status)}</span>
                <span class="three-set-management-card-action">次にやること：${escapeHtml(group.summary.nextAction)}</span>
            </button>
        `;
    }).join('');

    if (!activeGroup || activeGroup.items.length === 0) {
        detailEl.innerHTML = `
            <section class="three-set-management-panel">
                <div class="three-set-management-panel-header">
                    <h3>${escapeHtml(activeGroup ? getThreeSetManagementItemTitle(activeGroup.key) : 'タスク一覧')}</h3>
                    ${getThreeSetManagementPanelHeaderMetaHtml(activeGroup)}
                </div>
                <div class="three-set-management-empty">現在、${escapeHtml(activeGroup ? activeGroup.label : '対象')}タスクはありません</div>
            </section>
        `;
        return;
    }

    detailEl.innerHTML = `
        <section class="three-set-management-panel">
            <div class="three-set-management-panel-header">
                <h3>${escapeHtml(getThreeSetManagementItemTitle(activeGroup.key))}</h3>
                ${getThreeSetManagementPanelHeaderMetaHtml(activeGroup)}
            </div>
            <div class="three-set-management-task-list">
                ${activeGroup.items.map(item => getThreeSetManagementItemHtml(item, activeGroup.key)).join('')}
            </div>
        </section>
    `;
}

function changeThreeSetManagementTab(tabKey) {
    saveThreeSetManagementTab(tabKey);
    updateThreeSetManagementDashboard(roles);
}

function toggleThreeSetManagementReworkChecklistStep(encodedRoleKey, stepKey) {
    const roleKey = decodeURIComponent(String(encodedRoleKey || ''));
    const stepIndex = THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.findIndex(step => step.key === stepKey);
    const step = THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS[stepIndex];
    const role = getThreeSetManagementReworkRoleByKey(roleKey);

    if (!roleKey || !step || !role) {
        return;
    }

    role.workProgress = normalizeWorkProgress(role);
    const entry = normalizeThreeSetManagementReworkChecklistEntry(role.workProgress);
    const state = entry[step.key];

    if (state.done) {
        const affectedSteps = THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS
            .slice(stepIndex)
            .filter(item => entry[item.key] && entry[item.key].done)
            .map(item => item.label);
        const confirmed = confirm(`${step.label}以降を未完了に戻しますか？\n\n対象工程：${affectedSteps.join('、')}`);

        if (!confirmed) {
            return;
        }

        THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.slice(stepIndex).forEach(item => {
            entry[item.key] = {
                done: false,
                updatedAt: '',
                updatedBy: ''
            };
        });
        if (stepIndex <= THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.findIndex(item => item.key === PICKUP_ADJUSTED_STEP_KEY)) {
            entry.pickupAdjustedBy = '';
        }
    } else {
        if (!isThreeSetManagementReworkChecklistStepEnabled(entry, stepIndex)) {
            alert('前工程が完了していないため、この工程は完了できません');
            return;
        }

        const operator = getSelectedOperator();

        if (!operator) {
            focusOperatorSelect();
            alert('担当者を選択してください');
            return;
        }

        entry[step.key] = {
            done: true,
            updatedAt: new Date().toISOString(),
            updatedBy: operator.name
        };
    }

    role.workProgress = entry;
    role.requestSent = isWorkProgressStepDone(role.workProgress, 'vendorSentAt');
    role.updatedAt = new Date().toISOString();
    saveLocalRoles();
    renderRoles();
    syncRoles();
}

function saveReworkPickupDates(encodedRoleKey, container) {
    const roleKey = decodeURIComponent(String(encodedRoleKey || ''));
    const role = getThreeSetManagementReworkRoleByKey(roleKey);
    const stepIndex = THREE_SET_MANAGEMENT_REWORK_CHECKLIST_STEPS.findIndex(step => step.key === PICKUP_ADJUSTED_STEP_KEY);

    if (!role || !container || stepIndex < 0) {
        return;
    }

    role.workProgress = normalizeWorkProgress(role);

    if (!isWorkProgressStepEnabled(role, stepIndex)) {
        renderRoles();
        return;
    }

    const dispatchInput = container.querySelector('.rework-pickup-dispatch-date');
    const arrivalInput = container.querySelector('.rework-pickup-arrival-date');
    const dispatchDate = normalizeDateInputValue(dispatchInput ? dispatchInput.value : '');
    const arrivalDate = normalizeDateInputValue(arrivalInput ? arrivalInput.value : '');
    const completedAt = new Date().toISOString();
    const operator = dispatchDate ? getSelectedOperator() : null;

    if (dispatchDate && !operator) {
        focusOperatorSelect();
        alert('担当者を選択してください');
        renderRoles();
        return;
    }

    role.workProgress.dispatchDate = dispatchDate;
    role.workProgress.arrivalDate = arrivalDate;
    role.dispatchDate = dispatchDate;

    if (dispatchDate) {
        role.workProgress[PICKUP_ADJUSTED_STEP_KEY] = {
            done: true,
            updatedAt: completedAt,
            updatedBy: operator.name
        };
        role.workProgress.pickupAdjustedBy = operator.name;
    } else {
        role.workProgress[PICKUP_ADJUSTED_STEP_KEY] = {
            done: false,
            updatedAt: '',
            updatedBy: ''
        };
        role.workProgress.pickupAdjustedBy = '';
    }

    role.updatedAt = completedAt;
    saveLocalRoles();
    renderRoles();
    syncRoles();
}

function updateThreeSetForecastDashboard(allRoles = roles) {
    const dashboard = document.getElementById('three-set-forecast-dashboard');
    const countEl = document.getElementById('three-set-forecast-count');
    const listEl = document.getElementById('three-set-forecast-list');

    if (!dashboard || !countEl || !listEl) {
        return;
    }

    const items = getThreeSetForecastItems(allRoles);
    countEl.textContent = `${items.length}件`;
    dashboard.classList.toggle('is-empty', items.length === 0);
    syncCollapsibleDashboardState(THREE_SET_FORECAST_DASHBOARD_CONFIG);

    if (items.length === 0) {
        listEl.innerHTML = '<div class="three-set-forecast-empty">3セット維持予測はありません</div>';
        return;
    }

    listEl.innerHTML = items.map(item => `
        <article class="three-set-forecast-card ${escapeHtml(item.className)}">
            <div class="three-set-forecast-card-header">
                <span class="three-set-forecast-stand">#${escapeHtml(item.standKey)}</span>
                <span class="three-set-forecast-judgment">${escapeHtml(item.judgment)}</span>
            </div>
            <div class="three-set-forecast-summary">
                ${getThreeSetForecastSummaryFieldHtml('次回終了', formatDateForDisplay(item.useEndDate))}
                ${getThreeSetForecastSummaryFieldHtml('オンライン', item.onlineRoleName)}
            </div>
            <div class="three-set-forecast-action">
                <span>必要アクション</span>
                <strong>${escapeHtml(item.action || '-')}</strong>
            </div>
            <div class="three-set-forecast-details">
                <div><span>次候補</span><strong>${escapeHtml(item.nextCandidateName || '-')}</strong></div>
                <div><span>理由</span><strong>${escapeHtml(item.reason || '-')}</strong></div>
                <div><span>補足</span><strong>${escapeHtml(getThreeSetForecastSupplement(item))}</strong></div>
            </div>
        </article>
    `).join('');
}

function getOnlineUseEndDate(role) {
    if (!role || role.status !== ONLINE_STATUS) {
        return '';
    }

    const useStartDate = normalizeUseStartDate(role.useStartDate);
    if (!useStartDate) {
        return '';
    }

    return addMonthsToDateString(useStartDate, getStandOnlineUseMonths(getStandKey(role.name)));
}

function getReworkSetupPlanItem(role) {
    const standKey = getStandKey(role && role.name);
    const useStartDate = normalizeUseStartDate(role && role.useStartDate);
    const useEndDate = getOnlineUseEndDate(role);

    if (!standKey || !useStartDate || !useEndDate) {
        return null;
    }

    const workshopTaskDueDate = addDaysToDateString(useEndDate, -REWORK_SETUP_TASK_LEAD_DAYS);
    const dispatchReadyDate = addDaysToDateString(useEndDate, REWORK_SETUP_DISPATCH_READY_DAYS);
    const vendorPickupDate = dispatchReadyDate;
    const reworkReturnDate = addDaysToDateString(vendorPickupDate, REWORK_SETUP_REWORK_DAYS);
    const newReadyDate = reworkReturnDate;

    if (!workshopTaskDueDate || !dispatchReadyDate || !vendorPickupDate || !reworkReturnDate || !newReadyDate) {
        return null;
    }

    return {
        role,
        standKey,
        standNumber: Number(standKey) || 999999,
        roleName: role.name || '',
        useStartDate,
        useEndDate,
        workshopTaskDueDate,
        dispatchReadyDate,
        vendorPickupDate,
        reworkReturnDate,
        newReadyDate
    };
}

function isReworkSetupPlanDisplayTarget(item, today = getTodayDateString()) {
    if (!item || !item.workshopTaskDueDate) {
        return false;
    }

    const displayLimitDate = addDaysToDateString(today, REWORK_SETUP_DISPLAY_WINDOW_DAYS);
    return item.workshopTaskDueDate <= today || item.workshopTaskDueDate <= displayLimitDate;
}

function getReworkSetupPlanItems(allRoles = roles) {
    return (Array.isArray(allRoles) ? allRoles : [])
        .filter(role => role && role.status === ONLINE_STATUS)
        .map(getReworkSetupPlanItem)
        .filter(item => isReworkSetupPlanDisplayTarget(item))
        .sort((a, b) => {
            if (a.workshopTaskDueDate !== b.workshopTaskDueDate) {
                return String(a.workshopTaskDueDate).localeCompare(String(b.workshopTaskDueDate));
            }

            if (a.standNumber !== b.standNumber) {
                return a.standNumber - b.standNumber;
            }

            return compareStandRoleNames(a.roleName, b.roleName);
        });
}

function getReworkSetupFieldHtml(label, value) {
    return `
        <div class="rework-setup-field">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatDateForDisplay(value))}</strong>
        </div>
    `;
}

function updateReworkSetupDashboard(allRoles = roles) {
    const dashboard = document.getElementById('rework-setup-dashboard');
    const countEl = document.getElementById('rework-setup-count');
    const listEl = document.getElementById('rework-setup-list');

    if (!dashboard || !countEl || !listEl) {
        return;
    }

    const items = getReworkSetupPlanItems(allRoles);
    countEl.textContent = `${items.length}件`;
    dashboard.classList.toggle('is-empty', items.length === 0);
    syncCollapsibleDashboardState(REWORK_SETUP_DASHBOARD_CONFIG);

    if (items.length === 0) {
        listEl.innerHTML = '<div class="rework-setup-empty">改削段取り予定はありません</div>';
        return;
    }

    listEl.innerHTML = items.map(item => `
        <article class="rework-setup-card">
            <div class="rework-setup-card-header">
                <div class="rework-setup-role">
                    <span class="rework-setup-stand">#${escapeHtml(item.standKey)}</span>
                    <span class="rework-setup-name">${escapeHtml(item.roleName || '-')}</span>
                </div>
                <div class="rework-setup-deadline">工作課期限 ${escapeHtml(formatDateForDisplay(item.workshopTaskDueDate))}</div>
            </div>
            <div class="rework-setup-grid">
                ${getReworkSetupFieldHtml('使用開始日', item.useStartDate)}
                ${getReworkSetupFieldHtml('使用終了予定日', item.useEndDate)}
                ${getReworkSetupFieldHtml('工作課タスク化期限', item.workshopTaskDueDate)}
                ${getReworkSetupFieldHtml('搬出可能予定日', item.dispatchReadyDate)}
                ${getReworkSetupFieldHtml('業者引取希望日', item.vendorPickupDate)}
                ${getReworkSetupFieldHtml('改削戻り予定日', item.reworkReturnDate)}
                ${getReworkSetupFieldHtml('新品予備化予定日', item.newReadyDate)}
            </div>
        </article>
    `).join('');
}

function updateIncompleteWorkDashboard(allRoles) {
    const dashboard = document.getElementById('incomplete-work-dashboard');
    const countEl = document.getElementById('incomplete-work-count');
    const listEl = document.getElementById('incomplete-work-list');

    if (!dashboard || !countEl || !listEl) {
        return;
    }

    const incompleteRoles = allRoles
        .map(role => ({ role, progressState: getWorkProgressState(role) }))
        .filter(item => item.progressState.isIncomplete);

    countEl.textContent = `${incompleteRoles.length}件`;
    dashboard.classList.toggle('has-incomplete-work', incompleteRoles.length > 0);
    dashboard.classList.toggle('is-empty', incompleteRoles.length === 0);
    syncCollapsibleDashboardState(FUTURE_WORK_DASHBOARD_CONFIG);

    if (incompleteRoles.length === 0) {
        listEl.innerHTML = '<div class="incomplete-work-empty">未来作業依頼はありません</div>';
        return;
    }

    listEl.innerHTML = incompleteRoles.map(({ role, progressState }) => `
        <div class="incomplete-work-item">
            <span class="incomplete-work-role">${escapeHtml(role.name || '-')}</span>
            <span class="incomplete-work-progress">${progressState.completedCount}/${progressState.totalCount}</span>
        </div>
    `).join('');
}

function getRoleStatusChangedAt(role, status) {
    const statusValues = status === SCRAP_WAITING_STATUS
        ? [SCRAP_WAITING_STATUS, LEGACY_SCRAP_WAITING_STATUS]
        : [status];
    const history = normalizeRoleHistory(role)
        .filter(entry => entry.type === 'status' && statusValues.includes(entry.after) && entry.at)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return history.length > 0 ? history[0].at : role.updatedAt;
}

function getRoleStatusChangedTimestamp(role, status) {
    const changedAt = getRoleStatusChangedAt(role, status);
    const timestamp = new Date(changedAt).getTime();

    if (!Number.isNaN(timestamp)) {
        return timestamp;
    }

    const fallbackTimestamp = new Date(role && role.updatedAt).getTime();
    return Number.isNaN(fallbackTimestamp) ? null : fallbackTimestamp;
}

function getOldestStatusChangedAt(rolesForTask, statuses) {
    const timestamps = rolesForTask
        .filter(role => statuses.includes(role.status))
        .map(role => getRoleStatusChangedTimestamp(role, role.status))
        .filter(timestamp => timestamp !== null);

    if (timestamps.length === 0) {
        return null;
    }

    return new Date(Math.min(...timestamps)).toISOString();
}

function getElapsedDaysSince(dateValue, now = new Date()) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const elapsedMs = now.getTime() - date.getTime();
    return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
}

function sortTodayTasks(a, b) {
    const priorityDiff = TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];

    if (priorityDiff !== 0) {
        return priorityDiff;
    }

    const aIsAssemblyTask = String(a.id || '').startsWith('assembly-');
    const bIsAssemblyTask = String(b.id || '').startsWith('assembly-');

    if (aIsAssemblyTask && bIsAssemblyTask && a.standNumber !== b.standNumber) {
        return a.standNumber - b.standNumber;
    }

    const elapsedDiff = (b.elapsedDays || 0) - (a.elapsedDays || 0);

    if (elapsedDiff !== 0) {
        return elapsedDiff;
    }

    if (a.standNumber !== b.standNumber) {
        return a.standNumber - b.standNumber;
    }

    return String(a.roleName || a.standLabel || '').localeCompare(String(b.roleName || b.standLabel || ''), 'ja');
}

function getAssemblyCandidateItems(allRoles) {
    const groups = new Map();

    (Array.isArray(allRoles) ? allRoles : []).forEach(role => {
        const standKey = getStandKey(role.name);

        if (!standKey) {
            return;
        }

        if (!groups.has(standKey)) {
            groups.set(standKey, []);
        }

        groups.get(standKey).push(role);
    });

    return Array.from(groups.entries())
        .map(([standKey, standRoles]) => {
            const usedRoles = standRoles.filter(role => role.status === USED_STANDBY_STATUS);
            const newReadyRoles = standRoles.filter(role => role.status === NEW_READY_STATUS);

            if (usedRoles.length === 0 || newReadyRoles.length === 0) {
                return null;
            }

            return {
                standKey,
                standNumber: Number(standKey) || 999999,
                standLabel: `#${standKey}`,
                standRoles,
                usedRoles,
                newReadyRoles
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.standNumber !== b.standNumber) {
                return a.standNumber - b.standNumber;
            }

            return a.standLabel.localeCompare(b.standLabel, 'ja');
        });
}

function normalizeWorkshopBoardSortOption(value) {
    return String(value || '').toLowerCase() === 'priority' ? 'priority' : 'stand';
}

function getWorkshopBoardUsedStandbyDateInfo(role) {
    if (!role) {
        return {
            date: '',
            source: ''
        };
    }

    const historyChangedAt = getRoleStatusChangedAt(role, USED_STANDBY_STATUS);
    const historyDate = normalizeDateInputValue(historyChangedAt);

    if (historyDate) {
        return {
            date: historyDate,
            source: 'history'
        };
    }

    const updatedAtDate = normalizeDateInputValue(role.updatedAt);

    return {
        date: updatedAtDate,
        source: updatedAtDate ? 'updatedAt' : ''
    };
}

function getDaysUntilDate(dateValue, now = new Date()) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const diffMs = date.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getWorkshopBoardReferenceUsedRole(standRoles) {
    const usedRoles = (Array.isArray(standRoles) ? standRoles : [])
        .filter(role => role && role.status === USED_STANDBY_STATUS);

    if (usedRoles.length === 0) {
        return null;
    }

    return usedRoles
        .slice()
        .sort((a, b) => {
            const aInfo = getWorkshopBoardUsedStandbyDateInfo(a);
            const bInfo = getWorkshopBoardUsedStandbyDateInfo(b);
            const aTimestamp = aInfo.date ? new Date(aInfo.date).getTime() : Number.POSITIVE_INFINITY;
            const bTimestamp = bInfo.date ? new Date(bInfo.date).getTime() : Number.POSITIVE_INFINITY;

            if (aTimestamp !== bTimestamp) {
                return aTimestamp - bTimestamp;
            }

            return compareUpdatedAt(a, b, 'desc');
        })[0];
}

function getWorkshopBoardPriority(daysRemaining) {
    if (daysRemaining === null) {
        return 'low';
    }

    if (daysRemaining <= WORKSHOP_BOARD_PRIORITY_THRESHOLD_DAYS.high) {
        return 'high';
    }

    if (daysRemaining <= WORKSHOP_BOARD_PRIORITY_THRESHOLD_DAYS.medium) {
        return 'medium';
    }

    return 'low';
}

function getWorkshopBoardCandidateDetails(candidate, now = new Date()) {
    const referenceRole = getWorkshopBoardReferenceUsedRole(candidate && candidate.standRoles);
    const standbyDateInfo = getWorkshopBoardUsedStandbyDateInfo(referenceRole);
    const standbyDate = standbyDateInfo.date;
    const estimatedReplacementDate = standbyDate
        ? normalizeDateInputValue(addDaysToDateString(standbyDate, WORKSHOP_BOARD_REPLACEMENT_DAYS))
        : '';
    const daysRemaining = estimatedReplacementDate
        ? getDaysUntilDate(estimatedReplacementDate, now)
        : null;
    const priority = getWorkshopBoardPriority(daysRemaining);
    const remainingDaysLabel = daysRemaining === null
        ? '算出不可'
        : `目安まであと${Math.max(0, daysRemaining)}日`;

    return {
        referenceRole,
        standbyDate,
        estimatedReplacementDate,
        daysRemaining,
        priority,
        priorityRank: WORKSHOP_BOARD_PRIORITY_ORDER[priority] || WORKSHOP_BOARD_PRIORITY_ORDER.low,
        priorityLabel: WORKSHOP_BOARD_PRIORITY_LABELS[priority] || '低',
        standbyDateLabel: standbyDate ? formatDateForDisplay(standbyDate) : '算出不可',
        estimatedReplacementLabel: estimatedReplacementDate ? formatDateForDisplay(estimatedReplacementDate) : '算出不可',
        remainingDaysLabel
    };
}

function compareWorkshopBoardCandidates(a, b) {
    if (workshopBoardSortOption === 'priority') {
        const priorityDiff = (a.priorityRank || WORKSHOP_BOARD_PRIORITY_ORDER.low) - (b.priorityRank || WORKSHOP_BOARD_PRIORITY_ORDER.low);

        if (priorityDiff !== 0) {
            return priorityDiff;
        }
    }

    if (a.standNumber !== b.standNumber) {
        return a.standNumber - b.standNumber;
    }

    return a.standLabel.localeCompare(b.standLabel, 'ja');
}

function changeWorkshopBoardSort(event) {
    workshopBoardSortOption = normalizeWorkshopBoardSortOption(event && event.target ? event.target.value : '');
    updateWorkshopBoard(roles);
}

function getTodayTaskItems(allRoles) {
    const tasks = [];
    const groups = new Map();
    const now = new Date();

    allRoles.forEach(role => {
        const standKey = getStandKey(role.name);

        if (standKey) {
            if (!groups.has(standKey)) {
                groups.set(standKey, []);
            }
            groups.get(standKey).push(role);
        }

        if (role.status === REWORK_READY_STATUS) {
            const workProgressState = getWorkProgressState(role);
            const occurredAt = getRoleStatusChangedAt(role, REWORK_READY_STATUS);

            if (workProgressState.completedCount < workProgressState.totalCount) {
                tasks.push({
                    id: `rework-ready-${role.id}`,
                    priority: 'high',
                    standKey,
                    standNumber: Number(standKey) || 999999,
                    roleName: role.name || '-',
                    title: `改削依頼（${workProgressState.completedCount}/${workProgressState.totalCount}）`,
                    actions: ['改削依頼書作成', '業者連絡', '搬出日決定'],
                    reason: '改削行き（搬出可能）',
                    occurredAt,
                    elapsedDays: getElapsedDaysSince(occurredAt, now) || 0
                });
            }
        }

        if (role.status === REWORKING_STATUS) {
            const dispatchDate = getRoleDispatchDate(role);
            const inboundPlanDate = getInboundPlanDate(dispatchDate);
            const isInboundPlanOverdue = Boolean(inboundPlanDate) && getTodayDateString() > inboundPlanDate;

            if (isInboundPlanOverdue) {
                const occurredAt = getRoleStatusChangedAt(role, REWORKING_STATUS);
                tasks.push({
                    id: `reworking-confirm-${role.id}`,
                    priority: 'high',
                    standKey,
                    standNumber: Number(standKey) || 999999,
                    roleName: role.name || '-',
                    title: '搬入確認',
                    actions: ['搬入予定確認'],
                    reason: `搬入予定日超過（${formatDateForDisplay(inboundPlanDate)}予定）`,
                    occurredAt,
                    elapsedDays: getElapsedDaysSince(occurredAt, now) || 0
                });
            } else if (!dispatchDate) {
                const reworkingStartedAt = getRoleStatusChangedAt(role, REWORKING_STATUS);
                const elapsedDays = getElapsedDaysSince(reworkingStartedAt, now);

                if (elapsedDays !== null && elapsedDays > REWORKING_CONFIRM_THRESHOLD_DAYS) {
                    tasks.push({
                        id: `reworking-confirm-${role.id}`,
                        priority: 'high',
                        standKey,
                        standNumber: Number(standKey) || 999999,
                        roleName: role.name || '-',
                        title: '搬入確認',
                        actions: ['搬入予定確認'],
                        reason: `改削中${elapsedDays}日経過`,
                        occurredAt: reworkingStartedAt,
                        elapsedDays
                    });
                }
            }
        }
    });

    groups.forEach((standRoles, standKey) => {
        const statuses = standRoles.map(role => role.status);

        if (statuses.includes(SCRAP_WAITING_STATUS) && !statuses.includes(NEW_INSTALLED_STATUS)) {
            const occurredAt = getOldestStatusChangedAt(standRoles, [SCRAP_WAITING_STATUS]);
            tasks.push({
                id: `reserve-shortage-${standKey}`,
                priority: 'low',
                standKey,
                standNumber: Number(standKey) || 999999,
                standLabel: `#${standKey}`,
                title: '予備不足確認',
                actions: ['新品予備または組込完了ロールの手配状況確認'],
                reason: '廃却待ち（ラック保管）あり・予備不足',
                occurredAt,
                elapsedDays: getElapsedDaysSince(occurredAt, now) || 0
            });
        }
    });

    getAssemblyCandidateItems(allRoles).forEach(candidate => {
        const occurredAt = getOldestStatusChangedAt(candidate.standRoles, [USED_STANDBY_STATUS, NEW_READY_STATUS]);
        tasks.push({
            id: `assembly-${candidate.standKey}`,
            priority: 'medium',
            standKey: candidate.standKey,
            standNumber: candidate.standNumber,
            standLabel: candidate.standLabel,
            title: '組替候補あり',
            actions: ['組替対象を確認する'],
            reason: '中古予備と新品予備（組替可能）が同一スタンド内に存在',
            occurredAt,
            elapsedDays: getElapsedDaysSince(occurredAt, now) || 0
        });
    });

    return tasks.sort(sortTodayTasks);
}

function updateTodayTaskDashboard(allRoles) {
    const dashboard = document.getElementById('today-task-dashboard');
    const countEl = document.getElementById('today-task-count');
    const listEl = document.getElementById('today-task-list');

    if (!dashboard || !countEl || !listEl) {
        return;
    }

    const tasks = getTodayTaskItems(allRoles);
    countEl.textContent = `${tasks.length}件`;
    dashboard.classList.toggle('is-empty', tasks.length === 0);
    syncCollapsibleDashboardState(TODAY_TASK_DASHBOARD_CONFIG);

    if (tasks.length === 0) {
        listEl.innerHTML = '<div class="today-task-empty">本日のタスクはありません</div>';
        return;
    }

    listEl.innerHTML = ['high', 'medium', 'low'].map(priority => {
        const priorityTasks = tasks.filter(task => task.priority === priority);

        if (priorityTasks.length === 0) {
            return '';
        }

        return `
            <section class="today-task-group today-task-${priority}">
                <div class="today-task-priority">
                    <span>${TASK_PRIORITY_LABELS[priority]}</span>
                    <span>${priorityTasks.length}件</span>
                </div>
                <ul class="today-task-items">
                    ${priorityTasks.map(task => {
                        const warning = getTodayTaskWarning(task, allRoles);
                        const taskId = encodeURIComponent(String(task.id || ''));
                        const elapsedClass = getTodayTaskElapsedClass(task.elapsedDays);

                        return `
                        <li class="today-task-item" role="button" tabindex="0" onclick="focusTodayTaskRole('${taskId}')" onkeydown="handleTodayTaskKeydown(event, '${taskId}')">
                            <div class="today-task-main">
                                <span class="today-task-role">${escapeHtml(task.roleName || task.standLabel || '-')}</span>
                                <span class="today-task-label">${escapeHtml(task.title)}</span>
                            </div>
                            ${warning ? `<div class="today-task-warning">${escapeHtml(warning)}</div>` : ''}
                            <div class="today-task-elapsed ${elapsedClass}">発生${escapeHtml(task.elapsedDays || 0)}日</div>
                        </li>
                    `;
                    }).join('')}
                </ul>
            </section>
        `;
    }).join('');
}

function getWorkshopRoleLines(roleList) {
    return roleList
        .slice()
        .sort(compareRolesByStandRole)
        .map(role => {
            const currentDiameter = formatCurrentDiameter(role.currentDiameter);
            const useStartDate = formatUseStartDate(role.useStartDate);

            return `
                <div class="workshop-role-line">
                    <span class="workshop-role-name">${escapeHtml(role.name || '-')}</span>
                    <span class="workshop-role-meta">現在径 ${escapeHtml(currentDiameter)} / 使用開始日 ${escapeHtml(useStartDate)}</span>
                </div>
            `;
        })
        .join('');
}

function getWorkshopReworkSetupAction(item) {
    if (!item) {
        return '-';
    }

    return `${item.roleName || `#${item.standKey}`}のバラシ・搬出・業者引取確認`;
}

function getWorkshopReworkSetupHtml(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return `
            <section class="workshop-board-section">
                <div class="workshop-board-section-header">
                    <h3>改削段取り予定</h3>
                    <span>0件</span>
                </div>
                <div class="workshop-board-empty">改削段取り予定はありません</div>
            </section>
        `;
    }

    return `
        <section class="workshop-board-section">
            <div class="workshop-board-section-header">
                <h3>改削段取り予定</h3>
                <span>${items.length}件</span>
            </div>
            <div class="workshop-board-section-list workshop-rework-setup-list">
                ${items.map(item => `
                    <article class="workshop-card workshop-rework-setup-card">
                        <div class="workshop-card-title">
                            <div class="workshop-card-title-main">
                                <span class="workshop-stand">#${escapeHtml(item.standKey)}</span>
                                <span class="workshop-card-title-text">改削段取り予定</span>
                            </div>
                            <span class="workshop-rework-deadline">${escapeHtml(formatDateForDisplay(item.workshopTaskDueDate))}</span>
                        </div>
                        <div class="workshop-card-summary">
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">工作課タスク化期限</span>
                                <span class="workshop-card-summary-value">${escapeHtml(formatDateForDisplay(item.workshopTaskDueDate))}</span>
                            </div>
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">ロール名</span>
                                <span class="workshop-card-summary-value">${escapeHtml(item.roleName || '-')}</span>
                            </div>
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">搬出可能予定日</span>
                                <span class="workshop-card-summary-value">${escapeHtml(formatDateForDisplay(item.dispatchReadyDate))}</span>
                            </div>
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">業者引取希望日</span>
                                <span class="workshop-card-summary-value">${escapeHtml(formatDateForDisplay(item.vendorPickupDate))}</span>
                            </div>
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">改削戻り予定日</span>
                                <span class="workshop-card-summary-value">${escapeHtml(formatDateForDisplay(item.reworkReturnDate))}</span>
                            </div>
                        </div>
                        <div class="workshop-card-section">
                            <span class="workshop-card-label">必要アクション</span>
                            <div class="workshop-role-line">
                                <span class="workshop-role-name">${escapeHtml(getWorkshopReworkSetupAction(item))}</span>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function getWorkshopAssemblyCandidatesHtml(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return `
            <section class="workshop-board-section">
                <div class="workshop-board-section-header">
                    <h3>組替候補</h3>
                    <span>0件</span>
                </div>
                <div class="workshop-board-empty">組替候補はありません</div>
            </section>
        `;
    }

    return `
        <section class="workshop-board-section">
            <div class="workshop-board-section-header">
                <h3>組替候補</h3>
                <span>${candidates.length}件</span>
            </div>
            <div class="workshop-board-section-list">
                ${candidates.map(candidate => `
                    <article class="workshop-card">
                        <div class="workshop-card-title">
                            <div class="workshop-card-title-main">
                                <span class="workshop-stand">${escapeHtml(candidate.standLabel)}</span>
                                <span class="workshop-card-title-text">組替候補</span>
                            </div>
                            <span class="workshop-priority-badge workshop-priority-${escapeHtml(candidate.details.priority)}">${escapeHtml(candidate.details.priorityLabel)}</span>
                        </div>
                        <div class="workshop-card-summary">
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">優先度</span>
                                <span class="workshop-card-summary-value">${escapeHtml(candidate.details.priorityLabel)}</span>
                            </div>
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">中古予備になった日</span>
                                <span class="workshop-card-summary-value">${escapeHtml(candidate.details.standbyDateLabel)}</span>
                            </div>
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">暫定ロール替目安</span>
                                <span class="workshop-card-summary-value">${escapeHtml(candidate.details.estimatedReplacementLabel)}</span>
                            </div>
                            <div class="workshop-card-summary-item">
                                <span class="workshop-card-summary-label">残日数</span>
                                <span class="workshop-card-summary-value">${escapeHtml(candidate.details.remainingDaysLabel)}</span>
                            </div>
                        </div>
                        <div class="workshop-card-section">
                            <span class="workshop-card-label">中古予備（バラシ前）</span>
                            <div class="workshop-role-list">${getWorkshopRoleLines(candidate.usedRoles)}</div>
                        </div>
                        <div class="workshop-card-section">
                            <span class="workshop-card-label">新品予備（組替可能）</span>
                            <div class="workshop-role-list">${getWorkshopRoleLines(candidate.newReadyRoles)}</div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function updateWorkshopBoard(allRoles) {
    const board = document.getElementById('workshop-board');
    const countEl = document.getElementById('workshop-board-count');
    const listEl = document.getElementById('workshop-board-list');

    if (!board || !countEl || !listEl) {
        return;
    }

    const sortSelect = document.getElementById('workshop-board-sort');
    if (sortSelect) {
        sortSelect.value = normalizeWorkshopBoardSortOption(workshopBoardSortOption);
    }

    const candidates = getAssemblyCandidateItems(allRoles)
        .map(candidate => ({
            ...candidate,
            details: getWorkshopBoardCandidateDetails(candidate)
        }))
        .sort(compareWorkshopBoardCandidates);
    const reworkSetupItems = getReworkSetupPlanItems(allRoles);
    const totalCount = candidates.length + reworkSetupItems.length;

    countEl.textContent = `${totalCount}件`;

    if (totalCount === 0) {
        listEl.innerHTML = '<div class="workshop-board-empty">改削段取り予定・組替候補はありません</div>';
        return;
    }

    listEl.innerHTML = [
        getWorkshopReworkSetupHtml(reworkSetupItems),
        getWorkshopAssemblyCandidatesHtml(candidates)
    ].join('');
}

function setWorkshopBoardOpen(isOpen) {
    isWorkshopBoardOpen = Boolean(isOpen);
    document.body.classList.toggle('workshop-board-mode', isWorkshopBoardOpen);

    const button = document.getElementById('workshopBoardBtn');
    if (button) {
        button.setAttribute('aria-pressed', isWorkshopBoardOpen ? 'true' : 'false');
        button.textContent = isWorkshopBoardOpen ? 'ロール一覧に戻る' : '工作課ボード';
    }

    updateWorkshopBoard(roles);
}

function toggleWorkshopBoard() {
    setWorkshopBoardOpen(!isWorkshopBoardOpen);
}

function closeWorkshopBoard() {
    setWorkshopBoardOpen(false);
}

function getTodayTaskWarning(task, allRoles = []) {
    if (!task) {
        return '';
    }

    if (String(task.id || '').startsWith('rework-ready-')) {
        const role = allRoles.find(item => String(item.id) === String(task.id).replace('rework-ready-', ''));
        return role && getRoleDispatchDate(role) ? '' : '⚠ 搬出日未設定';
    }

    if (String(task.id || '').startsWith('assembly-')) {
        return '⚠ 日程未設定';
    }

    if (String(task.id || '').startsWith('reworking-confirm-')) {
        return `⚠ ${task.reason || '搬入確認'}`;
    }

    if (String(task.id || '').startsWith('reserve-shortage-')) {
        return '⚠ 予備不足';
    }

    return '';
}

function getTodayTaskElapsedClass(elapsedDays) {
    const days = Number(elapsedDays) || 0;

    if (days >= 7) {
        return 'is-critical';
    }

    if (days >= 4) {
        return 'is-warning';
    }

    return 'is-normal';
}

function handleTodayTaskKeydown(event, taskId) {
    if (!event || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
    }

    event.preventDefault();
    focusTodayTaskRole(taskId);
}

function focusTodayTaskRole(taskId) {
    const decodedTaskId = decodeURIComponent(String(taskId || ''));
    const task = getTodayTaskItems(roles).find(item => String(item.id) === decodedTaskId);
    const targetRole = getTodayTaskTargetRole(task);

    if (!targetRole) {
        showToast(task ? '対象ロールは現在の表示条件では見つかりません' : '対象ロールが見つかりません');
        return;
    }

    scrollToRoleCard(targetRole.id, null, {
        highlight: true,
        notifyMissing: true,
        priority: task.priority
    });
}

function getTodayTaskTargetRole(task) {
    if (!task) {
        return null;
    }

    const taskId = String(task.id || '');
    const roleTaskPrefixes = ['rework-ready-', 'reworking-confirm-'];
    const roleTaskPrefix = roleTaskPrefixes.find(prefix => taskId.startsWith(prefix));

    if (roleTaskPrefix) {
        const roleId = taskId.replace(roleTaskPrefix, '');
        return roles.find(role => String(role.id) === String(roleId)) || null;
    }

    if (taskId.startsWith('assembly-')) {
        return getTodayTaskStandTargetRole(task, [USED_STANDBY_STATUS, NEW_READY_STATUS]);
    }

    if (taskId.startsWith('reserve-shortage-')) {
        const normallyHiddenStatuses = [NEW_STORAGE_STATUS, SCRAP_WAITING_STATUS, DISCARDED_STATUS];
        return getTodayTaskStandTargetRole(task, ALLOWED_STATUSES.filter(status => !normallyHiddenStatuses.includes(status)));
    }

    if (task.standKey) {
        return getTodayTaskStandTargetRole(task);
    }

    return null;
}

function getTodayTaskStandTargetRole(task, targetStatuses = null) {
    if (!task || !task.standKey) {
        return null;
    }

    const visibleRoleIds = new Set(getFilteredRoles().map(role => String(role.id)));
    const statusPriority = Array.isArray(targetStatuses)
        ? new Map(targetStatuses.map((status, index) => [status, index]))
        : null;
    const candidates = roles
        .filter(role => getStandKey(role.name) === task.standKey)
        .filter(role => !statusPriority || statusPriority.has(role.status))
        .sort((a, b) => {
            if (statusPriority) {
                const priorityDiff = statusPriority.get(a.status) - statusPriority.get(b.status);
                if (priorityDiff !== 0) {
                    return priorityDiff;
                }
            }
            return compareUpdatedAt(a, b, 'desc');
        });

    return candidates.find(role => visibleRoleIds.has(String(role.id))) || null;
}

function getWatchStandItems(allRoles) {
    const groups = new Map();

    allRoles.forEach(role => {
        const standKey = getStandKey(role.name);
        if (!standKey) {
            return;
        }

        if (!groups.has(standKey)) {
            groups.set(standKey, []);
        }
        groups.get(standKey).push(role);
    });

    return Array.from(groups.entries())
        .map(([standKey, standRoles]) => {
            const statuses = standRoles.map(role => String(role.status || ''));
            const reasons = [];
            let severity = 0;

            if (statuses.includes(SCRAP_WAITING_STATUS) && !statuses.includes(NEW_INSTALLED_STATUS)) {
                reasons.push('廃却待ち（ラック保管）あり・予備不足');
                severity = Math.max(severity, 2);
            }

            if (statuses.includes(REWORK_READY_STATUS) && !statuses.includes(REWORKING_STATUS)) {
                reasons.push('改削行きあり・未着手');
                severity = Math.max(severity, 1);
            }

            return {
                standKey,
                standNumber: Number(standKey),
                reasons,
                severity
            };
        })
        .filter(item => item.reasons.length > 0)
        .sort((a, b) => {
            if (b.severity !== a.severity) {
                return b.severity - a.severity;
            }
            return a.standNumber - b.standNumber;
        });
}

function updateWatchStandDashboard(allRoles) {
    const dashboard = document.getElementById('watch-stand-dashboard');
    const countEl = document.getElementById('watch-stand-count');
    const listEl = document.getElementById('watch-stand-list');

    if (!dashboard || !countEl || !listEl) {
        return;
    }

    const watchItems = getWatchStandItems(allRoles);
    countEl.textContent = `${watchItems.length}件`;
    dashboard.classList.toggle('is-empty', watchItems.length === 0);

    if (watchItems.length === 0) {
        listEl.innerHTML = '<div class="watch-stand-empty">要注意スタンドはありません</div>';
        return;
    }

    listEl.innerHTML = watchItems.map(item => `
        <button type="button" class="watch-stand-item" onclick="filterWatchStand('${escapeHtml(item.standKey)}')">
            <span class="watch-stand-name">#${escapeHtml(item.standKey)}</span>
            <span class="watch-stand-reason">理由：${escapeHtml(item.reasons.join('・'))}</span>
        </button>
    `).join('');
}

function filterWatchStand(standKey) {
    watchStandFilter = String(standKey || '');
    searchQuery = '';
    const searchInput = document.getElementById('role-search');
    if (searchInput) {
        searchInput.value = '';
    }
    resetStatusFilter();
    renderRoles();
}

function getFilteredRoles() {
    const normalizedQuery = String(searchQuery).trim().toLowerCase();
    const hasSearch = normalizedQuery.length > 0;
    return roles.filter(role => {
        if (!isStatusMatched(role)) {
            return false;
        }
        if (!isWatchStandMatched(role)) {
            return false;
        }
        const isNormallyHiddenStatus = role.status === NEW_STORAGE_STATUS || role.status === SCRAP_WAITING_STATUS;
        if (isNormallyHiddenStatus && statusFilter !== role.status && !hasSearch) {
            return false;
        }
        if (!hasSearch) {
            return true;
        }
        return [
            String(role.name || ''),
            String(role.status || ''),
            String(role.memo || '')
        ].some(field => field.toLowerCase().includes(normalizedQuery));
    });
}
function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;

  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "rgba(40,40,40,0.92)";
  toast.style.color = "#fff";
  toast.style.padding = "14px 22px";
  toast.style.borderRadius = "14px";
  toast.style.fontSize = "16px";
  toast.style.fontWeight = "700";
  toast.style.zIndex = "99999";
  toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.25s ease";

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  setTimeout(() => {
    toast.style.opacity = "0";

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 1800);
}

function scrollToRoleCard(roleId, fallbackScrollY = null, options = {}) {
    window.setTimeout(() => {
        const targetRow = document.getElementById(`role-${roleId}`);

        if (targetRow) {
            targetRow.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            if (options.highlight) {
                const priorityClass = getTodayTaskHighlightClass(options.priority);
                targetRow.classList.remove(
                    'today-task-target-highlight',
                    'today-task-target-high',
                    'today-task-target-medium',
                    'today-task-target-low'
                );
                void targetRow.offsetWidth;
                targetRow.classList.add('today-task-target-highlight', priorityClass);
                window.setTimeout(() => {
                    targetRow.classList.remove(
                        'today-task-target-highlight',
                        'today-task-target-high',
                        'today-task-target-medium',
                        'today-task-target-low'
                    );
                }, 4000);
            }
            return;
        }

        if (fallbackScrollY !== null) {
            window.scrollTo({
                top: fallbackScrollY,
                behavior: "smooth"
            });
        } else if (options.notifyMissing) {
            showToast('対象ロールは現在の表示条件では見つかりません');
        }
    }, 300);
}

function getTodayTaskHighlightClass(priority) {
    if (priority === 'high') {
        return 'today-task-target-high';
    }

    if (priority === 'medium') {
        return 'today-task-target-medium';
    }

    return 'today-task-target-low';
}

function scrollPageToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function scrollPageToBottom() {
    window.scrollTo({
        top: getPageScrollableHeight(),
        behavior: 'smooth'
    });
}

function scrollPageByCurrentPosition() {
    if (isPageAboveHalf()) {
        scrollPageToBottom();
        window.setTimeout(updatePageScrollButton, 450);
        return;
    }

    scrollPageToTop();
    window.setTimeout(updatePageScrollButton, 450);
}

function getPageScrollableHeight() {
    const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );
    return Math.max(0, scrollHeight - window.innerHeight);
}

function isPageAboveHalf() {
    const scrollableHeight = getPageScrollableHeight();

    if (scrollableHeight <= 0) {
        return true;
    }

    return window.scrollY <= scrollableHeight / 2;
}

function updatePageScrollButton() {
    const button = document.getElementById('pageScrollToggleBtn');

    if (!button) {
        return;
    }

    if (isPageAboveHalf()) {
        button.textContent = '↓ 下へ';
        button.setAttribute('aria-label', 'ページ下部へ移動');
    } else {
        button.textContent = '↑ 上へ';
        button.setAttribute('aria-label', 'ページ上部へ移動');
    }
}

function renderRoles() {
    const roleList = document.getElementById('role-list');
    roleList.innerHTML = '';
    
    const filteredRoles = getFilteredRoles();
    updateCountSummary(roles);
    updatePriorityStandCard();
    updateStandRiskMap();
    updateThreeSetManagementDashboard(roles);
    updateThreeSetForecastDashboard(roles);
    updateIncompleteWorkDashboard(roles);
    updateDangerRollDashboard(roles);
    updateCuttingAnomalyDashboard();
    updatePurchaseConfirmationBoard(roles);
    updateWorkshopBoard(roles);
    if (typeof updateSyncDiagnosticPanel === 'function') {
        updateSyncDiagnosticPanel();
    }

    const visibleRoles = filteredRoles
        .slice()
        .sort((a, b) => {
            if (sortOption === 'name') {
                return compareRolesByStandRole(a, b);
            }
            if (sortOption === 'updatedAtAsc') {
                return compareUpdatedAt(a, b, 'asc');
            }
            return compareUpdatedAt(a, b, 'desc');
        });
    logRenderStatusDebug(visibleRoles);
    const countInfo = document.getElementById('role-count');
    if (countInfo) {
        const hasSearch = searchQuery.trim().length > 0;
        const hasStatusFilter = statusFilter !== 'all';
        const hasWatchStandFilter = Boolean(watchStandFilter);
        if (hasSearch || hasStatusFilter || hasWatchStandFilter) {
            countInfo.textContent = `現在${visibleRoles.length}件表示中 / 全${roles.length}件`;
        } else {
            countInfo.textContent = '';
        }
    }
    if (visibleRoles.length === 0) {
        const message = roles.length === 0
            ? 'ロールがまだ登録されていません'
            : '検索条件に一致するロールが見つかりません';
        roleList.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #999;">${message}</td></tr>`;
        return;
    }

    visibleRoles.forEach(role => {
        const row = document.createElement('tr');
        row.id = `role-${role.id}`;

        if (updatedRoleId === role.id) {
  row.classList.add("updated-row");
}

        const standMatch = String(role.name || '').match(/#?(\d+)/);
const standNumber = standMatch ? Number(standMatch[1]) : 0;

if (standNumber >= 2 && standNumber <= 5) {
    row.style.borderLeft = '6px solid #4caf50';
    row.style.backgroundColor = 'rgba(76, 175, 80, 0.08)';
} else if (standNumber >= 6 && standNumber <= 9) {
    row.style.borderLeft = '6px solid #2196f3';
    row.style.backgroundColor = 'rgba(33, 150, 243, 0.08)';
} else if (standNumber >= 10 && standNumber <= 13) {
    row.style.borderLeft = '6px solid #ff9800';
    row.style.backgroundColor = 'rgba(255, 152, 0, 0.08)';
} else if (standNumber >= 14 && standNumber <= 17) {
    row.style.borderLeft = '6px solid #e91e63';
    row.style.backgroundColor = 'rgba(233, 30, 99, 0.08)';
}
        if (role.status === SCRAP_WAITING_STATUS) {
            row.style.borderLeft = '6px solid #dc2626';
            row.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
        } else if (role.status === DISCARDED_STATUS) {
            row.style.borderLeft = '6px solid #111827';
            row.style.backgroundColor = 'rgba(17, 24, 39, 0.08)';
        }
        const formattedDate = formatUpdatedAt(role.updatedAt);
        const currentDiameterText = formatCurrentDiameter(role.currentDiameter);
        const coatingDisplay = getCoatingStatusDisplay(role);
        const workProgressState = getWorkProgressState(role);
        const memoMobileText = hasDisplayMemo(role.memo) ? getMemoPreview(role.memo) : '';
        if (workProgressState.isIncomplete) {
            row.classList.add('work-request-incomplete');
            row.style.borderLeft = '6px solid #dc2626';
        } else if (workProgressState.isComplete) {
            row.classList.add('work-request-complete');
            row.style.borderLeft = '6px solid #16a34a';
        }
        row.innerHTML = `
            <td class="stand-cell">
  <div class="stand-card-header">
    <span class="role-id stand-name-cell">${escapeHtml(role.name)}</span>
    <div class="diameter-hero">
      <span class="header-diameter-value">${escapeHtml(currentDiameterText)}</span>
      ${getRemainingDiameterHtml(role)}
    </div>
    <div class="stand-card-actions">
      ${workProgressState.isIncomplete ? '<span class="work-request-badge">作業依頼中</span>' : ''}
      <button class="action-btn history-btn history-card-btn" onclick="showHistory('${role.id}')">履歴</button>
    </div>
  </div>
  ${getReworkJudgmentHtml(role)}
  ${updatedRoleId === role.id ? '<span class="updated-badge">更新しました</span>' : ''}
</td>
            <td class="status-cell">${getStatusBadge(role.status)}</td>
            <td class="memo-cell ${hasDisplayMemo(role.memo) ? '' : 'is-empty-memo'}">
                ${coatingDisplay ? `
                    <div class="coating-status-badge ${coatingDisplay.isWarning ? 'is-warning' : 'is-ready'}">
                        <span>${escapeHtml(coatingDisplay.label)}</span>
                        ${coatingDisplay.note ? `<strong>${escapeHtml(coatingDisplay.note)}</strong>` : ''}
                    </div>
                ` : ''}
                <div class="role-info-grid">${getRoleInfoHtml(role, formattedDate)}</div>
                <span class="memo-mobile-text">${escapeHtml(memoMobileText)}</span>
            </td>
            <td class="current-diameter-cell">
            </td>
            <td class="updated-at-cell">${formattedDate}</td>
            <td class="progress-cell">${getWorkProgressHtml(role)}</td>

            <td class="actions-cell card-actions">
            
                <div class="action-buttons card-actions-list">
                    <button class="action-btn edit-btn" onclick="editRole('${role.id}')">✏️ 編集</button>
                    ${role.status === REWORK_READY_STATUS ? `
  <button class="action-btn request-btn" onclick="requestWork('${role.id}')">
    📦 ${WORK_REQUEST_ACTION_LABEL}
  </button>
` : ""}
                    <button class="action-btn delete-btn" onclick="deleteRole('${role.id}')">🗑️ 削除</button>
                </div>
            </td>
        `;
        roleList.appendChild(row);
    });
}

function addRole() {
    if (warnIfOperatorMissing()) {
        return;
    }

    const roleName = document.getElementById('role-name').value.trim();
    const roleStatus = document.getElementById('role-status').value;
    const roleCoatingStatus = normalizeCoatingStatusValue(document.getElementById('role-coating-status').value, roleStatus);
    const roleCurrentDiameter = normalizeCurrentDiameter(document.getElementById('role-current-diameter').value);
    const roleDispatchDate = isDispatchDateAllowedStatus(roleStatus)
        ? normalizeDateInputValue(document.getElementById('role-dispatch-date').value)
        : '';
    const roleMemo = document.getElementById('role-memo').value.trim();
    
    if (!roleName) {
        alert('スタンド番号を入力してください');
        return;
    }
    if (!roleStatus) {
        alert('ステータスを選択してください');
        return;
    }
    if (roles.some(r => r.name === roleName)) {
        alert('このスタンド番号は既に登録されています');
        return;
    }
    const newRole = { id: nextId++, name: roleName, status: roleStatus, coatingStatus: roleCoatingStatus, memo: roleMemo, currentDiameter: roleCurrentDiameter, dispatchDate: roleDispatchDate, useStartDate: '', updatedAt: new Date().toISOString(), workProgress: normalizeWorkProgress({ dispatchDate: roleDispatchDate }), history: [] };
    addRoleHistoryEntry(newRole, 'create', '新規追加', '-', roleStatus, newRole.updatedAt);
    setUseStartDateIfNeeded(newRole, newRole.updatedAt);
    
    // オンライン重複制御
    if (roleStatus === 'オンライン') {
        const group = getGroup(roleName);
        roles.forEach(r => {
            if (getGroup(r.name) === group && r.status === 'オンライン') {
                addRoleHistoryEntry(r, 'status', 'ステータス変更', r.status, '中古予備（バラシ前）');
                r.status = '中古予備（バラシ前）';
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    roles.push(newRole);
    updatedRoleId = newRole.id;
    saveLocalRoles();
    document.getElementById('role-name').value = '';
    document.getElementById('role-status').value = '';
    updateStatusPreview(document.getElementById('role-status'));
    document.getElementById('role-coating-status').value = '';
    document.getElementById('role-current-diameter').value = '';
    clearDiameterChangeReason();
    document.getElementById('role-dispatch-date').value = '';
    updateInboundPlanPreview();
    document.getElementById('role-memo').value = '';
    setRoleFormOpen(false);
    renderRoles();
    scrollToRoleCard(newRole.id);
    syncRoles();

    setTimeout(() => {
        updatedRoleId = null;
        renderRoles();
    }, 3000);
}


function editRole(id) {
    lastScrollY = window.scrollY;
    const role = roles.find(r => String(r.id) === String(id));
    if (!role) return;
    
    editingId = id;
    document.getElementById('role-name').value = role.name;
    document.getElementById('role-status').value = role.status;
    updateStatusPreview(document.getElementById('role-status'));
    document.getElementById('role-coating-status').value = normalizeCoatingStatusValue(role.coatingStatus, role.status);
    document.getElementById('role-current-diameter').value = normalizeCurrentDiameter(role.currentDiameter);
    clearDiameterChangeReason();
    document.getElementById('role-dispatch-date').value = isDispatchDateAllowedStatus(role.status)
        ? getRoleDispatchDate(role)
        : '';
    updateInboundPlanPreview();
    document.getElementById('role-memo').value = role.memo || '';
    
    setEditModeUi(role);
    window.scrollTo({
  top: 0,
  behavior: 'smooth'
});
}

function updateRole() {
    if (editingId === null) return;
    if (warnIfOperatorMissing()) {
        return;
    }
    
    const roleName = document.getElementById('role-name').value.trim();
    const roleStatus = document.getElementById('role-status').value;
    const roleCoatingStatus = normalizeCoatingStatusValue(document.getElementById('role-coating-status').value, roleStatus);
    const roleCurrentDiameter = normalizeCurrentDiameter(document.getElementById('role-current-diameter').value);
    const diameterChangeReason = getDiameterChangeReason();
    const roleDispatchDate = isDispatchDateAllowedStatus(roleStatus)
        ? normalizeDateInputValue(document.getElementById('role-dispatch-date').value)
        : '';
    const roleMemo = document.getElementById('role-memo').value.trim();
    
    if (!roleName) {
        alert('スタンド番号を入力してください');
        return;
    }
    if (!roleStatus) {
        alert('ステータスを選択してください');
        return;
    }
    
    const role = roles.find(r => String(r.id) === String(editingId));
    if (!role) return;
    const beforeName = role.name;
    const beforeStatus = role.status || '';
    const beforeCoatingStatus = normalizeCoatingStatusValue(role.coatingStatus, role.status);
    const beforeMemo = role.memo || '';
    const beforeCurrentDiameter = normalizeCurrentDiameter(role.currentDiameter);
    const beforeDispatchDate = getRoleDispatchDate(role);
    
    if (roleName !== role.name && roles.some(r => r.id !== editingId && r.name === roleName)) {
        alert('このスタンド番号は既に登録されています');
        return;
    }
    
    if (roleStatus === 'オンライン') {
        const group = getGroup(roleName);
        roles.forEach(r => {
            if (r.id !== editingId && getGroup(r.name) === group && r.status === 'オンライン') {
                addRoleHistoryEntry(r, 'status', 'ステータス変更', r.status, '中古予備（バラシ前）');
                r.status = '中古予備（バラシ前）';
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    role.name = roleName;
    role.status = roleStatus;
    role.coatingStatus = roleCoatingStatus;
    role.memo = roleMemo;
    role.currentDiameter = roleCurrentDiameter;
    role.dispatchDate = roleDispatchDate;
    role.useStartDate = normalizeUseStartDate(role.useStartDate);
    role.updatedAt = new Date().toISOString();
    role.workProgress = normalizeWorkProgress({
        ...role,
        workProgress: {
            ...(role.workProgress || {}),
            dispatchDate: roleDispatchDate
        }
    });
    if (beforeName !== roleName) {
        role.history = normalizeRoleHistory(role).map(entry => ({
            ...entry,
            roleName: entry.roleName === beforeName ? roleName : entry.roleName
        }));
    }
    addRoleHistoryEntry(role, 'status', 'ステータス変更', beforeStatus, roleStatus, role.updatedAt);
    addRoleHistoryEntry(role, 'coatingStatus', '溶射状態変更', getCoatingStatusLabel(beforeCoatingStatus), getCoatingStatusLabel(roleCoatingStatus), role.updatedAt);
    setUseStartDateIfNeeded(role, role.updatedAt);
    addRoleHistoryEntry(role, 'memo', 'メモ変更', beforeMemo, roleMemo, role.updatedAt);
    addRoleHistoryEntry(role, 'diameter', '現在径変更', formatCurrentDiameter(beforeCurrentDiameter), formatCurrentDiameter(roleCurrentDiameter), role.updatedAt);
    addRoleHistoryEntry(role, 'dispatchDate', '搬出日変更', formatDateForDisplay(beforeDispatchDate), formatDateForDisplay(roleDispatchDate), role.updatedAt);
    const shouldAppendWorkHistory = beforeCurrentDiameter !== roleCurrentDiameter && diameterChangeReason === '改削';
    const workHistoryEvent = shouldAppendWorkHistory
        ? buildWorkHistoryDiameterEvent(role, beforeCurrentDiameter, roleCurrentDiameter, role.updatedAt)
        : null;
    const shouldInvalidateCuttingHistory = beforeCurrentDiameter !== roleCurrentDiameter && diameterChangeReason === '入力ミス修正';
    const cuttingHistoryInvalidationEvent = shouldInvalidateCuttingHistory
        ? buildCuttingHistoryInputCorrectionInvalidationEvent(role, beforeCurrentDiameter, roleCurrentDiameter, role.updatedAt)
        : null;

    updatedRoleId = role.id;
    const debugRoleIndex = findDebugRoleIndex(roles);
    console.log('ROLL_DEBUG_UPDATE_ROLE_BEFORE_SAVE', {
        rolesLength: roles.length,
        targetIndex: debugRoleIndex,
        target: debugRoleIndex >= 0 ? getDebugRoleSnapshot(roles[debugRoleIndex]) : null,
        afterTarget5: getDebugRoleSlice(roles, debugRoleIndex)
    });
    
    saveLocalRoles();
    if (workHistoryEvent) {
        appendWorkHistoryEvent(workHistoryEvent).then(success => {
            if (!success) {
                showToast('作業履歴への記録に失敗しました');
            }
        });
    }
    if (cuttingHistoryInvalidationEvent) {
        invalidateLatestCuttingHistoryForInputCorrection(cuttingHistoryInvalidationEvent).then(success => {
            if (!success) {
                showToast('改削履歴の無効化に失敗しました');
            }
        });
    }
    cancelEdit();

    renderRoles();
    syncRoles();
    showToast("更新しました");

setTimeout(() => {
  updatedRoleId = null;
  renderRoles();
}, 3000);

scrollToRoleCard(role.id, lastScrollY);
}


function cancelEdit() {
    editingId = null;
    document.getElementById('role-name').value = '';
    document.getElementById('role-status').value = '';
    updateStatusPreview(document.getElementById('role-status'));
    document.getElementById('role-coating-status').value = '';
    document.getElementById('role-current-diameter').value = '';
    clearDiameterChangeReason();
    document.getElementById('role-dispatch-date').value = '';
    updateInboundPlanPreview();
    document.getElementById('role-memo').value = '';
    setEditModeUi(null);
    renderRoles();
}

function requestWork(roleId) {
    const role = roles.find(r => String(r.id) === String(roleId));

    if (!role) return;
    role.workProgress = normalizeWorkProgress(role);

    if (isWorkProgressStepDone(role.workProgress, 'vendorSentAt')) {
        alert('業者へ送信は完了済みです');
        return;
    }

    if (!isWorkProgressStepEnabled(role, 3)) {
        alert('前工程が完了していないため、業者へ送信は完了できません');
        return;
    }

    const subject = `【作業依頼】${role.name}`;

    const body =
`スタンド番号：${role.name}

ステータス：${role.status}

メモ：
${role.memo || "なし"}

作業内容：
・引き取り依頼
・改削依頼注文書の作成送付

依頼日時：
${new Date().toLocaleString("ja-JP")}
`;

    const mailtoUrl =
`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const confirmed = confirm("業者送信メールを作成し、工程「業者へ送信」を完了にしますか？");

    if (!confirmed) return;

    const completed = completeWorkProgressStep(roleId, 'vendorSentAt', { skipConfirm: true, skipRender: true });

    if (!completed) {
        return;
    }

    saveLocalRoles();
    renderRoles();
    syncRoles();

    window.open(mailtoUrl, "_blank");
}

function completeWorkProgressStep(roleId, stepKey, options = {}) {
    if (warnIfOperatorMissing()) {
        return false;
    }

    const role = roles.find(r => String(r.id) === String(roleId));
    const stepIndex = WORK_PROGRESS_STEPS.findIndex(step => step.key === stepKey);
    const step = WORK_PROGRESS_STEPS[stepIndex];

    if (!role || !step || role.status !== REWORK_READY_STATUS) {
        return false;
    }

    role.workProgress = normalizeWorkProgress(role);
    const beforeCompletedCount = getWorkProgressCompletedCount(role);

    if (isWorkProgressStepDone(role.workProgress, stepKey)) {
        return false;
    }

    if (!isWorkProgressStepEnabled(role, stepIndex)) {
        alert('前工程が完了していないため、この工程は完了できません');
        return false;
    }

    if (step.key === PICKUP_ADJUSTED_STEP_KEY && !role.workProgress.dispatchDate) {
        alert('搬出日を入力してください');
        return false;
    }

    if (!options.skipConfirm && !confirm(`${step.label}を完了にしますか？`)) {
        return false;
    }

    const completedAt = new Date().toISOString();
    const operator = getSelectedOperator();
    const beforeValue = getWorkProgressStepUpdatedAt(role.workProgress, stepKey);
    role.workProgress[stepKey] = {
        done: true,
        updatedAt: completedAt,
        updatedBy: operator ? operator.name : ''
    };
    if (stepKey === PICKUP_ADJUSTED_STEP_KEY) {
        role.workProgress.pickupAdjustedBy = operator ? operator.name : '';
    }
    role.requestSent = isWorkProgressStepDone(role.workProgress, 'vendorSentAt');
    role.updatedAt = completedAt;
    addRoleHistoryEntry(role, 'workProgress', '作業依頼進捗変更', beforeValue, `${step.label}: ${formatUpdatedAt(completedAt)}`, completedAt);

    const afterCompletedCount = getWorkProgressCompletedCount(role);
    const isWorkProgressJustCompleted = beforeCompletedCount < WORK_PROGRESS_STEPS.length
        && afterCompletedCount >= WORK_PROGRESS_STEPS.length;

    if (isWorkProgressJustCompleted && role.status === REWORK_READY_STATUS) {
        const shouldStartReworking = confirm('作業依頼が完了しました。ステータスを「改削中」に変更しますか？');

        if (shouldStartReworking) {
            const beforeStatus = role.status;
            role.status = REWORKING_STATUS;
            role.updatedAt = completedAt;
            addRoleHistoryEntry(role, 'status', 'ステータス変更', beforeStatus, REWORKING_STATUS, completedAt);
        }
    }

    saveLocalRoles();

    if (!options.skipRender) {
        renderRoles();
        syncRoles();
        showToast(`${step.label}を完了しました`);
    }

    return true;
}

function deleteRole(id) {
    warnIfOperatorMissing();
    const target = roles.find(r => String(r.id) === String(id));

    if (!target) {
        alert('削除対象が見つかりません');
        return;
    }

    if (confirm(`${target.name} を削除しますか？`)) {
        markRoleDeleted(target.id);
        roles = roles.filter(r => String(r.id) !== String(id));
        saveLocalRoles();
        renderRoles();
        syncRoles();
        showToast('削除しました');
    }
}

// 初期表示
checkLoginStatus();

const searchInput = document.getElementById('role-search');
if (searchInput) {
    searchInput.addEventListener('input', (event) => {
        searchQuery = event.target.value;
        renderRoles();
    });
}

function showAppUpdateNotice() {
    const notice = document.getElementById('app-update-notice');
    const reloadBtn = document.getElementById('app-update-reload-btn');

    if (!notice || !reloadBtn) {
        return;
    }

    notice.hidden = false;
    reloadBtn.onclick = () => {
        location.reload();
    };
}

// Service Worker登録
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(registration => {
            console.log('Service Worker registered:', registration);
            
            if (registration.waiting) {
                showAppUpdateNotice();
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) {
                    return;
                }
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showAppUpdateNotice();
                    }
                });
            });

            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'SW_UPDATED') {
                    showAppUpdateNotice();
                }
            });

            setInterval(() => {
                registration.update();
            }, 60000); // 1分ごとにチェック
        })
        .catch(error => console.log('Service Worker registration failed:', error));
}

// PWAインストール促進
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // インストール可能な場合の処理
    console.log('PWA install prompt is ready');
});
function restoreLatestBackup() {

    const backup = localStorage.getItem('roles_backup_latest');

    if (!backup) {
        alert('バックアップがありません。');
        return;
    }
const backupKeys = Object.keys(localStorage)
  .filter(key => key.startsWith('roles_backup_') && !key.startsWith('roles_backup_before_restore_'))
  .sort()
  .reverse();

console.log('バックアップ一覧', backupKeys);
    const ok = confirm('最新バックアップを復元しますか？');

    if (!ok) {
        return;
    }

    let restoredRoles;
    try {
        restoredRoles = JSON.parse(backup);
    } catch (error) {
        alert('バックアップデータが壊れているため復元できません。');
        return;
    }

    if (!Array.isArray(restoredRoles)) {
        alert('バックアップデータの形式が正しくないため復元できません。');
        return;
    }

    if (restoredRoles.length === 0) {
    alert('バックアップが0件のため復元を中止しました');
    return;
}
const beforeRestoreKey = `roles_backup_before_restore_${new Date().toISOString()}`;
localStorage.setItem(beforeRestoreKey, localStorage.getItem('roles') || '[]');
roles = restoredRoles;
const ids = roles.map(r => Number(r.id) || 0);
nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
localStorage.setItem('roles', JSON.stringify(roles));

    renderRoles();

    alert('バックアップを復元しました。');
}
function toggleTabletMode() {
    const isTabletMode = document.body.classList.toggle('tablet-mode');
    localStorage.setItem('tablet_mode_enabled', isTabletMode ? 'true' : 'false');

    const button = document.getElementById('tabletModeBtn');
    if (button) {
        button.textContent = isTabletMode ? 'タブレットモード ON' : 'タブレットモード OFF';
        button.setAttribute('aria-pressed', isTabletMode ? 'true' : 'false');
    }
}

function applyTabletModePreference() {
    const savedValue = localStorage.getItem('tablet_mode_enabled');
    const isTabletMode = savedValue === null ? true : savedValue === 'true';

    document.body.classList.toggle('tablet-mode', isTabletMode);

    const button = document.getElementById('tabletModeBtn');
    if (button) {
        button.textContent = isTabletMode ? 'タブレットモード ON' : 'タブレットモード OFF';
        button.setAttribute('aria-pressed', isTabletMode ? 'true' : 'false');
    }
}

function applyAdminMode(isAdminMode) {
    document.body.classList.toggle('admin-mode', isAdminMode);

    const button = document.getElementById('adminModeBtn');
    if (button) {
        button.textContent = isAdminMode ? '管理者モード ON' : '管理者モード OFF';
        button.setAttribute('aria-pressed', isAdminMode ? 'true' : 'false');
    }
}

function toggleAdminMode() {
    const isAdminMode = document.body.classList.contains('admin-mode');

    if (isAdminMode) {
        applyAdminMode(false);
        return;
    }

    if (confirm('管理者モードをONにしますか？')) {
        applyAdminMode(true);
    }
}

function setSummaryFilter(status) {
    const statusFilter = document.getElementById('status-filter');
    watchStandFilter = null;

    if (!statusFilter) {
        return;
    }

    statusFilter.value = status;

    changeStatusFilter({
        target: {
            value: statusFilter.value
        }
    });
}
window.loadRoles = loadLocalRoles;
window.login = login;
