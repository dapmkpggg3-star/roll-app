(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningSchedule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function normalizeTeam(value) {
        const token = String(value || '').normalize('NFKC').trim().toUpperCase();
        return token === 'A' || token === 'B' ? token : '';
    }

    function productionForTeam(row, team) {
        const key = normalizeTeam(team);
        const values = row && row.productionByTeam;
        return key && values ? Number(values[key] || 0) : 0;
    }

    function firstProductionTeam(row) {
        const shift1Team = normalizeTeam(row && row.shift1Team);
        const shift3Team = normalizeTeam(row && row.shift3Team);
        if (shift1Team && productionForTeam(row, shift1Team) > 0) return shift1Team;
        if (shift3Team && productionForTeam(row, shift3Team) > 0) return shift3Team;
        return '';
    }

    function countRequiredCompanionWork(row) {
        return (Array.isArray(row && row.requiredWorks) ? row.requiredWorks : [])
            .filter(work => work && work.type !== 'sizeChange').length;
    }

    function buildAvailableSlots(row, slotTypes) {
        const slots = [];
        const shift1Team = normalizeTeam(row && row.shift1Team);
        const shift3Team = normalizeTeam(row && row.shift3Team);
        const companionCount = countRequiredCompanionWork(row);

        if (shift1Team && productionForTeam(row, shift1Team) === 0) {
            slots.push({
                id: `${row.date}|shift1|${shift1Team}`,
                date: row.date,
                shift: 'shift1',
                team: shift1Team,
                type: slotTypes.DAY_MAINTENANCE,
                productionActive: false,
                jointMaintenance: row.jointMaintenance === true,
                requiredCompanionWorkCount: companionCount
            });
        }

        if (shift3Team && productionForTeam(row, shift3Team) === 0) {
            slots.push({
                id: `${row.date}|shift3|${shift3Team}`,
                date: row.date,
                shift: 'shift3',
                team: shift3Team,
                type: slotTypes.STOPPED_SHIFT,
                productionActive: false,
                jointMaintenance: false,
                requiredCompanionWorkCount: companionCount
            });
        }
        return slots;
    }

    function recommendSizeChanges(schedule, ruleEngine, slotTypes) {
        const rows = Array.isArray(schedule) ? schedule : [];
        const changes = ruleEngine.detectProductionSizeChanges(rows);
        return changes.map(change => {
            const fromIndex = rows.findIndex(row => row.date === change.fromDate);
            const toIndex = rows.findIndex(row => row.date === change.toDate);
            const windowRows = fromIndex >= 0 && toIndex >= fromIndex
                ? rows.slice(fromIndex, toIndex + 1)
                : [];
            const slots = windowRows.flatMap(row => buildAvailableSlots(row, slotTypes));
            const nextTeam = toIndex >= 0 ? firstProductionTeam(rows[toIndex]) : '';
            return {
                change,
                nextProductionTeam: nextTeam,
                candidateSlots: slots,
                recommendation: ruleEngine.chooseSizeChangeSlot(slots, nextTeam)
            };
        });
    }

    return {
        normalizeTeam,
        productionForTeam,
        firstProductionTeam,
        countRequiredCompanionWork,
        buildAvailableSlots,
        recommendSizeChanges
    };
});
