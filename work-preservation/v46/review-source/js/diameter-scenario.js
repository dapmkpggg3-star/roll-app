'use strict';
// Comparison only. No automatic status update or annual readiness certification.
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const round = x => Math.round(x * 1e6) / 1e6;
function compareDiameterScenario({ startDiameterMm, minimumDiameterMm, cuts }) {
    if (!positive(startDiameterMm) || !positive(minimumDiameterMm) || !Array.isArray(cuts))
        return { state: 'unknown', rows: [], firstBelowLimit: null, annualReadiness: 'not_assessed' };
    const ids = new Set();
    for (const cut of cuts) {
        if (!cut || typeof cut.id !== 'string' || !cut.id.trim() || ids.has(cut.id))
            throw new Error('改削予定IDが未設定または重複しています');
        ids.add(cut.id);
    }
    let diameter = startDiameterMm, unknown = false;
    let firstBelowLimit = diameter < minimumDiameterMm ? 'starting_diameter' : null;
    const rows = cuts.map(cut => {
        const beforeMm = diameter;
        if (diameter === null || !positive(cut.lossMm)) {
            unknown = true; diameter = null;
            return { id: cut.id, beforeMm, afterMm: null, marginMm: null, state: 'unknown' };
        }
        diameter = round(diameter - cut.lossMm);
        const marginMm = round(diameter - minimumDiameterMm);
        if (marginMm < 0 && firstBelowLimit === null) firstBelowLimit = cut.id;
        return { id: cut.id, beforeMm, afterMm: diameter, marginMm,
            state: marginMm < 0 ? 'below_limit' : marginMm === 0 ? 'at_limit' : 'above_limit' };
    });
    return { state: firstBelowLimit !== null ? 'below_limit' : unknown ? 'unknown' : 'within_limit_under_assumptions',
        rows, firstBelowLimit, annualReadiness: 'not_assessed' };
}

function assessFlatAdjustmentScenario(input) {
    const missing = [], flat = input.flatAdjustment;
    const cuts = Array.isArray(input.cuts) ? input.cuts : [];
    const flatCuts = cuts.filter(cut => cut && cut.kind === 'flat_adjustment');
    if (cuts.some(cut => !cut || !['normal', 'flat_adjustment'].includes(cut.kind)))
        throw new Error('通常改削とフラット加工の区分が必要です');
    if (flatCuts.length > 1) throw new Error('同じ節本数調整を将来予定へ重複登録できません');
    if (!flat || !['completed', 'pending', 'unknown'].includes(flat.state)) missing.push('フラット加工の実施状況');
    else if (flat.state === 'completed') {
        if (flatCuts.length) throw new Error('実施済み加工が将来予定に含まれています');
        if (typeof flat.evidenceRef !== 'string' || !flat.evidenceRef.trim()) missing.push('実施済みの根拠');
        if (flat.includedInStartingDiameter !== true) missing.push('開始径に実施済み加工が反映されていること');
    } else if (flat.state === 'pending') {
        if (!flatCuts.length) missing.push('フラット加工を行う改削回');
    } else missing.push('フラット加工の実施状況');
    // lossMm is the TOTAL diameter loss of the named machining event, never an add-on.
    for (const cut of flatCuts) {
        if (cut.lossBasis !== 'total_diameter_loss') throw new Error('フラット加工回全体の減径量を指定してください');
        if (!positive(cut.lossMm)) missing.push('フラット加工回全体の減径量');
    }
    const comparison = compareDiameterScenario(input);
    return { ...comparison, comparisonState: comparison.state,
        state: comparison.state === 'below_limit' ? 'below_limit' : missing.length ? 'unknown' : comparison.state,
        missing, flatAdjustmentState: flat?.state || 'unknown', readinessAssessed: false };
}
module.exports = { compareDiameterScenario, assessFlatAdjustmentScenario };
