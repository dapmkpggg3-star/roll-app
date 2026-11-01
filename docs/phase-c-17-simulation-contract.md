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

つまり、実累計など一部がunknownでも、必要日に予備なし・290mm未満・改削戻り遅延・組替期限超過が既知なら `shortage` を返す。

## 2. 入力の根拠区分

すべての入力値は次のいずれかを持つ。

- `actual_confirmed`: 実績として根拠確認済み
- `rule_confirmed`: 工場運用ルールとして確認済み
- `planned`: 計画値。実績へ昇格させない
- `unknown`: 未確認。0へ変換しない

## 3. #17 固定ルール

- 対象3セット: 17-88 / 17-89 / 17-90
- 改削後の使用可否基準: 290mm以上
- 改削期間: 約25日。これは戻り予定計算のルール値であり、実搬入日が確認できれば実績を優先する。
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
    discardDiameterMm: 290,
    machiningLeadDays: 25
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
  reasons: string[]
}
```

## 6. 判定順序

1. 既知の shortage 条件を評価する。
2. shortageが1つでもあれば `shortage`。
3. shortageがなければ、必須根拠のunknownを評価する。
4. unknownが残れば `incomplete`。
5. 必須根拠がすべて確認済みで、shortage条件がなければ `normal`。

## 7. shortage条件

最低限、次を検出する。

- `DIAMETER_BELOW_290`: 交換時に使用予定ロールの確定径が290mm未満。
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
2. 実累計unknownでも確定径289.9mm → `shortage`
3. 実累計unknownでも必要日にready spare不在が確定 → `shortage`
4. 必要日より改削戻りが遅いことが確定 → `shortage`
5. 必要日より組替完了が遅いことが確定 → `shortage`
6. すべて根拠確認済み・径>=290・予備あり・期限内 → `normal`
7. 改削後実測径320.11mm + 実績減径2.00mmを入力しても318.11mmへ再減算しない
8. planned 59 shift をactual usageとして扱わない
9. unknownを0として扱わない
10. #17の290mmルールを他スタンドへ適用しない

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
- 本番mainの確認済み基点: aacf5b8
- PR #14は未マージ。
- main / 本番GAS / 実業務Sheetsは変更しない。
