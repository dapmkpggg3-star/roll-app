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

function dashboardNightOnly(row) {
    const dayTeam = String(row && row.shift1Team || '').trim();
    const nightTeam = String(row && row.shift3Team || '').trim();
    return Boolean(nightTeam) && !dayTeam;
}

function dashboardLimitText(projected) {
    if (!projected || (!projected.exceedsOnDate && !projected.exchangeDate)) {
        return projected && projected.reason
            ? `上限到達の見込み: ${projected.reason}`
            : '上限到達の見込みは判定不能です。交換できる日にはしません。';
    }
    const limit = projected.exceedsOnDate
        ? `${projected.exceedsOnDate}は上限到達の見込みです。交換できる日ではありません。`
        : '上限を超える日は確定していません。';
    const stop = projected.exchangeDate
        ? `計算上の停止日${projected.exchangeDate}は、昼の作業ができる確認ではありません。`
        : '';
    return `${limit}${stop}`;
}

function dashboardConfirmedExchange(roll, referenceAt, projected) {
    const reach = projected && (projected.exceedsOnDate || projected.exchangeDate);
    if (!reach || typeof confirmedWorkCandidate !== 'function' || !roll.workConfirmation) {
        return { date: null, note: '昼の作業時間、人数、組替、3セットは未確認です。' };
    }
    const assessed = confirmedWorkCandidate(reach, roll.standKey, roll.workConfirmation, roll.days, referenceAt);
    if (!assessed || !assessed.date) {
        return { date: null, note: assessed && assessed.note ? assessed.note : '昼の作業枠は確認できていません。' };
    }
    const row = (roll.days || []).find(item => String(item && item.date || '').slice(0, 10) === assessed.date);
    if (!row || dashboardNightOnly(row) || !(row.shift1Team || row.dayMaintenanceAvailable === true) || Number(row.productionAmount) > 0) {
        return { date: null, note: 'その日は昼の停止ではありません。夜勤のみや操業中は交換候補にしません。' };
    }
    return { date: assessed.date, note: assessed.note || '' };
}

function dashboardExchange(roll, referenceAt) {
    if (!Array.isArray(roll.days) || roll.days.length === 0 || typeof projectCaliberReplacement !== 'function') {
        return {
            date: null,
            text: '作業枠未確認',
            limitText: '日別の操業予定がないので、上限到達の見込みも交換候補も出しません。',
            reason: '交換候補は作業枠未確認です。無い予定を作業日にはしません。'
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
    const limitText = dashboardLimitText(projected);
    const confirmed = dashboardConfirmedExchange(roll, referenceAt, projected);
    if (!confirmed.date) {
        return {
            date: null,
            text: '作業枠未確認',
            limitText,
            reason: `交換候補は作業枠未確認です。${confirmed.note}${limitText}交換候補にはしません。`
        };
    }
    return {
        date: confirmed.date,
        text: confirmed.date,
        limitText,
        reason: `作業枠を確認した交換候補は${confirmed.date}です。${confirmed.note}${limitText}`
    };
}

function dashboardSameKindGap(kind, left, right) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(left || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(right || ''))) return '';
    const days = dashboardDayDiff(left, right);
    if (days === null) return '';
    return `${kind}は同じ種類の日付で${Math.abs(days)}日違います。`;
}

