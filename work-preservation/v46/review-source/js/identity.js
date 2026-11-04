(function (root) {
    'use strict';
    // Provider and transport boundary: Microsoft can replace these without changing roll logic.
    function createSessionFence() {
        let generation = 0;
        return {
            invalidate() { generation += 1; },
            capture() {
                const started = generation;
                return {
                    isCurrent: () => started === generation,
                    assertCurrent() {
                        if (started === generation) return;
                        const error = new Error('ログイン状態が変わったため確認を中断しました。送信済みの保存は取り消されていない可能性があります。再ログイン後に反映状態を確認してください。');
                        error.code = 'AUTH_SESSION_CHANGED';
                        throw error;
                    }
                };
            }
        };
    }

    function guardResponse(response, session) {
        // Native Response methods need their original receiver. Guard deferred body
        // reads too: callers may read JSON/text after a logout or renewed login.
        return new Proxy(response, {
            get(target, key) {
                if (key === 'clone') return () => {
                    session.assertCurrent();
                    return guardResponse(target.clone(), session);
                };
                const value = Reflect.get(target, key, target);
                if (['json', 'text', 'arrayBuffer', 'blob', 'formData'].includes(key)) return async (...args) => {
                    session.assertCurrent();
                    const result = await value.apply(target, args);
                    session.assertCurrent();
                    return result;
                };
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
    }

    function createRollApiClient({ endpoint, getToken, fetchImpl, captureSession = () => ({ assertCurrent() {} }), onPhase = () => {} }) {
        const base = new URL(endpoint);
        if (base.protocol !== 'https:') throw new Error('安全な接続先を設定してください。');
        return async function request(input, options = {}) {
            const session = captureSession();
            session.assertCurrent();
            const url = new URL(input);
            if (url.origin !== base.origin || url.pathname !== base.pathname) throw new Error('接続先が一致しません。');
            const payload = options.body ? JSON.parse(options.body) : Object.fromEntries(url.searchParams);
            delete payload.t;
            onPhase('token');
            const token = await getToken();
            session.assertCurrent();
            if (!token) throw new Error('ログインしてください。');
            onPhase('gas-send');
            const response = await fetchImpl(base.origin + base.pathname, {
                method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify({ ...payload, authToken: token }), signal: options.signal
            });
            session.assertCurrent();
            // Fail closed: never fall back to no-cors or anonymous GET.
            if (!response.ok || response.type === 'opaque') throw new Error('接続結果を確認できません。保存状態を確認してください。');
            onPhase('gas-body');
            const result = await response.clone().json();
            session.assertCurrent();
            if (result.success === false && !(result.result && result.result.requestId)) {
                const error = new Error(result.error || '操作が許可されませんでした。');
                error.workshopRejectedRequestId = result.workshopRejectedRequestId || null;
                throw error;
            }
            return guardResponse(response, session);
        };
    }

    let adapter = null, principal = null, request = null;
    let signInPending = false, signOutPending = null;
    const sessions = createSessionFence();
    function status(message) {
        const node = root.document && root.document.getElementById('login-status');
        if (node) node.textContent = message;
    }
    // Opt-in validation diagnostics: fixed labels/codes only, no tokens, URLs or identity.
    const phaseLabels = {
        config: '設定確認', sdk: 'Firebase SDK読込', persistence: '認証の保持設定',
        ready: '認証準備完了', popup: 'Google認証の応答待ち', returned: 'Google認証復帰',
        whoami: '利用者確認開始', token: '認証証明の取得', 'gas-send': 'GAS応答待ち',
        'gas-body': 'GAS応答の読取', verified: '利用者確認完了', owner: '端末内データ所有者確認',
        complete: 'ログイン完了', cleanup: '認証の後片付け', failed: 'ログイン失敗'
    };
    const safeCodes = new Set(['auth/unauthorized-domain', 'auth/popup-blocked',
        'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/network-request-failed',
        'auth/operation-not-allowed', 'auth/invalid-api-key', 'auth/internal-error',
        'auth/web-storage-unsupported', 'AUTH_SESSION_CHANGED']);
    let diagnosticLines = [], diagnosticTimer = null;
    function diagnosticsEnabled() {
        return !!(root.ROLL_APP_CONFIG && root.ROLL_APP_CONFIG.authenticationDiagnostics === true);
    }
    function clearDiagnosticTimer() {
        if (diagnosticTimer !== null) root.clearTimeout(diagnosticTimer);
        diagnosticTimer = null;
    }
    function renderDiagnostic() {
        const node = root.document && root.document.getElementById('auth-diagnostics');
        if (node) { node.hidden = !diagnosticsEnabled(); node.textContent = diagnosticLines.join(' → '); }
    }
    function phase(name) {
        if (!diagnosticsEnabled() || !phaseLabels[name]) return;
        clearDiagnosticTimer();
        diagnosticLines.push(phaseLabels[name]);
        diagnosticLines = diagnosticLines.slice(-20);
        renderDiagnostic();
        status(phaseLabels[name] + '…');
        if (!['complete', 'failed'].includes(name)) diagnosticTimer = root.setTimeout(() => {
            diagnosticTimer = null;
            status(phaseLabels[name] + '：20秒以上応答待ちです。追加クリックは不要です。');
        }, 20000);
    }
    async function prepare() {
        if (adapter) return;
        phase('config');
        const config = root.ROLL_APP_CONFIG;
        if (!config || !config.apiEndpoint || !config.firebase || !config.firebase.apiKey
            || !config.firebase.projectId || !config.firebase.authDomain) {
            throw new Error('Googleログインの設定準備中です。設定完了後に利用できます。');
        }
        phase('sdk');
        const [appSdk, authSdk] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js')
        ]);
        const auth = authSdk.getAuth(appSdk.initializeApp(config.firebase));
        // Do not persist tokens in localStorage or the service worker cache.
        phase('persistence');
        await authSdk.setPersistence(auth, authSdk.inMemoryPersistence);
        adapter = {
            signIn: () => authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider()),
            signOut: () => authSdk.signOut(auth),
            getToken: () => auth.currentUser ? auth.currentUser.getIdToken() : null
        };
        request = createRollApiClient({ endpoint: config.apiEndpoint, getToken: adapter.getToken,
            fetchImpl: root.fetch.bind(root), captureSession: sessions.capture,
            onPhase: name => { if (signInPending) phase(name); } });
    }
    root.RollAuth = {
        currentUser: () => principal,
        captureSession: () => sessions.capture(),
        async signIn() {
            if (signInPending || signOutPending) throw new Error('ログイン状態を確認中です。少し待ってから操作してください。');
            signInPending = true;
            sessions.invalidate();
            principal = null;
            const session = sessions.capture();
            try {
                clearDiagnosticTimer();
                diagnosticLines = [];
                renderDiagnostic();
                status('本人確認中です…');
                await prepare();
                session.assertCurrent();
                phase('ready');
                phase('popup');
                await adapter.signIn();
                phase('returned');
                session.assertCurrent();
                phase('whoami');
                const response = await request(root.ROLL_APP_CONFIG.apiEndpoint + '?action=whoami');
                const result = await response.json();
                session.assertCurrent();
                if (!result.user || !result.user.id) throw new Error('利用者を確認できません。');
                phase('verified');
                phase('owner');
                const owner = root.localStorage.getItem('rollDataOwner');
                if (owner && owner !== result.user.id) throw new Error('別の利用者の端末内データがあります。専用のブラウザプロファイルを使用してください。');
                root.localStorage.setItem('rollDataOwner', result.user.id);
                principal = result.user;
                phase('complete');
                status('');
                return principal;
            } catch (error) {
                principal = null;
                if (diagnosticsEnabled()) {
                    diagnosticLines.push(safeCodes.has(error.code) ? error.code : 'UNCLASSIFIED_ERROR');
                    phase('cleanup');
                }
                if (adapter) await adapter.signOut().catch(() => {});
                phase('failed');
                status(error.message || 'ログインできませんでした。');
                throw error;
            } finally {
                clearDiagnosticTimer();
                signInPending = false;
            }
        },
        async signOut() {
            sessions.invalidate();
            principal = null;
            if (!signOutPending) signOutPending = Promise.resolve().then(() => adapter && adapter.signOut());
            try {
                await signOutPending;
            } finally {
                signOutPending = null;
                status('ログアウトしました。未反映・確認途中の変更は再ログイン後に確認してください。');
            }
        },
        async fetch(input, options) {
            if (!principal || !request) throw new Error('ログインしてください。');
            return request(input, options);
        }
    };
    root.rollApiFetch = (input, options) => root.RollAuth.fetch(input, options);
    if (typeof module === 'object' && module.exports) module.exports = { createRollApiClient, createSessionFence };
})(typeof globalThis !== 'undefined' ? globalThis : this);
