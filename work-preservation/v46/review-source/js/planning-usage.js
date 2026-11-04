(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningUsage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function count(value) {
        if ((typeof value !== 'number' && typeof value !== 'string')
            || String(value).trim() === '') return null;
        const n = Number(value);
        return Number.isSafeInteger(n) && n >= 0 ? n : null;
    }

    function id(value) {
        return typeof value === 'string' && value.trim() ? value.trim() : null;
    }

    // Each period is an incremental use, never a cumulative total or an actual.
    // The caller supplies stable caliber identities for one known roll cycle.
    function summarizePlan(input) {
        if (!input || !Array.isArray(input.calibers) || !input.calibers.length
            || !Array.isArray(input.periods)) throw new Error('カリバと使用予定の一覧が必要です');
        const states = new Map();
        input.calibers.forEach(caliber => {
            const key = id(caliber && caliber.id);
            if (!key || states.has(key)) throw new Error('カリバIDが未設定または重複しています');
            const maximum = count(caliber.maxRuns);
            states.set(key, {
                id: key,
                size: caliber.size || null,
                openingUsedRuns: count(caliber.openingUsedRuns),
                maxRuns: maximum > 0 ? maximum : null,
                plannedRuns: 0,
                tentativeRuns: 0,
                unknownPlannedRuns: false,
                unknownTentativeRuns: false,
                hasTentativeUse: false,
                periodIds: []
            });
        });
        const periodIds = new Set();
        let plannedOperatingRuns = 0;
        let tentativeOperatingRuns = 0;
        let unknownPlanned = false;
        let unknownTentative = false;
        for (const period of input.periods) {
            const key = id(period && period.id);
            if (!key || periodIds.has(key)) throw new Error('使用予定IDが未設定または重複しています');
            periodIds.add(key);
            if (period.recordType !== 'plan') throw new Error('予定と実績を分けて指定してください');
            if (!['reference', 'confirmed', 'tentative'].includes(period.certainty)) {
                throw new Error('使用予定の確定区分が必要です');
            }
            if (period.quantityKind !== 'incremental') throw new Error('使用直数は期間ごとの追加分で指定してください');
            const targets = period.caliberIds;
            if (!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length
                || targets.some(target => !states.has(target))) throw new Error('使用カリバの対応を確認してください');
            if (targets.some(target => states.get(target).size && states.get(target).size !== period.size)) {
                throw new Error('使用予定とカリバのサイズが一致しません');
            }
            const runs = count(period.runs);
            const tentative = period.certainty === 'tentative';
            if (tentative) {
                if (runs === null) unknownTentative = true;
                else tentativeOperatingRuns += runs;
            } else {
                if (runs === null) unknownPlanned = true;
                else plannedOperatingRuns += runs;
            }
            for (const target of targets) {
                const state = states.get(target);
                state.periodIds.push(key);
                if (tentative) {
                    state.hasTentativeUse = true;
                    if (runs === null) state.unknownTentativeRuns = true;
                    else state.tentativeRuns += runs;
                } else {
                    if (runs === null) state.unknownPlannedRuns = true;
                    else state.plannedRuns += runs;
                }
            }
        }
        const calibers = [...states.values()].map(state => {
            const missing = [];
            if (state.openingUsedRuns === null) missing.push('openingUsedRuns');
            if (state.maxRuns === null) missing.push('maxRuns');
            if (state.unknownPlannedRuns) missing.push('plannedRuns');
            const projected = state.openingUsedRuns === null || state.unknownPlannedRuns
                ? null : state.openingUsedRuns + state.plannedRuns;
            // A known subtotal can already exceed a limit even when some data is missing.
            const knownMinimum = (state.openingUsedRuns ?? 0) + state.plannedRuns;
            const exceeded = state.maxRuns !== null && knownMinimum > state.maxRuns;
            return {
                id: state.id,
                periodIds: state.periodIds,
                openingUsedRuns: state.openingUsedRuns,
                maxRuns: state.maxRuns,
                knownPlannedRuns: state.plannedRuns,
                plannedRuns: state.unknownPlannedRuns ? null : state.plannedRuns,
                tentativeRuns: state.unknownTentativeRuns ? null : state.tentativeRuns,
                hasTentativeUse: state.hasTentativeUse,
                tentativeUsageStatus: !state.hasTentativeUse ? 'notApplicable'
                    : state.maxRuns !== null && knownMinimum + state.tentativeRuns > state.maxRuns ? 'exceeded'
                    : missing.length || state.unknownTentativeRuns ? 'unknown' : 'withinRecordedLimit',
                projectedUsedRuns: projected,
                remainingRuns: !missing.length ? Math.max(0, state.maxRuns - projected) : null,
                usageStatus: exceeded ? 'exceeded' : missing.length ? 'unknown' : 'withinRecordedLimit',
                missingInformation: missing
            };
        });
        return {
            scope: 'supplied-plan-usage-only',
            readinessAssessed: false,
            plannedOperatingRuns: unknownPlanned ? null : plannedOperatingRuns,
            knownPlannedOperatingRuns: plannedOperatingRuns,
            tentativeOperatingRuns: unknownTentative ? null : tentativeOperatingRuns,
            calibers
        };
    }

    return { summarizePlan };
});
