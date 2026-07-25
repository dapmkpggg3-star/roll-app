(function () {
    const config = window.ROLL_APP_CONFIG;
    const supportedModes = ['google', 'microsoft-local', 'microsoft'];

    if (!supportedModes.includes(config.backendMode)) {
        throw new Error(`Unsupported BACKEND_MODE: ${config.backendMode}`);
    }

    function isGoogleMode() {
        return config.backendMode === 'google';
    }

    function isConfigured() {
        return isGoogleMode()
            ? String(config.googleEndpoint || '').trim() !== ''
            : String(config.apiBaseUrl || '').trim() !== '';
    }

    async function request(path, options = {}) {
        const response = await fetch(`${config.apiBaseUrl}${path}`, {
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const text = await response.text();
        let body;
        try {
            body = text ? JSON.parse(text) : {};
        } catch {
            throw new Error(`Microsoft APIからJSONではない応答が返りました（HTTP ${response.status}）。`);
        }
        if (!response.ok || body.success === false) {
            throw new Error(body.error || `Microsoft API接続に失敗しました（HTTP ${response.status}）。`);
        }
        return body;
    }

    window.RollDataService = {
        mode: config.backendMode,
        isGoogleMode,
        isConfigured,
        healthCheck: () => isGoogleMode() ? Promise.resolve({ success: true, mode: 'google' }) : request('/health'),
        getRoles: () => request('/roles'),
        saveRoles: roles => request('/roles', { method: 'POST', body: JSON.stringify({ roles }) }),
        getMasterData: () => isGoogleMode()
            ? Promise.resolve({ success: true, standMaster: [], cuttingMaster: [] })
            : request('/master-data'),
        saveMasterData: () => Promise.reject(new Error('マスターデータ保存はローカル試作の対象外です。'))
    };
})();
