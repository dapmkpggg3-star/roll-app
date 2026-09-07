(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const WORK_TYPES = Object.freeze({
        CALIBER_CHANGE: 'caliberChange',
        ROLL_CHANGE: 'rollChange',
        SIZE_CHANGE: 'sizeChange'
    });

    const SLOT_TYPES = Object.freeze({
        DAY_MAINTENANCE: 'dayMaintenance',
        STOPPED_SHIFT: 'stoppedShift',
        AFTER_PRODUCTION: 'afterProduction'
    });

    function normalizeToken(value) {
        return String(value || '').normalize('NFKC').trim().toUpperCase();
    }

    function normalizeTeam(value) {
        const token = normalizeToken(value);
        return token === 'A' || token === 'B' ? token : '';
    }

    function normalizeSize(value) {
        const token = normalizeToken(value).replace(/\s+/g, '');
        if (/^D\d+$/.test(token)) return token;
        if (/STOP|休止|休み/.test(token)) return 'STOP';
        return '';
    }

    function normalizeStand(value) {
        const token = normalizeToken(value);
        return token.replace(/^#/, '');
    }

    function createPlanningRules(config) {
        const settings = {
            afterProductionAllowedWorkTypes: [],
            afterProductionCaliberStands: [],
            sizeChangeStands: [],
            singleCrewSizeChangeAddOnStands: [],
            preferStoppedShift: true,
            preferSameTeam: true,
            stoppedShiftWeight: 2,
            dayMaintenanceWeight: 0,
            sameTeamWeight: 1,
            jointMaintenanceWeight: 0,
            ...config
        };

        const allowedAfterProduction = new Set(settings.afterProductionAllowedWorkTypes);
        const allowedAfterProductionCaliberStands = new Set(settings.afterProductionCaliberStands.map(normalizeStand));
        const allowedSingleCrewAddOns = new Set(settings.singleCrewSizeChangeAddOnStands.map(normalizeStand));

        function validateWorkForSlot(work, slot) {
            const reasons = [];
            if (!work || !Object.values(WORK_TYPES).includes(work.type)) reasons.push('作業種別が不正です');
            if (!slot || !Object.values(SLOT_TYPES).includes(slot.type)) reasons.push('作業枠が不正です');
            if (slot && slot.productionActive === true) reasons.push('生産中は交換作業を配置できません');

            if (work && slot && slot.type === SLOT_TYPES.AFTER_PRODUCTION) {
                if (!allowedAfterProduction.has(work.type)) {
                    reasons.push('生産後に許可されていない作業です');
                } else if (work.type === WORK_TYPES.CALIBER_CHANGE) {
                    const stands = Array.isArray(work.stands) ? work.stands.map(normalizeStand) : [];
                    if (!stands.length || stands.some(stand => !allowedAfterProductionCaliberStands.has(stand))) {
                        reasons.push('生産後に許可されていない設備です');
                    }
                }
            }
            return { allowed: reasons.length === 0, reasons };
        }

        function validateWorkBundle(works, slot) {
            const items = Array.isArray(works) ? works : [];
            const reasons = items.flatMap(work => validateWorkForSlot(work, slot).reasons);
            const sizeChanges = items.filter(work => work.type === WORK_TYPES.SIZE_CHANGE);
            const rollChanges = items.filter(work => work.type === WORK_TYPES.ROLL_CHANGE);

            if (sizeChanges.length > 1) reasons.push('サイズ替は同一枠に1件だけです');
            if (sizeChanges.length === 1 && rollChanges.length > 0 && slot.jointMaintenance !== true) {
                const addOnStands = rollChanges.flatMap(work => Array.isArray(work.stands) ? work.stands : [])
                    .map(normalizeStand);
                if (addOnStands.length > 1 || addOnStands.some(stand => !allowedSingleCrewAddOns.has(stand))) {
                    reasons.push('単独班のサイズ替に追加できる作業上限を超えています');
                }
            }
            return { allowed: reasons.length === 0, reasons: [...new Set(reasons)] };
        }

        function scoreSizeChangeSlot(slot, nextProductionTeam) {
            const validation = validateWorkForSlot({ type: WORK_TYPES.SIZE_CHANGE }, slot);
            if (!validation.allowed) {
                return { eligible: false, score: Number.NEGATIVE_INFINITY, warnings: validation.reasons };
            }

            let score = 0;
            const warnings = [];
            if (settings.preferStoppedShift && slot.type === SLOT_TYPES.STOPPED_SHIFT) {
                score += Number(settings.stoppedShiftWeight || 0);
            }
            if (slot.type === SLOT_TYPES.DAY_MAINTENANCE) warnings.push('日中作業として確認が必要です');
            if (slot.type === SLOT_TYPES.DAY_MAINTENANCE) {
                score += Number(settings.dayMaintenanceWeight || 0);
            }
            if (slot.jointMaintenance === true && Number(slot.requiredCompanionWorkCount || 0) > 0) {
                score += Number(settings.jointMaintenanceWeight || 0) * Number(slot.requiredCompanionWorkCount);
            }

            const slotTeam = normalizeTeam(slot.team);
            const targetTeam = normalizeTeam(nextProductionTeam);
            if (settings.preferSameTeam && slotTeam && targetTeam) {
                if (slotTeam === targetTeam) score += Number(settings.sameTeamWeight || 0);
                else warnings.push('次の生産班による再確認が必要です');
            }
            return { eligible: true, score, warnings };
        }

        function detectProductionSizeChanges(schedule) {
            const rows = Array.isArray(schedule) ? schedule : [];
            const productionRows = rows
                .map((row, index) => ({ row, index, size: normalizeSize(row && row.size) }))
                .filter(item => item.size && item.size !== 'STOP' && Number(item.row.productionAmount || 0) > 0);
            const changes = [];

            for (let i = 1; i < productionRows.length; i += 1) {
                const previous = productionRows[i - 1];
                const next = productionRows[i];
                if (previous.size === next.size) continue;
                changes.push({
                    fromDate: previous.row.date,
                    toDate: next.row.date,
                    fromSize: previous.size,
                    toSize: next.size,
                    candidateRows: rows.slice(previous.index, next.index + 1)
                });
            }
            return changes;
        }

        function chooseSizeChangeSlot(candidateSlots, nextProductionTeam) {
            const ranked = (Array.isArray(candidateSlots) ? candidateSlots : [])
                .map(slot => ({ slot, result: scoreSizeChangeSlot(slot, nextProductionTeam) }))
                .filter(item => item.result.eligible)
                .sort((a, b) => b.result.score - a.result.score);
            return ranked[0] || null;
        }

        return {
            settings: { ...settings },
            validateWorkForSlot,
            validateWorkBundle,
            scoreSizeChangeSlot,
            detectProductionSizeChanges,
            chooseSizeChangeSlot
        };
    }

    return {
        WORK_TYPES,
        SLOT_TYPES,
        normalizeTeam,
        normalizeSize,
        normalizeStand,
        createPlanningRules
    };
});
