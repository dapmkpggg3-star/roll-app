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

function validateSaveResponse(data) {
    if (!data || data.success !== true) {
        const detail = data && data.error ? `詳細: ${data.error}` : 'success:true が返っていません。';
        throw createSyncError('データ保存', `Apps Script側で保存に失敗しました。${detail}`);
    }
}

async function fetchData() {
    if (!isRemoteConfigured()) {
        setSyncMessage('スプレッドシート同期先が設定されていません。設定を確認してください。', true);
        return;
    }
    try {
        console.log('loadRemoteRoles: Starting fetch...');
        const url = `${SHEETS_ENDPOINT}?action=fetch&t=${Date.now()}`;
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store'
        });
        
        const data = await readJsonResponse(response, 'データ取得');
        console.log('loadRemoteRoles: Response data', data);
        validateFetchResponse(data);
        roles = data.roles.map(role => ({
            ...role,
            updatedAt: role.updatedAt || new Date().toISOString(),
            memo: role.memo || '',
            status: ALLOWED_STATUSES.includes(role.status) ? role.status : '中古予備（バラシ前）'
        }));
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
        const timeoutId = setTimeout(() => controller.abort(), 15000);

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

async function fetchRemoteRolesForGuard() {
    const url = `${SHEETS_ENDPOINT}?action=fetch&t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
    });

    const data = await readJsonResponse(response, '同期前データ確認');
    validateFetchResponse(data);
    return data.roles;
}

function loadRemoteRoles() {
    return fetchData();
}

function saveRemoteRoles() {
    return saveData();
}
let isSyncing = false;

async function syncRoles() {
    if (isSyncing) {
        setSyncMessage('同期中です。少し待ってください。');
        return;
    }

    isSyncing = true;

    try {
        if (!navigator.onLine) {
            setSyncMessage('オフラインです。通信を確認してから再度同期してください。', true);
            return;
        }

        if (!isRemoteConfigured()) {
            setSyncMessage('スプレッドシート同期先が設定されていません。設定を確認してください。', true);
            return;
        }

        const localRoles = JSON.parse(localStorage.getItem('roles') || '[]');
        const previousRoles = JSON.parse(localStorage.getItem('roles_backup_before_sync') || '[]');
        const remoteRoles = await fetchRemoteRolesForGuard();

        if (!Array.isArray(localRoles) || localRoles.length === 0) {
            alert('アプリ側データが0件のため同期を停止しました。');
            setSyncMessage('アプリ側データが0件のため同期を停止しました。', true);
            return;
        }

        if (remoteRoles.length > 0 && localRoles.length < remoteRoles.length * 0.5) {
            alert(
                `スプレッドシート側よりアプリ側データが大きく少ないため同期を停止しました。\nアプリ:${localRoles.length}件\nスプレッドシート:${remoteRoles.length}件`
            );
            setSyncMessage('件数差が大きいため同期を停止しました。', true);
            return;
        }

        if (previousRoles.length > 0 && localRoles.length < previousRoles.length * 0.5) {
            alert(
                `前回同期前よりデータ件数が急減しています。\n同期を停止しました。\n現在:${localRoles.length}件\n前回:${previousRoles.length}件`
            );
            setSyncMessage('前回より件数が急減したため同期を停止しました。', true);
            return;
        }

        roles = localRoles;
        saveLocalRoles();

        localStorage.setItem('roles_backup_before_sync', JSON.stringify(localRoles));
        localStorage.setItem('roles_backup_before_sync_saved_at', new Date().toISOString());

        setSyncMessage('スプレッドシートと同期中です...');

        const ok = await saveData();

        if (ok) {
            saveLastSyncAt();
            setSyncMessage('スプレッドシートと同期しました。');
        } else {
            setSyncMessage('スプレッドシートと同期できませんでした。ブラウザ内には保存されています。', true);
        }
    } catch (error) {
        console.error('syncRoles error:', error);
        setSyncMessage((error.message || 'スプレッドシート同期に失敗しました。') + ' ブラウザ内のデータは残っています。', true);
    } finally {
        isSyncing = false;
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
