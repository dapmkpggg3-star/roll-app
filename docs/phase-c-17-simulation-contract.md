# Phase C — #17 12か月3セット予測 契約仕様

更新日: 2026-11-01
対象: #17 の 17-88 / 17-89 / 17-90
用途: Work復帰後に保存版46へ実装するための非本番仕様
本番コード・GAS・Google Sheetsには影響しない。

## 1. 判定の原則

判定結果は次の3値だけを返す。

- `shortage`: 既知の事実だけで不足・期限超過・径下限違反を確定できる。
- `incomplete`: shortageは確定していないが、必要な根拠が不足している。
- `normal`: 必要な根拠がすべて揃い、既知の不足条件がない。

優先順位は必ず:

`shortage > incomplete > normal`

つまり、実累計など一部がunknownでも、必要日に予備なし・改削戻り遅延・組替期限超過などが既知なら `shortage` を返す。#17の年間見通しでは290mmを検討基準として使用する。ただし本番StandMasterの登録値292mmは変更せず、予測基準と本番マスタ値を別項目として保持する。

## 2. 入力の根拠区分

すべての入力値は次のいずれかを持つ。

- `actual_confirmed`: 実績として根拠確認済み
- `rule_confirmed`: 工場運用ルールとして確認済み
- `planned`: 計画値。実績へ昇格させない
- `unknown`: 未確認。0へ変換しない

## 3. #17 固定ルールと本番マスタとの差

- 対象3セット: 17-88 / 17-89 / 17-90
- 年間見通しの検討基準: **改削後290mm以上**。17-88 / 17-89 / 17-90の3本に適用する。
- 本番StandMasterの#17廃却径登録は292mmのまま維持する。Phase Cの検討基準290mmを理由に本番マスタを書き換えない。
- 予測ロジックでは `forecastMinimumDiameterMm=290` と `standMasterScrapDiameterMm=292` を別項目として保持し、意味を混同しない。
- 既存アプリの「搬出+25日」は仮搬入予定表示の一般ルールであり、#17 Phase Cの確定リードタイムには使わない。
- #17の実搬出→搬入履歴22件は29〜80日、中央値51.5日。2024年以降10件は50〜80日、平均64.3日、中央値64日。
- Phase CのreturnDueDateは、実搬入日または明示された確定/予定戻り日がある場合だけ採用する。無ければunknown。
- 64日（直近中央値）・80日（直近最大）は感度分析用のhistorical scenarioであり、確定予定日に昇格しない。
- 通常改削とフラット加工は別イベント。
- 実測径に既に含まれた減径量を再度差し引かない。
- 290mm基準を他スタンドへ自動展開しない。

## 4. 入力データ契約

### SimulationInput

```js
{
  stand: "#17",
  horizonStart: "YYYY-MM-DD",
  horizonEnd: "YYYY-MM-DD",

  rules: {
    forecastMinimumDiameterMm: 290,
    standMasterScrapDiameterMm: 292,
    diameterRuleScope: "#17 annual forecast only",
    temporaryInboundPlanDays: 25,
    reworkLeadDays: null,
    reworkLeadEvidence: "unconfirmed_for_17",
    historicalLeadScenarioDays: {
      recentMedian: 64,
      recentMax: 80
    }
  },

  rolls: [
    {
      rollId: "17-89",
      role: "online" | "ready_spare" | "processing",
      diameterMm: number | null,
      diameterEvidence: "actual_confirmed" | "planned" | "unknown",

      useStartDate: "YYYY-MM-DD" | null,
      useEndDate: "YYYY-MM-DD" | null,

      machining: {
        status: "not_started" | "in_progress" | "returned" | "unknown",
        dispatchDate: "YYYY-MM-DD" | null,
        actualReturnDate: "YYYY-MM-DD" | null,
        plannedReturnDate: "YYYY-MM-DD" | null,
        actualReductionMm: number | null,
        reductionEvidence: "actual_confirmed" | "planned" | "unknown",
        machiningType: "normal" | "flat" | "unknown"
      },

      assembly: {
        dueDate: "YYYY-MM-DD" | null,
        completedDate: "YYYY-MM-DD" | null,
        readinessEvidence: "actual_confirmed" | "planned" | "unknown"
      },

      caliberActualUsage: {
        value: number | null,
        unit: "shift" | null,
        evidence: "actual_confirmed" | "unknown"
      }
    }
  ],

  exchanges: [
    {
      exchangeDate: "YYYY-MM-DD",
      requiredOnlineRollId: string | null,
      source: "actual_confirmed" | "planned" | "unknown"
    }
  ]
}
```

