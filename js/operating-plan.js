// Isolated operating-plan revisions. This file does not import real workbooks,
// contact Sheets, or change a physical roll's status.
const OPERATING_PLAN_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const PROVISIONAL_LEAD_TIME_MONTHS = 6;

function planMonthKey(standKey, month) {
    return `${String(standKey)}|${String(month)}`;
}

function finiteUseCount(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function createOperatingPlanRevision(input) {
    const source = input || {};
    if (!source.updatedAt || Number.isNaN(Date.parse(source.updatedAt))) {
        return { ok: false, reason: '更新日が不正です。' };
    }
    const targetMonths = Array.isArray(source.targetMonths) ? source.targetMonths.map(String) : [];
    if (targetMonths.length === 0 || targetMonths.some(month => !OPERATING_PLAN_MONTH.test(month))) {
        return { ok: false, reason: '対象月が不正です。' };
    }
    if (new Set(targetMonths).size !== targetMonths.length) {
        return { ok: false, reason: '対象月が重複しています。' };
    }
    const rows = [];
    for (const row of (Array.isArray(source.rows) ? source.rows : [])) {
        if (!row || row.status !== undefined) {
            return { ok: false, reason: '操業計画にロールのステータスは入れません。' };
        }
        if (row.productionTons !== undefined || row.productionAmount !== undefined || row.measure === 'tons') {
            return { ok: false, reason: '生産量のトン数はロールの本数として保存しません。' };
        }
        const standKey = String(row.standKey || '').trim();
        const month = String(row.month || '');
        if (!standKey || !targetMonths.includes(month)) {
            return { ok: false, reason: '計画行のスタンドまたは対象月が不正です。' };
        }
        const plannedUseCount = finiteUseCount(row.plannedUseCount);
        const actualUseCount = finiteUseCount(row.actualUseCount);
        if (plannedUseCount === undefined || actualUseCount === undefined) {
            return { ok: false, reason: '使用本数は0以上の数か未入力です。' };
        }
        rows.push({ standKey, month, plannedUseCount, actualUseCount });
    }
    return {
        ok: true,
        revision: {
            id: String(source.id || `plan-${Date.parse(source.updatedAt)}`),
            updatedAt: new Date(source.updatedAt).toISOString(),
            label: String(source.label || ''),
            targetMonths,
            rows
        }
    };
}

function saveOperatingPlanRevision(revisions, revision) {
    const next = Array.isArray(revisions) ? revisions.slice() : [];
    next.push(revision);
    return next;
}

function diffOperatingPlanRevisions(before, after) {
    const beforeRows = new Map((before && before.rows || []).map(row => [planMonthKey(row.standKey, row.month), row]));
    const afterRows = new Map((after && after.rows || []).map(row => [planMonthKey(row.standKey, row.month), row]));
    const changed = [];
    const added = [];
    const removed = [];
    afterRows.forEach((row, key) => {
        const previous = beforeRows.get(key);
        if (!previous) {
            added.push({ standKey: row.standKey, month: row.month });
            return;
        }
        ['plannedUseCount', 'actualUseCount'].forEach(field => {
            if (previous[field] !== row[field]) {
                changed.push({ standKey: row.standKey, month: row.month, field, before: previous[field], after: row[field] });
            }
        });
    });
    beforeRows.forEach((row, key) => {
        if (!afterRows.has(key)) removed.push({ standKey: row.standKey, month: row.month });
    });
    return { changed, added, removed };
}

function preferredUseCount(row) {
    if (!row) return null;
    return row.actualUseCount === null || row.actualUseCount === undefined ? row.plannedUseCount : row.actualUseCount;
}

function monthKeyFromDate(date) {
    const match = String(date || '').match(/^(\d{4}-\d{2})-\d{2}$/);
    return match && OPERATING_PLAN_MONTH.test(match[1]) ? match[1] : '';
}

function summarizeMonthlyProductionSchedule(schedule, referenceDate) {
    const reference = String(referenceDate || '').slice(0, 7);
    if (!OPERATING_PLAN_MONTH.test(reference)) {
        return { ok: false, reason: '基準日が不正です。' };
    }
    const byMonth = new Map();
    (Array.isArray(schedule) ? schedule : []).forEach(row => {
        const month = monthKeyFromDate(row && row.date);
        if (!month) return;
        if (!byMonth.has(month)) byMonth.set(month, []);
        byMonth.get(month).push(row);
    });
    const months = [...byMonth.keys()].sort().map(month => {
        const items = byMonth.get(month);
        const sizes = [...new Set(items.map(item => String(item.size || '').trim()).filter(Boolean))];
        let productionTons = 0;
        let tonsKnown = true;
        let operatingHours = 0;
        let hoursKnown = true;
        const shifts = new Set();
        items.forEach(item => {
            if (typeof item.productionAmount !== 'number' || !Number.isFinite(item.productionAmount)) tonsKnown = false;
            else productionTons += item.productionAmount;
            if (typeof item.operatingHours !== 'number' || !Number.isFinite(item.operatingHours)) hoursKnown = false;
            else operatingHours += item.operatingHours;
            if (item.shift1Team) shifts.add(`1直${item.shift1Team}`);
            if (item.shift3Team) shifts.add(`3直${item.shift3Team}`);
        });
        return {
            month,
            sizes,
            productionTons: tonsKnown ? productionTons : null,
            measure: 'tons',
            shifts: [...shifts],
            operatingHours: hoursKnown ? operatingHours : null,
            dayCount: items.length,
            classification: month < reference ? 'past' : month === reference ? 'current' : 'future'
        };
    });
    return {
        ok: true,
        kind: 'monthly-production-schedule',
        measure: 'tons',
        acceptedAsActual: false,
        acceptedAsAnnual: false,
        usableForShortage: false,
        months,
        reason: '月別の生産予定はトン数です。ロールの本数ではなく、年間計画でもありません。不足なしとは判定しません。'
    };
}

function linkProductionToConsumption(input) {
    const source = input || {};
    const blocked = (reason, gaps) => ({
        reworkTiming: 'unknown',
        purchaseTiming: 'unknown',
        rollUseCount: null,
        statusChanged: false,
        gaps,
        reason
    });
    const summary = source.schedule;
    if (!summary || summary.kind !== 'monthly-production-schedule') {
        return blocked('月別の生産予定がありません。改削時期と購入時期は判定できません。', ['生産予定']);
    }
    const months = Array.isArray(summary.months) ? summary.months : [];
    const future = months.filter(item => item.classification === 'future' || item.classification === 'current');
    if (!future.length) {
        return blocked('読み取った予定は過去の月です。これからの改削時期と購入時期には使いません。', ['これからの生産予定']);
    }
    const gaps = [];
    const standNumber = Number(source.standKey);
    const standTons = source.standTons && source.standTons.confirmed === true ? Number(source.standTons.tons) : null;
    const tonsPerRollUse = source.conversion && source.conversion.confirmed === true ? Number(source.conversion.tonsPerRollUse) : null;
    if (!Number.isFinite(standTons) || standTons < 0) gaps.push('スタンドごとの使用トン数');
    if (!Number.isFinite(tonsPerRollUse) || tonsPerRollUse <= 0) {
        const basis = knownTonBasis(standNumber);
        gaps.push(basis
            ? `${basisText(basis)}。工場全体の予定トン数は、このスタンドの使用量にしません`
            : 'カリバをどれだけ使うかの基準');
    }
    const sizes = [...new Set(future.flatMap(item => item.sizes || []))];
    if (sizes.length !== 1) gaps.push('サイズごとの専用カリバ');
    if (gaps.length) {
        return blocked(`換算根拠が不足しています。${gaps.join('、')}。改削時期と購入時期は判定できません。`, gaps);
    }
    return {
        reworkTiming: 'unknown',
        purchaseTiming: 'unknown',
        rollUseCount: standTons / tonsPerRollUse,
        statusChanged: false,
        gaps: ['消耗量と改削1回の対応'],
        reason: 'スタンドの使用トン数から、ロールを使う量の目安は計算できます。改削1回分との対応が未確認なので、改削時期と購入時期は判定できません。'
    };
}

function shiftUseFromHours(hours) {
    if (typeof hours !== 'number' || !Number.isFinite(hours)) return 'missing';
    if (hours >= 4) return 'full';
    if (hours < 2) return 'underTwo';
    return 'short';
}

function knownTonBasis(standKey) {
    const stand = Number(String(standKey || '').replace(/^#/, ''));
    const prescribed = {
        2: { tons: 14000, runs: 35 },
        3: { tons: 12000, runs: 30 },
        4: { tons: 15000, runs: 37 },
        5: { tons: 12500, runs: 31 }
    };
    if (prescribed[stand]) return { kind: '基準', stand, ...prescribed[stand] };
    if (stand === 6 || stand === 7) {
        return {
            kind: '現行', stand, runs: 15, tons: null,
            records: [
                { role: '現行', period: '本人回答', runs: 15, tons: null },
                { role: '主計算', period: '2026-08から2026-09', runs: null, tons: 6075 },
                { role: '旧参照', period: '2026-06から2026-07', runs: 19, tons: 7695 },
                { role: '過去概算', period: '過去の回答', runs: null, tons: 7600 }
            ]
        };
    }
    if (stand === 8 || stand === 9) {
        return {
            kind: '併記', stand,
            records: [
                { role: '主計算', period: '2026-09', runs: 13, tons: 5265 },
                { role: '過去概算', period: '過去の回答', runs: null, tons: 5000 }
            ]
        };
    }
    return null;
}

function formatTons(value) {
    return `${Number(value).toLocaleString('ja-JP')}t`;
}

function basisText(basis) {
    if (basis.kind === '基準') return `${basis.stand}番は規定${basis.runs}直、基準${formatTons(basis.tons)}です。規定直数と基準トン数は互いに換算せず、基準トン数は固定最大にしません。切込み量とは別です`;
    return basis.records.map(record => {
        const runs = record.runs === null ? '' : `${record.runs}直・`;
        return `${record.role}（${record.period}）${runs}${formatTons(record.tons)}`;
    }).join('、');
}

function futureReferenceDays(source) {
    const reference = String(source.referenceDate || '').slice(0, 10);
    return (Array.isArray(source.days) ? source.days : [])
        .filter(row => row && String(row.date || '') >= reference && (!source.caliberActiveUntil || row.date <= source.caliberActiveUntil));
}

function forecastReferenceReach(source, basis) {
    const empty = { shiftReachDate: null, tonReachDate: null, candidates: [], reason: '通過か飛ばすかが未確認なので、予定からは到達見込みと参考候補を出しません。' };
    if (source.standPass === 'skip') {
        return { ...empty, reason: 'この予定ではスタンドを飛ばすため、到達見込みと参考候補は出しません。' };
    }
    if (source.standPass !== 'pass') return empty;
    const days = futureReferenceDays(source);
    if (!days.length) {
        return { ...empty, reason: 'このスタンドを通る予定でも、基準日以降の予定が無いため到達見込みは出しません。' };
    }
    const parts = [];
    const candidates = [];
    const shift = forecastShiftReach(source, basis, days);
    parts.push(shift.reason);
    if (shift.candidate) candidates.push({ kind: '規定直数', date: shift.candidate });
    const ton = forecastTonReach(source, basis, days);
    parts.push(ton.reason);
    if (ton.candidate) candidates.push({ kind: '基準トン数', date: ton.candidate });
    return {
        shiftReachDate: shift.reach,
        tonReachDate: ton.reach,
        candidates,
        reason: `${parts.join('')}これは超過日でも改削日でも購入日でもありません。`
    };
}

function forecastShiftReach(source, basis, days) {
    const runs = source.openingUsedRuns;
    if (typeof runs !== 'number' || !Number.isInteger(runs) || runs < 0) {
        return { reach: null, candidate: null, reason: '開始直数が未確認なので、規定到達見込みは出しません。' };
    }
    const label = basis.kind === '現行' ? '現行' : '規定';
    if (runs >= basis.runs) {
        return { reach: null, candidate: null, reason: `開始時に${label}直数へ達しています。${label}到達の参考候補は出しません。` };
    }
    const beforeUnknown = [];
    let blocked = null;
    days.forEach(row => {
        if (blocked) return;
        const review = dayUseReview(row);
        if (review) {
            blocked = { date: row.date, kind: review };
            return;
        }
        beforeUnknown.push(row);
    });
    const rules = globalThis.RollPlanningRules;
    const scheduleApi = globalThis.RollPlanningSchedule;
    const calibers = globalThis.RollPlanningCalibers;
    if (!rules || !scheduleApi || !calibers) {
        return { reach: null, candidate: null, reason: '規定到達見込みを読み込めません。' };
    }
    const projected = calibers.projectCaliberChange(beforeUnknown, {
        equipmentId: `stand-${basis.stand}`,
        stands: [String(basis.stand)],
        size: '',
        maxRuns: basis.runs,
        usedRuns: runs,
        currentCaliber: source.currentCaliber || 'reference'
    }, {
        ruleEngine: rules.createPlanningRules({ afterProductionAllowedWorkTypes: [rules.WORK_TYPES.CALIBER_CHANGE] }),
        scheduleApi,
        slotTypes: rules.SLOT_TYPES,
        workTypes: rules.WORK_TYPES
    });
    const reach = projected.lastAllowedRun ? projected.lastAllowedRun.date : null;
    if (blocked && (!reach || blocked.date <= reach)) {
        return { reach: null, candidate: null, reason: `${blocked.date}は${blocked.kind}です。未確認の使用量を0直にしないため、${label}到達見込みは確定しません。` };
    }
    if (!reach) return { reach: null, candidate: null, reason: `この予定の範囲では${label}${basis.runs}直に達しません。` };
    const decision = describeWorkCandidate(label, reach, basis.stand, source, days);
    return { reach, candidate: decision.candidate, reason: `${label}${basis.runs}直への到達見込みは${reach}です。${decision.slotText}` };
}

function expectedWorkType(stand) {
    const number = Number(String(stand || '').replace(/^#/, ''));
    if (number >= 2 && number <= 5) return 'rollChange';
    if (number >= 6 && number <= 17) return 'caliberChange';
    return '';
}

function knownWorkEffort(stand, workType) {
    const number = Number(String(stand || '').replace(/^#/, ''));
    if ((number === 10 || number === 11) && workType === 'caliberChange') {
        return { people: 3, hours: 1, kind: '確認', source: '2026-09-05', text: '10番と11番のカリバ替は3人で経過1時間です。3人かける1時間を3時間にはしません。' };
    }
    if ((number === 10 || number === 11) && workType === 'rollChange') {
        return { people: 3, hours: 6, kind: '確認', source: '2026-09-05', text: '10番と11番のロール替は3人で経過6時間です。' };
    }
    if (number >= 12 && number <= 17 && workType === 'caliberChange') {
        return { people: 4, hours: 6, kind: '概算', source: '2026-09-05', text: '12番から17番のカリバ替は4人で6時間くらいです。確定値ではありません。' };
    }
    if (((number >= 2 && number <= 5) || number === 16 || number === 17) && workType === 'rollChange') {
        return { people: null, hours: null, low: 5, high: 6, kind: '旧一般', source: '2026-05-08', text: '2026-05-08の旧一般値は1スタンド5時間から6時間です。このスタンドの後日確定値ではありません。' };
    }
    if (number >= 6 && number <= 9 && workType === 'caliberChange') {
        return { people: null, hours: null, kind: '対象外', source: '2026-09-05', text: '10番と11番の1時間は6番から9番へ広げません。2026-05-08の4時間も、このスタンドの確認値ではありません。' };
    }
    return null;
}

function describeWorkCandidate(label, reach, stand, source, days) {
    const assessed = confirmedWorkCandidate(reach, stand, source && source.workConfirmation, days, source && source.referenceDate);
    const slotText = assessed.date
        ? `交換作業枠を確認できたため、${label}到達の参考候補は${assessed.date}です。${assessed.note}`
        : (assessed.note || `交換作業枠未確認のため、${label}到達の参考候補は出しません。`);
    return { candidate: assessed.date, slotText };
}

function confirmedWorkCandidate(reachDate, stand, confirmation, days, referenceDate) {
    const rules = globalThis.RollPlanningRules;
    const source = confirmation || {};
    const required = source.requiredHours;
    const reserved = source.reservedHours;
    const people = source.people;
    const expected = expectedWorkType(stand);
    const ready = Boolean(rules && reachDate && referenceDate && source.date
        && source.period === 'day'
        && source.workType === expected
        && typeof required === 'number' && Number.isFinite(required) && required > 0
        && typeof reserved === 'number' && Number.isFinite(reserved) && reserved >= required
        && typeof people === 'number' && Number.isInteger(people) && people > 0
        && source.continuous === 'no'
        && source.changeover === 'yes'
        && source.threeSet === 'yes');
    if (!ready) return { date: null, note: '' };
    if (!(String(source.date) < reachDate)) return { date: null, note: '' };
    if (String(source.date) < String(referenceDate).slice(0, 10)) {
        return { date: null, note: '作業日が基準日より前なので、参考候補は保留します。' };
    }
    const row = (Array.isArray(days) ? days : []).find(item => item && String(item.date).slice(0, 10) === String(source.date).slice(0, 10));
    if (!row) return { date: null, note: '作業日が操業予定と照合できないので、参考候補は保留します。' };
    const producing = Number(row.productionAmount) > 0;
    if (producing) return { date: null, note: '作業日が操業と重なるので、参考候補は保留します。' };
    const workType = expected === 'rollChange' ? rules.WORK_TYPES.ROLL_CHANGE : rules.WORK_TYPES.CALIBER_CHANGE;
    const allowed = rules.createPlanningRules({ afterProductionAllowedWorkTypes: [] }).validateWorkForSlot({
        type: workType,
        stands: [String(stand)]
    }, {
        type: rules.SLOT_TYPES.DAY_MAINTENANCE,
        shift: 'shift1',
        productionActive: producing
    }).allowed;
    if (!allowed) return { date: null, note: '作業枠の条件を確認できないので、参考候補は保留します。' };
    const known = knownWorkEffort(stand, expected);
    let note = known ? known.text : '';
    if (known && known.kind === '確認' && (people !== known.people || required !== known.hours)) {
        return { date: null, note: `${known.text}今回の人数または必要時間がその回答と違うため、参考候補は保留します。` };
    }
    if (known && known.kind === '概算' && required !== known.hours) note += '今回の必要時間はその概算と違います。';
    if (known && known.low && (required < known.low || required > known.high)) note += '今回の必要時間は旧一般値の範囲と違います。';
    return { date: source.date, note };
}

function forecastTonReach(source, basis, days) {
    const opening = source.openingUsedTons;
    if (basis.tons == null) {
        return { reach: null, candidate: null, reason: '基準トン数は固定最大として承認されていないため、トン数到達見込みは出しません。' };
    }
    if (typeof opening !== 'number' || !Number.isFinite(opening) || opening < 0) {
        return { reach: null, candidate: null, reason: '開始トン数が未確認なので、トン数到達見込みは出しません。' };
    }
    if (opening >= basis.tons) {
        return { reach: null, candidate: null, reason: '開始時に基準トン数へ達しています。トン数到達の参考候補は出しません。' };
    }
    let total = opening;
    let reach = null;
    let blocked = null;
    days.forEach(row => {
        if (reach || blocked) return;
        const amount = row.productionAmount;
        if (typeof amount !== 'number' || !Number.isFinite(amount)) {
            blocked = row.date;
            return;
        }
        if (amount === 0) return;
        total += amount;
        if (total >= basis.tons) reach = row.date;
    });
    if (blocked && !reach) {
        return { reach: null, candidate: null, reason: `${blocked}の生産量が未確認です。0tにしないため、トン数到達見込みは確定しません。` };
    }
    if (!reach) return { reach: null, candidate: null, reason: `この予定の範囲では基準${formatTons(basis.tons)}に達しません。` };
    const decision = describeWorkCandidate('トン数', reach, basis.stand, source, days);
    return { reach, candidate: decision.candidate, reason: `基準${formatTons(basis.tons)}への到達見込みは${reach}です。${decision.slotText}` };
}

function projectTonUse(input) {
    const source = input || {};
    const basis = knownTonBasis(source.standKey);
    if (!basis) return null;
    const tons = source.openingUsedTons;
    const tonsKnown = typeof tons === 'number' && Number.isFinite(tons) && tons >= 0;
    const base = {
        exchangeDate: null,
        exceedsOnDate: null,
        lastAllowedDate: null,
        reworkTiming: 'unknown',
        purchaseTiming: 'unknown',
        statusChanged: false,
        reviews: [],
        basis
    };
    if (basis.kind === '現行') {
        const runs = source.openingUsedRuns;
        const runsKnown = typeof runs === 'number' && Number.isInteger(runs) && runs >= 0;
        const runPlace = !runsKnown
            ? '開始時の使用直数は未確認です。0直にはしません'
            : `開始時は${runs}直で、現行${basis.runs}直${runs >= basis.runs ? 'に達しています' : 'より前です'}`;
        const forecast = forecastReferenceReach(source, basis);
        return {
            ...base,
            status: 'guideOnly',
            shiftReachDate: forecast.shiftReachDate,
            tonReachDate: forecast.tonReachDate,
            referenceCandidates: forecast.candidates,
            reason: `${basis.stand}番の現行使用直数は${basis.runs}直です。6,075tは原資料の主計算欄で、固定最大にはしません。19直・7,695tと過去概算7,600tは旧参照です。${runPlace}。${forecast.reason}交換日は出しません。`
        };
    }
    if (basis.kind === '併記') {
        const older = '原資料の13直・5,265tと、過去概算の約5,000tは別です。どちらも確定最大ではありません。';
        const unknownUse = typeof source.openingUsedTons !== 'number' ? '開始時の使用量が未確認でも0tにはせず、' : '';
        return {
            ...base,
            status: 'unknown',
            reason: `${basis.stand}番の資料は${basisText(basis)}です。${older}${unknownUse}交換日は出しません。`
        };
    }
    if (basis.kind === '基準') {
        const runs = source.openingUsedRuns;
        const runsKnown = typeof runs === 'number' && Number.isInteger(runs) && runs >= 0;
        const tonPlace = !tonsKnown
            ? '開始時の使用トン数は未確認です。0tにはしません'
            : `開始時は${formatTons(tons)}で、基準${formatTons(basis.tons)}${tons >= basis.tons ? 'に達しています' : 'より前です'}`;
        const runPlace = !runsKnown
            ? '開始時の使用直数は未確認です。0直にはしません'
            : `開始時は${runs}直で、規定${basis.runs}直${runs >= basis.runs ? 'に達しています' : 'より前です'}`;
        const forecast = forecastReferenceReach(source, basis);
        return {
            ...base,
            status: 'guideOnly',
            shiftReachDate: forecast.shiftReachDate,
            tonReachDate: forecast.tonReachDate,
            referenceCandidates: forecast.candidates,
            reason: `${basisText(basis)}。${tonPlace}。${runPlace}。${forecast.reason}`
        };
    }
    if (!tonsKnown) {
        return { ...base, status: 'unknown', reason: `${basisText(basis)}。開始時の使用トン数が未確認なので、0tにはせず交換日は出しません。` };
    }
    if (basis.kind === '最大') {
        const remaining = basis.tons - tons;
        const reason = remaining > 0
            ? `開始時は${formatTons(tons)}です。最大${formatTons(basis.tons)}まで残り${formatTons(remaining)}です。工場全体の予定トン数はこのスタンドの使用量ではないため、交換日は出しません。`
            : `開始時は${formatTons(tons)}で、1カリバの最大${formatTons(basis.tons)}に達しています。工場全体の予定からは交換日を出せません。`;
        return { ...base, status: remaining > 0 ? 'withinMaximum' : 'atMaximum', reason };
    }
    if (basis.kind === '概算') {
        const reached = tons >= basis.tons;
        return {
            ...base,
            status: 'guideOnly',
            reason: reached
                ? `開始時は${formatTons(tons)}で、概算${formatTons(basis.tons)}の目安に達しています。確定最大は未確認のため、超過日と交換日は出しません。`
                : `開始時は${formatTons(tons)}で、概算${formatTons(basis.tons)}の目安より前です。確定最大は未確認です。交換日は出しません。`
        };
    }
    return { ...base, status: 'unknown', reason: 'このスタンドのトン数基準を確認できません。交換日は出しません。' };
}

function knownCaliberLimit(standKey, size) {
    const stand = String(standKey || '').replace(/^#/, '');
    const normalized = String(size || '').normalize('NFKC').toUpperCase().replace(/\s+/g, '');
    const table = {
        '10': { runs: 8, kind: '最大' },
        '11': { runs: 8, kind: '最大' },
        '12': { runs: 11, kind: '通常' },
        '13|D10': { runs: 6, kind: '通常' },
        '13|D13': { runs: 12, kind: '最大' },
        '14|D10': { runs: 5, kind: '通常' },
        '14|D13': { runs: 7, kind: '最大' },
        '15|D10': { runs: 5, kind: '通常' },
        '15|D13': { runs: 7, kind: '最大' },
        '16|D10': { runs: 13, kind: '最大' },
        '16|D13': { runs: 14, kind: '最大' },
        '17|D10': { runs: 6, kind: '最大' },
        '17|D13': { runs: 6, kind: '最大' }
    };
    return table[stand] || table[`${stand}|${normalized}`] || null;
}

function dayUseReview(row) {
    const amount = row ? row.productionAmount : undefined;
    const teams = [row && row.shift1Team, row && row.shift3Team].filter(Boolean);
    if (amount === null || amount === undefined) return '生産量未確認';
    const produced = amount > 0 || teams.some(team => row.productionByTeam && Number(row.productionByTeam[team]) > 0);
    if (!produced) return '';
    const use = shiftUseFromHours(row.operatingHours);
    if (use === 'missing') return '時間未確認';
    if (use === 'underTwo') return '2時間未満';
    if (use === 'short') return '2時間以上4時間未満';
    if (teams.length > 1) return '勤ごとの時間';
    return '';
}

function projectCaliberReplacement(input) {
    const source = input || {};
    const reference = String(source.referenceDate || '').slice(0, 10);
    const days = (Array.isArray(source.days) ? source.days : [])
        .filter(row => row && String(row.date || '') >= reference && (!source.caliberActiveUntil || row.date <= source.caliberActiveUntil));
    const tonUse = projectTonUse(source);
    if (tonUse) return tonUse;
    const limit = knownCaliberLimit(source.standKey, source.size);
    const base = {
        exchangeDate: null,
        exceedsOnDate: null,
        lastAllowedDate: null,
        reworkTiming: 'unknown',
        purchaseTiming: 'unknown',
        statusChanged: false,
        reviews: []
    };
    if (!limit) {
        return { ...base, status: 'unknown', reason: 'このスタンドとサイズの直数上限は、通常・最大・例外を分けて記録されていません。' };
    }
    if (!days.length) {
        return { ...base, status: 'past', reason: `読み取った予定は過去の月です。これからの交換日には使いません。${source.standKey}番の${limit.kind}は${limit.runs}直、4時間以上は1直です。` };
    }
    if (!source.currentCaliber || typeof source.openingUsedRuns !== 'number' || !Number.isInteger(source.openingUsedRuns) || source.openingUsedRuns < 0) {
        return { ...base, status: 'unknown', reason: `今のカリバと、開始時に何直使ったかが未確認です。${limit.kind}は${limit.runs}直、4時間以上は1直です。` };
    }
    const beforeUnknown = [];
    let blocked = null;
    days.forEach(row => {
        if (blocked) return;
        const review = dayUseReview(row);
        if (review) {
            blocked = { date: row.date, kind: review };
            return;
        }
        beforeUnknown.push(row);
    });
    const rules = globalThis.RollPlanningRules;
    const scheduleApi = globalThis.RollPlanningSchedule;
    const calibers = globalThis.RollPlanningCalibers;
    if (!rules || !scheduleApi || !calibers) {
        return { ...base, status: 'unknown', reason: 'カリバ予測を読み込めません。' };
    }
    const projected = calibers.projectCaliberChange(beforeUnknown, {
        equipmentId: `stand-${source.standKey}`,
        stands: [String(source.standKey)],
        size: source.size || '',
        maxRuns: limit.runs,
        usedRuns: source.openingUsedRuns,
        currentCaliber: source.currentCaliber,
        nextCaliber: source.nextCaliber,
        caliberSequence: source.caliberSequence
    }, {
        ruleEngine: rules.createPlanningRules({ afterProductionAllowedWorkTypes: [rules.WORK_TYPES.CALIBER_CHANGE] }),
        scheduleApi,
        slotTypes: rules.SLOT_TYPES,
        workTypes: rules.WORK_TYPES
    });
    const guideOrExceedDate = projected.firstOverLimitRun ? projected.firstOverLimitRun.date : null;
    const projectedLastAllowed = projected.lastAllowedRun ? projected.lastAllowedRun.date : null;
    const slotDate = projected.recommendation ? projected.recommendation.date : null;
    const unknownIsAfterDecision = Boolean(blocked && guideOrExceedDate && blocked.date > guideOrExceedDate);
    const confirmedMaximum = limit.kind === '最大';
    const exchangeDate = confirmedMaximum && (unknownIsAfterDecision || !blocked) ? slotDate : null;
    const exceedsOnDate = confirmedMaximum && !(blocked && !unknownIsAfterDecision) ? guideOrExceedDate : null;
    const lastAllowedDate = confirmedMaximum ? projectedLastAllowed : null;
    let reason;
    if (blocked && !unknownIsAfterDecision) {
        reason = `${blocked.date}は${blocked.kind}です。未確認の使用量を0直にしないため、この先の交換日と超過日は確定しません。`;
        if (blocked.kind === '2時間以上4時間未満') {
            reason += 'この時間を1直と数える案は提案のままです。確定した交換日には使わず、実際の時間は別に残します。';
        }
    } else if (!confirmedMaximum) {
        reason = guideOrExceedDate
            ? `${guideOrExceedDate}は通常${limit.runs}直の目安に達する見込みです。確定最大は未確認のため、交換候補日と超過日は出しません。`
            : `この予定の範囲では通常${limit.runs}直の目安に達しません。確定最大は未確認です。4時間以上を1直として数えています。`;
    } else if (!exceedsOnDate) {
        reason = `この予定の範囲では最大${limit.runs}直を超えません。4時間以上を1直として数えています。`;
    } else if (exchangeDate) {
        reason = `交換候補は${exchangeDate}です。${exceedsOnDate}の操業は最大${limit.runs}直を超えます。これは改削日でも購入日でもありません。`;
    } else {
        reason = `止まれる日が無いため、交換候補日は出しません。上限内の最終操業は${lastAllowedDate || 'なし'}、上限を超える操業は${exceedsOnDate}です。`;
    }
    if (blocked && unknownIsAfterDecision) {
        reason += confirmedMaximum
            ? `${blocked.date}は${blocked.kind}ですが、確定済みの交換候補より後です。`
            : `${blocked.date}は${blocked.kind}ですが、通常目安の見込みより後です。`;
    }
    return {
        exchangeDate,
        exceedsOnDate,
        lastAllowedDate,
        status: blocked && !unknownIsAfterDecision ? 'needsReview' : (confirmedMaximum ? (exchangeDate ? projected.status : 'noSafeSlot') : 'guideOnly'),
        reviews: blocked ? [blocked] : [],
        limit,
        reworkTiming: 'unknown',
        purchaseTiming: 'unknown',
        statusChanged: false,
        reason
    };
}

function forecastThreeSetFromPlan(input) {
    const unknown = reason => ({ purchase: 'unknown', rework: 'unknown', shortage: 'unknown', totalUseCount: null, reason });
    const source = input || {};
    const revision = source.revision;
    if (revision && (revision.kind === 'monthly-production-schedule' || revision.measure === 'tons')) {
        return unknown('月別の生産予定はトン数です。ロールの本数ではないため、不足なしとは判定しません。');
    }
    if (!Number.isFinite(Number(source.remainingCutCount))) {
        return unknown('改削残回数が未確認です。');
    }
    if (!revision || !Array.isArray(revision.targetMonths) || revision.targetMonths.length < 12) {
        return unknown('年間計画の対象月が12か月分ありません。');
    }
    const rows = (revision.rows || []).filter(row => String(row.standKey) === String(source.standKey));
    if (rows.length < revision.targetMonths.length) {
        return unknown('対象月の計画行が足りません。');
    }
    let totalUseCount = 0;
    for (const month of revision.targetMonths) {
        const row = rows.find(item => item.month === month);
        const useCount = preferredUseCount(row);
        if (useCount === null || useCount === undefined || !Number.isFinite(Number(useCount))) {
            return unknown('計画または実績が未入力です。直近は実績を優先します。');
        }
        totalUseCount += Number(useCount);
    }
    if (!source.leadTime || source.leadTime.status !== 'confirmed') {
        return {
            purchase: 'unknown',
            rework: 'unknown',
            shortage: 'unknown',
            totalUseCount,
            reason: '購入リードタイムが暫定のため、確定判定はしません。3セットはロール3本のことではありません。'
        };
    }
    return {
        purchase: 'unknown',
        rework: 'unknown',
        shortage: 'unknown',
        totalUseCount,
        remainingCutCount: Number(source.remainingCutCount),
        reason: '数量は集計できましたが、本数と改削回数の業務上の換算は未確定のため判定不能です。3セットはロール3本のことではありません。'
    };
}

function describeRemainingCalibers(standKey, size, openingRuns) {
    const limit = knownCaliberLimit(standKey, size);
    if (!limit || limit.kind !== '最大') return '残カリバ直数は、確定した最大が無いので出しません。0直にはしません。';
    if (typeof openingRuns !== 'number' || !Number.isFinite(openingRuns)) {
        return `最大${limit.runs}直は確認しています。開始直数が未確認なので、残カリバ直数は出しません。`;
    }
    const left = limit.runs - openingRuns;
    if (left < 0) return `開始直数は最大${limit.runs}直を超えています。残カリバは0直にはしません。`;
    return `残カリバは最大${limit.runs}直まであと${left}直です。ロール本数ではありません。`;
}

function describeReworkDemand(source) {
    const current = source.currentDiameter;
    const scrap = source.scrapDiameter;
    const cut = source.cutMm;
    const missing = value => value === undefined || value === null || value === '' || !Number.isFinite(Number(value));
    if (missing(current) || missing(scrap) || missing(cut)) {
        return '現在径、廃却径、切込みのどれかが未確認です。改削残回数は0回にしません。';
    }
    const currentDiameter = Number(current);
    const scrapDiameter = Number(scrap);
    const cutMm = Number(cut);
    if (!(cutMm > 0)) return '切込みが確認できないので、改削残回数は出しません。';
    const remainingDiameter = currentDiameter - scrapDiameter;
    if (remainingDiameter <= 0) return '現在径は廃却径以下です。改削残回数は購入需要にしません。';
    let count = Math.floor(remainingDiameter / cutMm);
    if (typeof getRemainingDiameterInfo === 'function') {
        try {
            const info = getRemainingDiameterInfo({ name: `#${source.standKey || ''}`, currentDiameter });
            if (info && info.scrapDiameter === scrapDiameter && info.adoptedCutMm === cutMm && Number.isFinite(info.remainingCutCount)) {
                count = info.remainingCutCount;
            }
        } catch (error) {
            count = Math.floor(remainingDiameter / cutMm);
        }
    }
    return `残り径は${remainingDiameter}mm、改削残回数は${count}回です。改削日にはしません。`;
}

function describeSpareReadiness(spareCount) {
    if (spareCount === undefined || spareCount === null || spareCount === '') {
        return '使用できる予備本数は未確認です。不足なしにはしません。';
    }
    const count = Number(spareCount);
    if (!Number.isInteger(count) || count < 0) return '予備本数を確認できないので、不足なしにはしません。';
    if (count === 0) return '使用できる予備は0本です。準備不足の可能性は残しますが、不足の確定にはしません。';
    return `使用できる予備は${count}本です。年間の必要本数が未確認なので、不足なしにはしません。`;
}

function describeLongHorizon(summary, standKey) {
    const months = summary && Array.isArray(summary.months) ? summary.months : [];
    const future = months.filter(item => item && (item.classification === 'future' || item.classification === 'current'));
    const stored = readStandLeadTime(standKey);
    const lead = stored || { months: PROVISIONAL_LEAD_TIME_MONTHS, status: 'provisional' };
    const leadText = lead.status === 'confirmed'
        ? `購入までの期間は確認済み${lead.months}か月です。期間だけでは不足なしにしません。`
        : `購入までの期間は暫定${lead.months}か月です。暫定は購入日にも不足なしにもしません。`;
    const span = `これからの予定は${future.length}か月です。`;
    if (future.length < 12) {
        return `${span}12か月以上の廃却需要と購入需要は判定不能です。年間必要本数は別表を待たず、確認できた使用回数から計算します。今の予定はトン数なので本数にはしません。${leadText}`;
    }
    return `${span}12か月分あっても生産トン数はロール本数ではありません。年間必要本数は別表が無くても、トン数だけでは計算しません。${leadText}`;
}

function describeLifeChain(source) {
    const input = source || {};
    const caliber = input.caliber || {};
    const hasDemand = Boolean(caliber.exchangeDate) || (Array.isArray(caliber.referenceCandidates) && caliber.referenceCandidates.length > 0);
    const demand = hasDemand
        ? '交換の参考需要は上の日付です。改削日にも購入日にもしません。'
        : '交換の参考需要は未確認です。改削日にはしません。';
    return [
        '3セットはロール3本のことではありません。',
        describeRemainingCalibers(input.standKey, input.size, input.openingUsedRuns),
        demand,
        describeReworkDemand(input),
        describeSpareReadiness(input.spareCount),
        describeLongHorizon(input.schedule, input.standKey)
    ].join('\n');
}

function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function addDays(date, days) {
    const parts = String(date).slice(0, 10).split('-').map(Number);
    const next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
    return next.toISOString().slice(0, 10);
}

function addMonths(date, months) {
    const parts = String(date).slice(0, 10).split('-').map(Number);
    const next = new Date(Date.UTC(parts[0], parts[1] - 1 + months, parts[2]));
    return next.toISOString().slice(0, 10);
}

function anonymousOperatingDays(start, dayCount) {
    const days = [];
    for (let index = 0; index < dayCount; index += 1) {
        const stopped = index % 3 === 2;
        days.push({
            date: addDays(start, index),
            productionAmount: stopped ? 0 : 10,
            operatingHours: stopped ? 0 : 8,
            shift1Team: 'A',
            shift3Team: ''
        });
    }
    return days;
}

function exchangeSlotReady(confirmation, row, expectedType) {
    const source = confirmation || {};
    const date = String(row && row.date || '').slice(0, 10);
    const repeat = source.repeatOnStops === true;
    if (!repeat && String(source.date || '').slice(0, 10) !== date) return false;
    const types = Array.isArray(source.workTypes) ? source.workTypes : [source.workType];
    if (!types.includes(expectedType)) return false;
    if (source.period !== 'day') return false;
    if (Number(row.productionAmount) !== 0) return false;
    if (row.shift3Team && !row.shift1Team) return false;
    const required = source.requiredHours;
    const reserved = source.reservedHours;
    const people = source.people;
    if (!(typeof required === 'number' && Number.isFinite(required) && required > 0)) return false;
    if (!(typeof reserved === 'number' && Number.isFinite(reserved) && reserved >= required)) return false;
    if (!(typeof people === 'number' && Number.isInteger(people) && people > 0)) return false;
    return source.continuous === 'no' && source.changeover === 'yes' && source.threeSet === 'yes';
}

function assemblySlotReady(confirmation, row) {
    const source = confirmation || {};
    const date = String(row && row.date || '').slice(0, 10);
    const repeat = source.repeatOnStops === true;
    if (!repeat && !source.date) return { ok: false, reason: '組替作業枠が未確認です。0tだけでは完了にしません。' };
    if (!repeat && String(source.date).slice(0, 10) !== date) return { ok: false, reason: 'この日の組替作業枠がありません。0tだけでは完了にしません。' };
    if (source.period !== 'day') return { ok: false, reason: '昼の組替枠が未確認です。夜だけでは完了にしません。' };
    if (Number(row.productionAmount) !== 0) return { ok: false, reason: '操業中は組替を完了にしません。' };
    if (row.shift3Team && !row.shift1Team) return { ok: false, reason: '夜勤だけでは組替を完了にしません。' };
    if (!row.shift1Team) return { ok: false, reason: '勤務が未確認です。0tだけでは組替を完了にしません。' };
    const required = source.requiredHours;
    const reserved = source.reservedHours;
    const people = source.people;
    if (!(typeof required === 'number' && Number.isFinite(required) && required > 0)) return { ok: false, reason: '組替の必要時間が未確認です。' };
    if (!(typeof reserved === 'number' && Number.isFinite(reserved) && reserved >= required)) return { ok: false, reason: '組替の確保時間が足りません。短い枠では完了にしません。' };
    if (!(typeof people === 'number' && Number.isInteger(people) && people > 0)) return { ok: false, reason: '組替の人数が未確認です。' };
    if (source.prepared !== 'reworkInbound' && source.prepared !== 'newSide') {
        return { ok: false, reason: '準備の種類が未確認です。発注や改削見込日数だけでは準備にしません。' };
    }
    if (!String(source.preparedTarget || '').trim()) return { ok: false, reason: '確認した対象が未入力です。発注や見込日数だけでは準備にしません。' };
    if (!String(source.preparedOn || '').slice(0, 10)) return { ok: false, reason: '確認した日が未入力です。発注や見込日数だけでは準備にしません。' };
    return { ok: true, reason: '' };
}

function simulateExchangeCycle(input) {
    const source = input || {};
    const days = (Array.isArray(source.days) ? source.days : [])
        .map(row => Object.assign({}, row))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const resources = Array.isArray(source.resources) ? source.resources.map(item => Object.assign({}, item)) : null;
    const spareCalibers = Array.isArray(source.spareCaliberIds) ? source.spareCaliberIds.slice() : null;
    const knownSpare = finiteOrNull(source.installedSpare);
    const spareRolls = Array.isArray(source.spareRollIds)
        ? source.spareRollIds.slice()
        : (resources
            ? resources.filter(item => item.frame === 'installedSpare').map(item => item.id)
            : null);
    const state = {
        onlineId: (resources && (resources.find(item => item.frame === 'online') || {}).id) || source.onlineRollId || 'anon-online',
        caliberId: source.currentCaliberId || (resources && (resources.find(item => item.frame === 'online') || {}).caliberId) || null,
        caliberRuns: finiteOrNull(source.openingRuns) === null && resources && resources.find(item => item.frame === 'online')
            ? finiteOrNull(resources.find(item => item.frame === 'online').runs)
            : finiteOrNull(source.openingRuns),
        diameter: resources && resources.find(item => item.frame === 'online')
            ? finiteOrNull(resources.find(item => item.frame === 'online').diameter)
            : finiteOrNull(source.currentDiameter),
        scrapDiameter: finiteOrNull(source.scrapDiameter),
        cutMm: finiteOrNull(source.adoptedCutMm),
        phase: 'operating',
        pending: null,
        reworks: []
    };
    const events = [];
    const maxRuns = finiteOrNull(source.maxRuns);
    let blocked = false;
    let confirmedThrough = null;
    let stopRecord = null;
    const push = (date, kind, note) => events.push({
        date, kind, note,
        caliberId: state.caliberId,
        caliberRuns: state.caliberRuns,
        spareCaliberCount: spareCalibers ? spareCalibers.length : null,
        diameter: state.diameter,
        installedSpare: spareRolls ? spareRolls.length : null,
        onlineId: state.onlineId,
        phase: state.phase
    });
    if (state.caliberRuns === null || maxRuns === null || !state.caliberId) {
        return {
            events, rollChangeCount: null, scrapCount: null, annualRollCount: null, statusChanged: false,
            reason: '開始直数、最大直数、カリバのどれかが未確認です。0直にはしません。'
        };
    }
    const markConfirmed = date => { confirmedThrough = date; };
    const stopAt = (date, reason) => {
        stopRecord = { date, id: state.onlineId, reason };
        blocked = true;
    };
    const finishReworkItem = (date, item) => {
        if (!item || item.status !== 'rework') return;
        const target = resources && resources.find(entry => entry.id === item.id);
        const targetDiameter = target ? finiteOrNull(target.diameter) : (!resources ? state.diameter : null);
        if (state.cutMm === null || targetDiameter === null) {
            item.status = 'held';
            push(date, '改削保留', `再生対象は${item.id}です。採用改削量が未確認なので、径は変えず、予備へも戻しません。`);
            return;
        }
        const nextDiameter = Math.round((targetDiameter - state.cutMm) * 10) / 10;
        if (target) target.diameter = nextDiameter;
        if (!resources || target && target.frame === 'online') state.diameter = nextDiameter;
        item.status = 'awaitingAssembly';
        push(date, '改削完了', `再生対象は${item.id}です。径は${nextDiameter}です。改削日数の試算であり、搬入と組替の完了ではありません。`);
        if (state.scrapDiameter !== null && nextDiameter <= state.scrapDiameter) {
            item.status = 'scrap';
            const leadMonths = finiteOrNull(source.leadMonths);
            const leadStatus = source.leadStatus === 'confirmed' ? '確認済み' : '暫定';
            const conditional = leadMonths === null ? '' : `${leadStatus}${leadMonths}か月を戻した条件付きの手配目安は${addMonths(date, -leadMonths)}です。`;
            const missingLead = leadMonths === null ? '購入期間が未確認なので、手配目安は出しません。0か月にはしません。' : conditional;
            push(date, '廃却需要', `対象は${item.id}です。廃却径以下です。${missingLead}確定の購入日ではありません。`);
        }
    };
    const finishDueReworks = date => {
        state.reworks.filter(item => item.status === 'rework' && date >= item.readyOn)
            .forEach(item => finishReworkItem(date, item));
    };
    const finishAssembly = date => {
        if (!spareRolls) return;
        const waiting = state.reworks.filter(item => item.status === 'awaitingAssembly');
        if (!waiting.length) return;
        const preparation = source.assemblyConfirmation || {};
        const preparationLabel = preparation.prepared === 'newSide' ? '新品側の準備' : '改削済ロールの搬入';
        push(date, '組替可能', `${preparation.preparedOn || '日未確認'}に${preparation.preparedTarget || '対象未確認'}の${preparationLabel}を確認しました。これは組替完了そのものではなく、予測であり実ロールの状態は変えていません。`);
        waiting.forEach(item => {
            push(date, '搬入', `改削済の${item.id}を組替場所へ入れました。まだ使用可能な予備ではありません。`);
            if (resources) {
                const returning = resources.find(entry => entry.id === item.id);
                if (returning) returning.frame = 'installedSpare';
            }
            spareRolls.push(item.id);
            item.status = 'done';
            push(date, '組替完了', `昼間の組替枠で${item.id}の組替を終えました。`);
            push(date, '使用可能予備', `${item.id}は夜勤開始までに使用可能な予備です。本数は増やしていません。`);
        });
    };
    const holdAssembly = (date, row) => {
        const waiting = state.reworks.filter(item => item.status === 'awaitingAssembly');
        if (!waiting.length) return false;
        const slot = assemblySlotReady(source.assemblyConfirmation, row);
        if (slot.ok) {
            finishAssembly(date);
            return true;
        }
        push(date, '組替需要', `${waiting.map(item => item.id).join('、')}は組替前です。${slot.reason}`);
        return false;
    };
    const nightOnly = row => Boolean(row.shift3Team) && !row.shift1Team;
    days.forEach(row => {
        if (blocked) return;
        const date = String(row.date).slice(0, 10);
        const amount = row.productionAmount;
        if (typeof amount !== 'number' || !Number.isFinite(amount)) {
            push(date, '保留', '生産量が未確認です。0tにはしません。');
            stopAt(date, '生産量が未確認です。0tにはしません。');
            return;
        }
        const stopped = amount === 0;
        finishDueReworks(date);
        if (stopped && state.reworks.some(item => item.status === 'awaitingAssembly')) {
            if (nightOnly(row)) {
                const ids = state.reworks.filter(item => item.status === 'awaitingAssembly').map(item => item.id).join('、');
                push(date, '夜勤予備不足', `${ids}の組替が夜勤までに終わっていません。使用可能な予備にはしません。`);
                markConfirmed(date);
                return;
            }
            holdAssembly(date, row);
        }
        if (stopped && state.pending && state.phase === 'operating') {
            const expected = state.pending === 'caliber' ? 'caliberChange' : 'rollChange';
            if (!exchangeSlotReady(source.workConfirmation, row, expected)) {
                push(date, '交換需要', '到達しています。0tや夜間、未確認の作業枠だけでは交換しません。');
                markConfirmed(date);
                return;
            }
            if (state.pending === 'caliber' && spareCalibers && spareCalibers.length) {
                state.caliberId = spareCalibers.shift();
                state.caliberRuns = 0;
                state.pending = null;
                push(date, 'カリバ替', '確認できた昼の作業枠でカリバを替えました。径と改削回数は変えていません。');
                markConfirmed(date);
                return;
            }
            if (state.pending === 'roll') {
                const reworkDays = finiteOrNull(source.reworkDays);
                if (!spareRolls || spareRolls.length === 0 || reworkDays === null) {
                    const unnamed = !resources && !Array.isArray(source.spareRollIds) && knownSpare !== null;
                    push(date, 'ロール替需要', unnamed
                        ? '予備の本数だけでは交換できるロールが分かりません。架空のIDは作りません。'
                        : '予備がないか、改削日数が未確認なので、ロール替は成立させていません。');
                    markConfirmed(date);
                    return;
                }
                const leavingId = state.onlineId;
                const unfinished = state.reworks.filter(item => item.status === 'rework' || item.status === 'awaitingAssembly' || item.status === 'held');
                if (unfinished.length && spareRolls.length <= 1) {
                    push(date, 'ロール替需要', `再生中の${unfinished.map(item => item.id).join('、')}が未完了です。${leavingId}を重ねると夜勤の使用可能な予備がなくなるので、交換は成立させません。`);
                    markConfirmed(date);
                    return;
                }
                const enteringId = spareRolls[0];
                const entering = resources && resources.find(item => item.id === enteringId);
                if (resources && (!entering || !entering.caliberId)) {
                    push(date, 'ロール替需要', '交換先のカリバが未確認です。前のカリバは使いません。');
                    stopAt(date, '交換先のカリバが未確認です。前のカリバは使いません。');
                    return;
                }
                const enteringRuns = entering ? finiteOrNull(entering.runs) : null;
                if (resources && enteringRuns === null) {
                    push(date, 'ロール替需要', '交換先の開始直数が未確認です。0直にはしません。');
                    stopAt(date, '交換先の開始直数が未確認です。0直にはしません。');
                    return;
                }
                const currentRework = { id: leavingId, readyOn: addDays(date, reworkDays), status: 'rework' };
                state.reworks.push(currentRework);
                if (resources) {
                    const leaving = resources.find(item => item.id === leavingId);
                    if (leaving) leaving.frame = 'rework';
                    entering.frame = 'online';
                    state.diameter = finiteOrNull(entering.diameter);
                    state.caliberId = entering.caliberId;
                    state.caliberRuns = enteringRuns;
                } else {
                    state.caliberRuns = 0;
                }
                state.onlineId = spareRolls.shift();
                state.pending = null;
                push(date, 'ロール替', '組込済みの予備をオンラインへ移し、外した対象を再生へ入れました。この時点では径を変えません。');
                if (date >= currentRework.readyOn) finishReworkItem(date, currentRework);
                if (currentRework.status === 'awaitingAssembly' && nightOnly(row)) {
                    push(date, '夜勤予備不足', `${currentRework.id}の組替が夜勤までに終わっていません。使用可能な予備にはしません。`);
                } else if (currentRework.status === 'awaitingAssembly') holdAssembly(date, row);
                markConfirmed(date);
                return;
            }
        }
        if (stopped && nightOnly(row) && spareRolls && spareRolls.length === 0) {
            push(date, '夜勤予備不足', '昼間の組替が終わる前です。夜勤に使用可能な予備はありません。');
            markConfirmed(date);
            return;
        }
        if (stopped) {
            markConfirmed(date);
            return;
        }
        if (row.shift3Team && spareRolls && spareRolls.length === 0) {
            const reworkIds = state.reworks
                .filter(item => item.status === 'rework' || item.status === 'awaitingAssembly' || item.status === 'held')
                .map(item => item.id);
            const reworkNote = reworkIds.length
                ? `再生中の${reworkIds.join('、')}は使用可能な予備に数えません。`
                : '使用可能な予備は0です。';
            push(date, '夜勤予備不足', `夜勤の開始時点です。操業中は${state.onlineId || '未確認'}です。${reworkNote}`);
        }
        const hours = row.operatingHours;
        if (typeof hours !== 'number' || !Number.isFinite(hours)) {
            push(date, '保留', '使用時間が未確認です。0直にはしません。');
            stopAt(date, '使用時間が未確認です。0直にはしません。');
            return;
        }
        if (hours < 4) {
            push(date, '保留', '4時間未満は1直にしません。未確認の短時間のあと、後続の直数は確定しません。');
            stopAt(date, '4時間未満は1直にしません。未確認の短時間のあと、後続の直数は確定しません。');
            return;
        }
        if (state.caliberRuns + 1 > maxRuns) {
            state.pending = spareCalibers && spareCalibers.length ? 'caliber' : 'roll';
            push(date, '交換待ち', '連続操業の途中では交換しません。次の停止枠を待ちます。');
            markConfirmed(date);
            return;
        }
        state.caliberRuns += 1;
        push(date, '操業', `${state.caliberId}の使用は${state.caliberRuns}直です。`);
        if (state.caliberRuns >= maxRuns) state.pending = spareCalibers && spareCalibers.length ? 'caliber' : 'roll';
        markConfirmed(date);
    });
    const rollChangeCount = events.filter(item => item.kind === 'ロール替').length;
    const scrapCount = events.filter(item => item.kind === '廃却需要').length;
    const first = days[0] && String(days[0].date).slice(0, 10);
    const last = days.length ? String(days[days.length - 1].date).slice(0, 10) : '';
    const longEnough = !stopRecord && first && last && confirmedThrough && confirmedThrough >= addMonths(first, 13);
    const coverage = [
        first ? `対象期間は${first}から${last}です。` : '対象期間は未確認です。',
        confirmedThrough ? `確定して計算できた最終日は${confirmedThrough}です。` : '確定して計算できた最終日はありません。',
        stopRecord ? `${stopRecord.date}に${stopRecord.id || '対象未確認'}を止めました。理由は${stopRecord.reason}` : '',
        stopRecord
            ? '最初の保留より後は計算済みにしません。13か月の範囲まで計算したことにはしません。不足なしとは判定しません。'
            : (longEnough
                ? '13か月の範囲まで同じ計算を繰り返しました。不足なしとは判定しません。'
                : '確認できた期間の交換は上に出します。13か月全体の不足なしは判定できません。')
    ].filter(Boolean).join('');
    return {
        events,
        rollChangeCount,
        scrapCount,
        annualRollCount: rollChangeCount,
        resources,
        statusChanged: false,
        confirmedThrough,
        stopRecord,
        reason: `${coverage}ロール替の回数は再利用の交換です。新規購入の本数にはしません。生産トン数からも数えません。`
    };
}

function standNumberFromName(name) {
    const match = String(name || '').normalize('NFKC').trim().match(/#?(\d+)(?:-|$)/);
    return match ? String(Number(match[1])) : '';
}

function pairedStandKeys(standKey, size) {
    const stand = String(standKey || '').replace(/^#/, '').trim();
    if (!stand) return [];
    const sizeKey = String(size || '').normalize('NFKC').toUpperCase().replace(/\s+/g, '');
    const partner = { '6': '7', '7': '6', '8': '9', '9': '8', '10': '11', '11': '10', '14': '15', '15': '14' }[stand];
    if (partner) return [stand, partner];
    if ((stand === '12' || stand === '13') && sizeKey === 'D13') return ['12', '13'];
    if ((stand === '16' || stand === '17') && sizeKey === 'D10') return ['16', '17'];
    return [stand];
}

function ledgerFrame(status) {
    if (status === 'オンライン') return 'online';
    if (status === '新品予備（組込完了）') return 'installedSpare';
    if (status === '中古予備（バラシ前）' || status === '中古予備') return 'usedSpare';
    return 'other';
}

function withSavedOpenings(resources, standKey, size, referenceAt) {
    if (!Array.isArray(resources)) return [];
    return resources.map(item => {
        const saved = recallForecastSetting({ rollId: item.id, standKey, size, referenceAt }).value;
        const next = Object.assign({}, item);
        if (saved && saved.caliberId) next.caliberId = saved.caliberId;
        if (saved && saved.openingRuns !== null && saved.openingRuns !== undefined) next.runs = saved.openingRuns;
        return next;
    });
}

function readLedgerResources(list, selection) {
    if (!Array.isArray(list)) return [];
    const keys = selection ? pairedStandKeys(selection.standKey, selection.size) : null;
    return list.filter(item => {
        if (!item || !item.id) return false;
        if (!keys) return true;
        return keys.includes(standNumberFromName(item.name || item.id));
    }).map(item => {
        const diameter = finiteOrNull(Number(item.currentDiameter));
        const runs = finiteOrNull(Number(item.openingRuns));
        return {
            id: String(item.id),
            standKey: standNumberFromName(item.name || item.id),
            frame: ledgerFrame(item.status),
            diameter: item.currentDiameter === undefined || item.currentDiameter === null || item.currentDiameter === '' ? null : diameter,
            caliberId: item.currentCaliber || null,
            runs: item.openingRuns === undefined || item.openingRuns === null || item.openingRuns === '' ? null : runs
        };
    });
}

function forecastLead(standKey) {
    if (anonymousForecastCheck) {
        const field = typeof document !== 'undefined' ? document.getElementById('lead-time-months') : null;
        const months = field && String(field.value).trim() !== '' ? Number(field.value) : PROVISIONAL_LEAD_TIME_MONTHS;
        if (!Number.isFinite(months) || months <= 0) return { months: null, status: 'unknown' };
        return { months, status: 'provisional' };
    }
    return readStandLeadTime(standKey) || defaultStandLeadTime(standKey);
}

function describeSetOutlook(result, label) {
    const prefix = label || 'この計算では';
    if (!result) return '';
    const events = result.events || [];
    const nights = events.filter(item => item.kind === '夜勤予備不足');
    const scraps = events.filter(item => item.kind === '廃却需要');
    const lines = [];
    if (nights.length) {
        const operating = nights.map(item => item.onlineId || '未確認').join('、');
        lines.push(`${prefix}、夜勤の開始時点で使用可能な予備が無い日は${nights.map(item => item.date).join('、')}です。操業中は${operating}です。原因は${nights[0].note}必要な対応は、その夜勤の前に昼の組替で使用可能な予備を戻すことです。`);
    }
    scraps.forEach(item => {
        lines.push(`${prefix}、廃却による補充需要は${item.date}です。${item.note}夜勤の予備不足とは別の項目です。`);
    });
    if (result.stopRecord) {
        lines.push([
            `${prefix}、3つの運用枠をいつまで保てるかは未確認です。`,
            `計算できた最終日は${result.confirmedThrough || 'ありません'}。`,
            `止めた対象は${result.stopRecord.id || '未確認'}です。理由は${result.stopRecord.reason}`,
            'それより前に出た不足は残します。未知の値は0や試験値で埋めていません。'
        ].join(''));
    }
    if (!lines.length) {
        const returned = events.some(item => item.kind === '使用可能予備');
        return returned
            ? `${prefix}、昼の組替のあと予備へ戻しています。3つの運用枠が足りなくなる日は、この期間には出ていません。不足なしの確定ではありません。`
            : `${prefix}、運用枠が足りなくなる日は出ていません。期間の外は未確認です。不足なしの確定ではありません。`;
    }
    return lines.join('');
}

function describeReplenishment(result, label) {
    const scraps = ((result && result.events) || []).filter(item => item.kind === '廃却需要');
    const later = result && result.stopRecord ? '停止日より後の補充需要は未確認です。' : 'この範囲の外は年間計画にしていません。';
    if (!scraps.length) return `${label}は、計算できた範囲に廃却がありません。0本にはしません。${later}トン数やロール替の回数からは出しません。`;
    const lines = scraps.map(item => `${item.date} ${item.note}`);
    return `${label}は廃却した対象ごとです。トン数やロール替の回数からは出しません。\n${lines.join('\n')}\n${later}`;
}

let exchangeCycleRenderGeneration = 0;

function renderExchangeCycle() {
    const generation = ++exchangeCycleRenderGeneration;
    const target = document.getElementById('cycle-result');
    if (!target || typeof simulateExchangeCycle !== 'function' || typeof readCaliberInputs !== 'function') return;
    const form = readCaliberInputs();
    const schedule = latestMonthlySummary && latestMonthlySummary.ok !== false ? latestMonthlySummary : null;
    const days = schedule && Array.isArray(schedule.days) ? schedule.days : [];
    const ledgerKeys = pairedStandKeys(form.standKey, form.size);
    const ledgerSource = anonymousForecastCheck ? anonymousCheckLedger() : (typeof roles === 'undefined' ? [] : roles);
    const ledger = readLedgerResources(ledgerSource, { standKey: form.standKey, size: form.size });
    const selectedStand = String(form.standKey || '').replace(/^#/, '').trim();
    const referenceAt = activeForecastReference(form, schedule);
    const fileReference = schedule ? String(schedule.referenceDate || '').slice(0, 10) : '';
    const cycleResources = withSavedOpenings(
        ledger.filter(item => item.standKey === selectedStand && item.frame !== 'other'),
        form.standKey,
        form.size,
        referenceAt
    );
    const chosen = cycleResources.find(item => item.id === form.forecastRoll);
    const online = form.forecastRoll
        ? (chosen && chosen.frame === 'online' ? chosen : null)
        : cycleResources.find(item => item.frame === 'online');
    const openingRuns = form.forecastRoll && form.openingUsedRuns !== undefined
        ? form.openingUsedRuns
        : (form.openingUsedRuns === undefined ? (online ? online.runs : undefined) : form.openingUsedRuns);
    const openingSource = form.openingUsedRuns === undefined
        ? (online && typeof online.runs === 'number' ? '保存した開始直数' : '未確認')
        : '画面の入力';
    const ledgerText = [
        !form.standKey
            ? 'スタンドが未選択なので、台帳の対象は混ぜません。'
            : `対象スタンドは${ledgerKeys.join('・')}です。${ledger.length
                ? ledger.map(item => `${item.frame} ${item.id} 径${item.diameter === null ? '未確認' : item.diameter}`).join('、')
                : 'このスタンドの対象は台帳にありません。他のスタンドは混ぜません。'}計算に使うのは${selectedStand || '未選択'}番です。`,
        describeRemainingCalibers(form.standKey, form.size, openingRuns),
        `開始直数の出どころは${openingSource}です。未使用のカリバ本数ではありません。`,
        `予測設定は${forecastSettingKey({ rollId: form.forecastRoll || (online && online.id), standKey: form.standKey, size: form.size, referenceAt })}です。別のスタンド・サイズ・ロール・基準時点へは流用しません。予備の本数からはカリバIDを作りません。`
    ].join('\n');
    const limit = knownCaliberLimit(form.standKey, form.size);
    const line = item => `${item.date} ${item.kind} ${item.note}`;
    let scheduleText = '生産予定が無いので、架空の操業では予測しません。';
    let scheduleResult = null;
    const countedDays = days.filter(row => !referenceAt || String(row.date || '').slice(0, 10) >= referenceAt);
    const skippedBefore = days.length - countedDays.length;
    const referenceLine = `予測の基準日は${referenceAt || '未設定'}です。予定資料の基準日は${fileReference || '未設定'}です。画面で選んだ予測の基準日を、予定ファイルの日付では上書きしません。`;
    const skippedLine = skippedBefore ? `基準日より前の操業${skippedBefore}日は開始量へ足していません。` : '';
    const workUse = usableSlot(form.workConfirmation, workSlotOwner, {
        standKey: selectedStand, rollId: online ? online.id : form.forecastRoll, size: form.size, referenceAt
    }, true);
    const assemblyUse = usableSlot(form.assemblyConfirmation, assemblySlotOwner, {
        standKey: selectedStand, size: form.size, referenceAt
    }, false);
    if (form.forecastRoll && !online) {
        scheduleText = '選んだロールはこのスタンドのオンラインではないので、状態は変えず交換もしません。';
    } else if (countedDays.length) {
        const result = simulateExchangeCycle({
            maxRuns: limit && limit.kind === '最大' ? limit.runs : undefined,
            openingRuns,
            currentCaliberId: form.currentCaliber || (online && online.caliberId) || null,
            spareCaliberIds: null,
            scrapDiameter: form.scrapDiameter,
            adoptedCutMm: form.cutMm,
            reworkDays: form.reworkDays,
            leadMonths: forecastLead(form.standKey).months,
            leadStatus: forecastLead(form.standKey).status,
            workConfirmation: workUse.slot,
            assemblyConfirmation: assemblyUse.slot,
            resources: cycleResources,
            days: countedDays
        });
        scheduleResult = result;
        const uncovered = result.reason.includes('13か月全体の不足なしは判定できません')
            ? '読み込んだ予定が13か月に満たない範囲は、不足なしにしません。'
            : '';
        scheduleText = [
            `読込予定に基づく結果です。予定「${schedule.sourceName || '名前なし'}」で計算しています。架空の操業日は足していません。`,
            describeSetOutlook(result, 'この読込予定では'),
            describeReplenishment(result, 'この読込予定の補充需要'),
            result.reason,
            uncovered,
            describeCycleTimeline(result),
            result.events.map(line).join('\n')
        ].filter(Boolean).join('\n');
    } else if (days.length) {
        scheduleText = '基準日以降の予定が無いので、開始量へは足していません。';
    }
    const banner = anonymousForecastCheck
        ? '匿名の確認です。値は試験用です。実台帳は読んでいません。端末へは保存しません。実設備の径は読みません。予測は実ロールの状態を変えません。仮の13か月は購入不足の判定ではありません。'
        : '';
    target.textContent = [banner, referenceLine, skippedLine, describeCheckFocus(cycleResources, scheduleResult), scheduleText, workUse.note, assemblyUse.note, ledgerText, describeAnonymousHorizon(form, online, cycleResources, limit)].filter(Boolean).join('\n');
    loadStandPremisesNote(target, form.standKey, generation);
}

function describeCheckFocus(resources, result) {
    const list = Array.isArray(resources) ? resources : [];
    const names = frame => list.filter(item => item.frame === frame).map(item => item.id).join('、') || '未確認';
    const change = result && result.events && result.events.find(item => item.kind === 'ロール替');
    return [
        `交換前のオンラインは${names('online')}、組込済み予備は${names('installedSpare')}です。`,
        change
            ? `交換後は${change.onlineId || '未確認'}のカリバ${change.caliberId || '未確認'}、開始${change.caliberRuns === null || change.caliberRuns === undefined ? '未確認' : change.caliberRuns}です。相手自身の値です。`
            : '交換はまだ成立していません。',
        '使用可能な予備になるのは、昼の組替が成立したあとだけです。',
        '未確認と予備不足は、組替需要・夜勤予備不足・保留の行に対象と理由を出します。'
    ].join('\n');
}

function describeAnonymousHorizon(form, online, resources, limit) {
    if (!form.forecastRoll || !form.forecastReference || !online) {
        return '予測対象ロールまたは基準日が未選択なので、匿名の13か月は出しません。';
    }
    const work = form.workConfirmation || {};
    const assembly = form.assemblyConfirmation || {};
    const assemblyReady = Boolean(assembly.date) && assembly.period === 'day'
        && (assembly.prepared === 'reworkInbound' || assembly.prepared === 'newSide')
        && Boolean(String(assembly.preparedTarget || '').trim()) && Boolean(String(assembly.preparedOn || '').slice(0, 10))
        && typeof assembly.requiredHours === 'number' && assembly.requiredHours > 0
        && typeof assembly.reservedHours === 'number' && assembly.reservedHours >= assembly.requiredHours
        && Number.isInteger(assembly.people) && assembly.people > 0;
    const confirmed = work.period === 'day'
        && typeof work.requiredHours === 'number' && work.requiredHours > 0
        && typeof work.reservedHours === 'number' && work.reservedHours >= work.requiredHours
        && Number.isInteger(work.people) && work.people > 0
        && work.continuous === 'no' && work.changeover === 'yes' && work.threeSet === 'yes';
    const result = simulateExchangeCycle({
        maxRuns: limit && limit.kind === '最大' ? limit.runs : undefined,
        openingRuns: online.runs,
        currentCaliberId: online.caliberId,
        spareCaliberIds: null,
        scrapDiameter: form.scrapDiameter,
        adoptedCutMm: form.cutMm,
        reworkDays: form.reworkDays,
        leadMonths: forecastLead(form.standKey).months,
        leadStatus: forecastLead(form.standKey).status,
        workConfirmation: confirmed ? Object.assign({}, work, { repeatOnStops: true, workTypes: ['caliberChange', 'rollChange'] }) : work,
        resources,
        assemblyConfirmation: assemblyReady ? Object.assign({}, form.assemblyConfirmation, { repeatOnStops: true }) : form.assemblyConfirmation,
        days: anonymousOperatingDays(form.forecastReference, 400)
    });
    return [
        '仮の13か月シナリオです。読込予定そのものではありません。',
        '匿名の13か月です。読み込んだ予定の日ではありません。読込予定の未確認は埋めていません。',
        describeSetOutlook(result, '仮の13か月では'),
        describeReplenishment(result, '仮の13か月の補充需要'),
        result.reason,
        describeCycleTimeline(result),
        confirmed ? '' : '作業枠が未確認なので、匿名の13か月でも交換は成立させません。'
    ].filter(Boolean).join('\n');
}

function describeCycleTimeline(result) {
    const wanted = ['交換待ち', 'ロール替', 'カリバ替', '改削完了', '組替需要', '組替可能', '搬入', '組替完了', '使用可能予備', '夜勤予備不足', 'ロール替需要', '交換需要', '改削保留', '廃却需要', '保留'];
    const events = result.events || [];
    const picked = [];
    let showUse = false;
    for (const item of events) {
        if (wanted.includes(item.kind)) {
            picked.push(item);
            showUse = item.kind === 'ロール替';
        } else if (showUse && item.kind === '操業') {
            picked.push(item);
            showUse = false;
        }
        if (picked.length >= 12) break;
    }
    const firstHold = events.find(item => item.kind === '保留');
    if (firstHold && !picked.includes(firstHold)) picked.push(firstHold);
    const lines = picked.map(item => `${item.date} ${item.kind} ${item.note} カリバ${item.caliberId || '未確認'} 開始${item.caliberRuns === null || item.caliberRuns === undefined ? '未確認' : item.caliberRuns}`);
    const hidden = events.filter(item => !picked.includes(item));
    const countKind = kind => hidden.filter(item => item.kind === kind).length;
    const changes = result && result.rollChangeCount;
    const countLine = changes === null
        ? 'ロール替の回数は未確認です。0回にはしません。'
        : (result.stopRecord
            ? `ロール替${changes}回は、確定できた期間の再利用です。このあとは未確認です。期間全体の回数にはしません。`
            : `ロール替${changes}回は再利用です。新規購入の本数ではありません。`);
    return [
        countLine,
        '暫定6か月を戻した時期は確定の購入日ではありません。',
        lines.join('\n') || '日付順の交換はまだ出ていません。',
        hidden.length ? `表示は先頭${picked.length}件です。全体は${events.length}件。後続の保留${countKind('保留')}件、夜勤予備不足${countKind('夜勤予備不足')}件、ロール替需要${countKind('ロール替需要')}件。` : ''
    ].filter(Boolean).join('\n');
}

async function loadStandPremisesNote(target, standKey, generation) {
    if (anonymousForecastCheck) return;
    if (typeof fetch !== 'function') return;
    const selectedStand = String(standKey || '').replace(/^#/, '').trim();
    const isCurrent = () => generation === exchangeCycleRenderGeneration
        && document.getElementById('cycle-result') === target
        && String((readCaliberInputs() || {}).standKey || '').replace(/^#/, '').trim() === selectedStand;
    try {
        const response = await fetch('local/stand-premises.json');
        if (!response.ok) throw new Error('missing');
        const data = await response.json();
        if (!isCurrent()) return;
        const row = selectedStand && data && data.diametersMm && data.diametersMm[selectedStand];
        const extra = row
            ? `${selectedStand}番の新品時は${row.newDiameter}mm、廃却径は${row.scrapDiameter}mmです。現在の実測径ではありません。`
            : `${selectedStand || '選択'}番の径はローカル仕様で未確認です。他スタンドの径は代用しません。`;
        target.textContent += `\n既回答の径はローカル仕様から読みました。${extra}`;
    } catch (error) {
        if (!isCurrent()) return;
        target.textContent += '\n径のローカル仕様は未読込です。本人未回答ではありません。';
    }
}

function normalizeStandLeadTime(input) {
    const standKey = String(input && input.standKey || '').trim();
    const months = Number(input && input.months);
    if (!standKey || !Number.isFinite(months) || months <= 0) {
        return { ok: false, reason: 'スタンドとリードタイムを確認してください。' };
    }
    const status = input && input.status === 'confirmed' ? 'confirmed' : 'provisional';
    return { ok: true, value: { standKey, months, status } };
}

function defaultStandLeadTime(standKey) {
    return { standKey: String(standKey), months: PROVISIONAL_LEAD_TIME_MONTHS, status: 'provisional' };
}

function readOperatingPlanState() {
    try {
        const parsed = JSON.parse(localStorage.getItem('operating_plan_revisions_v1') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function readStandLeadTimes() {
    try {
        const parsed = JSON.parse(localStorage.getItem('stand_lead_times_v1') || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

function readStandLeadTime(standKey) {
    const stored = readStandLeadTimes()[String(standKey)];
    return stored || null;
}

let latestMonthlySummary = null;
let activeForecastContext = null;
let applyingForecastSetting = false;

function forecastSettingKey(input) {
    const source = input || {};
    const stand = String(source.standKey || '').replace(/^#/, '').trim();
    const size = String(source.size || '').normalize('NFKC').toUpperCase().replace(/\s+/g, '');
    const rollId = String(source.rollId || '').trim();
    const reference = String(source.referenceAt || '').slice(0, 10);
    return [rollId || 'ロール未選択', stand || 'スタンド未選択', size || 'サイズ未選択', reference || '基準時点未設定'].join('|');
}

let anonymousForecastCheck = false;

function setAnonymousForecastCheck(value) {
    anonymousForecastCheck = Boolean(value);
}
let anonymousEntryActive = false;
let anonymousForecastMemory = {};

function anonymousCheckLedger() {
    return [
        { id: 'anon-online', name: '#10-A', status: 'オンライン', currentDiameter: 81, currentCaliber: 'anon-cal-a', openingRuns: 7 },
        { id: 'anon-spare', name: '#10-B', status: '新品予備（組込完了）', currentDiameter: 93, currentCaliber: 'anon-cal-b', openingRuns: 2 },
        { id: 'anon-used', name: '#10-C', status: '中古予備（バラシ前）', currentDiameter: 74, currentCaliber: 'anon-cal-c', openingRuns: 0 }
    ];
}

function anonymousCheckSummary() {
    const day = (date, amount, hours, shift1, shift3) => ({
        date, productionAmount: amount, operatingHours: hours, shift1Team: shift1, shift3Team: shift3, size: 'D10'
    });
    return {
        ok: true,
        sourceName: '試験用の匿名予定',
        referenceDate: '2027-04-01',
        days: [
            day('2027-04-01', 10, 8, 'A', ''),
            day('2027-04-02', 0, 0, 'A', ''),
            day('2027-04-03', 0, 0, '', 'B'),
            day('2027-04-04', 0, 0, 'A', '')
        ],
        months: [{ month: '2027-04', classification: 'future', productionTons: null, operatingHours: null, sizes: ['D10'], shifts: ['A'] }],
        reason: '試験用の匿名予定です。読込済みの予定ファイルではありません。'
    };
}

function setAnonymousField(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value;
}

function applyAnonymousScene(scene) {
    if (!anonymousForecastCheck) return;
    applyingForecastSetting = true;
    setAnonymousField('assembly-period', scene === 'empty' ? '' : 'day');
    setAnonymousField('assembly-required-hours', scene === 'empty' ? '' : '5');
    setAnonymousField('assembly-reserved-hours', scene === 'short' ? '1' : (scene === 'empty' ? '' : '5'));
    setAnonymousField('assembly-people', scene === 'empty' ? '' : '1');
    setAnonymousField('assembly-prepared', scene === 'empty' ? '' : 'reworkInbound');
    setAnonymousField('assembly-prepared-target', scene === 'empty' ? '' : 'anon-online');
    setAnonymousField('assembly-prepared-on', scene === 'empty' ? '' : '2027-04-01');
    setAnonymousField('assembly-date', scene === 'ready' || scene === 'short' ? '2027-04-04' : '');
    applyingForecastSetting = false;
    rememberAssemblySlotOwner();
    renderExchangeCycle();
}

function isAnonymousEntryOpen() {
    return anonymousEntryActive;
}

function openAnonymousEntry() {
    anonymousEntryActive = true;
    const dedicated = typeof location !== 'undefined' && /anonymous-check\.html$/.test(String(location.pathname || ''));
    if (!dedicated && typeof location !== 'undefined' && typeof location.assign === 'function') {
        location.assign('anonymous-check.html');
        return;
    }
    startAnonymousForecastCheck();
}

function anonymousExampleSummary(kind) {
    const day = (date, amount, hours, shift1, shift3) => ({
        date, productionAmount: amount, operatingHours: hours, shift1Team: shift1, shift3Team: shift3, size: 'D10'
    });
    const base = { ok: true, referenceDate: '2027-04-01', months: [{ month: '2027-04', classification: 'future', productionTons: null, operatingHours: null, sizes: ['D10'], shifts: ['A'] }] };
    if (kind === 'unknown') {
        return Object.assign({}, base, {
            sourceName: '試験用の未確認予定',
            days: [day('2027-04-01', 10, 3, 'A', '')],
            reason: '試験用です。4時間未満を0直や1直にはしていません。'
        });
    }
    if (kind === 'ready') {
        return Object.assign({}, base, {
            sourceName: '試験用の間に合う予定',
            days: [day('2027-04-01', 10, 8, 'A', ''), day('2027-04-02', 0, 0, 'A', ''), day('2027-04-03', 0, 0, 'A', '')],
            reason: '試験用です。読込予定そのものではありません。'
        });
    }
    return Object.assign({}, base, {
        sourceName: '試験用の不足予定',
        days: [day('2027-04-01', 10, 8, 'A', ''), day('2027-04-02', 0, 0, 'A', ''), day('2027-04-03', 0, 0, '', 'B')],
        reason: '試験用です。夜勤の前に予備が戻らない例です。'
    });
}

function applyAnonymousExample(kind) {
    if (!anonymousForecastCheck) return;
    applyingForecastSetting = true;
    setAnonymousField('forecast-roll', 'anon-online');
    setAnonymousField('life-scrap', kind === 'short' ? '77' : '70');
    setAnonymousField('life-cut', '4');
    setAnonymousField('life-diameter', '81');
    setAnonymousField('cycle-rework-days', '1');
    setAnonymousField('lead-time-months', '6');
    setAnonymousField('lead-time-status', 'provisional');
    const assembly = kind === 'ready';
    setAnonymousField('assembly-period', assembly ? 'day' : '');
    setAnonymousField('assembly-required-hours', assembly ? '5' : '');
    setAnonymousField('assembly-reserved-hours', assembly ? '5' : '');
    setAnonymousField('assembly-people', assembly ? '1' : '');
    setAnonymousField('assembly-prepared', assembly ? 'reworkInbound' : '');
    setAnonymousField('assembly-prepared-target', assembly ? 'anon-online' : '');
    setAnonymousField('assembly-prepared-on', assembly ? '2027-04-01' : '');
    setAnonymousField('assembly-date', assembly ? '2027-04-03' : '');
    applyingForecastSetting = false;
    rememberWorkSlotOwner();
    rememberAssemblySlotOwner();
    latestMonthlySummary = anonymousExampleSummary(kind);
    renderMonthlyScheduleSummary(latestMonthlySummary);
}

function startAnonymousForecastCheck() {
    anonymousForecastCheck = true;
    beginScheduleRead();
    applyingForecastSetting = true;
    anonymousForecastMemory = {};
    activeForecastContext = null;
    latestMonthlySummary = anonymousCheckSummary();
    setAnonymousField('caliber-stand', '10');
    setAnonymousField('caliber-size', 'D10');
    setAnonymousField('forecast-roll', '');
    setAnonymousField('forecast-reference', '2027-04-01');
    setAnonymousField('caliber-current', 'anon-cal-a');
    setAnonymousField('caliber-opening', '7');
    setAnonymousField('caliber-opening-tons', '');
    setAnonymousField('work-date', '2027-04-02');
    setAnonymousField('work-period', 'day');
    setAnonymousField('work-reserved-hours', '5');
    setAnonymousField('work-type', 'rollChange');
    setAnonymousField('work-required-hours', '5');
    setAnonymousField('work-people', '1');
    setAnonymousField('work-continuous', 'no');
    setAnonymousField('work-changeover', 'yes');
    setAnonymousField('work-three-set', 'yes');
    setAnonymousField('cycle-rework-days', '1');
    setAnonymousField('life-diameter', '81');
    setAnonymousField('life-scrap', '70');
    setAnonymousField('life-cut', '4');
    ['assembly-date', 'assembly-period', 'assembly-reserved-hours', 'assembly-required-hours', 'assembly-people', 'assembly-prepared', 'assembly-prepared-target', 'assembly-prepared-on'].forEach(id => setAnonymousField(id, ''));
    applyingForecastSetting = false;
    rememberWorkSlotOwner();
    rememberAssemblySlotOwner();
    renderMonthlyScheduleSummary(latestMonthlySummary);
    syncForecastSettingContext();
}

function readForecastSettings() {
    if (anonymousForecastCheck) return anonymousForecastMemory;
    try {
        const parsed = JSON.parse(localStorage.getItem('caliber_forecast_settings_v1') || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

function blankForecastAmount(value) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function rememberForecastSetting(input) {
    const source = input || {};
    const key = forecastSettingKey(source);
    const stored = readForecastSettings();
    stored[key] = {
        caliberId: String(source.caliberId || '').trim(),
        openingRuns: blankForecastAmount(source.openingRuns),
        openingTons: blankForecastAmount(source.openingTons)
    };
    if (anonymousForecastCheck) return { key, value: stored[key] };
    localStorage.setItem('caliber_forecast_settings_v1', JSON.stringify(stored));
    return { key, value: stored[key] };
}

function recallForecastSetting(input) {
    const key = forecastSettingKey(input);
    const value = readForecastSettings()[key];
    return { key, value: value || null };
}

function currentForecastContext() {
    const form = readCaliberInputs();
    const selected = String(form.standKey || '').replace(/^#/, '').trim();
    const ledger = readLedgerResources(anonymousForecastCheck ? anonymousCheckLedger() : (typeof roles === 'undefined' ? [] : roles), { standKey: form.standKey, size: form.size });
    const online = ledger.find(item => item.standKey === selected && item.frame === 'online');
    const chosen = typeof document !== 'undefined' && document.getElementById('forecast-roll');
    const referenceField = typeof document !== 'undefined' && document.getElementById('forecast-reference');
    const reference = referenceField && referenceField.value ? referenceField.value : '';
    return {
        rollId: chosen && chosen.value.trim() ? chosen.value.trim() : (online ? online.id : ''),
        standKey: selected,
        size: form.size,
        referenceAt: reference || ''
    };
}

function writeForecastFields(value) {
    if (typeof document === 'undefined') return;
    applyingForecastSetting = true;
    const caliber = document.getElementById('caliber-current');
    const runs = document.getElementById('caliber-opening');
    const tons = document.getElementById('caliber-opening-tons');
    const stored = value || {};
    if (caliber) caliber.value = stored.caliberId || '';
    if (runs) runs.value = stored.openingRuns === null || stored.openingRuns === undefined ? '' : String(stored.openingRuns);
    if (tons) tons.value = stored.openingTons === null || stored.openingTons === undefined ? '' : String(stored.openingTons);
    applyingForecastSetting = false;
}

function applyForecastContextChange(previous, next, snapshot) {
    if (!previous) return { context: next, value: recallForecastSetting(next).value };
    if (forecastSettingKey(previous) === forecastSettingKey(next)) {
        return { context: next, value: rememberForecastSetting(Object.assign({}, next, snapshot)).value };
    }
    rememberForecastSetting(Object.assign({}, previous, snapshot));
    return { context: next, value: recallForecastSetting(next).value };
}

function syncForecastSettingContext() {
    if (typeof document === 'undefined' || applyingForecastSetting) return null;
    const next = currentForecastContext();
    const previous = activeForecastContext;
    const form = readCaliberInputs();
    const snapshot = { caliberId: form.currentCaliber || '', openingRuns: form.openingUsedRuns, openingTons: form.openingUsedTons };
    const changed = applyForecastContextChange(previous, next, snapshot);
    if (!previous) {
        if (changed.value) writeForecastFields(changed.value);
    } else if (forecastSettingKey(previous) !== forecastSettingKey(next)) {
        writeForecastFields(changed.value || { caliberId: '', openingRuns: null, openingTons: null });
    }
    activeForecastContext = changed.context;
    return recallForecastSetting(changed.context);
}
let scheduleReadGeneration = 0;

function beginScheduleRead() {
    scheduleReadGeneration += 1;
    return scheduleReadGeneration;
}

function currentMonthlySummary() {
    return latestMonthlySummary;
}

function finishScheduleRead(generation, summary) {
    if (anonymousForecastCheck) return false;
    if (generation !== scheduleReadGeneration) return false;
    if (summary && summary.ok !== false && Array.isArray(summary.months)) {
        latestMonthlySummary = summary;
        return true;
    }
    latestMonthlySummary = null;
    return true;
}

function renderMonthlyScheduleSummary(summary) {
    if (summary && summary.ok !== false && Array.isArray(summary.months)) latestMonthlySummary = summary;
    if (summary && summary.ok === false) latestMonthlySummary = null;
    const target = document.getElementById('monthly-schedule-summary');
    if (!target) return;
    if (!summary || summary.ok === false) {
        target.textContent = summary && summary.reason ? summary.reason : '月別の生産予定はまだ読んでいません。';
        renderExchangeCycle();
        renderStandDemandList();
        return;
    }
    if (!summary.months.length) {
        target.textContent = '月別の生産予定を確認できません。不足なしとは判定しません。';
        renderStandDemandList();
        return;
    }
    const lines = summary.months.map(item => {
        const when = item.classification === 'past' ? '過去の予定' : item.classification === 'current' ? '今月の予定' : 'これからの予定';
        const tons = item.productionTons === null ? 'トン数未確認' : `${item.productionTons}トン`;
        const hours = item.operatingHours === null ? '操業時間は未確認' : `操業時間${item.operatingHours}`;
        return `${item.month} ${when} / サイズ${item.sizes.join('・') || '未確認'} / ${tons} / 勤務${item.shifts.join('・') || '未確認'} / ${hours}`;
    });
    const pastOnly = summary.months.every(item => item.classification === 'past');
    const pastNote = pastOnly ? 'この予定は基準日より前です。今の実績にも、これからの年間計画にも使いません。' : '過去の月は実績にしません。これからの月も年間計画にはしません。';
    target.textContent = `${lines.join('\n')}\n${pastNote}\n${summary.reason}`;
    renderConsumptionLink(summary);
    renderExchangeCycle();
    renderStandDemandList();
}

function renderConsumptionLink(summary) {
    const target = document.getElementById('consumption-link');
    if (!target) return;
    const form = readCaliberInputs();
    const linked = linkProductionToConsumption({ schedule: summary, standKey: form.standKey });
    const caliber = projectCaliberReplacement({
        standKey: form.standKey,
        size: form.size,
        currentCaliber: form.currentCaliber,
        openingUsedRuns: form.openingUsedRuns,
        openingUsedTons: form.openingUsedTons,
        standPass: form.standPass,
        workConfirmation: usableSlot(form.workConfirmation, workSlotOwner, {
            standKey: form.standKey,
            rollId: form.forecastRoll,
            size: form.size,
            referenceAt: activeForecastReference(form, summary)
        }, Boolean(form.forecastRoll)).slot,
        days: summary && summary.days,
        referenceDate: activeForecastReference(form) || (summary && summary.referenceDate)
    });
    const life = describeLifeChain({
        standKey: form.standKey,
        size: form.size,
        openingUsedRuns: form.openingUsedRuns,
        currentDiameter: form.currentDiameter,
        scrapDiameter: form.scrapDiameter,
        cutMm: form.cutMm,
        spareCount: form.spareCount,
        schedule: summary,
        caliber
    });
    target.textContent = `${linked.reason}\n${caliber.reason}\n${life}`;
}

function readCaliberInputs() {
    const value = id => {
        const element = typeof document !== 'undefined' ? document.getElementById(id) : null;
        return element ? element.value : '';
    };
    const opening = value('caliber-opening').trim();
    const openingTons = value('caliber-opening-tons').trim();
    return {
        standKey: value('caliber-stand').trim(),
        size: value('caliber-size').trim(),
        forecastRoll: value('forecast-roll').trim(),
        forecastReference: value('forecast-reference').trim(),
        currentCaliber: value('caliber-current').trim(),
        openingUsedRuns: opening === '' ? undefined : Number(opening),
        openingUsedTons: openingTons === '' ? undefined : Number(openingTons),
        standPass: value('caliber-pass'),
        currentDiameter: numberOrBlank('life-diameter'),
        scrapDiameter: numberOrBlank('life-scrap'),
        cutMm: numberOrBlank('life-cut'),
        spareCount: numberOrBlank('life-spare'),
        spareCaliberCount: numberOrBlank('cycle-spare-calibers'),
        reworkDays: numberOrBlank('cycle-rework-days'),
        workConfirmation: readWorkConfirmation(value),
        assemblyConfirmation: readAssemblyConfirmation(value)
    };
    function numberOrBlank(id) {
        const raw = value(id).trim();
        return raw === '' ? undefined : Number(raw);
    }
}

function readWorkConfirmation(value) {
    const reserved = value('work-reserved-hours').trim();
    const required = value('work-required-hours').trim();
    return {
        date: value('work-date').trim(),
        period: value('work-period'),
        reservedHours: reserved === '' ? undefined : Number(reserved),
        workType: value('work-type'),
        requiredHours: required === '' ? undefined : Number(required),
        people: value('work-people').trim() === '' ? undefined : Number(value('work-people').trim()),
        continuous: value('work-continuous'),
        changeover: value('work-changeover'),
        threeSet: value('work-three-set')
    };
}

function readAssemblyConfirmation(value) {
    const reserved = value('assembly-reserved-hours').trim();
    const required = value('assembly-required-hours').trim();
    return {
        date: value('assembly-date').trim(),
        period: value('assembly-period'),
        reservedHours: reserved === '' ? undefined : Number(reserved),
        requiredHours: required === '' ? undefined : Number(required),
        people: value('assembly-people').trim() === '' ? undefined : Number(value('assembly-people').trim()),
        prepared: value('assembly-prepared'),
        preparedTarget: value('assembly-prepared-target').trim(),
        preparedOn: value('assembly-prepared-on').trim()
    };
}

async function readMonthlyScheduleFile(file, referenceDate) {
    if (!file || !globalThis.RollPlanningImport || typeof globalThis.RollPlanningImport.parseXlsxArrayBuffer !== 'function') {
        return { ok: false, reason: '生産予定の読み取り機能を確認できません。' };
    }
    const parsed = await globalThis.RollPlanningImport.parseXlsxArrayBuffer(await file.arrayBuffer());
    return { ...summarizeMonthlyProductionSchedule(parsed.schedule, referenceDate), days: parsed.schedule, referenceDate };
}

function knownUseBasisText(standKey) {
    const stand = String(standKey || '').replace(/^#/, '');
    const table = {
        '2': '規定35直、基準14000t。直数とトン数は別です。',
        '3': '規定30直、基準12000t。直数とトン数は別です。',
        '4': '規定37直、基準15000t。直数とトン数は別です。',
        '5': '規定31直、基準12500t。直数とトン数は別です。',
        '6': '現行15直。6075tは固定最大にしません。',
        '7': '現行15直。6075tは固定最大にしません。',
        '8': '原資料の13直と5265tは確認済み最大にしていません。',
        '9': '原資料の13直と5265tは確認済み最大にしていません。',
        '10': '最大8直。',
        '11': '最大8直。',
        '12': '通常11直。最大ではありません。',
        '13': 'D10は通常6直、D13は最大12直。',
        '14': 'D10は通常5直、D13は最大7直。',
        '15': 'D10は通常5直、D13は最大7直。',
        '16': 'D10は最大13直、D13は最大14直。',
        '17': 'D10もD13も最大6直。'
    };
    return table[stand] || 'このスタンドの使用基準は既回答の表にありません。0直にはしません。';
}

function loadedForecastMasters(standKey) {
    if (anonymousForecastCheck) return {};
    // Only inspect maps already populated by the existing application.
    // Never initiate authentication, storage reads, or a remote fetch here.
    return {
        stand: typeof getStandMaster === 'function' ? getStandMaster(standKey) : null,
        cutting: typeof getCuttingMaster === 'function' ? getCuttingMaster(standKey) : null
    };
}

function forecastMasterNumber(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function premisesFact(premises, standKey, masters) {
    const fallback = localPremisesFact(premises, standKey);
    const stand = String(standKey || '').replace(/^#/, '');
    const loaded = masters || {};
    const sameStand = row => row && standNumberFromName(row.standKey || row.stand) === stand;
    const result = Object.assign({}, fallback, {
        diameterSource: fallback.scrapDiameter === null ? '取得待ち' : '端末内の径仕様',
        cutSource: fallback.adoptedCutMm === null ? '取得待ち' : '端末内の採用改削量'
    });
    if (loaded.stand) {
        result.scrapDiameter = sameStand(loaded.stand) ? forecastMasterNumber(loaded.stand.scrapDiameter) : null;
        result.diameterSource = '取得済みStandMaster';
        result.diameterReason = !sameStand(loaded.stand)
            ? '径マスタのスタンドが一致しないため、この値は使いません。'
            : (result.scrapDiameter === null ? `${stand}番の廃却径は取得済みマスタで未記録です。` : '');
    }
    if (loaded.cutting) {
        const active = loaded.cutting.active !== false && String(loaded.cutting.active).toLowerCase() !== 'false';
        result.adoptedCutMm = sameStand(loaded.cutting) && active ? forecastMasterNumber(loaded.cutting.calculationCutMm) : null;
        result.cutSource = '取得済み改削マスタの計算用改削量';
        result.cutReason = !sameStand(loaded.cutting)
            ? '改削マスタのスタンドが一致しないため、この値は使いません。'
            : (!active ? `${stand}番の改削マスタは無効です。採用改削量は使いません。`
                : (result.adoptedCutMm === null ? `${stand}番の計算用改削量は取得済みマスタで未記録です。標準値や実績平均では埋めません。` : ''));
    }
    return result;
}

function localPremisesFact(premises, standKey) {
    const stand = String(standKey || '').replace(/^#/, '');
    if (!premises || premises.status !== 'loaded' || !premises.data) {
        return {
            scrapDiameter: null,
            adoptedCutMm: null,
            diameterReason: '新品時の径と廃却径はローカル仕様が未読込なので取得待ちです。本人未回答ではありません。',
            cutReason: '採用改削量は改削マスタが未読込なので取得待ちです。他スタンドの値は使いません。'
        };
    }
    const row = premises.data.diametersMm && premises.data.diametersMm[stand];
    if (!row) {
        return {
            scrapDiameter: null,
            adoptedCutMm: null,
            diameterReason: `${stand}番の径はローカル仕様に記録がありません。未記録です。他スタンドの径は使いません。`,
            cutReason: `${stand}番の採用改削量はローカル仕様に記録がありません。未記録です。`
        };
    }
    const cut = forecastMasterNumber(row.adoptedCutMm);
    return {
        scrapDiameter: forecastMasterNumber(row.scrapDiameter),
        adoptedCutMm: cut,
        diameterReason: forecastMasterNumber(row.scrapDiameter) === null ? `${stand}番の廃却径は未記録です。` : '',
        cutReason: cut === null ? `${stand}番の採用改削量は手元の仕様に無いので取得待ちです。17番の2.5mmは使いません。` : ''
    };
}

function savedOpening(roll, standKey, size, referenceAt) {
    if (!roll || !size || !referenceAt) return { caliber: roll && roll.currentCaliber || '', runs: roll ? roll.openingRuns : undefined, note: '' };
    const saved = recallForecastSetting({ rollId: roll.id, standKey, size, referenceAt }).value;
    const hasCaliber = Boolean(saved && saved.caliberId);
    const hasRuns = Boolean(saved && saved.openingRuns !== null && saved.openingRuns !== undefined);
    return {
        caliber: hasCaliber ? saved.caliberId : (roll.currentCaliber || ''),
        runs: hasRuns ? saved.openingRuns : roll.openingRuns,
        note: hasCaliber || hasRuns ? `保存した開始条件です。基準日${referenceAt}、サイズ${size}。台帳には書いていません。` : ''
    };
}

let workSlotOwner = null;
let assemblySlotOwner = null;

function activeForecastReference(form) {
    return String(form && form.forecastReference || '').slice(0, 10);
}

function slotOwnerFromContext() {
    const context = currentForecastContext();
    return {
        standKey: String(context.standKey || '').replace(/^#/, ''),
        rollId: context.rollId || '',
        size: context.size || '',
        referenceAt: String(context.referenceAt || '').slice(0, 10)
    };
}

function rememberWorkSlotOwner() {
    const work = readCaliberInputs().workConfirmation || {};
    workSlotOwner = work.date ? slotOwnerFromContext() : null;
}

function rememberAssemblySlotOwner() {
    const assembly = readCaliberInputs().assemblyConfirmation || {};
    assemblySlotOwner = assembly.date ? slotOwnerFromContext() : null;
}

function slotKeptNote(label, confirmation) {
    const owner = confirmation && confirmation.owner;
    if (!owner || !owner.standKey) return `${label}は確認時の対象が無いので、今の選択には付けていません。`;
    const roll = owner.rollId ? `、ロール${owner.rollId}` : '、ロール未確認';
    return `${label}は確認時の${owner.standKey}番${roll}、${owner.size || 'サイズ未確認'}、基準日${owner.referenceAt || '未設定'}のままです。選択を変えても付け直していません。予定の差替えでも付け直していません。`;
}

function confirmationOwnerMatches(confirmation, target, matchRoll) {
    const owner = confirmation && confirmation.owner;
    if (!confirmation || !owner) return false;
    const stand = String(target.standKey || '').replace(/^#/, '');
    const ownerStand = String(owner.standKey || '').replace(/^#/, '');
    if (!ownerStand || ownerStand !== stand) return false;
    if (!owner.size || !target.size || owner.size !== target.size) return false;
    const reference = String(target.referenceAt || '').slice(0, 10);
    const ownerReference = String(owner.referenceAt || '').slice(0, 10);
    if (reference !== ownerReference) return false;
    if (matchRoll && (!owner.rollId || !target.rollId || owner.rollId !== target.rollId)) return false;
    return true;
}

function usableSlot(confirmation, owner, target, matchRoll) {
    if (!confirmation || !confirmation.date) return { slot: null, note: '' };
    const stamped = Object.assign({}, confirmation, { owner: owner || confirmation.owner || null });
    if (confirmationOwnerMatches(stamped, target, matchRoll)) return { slot: stamped, note: '' };
    return { slot: null, note: slotKeptNote(matchRoll ? '作業枠' : '組替枠', stamped) };
}

function confirmationForStand(confirmation, standKey, standSize, referenceAt, rollId) {
    const result = usableSlot(confirmation, confirmation && confirmation.owner, {
        standKey, size: standSize, referenceAt, rollId
    }, true);
    return result.slot;
}

function sizeForStand(standKey, source, planDays) {
    const sizes = Array.from(new Set((planDays || []).filter(row => row && row.productionAmount !== 0).map(row => row.size).filter(Boolean)));
    if (sizes.length > 1) return '';
    const selected = String(source.standKey || '').replace(/^#/, '') === String(standKey);
    if (selected && source.size) return source.size;
    if (sizes.length === 1) return sizes[0];
    return '';
}

function buildStandDemandList(input) {
    const source = input || {};
    const plan = source.plan || null;
    const rolls = Array.isArray(source.rolls) ? source.rolls : [];
    const days = Array.isArray(source.days) ? source.days : [];
    const premises = source.premises || { status: 'waiting' };
    const referenceAt = String(source.referenceAt || '').slice(0, 10);
    const scheduleReference = String(source.scheduleReference || '').slice(0, 10);
    if (!plan && !days.length) {
        return '日付の予定も、月別の本数の版もありません。操業日は作っていません。';
    }
    const scheduleMonths = Array.from(new Set(days.map(row => String(row && row.date || '').slice(0, 7)).filter(Boolean)));
    const months = source.scheduleName
        ? scheduleMonths
        : (plan && Array.isArray(plan.targetMonths) && plan.targetMonths.length ? plan.targetMonths : scheduleMonths);
    const planDays = days.filter(row => row && months.includes(String(row.date || '').slice(0, 7)));
    const countedDays = referenceAt
        ? planDays.filter(row => String(row.date || '').slice(0, 10) >= referenceAt)
        : planDays.slice();
    const ignored = days.length - planDays.length;
    const beforeReference = planDays.length - countedDays.length;
    const standKeys = Array.from(new Set([
        ...((plan && plan.rows) || []).map(row => String(row.standKey)),
        ...rolls.map(item => standNumberFromName(item.name || item.id)).filter(Boolean)
    ])).sort((a, b) => Number(a) - Number(b));
    const header = [
        source.scheduleName ? `読込予定は${source.scheduleName}です。予定資料の基準日は${scheduleReference || '未設定'}です。予測の基準日は${referenceAt || '未設定'}です。手入力の本数は需要にしていません。` : '読込予定はありません。',
        beforeReference ? `基準日より前の操業${beforeReference}日は開始量へ足していません。` : '',
        plan ? `本数の版は${plan.id}、更新${plan.updatedAt}、本数の対象月は${(plan.targetMonths || []).join('、')}です。本数は需要にしていません。` : '手入力の本数版は使っていません。',
        ignored > 0 ? `対象月の外の日付${ignored}件は、この一覧に使っていません。` : '',
        countedDays.length ? `日付の予定は${countedDays.length}日あります。無い日は作っていません。` : '月別の本数だけなので、操業日は作っていません。'
    ].filter(Boolean);
    const blocks = standKeys.map(standKey => {
        const fact = premisesFact(premises, standKey, source.mastersByStand && source.mastersByStand[standKey]);
        const standSize = sizeForStand(standKey, source, countedDays);
        const standRolls = rolls.filter(item => standNumberFromName(item.name || item.id) === standKey).map(item => {
            const saved = savedOpening(item, standKey, standSize, referenceAt);
            return Object.assign({}, item, { currentCaliber: saved.caliber, openingRuns: saved.runs, openingNote: saved.note });
        });
        const limit = knownCaliberLimit(standKey, standSize);
        const lead = source.leadTimes && source.leadTimes[standKey] ? source.leadTimes[standKey] : { months: PROVISIONAL_LEAD_TIME_MONTHS, status: 'provisional' };
        const leadText = lead.status === 'confirmed'
            ? `購入期間は確認済み${lead.months}か月です。期間だけでは不足なしにしません。`
            : `購入期間は暫定${lead.months}か月です。確定の納期ではありません。`;
        const rollLines = standRolls.length ? standRolls.map(item => {
            const missing = [];
            if (!item.currentCaliber) missing.push('現在のカリバは未記録です');
            if (item.openingRuns === undefined || item.openingRuns === null || item.openingRuns === '') missing.push('開始直数は未記録です。0直にはしません');
            if (item.currentDiameter === undefined || item.currentDiameter === null || item.currentDiameter === '') missing.push('現在径は未記録です。新品時の径では埋めません');
            return `${item.id}: ${item.openingNote || ''}${missing.length ? missing.join('。') : 'カリバと開始直数は記録にあります'}。`;
        }) : ['ロールIDは未記録です。架空のIDは作りません。'];
        let period = '月別の本数だけなので、計算できた操業期間はありません。';
        let scrap = '日付の予定が無いので、廃却と補充の日は出していません。';
        let night = '日付の予定が無いので、夜勤の予備不足は出していません。';
        let order = `廃却日が無いので、手配目安は出していません。${leadText}`;
        const blocked = [fact.diameterReason, fact.cutReason].filter(Boolean);
        const standDays = countedDays;
        const onlinePreview = standRolls.find(item => item.status === 'オンライン');
        const work = confirmationForStand(source.workConfirmation, standKey, standSize, referenceAt, onlinePreview && onlinePreview.id);
        const assembly = usableSlot(source.assemblyConfirmation, source.assemblyConfirmation && source.assemblyConfirmation.owner, {
            standKey, size: standSize, referenceAt
        }, false).slot;
        if (!standSize) blocked.push('サイズはこのスタンドの予定に無いので、選択中のサイズは使いません。');
        if (!work || !work.date) {
            const ownerStand = source.workConfirmation && source.workConfirmation.owner
                ? String(source.workConfirmation.owner.standKey || '').replace(/^#/, '')
                : '';
            if (!source.workConfirmation || !source.workConfirmation.date || (ownerStand && ownerStand !== String(standKey))) {
                blocked.push('作業枠はこのスタンドに確認されていません。他スタンドの枠は使いません。');
            }
            if (source.workConfirmation && source.workConfirmation.date) blocked.push(slotKeptNote('作業枠', source.workConfirmation));
        }
        if (planDays.length && !standDays.length) {
            period = '基準日以降の予定が無いので、開始量へは足していません。';
            scrap = '足していない日からは、廃却日も手配目安も出していません。';
            order = '足していない日からは、手配目安は出していません。';
        } else if (planDays.length && standRolls.length && standDays.length) {
            const resources = readLedgerResources(standRolls, { standKey, size: standSize });
            const online = resources.find(item => item.frame === 'online');
            if (!online || !online.caliberId || online.runs === null) {
                blocked.push('現在のカリバまたは開始直数が未記録なので、このスタンドの日付計算はしていません。');
            } else if (!standSize) {
                period = 'サイズが切り替わる予定は、サイズ別の開始条件と切替工程が未確認のため日付計算を止めています。選択中の1サイズには丸めません。';
                blocked.push('サイズ別の開始条件と切替工程は未確認です。');
            } else if (!limit || limit.kind !== '最大') {
                blocked.push('最大直数が記録されていないので、日付の交換計算はしていません。使用基準のトン数からは日を作りません。');
            } else {
                const result = simulateExchangeCycle({
                    maxRuns: limit.runs,
                    scrapDiameter: fact.scrapDiameter,
                    adoptedCutMm: fact.adoptedCutMm,
                    reworkDays: String(source.standKey || '').replace(/^#/, '') === String(standKey) ? source.reworkDays : null,
                    leadMonths: lead.months,
                    leadStatus: lead.status,
                    workConfirmation: work,
                    assemblyConfirmation: assembly,
                    resources,
                    days: standDays
                });
                period = result.reason;
                const scraps = result.events.filter(item => item.kind === '廃却需要');
                const nights = result.events.filter(item => item.kind === '夜勤予備不足');
                scrap = scraps.length ? scraps.map(item => `${item.date} ${item.note}`).join(' / ') : '計算できた範囲に廃却はありません。0本にはしません。';
                night = nights.length ? nights.map(item => `${item.date} 操業中${item.onlineId || '未確認'} ${item.note}`).join(' / ') : '計算できた範囲に夜勤の予備不足はありません。期間の外は未確認です。';
                order = scraps.length ? `${leadText}${scraps.map(item => item.note).join(' / ')}` : `廃却日が無いので、手配目安は出していません。${leadText}`;
            }
        }
        return [
            `#${standKey} ${knownUseBasisText(standKey)}`,
            rollLines.join('\n'),
            `計算の参照元: 廃却径は${fact.diameterSource}（${fact.scrapDiameter === null ? '未確認' : fact.scrapDiameter + 'mm'}）、採用改削量は${fact.cutSource}（${fact.adoptedCutMm === null ? '未確認' : fact.adoptedCutMm + 'mm'}）です。新品時の径は現在径に使いません。`,
            `計算できた期間: ${period}`,
            `廃却と補充: ${scrap}`,
            `夜勤の予備不足: ${night}`,
            `手配目安: ${order}`,
            `計算できない項目: ${blocked.filter(Boolean).join(' ') || 'このスタンドで止まった項目はありません。他のスタンドは続けます。'}`
        ].join('\n');
    });
    return header.concat(blocks).join('\n\n');
}

let standPremisesCache = { status: 'waiting' };

function renderStandDemandList() {
    const target = typeof document !== 'undefined' ? document.getElementById('stand-demand-list') : null;
    if (!target) return;
    const plan = anonymousForecastCheck ? null : (readOperatingPlanState().slice(-1)[0] || null);
    const schedule = latestMonthlySummary && latestMonthlySummary.ok !== false ? latestMonthlySummary : null;
    const form = typeof readCaliberInputs === 'function' ? readCaliberInputs() : {};
    const ledger = anonymousForecastCheck ? anonymousCheckLedger() : (typeof roles === 'undefined' ? [] : roles);
    const masterKeys = Array.from(new Set(ledger.map(item => standNumberFromName(item.name || item.id)).filter(Boolean)));
    const mastersByStand = anonymousForecastCheck ? {} : Object.fromEntries(masterKeys.map(key => [key, loadedForecastMasters(key)]));
    target.textContent = buildStandDemandList({
        plan,
        rolls: ledger,
        days: schedule && Array.isArray(schedule.days) ? schedule.days : [],
        premises: anonymousForecastCheck ? { status: 'waiting' } : standPremisesCache,
        mastersByStand,
        scheduleName: schedule && schedule.sourceName || '',
        referenceAt: activeForecastReference(form, schedule),
        scheduleReference: schedule && schedule.referenceDate || '',
        standKey: form.standKey,
        size: form.size,
        reworkDays: form.reworkDays,
        workConfirmation: Object.assign({}, form.workConfirmation || {}, { owner: workSlotOwner }),
        assemblyConfirmation: Object.assign({}, form.assemblyConfirmation || {}, { owner: assemblySlotOwner }),
        leadTimes: anonymousForecastCheck ? {} : readStandLeadTimes()
    });
    if (!anonymousForecastCheck && standPremisesCache.status === 'waiting' && typeof fetch === 'function') {
        standPremisesCache = { status: 'reading' };
        fetch('local/stand-premises.json').then(response => {
            if (!response.ok) throw new Error('missing');
            return response.json();
        }).then(data => {
            standPremisesCache = { status: 'loaded', data };
            renderStandDemandList();
        }).catch(() => {
            standPremisesCache = { status: 'missing' };
            renderStandDemandList();
        });
    }
}

function renderOperatingPlanPanel() {
    const revisions = readOperatingPlanState();
    const revisionList = document.getElementById('operating-plan-revisions');
    const diff = document.getElementById('operating-plan-diff');
    const leads = document.getElementById('stand-lead-time-list');
    if (revisionList) {
        revisionList.textContent = revisions.length === 0
            ? '操業計画の版はまだありません。実資料は取り込んでいません。'
            : revisions.map(item => `${item.label || item.id} / ${item.updatedAt} / 対象月${item.targetMonths.length}`).join('\n');
    }
    if (diff && revisions.length >= 2) {
        const result = diffOperatingPlanRevisions(revisions[revisions.length - 2], revisions[revisions.length - 1]);
        diff.textContent = `変更${result.changed.length} 追加${result.added.length} 削除${result.removed.length}`;
    } else if (diff) {
        diff.textContent = '比較する旧版がありません。';
    }
    if (leads) {
        const stored = readStandLeadTimes();
        const lines = Object.keys(stored).sort().map(key => {
            const item = stored[key];
            return `#${key} ${item.months}か月 ${item.status === 'confirmed' ? '確認済み' : '暫定'}`;
        });
        leads.textContent = lines.length ? lines.join('\n') : '未保存のスタンドは暫定6か月です。暫定は安全判定にしません。';
    }
    renderStandDemandList();
}

function saveOperatingPlanFromForm() {
    if (anonymousForecastCheck) return;
    const created = createOperatingPlanRevision({
        id: document.getElementById('operating-plan-id').value,
        label: document.getElementById('operating-plan-label').value,
        updatedAt: document.getElementById('operating-plan-updated-at').value,
        targetMonths: document.getElementById('operating-plan-months').value.split(',').map(item => item.trim()).filter(Boolean),
        rows: [{
            standKey: document.getElementById('operating-plan-stand').value,
            month: document.getElementById('operating-plan-row-month').value,
            plannedUseCount: document.getElementById('operating-plan-planned').value,
            actualUseCount: document.getElementById('operating-plan-actual').value
        }]
    });
    const message = document.getElementById('operating-plan-message');
    if (!created.ok) {
        if (message) message.textContent = created.reason;
        return;
    }
    const next = saveOperatingPlanRevision(readOperatingPlanState(), created.revision);
    localStorage.setItem('operating_plan_revisions_v1', JSON.stringify(next));
    if (message) message.textContent = '旧版を残して新しい版を保存しました。ロールのステータスは変更していません。';
    renderOperatingPlanPanel();
}

function saveStandLeadTimeFromForm() {
    if (anonymousForecastCheck) return;
    const normalized = normalizeStandLeadTime({
        standKey: document.getElementById('lead-time-stand').value,
        months: document.getElementById('lead-time-months').value,
        status: document.getElementById('lead-time-status').value
    });
    const message = document.getElementById('operating-plan-message');
    if (!normalized.ok) {
        if (message) message.textContent = normalized.reason;
        return;
    }
    const stored = readStandLeadTimes();
    stored[normalized.value.standKey] = { months: normalized.value.months, status: normalized.value.status };
    localStorage.setItem('stand_lead_times_v1', JSON.stringify(stored));
    if (message) message.textContent = normalized.value.status === 'confirmed'
        ? '確認済みリードタイムを保存しました。'
        : '暫定リードタイムを保存しました。安全判定には使いません。';
    renderOperatingPlanPanel();
}

function suggestKnownWorkEffort() {
    if (typeof document === 'undefined') return;
    if (anonymousForecastCheck) {
        const note = document.getElementById('work-effort');
        if (note) note.textContent = '匿名の確認です。既回答の人数は入れません。';
        return;
    }
    const stand = document.getElementById('caliber-stand');
    const type = document.getElementById('work-type');
    const known = knownWorkEffort(stand && stand.value, type && type.value);
    const target = document.getElementById('work-effort');
    if (target) target.textContent = known ? known.text : 'このスタンドと作業の既回答工数は未確認です。空欄のままでは候補にしません。';
    if (!known || known.kind !== '確認') return;
    const hours = document.getElementById('work-required-hours');
    const people = document.getElementById('work-people');
    if (hours && hours.value === '') hours.value = String(known.hours);
    if (people && people.value === '') people.value = String(known.people);
}

function bindMonthlyScheduleFileInput() {
    const root = document.documentElement || document.body;
    if (!root) return;
    if (root.dataset.forecastBound === 'true') return;
    root.dataset.forecastBound = 'true';
    const dedicated = typeof location !== 'undefined' && /anonymous-check\.html$/.test(String(location.pathname || ''));
    const queryEntry = typeof location !== 'undefined' && /(?:\?|&)anonymous=1(?:&|$)/.test(String(location.search || ''));
    if (queryEntry && !dedicated && typeof location.replace === 'function') {
        location.replace('anonymous-check.html');
        return;
    }
    const input = document.getElementById('monthly-schedule-file');
    const anonymousButton = document.getElementById('start-anonymous-check');
    if (anonymousButton && anonymousButton.dataset.bound !== 'true') {
        anonymousButton.dataset.bound = 'true';
        anonymousButton.addEventListener('click', startAnonymousForecastCheck);
    }
    [['anon-scene-empty', 'empty'], ['anon-scene-ready', 'ready'], ['anon-scene-clear', 'clear'], ['anon-scene-short', 'short']].forEach(([id, scene]) => {
        const button = document.getElementById(id);
        if (button && button.dataset.bound !== 'true') {
            button.dataset.bound = 'true';
            button.addEventListener('click', () => applyAnonymousScene(scene));
        }
    });
    [['anon-example-short', 'short'], ['anon-example-ready', 'ready'], ['anon-example-unknown', 'unknown']].forEach(([id, kind]) => {
        const button = document.getElementById(id);
        if (button && button.dataset.bound !== 'true') {
            button.dataset.bound = 'true';
            button.addEventListener('click', () => applyAnonymousExample(kind));
        }
    });
    const workFields = ['work-date', 'work-period', 'work-reserved-hours', 'work-type', 'work-required-hours', 'work-people', 'work-continuous', 'work-changeover', 'work-three-set'];
    const assemblyFields = ['assembly-date', 'assembly-period', 'assembly-reserved-hours', 'assembly-required-hours', 'assembly-people', 'assembly-prepared', 'assembly-prepared-target', 'assembly-prepared-on'];
    ['forecast-roll', 'forecast-reference', 'caliber-stand', 'caliber-size', 'caliber-current', 'caliber-opening', 'caliber-opening-tons', 'caliber-pass'].concat(workFields, assemblyFields, ['life-diameter', 'life-scrap', 'life-cut', 'life-spare', 'cycle-spare-calibers', 'cycle-rework-days']).forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('change', () => {
            if (applyingForecastSetting) return;
            if (workFields.includes(id)) rememberWorkSlotOwner();
            if (assemblyFields.includes(id)) rememberAssemblySlotOwner();
            syncForecastSettingContext();
            suggestKnownWorkEffort();
            renderMonthlyScheduleSummary(latestMonthlySummary);
            renderExchangeCycle();
        });
    });
    if (dedicated) {
        openAnonymousEntry();
        return;
    }
    if (input && input.dataset.bound !== 'true') {
        input.dataset.bound = 'true';
        syncForecastSettingContext();
        renderExchangeCycle();
        renderStandDemandList();
    }
    if (!input) return;
    input.addEventListener('change', async () => {
        if (anonymousForecastCheck) return;
        const generation = beginScheduleRead();
        const file = input.files && input.files[0];
        const message = document.getElementById('operating-plan-message');
        if (!file) {
            finishScheduleRead(generation, null);
            syncForecastSettingContext();
            renderMonthlyScheduleSummary({ ok: false, reason: '生産予定を外したので、循環の予測を無効にしました。' });
            if (message) message.textContent = '生産予定を外したので、循環の予測を無効にしました。';
            renderExchangeCycle();
            return;
        }
        try {
            const today = new Date();
            const referenceDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            const summary = await readMonthlyScheduleFile(file, referenceDate);
            summary.sourceName = file.name;
            if (!finishScheduleRead(generation, summary)) return;
            syncForecastSettingContext();
            renderMonthlyScheduleSummary(summary);
            if (message) message.textContent = '生産予定は端末内で表示しました。ロール本数には保存せず、外部へは送っていません。';
        } catch (error) {
            if (!finishScheduleRead(generation, null)) return;
            renderMonthlyScheduleSummary({ ok: false, reason: error && error.message ? error.message : '生産予定を読めませんでした。' });
            if (message) message.textContent = '生産予定を読めなかったので、循環の予測を無効にしました。';
            renderExchangeCycle();
        }
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindMonthlyScheduleFileInput);
    else bindMonthlyScheduleFileInput();
}

