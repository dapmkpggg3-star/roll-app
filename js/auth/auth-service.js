(function () {
    const config = window.ROLL_APP_CONFIG;
    const key = 'microsoftLocalAuthRole';
    const validRoles = ['logged-out', 'user', 'admin'];

    function isMicrosoftMode() {
        return config.authMode === 'microsoft-local' || config.authMode === 'microsoft';
    }

    function getRole() {
        if (!isMicrosoftMode()) return localStorage.getItem('isLoggedIn') === 'true' ? 'admin' : 'logged-out';
        const stored = localStorage.getItem(key) || config.localAuthRole;
        return validRoles.includes(stored) ? stored : 'logged-out';
    }

    window.RollAuth = {
        isMicrosoftMode,
        getState() {
            const role = getRole();
            return { role, isLoggedIn: role !== 'logged-out', isAdmin: role === 'admin' };
        },
        login(role = 'user') {
            if (!validRoles.includes(role) || role === 'logged-out') throw new Error('Invalid local auth role');
            localStorage.setItem(key, role);
        },
        logout() {
            localStorage.setItem(key, 'logged-out');
        },
        setLocalRole(role) {
            if (!validRoles.includes(role)) throw new Error('Invalid local auth role');
            localStorage.setItem(key, role);
            location.reload();
        }
    };
})();
