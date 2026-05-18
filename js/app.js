const CORRECT_PASSWORD = '1234';

// ログイン状態チェック
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');

    if (isLoggedIn) {
        loginScreen.style.display = 'none';
        mainScreen.style.display = 'block';
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
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDetailModal();
        }
    });
});

const ALLOWED_STATUSES = [
    'オンライン',
    '中古予備（バラシ前）',
    '改削行き（搬出可能）',
    '改削中',
    '新品予備（組替可能）',
    '新品予備（組込完了）'
];

let roles = [];
let nextId = 1;
let searchQuery = '';
let statusFilter = 'all';
let sortOption = 'name';
let editingId = null; // 編集中のID

function saveLocalRoles() {

    const currentRoles = localStorage.getItem('roles');

if (currentRoles && !localStorage.getItem('roles_backup_latest')) {
    localStorage.setItem('roles_backup_latest', currentRoles);

    localStorage.setItem('roles_backup_saved_at', new Date().toISOString());
}

    localStorage.setItem('roles', JSON.stringify(roles));
}

function loadLocalRoles() {
    roles = JSON.parse(localStorage.getItem('roles')) || [];
    roles = roles.map(role => ({
        ...role,
        updatedAt: role.updatedAt || new Date().toISOString(),
        memo: role.memo || '',
        status: ALLOWED_STATUSES.includes(role.status) ? role.status : '中古予備（バラシ前）'
    }));
    fixOnlineDuplicates();
    const ids = roles.map(r => Number(r.id) || 0);
    nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

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
        '新品予備（組込完了）': 'status-new-done'
    };
    return statusClasses[status] || 'status-other';
}

function getStatusBadge(status) {
    const className = getStatusClass(status);
    return `<span class="status-badge ${className}">${escapeHtml(status || '-')}</span>`;
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
}

function getMemoPreview(memo) {
    const normalized = (memo || '').replace(/\n/g, ' ').trim();
    if (!normalized) {
        return '-';
    }
    return normalized.length > 50 ? normalized.slice(0, 50) + '…' : normalized;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (!modal) {
        return;
    }
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function searchRoles(event) {
    searchQuery = event.target.value || '';
    renderRoles();
}

function clearSearch() {
    searchQuery = '';
    const searchInput = document.getElementById('role-search');
    if (searchInput) {
        searchInput.value = '';
    }
    renderRoles();
}

function changeStatusFilter(event) {
    statusFilter = event.target.value || 'all';
    renderRoles();
}

function resetStatusFilter() {
    statusFilter = 'all';
    const statusFilterSelect = document.getElementById('status-filter');
    if (statusFilterSelect) {
        statusFilterSelect.value = 'all';
    }
}

function showAllRoles() {
    searchQuery = '';
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
    if (statusFilter === 'online') {
        return status === 'オンライン';
    }
    if (statusFilter === 'reworking') {
        return status === '改削中';
    }
    if (statusFilter === 'used') {
        return status.includes('中古予備');
    }
    if (statusFilter === 'other') {
        return status !== 'オンライン' && status !== '改削中' && !status.includes('中古予備');
    }
    return true;
}

function getStatusSummaryCategory(role) {
    const status = String(role.status || '');
    if (status === 'オンライン') {
        return 'online';
    }
    if (status === '改削中') {
        return 'reworking';
    }
    if (status.includes('中古予備')) {
        return 'used';
    }
    return 'other';
}

function updateCountSummary(visibleRoles) {
    const summary = {
        total: visibleRoles.length,
        online: 0,
        reworking: 0,
        used: 0,
        other: 0
    };

    visibleRoles.forEach(role => {
        summary[getStatusSummaryCategory(role)] += 1;
    });

    Object.entries(summary).forEach(([key, value]) => {
        const summaryEl = document.getElementById(`summary-${key}`);
        if (summaryEl) {
            summaryEl.textContent = `${value}件`;
        }
    });
}

function getFilteredRoles() {
    const normalizedQuery = String(searchQuery).trim().toLowerCase();
    return roles.filter(role => {
        const matchesStatus = isStatusMatched(role);
        if (!matchesStatus) {
            return false;
        }
        if (!normalizedQuery) {
            return true;
        }
        return [
            String(role.name || ''),
            String(role.status || ''),
            String(role.memo || '')
        ].some(field => field.toLowerCase().includes(normalizedQuery));
    });
}

function renderRoles() {
    const roleList = document.getElementById('role-list');
    roleList.innerHTML = '';
    
    const filteredRoles = getFilteredRoles();
    updateCountSummary(filteredRoles);

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
        if (hasSearch || hasStatusFilter) {
            countInfo.textContent = `現在${visibleRoles.length}件表示中 / 全${roles.length}件`;
        } else {
            countInfo.textContent = '';
        }
    }
    if (visibleRoles.length === 0) {
        const message = roles.length === 0
            ? 'ロールがまだ登録されていません'
            : '検索条件に一致するロールが見つかりません';
        roleList.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #999;">${message}</td></tr>`;
        return;
    }

    visibleRoles.forEach(role => {
        const row = document.createElement('tr');
        const formattedDate = formatUpdatedAt(role.updatedAt);
        row.innerHTML = `
            <td><span class="role-id">${escapeHtml(role.name)}</span></td>
            <td>${getStatusBadge(role.status)}</td>
            <td>${escapeHtml(getMemoPreview(role.memo))}</td>
            <td>${formattedDate}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editRole(${role.id})">✏️ 編集</button>
                    <button class="action-btn edit-btn" onclick="showMemo(${role.id})">📝 詳細</button>
                    <button class="action-btn delete-btn" onclick="deleteRole(${role.id})">🗑️ 削除</button>
                </div>
            </td>
        `;
        roleList.appendChild(row);
    });
}

