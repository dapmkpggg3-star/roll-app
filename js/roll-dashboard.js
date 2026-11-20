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

function dashboardConfirmedEffort(stand) {
    const expected = typeof expectedWorkType === 'function' ? expectedWorkType(stand) : '';
    const effort = typeof knownWorkEffort === 'function' ? knownWorkEffort(stand, expected) : null;
    const auxiliary = effort && effort.text ? effort.text : 'この作業の所要時間は未確認です。';
    return { ok: false, auxiliary, note: `${auxiliary}所要時間は補助情報です。交換可能日の確定には使いません。` };
}

function dashboardReplacementSets(entry) {
    if (!entry || entry.packedFromHours === true) {
        return { sets: null, countState: '時間から作成', note: '所要時間からセット数は作りません。8時間枠へは詰め込みません。' };
    }
    if (entry.setsWritten === undefined || entry.setsWritten === null || entry.setsWritten === '') {
        return { sets: null, countState: '件数不明', note: '予定件数が不明なので、確認済み交換可能日にも作業量にもしません。' };
    }
    const sets = Number(entry.setsWritten);
    if (!Number.isInteger(sets) || sets < 0) {
        return { sets: null, countState: '件数不明', note: '予定表の件数を確認できないので、確認済み交換可能日にも作業量にもしません。' };
    }
    if (sets === 0) {
        return { sets: null, countState: '0件', note: '予定件数が0件なので、交換候補日は確定しません。' };
    }
    return { sets, countState: '正の件数', note: '予定表に書かれた正の件数です。時間枠からの割増はしていません。' };
}

function dashboardWorkReady(roll, date, expected, day) {
    const described = typeof describeExchangeSlot === 'function'
        ? describeExchangeSlot(roll && roll.workConfirmation, day, expected)
        : { ok: false, state: '未確認', note: '作業枠の判定を読み込めないので、確認済み交換可能日にはしません。' };
    if (String(date || '').slice(0, 10) !== String(day && day.date || '').slice(0, 10)) {
        return { ok: false, state: '未確認', note: '作業確認の日付が予定日と違うので、作業枠未確認です。' };
    }
    return described;
}

