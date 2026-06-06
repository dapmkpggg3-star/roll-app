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
    setupOperatorSelect();
    loadRemoteRoles();
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
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDetailModal();
        }
    });
    applyAdminMode(false);
    updatePageScrollButton();
});

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
const REWORKING_CONFIRM_THRESHOLD_DAYS = 25;
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
const WORK_PROGRESS_STEPS = [
    { key: 'requestFormCreatedAt', label: '改削依頼書作成' },
    { key: 'sealConfirmedAt', label: '押印確認' },
    { key: 'pdfCreatedAt', label: 'PDF化' },
    { key: 'vendorSentAt', label: '業者送信' }
];

function normalizeRoleStatusValue(status) {
    const normalizedStatus = String(status || '');

    if (normalizedStatus === LEGACY_SCRAP_WAITING_STATUS) {
        return SCRAP_WAITING_STATUS;
    }

    return ALLOWED_STATUSES.includes(normalizedStatus) ? normalizedStatus : '中古予備（バラシ前）';
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
    localStorage.setItem('roles', JSON.stringify(roles));
}

function normalizeWorkProgress(role) {
    const progress = role && role.workProgress && typeof role.workProgress === 'object'
        ? { ...role.workProgress }
        : {};

    if (role && role.requestSent === true && !progress.vendorSentAt) {
        progress.vendorSentAt = role.updatedAt || new Date().toISOString();
    }

    WORK_PROGRESS_STEPS.forEach(step => {
        progress[step.key] = progress[step.key] || '';
    });

    return progress;
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

function isDispatchDateAllowedStatus(status) {
    return status === REWORK_READY_STATUS || status === REWORKING_STATUS;
}

function getTodayDateString() {
    const now = new Date();
    const pad = number => String(number).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeUseStartDate(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

function formatUseStartDate(value) {
    const normalized = normalizeUseStartDate(value);

    if (!normalized) {
        return '-';
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return normalized;
    }

    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
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
    roles = roles.map(role => ({
        ...role,
        updatedAt: role.updatedAt || new Date().toISOString(),
        memo: role.memo || '',
        status: normalizeRoleStatusValue(role.status),
        useStartDate: normalizeUseStartDate(role.useStartDate),
        dispatchDate: normalizeDateInputValue(role.dispatchDate),
        currentDiameter: normalizeCurrentDiameter(role.currentDiameter),
        workProgress: normalizeWorkProgress(role),
        history: normalizeRoleHistory(role),
        requestSent: role.requestSent === true || Boolean(normalizeWorkProgress(role).vendorSentAt)
    }));
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
    return WORK_PROGRESS_STEPS.filter(step => Boolean(progress[step.key])).length;
}

function getWorkProgressState(role) {
    const progress = normalizeWorkProgress(role);
    const completedCount = getWorkProgressCompletedCount(role);
    const totalCount = WORK_PROGRESS_STEPS.length;
    const hasProgressValue = WORK_PROGRESS_STEPS.some(step => Boolean(progress[step.key]));
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
    return Boolean(progress[previousStep.key]);
}

function formatProgressTimestamp(value) {
    return value ? formatUpdatedAt(value) : '';
}

function getWorkProgressHtml(role) {
    if (role.status !== REWORK_READY_STATUS) {
        return '';
    }

    const progress = normalizeWorkProgress(role);
    const completedCount = getWorkProgressCompletedCount(role);
    const stepsHtml = WORK_PROGRESS_STEPS.map((step, index) => {
        const completedAt = progress[step.key];
        const isDone = Boolean(completedAt);
        const disabled = isDone || !isWorkProgressStepEnabled(role, index);
        const title = isDone
            ? `${step.label}: ${formatProgressTimestamp(completedAt)}`
            : step.label;

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
                ${isDone ? `<span class="progress-step-date">${escapeHtml(formatProgressTimestamp(completedAt))}</span>` : ''}
            </button>
        `;
    }).join('');

    return `
        <div class="work-progress" aria-label="作業依頼進捗">
            <div class="work-progress-summary">作業依頼進捗 ${completedCount}/4</div>
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
    const dispatchDate = normalizeDateInputValue(role.dispatchDate);
    const rows = [
        ['使用開始日', formatUseStartDate(role.useStartDate)],
        ['最終更新', formattedDate]
    ];

    if (dispatchDate) {
        rows.push(['搬出日', formatDateForDisplay(dispatchDate)]);
        rows.push(['搬入予定日', formatDateForDisplay(getInboundPlanDate(dispatchDate))]);
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
    const status = String(role.status || '');

    if (statusFilter === 'all') {
        return true;
    }

    return status === statusFilter;
}

function getStatusSummaryCategory(role) {
    const status = String(role.status || '');

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

function updateCountSummary(visibleRoles, allRoles = roles) {
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

    visibleRoles.forEach(role => {
        summary[getStatusSummaryCategory(role)] += 1;
    });
    summary.newStorage = allRoles.filter(role => role.status === NEW_STORAGE_STATUS).length;

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

    if (incompleteRoles.length === 0) {
        listEl.innerHTML = '<div class="incomplete-work-empty">未完了の作業依頼はありません</div>';
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

    const elapsedDiff = (b.elapsedDays || 0) - (a.elapsedDays || 0);

    if (elapsedDiff !== 0) {
        return elapsedDiff;
    }

    if (a.standNumber !== b.standNumber) {
        return a.standNumber - b.standNumber;
    }

    return String(a.roleName || a.standLabel || '').localeCompare(String(b.roleName || b.standLabel || ''), 'ja');
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
            const dispatchDate = normalizeDateInputValue(role.dispatchDate);
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

        if (statuses.includes(USED_STANDBY_STATUS) && statuses.includes(NEW_READY_STATUS)) {
            const occurredAt = getOldestStatusChangedAt(standRoles, [USED_STANDBY_STATUS, NEW_READY_STATUS]);
            tasks.push({
                id: `assembly-${standKey}`,
                priority: 'medium',
                standKey,
                standNumber: Number(standKey) || 999999,
                standLabel: `#${standKey}`,
                title: '組替作業予定',
                actions: ['組替作業を予定に入れる'],
                reason: '中古予備と新品予備（組替可能）が同一スタンド内に存在',
                occurredAt,
                elapsedDays: getElapsedDaysSince(occurredAt, now) || 0
            });
        }

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

function getTodayTaskWarning(task, allRoles = []) {
    if (!task) {
        return '';
    }

    if (String(task.id || '').startsWith('rework-ready-')) {
        const role = allRoles.find(item => String(item.id) === String(task.id).replace('rework-ready-', ''));
        return role && normalizeDateInputValue(role.dispatchDate) ? '' : '⚠ 搬出日未設定';
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
        showToast('対象ロールが見つかりません');
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

    if (task.standKey) {
        return roles
            .filter(role => getStandKey(role.name) === task.standKey)
            .sort((a, b) => compareUpdatedAt(a, b, 'desc'))[0] || null;
    }

    return null;
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
        if (role.status === NEW_STORAGE_STATUS && statusFilter !== NEW_STORAGE_STATUS && !hasSearch) {
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
    updateCountSummary(filteredRoles, roles);
    updateIncompleteWorkDashboard(roles);
    updateTodayTaskDashboard(roles);

    const visibleRoles = filteredRoles
        .slice()
        .sort((a, b) => {
            if (sortOption === 'name') {
            const aMatch = String(a.name || '').match(/#?(\d+)-(\d+)/);
const bMatch = String(b.name || '').match(/#?(\d+)-(\d+)/);

if (aMatch && bMatch) {
    const aStand = Number(aMatch[1]);
    const bStand = Number(bMatch[1]);

    if (aStand !== bStand) {
        return aStand - bStand;
    }

    const aNumber = Number(aMatch[2]);
    const bNumber = Number(bMatch[2]);

    return aNumber - bNumber;
}

return String(a.name || '').localeCompare(String(b.name || ''), 'ja');    
            }
            if (sortOption === 'updatedAtAsc') {
                return compareUpdatedAt(a, b, 'asc');
            }
            return compareUpdatedAt(a, b, 'desc');
        });
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
    <span class="header-diameter-value">${escapeHtml(currentDiameterText)}</span>
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
    const newRole = { id: nextId++, name: roleName, status: roleStatus, memo: roleMemo, currentDiameter: roleCurrentDiameter, dispatchDate: roleDispatchDate, useStartDate: '', updatedAt: new Date().toISOString(), workProgress: normalizeWorkProgress({}), history: [] };
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
    document.getElementById('role-current-diameter').value = '';
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
    document.getElementById('role-current-diameter').value = normalizeCurrentDiameter(role.currentDiameter);
    document.getElementById('role-dispatch-date').value = isDispatchDateAllowedStatus(role.status)
        ? normalizeDateInputValue(role.dispatchDate)
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
    
    const role = roles.find(r => String(r.id) === String(editingId));
    if (!role) return;
    const beforeName = role.name;
    const beforeStatus = role.status || '';
    const beforeMemo = role.memo || '';
    const beforeCurrentDiameter = normalizeCurrentDiameter(role.currentDiameter);
    const beforeDispatchDate = normalizeDateInputValue(role.dispatchDate);
    
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
    role.memo = roleMemo;
    role.currentDiameter = roleCurrentDiameter;
    role.dispatchDate = roleDispatchDate;
    role.useStartDate = normalizeUseStartDate(role.useStartDate);
    role.updatedAt = new Date().toISOString();
    role.workProgress = normalizeWorkProgress(role);
    if (beforeName !== roleName) {
        role.history = normalizeRoleHistory(role).map(entry => ({
            ...entry,
            roleName: entry.roleName === beforeName ? roleName : entry.roleName
        }));
    }
    addRoleHistoryEntry(role, 'status', 'ステータス変更', beforeStatus, roleStatus, role.updatedAt);
    setUseStartDateIfNeeded(role, role.updatedAt);
    addRoleHistoryEntry(role, 'memo', 'メモ変更', beforeMemo, roleMemo, role.updatedAt);
    addRoleHistoryEntry(role, 'diameter', '現在径変更', formatCurrentDiameter(beforeCurrentDiameter), formatCurrentDiameter(roleCurrentDiameter), role.updatedAt);
    addRoleHistoryEntry(role, 'dispatchDate', '搬出日変更', formatDateForDisplay(beforeDispatchDate), formatDateForDisplay(roleDispatchDate), role.updatedAt);

    updatedRoleId = role.id;
    
    saveLocalRoles();
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
    document.getElementById('role-current-diameter').value = '';
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

    if (role.workProgress.vendorSentAt) {
        alert('業者送信は完了済みです');
        return;
    }

    if (!isWorkProgressStepEnabled(role, 3)) {
        alert('前工程が完了していないため、業者送信は完了できません');
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

    const confirmed = confirm("業者送信メールを作成し、工程「業者送信」を完了にしますか？");

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
    warnIfOperatorMissing();
    const role = roles.find(r => String(r.id) === String(roleId));
    const stepIndex = WORK_PROGRESS_STEPS.findIndex(step => step.key === stepKey);
    const step = WORK_PROGRESS_STEPS[stepIndex];

    if (!role || !step || role.status !== REWORK_READY_STATUS) {
        return false;
    }

    role.workProgress = normalizeWorkProgress(role);
    const beforeCompletedCount = getWorkProgressCompletedCount(role);

    if (role.workProgress[stepKey]) {
        return false;
    }

    if (!isWorkProgressStepEnabled(role, stepIndex)) {
        alert('前工程が完了していないため、この工程は完了できません');
        return false;
    }

    if (!options.skipConfirm && !confirm(`${step.label}を完了にしますか？`)) {
        return false;
    }

    const completedAt = new Date().toISOString();
    const beforeValue = role.workProgress[stepKey] || '';
    role.workProgress[stepKey] = completedAt;
    role.requestSent = Boolean(role.workProgress.vendorSentAt);
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
