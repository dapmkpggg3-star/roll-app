const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyN0_AoU1dcaXzCO3ICRma2pFJyz2HvCSnwe_RAJMpaOlE53Gj5SugtDFoV78KHf9x9/exec';
function isRemoteConfigured() {
    return SHEETS_ENDPOINT.trim().length > 0;
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

    remoteRoles.forEach(role => {
        const normalized = normalizeRole(role);
        mergedMap.set(getRoleMergeKey(normalized), normalized);
    });

    localRoles.forEach(role => {
        if (!role || !role.name || String(role.name).trim() === '') return;
        const key = getRoleMergeKey(role);
        const localRole = normalizeRole(role);
        const remoteRole = mergedMap.get(key);
        if (remoteRole) {
            localRole.history = mergeRoleHistory(remoteRole.history, localRole.history);
        }
        mergedMap.set(key, localRole);
    });

    return Array.from(mergedMap.values());
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
        roles = data.roles.map(normalizeRole);
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
        console.log('saveRemoteRoles: Sending data to', SHEETS_ENDPOINT);

        const payload = JSON.stringify({
            action: 'save',
            roles: roles
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
        return true;
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
    return data.roles.map(normalizeRole);
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
        const previousRoles = JSON.parse(localStorage.getItem('roles_backup_before_sync') || '[]').map(normalizeRole);
        const remoteRoles = await fetchRemoteRolesForGuard();

        console.log('SYNC GUARD CHECK', {
            local: localRoles.length,
            remote: remoteRoles.length,
            previous: previousRoles.length
        });

        if (!Array.isArray(localRoles) || localRoles.length === 0) {
            alert('アプリ側データが0件のため同期を停止しました。');
            setSyncMessage('アプリ側データが0件のため同期を停止しました。', true);
            return;
        }

        if (remoteRoles.length >= 10 && localRoles.length < remoteRoles.length * 0.2) {
            alert(
                `アプリ側データが少なすぎるため同期を停止しました。\nアプリ:${localRoles.length}件\nスプレッドシート:${remoteRoles.length}件`
            );
            setSyncMessage('件数差が大きいため同期を停止しました。', true);
            return;
        }

        if (previousRoles.length >= 10 && localRoles.length < previousRoles.length * 0.2) {
            alert(
                `前回同期前よりデータ件数が急減しています。\n同期を停止しました。\n現在:${localRoles.length}件\n前回:${previousRoles.length}件`
            );
            setSyncMessage('前回より件数が急減したため同期を停止しました。', true);
            return;
        }

        const mergedRoles = mergeRemoteAndLocalRoles(remoteRoles, localRoles);

        roles = mergedRoles;
        saveLocalRoles();

        localStorage.setItem('roles_backup_before_sync', JSON.stringify(mergedRoles));
        localStorage.setItem('roles_backup_before_sync_saved_at', new Date().toISOString());

        setSyncMessage('スプレッドシートと同期中です...');

        const ok = await saveData();

        if (ok) {
            setSyncMessage('保存結果を確認しています...');
            const savedRemoteRoles = await fetchRemoteRolesForGuard('同期後データ確認');
            verifySavedRoles(mergedRoles, savedRemoteRoles);
            saveLastSyncAt();
            renderRoles();
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
