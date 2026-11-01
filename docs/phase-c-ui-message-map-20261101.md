# Phase C #17 — UI Message Mapping

更新日: 2026-11-01
対象: 既存「3セット維持予測」カードへのPhase C adapter
目的: coreのreason/advisoryを、短く実務的な日本語へ統一する。

## 1. 基本

coreはmachine codeを返す。
UI adapterが日本語へ変換する。

core:
- result
- reasons[]
- advisories[]

UI:
- judgment
- reason
- action
- supplement

core内に日本語文言を埋め込みすぎない。

## 2. result mapping

- normal -> 維持可能
- shortage -> 不足見込み
- incomplete -> 要確認

入力そのものが欠け、表示対象すら作れない場合だけ「データ不足」。

## 3. primary reason選択

複数reasonがある場合、優先度:

### shortage
1. NO_READY_SPARE
2. ASSEMBLY_OVERDUE
3. RETURN_OVERDUE
4. DIAMETER_BELOW_FORECAST_MINIMUM
5. PLANNED_USAGE_EXCEEDS_CONFIRMED_CALIBER_MAX
6. その他shortage

### incomplete
1. ACTUAL_CALIBER_CUMULATIVE_17_89
2. POST_RETURN_DIAMETER_17_90
3. ASSEMBLY_COMPLETION_17_90
4. NEXT_EXCHANGE_DATE_UNKNOWN
5. PRODUCTION_OR_CALIBER_PLAN_AFTER_2026_12_10
6. MACHINING_TYPE_UNKNOWN
7. その他unknown

## 4. message map

| code | reason表示 | action |
|---|---|---|
| ACTUAL_CALIBER_CUMULATIVE_17_89 | 17-89のカリバ累計が未確認 | 現在の累計直数を確認 |
| POST_RETURN_DIAMETER_17_90 | 17-90の今回戻り後径が未確認 | 338mmを使わず戻り後の実測径を確認 |
| ASSEMBLY_COMPLETION_17_90 | 17-90はまだ組替可能の状態 | 組込完了を確認 |
| NEXT_EXCHANGE_DATE_UNKNOWN | 次回ロール交換日が未確定 | 使用実績と次の生産予定を確認 |
| PRODUCTION_OR_CALIBER_PLAN_AFTER_2026_12_10 | 12/10より先の使用予定が未接続 | 次の生産予定を接続 |
| DIAMETER_BELOW_FORECAST_MINIMUM | 改削後径が290mm未満 | 別ロール・購入候補を確認 |
| RETURN_OVERDUE | 改削戻りが必要日に間に合わない | 戻り予定・代替候補を確認 |
| ASSEMBLY_OVERDUE | 組替完了が必要日に間に合わない | 工作との組替予定を確認 |
| NO_READY_SPARE | 必要日に組込完了予備がない | 予備・組替・代替候補を確認 |
| PLANNED_USAGE_EXCEEDS_CONFIRMED_CALIBER_MAX | カリバ使用計画が6直上限を超える | 使用カリバ・計画変更を確認 |
| PAIR_USAGE_MISMATCH | D10ペアの累計直数が一致しない | 2本の実績を再確認 |

## 5. advisory map

| code | supplement候補 |
|---|---|
| READY_SPARE_COUNT_ZERO | 現在、組込完了予備は0セット |
| CHOCK_SWAP_CANDIDATE_17_88_TO_17_90 | 17-88→17-90の組替候補あり |
| NEXT_EXCHANGE_DATE_UNKNOWN | 次回交換日は未確定 |
| R17_88_NEXT_STANDARD_CUT_DIAMETER_VIABLE | 17-88は次回標準改削の径余裕あり |
| R17_89_NEXT_STANDARD_CUT_DIAMETER_VIABLE | 17-89は次回標準改削の径余裕あり |

## 6. 現行#17表示例

core:
- result=incomplete
- reasons:
  - ACTUAL_CALIBER_CUMULATIVE_17_89
  - POST_RETURN_DIAMETER_17_90
  - NEXT_EXCHANGE_DATE_UNKNOWN
- advisories:
  - READY_SPARE_COUNT_ZERO
  - CHOCK_SWAP_CANDIDATE_17_88_TO_17_90

UI:
- judgment: 要確認
- reason: 17-89のカリバ累計が未確認
- action: 現在の累計直数を確認
- supplement: 組替候補あり／組込完了予備0／次回交換日未確定

## 7. 表示量

スマホで詰め込みすぎない。

初期表示:
- judgment 1
- primary reason 1
- action 1
- supplement最大2件

残りreasons/advisoriesは詳細展開。

## 8. 禁止

- incompleteを「安全」「問題なし」と表示しない
- ready spare=0だけで不足確定と表示しない
- 338mmを戻り後実測として表示しない
- 2027/1/14を確定次回交換日として表示しない
- plannedを「実績」と書かない


## 9. code category

- `reasons[]`: 判定を止める／不足を確定する根拠。
- `advisories[]`: 注意・準備候補。単独ではresultを変えない。
- `guards[]`: planned→actual化やexchangeDate捏造など、禁止する変換ルール。

同じ意味の別名codeを追加しない。
17-90戻り後径のcanonical codeは `POST_RETURN_DIAMETER_17_90`。