function dashboardReplacementCandidate(roll, referenceAt) {
    const reference = String(referenceAt || '').slice(0, 10);
    const expected = typeof expectedWorkType === 'function' ? expectedWorkType(roll.standKey) : '';
    const rows = Array.isArray(roll.replacementPlan) ? roll.replacementPlan : [];
    const hours = dashboardConfirmedEffort(roll.standKey);
    if (!rows.length) {
        return { date: null, sets: null, listedDate: null, countState: '予定なし', note: `${hours.note}ロールカリバ替予定表が無いので、交換可能日も追加可能量も確定しません。` };
    }
    const notes = [hours.note];
    let chosen = null;
    let listed = null;
    let sawZero = false;
    rows.forEach(entry => {
        const stand = String(entry && entry.standKey || '').replace(/^#/, '');
        if (stand !== String(roll.standKey || '').replace(/^#/, '')) {
            notes.push('別スタンドの予定は使いません。');
            return;
        }
        if (!expected || entry.workType !== expected) {
            notes.push('作業種別が違う予定は交換日にしません。');
            return;
        }
        if (entry.kind === 'actual') {
            notes.push('作業完了実績は将来の交換日にしません。');
            return;
        }
        if (entry.kind !== 'plan') {
            notes.push('予定か実績かが未確認なので、交換日にしません。');
            return;
        }
        const date = String(entry.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < reference) {
            notes.push('過去の予定や日付未確認は、将来の交換日にしません。');
            return;
        }
        const capacity = dashboardReplacementSets(entry);
        notes.push(capacity.note);
        if (capacity.countState === '0件') {
            sawZero = true;
            return;
        }
        if (capacity.countState !== '正の件数' && capacity.countState !== '件数不明') return;
        if (!listed || date < listed.date) listed = { date, countState: capacity.countState, sets: capacity.sets };
        if (capacity.countState !== '正の件数') return;
        if (entry.withinShift !== 'yes') {
            notes.push('その直内で終える確認が無いので、確認済み交換可能日にはしません。');
            return;
        }
        if (entry.constraintsKnown !== 'yes') {
            notes.push('休憩、暑熱、段取り、組み合わせが未確認なので、確認済み交換可能日にはしません。');
            return;
        }
        if (entry.continuous === 'yes') {
            notes.push('連続操業では交換日にしません。');
            return;
        }
        const day = (roll.days || []).find(item => String(item && item.date || '').slice(0, 10) === date);
        if (!day) {
            notes.push('日別操業予定が無いので、確認済み交換可能日は確定しません。');
            return;
        }
        if (day.daytimeStop !== 'yes') {
            notes.push('日別操業予定があるだけでは作業可能にしません。昼間の停止枠が明示されていないので、作業枠未確認です。');
            return;
        }
        const work = dashboardWorkReady(roll, date, expected, day);
        if (!work.ok) {
            notes.push(work.note);
            return;
        }
        if (!chosen || date < chosen.date) chosen = { date, sets: capacity.sets };
    });
    const listedDate = listed ? listed.date : null;
    const countState = listed ? listed.countState : (sawZero ? '0件' : '予定なし');
    const base = { jobs: rows.length, listedDate, countState, note: notes.join('') };
    if (!chosen) return Object.assign({ date: null, sets: null }, base);
    return Object.assign(base, {
        date: chosen.date,
        sets: chosen.sets,
        period: '現在の計画',
        note: `予定表上の交換候補日は${listedDate}です。確認済み交換可能日は${chosen.date}です。予定表に書いてあるだけでは実施可能とはしません。上限到達の見込みとは別です。${notes.join('')}`
    });
}

function replacementTemplateColumns() {
    return ['日付', '曜日', 'サイズ', '操業A', '操業B', '常昼', '作業予定', '予定件数', '区分'];
}

function anonymousReplacementTemplate() {
    return {
        title: '匿名ロールカリバ替予定',
        note: '実ブックは開いていません。2026年6月度の保存記録で確認できた見出し名は、日付、曜日、サイズ、操業A/B、常昼、各作業予定です。その月の列記号は未確認です。下の行は匿名の記入例で、6月の実値ではありません。予定件数と区分は、件数不明と過去・現在・実績を分けて残すための欄です。',
        columns: replacementTemplateColumns(),
        rows: [
            { 日付: '2026-04-02', 曜日: '木', サイズ: 'D1', 操業A: 'A', 操業B: '', 常昼: '記入あり', 作業予定: '#10 カリバ替', 予定件数: 1, 区分: '過去の計画' },
            { 日付: '2027-04-02', 曜日: '金', サイズ: 'D1', 操業A: 'A', 操業B: '', 常昼: '記入あり', 作業予定: '#10 カリバ替', 予定件数: 1, 区分: '現在の計画' },
            { 日付: '2026-08-20', 曜日: '木', サイズ: 'D1', 操業A: '', 操業B: '', 常昼: '記入あり', 作業予定: '#10 カリバ替', 予定件数: 1, 区分: '完了実績' }
        ]
    };
}

function classifyReplacementTemplateRow(row, referenceAt) {
    const label = String(row && row.区分 || '');
    const date = String(row && row.日付 || '').slice(0, 10);
    const reference = String(referenceAt || '').slice(0, 10);
    if (label === '完了実績') return '完了実績';
    if (label === '過去の計画' || (date && reference && date < reference)) return '過去の計画';
    if (label === '現在の計画' && date >= reference) return '現在の計画';
    return '未確認';
}

function replacementJobsFromTemplate(template, standKey) {
    const stand = String(standKey || '').replace(/^#/, '');
    return (template && template.rows || []).filter(row => String(row.作業予定 || '').includes('#' + stand)).map(row => ({
        standKey: stand,
        date: row.日付,
        workType: String(row.作業予定 || '').includes('カリバ替') ? 'caliberChange' : '',
        kind: row.区分 === '完了実績' ? 'actual' : 'plan',
        withinShift: '',
        constraintsKnown: '',
        setsWritten: row.予定件数,
        daytime: row.常昼,
        operationA: row.操業A,
        operationB: row.操業B,
        size: row.サイズ
    }));
}

function dashboardConfirmedExchange(roll, referenceAt) {
    return dashboardReplacementCandidate(roll, referenceAt);
}

function dashboardExchange(roll, referenceAt) {
    const confirmed = dashboardConfirmedExchange(roll, referenceAt);
    let limitText = '日別の操業予定がないので、上限到達の見込みは出しません。予定表の日付だけでは作業可能にしません。';
    if (Array.isArray(roll.days) && roll.days.length > 0 && typeof projectCaliberReplacement === 'function') {
        const projected = projectCaliberReplacement({
            standKey: roll.standKey,
            referenceDate: String(referenceAt || '').slice(0, 10),
            currentCaliber: roll.currentCaliber,
            openingUsedRuns: roll.openingUsedRuns,
            size: roll.size,
            days: roll.days
        });
        limitText = dashboardLimitText(projected);
    }
    const listedDate = confirmed.listedDate || null;
    const listedText = listedDate || 'なし';
    const listedSentence = listedDate
        ? `予定表上の交換候補日は${listedDate}です。予定表に書いてあるだけでは実施可能とはしません。`
        : '予定表上の交換候補日はありません。';
    if (!confirmed.date) {
        return {
            date: null,
            text: '作業枠未確認',
            listedDate,
            listedText,
            countState: confirmed.countState || '予定なし',
            limitText,
            reason: `確認済み交換可能日は作業枠未確認です。${listedSentence}${confirmed.note || ''}${limitText}交換候補にはしません。`
        };
    }
    return {
        date: confirmed.date,
        text: confirmed.date,
        listedDate,
        listedText,
        countState: confirmed.countState,
        limitText,
        reason: `予定表上の交換候補日は${listedText}です。確認済み交換可能日は${confirmed.date}です。予定表に書いてあるだけでは実施可能とはしません。${confirmed.note}${limitText}`
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
            listedExchange: exchange.listedText,
            countState: exchange.countState,
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
            source: `${roll.rollId} / スタンド#${roll.standKey} / ${roll.status} / 現在径${roll.currentDiameter === '' ? '未確認' : roll.currentDiameter} / 廃却径${roll.scrapDiameter === '' ? '未確認' : roll.scrapDiameter} / カリバ${roll.currentCaliber || '未確認'} / 開始直数${Number.isInteger(roll.openingUsedRuns) ? roll.openingUsedRuns : '未確認'} / recordKindの保存列は未確認 / 保存記録の9月・10月ではLが操業A、Nが操業B。6月のセル番地は未確認`,
            formula: '使用回数は計画版の各月で、実績があれば実績、無ければ計画を足します。上限到達の見込みは交換日にしません。予定表上の交換候補日はロールカリバ替予定表の現在の計画です。確認済み交換可能日は、正の予定件数、昼間の停止枠、作業人数、必要時間と確保時間、組替準備、固定3セットが成立した日だけです。欠損した生産量は0tにしません。所要時間から件数は増やしません。改削残回数は（現在径−廃却径）÷切込みです。購入日にはしません。',
            steps: [
                `入力: ${(roll.days || []).map(dashboardDayTrace).join(' / ') || '日別の操業予定はない'}`,
                exchange.limitText,
                exchange.reason,
                `判断: 予定表上の交換候補日は${exchange.listedText}。確認済み交換可能日は${exchange.text}。上限到達の見込みとは別です。`,
                '列対応: 日付D、サイズG、Ⅰ勤H、Ⅲ勤I、日産J、操業AはL、操業BはN、圧延時間Pは9月・10月の保存記録と一致。6月のセル番地は未確認。作業文言の保存記録はK。コードはE・H・K・Nも読む。',
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

function dashboardDayTrace(day) {
    const amount = day && typeof day.productionAmount === 'number' && Number.isFinite(day.productionAmount) ? String(day.productionAmount) : '欠損';
    const hours = day && typeof day.operatingHours === 'number' && Number.isFinite(day.operatingHours) ? String(day.operatingHours) : '欠損';
    const kind = typeof dayQuantityClass === 'function' ? dayQuantityClass(day) : '区分未確認';
    const teams = day && day.productionByTeam ? `A:${day.productionByTeam.A === 0 || day.productionByTeam.A ? day.productionByTeam.A : '欠損'} B:${day.productionByTeam.B === 0 || day.productionByTeam.B ? day.productionByTeam.B : '欠損'}` : '勤務別は未確認';
    return `${day && day.date || '日付未確認'} 生産量${amount} 時間${hours} 区分${kind} 勤務別${teams}`;
}

function compareDashboardForecasts(fixture) {
    const source = fixture || anonymousDashboardFixture();
    const revision = source.revisions[0];
    const changed = source.revisions[1] || revision;
    const roll = source.rolls[0];
    const normal = buildDashboardRow(roll, revision, source.referenceAt, null);
    const missingRoll = Object.assign({}, roll, {
        days: (roll.days || []).map((day, index) => index === 0 ? Object.assign({}, day, { productionAmount: null }) : day)
    });
    const missing = buildDashboardRow(missingRoll, revision, source.referenceAt, null);
    const revised = buildDashboardRow(roll, changed, source.referenceAt, revision);
    const pack = row => ({
        listed: row.auto.listedExchange,
        confirmed: row.auto.exchange,
        limit: row.auto.limitText,
        useCount: row.auto.totalUseCount
    });
    return { normal: pack(normal), missing: pack(missing), revised: pack(revised) };
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
        add('予測', '予定表上の交換候補日', row.auto.listedExchange);
        add('予測', '確認済み交換可能日', row.auto.exchange);
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
