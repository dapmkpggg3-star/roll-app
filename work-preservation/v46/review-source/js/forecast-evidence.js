/* Pure evidence adapter. No data writes, inferred cycles, or readiness approval. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./preparation-forecast'));
    else root.RollForecastEvidence = factory(root.RollPreparationForecast);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(dates) {
    'use strict';
    const id = value => typeof value === 'string' && value.trim() === value && value.length > 0;
    function contextValid(input) {
        return id(input.rollId) && id(input.cycleId) && dates.validDate(input.asOf);
    }
    function confirmedActual(record, input) {
        return record && id(record.id) && id(record.source) && record.recordType === 'actual'
            && record.confirmed === true && dates.validDate(record.confirmedOn)
            && record.confirmedOn <= input.asOf && record.rollId === input.rollId
            && record.cycleId === input.cycleId;
    }
    function adaptUsageOpening(input) {
        const plan = input.plan;
        if (!plan || !Array.isArray(plan.calibers) || !plan.calibers.length || !Array.isArray(plan.periods))
            throw new Error('カリバと使用予定の一覧が必要です');
        const ids = new Set();
        const records = Array.isArray(input.actuals) ? input.actuals : [];
        const evidence = [];
        const calibers = plan.calibers.map(caliber => {
            if (!caliber || !id(caliber.id) || ids.has(caliber.id)) throw new Error('カリバIDが未設定または重複しています');
            ids.add(caliber.id);
            const missing = [];
            if (!contextValid(input)) missing.push('ロール・サイクル・基準日の確定');
            if (caliber.rollId !== input.rollId || caliber.cycleId !== input.cycleId)
                missing.push('計画カリバと実個体・サイクルの対応');
            const candidates = records.filter(r => r && r.rollId === input.rollId
                && r.cycleId === input.cycleId && r.caliberId === caliber.id);
            if (candidates.length !== 1) missing.push('一意なカリバ累計実績');
            const r = candidates.length === 1 ? candidates[0] : null;
            if (r && records.filter(other=>other && other.id===r.id).length!==1)
                missing.push('累計実績IDの重複');
            if (r && (!confirmedActual(r,input) || r.quantityKind !== 'cumulative'
                || r.asOf !== input.asOf || r.confirmedOn < r.asOf
                || !Number.isSafeInteger(r.runs) || r.runs < 0)) missing.push('基準日時点の確認済み累計実績と根拠');
            const runs = !missing.length ? r.runs : null;
            evidence.push({caliberId:caliber.id, state:missing.length?'unknown':'resolved',
                recordId:r && r.id || null, source:r && r.source || null, missing});
            // Never retain an unbound opening value supplied inside a plan.
            return {...caliber, openingUsedRuns:runs};
        });
        return {scope:'opening-usage-evidence-only',readinessAssessed:false,
            usageKnown:evidence.every(e=>e.state==='resolved'), evidence,
            plan:{...plan,calibers,periods:plan.periods.map(p=>({...p,caliberIds:Array.isArray(p.caliberIds)?[...p.caliberIds]:p.caliberIds}))}};
    }
    function assessMachiningEvidence(input) {
        const missing = [], review = input.review, measurement = input.measurement;
        if (!contextValid(input)) missing.push('ロール・サイクル・基準日の確定');
        if (!confirmedActual(review,input) || review.historyComplete !== true
            || review.reviewedThrough !== input.asOf || review.confirmedOn < review.reviewedThrough)
            missing.push('基準日までの加工履歴の照合根拠');
        const measurementValid = confirmedActual(measurement,input)
            && dates.validDate(measurement.measuredOn) && measurement.measuredOn <= input.asOf
            && measurement.confirmedOn >= measurement.measuredOn
            && typeof measurement.valueMm === 'number' && Number.isFinite(measurement.valueMm) && measurement.valueMm > 0;
        if (!measurementValid || !review || review.measurementId !== measurement.id)
            missing.push('今回の実測径と加工履歴の対応');
        const events = review && Array.isArray(review.events) ? review.events : [];
        if (!events.length) missing.push('今回サイクルの加工実績');
        const ids = new Set();
        for (const event of events) {
            if (!confirmedActual(event,input) || ids.has(event.id)
                || !['normal','flat_adjustment'].includes(event.kind)
                || !dates.validDate(event.completedOn) || event.completedOn > input.asOf
                || event.confirmedOn < event.completedOn || !measurementValid
                || event.completedOn > measurement.measuredOn || event.includedInMeasurement !== true) {
                missing.push('加工実績の区分・日付・重複・実測への反映');
            }
            if (event) ids.add(event.id);
        }
        const flats = events.filter(e=>e && e.kind==='flat_adjustment').length;
        if (!review || !['completed','pending','not_applicable'].includes(review.flatAdjustmentState)
            || (review.flatAdjustmentState==='completed' ? flats!==1 : flats!==0))
            missing.push('フラット加工の実施状態と履歴の対応');
        return {scope:'machining-history-evidence-only',readinessAssessed:false,
            machiningHistoryChecked:missing.length===0, state:missing.length?'unknown':'resolved',
            missing:[...new Set(missing)], measurementId:measurement && measurement.id || null,
            // Actual measured diameter already includes these events. Never deduct them again.
            additionalPastLossMm:null};
    }
    return {adaptUsageOpening,assessMachiningEvidence};
});
