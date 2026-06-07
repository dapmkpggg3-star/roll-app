const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyN0_AoU1dcaXzCO3ICRma2pFJyz2HvCSnwe_RAJMpaOlE53Gj5SugtDFoV78KHf9x9/exec';
const DELETED_ROLE_IDS_KEY = 'deletedRoleIds';
const LAST_SUCCESSFUL_SYNC_COUNT_KEY = 'lastSuccessfulSyncRoleCount';
const SYNC_COUNT_DROP_ABORT_RATIO = 0.3;
let syncDiagnosticRemoteRoles = null;
let lastGasSaveDebug = null;
let lastSavedRemoteRoleCount = null;

function parseStandRoleNumber(value) {
    const text = String(value || '').trim();
    const match = text.match(/#?\s*(\d+)(?:\s*-\s*(\d+))?/);

    if (!match) {
        return {
            stand: Number.POSITIVE_INFINITY,
            role: Number.POSITIVE_INFINITY,
            text
        };
    }

    return {
        stand: Number(match[1]),
        role: match[2] ? Number(match[2]) : 0,
        text
    };
}

function compareStandRoleNames(aName, bName) {
    const a = parseStandRoleNumber(aName);
    const b = parseStandRoleNumber(bName);

    if (a.stand !== b.stand) {
        return a.stand - b.stand;
    }

    if (a.role !== b.role) {
        return a.role - b.role;
    }

    return a.text.localeCompare(b.text, 'ja');
}

function compareRolesByStandRole(a, b) {
    return compareStandRoleNames(a && a.name, b && b.name);
}

function sortRolesByStandRole(roleList) {
    return (Array.isArray(roleList) ? roleList : []).slice().sort(compareRolesByStandRole);
}

function isRemoteConfigured() {
    return SHEETS_ENDPOINT.trim().length > 0;
}

function normalizeRoleIdForDelete(id) {
    if (id === undefined || id === null) {
        return '';
    }

    return String(id).trim();
}

function getRollDebugSnapshot(role) {
    if (!role) {
        return null;
    }

    return {
        id: role.id,
        name: role.name,
        status: role.status
    };
}

function findRollDebugIndex(roleList, roleName = '#11-44') {
    return (Array.isArray(roleList) ? roleList : []).findIndex(role => String(role.name || '') === roleName);
}

function getRollDebugSlice(roleList, startIndex, count = 5) {
    if (!Array.isArray(roleList) || startIndex < 0) {
        return [];
    }

    return roleList.slice(startIndex, startIndex + count).map(getRollDebugSnapshot);
}

function getDeletedRoleIds() {
    try {
        const value = JSON.parse(localStorage.getItem(DELETED_ROLE_IDS_KEY) || '[]');

        if (!Array.isArray(value)) {
            return [];
        }

        return Array.from(new Set(
            value
                .map(normalizeRoleIdForDelete)
                .filter(id => id !== '')
        ));
    } catch (error) {
        console.error('getDeletedRoleIds error:', error);
        return [];
    }
}

function setDeletedRoleIds(ids) {
    const normalizedIds = Array.from(new Set(
        (Array.isArray(ids) ? ids : [])
            .map(normalizeRoleIdForDelete)
            .filter(id => id !== '')
    ));

    localStorage.setItem(DELETED_ROLE_IDS_KEY, JSON.stringify(normalizedIds));
    return normalizedIds;
}

function getLastSuccessfulSyncCount() {
    const count = Number(localStorage.getItem(LAST_SUCCESSFUL_SYNC_COUNT_KEY));

    if (Number.isFinite(count) && count > 0) {
        return count;
    }

    try {
        const previousRoles = JSON.parse(localStorage.getItem('roles_backup_before_sync') || '[]');
        return Array.isArray(previousRoles) && previousRoles.length > 0 ? previousRoles.length : 0;
    } catch (error) {
        console.error('getLastSuccessfulSyncCount error:', error);
        return 0;
    }
}

function saveLastSuccessfulSyncCount(count) {
    if (!Number.isFinite(count) || count < 0) {
        return;
    }

    localStorage.setItem(LAST_SUCCESSFUL_SYNC_COUNT_KEY, String(count));
}

function getSyncCountBaseline(counts) {
    const validCounts = counts.filter(count => Number.isFinite(count) && count > 0);
    return validCounts.length > 0 ? Math.max(...validCounts) : 0;
}

function shouldAbortForSyncCountDrop(sendCount, baselineCount) {
    if (!Number.isFinite(sendCount) || sendCount <= 0) {
        return true;
    }

    if (!Number.isFinite(baselineCount) || baselineCount <= 0) {
        return false;
    }

    return (baselineCount - sendCount) / baselineCount >= SYNC_COUNT_DROP_ABORT_RATIO;
}

function warnAndBlockUnsafeSyncCount(sendCount, baselineCount) {
    if (!Number.isFinite(sendCount) || sendCount <= 0) {
        alert('同期を中止しました。0件のデータ送信は禁止されています。データ消失防止のため確認してください。');
        setSyncMessage('同期を中止しました。0件送信は禁止されています。', true);
        return true;
    }

    if (shouldAbortForSyncCountDrop(sendCount, baselineCount)) {
        alert(`同期を中止しました。送信件数が大幅に減っています（${baselineCount}件→${sendCount}件）。データ消失防止のため確認してください。`);
        setSyncMessage('同期を中止しました。送信件数が大幅に減っています。', true);
        return true;
    }

    return false;
}

function formatSyncDiagnosticCount(count) {
    return Number.isFinite(count) ? String(count) : '未取得';
}

function normalizeGasSaveDebug(debug) {
    if (!debug || typeof debug !== 'object') {
        return null;
    }

    return {
        source: debug.source || '',
        receivedRoleCount: Number.isFinite(Number(debug.receivedRoleCount)) ? Number(debug.receivedRoleCount) : null,
        writtenRoleCount: Number.isFinite(Number(debug.writtenRoleCount)) ? Number(debug.writtenRoleCount) : null,
        savedAt: debug.savedAt || ''
    };
}

function formatDebugCount(count) {
    return Number.isFinite(count) ? String(count) : '未取得';
}

function getSyncSaveDebugText(savedRemoteRoleCount = lastSavedRemoteRoleCount) {
    const debug = normalizeGasSaveDebug(lastGasSaveDebug);

    return [
        `GAS受信件数: ${formatDebugCount(debug ? debug.receivedRoleCount : null)}`,
        `GAS書込件数: ${formatDebugCount(debug ? debug.writtenRoleCount : null)}`,
        `保存後取得件数: ${formatDebugCount(savedRemoteRoleCount)}`
    ].join(' / ');
}

function logSyncSaveDebugCounts(savedRemoteRoleCount = lastSavedRemoteRoleCount) {
    const debug = normalizeGasSaveDebug(lastGasSaveDebug);

    console.info(`GAS受信件数: ${formatDebugCount(debug ? debug.receivedRoleCount : null)}`);
    console.info(`GAS書込件数: ${formatDebugCount(debug ? debug.writtenRoleCount : null)}`);
    console.info(`保存後取得件数: ${formatDebugCount(savedRemoteRoleCount)}`);
}

async function fetchLastGasSaveDebug() {
    const url = `${SHEETS_ENDPOINT}?action=debug-last-save&t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
    });
    const data = await readJsonResponse(response, 'GAS保存診断取得');

    if (!data || data.success !== true) {
        const detail = data && data.error ? data.error : 'debug-last-save が取得できませんでした。';
        throw createSyncError('GAS保存診断取得', detail);
    }

    lastGasSaveDebug = normalizeGasSaveDebug(data.debug);
    return lastGasSaveDebug;
}

function setSyncDiagnosticRemoteRoles(remoteRoles) {
    syncDiagnosticRemoteRoles = Array.isArray(remoteRoles)
        ? remoteRoles.map(normalizeRole)
        : null;
}

function getLocalRolesForDiagnostic() {
    return Array.isArray(roles) ? roles.map(normalizeRole) : [];
}

function getSyncDiagnosticCounts(options = {}) {
    const localRoles = Array.isArray(options.localRoles)
        ? options.localRoles.map(normalizeRole)
        : getLocalRolesForDiagnostic();
    const remoteRoles = Array.isArray(options.remoteRoles)
        ? options.remoteRoles.map(normalizeRole)
        : syncDiagnosticRemoteRoles;
    const hasRemote = Array.isArray(remoteRoles);
    const mergedRoles = Array.isArray(options.mergedRoles)
        ? options.mergedRoles.map(normalizeRole)
        : (hasRemote ? mergeRemoteAndLocalRoles(remoteRoles, localRoles) : null);

    return {
        lastSuccessful: getLastSuccessfulSyncCount(),
        local: localRoles.length,
        remote: hasRemote ? remoteRoles.length : null,
        merged: Array.isArray(mergedRoles) ? mergedRoles.length : null,
        hasRemote
    };
}

function getSyncDiagnosticStatus(counts) {
    const comparableCounts = [counts.local];

    if (counts.hasRemote) {
        comparableCounts.push(counts.remote);
    }

    if (Number.isFinite(counts.merged)) {
        comparableCounts.push(counts.merged);
    }

    const maxCount = Math.max(...comparableCounts);
    const minCount = Math.min(...comparableCounts);
    const diff = maxCount - minCount;
    const baseline = getSyncCountBaseline([
        counts.lastSuccessful,
        Number.isFinite(counts.remote) ? counts.remote : 0
    ]);
    const mergedCount = Number.isFinite(counts.merged) ? counts.merged : counts.local;
    const hasZero = counts.local === 0
        || (counts.hasRemote && counts.remote === 0)
        || mergedCount === 0;
    const hasDangerDrop = shouldAbortForSyncCountDrop(mergedCount, baseline);

    if (hasZero || hasDangerDrop) {
        return {
            level: 'danger',
            statusText: '状態: ⛔ 同期停止',
            detail: hasZero
                ? '0件が含まれています。データ消失防止のため同期前に確認してください。'
                : `30%以上減少しています（${baseline}件→${mergedCount}件）。同期停止対象です。`
        };
    }

    if (counts.hasRemote && counts.local === counts.remote && counts.remote === mergedCount) {
        return {
            level: 'normal',
            statusText: '状態: 正常',
            detail: 'Local / Remote / Merged の件数が一致しています'
        };
    }

    return {
        level: 'warning',
        statusText: '状態: 要確認',
        detail: counts.hasRemote
            ? `差分: ${diff}件。同期前に確認してください`
            : 'Remote件数を取得中です'
    };
}

function updateSyncDiagnosticPanel(options = {}) {
    if (Array.isArray(options.remoteRoles)) {
        setSyncDiagnosticRemoteRoles(options.remoteRoles);
    }

    const panel = document.getElementById('sync-diagnostic-panel');

    if (!panel) {
        return;
    }

    const counts = getSyncDiagnosticCounts(options);
    const status = getSyncDiagnosticStatus(counts);
    const statusEl = document.getElementById('sync-diagnostic-status');
    const lastEl = document.getElementById('sync-diagnostic-last');
    const localEl = document.getElementById('sync-diagnostic-local');
    const remoteEl = document.getElementById('sync-diagnostic-remote');
    const mergedEl = document.getElementById('sync-diagnostic-merged');
    const detailEl = document.getElementById('sync-diagnostic-detail');

    panel.classList.remove('sync-diagnostic-normal', 'sync-diagnostic-warning', 'sync-diagnostic-danger');
    panel.classList.add(`sync-diagnostic-${status.level}`);

    if (statusEl) statusEl.textContent = status.statusText;
    if (lastEl) lastEl.textContent = counts.lastSuccessful > 0 ? String(counts.lastSuccessful) : '未取得';
    if (localEl) localEl.textContent = formatSyncDiagnosticCount(counts.local);
    if (remoteEl) remoteEl.textContent = formatSyncDiagnosticCount(counts.remote);
    if (mergedEl) mergedEl.textContent = formatSyncDiagnosticCount(counts.merged);
    if (detailEl) {
        const saveDebugText = lastGasSaveDebug || Number.isFinite(lastSavedRemoteRoleCount)
            ? ` / ${getSyncSaveDebugText()}`
            : '';
        detailEl.textContent = `${status.detail}${saveDebugText}`;
    }
}

function markRoleDeleted(id) {
    const normalizedId = normalizeRoleIdForDelete(id);

    if (!normalizedId) {
        return [];
    }

    return setDeletedRoleIds([...getDeletedRoleIds(), normalizedId]);
}

function clearDeletedRoleIds(ids) {
    const clearSet = new Set((Array.isArray(ids) ? ids : [])
        .map(normalizeRoleIdForDelete)
        .filter(id => id !== ''));

    if (clearSet.size === 0) {
        return getDeletedRoleIds();
    }

    return setDeletedRoleIds(getDeletedRoleIds().filter(id => !clearSet.has(id)));
}

function isRoleMarkedDeleted(role, deletedRoleIds = getDeletedRoleIds()) {
    const id = normalizeRoleIdForDelete(role && role.id);
    return id !== '' && deletedRoleIds.includes(id);
}

function normalizeCurrentDiameter(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return '';
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : '';
}

function setSyncMessage(message, isError = false) {
    const syncEl = document.getElementById('sync-message');
    if (syncEl) {
        syncEl.textContent = message;
        syncEl.style.color = isError ? '#b91c1c' : '#047857';
    }
}

function looksLikeHtml(text) {
    const trimmed = String(text || '').trim().toLowerCase();
    return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.includes('<body');
}

function createSyncError(actionLabel, reason) {
    return new Error(`${actionLabel}に失敗しました。${reason}`);
}

async function readJsonResponse(response, actionLabel) {
    const responseText = await response.text();

    if (!response.ok) {
        throw createSyncError(
            actionLabel,
            `同期先からHTTP ${response.status}が返りました。Apps ScriptのデプロイURL、公開設定、実行ログを確認してください。`
        );
    }

    if (looksLikeHtml(responseText)) {
        throw createSyncError(
            actionLabel,
            'JSONではなくHTMLページが返りました。Apps Scriptが「ウェブアプリ」としてデプロイされているか、URLが /exec で終わっているか、アクセス権が「全員」または利用者に許可されているか確認してください。'
        );
    }

    try {
        return JSON.parse(responseText);
    } catch (error) {
        console.error('JSON parse error:', error, 'response:', responseText);
        throw createSyncError(
            actionLabel,
            '同期先からJSONとして読めないレスポンスが返りました。Apps Script側でContentService.MimeType.JSONを返しているか確認してください。'
        );
    }
}

function validateFetchResponse(data) {
    if (!data || data.success !== true || !Array.isArray(data.roles)) {
        const detail = data && data.error ? `詳細: ${data.error}` : 'roles配列が見つかりません。';
        throw createSyncError('データ取得', `Apps Scriptから不正なデータ形式が返りました。${detail}`);
    }
}

function normalizeRole(role) {
    const progress = role && role.workProgress && typeof role.workProgress === 'object'
        ? { ...role.workProgress }
        : {};
    const history = Array.isArray(role && role.history)
        ? role.history.filter(entry => entry && typeof entry === 'object')
        : [];

    if (role && role.requestSent === true && !progress.vendorSentAt) {
        progress.vendorSentAt = role.updatedAt || new Date().toISOString();
    }

    if (typeof WORK_PROGRESS_STEPS !== 'undefined') {
        WORK_PROGRESS_STEPS.forEach(step => {
            progress[step.key] = progress[step.key] || '';
        });
    }

    return {
        ...role,
        updatedAt: role.updatedAt || new Date().toISOString(),
        memo: role.memo || '',
        status: ALLOWED_STATUSES.includes(role.status) ? role.status : '中古予備（バラシ前）',
        useStartDate: role.useStartDate === undefined || role.useStartDate === null ? '' : String(role.useStartDate).trim(),
        currentDiameter: normalizeCurrentDiameter(role.currentDiameter),
        workProgress: progress,
        history: history,
        requestSent: role.requestSent === true || Boolean(progress.vendorSentAt)
    };
}

function mergeRoleHistory(aHistory, bHistory) {
    const merged = new Map();
    [...(aHistory || []), ...(bHistory || [])].forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        const key = [
            entry.at || '',
            entry.roleName || '',
            entry.type || '',
            entry.before || '',
            entry.after || ''
        ].join('|');
        merged.set(key, entry);
    });

    return Array.from(merged.values()).sort((a, b) => {
        return new Date(a.at).getTime() - new Date(b.at).getTime();
    });
}

function getRoleMergeKey(role) {
    if (role && role.id !== undefined && role.id !== null && String(role.id).trim() !== '') {
        return `id:${String(role.id)}`;
    }

    return `name:${String(role && role.name ? role.name : '').trim()}`;
}

function mergeRemoteAndLocalRoles(remoteRoles, localRoles) {
    const mergedMap = new Map();
    const deletedRoleIds = getDeletedRoleIds();
    const seenKeys = new Set();
    const duplicateKeys = [];

    remoteRoles.forEach(role => {
        const normalized = normalizeRole(role);
        if (isRoleMarkedDeleted(normalized, deletedRoleIds)) {
            return;
        }
        const key = getRoleMergeKey(normalized);
        if (seenKeys.has(key)) {
            duplicateKeys.push({ source: 'remote', key, role: getRollDebugSnapshot(normalized) });
        }
        seenKeys.add(key);
        mergedMap.set(key, normalized);
    });

    localRoles.forEach(role => {
        if (!role || !role.name || String(role.name).trim() === '') return;
        if (isRoleMarkedDeleted(role, deletedRoleIds)) return;
        const key = getRoleMergeKey(role);
        const localRole = normalizeRole(role);
        const remoteRole = mergedMap.get(key);
        if (remoteRole) {
            duplicateKeys.push({ source: 'local', key, role: getRollDebugSnapshot(localRole) });
            localRole.history = mergeRoleHistory(remoteRole.history, localRole.history);
        } else if (seenKeys.has(key)) {
            duplicateKeys.push({ source: 'local', key, role: getRollDebugSnapshot(localRole) });
        }
        seenKeys.add(key);
        mergedMap.set(key, localRole);
    });

    const mergedRoles = Array.from(mergedMap.values());
    console.log('ROLL_DEBUG_MERGE_BEFORE_RETURN', {
        remoteLength: remoteRoles.length,
        localLength: localRoles.length,
        mergedLength: mergedRoles.length,
        deletedRoleIdsLength: deletedRoleIds.length,
        duplicateKeys
    });
    return mergedRoles;
}

async function fetchData() {
    if (!isRemoteConfigured()) {
        setSyncMessage('スプレッドシート同期先が設定されていません。設定を確認してください。', true);
        return;
    }
    try {
        const url = `${SHEETS_ENDPOINT}?action=fetch&t=${Date.now()}`;
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store'
        });

        const data = await readJsonResponse(response, 'データ取得');
        validateFetchResponse(data);
        setSyncDiagnosticRemoteRoles(data.roles);
        const deletedRoleIds = getDeletedRoleIds();
        roles = data.roles
            .map(normalizeRole)
            .filter(role => !isRoleMarkedDeleted(role, deletedRoleIds));
        fixOnlineDuplicates();
        saveLocalRoles();
        const ids = roles.map(r => Number(r.id) || 0);
        nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
        renderRoles();
        setSyncMessage('スプレッドシートからデータを読み込みました。');
    } catch (error) {
        console.error('loadRemoteRoles error:', error);
        setSyncMessage((error.message || 'スプレッドシート同期に失敗しました。') + ' ブラウザ内のデータは残っています。', true);
        renderRoles();
    }
}

async function saveData() {
    if (!isRemoteConfigured()) {
        return false;
    }

    try {
        lastSavedRemoteRoleCount = null;
        console.log('saveRemoteRoles: Sending data to', SHEETS_ENDPOINT);
        console.log('SYNC SEND PAYLOAD COUNT', {
            roles: Array.isArray(roles) ? roles.length : null
        });

        if (!Array.isArray(roles) || roles.length === 0) {
            alert('同期を中止しました。0件のデータ送信は禁止されています。データ消失防止のため確認してください。');
            setSyncMessage('同期を中止しました。0件送信は禁止されています。', true);
            return false;
        }

        const payload = JSON.stringify({
            action: 'save',
            roles: roles
        });
        const debugSendIndex = findRollDebugIndex(roles);
        console.log('ROLL_DEBUG_SAVE_DATA_BEFORE_POST', {
            sendLength: roles.length,
            targetIndex: debugSendIndex,
            afterTarget5: getRollDebugSlice(roles, debugSendIndex)
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            await fetch(SHEETS_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                body: payload,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        await new Promise(resolve => setTimeout(resolve, 1200));

        try {
            await fetchLastGasSaveDebug();
        } catch (debugError) {
            console.warn('GAS save debug fetch failed:', debugError);
            lastGasSaveDebug = null;
        }

        logSyncSaveDebugCounts();
        updateSyncDiagnosticPanel();
        return lastGasSaveDebug || true;
    } catch (error) {
        console.error('saveRemoteRoles error:', error);
        throw error;
    }
}

async function fetchRemoteRolesForGuard(actionLabel = '同期前データ確認') {
    const url = `${SHEETS_ENDPOINT}?action=fetch&t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
    });

    const data = await readJsonResponse(response, actionLabel);
    validateFetchResponse(data);
    const remoteRoles = data.roles.map(normalizeRole);
    setSyncDiagnosticRemoteRoles(remoteRoles);
    return remoteRoles;
}