## 5. 出力データ契約

各交換点について次を返す。

```js
{
  exchangeDate: "YYYY-MM-DD",
  onlineRollId: string | null,
  readySpareRollId: string | null,
  processingRollId: string | null,

  diameterMm: number | null,
  machiningStatus: string | null,
  returnDueDate: "YYYY-MM-DD" | null,
  assemblyDueDate: "YYYY-MM-DD" | null,
  caliberActualUsage: number | null,

  evidenceState: {
    diameter: "confirmed" | "planned" | "unknown",
    machining: "confirmed" | "planned" | "unknown",
    assembly: "confirmed" | "planned" | "unknown",
    caliberUsage: "confirmed" | "unknown"
  },

  result: "normal" | "shortage" | "incomplete",
  reasons: string[],

  advisories: [
    {
      code: string,
      severity: "info" | "attention",
      message: string
    }
  ]
}
```

## 5.1 advisories の扱い

`advisories` は実務上の準備・注意喚起であり、`result` と分離する。

- ready spareが現在0でも、次回交換必要日が未確認なら shortage確定にしない。
- 中古予備（バラシ前）と新品予備（組替可能）が同一スタンドにそろっている場合、固定3セット運用の次状態候補としてチョック組替を advisory で示せる。
- advisoryが存在しても `result` は `incomplete` のままあり得る。
- advisoryだけを根拠に本番指示、作業完了、交換日確定へ昇格しない。

#17の現行fixtureでは最低限:
- `READY_SPARE_COUNT_ZERO`
- `CHOCK_SWAP_CANDIDATE_17_88_TO_17_90`
- `NEXT_EXCHANGE_DATE_UNKNOWN`
を保持する。

目標状態は、17-89をオンラインのまま維持し、17-90を新品予備（組込完了）へ、17-88を次の改削・搬出工程へ進められる状態にすること。ただし実際の組替日時・担当・完了は別の実績データで確認する。

## 6. 判定順序

1. 既知の shortage 条件を評価する。
2. shortageが1つでもあれば `shortage`。
3. shortageがなければ、必須根拠のunknownを評価する。
4. unknownが残れば `incomplete`。
5. 必須根拠がすべて確認済みで、shortage条件がなければ `normal`。

## 7. shortage条件

最低限、次を検出する。

- `DIAMETER_BELOW_FORECAST_MINIMUM`: 交換時に使用予定ロールの確定径が年間見通し基準290mm未満。
- `NO_READY_SPARE`: 必要日に使用可能な予備が確定していない、かつ「存在しない」ことが既知。
- `RETURN_OVERDUE`: 必要日より後まで改削戻りが確定して遅れる。
- `ASSEMBLY_OVERDUE`: 必要日より後まで組替完了が確定して遅れる。

注意:
「未確認だから予備がない」は `NO_READY_SPARE` にしない。未確認なら `incomplete`。

## 8. incomplete条件

最低限、次を理由として保持する。

- `CALIBER_ACTUAL_USAGE_UNKNOWN`
- `DIAMETER_UNKNOWN`
- `MACHINING_HISTORY_UNCONFIRMED`
- `MACHINING_TYPE_UNKNOWN`
- `READINESS_UNKNOWN`
- `EXCHANGE_DATE_UNKNOWN`

17-89の2026-10-14開始サイクルのカリバ別実累計は、2026-11-01時点で既存資料から確認できていないため、実装時の現行fixtureでは `CALIBER_ACTUAL_USAGE_UNKNOWN` を理由に `incomplete` になること。

## 9. 二重減径防止

実測径 `diameterMm` が対象改削後の実測値として確認済みの場合:

