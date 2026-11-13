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
        gaps.push(standNumber >= 2 && standNumber <= 5
            ? '2から5番スタンドの使用トン数の基準'
            : 'カリバをどれだけ使うかの基準');
    }
    if (standNumber >= 10 && standNumber <= 11) gaps.push('10番と11番の8直までの上限');
    const sizes = [...new Set(future.flatMap(item => item.sizes || []))];
    if (sizes.length !== 1) gaps.push('サイズごとの専用カリバ');
    if (future.some(item => item.operatingHours === null) || source.shortHoursConfirmed !== true) {
        gaps.push('短い操業時間の扱い');
    }
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

function renderMonthlyScheduleSummary(summary) {
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
    const linked = linkProductionToConsumption({ schedule: summary });
    target.textContent = linked.reason;
}

async function readMonthlyScheduleFile(file, referenceDate) {
    if (!file || !globalThis.RollPlanningImport || typeof globalThis.RollPlanningImport.parseXlsxArrayBuffer !== 'function') {
        return { ok: false, reason: '生産予定の読み取り機能を確認できません。' };
    }
    const parsed = await globalThis.RollPlanningImport.parseXlsxArrayBuffer(await file.arrayBuffer());
    return summarizeMonthlyProductionSchedule(parsed.schedule, referenceDate);
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
