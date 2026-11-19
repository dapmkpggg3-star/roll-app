// Anonymous PC dashboard. It calls the existing forecast functions and does not write a ledger.
function dashboardFiscalMonths(startYear) {
    return Array.from({ length: 12 }, (_, index) => {
        const month = index + 4;
        const year = startYear + Math.floor((month - 1) / 12);
        const monthNumber = ((month - 1) % 12) + 1;
        return `${year}-${String(monthNumber).padStart(2, '0')}`;
    });
}

function dashboardUseRows(standKey, months, plannedUseCount) {
    return months.map(month => ({ standKey, month, plannedUseCount, actualUseCount: null }));
}

function dashboardAnonDay(date, hours, team, amount) {
    return {
        date,
        size: 'D1',
        operatingHours: hours,
        productionAmount: amount,
        shift1Team: '',
        shift3Team: team || '',
        productionByTeam: { A: team === 'A' ? amount : 0, B: team === 'B' ? amount : 0 }
    };
}

function anonymousDashboardFixture(referenceAt) {
    const months = dashboardFiscalMonths(2026);
    const createdA = createOperatingPlanRevision({
        id: 'anon-plan-a',
        label: '匿名計画A',
        updatedAt: '2026-11-19T06:00:00.000Z',
        targetMonths: months,
        rows: dashboardUseRows('10', months, 2).concat(dashboardUseRows('16', months, 1))
    });
    const createdB = createOperatingPlanRevision({
        id: 'anon-plan-b',
        label: '匿名計画B',
        updatedAt: '2026-12-01T00:00:00.000Z',
        targetMonths: months,
        rows: dashboardUseRows('10', months, 4).concat(dashboardUseRows('16', months, 1))
    });
    if (!createdA.ok || !createdB.ok) {
        throw new Error(createdA.reason || createdB.reason || '匿名の計画版を作れません。');
    }
    return {
        referenceAt: referenceAt || '2026-11-19T06:00:00.000Z',
        revisions: [createdA.revision, createdB.revision],
        rolls: [
            {
                standKey: '10',
                rollId: '#10-ANON-1',
                status: 'オンライン',
                currentDiameter: 340,
                scrapDiameter: 292,
                cutMm: 8,
                remainingCutCount: 6,
                spareCount: 1,
                activeThreeSetCount: 3,
                currentCaliber: 'anon-1',
                openingUsedRuns: 6,
                size: 'D1',
                days: [
                    dashboardAnonDay('2027-04-01', 8, 'A', 10),
                    dashboardAnonDay('2027-04-02', 0, 'B', 0),
                    dashboardAnonDay('2027-04-03', 8, 'A', 10),
                    dashboardAnonDay('2027-04-04', 5, 'A', 10)
                ],
                leadTime: { months: 6, status: 'provisional' },
                manual: { useEnd: '2027-02-15', rework: '2027-01-20', enteredAt: '2026-11-01T09:00:00.000Z', operator: '匿名担当', reason: '現行表の赤字予定に相当する匿名の手入力です。' },
                confirmed: { useEnd: '2026-08-20' }
            },
            {
                standKey: '11',
                rollId: '#11-ANON-2',
                status: 'オンライン',
                currentDiameter: '',
                scrapDiameter: '',
                cutMm: '',
                remainingCutCount: null,
                spareCount: null,
                activeThreeSetCount: 3,
                leadTime: { months: 6, status: 'provisional' },
                manual: { useEnd: '', rework: '', enteredAt: '', operator: '', reason: '' },
                confirmed: { useEnd: '' }
            },
            {
                standKey: '16',
                rollId: '#16-ANON-3',
                status: 'オンライン',
                currentDiameter: 340,
                scrapDiameter: 292,
                cutMm: 8,
                remainingCutCount: 6,
                spareCount: 0,
                activeThreeSetCount: 3,
                leadTime: { months: 6, status: 'confirmed' },
                manual: { useEnd: '', rework: '2027-03-01', enteredAt: '2026-11-02T09:00:00.000Z', operator: '匿名担当', reason: '匿名の改削手入力です。' },
                confirmed: { useEnd: '' }
            }
        ]
    };
}

function dashboardDayDiff(left, right) {
    const start = Date.parse(left);
    const end = Date.parse(right);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return Math.round((start - end) / 86400000);
}

function dashboardLeadText(leadTime) {
    const months = leadTime && Number.isFinite(Number(leadTime.months)) ? Number(leadTime.months) : 6;
    if (leadTime && leadTime.status === 'confirmed') {
        return `購入までの期間は確認済み${months}か月です。期間だけでは購入日にも不足なしにもしません。`;
    }
    return `購入までの期間は暫定${months}か月です。購入日にも不足なしにもしません。`;
}

