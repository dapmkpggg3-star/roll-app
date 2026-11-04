/* Planning review only. No production adapter, stock guarantee or notifications. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./preparation-forecast'));
    else root.RollRotationReservations = factory(root.RollPreparationForecast);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(dates) {
    'use strict';
    const text = value => typeof value === 'string' && value.trim() === value && value.length > 0;
    const keyFor = row => JSON.stringify([row.kind, row.resourceId]);

    // Each row is one continuous reservation, not one task or one calendar day.
    // Dates are inclusive. A shared boundary day requires shift/time review;
    // no implicit same-day release or replacement order is invented.
    function assessReservations({ asOf, reservations }) {
        const through = dates.horizonEnd(asOf);
        if (!Array.isArray(reservations)) throw new Error('ロール・チョックの使用予定が未取得です。空配列とは扱いません。');
        const ids = new Set(), issues = [], groups = new Map(), conflicts = [];
        let inWindow = 0;
        reservations.forEach((row, index) => {
            if (!row || !text(row.id) || ids.has(row.id)) throw new Error('使用予定IDが未設定または重複しています（行' + (index + 1) + '）。');
            ids.add(row.id);
            const missing = [];
            if (!['roll', 'chock'].includes(row.kind)) missing.push('対象種別');
            if (!text(row.resourceId)) missing.push('個体ID');
            if (!text(row.standId)) missing.push('スタンド');
            if (!text(row.planItemId)) missing.push('元の計画項目ID');
            if (!['confirmed', 'tentative'].includes(row.certainty)) missing.push('確定・仮予定の区別');
            if (!dates.validDate(row.from)) missing.push('拘束開始日');
            if (!dates.validDate(row.through)) missing.push('利用終了日');
            const validRange = dates.validDate(row.from) && dates.validDate(row.through) && row.from <= row.through;
            if (dates.validDate(row.from) && dates.validDate(row.through) && row.from > row.through) missing.push('利用期間の前後関係');
            if (validRange && (row.through < asOf || row.from > through)) return;
            inWindow++;
            if (missing.length) issues.push({ reservationId: row.id, missing,
                reason: '判定に必要な情報が不足：' + missing.join('、') });
            if (!validRange || !text(row.resourceId) || !['roll', 'chock'].includes(row.kind)) return;
            const key = keyFor(row);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ ...row, from: row.from < asOf ? asOf : row.from,
                through: row.through > through ? through : row.through });
        });
        for (const group of groups.values()) {
            const sorted = group.sort((a, b) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id));
            for (let i = 0; i < sorted.length; i++) {
                const a = sorted[i];
                for (let j = i + 1; j < sorted.length && sorted[j].from <= a.through; j++) {
                    const b = sorted[j];
                    const from = a.from > b.from ? a.from : b.from;
                    const end = a.through < b.through ? a.through : b.through;
                    const bothConfirmed = a.certainty === 'confirmed' && b.certainty === 'confirmed';
                    const kind = from === end ? 'same_day_review' : bothConfirmed ? 'confirmed_overlap' : 'unconfirmed_overlap';
                    const reservationIds = [a.id, b.id].sort();
                    conflicts.push({ id: JSON.stringify([a.kind, a.resourceId, ...reservationIds]), kind,
                        resourceKind: a.kind, resourceId: a.resourceId, reservationIds,
                        standIds: [...new Set([a.standId, b.standId])].filter(text).sort(),
                        planItemIds: [a.planItemId, b.planItemId].filter(text).sort(),
                        from, through: end, bothConfirmed,
                        reason: kind === 'same_day_review' ? '同じ日の使用が重複しています。交換・返却の直や時刻を確認してください。'
                            : bothConfirmed ? '同じ個体が複数の確定計画に重複しています。使用順または代替を確認してください。'
                                : '仮予定または確定区分未確認の計画を含む重複です。採用前に使用順と対象を確認してください。' });
                }
            }
        }
        conflicts.sort((a, b) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id));
        if (!inWindow) issues.push({ reservationId: null, missing: ['対象期間の使用予定'], reason: '対象期間の使用予定がないため、重複なしとは判定できません。' });
        return { asOf, through, scope: 'reservation-overlap-only', inWindow, conflicts, issues,
            state: conflicts.some(row => row.kind === 'confirmed_overlap') ? 'conflict'
                : conflicts.length || issues.length ? 'needs_review' : 'no_overlap_in_supplied_data',
            limitation: '入力された個体・期間の重複確認のみ。年間予定の網羅性、3セット維持、径・残カリバ・整備期間の適合は別途確認が必要です。' };
    }
    return { assessReservations };
});
