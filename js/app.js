console.log("STATUS FILTER VERSION 6");
const CORRECT_PASSWORD = '1234';

// 繝ｭ繧ｰ繧､繝ｳ迥ｶ諷九メ繧ｧ繝・け
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

// 繝ｭ繧ｰ繧､繝ｳ髢｢謨ｰ
function login() {
    const password = document.getElementById('password-input').value;
    if (password === CORRECT_PASSWORD) {
        localStorage.setItem('isLoggedIn', 'true');
        checkLoginStatus();
        document.getElementById('password-input').value = ''; // 繝代せ繝ｯ繝ｼ繝牙・蜉帙け繝ｪ繧｢
    } else {
        alert('繝代せ繝ｯ繝ｼ繝峨′髢馴＆縺｣縺ｦ縺・∪縺・);
        document.getElementById('password-input').value = '';
        document.getElementById('password-input').focus();
    }
}

// 繝ｭ繧ｰ繧｢繧ｦ繝磯未謨ｰ
function logout() {
    if (confirm('繝ｭ繧ｰ繧｢繧ｦ繝医＠縺ｾ縺吶°・・)) {
        localStorage.removeItem('isLoggedIn');
        checkLoginStatus();
    }
}

// Enter繧ｭ繝ｼ縺ｧ繝ｭ繧ｰ繧､繝ｳ
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
    '繧ｪ繝ｳ繝ｩ繧､繝ｳ',
    '荳ｭ蜿､莠亥ｙ・医ヰ繝ｩ繧ｷ蜑搾ｼ・,
    '謾ｹ蜑願｡後″・域成蜃ｺ蜿ｯ閭ｽ・・,
    '謾ｹ蜑贋ｸｭ',
    '譁ｰ蜩∽ｺ亥ｙ・育ｵ・崛蜿ｯ閭ｽ・・,
    '譁ｰ蜩∽ｺ亥ｙ・育ｵ・ｾｼ螳御ｺ・ｼ・
];

let roles = [];
let nextId = 1;
let searchQuery = '';
let statusFilter = 'all';
let sortOption = 'name';
let editingId = null; // 邱ｨ髮・ｸｭ縺ｮID
let lastScrollY = 0;
let updatedRoleId = null;

function saveLocalRoles() {

    const currentRoles = localStorage.getItem('roles');

if (currentRoles && !localStorage.getItem('roles_backup_latest')) {
    localStorage.setItem('roles_backup_latest', currentRoles);

    localStorage.setItem('roles_backup_saved_at', new Date().toISOString());
}
const historyKey = `roles_backup_${new Date().toISOString()}`;
localStorage.setItem(historyKey, JSON.stringify(currentRoles || []));
const backupKeys = Object.keys(localStorage)
    .filter(key => key.startsWith('roles_backup_2026'))
    .sort();

if (backupKeys.length > 20) {
    const oldKeys = backupKeys.slice(0, backupKeys.length - 20);

    oldKeys.forEach(key => {
        localStorage.removeItem(key);
    });
}
    localStorage.setItem('roles', JSON.stringify(roles));
}

function loadLocalRoles() {
    roles = JSON.parse(localStorage.getItem('roles')) || [];
    roles = roles.map(role => ({
        ...role,
        updatedAt: role.updatedAt || new Date().toISOString(),
        memo: role.memo || '',
        status: ALLOWED_STATUSES.includes(role.status) ? role.status : '荳ｭ蜿､莠亥ｙ・医ヰ繝ｩ繧ｷ蜑搾ｼ・
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
        const onlineRoles = groupRoles.filter(r => r.status === '繧ｪ繝ｳ繝ｩ繧､繝ｳ').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        if (onlineRoles.length > 1) {
            for (let i = 1; i < onlineRoles.length; i++) {
                onlineRoles[i].status = '荳ｭ蜿､莠亥ｙ・医ヰ繝ｩ繧ｷ蜑搾ｼ・;
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
        '邂｡逅・・: '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">荘 邂｡逅・・/span>',
        '邱ｨ髮・・: '<span style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">笨擾ｸ・邱ｨ髮・・/span>',
        '髢ｲ隕ｧ閠・: '<span style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">早・・髢ｲ隕ｧ閠・/span>'
    };
    return badges[level] || '-';
}

function getStatusClass(status) {
    const statusClasses = {
        '繧ｪ繝ｳ繝ｩ繧､繝ｳ': 'status-online',
        '荳ｭ蜿､莠亥ｙ・医ヰ繝ｩ繧ｷ蜑搾ｼ・: 'status-used-standby',
        '謾ｹ蜑願｡後″・域成蜃ｺ蜿ｯ閭ｽ・・: 'status-rework-ready',
        '謾ｹ蜑贋ｸｭ': 'status-reworking',
        '譁ｰ蜩∽ｺ亥ｙ・育ｵ・崛蜿ｯ閭ｽ・・: 'status-new-ready',
        '譁ｰ蜩∽ｺ亥ｙ・育ｵ・ｾｼ螳御ｺ・ｼ・: 'status-new-done'
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
    previewEl.textContent = `迴ｾ蝨ｨ縺ｮ繧ｹ繝・・繧ｿ繧ｹ・・{selectedStatus || '譛ｪ驕ｸ謚・}`;
}

function getMemoPreview(memo) {
    const normalized = (memo || '').replace(/\n/g, ' ').trim();
    if (!normalized) {
        return '-';
    }
    return normalized.length > 50 ? normalized.slice(0, 50) + '窶ｦ' : normalized;
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
        alert('繝ｭ繝ｼ繝ｫ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ');
        return;
    }

    document.getElementById('detail-stand-name').textContent = role.name || '-';
    document.getElementById('detail-status').innerHTML = getStatusBadge(role.status);
    document.getElementById('detail-updated-at').textContent = formatUpdatedAt(role.updatedAt);
    document.getElementById('detail-memo').textContent = role.memo || '繝｡繝｢縺ｯ縺ゅｊ縺ｾ縺帙ｓ';

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

    if (searchQuery.trim().length > 0) {
        resetStatusFilter();
    }

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
function setSummaryFilter(filterValue) {
    statusFilter = filterValue || 'all';

    const statusFilterSelect = document.getElementById('status-filter');

    if (statusFilterSelect) {
        statusFilterSelect.value = statusFilter;
    }

    renderRoles();
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

    return status === statusFilter;
}

function getStatusSummaryCategory(role) {
    const status = String(role.status || '');

    if (status === '繧ｪ繝ｳ繝ｩ繧､繝ｳ') {
        return 'online';
    }

    if (status === '謾ｹ蜑贋ｸｭ') {
        return 'reworking';
    }

    if (status === '荳ｭ蜿､莠亥ｙ・医ヰ繝ｩ繧ｷ蜑搾ｼ・) {
        return 'used';
    }

    if (status === '謾ｹ蜑願｡後″・域成蜃ｺ蜿ｯ閭ｽ・・) {
        return 'remove';
    }

    if (status === '譁ｰ蜩∽ｺ亥ｙ・育ｵ・崛蜿ｯ閭ｽ・・) {
        return 'newReady';
    }

    if (status === '譁ｰ蜩∽ｺ亥ｙ・育ｵ・ｾｼ螳御ｺ・ｼ・) {
        return 'newInstalled';
    }

    return 'other';
}

function updateCountSummary(visibleRoles) {
    const summary = {
    total: visibleRoles.length,
    online: 0,
    reworking: 0,
    used: 0,
    remove: 0,
    newReady: 0,
    newInstalled: 0,
    other: 0
};

    visibleRoles.forEach(role => {
        summary[getStatusSummaryCategory(role)] += 1;
    });

    Object.entries(summary).forEach(([key, value]) => {

    const summaryMap = {
        remove: 'summary-remove',
        newReady: 'summary-new-ready',
        newInstalled: 'summary-new-installed'
    };

    const targetId = summaryMap[key] || `summary-${key}`;

    const summaryEl = document.getElementById(targetId);

    if (summaryEl) {
        summaryEl.textContent = `${value}莉ｶ`;
    }
});
}

function getFilteredRoles() {
    const normalizedQuery = String(searchQuery).trim().toLowerCase();
    return roles.filter(role => {
        const matchesStatus = isStatusMatched(role);
        if (!isStatusMatched(role)) {
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
            countInfo.textContent = `迴ｾ蝨ｨ${visibleRoles.length}莉ｶ陦ｨ遉ｺ荳ｭ / 蜈ｨ${roles.length}莉ｶ`;
        } else {
            countInfo.textContent = '';
        }
    }
    if (visibleRoles.length === 0) {
        const message = roles.length === 0
            ? '繝ｭ繝ｼ繝ｫ縺後∪縺逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ'
            : '讀懃ｴ｢譚｡莉ｶ縺ｫ荳閾ｴ縺吶ｋ繝ｭ繝ｼ繝ｫ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ';
        roleList.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #999;">${message}</td></tr>`;
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
        const formattedDate = formatUpdatedAt(role.updatedAt);
        row.innerHTML = `
            <td>
  <span class="role-id stand-name-cell">${escapeHtml(role.name)}</span>
  ${updatedRoleId === role.id ? '<span class="updated-badge">譖ｴ譁ｰ縺励∪縺励◆</span>' : ''}
</td>
            <td>${getStatusBadge(role.status)}</td>
            <td>${escapeHtml(getMemoPreview(role.memo))}</td>
            <td>${formattedDate}</td>
            <td>
${role.status === "謾ｹ蜑願｡後″・域成蜃ｺ蜿ｯ閭ｽ・・ && role.requestSent === true
? '<span style="color:green;font-weight:700;">笨・菴懈･ｭ萓晞ｼ貂医∩</span>'
: role.status === "謾ｹ蜑願｡後″・域成蜃ｺ蜿ｯ閭ｽ・・
? '<span style="color:red;font-weight:700;">笞 菴懈･ｭ萓晞ｼ譛ｪ騾∽ｿ｡</span>'
: ''}
</td>

            <td>
            
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editRole(${role.id})">笨擾ｸ・邱ｨ髮・/button>
                    <button class="action-btn edit-btn" onclick="showMemo(${role.id})">統 隧ｳ邏ｰ</button>
                    ${role.status === "謾ｹ蜑願｡後″・域成蜃ｺ蜿ｯ閭ｽ・・ ? `
  <button class="action-btn request-btn" onclick="requestWork('${role.id}')">
    逃 菴懈･ｭ萓晞ｼ
  </button>
` : ""}
                    <button class="action-btn delete-btn" onclick="deleteRole(${role.id})">卵・・蜑企勁</button>
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
        alert('繧ｹ繧ｿ繝ｳ繝臥分蜿ｷ繧貞・蜉帙＠縺ｦ縺上□縺輔＞');
        return;
    }
    if (!roleStatus) {
        alert('繧ｹ繝・・繧ｿ繧ｹ繧帝∈謚槭＠縺ｦ縺上□縺輔＞');
        return;
    }
    if (roles.some(r => r.name === roleName)) {
        alert('縺薙・繧ｹ繧ｿ繝ｳ繝臥分蜿ｷ縺ｯ譌｢縺ｫ逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺・);
        return;
    }
    const newRole = { id: nextId++, name: roleName, status: roleStatus, memo: roleMemo, updatedAt: new Date().toISOString() };
    
    // 繧ｪ繝ｳ繝ｩ繧､繝ｳ驥崎､・宛蠕｡
    if (roleStatus === '繧ｪ繝ｳ繝ｩ繧､繝ｳ') {
        const group = getGroup(roleName);
        roles.forEach(r => {
            if (getGroup(r.name) === group && r.status === '繧ｪ繝ｳ繝ｩ繧､繝ｳ') {
                r.status = '荳ｭ蜿､莠亥ｙ・医ヰ繝ｩ繧ｷ蜑搾ｼ・;
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
    lastScrollY = window.scrollY;
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
    window.scrollTo({
  top: 0,
  behavior: 'smooth'
});
document.body.classList.add('editing-mode');
console.log('editing mode ON');
}

function updateRole() {
    if (editingId === null) return;
    
    const roleName = document.getElementById('role-name').value.trim();
    const roleStatus = document.getElementById('role-status').value;
    const roleMemo = document.getElementById('role-memo').value.trim();
    
    if (!roleName) {
        alert('繧ｹ繧ｿ繝ｳ繝臥分蜿ｷ繧貞・蜉帙＠縺ｦ縺上□縺輔＞');
        return;
    }
    if (!roleStatus) {
        alert('繧ｹ繝・・繧ｿ繧ｹ繧帝∈謚槭＠縺ｦ縺上□縺輔＞');
        return;
    }
    
    const role = roles.find(r => String(r.id) === String(editingId));
    if (!role) return;
    
    if (roleName !== role.name && roles.some(r => r.id !== editingId && r.name === roleName)) {
        alert('縺薙・繧ｹ繧ｿ繝ｳ繝臥分蜿ｷ縺ｯ譌｢縺ｫ逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺・);
        return;
    }
    
    if (roleStatus === '繧ｪ繝ｳ繝ｩ繧､繝ｳ') {
        const group = getGroup(roleName);
        roles.forEach(r => {
            if (r.id !== editingId && getGroup(r.name) === group && r.status === '繧ｪ繝ｳ繝ｩ繧､繝ｳ') {
                r.status = '荳ｭ蜿､莠亥ｙ・医ヰ繝ｩ繧ｷ蜑搾ｼ・;
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    role.name = roleName;
    role.status = roleStatus;
    role.memo = roleMemo;
    role.updatedAt = new Date().toISOString();

    updatedRoleId = role.id;
    
    saveLocalRoles();
    cancelEdit();
    setTimeout(() => {
  document.body.classList.remove("editing-mode");
}, 500);

    renderRoles();
    syncRoles();
    showToast("譖ｴ譁ｰ縺励∪縺励◆");

    setTimeout(() => {
  updatedRoleId = null;
  renderRoles();
}, 3000);

setTimeout(() => {
  const updatedRow = document.getElementById(`role-${updatedRoleId}`);

  if (updatedRow) {
    updatedRow.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  } else {
    window.scrollTo({
      top: lastScrollY,
      behavior: "smooth"
    });
  }
}, 300);
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

function requestWork(roleId) {
    const role = roles.find(r => String(r.id) === String(roleId));

    if (!role) return;

    const subject = `縲蝉ｽ懈･ｭ萓晞ｼ縲・{role.name}`;

    const body =
`繧ｹ繧ｿ繝ｳ繝臥分蜿ｷ・・{role.name}

繧ｹ繝・・繧ｿ繧ｹ・・{role.status}

繝｡繝｢・・
${role.memo || "縺ｪ縺・}

菴懈･ｭ蜀・ｮｹ・・
繝ｻ蠑輔″蜿悶ｊ萓晞ｼ
繝ｻ謾ｹ蜑贋ｾ晞ｼ豕ｨ譁・嶌縺ｮ菴懈・騾∽ｻ・

萓晞ｼ譌･譎ゑｼ・
${new Date().toLocaleString("ja-JP")}
`;

    const mailtoUrl =
`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const confirmed = confirm("菴懈･ｭ萓晞ｼ繝｡繝ｼ繝ｫ繧剃ｽ懈・縺励∽ｾ晞ｼ貂医∩縺ｫ縺励∪縺吶°・・);

    if (!confirmed) return;

    role.requestSent = true;
    role.updatedAt = new Date().toISOString();

    saveLocalRoles();
    renderRoles();

    window.open(mailtoUrl, "_blank");
}

function deleteRole(id) {
    const target = roles.find(r => String(r.id) === String(id));

    if (!target) {
        alert('蜑企勁蟇ｾ雎｡縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ');
        return;
    }

    if (confirm(`${target.name} 繧貞炎髯､縺励∪縺吶°・歔)) {
        roles = roles.filter(r => String(r.id) !== String(id));
        saveLocalRoles();
        renderRoles();
        syncRoles();
        showToast('蜑企勁縺励∪縺励◆');
    }
}

// 蛻晄悄陦ｨ遉ｺ
checkLoginStatus();

const searchInput = document.getElementById('role-search');
if (searchInput) {
    searchInput.addEventListener('input', (event) => {
        searchQuery = event.target.value;
        renderRoles();
    });
}

// Service Worker逋ｻ骭ｲ
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(registration => {
            console.log('Service Worker registered:', registration);
            
            // 譁ｰ縺励＞Service Worker縺ｮ譖ｴ譁ｰ繧偵メ繧ｧ繝・け
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                        console.log('New Service Worker activated');
                        // 閾ｪ蜍輔Μ繝ｭ繝ｼ繝・
                        window.location.reload();
                    }
                });
            });

            // Service Worker縺九ｉ縺ｮ繝｡繝・そ繝ｼ繧ｸ繧貞・逅・
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'SW_UPDATED') {
                    console.log('Service Worker updated, reloading...');
                    window.location.reload();
                }
            });

            // 螳壽悄逧・↓譖ｴ譁ｰ繝√ぉ繝・け・医せ繝槭・蛛ｴ閾ｪ蜍墓峩譁ｰ逕ｨ・・
            setInterval(() => {
                registration.update();
            }, 60000); // 1蛻・＃縺ｨ縺ｫ繝√ぉ繝・け
        })
        .catch(error => console.log('Service Worker registration failed:', error));
}

// PWA繧､繝ｳ繧ｹ繝医・繝ｫ菫・ｲ
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 繧､繝ｳ繧ｹ繝医・繝ｫ蜿ｯ閭ｽ縺ｪ蝣ｴ蜷医・蜃ｦ逅・
    console.log('PWA install prompt is ready');
});
function restoreLatestBackup() {

    const backup = localStorage.getItem('roles_backup_latest');

    if (!backup) {
        alert('繝舌ャ繧ｯ繧｢繝・・縺後≠繧翫∪縺帙ｓ縲・);
        return;
    }
const backupKeys = Object.keys(localStorage)
  .filter(key => key.startsWith('roles_backup_2026'))
  .sort()
  .reverse();

console.log('繝舌ャ繧ｯ繧｢繝・・荳隕ｧ', backupKeys);
    const ok = confirm('譛譁ｰ繝舌ャ繧ｯ繧｢繝・・繧貞ｾｩ蜈・＠縺ｾ縺吶°・・);

    if (!ok) {
        return;
    }

    roles = JSON.parse(backup);
    if (!roles || roles.length === 0) {
    alert('繝舌ャ繧ｯ繧｢繝・・縺・莉ｶ縺ｮ縺溘ａ蠕ｩ蜈・ｒ荳ｭ豁｢縺励∪縺励◆');
    return;
}
const ids = roles.map(r => Number(r.id) || 0);
nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    // saveLocalRoles();

    renderRoles();

    alert('繝舌ャ繧ｯ繧｢繝・・繧貞ｾｩ蜈・＠縺ｾ縺励◆縲・);
}
function toggleTabletMode() {
    const isTabletMode = document.body.classList.toggle('tablet-mode');
    localStorage.setItem('tablet_mode_enabled', isTabletMode ? 'true' : 'false');

    const button = document.getElementById('tabletModeBtn');
    if (button) {
        button.textContent = isTabletMode ? '繧ｿ繝悶Ξ繝・ヨ繝｢繝ｼ繝・ON' : '繧ｿ繝悶Ξ繝・ヨ繝｢繝ｼ繝・OFF';
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
window.loadRoles = loadLocalRoles;
window.login = login;