function dashboardExchange(roll, referenceAt) {
    if (!Array.isArray(roll.days) || roll.days.length === 0 || typeof projectCaliberReplacement !== 'function') {
        return {
            date: null,
            text: '判定不能',
            reason: '交換候補に使う日別の操業予定がこの行にはありません。無い予定を作業日にはしません。'
        };
    }
    const projected = projectCaliberReplacement({
        standKey: roll.standKey,
        referenceDate: String(referenceAt || '').slice(0, 10),
        currentCaliber: roll.currentCaliber,
        openingUsedRuns: roll.openingUsedRuns,
        size: roll.size,
        days: roll.days
    });
    return {
        date: projected && projected.exchangeDate ? projected.exchangeDate : null,
        text: projected && projected.exchangeDate ? projected.exchangeDate : '判定不能',
        reason: projected && projected.reason ? projected.reason : '交換候補は判定不能です。'
    };
}

function dashboardDateGap(leftLabel, left, rightLabel, right) {
    const days = dashboardDayDiff(left, right);
    if (days === null) return '';
    return `${leftLabel}（${String(left).slice(0, 10)}）は${rightLabel}（${String(right).slice(0, 10)}）と${Math.abs(days)}日違います。`;
}

function dashboardPlanChange(revision, previous, standKey) {
    if (!previous) {
        return { text: '比較する前の計画版はありません。', months: [] };
    }
    const diff = diffOperatingPlanRevisions(previous, revision);
    const months = [];
    diff.changed.forEach(item => {
        if (String(item.standKey) === String(standKey) && !months.includes(item.month)) months.push(item.month);
    });
    if (months.length === 0) {
        return { text: 'このスタンドの使用回数は前の計画版から変わっていません。予定を実績にはしていません。', months: [] };
    }
    return {
        text: `前の計画版から使用回数が変わった月は${months.length}か月です。先頭は${months[0]}です。予定を実績にはしていません。`,
        months
    };
}

function earlierDashboardRevision(revisions, revision) {
    const list = (revisions || []).filter(item => item && item.id !== revision.id && Date.parse(item.updatedAt) <= Date.parse(revision.updatedAt));
    list.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    return list[0] || null;
}