function addRole() {
    const roleName = document.getElementById('role-name').value.trim();
    const roleStatus = document.getElementById('role-status').value;
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
    const newRole = { id: nextId++, name: roleName, status: roleStatus, memo: roleMemo, updatedAt: new Date().toISOString() };
    
    // オンライン重複制御
    if (roleStatus === 'オンライン') {
        const group = getGroup(roleName);
        roles.forEach(r => {
            if (getGroup(r.name) === group && r.status === 'オンライン') {
                r.status = '中古予備（バラシ前）';
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    roles.push(newRole);
    saveLocalRoles();
    document.getElementById('role-name').value = '';
    document.getElementById('role-status').value = '';
    updateStatusPreview(document.getElementById('role-status'));
    document.getElementById('role-memo').value = '';
    renderRoles();
    syncRoles();
}


function editRole(id) {
    const role = roles.find(r => String(r.id) === String(id));
    if (!role) return;
    
    editingId = id;
    document.getElementById('role-name').value = role.name;
    document.getElementById('role-status').value = role.status;
    updateStatusPreview(document.getElementById('role-status'));
    document.getElementById('role-memo').value = role.memo || '';
    
    document.getElementById('addRoleBtn').style.display = 'none';
    document.getElementById('updateRoleBtn').style.display = 'inline-block';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
}

function updateRole() {
    if (editingId === null) return;
    
    const roleName = document.getElementById('role-name').value.trim();
    const roleStatus = document.getElementById('role-status').value;
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
    
    if (roleName !== role.name && roles.some(r => r.id !== editingId && r.name === roleName)) {
        alert('このスタンド番号は既に登録されています');
        return;
    }
    
    if (roleStatus === 'オンライン') {
        const group = getGroup(roleName);
        roles.forEach(r => {
            if (r.id !== editingId && getGroup(r.name) === group && r.status === 'オンライン') {
                r.status = '中古予備（バラシ前）';
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    role.name = roleName;
    role.status = roleStatus;
    role.memo = roleMemo;
    role.updatedAt = new Date().toISOString();
    
    saveLocalRoles();
    cancelEdit();
    renderRoles();
    syncRoles();
}

function cancelEdit() {
    editingId = null;
    document.getElementById('role-name').value = '';
    document.getElementById('role-status').value = '';
    updateStatusPreview(document.getElementById('role-status'));
    document.getElementById('role-memo').value = '';
    
    document.getElementById('addRoleBtn').style.display = 'inline-block';
    document.getElementById('updateRoleBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

function deleteRole(id) {
    if (confirm('このロールを削除しますか？')) {
        roles = roles.filter(r => r.id !== id);
        saveLocalRoles();
        renderRoles();
        syncRoles();
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

// Service Worker登録
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(registration => {
            console.log('Service Worker registered:', registration);
            
            // 新しいService Workerの更新をチェック
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                        console.log('New Service Worker activated');
                        // 自動リロード
                        window.location.reload();
                    }
                });
            });

            // Service Workerからのメッセージを処理
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'SW_UPDATED') {
                    console.log('Service Worker updated, reloading...');
                    window.location.reload();
                }
            });

            // 定期的に更新チェック（スマホ側自動更新用）
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

    const ok = confirm('最新バックアップを復元しますか？');

    if (!ok) {
        return;
    }

    roles = JSON.parse(backup);
const ids = roles.map(r => Number(r.id) || 0);
nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    // saveLocalRoles();

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
function setSummaryFilter(status) {

    const statusFilter = document.getElementById('status-filter');

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