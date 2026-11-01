# Phase C — 既存タスク／工作課ボード連携メモ

更新日: 2026-11-01
対象: #17 Phase C と既存 `本日のタスク` / 工作課ボード
目的: Phase C実装時に同じ作業を二重表示しないための統合契約

## 1. 現在のmainで確認できた既存ロジック

`js/app.js` の `getAssemblyCandidateItems(allRoles)` は、同一スタンド内に

- `中古予備（バラシ前）`
- `新品予備（組替可能）` または組替可能な保管ロール

が同時に存在すると組替候補として返す。

`getTodayTaskItems(allRoles)` はその候補を

- title: `組替候補あり`
- priority: `medium`
- reason: `中古予備と新品予備（組替可能）が同一スタンド内に存在`

として既存の「本日のタスク」へ追加する。

#17の2026-11-01ライブ入力では

- 17-88 = 中古予備（バラシ前）
- 17-90 = 新品予備（組替可能）

なので、現行ロジック上は#17が組替候補に該当する。

## 2. Phase Cとの分担

Phase Cは同じ現行作業のために新しい「組替タスク」を作らない。

- **現在の実績状態から発生する組替作業**: 既存 `getAssemblyCandidateItems` / 本日のタスク / 工作課ボードを正とする。
- **将来予測で出る準備注意**: Phase Cの `advisories[]` に保持する。
- 将来advisoryを今日のタスクへ昇格させるのは、予測日が来たからではなく、実績ステータスまたは確定作業条件が既存タスク条件を満たした時とする。
- Phase Cのforecast advisoryと既存today taskを同じIDで二重表示しない。

## 3. #17短期準備の現在地

現在:
- online = 17-89
- used standby = 17-88
- assembly possible = 17-90
- installed ready spare = 0

固定3セットの次状態候補:
- 17-89: online維持
- 17-90: 新品予備（組込完了）へ
- 17-88: チョックを外した後、改削・搬出工程へ

これは「次状態候補」であり、作業実施・完了の実績ではない。

## 4. 期限の意味を分離

17-88には `assemblyInstructionDue=2026-12-18` がライブRolesに登録されている。

mainの工作課ボードは、組替候補の期限計算で
1. 中古予備側の `assemblyInstructionDue`
2. それが無い場合のみオンライン使用終了日から算出した目標日
の順で使う設計。

したがって#17では、短期の工作課準備期限として2026-12-18を使える。

ただし:
- 2026-12-18を17-89の次回ロール交換日へ変換しない。
- `assemblyInstructionDue` と `exchangeDate` は別フィールド。
- 年間シミュレーションの交換日がunknownでも、短期の組替期限はknownであり得る。

## 5. 発見した既存表示不整合

mainの `getTodayTaskWarning(task, allRoles)` は、task idが `assembly-` で始まる場合、期限データを確認せず常に

`⚠ 日程未設定`

を返している。

一方、17-88には2026-12-18の組替指示期限が登録済みで、工作課ボード側はその期限を使える。

したがって現在のコードでは、
- 工作課ボード: 期限あり
- 本日のタスク警告: 日程未設定
という表示不整合が起こり得る。

## 6. Work復帰後の修正方針

保存版46をGitHubへ保全した後でのみ修正する。

最小差分:
- `getTodayTaskWarning` の assembly taskで、対象standの組替候補と `assemblyInstructionDue` を確認する。
- 有効な期限がある場合は `⚠ 日程未設定` を出さない。必要なら期限表示へ置換する。
- 期限が本当に無い場合だけ `⚠ 日程未設定`。
- 工作課ボード側の既存期限計算を複製せず、可能なら共通helperを再利用する。

## 7. 必須回帰テスト

1. #17: 17-88中古予備 + 17-90組替可能 → assembly candidateが1件だけ生成される。
2. 同じ状態からPhase C advisoryを生成してもtoday taskが2件にならない。
3. 17-88 assemblyInstructionDue=2026-12-18 → today taskに「日程未設定」を表示しない。
4. assemblyInstructionDue空欄 + 算出可能な既存期限なし → 「日程未設定」。
5. assemblyInstructionDueをexchangeDateへ代入しない。
6. 17-90を組込完了へ変更後 → 現行assembly candidateが解消する。
7. その時点でも実累計・次回exchangeDate等がunknownならPhase C総合は自動normalにしない。

## 8. 実装境界

この文書は設計・受入条件のみ。
main / 本番PWA / GAS / Google Sheetsは変更しない。
Work保存版46の保全完了前にコード修正しない。
