# Phase C #17 — Code Registry

更新日: 2026-11-01
目的: reason / advisory / guard のmachine codeを1意味=1コードに固定する。

## 1. categories

### reason
判定結果に影響する根拠。
- shortage reason: shortageを確定
- incomplete reason: normal判定を止める

### advisory
準備・注意・参考。
単独ではresultを変更しない。

### guard
危険な推論・変換を禁止する不変条件。
UIの主reasonにはしない。

## 2. incomplete reasons

| code | meaning |
|---|---|
| ACTUAL_CALIBER_CUMULATIVE_17_89 | 17-89現行サイクルのカリバ別実累計未確認 |
| POST_RETURN_DIAMETER_17_90 | 17-90の2026-10-26戻り後実測径未確認 |
| ASSEMBLY_COMPLETION_17_90 | 17-90が組替可能止まりで組込完了実績未確認 |
| NEXT_EXCHANGE_DATE_UNKNOWN | 次回ロール交換必要日未確定 |
| PRODUCTION_OR_CALIBER_PLAN_AFTER_2026_12_10 | 12/10より先の使用計画未接続 |
| MACHINING_TYPE_UNKNOWN | 加工区分が判定に必須な場面で未確認 |
| READINESS_UNKNOWN | ready状態を判定できない |
| EXCHANGE_DATE_UNKNOWN | **使用禁止。NEXT_EXCHANGE_DATE_UNKNOWNへ統一** |

## 3. shortage reasons

| code | meaning |
|---|---|
| DIAMETER_BELOW_FORECAST_MINIMUM | 年間見通し基準290mm未満 |
| NO_READY_SPARE | 必要日に使用可能予備がないことが確定 |
| RETURN_OVERDUE | 改削戻りが必要日より遅いことが確定 |
| ASSEMBLY_OVERDUE | 組込完了が必要日より遅いことが確定 |
| PLANNED_USAGE_EXCEEDS_CONFIRMED_CALIBER_MAX | actual+explicit planで6直上限超過が確定 |

## 4. planning / validation warnings

以下は状況によりreasonまたはvalidation issueとして扱うが、名称を固定する。

| code | meaning |
|---|---|
| PAIR_USAGE_MISMATCH | D10対応ペアの実累計が不一致 |
| CAPACITY_CONFLICT_REQUIRES_PLANNING_DECISION | 上限衝突は見つかったが交換か別カリバか未決定 |

## 5. advisories

| code | meaning |
|---|---|
| READY_SPARE_COUNT_ZERO | 現在の組込完了予備が0 |
| CHOCK_SWAP_CANDIDATE_17_88_TO_17_90 | 17-88→17-90チョック組替候補 |
| R17_88_NEXT_STANDARD_CUT_DIAMETER_VIABLE | 17-88次回標準改削は径面可 |
| R17_89_NEXT_STANDARD_CUT_DIAMETER_VIABLE | 17-89次回標準改削は径面可 |

## 6. guards

| code | meaning |
|---|---|
| PLANNED_SCHEDULE_NOT_ACTUAL | plannedをactualへ昇格しない |
| EXCHANGE_DATE_NOT_DERIVED_FROM_LAST_PLAN_DATE | 最終計画日・組替期限・legacy固定月数を交換日にしない |
| GENERIC_25_DAY_INBOUND_PLAN_NOT_PHASE_C17_LEAD | アプリの+25日仮搬入予定を#17の確定戻り日へ使わない |

## 7. deprecated aliases — 新規使用禁止

| old code | canonical |
|---|---|
| CALIBER_ACTUAL_USAGE_UNKNOWN_17_89 | ACTUAL_CALIBER_CUMULATIVE_17_89 |
| FORECAST_DIAMETER_UNKNOWN_17_90 | POST_RETURN_DIAMETER_17_90 |
| LATEST_RETURN_DIAMETER_UNKNOWN_17_90 | POST_RETURN_DIAMETER_17_90 |
| ACTUAL_CALIBER_CUMULATIVE_REQUIRED_FOR_REMAINING_SHIFTS | ACTUAL_CALIBER_CUMULATIVE_17_89 |
| NO_READY_SPARE_CURRENTLY_INSTALLED | READY_SPARE_COUNT_ZERO（advisory） |
| EXCHANGE_DATE_UNKNOWN | NEXT_EXCHANGE_DATE_UNKNOWN |

deprecated aliasを実装コード・新規テスト・UIへ追加しない。

## 8. current fixture canonical blockers

現行#17のoverall result=`incomplete`を構成する主要reason:
1. ACTUAL_CALIBER_CUMULATIVE_17_89
2. POST_RETURN_DIAMETER_17_90
3. ASSEMBLY_COMPLETION_17_90
4. NEXT_EXCHANGE_DATE_UNKNOWN
5. PRODUCTION_OR_CALIBER_PLAN_AFTER_2026_12_10

READY_SPARE_COUNT_ZEROはadvisoryであり、交換必要日未確定の現時点ではshortage reasonではない。
