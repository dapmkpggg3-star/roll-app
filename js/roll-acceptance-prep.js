// Connection preparation for the anonymous dashboard. This file does not open a network connection.
function sourceColumnMap() {
    return [
        { item: 'recordKind', source: '日別オブジェクトのrecordKindだけ', column: '生産予定にもロールカリバ替予定にも、この名前の保存列は見当たりません', read: '値が計画・実績、またはplan・actualのときだけその区分。無い日は区分未確認で、実績とは呼びません', state: '未確認' },
        { item: '月次の計画使用回数', source: '操業計画の版のplannedUseCount', column: '生産予定の日別列ではありません', read: '実績が無い月は計画を使います。予定を実績にはしません', state: '対応あり' },
        { item: '月次の実績使用回数', source: '操業計画の版のactualUseCount', column: '生産予定の日別列ではありません', read: '数値がある月だけ実績を優先します。空欄は0にしません', state: '対応あり' },
        { item: 'productionByTeam', source: '生産予定シートの読み取り', column: '保存記録の9月・10月ではL14が操業A、N14が操業B。値は日産。6月の同じセルは未確認', read: '空欄はnullのままです。0にはしません。合計はセルJで、保存記録ではLとNの和です。Jが無ければAとBが両方あるときだけ足します', state: '一部未確認' },
        { item: '日別の日付', source: 'シート名の年月と、生産予定はセルD、ロールカリバ替予定はセルBの連続した日', column: '保存記録の9月・10月はセルDの日番号。ロールカリバ替予定2026.10はセルB。6月の列記号は未確認', read: 'シート名に年月が無い生産予定は読みません', state: '一部未確認' },
        { item: 'サイズ', source: '生産予定のセルG。ロールカリバ替予定2026.10のサイズはセルD', column: '保存記録の9月・10月はセルG。Fはサイズコードで、Dサイズではありません。6月の列記号は未確認', read: 'Dで始まる値をサイズにします。数値の0tは休止にします。生産量が欠損しても0tの休止にはしません', state: '一部未確認' },
        { item: '操業A/B', source: '生産予定のHはⅠ勤、IはⅢ勤。班の文字を読みます。操業Aと操業Bの見出しはLとN', column: 'ロールカリバ替予定2026.10のEとHは班、GとJは勤。生産予定のH・Iと同じ列ではありません。6月の列記号は未確認', read: 'AとB以外は空欄のままです。空欄をAやBに補完しません', state: '一部未確認' },
        { item: '常昼', source: 'ロールカリバ替予定2026.10のK5以降が常昼の作業文言', column: '生産予定の保存列ではありません。6月の列記号は未確認', read: '常昼の記入語の一覧は未確認です。テンプレートの記入例は確認済み停止枠にしません', state: '一部未確認' },
        { item: '作業予定', source: '確認済みの2026.10配置だけを使う。EとHは班、Kは作業文言として読む', column: '保存記録の2026.10では作業文言はK。EとHは班です。Nは作業欄として確認できません。6月の作業欄の列記号は未確認', read: 'Nと未確認の月は未確認のまま止め、作業にも交換可能日にもしません。予定件数と区分は資料の列名ではありません。件数不明を0件にはしません', state: '一部未確認' },
        { item: '操業時間', source: '生産予定のセルP。保存記録ではP13が圧延作業時間', column: '6月の列記号は未確認。交換可能時間の列ではありません', read: '空欄はnull。4時間以上だけ1直、2時間未満と2時間以上4時間未満は1直にしません', state: '一部未確認' }
    ];
}

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
        { item: '予定表上の交換候補日', roles: '対応列なし', sheet: '使用終了日とは別。予定表に書いてある日付', production: '日別予定があっても、この日付だけでは作業可能にしない', caliber: '上限到達の見込みとは別', state: '計算' },
        { item: '確認済み交換可能日', roles: '対応列なし', sheet: '使用終了日とは別。予定表の日付だけでは確定しない', production: '昼間の停止枠が明示され、夜勤のみ・生産中・連続操業ではない日', caliber: '上限到達の見込みとは別', state: '計算' },
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
            value: '予定表上の交換候補日',
            sources: ['ロールカリバ替予定表の現在の計画', '予定件数'],
            adopted: '同じスタンド、同じ作業種別、基準日以降の予定行。0件は候補日にしない',
            formula: '書いてある日付を予定表上の候補にする。件数不明は日付だけ残し、作業量は確定しない。実施可能とはしない',
            revision: '過去の計画と完了実績は将来の候補にしない',
            unresolved: ['作業欄の正式な小見出し']
        },
        {
            value: '確認済み交換可能日',
            sources: ['予定表上の交換候補日', '日別操業予定の昼間の停止枠', '作業確認', '予定件数'],
            adopted: '正の件数、明示された昼間の停止枠、同じ日の昼間の作業確認がそろったときだけ',
            formula: '日別予定があるだけでは確定しない。夜勤のみ、生産中、連続操業、件数不明、0件は作業枠未確認のままにする',
            revision: '基準日時と作業日を照合する。計画版の使用回数でも所要時間でも交換日を変えない',
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

function acceptanceSourceFindings() {
    return [
        {
            id: 'stand-10-hours',
            resolved: '10番と11番の3人・経過1時間はカリバ替だけです。同じスタンドのロール替は3人・経過6時間で、出典はどちらも2026-09-05のコード上の確認値です。サイズ替と組替にはこの時間の定義がありません。',
            unresolved: '2026-09-05の原本資料そのものはこのリポジトリにありません。',
            impact: '3人・1時間はカリバ替の補助情報です。予定表の行が無い限り、交換可能日には使いません。ロール替の6時間、サイズ替、組替にも流用しません。'
        },
        {
            id: 'handwritten-plan',
            resolved: 'ロール履歴の使用終了日はoffset 14です。赤・青・灰の文字色、または「予」は予定としてplannedになります。plannedの使用終了は完了サイクルにしません。',
            unresolved: 'Rolesとロール管理表に、赤字の将来予定を手入力列として保存する独立列は見当たりません。ダッシュボードの手入力へどの履歴セルを載せるかは未確認です。',
            impact: '予定の使用終了を確定のuseEndDateや交換候補へ入れません。列が未確認の間は手入力予定を空のままにします。'
        },
        {
            id: 'scrap-diameter',
            resolved: '予測が読む廃却径は、読込済みStandMasterの同じスタンドのscrapDiameterです。スタンド不一致や未記録はnullで、他スタンドの径は使いません。',
            unresolved: 'local/stand-premises.jsonは未配置です。StandMasterを実読込する承認はまだありません。',
            impact: '廃却径が無いと改削残回数は出さず、0回にもしません。'
        },
        {
            id: 'cut-mm',
            resolved: '予測のpremisesFactは、有効な改削マスタのcalculationCutMmだけを採用します。標準値と実績平均では埋めません。',
            unresolved: '台帳画面のgetRemainingDiameterInfoは計算用が空のとき標準値へ落ちます。予測と台帳画面のどちらを業務の正とするかは未確認です。',
            impact: '予測では切込みが無いと改削残回数を出さず、標準値で補完しません。'
        },
        {
            id: 'spare-count',
            resolved: '年間見通しの予備数は、台帳があるとき同じスタンドで状態が組込完了またはinstalledSpareの件数です。台帳が空ならnullで、0にはしません。',
            unresolved: '中古予備や新品保管を予備本数に数える規則は未確認です。ダッシュボードは件数を自分で数えず、渡されたspareCountだけを見ます。',
            impact: '本数が未確認なら不足なしにはしません。0本は警告だけで、不足の確定にはしません。'
        },
        {
            id: 'purchase-lead',
            resolved: '未保存の購入期間は暫定6か月です。確認済みになるのはstand_lead_times_v1でstatusがconfirmedのときだけです。StandMasterの月数があっても、leadTimeConfirmedがtrueでない限り購入日にはしません。',
            unresolved: 'スタンド別の確認済み月数は実台帳を読んでいません。fetchStandMasterはleadTimeMonthsだけで、確認済みフラグは返していません。',
            impact: '暫定の期間では購入を判定不能のままにし、購入日を作りません。'
        },
        {
            id: 'work-confirmation',
            resolved: '交換の作業確認は画面の作業日、昼夜、種別、必要時間、人数、連続操業、組替、固定3セットです。組替枠は別入力で、交換の1時間を初期値にしません。',
            unresolved: 'これらの項目をRolesの列として保存する定義は見当たりません。',
            impact: '作業確認が無い、種別が違う、確認値と時間が違う、6から9番のように確認値が無い場合は交換候補を出しません。'
        },
        {
            id: 'stands-6-9',
            resolved: '6番から9番のカリバ替は対象外です。10番の1時間も、2026-05-08の4時間も使いません。人数と時間はnullです。',
            unresolved: '6番から9番の確認済み人数と経過時間はコードにも資料にもありません。',
            impact: '対象外のスタンドは、手入力で1時間と入れても交換候補にしません。'
        }
    ];
}

function acceptanceExchangeTime(roll) {
    if (!roll.workConfirmation) {
        const workType = typeof expectedWorkType === 'function' ? expectedWorkType(roll.standKey) : '';
        const effort = typeof knownWorkEffort === 'function' ? knownWorkEffort(roll.standKey, workType) : null;
        return { id: 'exchange-time', result: '未確認', detail: effort && effort.kind !== '確認' ? effort.text : '作業確認が無いので、確認済みの時間と照合できません。' };
    }
    const decision = dashboardConfirmedEffort(roll.standKey, roll.workConfirmation);
    if (!decision.ok && /補助情報|確認値ではない|未確認/.test(decision.note)) return { id: 'exchange-time', result: '未確認', detail: decision.note };
    if (!decision.ok) return { id: 'exchange-time', result: '停止', detail: decision.note };
    return { id: 'exchange-time', result: '一致', detail: decision.note };
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
