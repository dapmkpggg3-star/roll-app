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
    const candidate = confirmedWorkCandidate(reach, basis.stand, source.workConfirmation);
    const slotText = candidate
        ? `交換作業枠を確認できたため、${label}到達の参考候補は${candidate}です。`
        : `交換作業枠未確認のため、${label}到達の参考候補は出しません。`;
    return { reach, candidate, reason: `${label}${basis.runs}直への到達見込みは${reach}です。${slotText}` };
}

function expectedWorkType(stand) {
    const number = Number(String(stand || '').replace(/^#/, ''));
    if (number >= 2 && number <= 5) return 'rollChange';
    if (number >= 6 && number <= 17) return 'caliberChange';
    return '';
}

function confirmedWorkCandidate(reachDate, stand, confirmation) {
    const rules = globalThis.RollPlanningRules;
    const source = confirmation || {};
    const required = source.requiredHours;
    const reserved = source.reservedHours;
    const expected = expectedWorkType(stand);
    const ready = Boolean(rules && reachDate && source.date
        && String(source.date) < reachDate
        && source.period === 'day'
        && source.workType === expected
        && typeof required === 'number' && Number.isFinite(required) && required > 0
        && typeof reserved === 'number' && Number.isFinite(reserved) && reserved >= required
        && source.continuous === 'no'
        && source.changeover === 'yes'
        && source.threeSet === 'yes');
    if (!ready) return null;
    const workType = expected === 'rollChange' ? rules.WORK_TYPES.ROLL_CHANGE : rules.WORK_TYPES.CALIBER_CHANGE;
    const allowed = rules.createPlanningRules({ afterProductionAllowedWorkTypes: [] }).validateWorkForSlot({
        type: workType,
        stands: [String(stand)]
    }, {
        type: rules.SLOT_TYPES.DAY_MAINTENANCE,
        shift: 'shift1',
        productionActive: false
    }).allowed;
    return allowed ? source.date : null;
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
    const candidate = confirmedWorkCandidate(reach, basis.stand, source.workConfirmation);
    const slotText = candidate
        ? `交換作業枠を確認できたため、トン数到達の参考候補は${candidate}です。`
        : '交換作業枠未確認のため、トン数到達の参考候補は出しません。';
    return { reach, candidate, reason: `基準${formatTons(basis.tons)}への到達見込みは${reach}です。${slotText}` };
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
    if (source.activeThreeSetCount !== 3) {
        return unknown('固定3セットの対象本数が3本として確認できません。');
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
            reason: '購入リードタイムが暫定のため、確定判定はしません。'
        };
    }
    return {
        purchase: 'unknown',
        rework: 'unknown',
        shortage: 'unknown',
        totalUseCount,
        remainingCutCount: Number(source.remainingCutCount),
        reason: '数量は集計できましたが、本数と改削回数の業務上の換算は未確定のため判定不能です。'
    };
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

function renderMonthlyScheduleSummary(summary) {
    if (summary) latestMonthlySummary = summary;
    const target = document.getElementById('monthly-schedule-summary');
    if (!target) return;
    if (!summary || summary.ok === false) {
        target.textContent = summary && summary.reason ? summary.reason : '月別の生産予定はまだ読んでいません。';
        return;
    }
    if (!summary.months.length) {
        target.textContent = '月別の生産予定を確認できません。不足なしとは判定しません。';
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
        workConfirmation: form.workConfirmation,
        days: summary && summary.days,
        referenceDate: summary && summary.referenceDate
    });
    target.textContent = `${linked.reason}\n${caliber.reason}`;
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
        currentCaliber: value('caliber-current').trim(),
        openingUsedRuns: opening === '' ? undefined : Number(opening),
        openingUsedTons: openingTons === '' ? undefined : Number(openingTons),
        standPass: value('caliber-pass'),
        workConfirmation: readWorkConfirmation(value)
    };
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
        continuous: value('work-continuous'),
        changeover: value('work-changeover'),
        threeSet: value('work-three-set')
    };
}

async function readMonthlyScheduleFile(file, referenceDate) {
    if (!file || !globalThis.RollPlanningImport || typeof globalThis.RollPlanningImport.parseXlsxArrayBuffer !== 'function') {
        return { ok: false, reason: '生産予定の読み取り機能を確認できません。' };
    }
    const parsed = await globalThis.RollPlanningImport.parseXlsxArrayBuffer(await file.arrayBuffer());
    return { ...summarizeMonthlyProductionSchedule(parsed.schedule, referenceDate), days: parsed.schedule, referenceDate };
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
}

function saveOperatingPlanFromForm() {
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

function bindMonthlyScheduleFileInput() {
    const input = document.getElementById('monthly-schedule-file');
    if (!input || input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';
    ['caliber-stand', 'caliber-size', 'caliber-current', 'caliber-opening', 'caliber-opening-tons', 'caliber-pass', 'work-date', 'work-period', 'work-reserved-hours', 'work-type', 'work-required-hours', 'work-continuous', 'work-changeover', 'work-three-set'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('change', () => renderMonthlyScheduleSummary(latestMonthlySummary));
    });
    input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        const message = document.getElementById('operating-plan-message');
        if (!file) return;
        try {
            const today = new Date();
            const referenceDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            const summary = await readMonthlyScheduleFile(file, referenceDate);
            renderMonthlyScheduleSummary(summary);
            if (message) message.textContent = '生産予定は端末内で表示しました。ロール本数には保存せず、外部へは送っていません。';
        } catch (error) {
            renderMonthlyScheduleSummary({ ok: false, reason: error && error.message ? error.message : '生産予定を読めませんでした。' });
        }
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindMonthlyScheduleFileInput);
    else bindMonthlyScheduleFileInput();
}
