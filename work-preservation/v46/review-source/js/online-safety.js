(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollOnlineSafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const ONLINE_STATUS = 'オンライン';
    const STAND_MIN = 2;
    const STAND_MAX = 17;

    function getStandKey(roleName) {
        const normalized = String(roleName || '').normalize('NFKC').trim();
        const match = normalized.match(/#?(\d+)(?:-|$)/);
        return match ? String(Number(match[1])) : '';
    }

    function isOnline(role) {
        return Boolean(role) && String(role.status || '').trim() === ONLINE_STATUS;
    }

    function isActiveOnline(role) {
        return isOnline(role) && role.isActiveThreeSet === true;
    }

    function diagnoseStandOnlineState(roleList, standKey) {
        const key = String(Number(standKey));
        const standRoles = (Array.isArray(roleList) ? roleList : [])
            .filter(role => getStandKey(role && role.name) === key);
        const activeRoles = standRoles.filter(role => role && role.isActiveThreeSet === true);
        const onlineRoles = standRoles.filter(isOnline);
        const onlineCount = onlineRoles.length;
        const onlineRoleIsActiveThreeSet = onlineCount === 1 && onlineRoles[0].isActiveThreeSet === true;
        return {
            standKey: key,
            roleCount: standRoles.length,
            activeThreeSetCount: activeRoles.length,
            threeSetConfigured: activeRoles.length === 3,
            onlineCount,
            onlineState: onlineCount === 1 ? 'normal' : (onlineCount === 0 ? 'missing' : 'duplicate'),
            onlineLabel: onlineCount === 1 ? '正常' : (onlineCount === 0 ? 'オンライン未設定' : 'オンライン重複'),
            onlineRoleIsActiveThreeSet,
            threeSetOnlineState: onlineCount === 1
                ? (onlineRoleIsActiveThreeSet ? 'normal' : 'outside')
                : 'not-applicable',
            threeSetOnlineLabel: onlineCount === 1 && !onlineRoleIsActiveThreeSet
                ? 'オンラインが運用3セット対象外'
                : '',
            onlineRoleIds: onlineRoles.map(role => String(role.id))
        };
    }

    function diagnoseAllStandOnlineStates(roleList, min = STAND_MIN, max = STAND_MAX) {
        const results = [];
        for (let stand = min; stand <= max; stand += 1) {
            results.push(diagnoseStandOnlineState(roleList, String(stand)));
        }
        return results;
    }

    function findNewOnlineAnomalies(beforeRoles, afterRoles) {
        return diagnoseAllStandOnlineStates(afterRoles).filter(after => {
            const before = diagnoseStandOnlineState(beforeRoles, after.standKey);
            const afterHasRoles = after.roleCount > 0;
            const afterHasOnlineAnomaly = after.onlineState !== 'normal';
            return afterHasRoles
                && afterHasOnlineAnomaly
                && (before.activeThreeSetCount === 0
                    || before.onlineState !== after.onlineState
                    || before.onlineCount !== after.onlineCount
                    || before.activeThreeSetCount !== after.activeThreeSetCount);
        });
    }

    function wouldRemoveLastOnline(beforeRoles, afterRoles, changedRoleId) {
        const beforeRole = (Array.isArray(beforeRoles) ? beforeRoles : [])
            .find(role => String(role && role.id) === String(changedRoleId));
        if (!isOnline(beforeRole)) return null;
        const originStandKey = getStandKey(beforeRole.name);
        if (!originStandKey) return null;
        const before = diagnoseStandOnlineState(beforeRoles, originStandKey);
        const after = diagnoseStandOnlineState(afterRoles, originStandKey);
        return before.onlineCount > 0 && after.onlineCount === 0
            ? { standKey: originStandKey, before, after }
            : null;
    }

    function prepareAutomaticOnlineAssignment(roleList, options) {
        const nextRoles = JSON.parse(JSON.stringify(Array.isArray(roleList) ? roleList : []));
        const newRole = nextRoles.find(role => String(role && role.id) === String(options.newRoleId));
        if (!newRole || isOnline(newRole)) throw new Error('新オンラインの対象が不正です');
        newRole.name = String(options.newRoleName || newRole.name || '').trim();
        const standKey = getStandKey(newRole.name);
        if (!standKey) throw new Error('新オンラインのスタンドが不正です');
        const existingOnlineRoles = nextRoles.filter(role => String(role.id) !== String(newRole.id)
            && getStandKey(role.name) === standKey
            && isOnline(role));
        if (existingOnlineRoles.length >= 2) {
            const error = new Error('オンラインが重複しています。先に異常を解消してください');
            error.code = 'ONLINE_DUPLICATE';
            throw error;
        }
        const oldRole = existingOnlineRoles[0] || null;
        if (oldRole) {
            oldRole.status = String(options.oldStatus || '中古予備（バラシ前）');
            oldRole.useEndDate = String(options.useEndDate || '');
            oldRole.updatedAt = options.updatedAt;
        }
        newRole.status = ONLINE_STATUS;
        newRole.useStartDate = String(options.useStartDate || '');
        newRole.useEndDate = '';
        newRole.isActiveThreeSet = true;
        newRole.nextAssemblyPlanned = false;
        newRole.updatedAt = options.updatedAt;

        const diagnosis = diagnoseStandOnlineState(nextRoles, standKey);
        if (diagnosis.onlineCount !== 1 || !diagnosis.onlineRoleIsActiveThreeSet) {
            throw new Error(diagnosis.threeSetOnlineLabel || `交代後は${diagnosis.onlineLabel}です`);
        }
        return { roles: nextRoles, oldRole, newRole, diagnosis };
    }

    return {
        ONLINE_STATUS,
        getStandKey,
        isOnline,
        isActiveOnline,
        diagnoseStandOnlineState,
        diagnoseAllStandOnlineStates,
        findNewOnlineAnomalies,
        wouldRemoveLastOnline,
        prepareAutomaticOnlineAssignment
    };
});
