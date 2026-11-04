(function(root) {
    'use strict';
    // Validation only. Retain no request, token, identity or response body.
    function enabled(config) {
        return !!config && config.validationSaveReplay === true
            && config.workshopCompletion === 'validation';
    }
    async function run(input) {
        if (!enabled(input.config) || !input.selected()) return 'skipped';
        input.consume();
        let request;
        try { request = JSON.parse(input.payload); } catch (_) { return 'invalid'; }
        if (request.action !== 'save' || !request.requestId || !request.expectedRevision
            || !Array.isArray(request.roles)
            || Object.keys(request).some(key => !['action','requestId','expectedRevision','roles'].includes(key))) {
            return 'invalid';
        }
        input.session.assertCurrent();
        const response = await input.send(input.payload);
        input.session.assertCurrent();
        const data = await response.json();
        input.session.assertCurrent();
        if (!data || !data.result || data.result.requestId !== request.requestId) return 'unknown';
        if (data.success === true && data.result.state === 'complete') return 'complete';
        if (data.result.state === 'error' && data.result.rolesSaved === false
            && data.result.error === '取得後にスプレッドシートが更新されました。上書きせず停止しました。再度同期してください。') return 'revision-rejected';
        return 'unknown';
    }
    async function afterSave(payload, session) {
        const checkbox = root.document.getElementById('validation-save-replay');
        const status = root.document.getElementById('validation-save-replay-result');
        if (!checkbox || !status || !enabled(root.ROLL_APP_CONFIG) || !checkbox.checked) return;
        status.textContent = '同一requestIdで再送しています…';
        try {
            const outcome = await run({ config: root.ROLL_APP_CONFIG, payload, session,
                selected: () => checkbox.checked, consume: () => { checkbox.checked = false; },
                send: async body => {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 30000);
                    try { return await root.rollApiFetch(root.ROLL_APP_CONFIG.apiEndpoint,
                        { method: 'POST', mode: 'cors', body, signal: controller.signal }); }
                    finally { clearTimeout(timer); }
                }
            });
            if (!session.isCurrent()) return;
            status.textContent = outcome === 'revision-rejected'
                ? '同一requestId再送：更新版の競合として書込み前に拒否されました。表の不変性は別途確認してください。'
                : outcome === 'complete' ? '同一requestId再送：応答は完了。表の不変性は別途確認してください。'
                : '同一requestId再送：結果未確認。';
        } catch (_) {
            if (session.isCurrent()) status.textContent = '同一requestId再送：結果未確認。';
        }
    }
    root.RollSaveReplayDiagnostic = { enabled, run, afterSave };
    if (root.document && enabled(root.ROLL_APP_CONFIG)) {
        const panel = root.document.getElementById('validation-save-replay-panel');
        if (panel) panel.hidden = false;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
