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
        const url = `${SHEETS_ENDPOINT}?action=fetch`;
        const response = await fetch(url);
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

        const response = await fetch(SHEETS_ENDPOINT, {
            method: 'POST',
            headers: {
             'Content-Type': 'application/json'
            },
            body: payload
        });

        console.log('saveRemoteRoles: Response status', response.status);

        const data = await readJsonResponse(response, 'データ保存');

        console.log('saveRemoteRoles: Response data (stringified):', JSON.stringify(data));
        console.log('saveRemoteRoles: success=', data.success, 'error=', data.error);

        validateSaveResponse(data);

        return true;
    } catch (error) {
        console.error('saveRemoteRoles error:', error);
        throw error;
    }
}
}

function loadRemoteRoles() {
    return fetchData();
}

function saveRemoteRoles() {
    return saveData();
}

async function syncRoles() {
    saveLocalRoles();
    if (!isRemoteConfigured()) {
        setSyncMessage('スプレッドシート同期先が設定されていません。設定を確認してください。', true);
        return;
    }
    try {
        setSyncMessage('スプレッドシートと同期中です...');
        console.log('syncRoles: Starting sync...');
        const ok = await saveData();
        console.log('syncRoles: Result -', ok);
        if (ok) {
            setSyncMessage('スプレッドシートと同期しました。');
        } else {
            setSyncMessage('スプレッドシートと同期できませんでした。ブラウザ内には保存されています。', true);
        }
    } catch (error) {
        console.error('syncRoles error:', error);
        setSyncMessage((error.message || 'スプレッドシート同期に失敗しました。') + ' ブラウザ内のデータは残っています。', true);
    }
}