function buildDashboardRow(roll, revision, referenceAt, previousRevision) {
    const forecast = forecastThreeSetFromPlan({
        standKey: roll.standKey,
        revision,
        remainingCutCount: roll.remainingCutCount,
        activeThreeSetCount: roll.activeThreeSetCount,
        leadTime: roll.leadTime
    });
    const rework = describeReworkDemand(roll);
    const spare = describeSpareReadiness(roll.spareCount);
    const exchange = dashboardExchange(roll, referenceAt);
    const lead = dashboardLeadText(roll.leadTime);
    const readiness = typeof threeSetForecast === 'function'
        ? threeSetForecast({
            standKey: roll.standKey,
            installedSpareCount: Number.isInteger(roll.spareCount) ? roll.spareCount : undefined,
            reworkDepartureOn: '',
            purchaseOrderedOn: ''
        })
        : '3セットは運用の枠です。ロール3本ではありません。';
    const manual = {
        useEnd: String(roll.manual && roll.manual.useEnd || ''),
        rework: String(roll.manual && roll.manual.rework || ''),
        enteredAt: String(roll.manual && roll.manual.enteredAt || ''),
        operator: String(roll.manual && roll.manual.operator || ''),
        reason: String(roll.manual && roll.manual.reason || '')
    };
    const confirmedUseEnd = String(roll.confirmed && roll.confirmed.useEnd || '');
    const confirmedDiff = dashboardDayDiff(manual.useEnd, confirmedUseEnd);
    const planChange = dashboardPlanChange(revision, previousRevision, roll.standKey);
    const autoParts = [];
    const useGap = dashboardDateGap('手入力の使用終了', manual.useEnd, '自動の交換候補', exchange.date);
    if (useGap) autoParts.push(`${useGap}自動予測では手入力予定を上書きしません。`);
    else if (manual.useEnd) autoParts.push('使用終了の自動予測は判定不能です。手入力予定は残しています。');
    else if (exchange.date) autoParts.push(`自動の交換候補は${exchange.date}です。手入力の使用終了はないので、交換候補を使用終了予定には書きません。`);
    else autoParts.push('使用終了の手入力も自動の交換候補も、比べる日付がありません。');
    if (manual.rework) autoParts.push(`手入力の改削予定${manual.rework}は残しています。自動の改削日は判定不能です。`);
    const purchase = forecast.purchase === 'unknown' || forecast.purchase === null || forecast.purchase === undefined
        ? '判定不能'
        : String(forecast.purchase);
    const warning = roll.spareCount === 0 ? spare : '';
    return {
        standKey: roll.standKey,
        rollId: roll.rollId,
        status: roll.status,
        priority: warning ? 0 : (exchange.date ? 1 : 2),
        threeSet: readiness,
        spareText: spare,
        planMonths: planChange.months,
        manual,
        confirmed: { useEnd: confirmedUseEnd },
        auto: {
            useEnd: '判定不能',
            exchange: exchange.text,
            exchangeDate: exchange.date,
            rework,
            purchase,
            lead,
            orderStatus: '発注済みは未確認です。',
            totalUseCount: forecast.totalUseCount,
            reason: forecast.reason
        },
        diff: {
            manualVersusAuto: autoParts.join(''),
            manualVersusConfirmed: confirmedDiff === null ? '確定・実績と比べる日付が揃っていません。' : `手入力の使用終了は確定・実績と${Math.abs(confirmedDiff)}日違います。確定・実績へは上げていません。`,
            planRevision: planChange.text
        },
        warning,
        basis: {
            source: `${roll.rollId} / スタンド#${roll.standKey} / ${roll.status} / 現在径${roll.currentDiameter === '' ? '未確認' : roll.currentDiameter} / 廃却径${roll.scrapDiameter === '' ? '未確認' : roll.scrapDiameter} / カリバ${roll.currentCaliber || '未確認'} / 開始直数${Number.isInteger(roll.openingUsedRuns) ? roll.openingUsedRuns : '未確認'}`,
            formula: '使用回数は計画版の各月で、実績があれば実績、無ければ計画を足します。交換候補は確定した最大直数と日別予定があるときだけ出します。改削残回数は（現在径−廃却径）÷切込みです。購入日にはしません。',
            steps: [
                exchange.reason,
                rework,
                forecast.reason,
                lead,
                '発注済みは未確認です。',
                planChange.text,
                `集計した使用回数は${forecast.totalUseCount === null || forecast.totalUseCount === undefined ? '判定不能' : forecast.totalUseCount}です。`,
                spare,
                readiness
            ],
            revision: `${revision.label} / ${revision.id} / ${revision.updatedAt}`,
            referenceAt,
            unverified: roll.leadTime && roll.leadTime.status === 'confirmed'
                ? '本数と改削回数の換算は未確定です。12か月超の不足は判定不能のままです。'
                : '購入リードタイムは暫定です。購入日も不足なしも確定しません。'
        }
    };
}

function buildRollDashboard(fixture) {
    return buildRollDashboardWithRevision(fixture, fixture && fixture.revisions ? fixture.revisions[0].id : '');
}

function buildRollDashboardWithRevision(fixture, revisionId) {
    const source = fixture || anonymousDashboardFixture();
    const revision = source.revisions.find(item => item.id === revisionId) || source.revisions[0];
    const previous = earlierDashboardRevision(source.revisions, revision);
    return {
        referenceAt: source.referenceAt,
        revision,
        previousRevisionId: previous ? previous.id : '',
        rows: source.rolls.map(roll => buildDashboardRow(roll, revision, source.referenceAt, previous))
    };
}

function dashboardComparableNumbers(model) {
    return {
        referenceAt: model.referenceAt,
        revisionId: model.revision.id,
        rows: model.rows.map(row => ({
            rollId: row.rollId,
            totalUseCount: row.auto.totalUseCount,
            purchase: row.auto.purchase,
            useEnd: row.auto.useEnd,
            exchange: row.auto.exchange,
            rework: row.auto.rework
        }))
    };
}

function freezeDashboardSnapshot(model) {
    return {
        frozenAt: model.referenceAt,
        revisionId: model.revision.id,
        numbers: dashboardComparableNumbers(model)
    };
}

function filterDashboardRows(rows, query) {
    const stand = String(query && query.stand || '').replace(/^#/, '').trim();
    const roll = String(query && query.roll || '').trim();
    const month = String(query && query.month || '').trim();
    return rows.filter(row => {
        if (stand && row.standKey !== stand && !row.rollId.includes('#' + stand)) return false;
        if (roll && !row.rollId.includes(roll)) return false;
        if (month) {
            const dates = [row.manual.useEnd, row.manual.rework, row.confirmed.useEnd, row.auto.useEnd, row.auto.exchange].concat(row.planMonths || []).join(' ');
            if (!dates.includes(month)) return false;
        }
        return true;
    }).sort((left, right) => left.priority - right.priority || Number(left.standKey) - Number(right.standKey) || left.rollId.localeCompare(right.rollId, 'en'));
}
