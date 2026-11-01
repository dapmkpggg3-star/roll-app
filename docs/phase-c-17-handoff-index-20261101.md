# Phase C #17 — Work Handoff Index

更新日: 2026-11-01
対象: Work/Astra再開用
このindexはChat側成果の入口。実装本体ではない。

## 0. 最重要ゲート

Phase C実装より先にWork保存版46をGitHub非本番ブランチへ保全する。

推奨:
- preserve: `work-preserve-v46-20261101`
- implementation: `work-phase-c-17-20261101`

main / PR #14 / 本番GAS / 実Sheetsへ直接入れない。

## 1. 読む順番

### 1
`docs/phase-c-work-implementation-map-20261101.md`
- どのファイルを触るか
- どこでテストするか
- PWA/GAS/Sheetsをいつ触らないか

### 2
`docs/phase-c-17-simulation-contract.md`
- core入力/出力
- normal / shortage / incomplete
- shortage > incomplete > normal
- 290mm年間基準
- 約25日改削
- legacy 3か月/30日helper非流用
- #17 D10/D13最大6直

### 3
`docs/phase-c-17-input-snapshot-20261101.json`
- 17-88 / 17-89 / 17-90の現在fixture
- confirmed / planned / unknown
- current risk breakdown
- planned 59直
- 17-90戻り後径unknown
- 17-91 budget plan only

### 4
`docs/phase-c-17-adapter-test-matrix-20261101.md`
- core / adapter / UIの受入テスト
- 290.00境界
- 25日 vs legacy30日
- 17-90 338誤採用防止
- D10/D13最大6直
- exchange candidate

### 5
`docs/phase-c-17-exchange-candidate-algorithm-20261101.md`
- actual + explicit plannedからcapacity conflictを探す
- conflictを即exchangeDateへ昇格しない
- 自動カリバ割付はまだ行わない

### 6
`docs/phase-c-task-integration-notes-20261101.md`
- 17-88→17-90組替候補は既存today task/workshop board再利用
- 二重タスク禁止
- 12/18 assembly deadline
- 「日程未設定」表示不整合

### 7
`docs/phase-c-dashboard-integration-20261101.md`
- 既存「3セット維持予測」UI再利用方針
- #17だけPhase C adapter
- legacy useStart+3か月を確定交換日にしない
- 現行UIベースライン

### 8
`docs/phase-c-17-missing-data-gate-20261101.md`
- 今の次サイクルに必要な不足情報
- 12か月判定に必要な不足情報
- optional情報
- 17-91を在庫に数えない

### 9
`docs/phase-c-existing-module-reuse-map-20261101.md`
- planning-calibers.jsの再利用境界
- normalizeRunSize / buildProductionRunsは候補
- nextCaliber / projectCaliberChangeは#17 Phase Cへ直接流用しない

### 10
`docs/phase-c-caliber-usage-persistence-20261101.md`
- カリバ別actual累計の保存設計
- Roles/Input/作業履歴へ無理に混ぜない
- 将来hidden CaliberUsage sheetを追加候補
- 0=確認済み未使用、blank=unknown、planned混在禁止

### 11
`docs/phase-c-caliber-usage-template-import-20261101.md`
- 既存「カリバ使用状況_記入用.xlsx」のimport契約
- 行番号固定にせず記入枠を検出
- blank=unknown / 0=confirmed unused
- 基準日必須
- D10 pair mismatchは自動補正しない

### 12
`docs/phase-c-ui-message-map-20261101.md`
- core reason/advisoryの日本語表示
- primary reason優先順位
- スマホ初期表示はreason 1 + action 1 + supplement最大2
- incompleteを安全表示しない

### 13
`docs/phase-c-17-current-expected-output-20261101.json`
- 現行#17 fixtureのゴールデン出力
- result=incomplete
- UI期待値
- 禁止出力まで固定
- Work実装後のgolden testに使用

## 2. 現在の#17結論

### confirmed
- 17-89 online
- 17-88 中古予備（バラシ前）
- 17-90 新品予備（組替可能）
- ready spare（組込完了）= 0
- 17-88 assemblyInstructionDue = 2026-12-18
- 17-88 diameter = 314.90
- 17-89 diameter = 320.11
- 17-88 next standard cut 2.5mm → 312.40（径面可）
- 17-89 next standard cut 2.5mm → 317.61（径面可）
- #17 D10/D13 max = 各カリバ累計6直
- D10 pair = 6+17 / 7+18 / 8+19 / 9+20 / 10+21 / 11+22
- 8+19 = SD345専用
- D13は各カリバ独立
- known planned schedule = 59 operation shifts + 8/19 unknown
- known planned per-caliber totalsは6直上限内

### unknown
- 17-89 current actual cumulative usage
- 17-90 latest post-return measured diameter
- 17-90 assembly completion actual
- next exchange date
- production/caliber plan after 2026-12-10
- 12-month cycle connection

### overall
- result = `incomplete`
- shortage確定ではない
- normalでもない

## 3. 17-90径の注意

- Rolesの338.0は2026-06-08登録。
- Rolesに10/26戻り後のdiameter変更履歴なし。
- WorkHistoryにも改削後径記録なし。
- 16,17表の最新rework rowには338.0表示があるが、初回年間照合資料で「今回戻り後の実測は未確認」と明示済み。
- よってPhase Cでは `forecastDiameterMm=unknown`。

## 4. 17-91

16,17帳票:
- 17-91
- 新径340
- 2026年度予算計上予定

Roles:
- 17-91なし

扱い:
- future procurement referenceのみ
- inventory / 4th set / ready spareに数えない

## 5. Workで最初に実装する順

1. 保存版46remote保全
2. Phase C pure core
3. node:testでcore受入
4. #17 adapter
5. today task期限表示不整合
6. 既存three-set forecast UIへ#17だけ接続
7. 実ブラウザ
8. 必要ならPWA cache version
9. 本番は別工程

## 6. 完成扱いにしないもの

- plannedだけでactual判定
- 17-90の338を戻り後実測扱い
- 2027-01-14 legacy heuristicをexchangeDate扱い
- 12/18 assembly deadlineをexchangeDate扱い
- 12/10 planned coverage endをexchangeDate扱い
- 17-91予算計画を現物扱い