function dashboardNextManual(manual) {
    const plans = [];
    if (manual.rework) plans.push({ kind: '改削', date: manual.rework });
    if (manual.useEnd) plans.push({ kind: '使用終了', date: manual.useEnd });
    plans.sort((left, right) => left.date.localeCompare(right.date));
    return plans[0] ? `${plans[0].kind} ${plans[0].date}` : 'なし';
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
    const planChange = dashboardPlanChange(revision, previousRevision, roll.standKey);
    const sameUse = dashboardSameKindGap('使用終了', manual.useEnd, confirmedUseEnd);
    const sameExchange = dashboardSameKindGap('交換', manual.exchange, exchange.date);
    const comparison = [
        '使用終了予定と交換候補は種類が違うので、日数差は出しません。',
        '手入力予定は残しています。',
        sameUse ? `${sameUse}確定・実績へは上げていません。` : '使用終了の日付が揃っていないので、使用終了の日数差は出しません。',
        sameExchange ? `${sameExchange}手入力の交換予定は上書きしていません。` : ''
    ].filter(Boolean).join('');
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
        manualSummary: dashboardNextManual(manual),
        confirmed: { useEnd: confirmedUseEnd },
        auto: {
            useEnd: '判定不能',
            exchange: exchange.text,
            exchangeDate: exchange.date,
            limitText: exchange.limitText,
            rework,
            purchase,
            lead,
            orderStatus: '発注済みは未確認です。',
            totalUseCount: forecast.totalUseCount,
            reason: forecast.reason
        },
        diff: {
            manualVersusAuto: comparison,
            manualVersusConfirmed: sameUse ? `${sameUse}確定・実績へは上げていません。` : '使用終了の日付が揃っていないので、日数差は出しません。',
            planRevision: planChange.text
        },
        warning,
        warningLabel: warning ? '予備0本' : '',
        basis: {
            source: `${roll.rollId} / スタンド#${roll.standKey} / ${roll.status} / 現在径${roll.currentDiameter === '' ? '未確認' : roll.currentDiameter} / 廃却径${roll.scrapDiameter === '' ? '未確認' : roll.scrapDiameter} / カリバ${roll.currentCaliber || '未確認'} / 開始直数${Number.isInteger(roll.openingUsedRuns) ? roll.openingUsedRuns : '未確認'}`,
            formula: '使用回数は計画版の各月で、実績があれば実績、無ければ計画を足します。上限到達の見込みは交換候補にしません。交換候補は、昼の停止で作業時間・人数・組替・3セットが確認できた日だけです。改削残回数は（現在径−廃却径）÷切込みです。購入日にはしません。',
            steps: [
                exchange.limitText,
                exchange.reason,
                `手入力: 使用終了 ${manual.useEnd || 'なし'} / 改削 ${manual.rework || 'なし'} / ${manual.enteredAt || '入力日時なし'} / ${manual.operator || '担当なし'}`,
                comparison,
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

function buildAnonymousManagementSheet(model) {
    const headers = ['区分', 'スタンド', 'ロール', '項目', '値'];
    const rows = [];
    (model && model.rows || []).forEach(row => {
        const add = (kind, item, value) => rows.push({
            kind,
            standKey: row.standKey,
            rollId: row.rollId,
            item,
            value: value === null || value === undefined || value === '' ? 'なし' : String(value)
        });
        add('手入力予定', '次の予定', row.manualSummary);
        add('手入力予定', '使用終了', row.manual.useEnd);
        add('手入力予定', '改削', row.manual.rework);
        add('予測', '確認済み交換候補', row.auto.exchange);
        add('予測', '使用終了', row.auto.useEnd);
        add('予測', '購入', row.auto.purchase);
        add('予測', '使用回数', row.auto.totalUseCount);
        add('予測', '上限到達', row.auto.limitText);
        add('確定・実績', '使用終了', row.confirmed.useEnd);
        add('根拠', '計算式', row.basis.formula);
        add('根拠', '出典', row.basis.source);
        add('根拠', '途中', (row.basis.steps || []).join(' / '));
        add('警告', '表示', row.warningLabel || '警告なし');
        add('警告', '内容', row.warning || '警告なし');
    });
    return {
        title: '匿名ロール管理表',
        note: '日常の確認用です。年間提出のA3様式ではありません。手入力予定、予測、確定・実績、根拠、警告は別の行です。空欄は「なし」と書き、未入力を確定とは扱いません。同じ予測の数値を区分して並べた匿名の表で、Google SheetsやExcelへ貼れます。実台帳には接続していません。',
        headers,
        rows
    };
}

function anonymousManagementSheetTsv(sheet) {
    const source = sheet || { headers: [], rows: [] };
    const lines = [source.headers.join('\t')];
    source.rows.forEach(row => {
        lines.push([row.kind, '#' + row.standKey, row.rollId, row.item, row.value]
            .map(cell => String(cell ?? '').replace(/[\t\r\n]/g, ' '))
            .join('\t'));
    });
    return lines.join('\n');
}

function filterDashboardRows(rows, query) {
    const stand = String(query && query.stand || '').replace(/^#/, '').trim();
    const roll = String(query && query.roll || '').trim();
    const month = String(query && query.month || '').trim();
    return rows.filter(row => {
        if (stand && row.standKey !== stand && !row.rollId.includes('#' + stand)) return false;
        if (roll && !row.rollId.includes(roll)) return false;
        if (month) {
            const dates = [row.manual.useEnd, row.manual.rework, row.confirmed.useEnd, row.auto.useEnd, row.auto.exchangeDate, row.auto.limitText].concat(row.planMonths || []).join(' ');
            if (!dates.includes(month)) return false;
        }
        return true;
    }).sort((left, right) => left.priority - right.priority || Number(left.standKey) - Number(right.standKey) || left.rollId.localeCompare(right.rollId, 'en'));
}
