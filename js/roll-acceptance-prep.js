// Connection preparation for the anonymous dashboard. This file does not open a network connection.
function acceptanceFieldMap() {
    return [
        { item: 'スタンド', roles: 'nameから読む想定。Rolesにスタンド列は無い', sheet: 'ロール管理表のスタンド', production: '生産予定のstandKey', caliber: 'カリバ使用計画のstandKey', state: '対応あり' },
        { item: 'ロール', roles: 'idとname', sheet: 'ロールID', production: '月別予定はスタンド単位。ロールIDは未確認', caliber: 'カリバIDでありロールIDではない', state: '一部未確認' },
        { item: '状態', roles: 'status', sheet: 'ステータス', production: '対応列なし', caliber: '対応列なし', state: '対応あり' },
        { item: '手入力の使用終了', roles: '対応列なし。useEndDateには入れない', sheet: '使用終了日には入れない。赤字予定の保存列は未確認', production: '対応列なし', caliber: '対応列なし', state: '未確認' },
        { item: '手入力の改削', roles: '対応列なし', sheet: '対応列なし', production: '対応列なし', caliber: '対応列なし', state: '未確認' },
        { item: '確定の使用終了', roles: 'useEndDate', sheet: '使用終了日', production: '対応列なし', caliber: '対応列なし', state: '対応あり' },
        { item: '現在径', roles: 'currentDiameter', sheet: 'ロール径', production: '対応列なし', caliber: '対応列なし', state: '対応あり' },
        { item: '廃却径', roles: '対応列なし', sheet: '対応列なし', production: '対応列なし', caliber: '対応列なし。StandMasterのscrapDiameterは別表', state: '未確認' },
        { item: '切込み', roles: '対応列なし。作業履歴の改削量とは別', sheet: '対応列なし', production: '対応列なし', caliber: '対応列なし', state: '未確認' },
        { item: '予備本数', roles: '本数の列は無い。状態からの本数換算は未確認', sheet: '役割ごとの行であり本数合計ではない', production: '対応列なし', caliber: '対応列なし', state: '未確認' },
        { item: '確認済み交換候補', roles: '対応列なし', sheet: '使用終了日とは別', production: '日別の昼停止と照合。月間トン数からは作らない', caliber: '上限到達の見込みとは別', state: '計算' },
        { item: '上限到達の見込み', roles: '対応列なし', sheet: '対応列なし', production: '日別の生産量と時間', caliber: '最大直数と開始直数', state: '計算' },
        { item: '使用回数', roles: '対応列なし', sheet: '対応列なし', production: '計画版の各月。実績があれば実績、無ければ計画', caliber: '直数であり使用回数ではない', state: '計算' },
        { item: '購入', roles: 'orderExpectedDeliveryDateは納入予定であり購入予測日ではない', sheet: '対応列なし', production: 'トン数からは本数も購入日も作らない', caliber: '対応列なし', state: '判定不能' },
        { item: '購入までの期間', roles: '対応列なし', sheet: '対応列なし', production: '対応列なし', caliber: '対応列なし。StandMasterのleadTimeMonthsを採用済みとはしない', state: '暫定6か月。スタンド別の確認は未確認' },
        { item: '固定3セット', roles: 'isActiveThreeSet。ロール3本ではない', sheet: '現場表の役割は使用中・次回組み込み・改削待ち', production: '対応列なし', caliber: '対応列なし', state: '対応あり' },
        { item: '計画版', roles: 'updatedAtはロール更新であり計画版ではない', sheet: '対応列なし', production: '計画版のid、label、対象月', caliber: '確定版と改訂コピー', state: '対応あり' }
    ];
}

function acceptanceForecastTrace() {
    return [
        {
            value: '確認済み交換候補',
            sources: ['日別生産予定の日付・昼勤務・夜勤・生産量', '作業確認の時間・人数・組替・連続操業・固定3セット', 'スタンド別の交換時間'],
            adopted: 'confirmedWorkCandidateに加え、夜勤のみ、昼勤務なし、生産中をダッシュボードで除外する',
            formula: '上限到達日より前で、昼の停止かつ必要時間以上の確保、人数、組替あり、連続操業なし、固定3セットありの日だけを交換候補にする',
            revision: '基準日時と作業日を照合する。計画版の使用回数では交換日を変えない',
            unresolved: ['実台帳に作業確認を保存する列', '6番から9番の確定作業時間']
        },
        {
            value: '上限到達の見込み',
            sources: ['カリバの最大直数', '開始直数', '日別の操業時間'],
            adopted: 'knownCaliberLimitの最大だけを上限にする。通常値は最大にしない',
            formula: '4時間以上を1直として足し、最大直数を超える日を見込みにする。その日は交換候補にしない',
            revision: '日別予定の版に従う。月間トン数からは直数を作らない',
            unresolved: ['サイズが未確認のスタンドの最大直数', '実台帳の開始直数の保存列']
        },
        {
            value: '使用回数',
            sources: ['年間計画版の対象月', '各月の計画使用回数', '各月の実績使用回数'],
            adopted: 'preferredUseCount。直近月は実績を優先する',
            formula: '12か月の採用値を足す。未入力の月があれば合計があっても購入判定はしない',
            revision: 'revision.idとupdatedAtを根拠に残す。後の改訂は固定済みの提出数値を変えない',
            unresolved: ['月別生産予定のトン数を使用回数へ換算する式は採用しない']
        },
        {
            value: '改削残回数',
            sources: ['現在径', '廃却径', '切込み'],
            adopted: '三つの値が数値で、切込みが0より大きいときだけ',
            formula: '（現在径−廃却径）÷切込みの小数切り捨て。改削日にも購入日にもしない',
            revision: '計画版では径を変えない',
            unresolved: ['廃却径と切込みの採用元。StandMasterと作業履歴のどちらを正とするかは未確認']
        },
        {
            value: '購入',
            sources: ['使用回数', '購入までの期間', '発注済みの記録'],
            adopted: '期間が暫定、または本数換算が未確定なら判定不能',
            formula: '暫定6か月は購入日にしない。納入予定日も購入予測日にしない',
            revision: '計画版が変わっても発注済みを推測で埋めない',
            unresolved: ['発注済みを読む列の業務上の正', 'スタンド別に確認済みの購入期間']
        },
        {
            value: '予備',
            sources: ['使用できる予備本数'],
            adopted: '0以上の整数だけを本数にする',
            formula: '0本は警告に残し、不足の確定にはしない。1本以上でも年間必要本数が無いので不足なしにはしない',
            revision: '計画版の再計算で状態を変えない',
            unresolved: ['Rolesの状態から予備本数を数える規則']
        }
    ];
}

