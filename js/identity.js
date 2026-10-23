(function (root) {
    'use strict';
    // Provider and transport boundary: Microsoft can replace these without changing roll logic.
    function createRollApiClient({ endpoint, getToken, fetchImpl }) {
        const base = new URL(endpoint);
        if (base.protocol !== 'https:') throw new Error('安全な接続先を設定してください。');
        return async function request(input, options = {}) {
            const url = new URL(input);
            if (url.origin !== base.origin || url.pathname !== base.pathname) throw new Error('接続先が一致しません。');
            const payload = options.body ? JSON.parse(options.body) : Object.fromEntries(url.searchParams);
            delete payload.t;
            const token = await getToken();
            if (!token) throw new Error('ログインしてください。');
            const response = await fetchImpl(base.origin + base.pathname, {
                method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify({ ...payload, authToken: token }), signal: options.signal
            });
            // Fail closed: never fall back to no-cors or anonymous GET.
            if (!response.ok || response.type === 'opaque') throw new Error('接続結果を確認できません。保存状態を確認してください。');
            const result = await response.clone().json();
            if (result.success === false && !(result.result && result.result.requestId)) throw new Error(result.error || '操作が許可されませんでした。');
            return response;
        };
    }

    let adapter = null, principal = null, request = null;
    function status(message) {
        const node = root.document && root.document.getElementById('login-status');
        if (node) node.textContent = message;
    }
    async function prepare() {
        if (adapter) return;
        const config = root.ROLL_APP_CONFIG;
        if (!config || !config.apiEndpoint || !config.firebase || !config.firebase.apiKey
            || !config.firebase.projectId || !config.firebase.authDomain) {
            throw new Error('Googleログインの設定準備中です。設定完了後に利用できます。');
        }
        const [appSdk, authSdk] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js')
        ]);
        const auth = authSdk.getAuth(appSdk.initializeApp(config.firebase));
        // Do not persist tokens in localStorage or the service worker cache.
        await authSdk.setPersistence(auth, authSdk.inMemoryPersistence);
        adapter = {
            signIn: () => authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider()),
            signOut: () => authSdk.signOut(auth),
            getToken: () => auth.currentUser ? auth.currentUser.getIdToken() : null
        };
        request = createRollApiClient({ endpoint: config.apiEndpoint, getToken: adapter.getToken, fetchImpl: root.fetch.bind(root) });
    }
    root.RollAuth = {
        currentUser: () => principal,
        async signIn() {
            try {
                status('本人確認中です…');
                await prepare();
                await adapter.signIn();
                const response = await request(root.ROLL_APP_CONFIG.apiEndpoint + '?action=whoami');
                const result = await response.json();
                if (!result.user || !result.user.id) throw new Error('利用者を確認できません。');
                const owner = root.localStorage.getItem('rollDataOwner');
                if (owner && owner !== result.user.id) throw new Error('別の利用者の端末内データがあります。専用のブラウザプロファイルを使用してください。');
                root.localStorage.setItem('rollDataOwner', result.user.id);
                principal = result.user;
                status('');
                return principal;
            } catch (error) {
                principal = null;
                if (adapter) await adapter.signOut().catch(() => {});
                status(error.message || 'ログインできませんでした。');
                throw error;
            }
        },
        async signOut() {
            principal = null;
            if (adapter) await adapter.signOut();
            status('ログアウトしました。');
        },
        async fetch(input, options) {
            if (!principal || !request) throw new Error('ログインしてください。');
            return request(input, options);
        }
    };
    root.rollApiFetch = (input, options) => root.RollAuth.fetch(input, options);
    if (typeof module === 'object' && module.exports) module.exports = { createRollApiClient };
})(typeof globalThis !== 'undefined' ? globalThis : this);