- `actualReductionMm` は履歴・説明用に保持する。
- シミュレーションの現在径から同じ `actualReductionMm` を再減算しない。

将来の未実施加工だけを径予測へ適用する。

## 10. 必須テスト

1. 17-89: 実累計unknown、既知shortageなし → `incomplete`
2. 年間見通し基準290mmに対して確定径289.9mm → `shortage`
3. 実累計unknownでも必要日にready spare不在が確定 → `shortage`
4. 必要日より改削戻りが遅いことが確定 → `shortage`
5. 必要日より組替完了が遅いことが確定 → `shortage`
6. 全根拠確認済み・径>=290・予備あり・期限内 → `normal`
7. 改削後実測径320.11mm + 実績減径2.00mmを入力しても318.11mmへ再減算しない
8. planned 59 shift をactual usageとして扱わない
9. unknownを0として扱わない
10. #17の290mm年間見通し基準を他スタンドへ適用しない
11. Phase C実装やテストがStandMasterの292mm登録値を自動変更しない
12. 現行状態（17-89 online / 17-88 中古予備（バラシ前） / 17-90 新品予備（組替可能） / 次回交換日unknown）→ resultは `incomplete`、advisoryにREADY_SPARE_COUNT_ZEROとCHOCK_SWAP_CANDIDATEを出す。shortageにはしない
13. 17-90が新品予備（組込完了）になっても次回交換日や実累計がunknownなら、ready spare不足理由は解消しても総合 `normal` へ自動昇格しない

## 11. 実装境界

この仕様を実装するときは、Work保存版46の既存 `forecast-evidence.js` と入力ゲートを再利用する。
このChatから保存版46のファイル本体は取得できていないため、mainから同名ロジックを新規実装して上書きしない。

画面追加は後回し。
まず純粋ロジック + テストのみ。

## 12. 現在の引継ぎ事実

- Phase Aの17-88履歴訂正往復は検証環境で成功。
- Phase Bの入力安全チェックはWork保存版で進展済み。
- 17-89の2.00mm減径は 2026/4/16使用終了 → 5/18搬出 → 7/10搬入 → 320.11mm → 10/14次使用 のサイクルに対応確認済み。
- 加工実施日・測定日・通常改削/フラット区分は未確認。
- 17-89現行サイクルのカリバ別実累計は未確認。
- 年間見通しでは17-88/89/90の検討基準290mmを使用する一方、StandMasterの#17登録は292mmのまま。本番マスタは変更しない。
- 本番mainの確認済み基点: aacf5b8
- PR #14は未マージ。
- main / 本番GAS / 実業務Sheetsは変更しない。


## 13. legacy helperをPhase C #17へ直接流用しない

2026-11-01のmain確認で、既存の3セット予測helperはPhase Cの根拠付き予測と条件が異なることを確認。

### legacy差分
- `getStandOnlineUseMonths(#17)` は3か月固定。
- `getThreeSetForecastReworkReturnDate` は改削戻りを30日で仮計算する。
- 中古予備では、実搬出日がなくても「today+2日」を仮pickupとして30日加算する。
- `getThreeSetForecastCutInfo` は `getRemainingDiameterInfo` の本番StandMaster廃却径を使い、判定が `(currentDiameter - cut) > scrapDiameter`。
- #17 Phase Cの年間見通し基準は「改削後290mm以上」なので境界は `>= 290`。
- 既存アプリの+25日仮搬入表示も、legacyの30日heuristicも、#17 Phase Cの確定戻り日には使わない。
- #17は実搬入日/明示された戻り予定を優先し、無ければunknown。履歴64日中央値/80日最大は感度分析のみ。

### Phase C #17で禁止
- useStart+3か月をexchangeDateへ代入しない。
- dispatch未確認の中古予備にtoday+2日を自動で搬出予定として作らない。
- 30日heuristicをPhase CのreturnDueDateへ使わない。
- StandMaster 292mmと `>` 判定を、年間見通し290mm以上判定へ流用しない。
- 既存helperの出力をevidence=`actual_confirmed`へ昇格しない。

