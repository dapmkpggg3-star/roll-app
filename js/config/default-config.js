(function () {
    const defaults = {
        backendMode: 'google',
        authMode: 'legacy',
        apiBaseUrl: '/api',
        googleEndpoint: '',
        localAuthRole: 'logged-out'
    };

    window.ROLL_APP_CONFIG = Object.freeze({
        ...defaults,
        ...(window.ROLL_APP_RUNTIME_CONFIG || {})
    });
})();