function assessReadOnlyConnection(probe) {
    const source = probe || {};
    const stops = [];
    if (source.permission !== 'reader') stops.push('権限不足で停止します。読取専用以外は開始しません。');
    if (source.rolesSheet !== 'present') stops.push('Rolesが無いので停止します。読み取りではシートを作りません。');
    if (source.managementSheet !== 'present') stops.push('ロール管理表が無いので停止します。表は作りません。');
    if (source.productionSchedule !== 'present') stops.push('生産予定が無いので停止します。0や他の予定では埋めません。');
    if (source.caliberPlan !== 'present') stops.push('カリバ使用計画が無いので停止します。直数は作りません。');
    if (source.revisionMatch !== true) stops.push('同期不一致で停止します。ローカルもリモートも上書きしません。');
    if (Number(source.writeCount) > 0) stops.push('書込みを検知したので停止します。');
    if (source.productionMeasure === 'tons') stops.push('生産予定がトン数なので、ロール本数としては読みません。');
    return {
        mode: 'read-only',
        liveConnected: false,
        ready: stops.length === 0 && source.endpointConfigured === true,
        stops,
        note: '実台帳への接続は本人の明示承認が必要です。この確認は通信しません。'
    };
}

function acceptanceExchangeTime(roll) {
    const workType = typeof expectedWorkType === 'function' ? expectedWorkType(roll.standKey) : '';
    const effort = typeof knownWorkEffort === 'function' ? knownWorkEffort(roll.standKey, workType) : null;
    if (!effort || effort.kind !== '確認' || effort.people == null || effort.hours == null) {
        return { id: 'exchange-time', result: '未確認', detail: effort ? effort.text : 'このスタンドの交換時間は確認値ではありません。' };
    }
    const confirmation = roll.workConfirmation;
    if (!confirmation) return { id: 'exchange-time', result: '未確認', detail: '作業確認が無いので、確認済みの時間と照合できません。' };
    if (confirmation.people !== effort.people || confirmation.requiredHours !== effort.hours) {
        return { id: 'exchange-time', result: '停止', detail: effort.text + '今回の人数または時間と違うため、受入済みにしません。' };
    }
    return { id: 'exchange-time', result: '一致', detail: effort.text };
}

function acceptanceDaySlot(roll, revision, referenceAt) {
    const row = buildDashboardRow(roll, revision, referenceAt, null);
    return {
        id: 'day-slot',
        result: row.auto.exchangeDate ? '確認できた日がある' : '作業枠未確認',
        date: row.auto.exchangeDate,
        detail: row.auto.exchange
    };
}

function acceptanceContinuous(roll) {
    const value = roll.workConfirmation && roll.workConfirmation.continuous;
    if (value === 'yes') return { id: 'continuous', result: '停止', detail: '連続操業では交換候補にしません。' };
    if (value === 'no') return { id: 'continuous', result: '連続操業ではない', detail: '連続操業なしと確認しています。' };
    return { id: 'continuous', result: '未確認', detail: '連続操業の確認がありません。' };
}

function acceptanceThreeSet(roll) {
    const value = roll.workConfirmation && roll.workConfirmation.threeSet;
    const detail = '固定3セットは作業枠の確認です。activeThreeSetCountはロール本数ではありません。';
    if (value === 'yes') return { id: 'three-set', result: '作業枠では固定3セットがはい', detail };
    if (value === 'no') return { id: 'three-set', result: '停止', detail: detail + '固定3セットなしでは交換候補にしません。' };
    return { id: 'three-set', result: '未確認', detail };
}

function acceptanceSpare(roll) {
    const detail = describeSpareReadiness(roll.spareCount);
    if (roll.spareCount === undefined || roll.spareCount === null || roll.spareCount === '') {
        return { id: 'spare', result: '未確認', detail };
    }
    if (Number(roll.spareCount) === 0) return { id: 'spare', result: '警告', detail };
    return { id: 'spare', result: '不足なしにはしない', detail };
}

function evaluateAcceptance(roll, revision, referenceAt) {
    return {
        rollId: roll.rollId,
        checks: [
            acceptanceExchangeTime(roll),
            acceptanceDaySlot(roll, revision, referenceAt),
            acceptanceContinuous(roll),
            acceptanceThreeSet(roll),
            acceptanceSpare(roll)
        ]
    };
}