### Phase C #17で使用
- forecast minimum = 290mm、境界含む `>= 290`
- rework return = 実績/明示予定がある時だけ確定。+25日仮搬入・30日legacyを確定値へ使わない
- dispatch/return/exchangeが未確認ならunknown
- heuristicを表示補助に残す場合も、Phase Cの根拠付きresultとは別ラベルにする


## 14. evidence coverage horizon

Phase Cは「データがどこまで存在するか」と「交換日」を分離する。

最低限:
```js
coverage: {
  actualDataThrough: "YYYY-MM-DD" | null,
  plannedCaliberScheduleThrough: "YYYY-MM-DD" | null,
  assemblyInstructionDue: "YYYY-MM-DD" | null,
  exchangeDate: "YYYY-MM-DD" | null,
  exchangeDateEvidence: "actual_confirmed" | "planned_confirmed" | "unknown"
}
```

#17現行fixture:
- actualDataThrough = 2026-11-01
- plannedCaliberScheduleThrough = 2026-12-10
- assemblyInstructionDue = 2026-12-18
- exchangeDate = unknown

禁止:
- planned schedule最終日をexchangeDateへ変換しない
- assemblyInstructionDueをexchangeDateへ変換しない
- coverageが存在するだけで12か月normalへ昇格しない


## 15. #17 カリバ使用上限ルール

2026-10-23本人確認済みルールをPhase Cへ追加。

### D10
- 最大使用直数: 各カリバ累計6直
- 必ず対応する西東ペアで使用
- ペア:
  - 6 + 17
  - 7 + 18
  - 8 + 19（SD345専用）
  - 9 + 20
  - 10 + 21
  - 11 + 22
- ペア使用時、同じ操業直数を両カリバの累計へ加算する。
- 操業直数の総計はペアを1回として数え、2倍にしない。
- 8+19はSD345専用。通常D10へ自動統合しない。
- 1チャージを1直へ自動換算しない。

### D13
- 対象: 1〜5、12〜16
- 各カリバ累計最大6直
- D10のペア使用ルールを流用しない。
- 同じカリバを複数期間使う場合は累計を維持する。
  - 例: 14番 2直 + 後日2直 = 累計4直
- カリバ番号順に自動で使い切る前提を置かない。

### 計算契約

```js
remainingShifts = maxShiftsPerCaliber - actualCumulativeShifts
```

ただしactualCumulativeShiftsがunknownならremainingShiftsもunknown。

plannedを加えた予測:
```js
projectedCumulative = actualConfirmed + plannedFuture
```
は、actualConfirmedが存在する場合だけ算出する。

禁止:
- actual unknownを0と仮定してremaining=6とする
- planned過去期間をactualへ自動昇格する
- D10ペアを操業直数で2倍計上する
- D13へD10ペアロジックを適用する

### 上限判定
- actual cumulative > 6: 実績超過として要確認/異常フラグ
- actual confirmed + planned future > 6: 計画超過警告
- =6は上限到達であり超過ではない


## 16. #17 rework lead-time evidence

参照:
`docs/phase-c-17-rework-lead-history-20261101.json`

ライブ16,17履歴から完全な搬出・搬入日を持ち、時系列が正しい22サイクルを抽出。

- 全22件: 29〜80日、平均53.9日、中央値51.5日
- 2024年以降10件: 50〜80日、平均64.3日、中央値64日

### Phase Cの扱い

優先順位:
1. actualReturnDate
2. 明示されたconfirmed/planned return date（根拠付き）
3. 無ければreturnDueDate = unknown

historical scenario:
- recentMedianDays=64
- recentMaxDays=80

は、3セットが遅延に耐えられるかの感度分析へだけ使用する。

### 禁止

- +25日仮搬入を#17のconfirmed returnDueへ使う
- legacy30日を#17のconfirmed returnDueへ使う
- 64日中央値を業者納期として断定する
- 80日最大を必ず掛かる日数として断定する

### scenario判定

将来、exchangeDateがconfirmedになった場合:
- 64日scenarioでも間に合う
- 80日stress scenarioでも間に合う
をadvisoryとして計算してよい。

ただしscenario passだけでnormalへ昇格しない。
