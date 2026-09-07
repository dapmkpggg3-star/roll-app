(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningCalibers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function positiveInteger(value, fallback) {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
    }

    function buildProductionRuns(schedule, scheduleApi) {
        const rows = Array.isArray(schedule) ? schedule : [];
        const runs = [];
        rows.forEach((row, rowIndex) => {
            const shift1Team = scheduleApi.normalizeTeam(row && row.shift1Team);
            const shift3Team = scheduleApi.normalizeTeam(row && row.shift3Team);
            if (shift1Team && scheduleApi.productionForTeam(row, shift1Team) > 0) {
                runs.push({ rowIndex, rank: 1, date: row.date, shift: 'shift1', team: shift1Team });
            }
            if (shift3Team && scheduleApi.productionForTeam(row, shift3Team) > 0) {
                runs.push({ rowIndex, rank: 3, date: row.date, shift: 'shift3', team: shift3Team });
            }
        });
        return runs;
    }

    function nextCaliber(currentCaliber, sequence) {
        const values = Array.isArray(sequence) ? sequence : [];
        const index = values.findIndex(value => String(value) === String(currentCaliber));
        return index < 0 || values.length === 0 ? null : values[(index + 1) % values.length];
    }

    function slotRank(slot) {
        if (slot.shift === 'shift1' || slot.type === 'dayMaintenance') return 2;
        if (slot.shift === 'shift3') return 4;
        return 2;
    }

    function isBefore(slot, run) {
        return slot.rowIndex < run.rowIndex
            || (slot.rowIndex === run.rowIndex && slotRank(slot) < run.rank);
    }

    function projectCaliberChange(schedule, state, dependencies) {
        const rows = Array.isArray(schedule) ? schedule : [];
        const scheduleApi = dependencies.scheduleApi;
        const ruleEngine = dependencies.ruleEngine;
        const slotTypes = dependencies.slotTypes;
        const maxRuns = positiveInteger(state && state.maxRuns, 0);
        const usedRuns = positiveInteger(state && state.usedRuns, 0);
        const remainingRuns = Math.max(0, maxRuns - usedRuns);
        const productionRuns = buildProductionRuns(rows, scheduleApi);
        const firstOverLimitRun = productionRuns[remainingRuns] || null;
        const lastAllowedRun = remainingRuns > 0 ? productionRuns[remainingRuns - 1] || null : null;
        const work = {
            type: dependencies.workTypes.CALIBER_CHANGE,
            stands: Array.isArray(state && state.stands) ? state.stands : []
        };

        const candidates = rows.flatMap((row, rowIndex) => (
            scheduleApi.buildAvailableSlots(row, slotTypes)
                .map(slot => ({ ...slot, rowIndex }))
        )).filter(slot => {
            if (!firstOverLimitRun || !isBefore(slot, firstOverLimitRun)) return false;
            return ruleEngine.validateWorkForSlot(work, slot).allowed;
        });

        const recommendation = candidates.length ? candidates[candidates.length - 1] : null;
        let status = 'notDueWithinHorizon';
        if (firstOverLimitRun && recommendation) status = 'slotFound';
        if (firstOverLimitRun && !recommendation) status = 'noSafeSlot';

        return {
            equipmentId: state && state.equipmentId,
            currentCaliber: state && state.currentCaliber,
            nextCaliber: state && state.nextCaliber != null
                ? state.nextCaliber
                : nextCaliber(state && state.currentCaliber, state && state.caliberSequence),
            maxRuns,
            usedRuns,
            remainingRuns,
            lastAllowedRun,
            firstOverLimitRun,
            candidateSlots: candidates,
            recommendation,
            status
        };
    }

    function projectCaliberChanges(schedule, states, dependencies) {
        return (Array.isArray(states) ? states : [])
            .map(state => projectCaliberChange(schedule, state, dependencies));
    }

    return {
        buildProductionRuns,
        nextCaliber,
        projectCaliberChange,
        projectCaliberChanges
    };
});