function loadRemoteRoles() {
    return fetchData();
}

function saveRemoteRoles() {
    return saveData();
}

let isSyncing = false;

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => {
            return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
        }).join(',')}}`;
    }

    return JSON.stringify(value ?? '');
}

function getRoleVerificationSnapshot(role) {
    const normalized = normalizeRole(role);

    return {
        id: String(normalized.id ?? ''),
        name: String(normalized.name ?? ''),
        status: String(normalized.status ?? ''),
        memo: String(normalized.memo ?? ''),
        currentDiameter: normalized.currentDiameter === '' ? '' : Number(normalized.currentDiameter),
        useStartDate: String(normalized.useStartDate ?? ''),
        updatedAt: String(normalized.updatedAt ?? ''),
        requestSent: normalized.requestSent === true,
        workProgress: normalized.workProgress || {},
        history: Array.isArray(normalized.history) ? normalized.history : []
    };
}

function getSortedVerificationSnapshots(roleList) {
    return roleList
        .map(getRoleVerificationSnapshot)
        .sort((a, b) => {
            const aKey = a.id ? `id:${a.id}` : `name:${a.name}`;
            const bKey = b.id ? `id:${b.id}` : `name:${b.name}`;
            return aKey.localeCompare(bKey, 'ja');
        });
}

function verifySavedRoles(expectedRoles, actualRoles) {
    const expected = getSortedVerificationSnapshots(expectedRoles);
    const actual = getSortedVerificationSnapshots(actualRoles);

    if (expected.length !== actual.length) {
        throw createSyncError(
            '同期後確認',
            `保存後の件数が一致しません。アプリ:${expected.length}件 / スプレッドシート:${actual.length}件`
        );
    }

    for (let index = 0; index < expected.length; index += 1) {
        if (stableStringify(expected[index]) !== stableStringify(actual[index])) {
            const roleName = expected[index].name || expected[index].id || `${index + 1}件目`;
            throw createSyncError(
                '同期後確認',
                `保存後のデータが一致しません。対象:${roleName}。通信確認後、再度同期してください。`
            );
        }
    }

    return true;
}

function setSyncButtonBusy(isBusy) {
    const button = document.getElementById('syncSheetsBtn');

    if (!button) {
        return;
    }

    button.disabled = isBusy;
    button.textContent = isBusy ? '同期中...' : 'スプレッドシートと同期';
}

async function syncRoles() {
    if (isSyncing) {
        setSyncMessage('同期中です。少し待ってください。');
        return;
    }

    isSyncing = true;
    setSyncButtonBusy(true);

    try {
        if (!navigator.onLine) {
            setSyncMessage('オフラインです。通信を確認してから再度同期してください。', true);
            return;
        }

        if (!isRemoteConfigured()) {
            setSyncMessage('スプレッドシート同期先が設定されていません。設定を確認してください。', true);
            return;
        }

        const localRoles = JSON.parse(localStorage.getItem('roles') || '[]').map(normalizeRole);
        const debugLocalIndex = findRollDebugIndex(localRoles);
        console.log('ROLL_DEBUG_SYNC_LOCAL_ROLES', {
            localLength: localRoles.length,
            targetIndex: debugLocalIndex,
            afterTarget5: getRollDebugSlice(localRoles, debugLocalIndex)
        });
        const previousRoles = JSON.parse(localStorage.getItem('roles_backup_before_sync') || '[]').map(normalizeRole);
        const remoteRoles = await fetchRemoteRolesForGuard();
        const pendingDeletedRoleIds = getDeletedRoleIds();
        const remoteRolesAfterPendingDelete = remoteRoles.filter(role => !isRoleMarkedDeleted(role, pendingDeletedRoleIds));
        const previousRolesAfterPendingDelete = previousRoles.filter(role => !isRoleMarkedDeleted(role, pendingDeletedRoleIds));

        console.log('SYNC GUARD CHECK', {
            local: localRoles.length,
            remote: remoteRoles.length,
            deleted: pendingDeletedRoleIds.length,
            previous: previousRoles.length
        });

        if (!Array.isArray(localRoles) || (localRoles.length === 0 && remoteRolesAfterPendingDelete.length > 0)) {
            alert('アプリ側データが0件のため同期を停止しました。');
            setSyncMessage('アプリ側データが0件のため同期を停止しました。', true);
            return;
        }

        if (remoteRolesAfterPendingDelete.length >= 10 && localRoles.length < remoteRolesAfterPendingDelete.length * 0.2) {
            alert(
                `アプリ側データが少なすぎるため同期を停止しました。\nアプリ:${localRoles.length}件\nスプレッドシート:${remoteRolesAfterPendingDelete.length}件`
            );
            setSyncMessage('件数差が大きいため同期を停止しました。', true);
            return;
        }

        if (previousRolesAfterPendingDelete.length >= 10 && localRoles.length < previousRolesAfterPendingDelete.length * 0.2) {
            alert(
                `前回同期前よりデータ件数が急減しています。\n同期を停止しました。\n現在:${localRoles.length}件\n前回:${previousRolesAfterPendingDelete.length}件`
            );
            setSyncMessage('前回より件数が急減したため同期を停止しました。', true);
            return;
        }

        const mergedRoles = mergeRemoteAndLocalRoles(remoteRoles, localRoles);
        const lastSuccessfulSyncCount = getLastSuccessfulSyncCount();
        const syncCountBaseline = getSyncCountBaseline([
            remoteRoles.length,
            previousRoles.length,
            lastSuccessfulSyncCount
        ]);

        console.log('SYNC SEND COUNT CHECK', {
            send: mergedRoles.length,
            baseline: syncCountBaseline,
            remote: remoteRoles.length,
            local: localRoles.length,
            previous: previousRoles.length,
            lastSuccessful: lastSuccessfulSyncCount,
            deleted: pendingDeletedRoleIds.length
        });
        updateSyncDiagnosticPanel({
            localRoles,
            remoteRoles,
            mergedRoles
        });

        if (warnAndBlockUnsafeSyncCount(mergedRoles.length, syncCountBaseline)) {
            return;
        }

        const sortedMergedRoles = sortRolesByStandRole(mergedRoles);

        roles = sortedMergedRoles;
        saveLocalRoles();

        localStorage.setItem('roles_backup_before_sync', JSON.stringify(sortedMergedRoles));
        localStorage.setItem('roles_backup_before_sync_saved_at', new Date().toISOString());

        setSyncMessage('スプレッドシートと同期中です...');

        const ok = await saveData();

        if (ok) {
            setSyncMessage('保存結果を確認しています...');
            const savedRemoteRoles = await fetchRemoteRolesForGuard('同期後データ確認');
            lastSavedRemoteRoleCount = savedRemoteRoles.length;
            logSyncSaveDebugCounts(lastSavedRemoteRoleCount);
            verifySavedRoles(mergedRoles, savedRemoteRoles);
            clearDeletedRoleIds(pendingDeletedRoleIds);
            saveLastSuccessfulSyncCount(savedRemoteRoles.length);
            saveLastSyncAt();
            renderRoles();
            updateSyncDiagnosticPanel({
                localRoles: roles,
                remoteRoles: savedRemoteRoles,
                mergedRoles: roles
            });
            setSyncMessage('スプレッドシートと同期しました。');
        } else {
            setSyncMessage('スプレッドシートと同期できませんでした。ブラウザ内には保存されています。', true);
        }
    } catch (error) {
        console.error('syncRoles error:', error);
        setSyncMessage((error.message || 'スプレッドシート同期に失敗しました。') + ' ブラウザ内のデータは残っています。', true);
    } finally {
        isSyncing = false;
        setSyncButtonBusy(false);
    }
}

const LAST_SYNC_KEY = 'lastSyncAt';

function formatLastSyncAt(value) {
    if (!value) {
        return '未同期';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '未同期';
    }

    const pad = number => String(number).padStart(2, '0');

    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function updateLastSyncTimeDisplay() {
    const el = document.getElementById('last-sync-time');

    if (!el) {
        return;
    }

    const value = localStorage.getItem(LAST_SYNC_KEY);

    el.textContent = `最終同期: ${formatLastSyncAt(value)}`;
}

function saveLastSyncAt() {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    updateLastSyncTimeDisplay();
}

document.addEventListener('DOMContentLoaded', updateLastSyncTimeDisplay);
