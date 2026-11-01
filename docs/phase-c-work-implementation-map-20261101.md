# Phase C #17 — Work実装マップ

更新日: 2026-11-01
目的: Work/Astraが保存版46を保全した後、迷わず最小差分でPhase Cを実装するためのファイル境界

## 0. 最初のゲート

Phase C実装より先に、Work保存版46をGitHub非本番ブランチへ保全する。

推奨:
- preserve branch: `work-preserve-v46-20261101`
- implementation branch: `work-phase-c-17-20261101`

保存版46に存在するPhase Bファイル名・テスト名を確認し、それを正とする。
mainに存在しないからといって、同名ファイルをmain基点で作り直さない。

## 1. Phase C core

保存版46に `js/forecast-evidence.js` または同等のPhase B coreが存在する場合:
- そこへPhase C pure logicを最小差分追加する。
- DOM、localStorage、GAS、fetchへ依存させない。
- 入力→判定→出力だけのpure functionを維持する。

新しいcoreファイルを増やすのは、保存版46の構造上どうしても必要な場合だけ。

推奨APIイメージ:
- `evaluateStand17PhaseC(input)`
- `evaluateExchangePoint(input, exchange)`
- `getEvidenceState(input)`

実際の関数名は保存版46の既存設計に合わせる。

## 2. test配置

現行repoのテストは Node標準 `node:test` + `assert/strict`。

保存版46にPhase Bテストがある場合:
- 新しい重複test fileを作らず、そのテスト群へPhase Cケースを追加する。

無い場合の推奨:
- `test/phase-c-17-core.test.js`
- `test/phase-c-17-adapter.test.js`
- 表示不整合用に必要なら `test/today-task-assembly-warning.test.js`

受入ケースは
`docs/phase-c-17-adapter-test-matrix-20261101.md`
を正とする。

## 3. app.jsの変更範囲

Phase C coreテスト合格後だけ触る。

許可:
- #17だけPhase C adapterを呼ぶ小さな分岐
- Phase C resultを既存three-set forecast card modelへ変換
- assembly taskの「日程未設定」表示不整合の最小修正

避ける:
- 既存3セットforecast全体の大規模書換え
- #16以下へのPhase C自動展開
- current task生成ロジックの複製
- forecast coreロジックをapp.jsへ直接埋め込む

## 4. 既存legacy helperの扱い

#17 Phase Cでは以下を根拠付きcoreへ直接流用しない:
- `getStandOnlineUseMonths` の3か月固定
- `getOnlineUseEndDate` のuseStart+3か月
- `getThreeSetForecastReworkReturnDate` の30日heuristic
- dispatch未確認中古予備のtoday+2日仮pickup
- `getThreeSetForecastCutInfo` のStandMaster径 + `>` 判定

legacyは他スタンドの現行UI互換のため残してよい。

## 5. #17 adapter

Phase C core outputを既存UIへ変換する責務だけを持つ。

mapping:
- `normal` -> `維持可能`
- `shortage` -> `不足見込み`
- `incomplete` -> 原因に応じ `要確認` / `データ不足`

禁止:
- adapter側で新しい交換日を推測
- plannedをactual化
- incompleteをlegacy heuristicでnormalへ上書き
- shortageをlegacy候補で打消し

## 6. today task / workshop board

現行17-88 + 17-90は既存assembly candidateを使う。

Phase Cは同じtoday taskを作らない。
Phase Cはadvisoryだけ返す。

assembly task警告修正:
- assemblyInstructionDueが有効なら「日程未設定」を出さない
- 無い場合のみ「日程未設定」
- 既存工作課ボード期限helperを可能な限り再利用

## 7. index.html / CSS

core実装だけなら変更不要。

adapter/UI表示で新しいevidence表示が本当に必要になった時だけ変更。
既存3セット維持予測カード内に収まるなら新dashboardを増やさない。

## 8. Service Worker / PWA

main現在:
- cache name: `roll-app-v59-summary-counts`
- network-first
- install precacheは index/manifest/404/rootのみ
- JS/CSSは取得成功時にruntime cacheされる

Phase C pure core/testだけの段階:
- service-worker変更不要

ブラウザへ新しいJSファイルを読み込ませる段階:
- index.htmlでscript参照を追加した場合、実ブラウザ回帰時に旧runtime cacheとの混在を確認する
- 本番反映時のみCACHE_NAMEを更新する
- 検証ブランチのpure testのためだけにcache versionを上げない

## 9. GAS / Google Sheets

Phase Cの最初のcore + adapter実装では変更しない。

理由:
- 現在必要な入力は既存Roles/マスタ/検証fixtureから構成できる
- 未確認値をunknownで安全停止できる
- 新しいSheet列やGAS APIを先に増やす必要はない

将来、カリバ実累計や正式exchangeDateの永続化先が確定した時だけ別Phaseで設計する。

## 10. 実装チェックポイント

Checkpoint 1:
- Work保存版46 remote保全成功
- GitHubから読戻し確認

Checkpoint 2:
- Phase C pure tests合格
- app.js未変更

Checkpoint 3:
- #17 adapter tests合格
- legacy #16以下に影響なし

Checkpoint 4:
- today task期限表示回帰合格

Checkpoint 5:
- 実ブラウザ
  - #17カード二重表示なし
  - incompleteが維持可能へ化けない
  - 17-88→17-90組替候補は既存taskに1件
  - 12/18期限と「日程未設定」が矛盾しない

Checkpoint 6:
- 必要な場合だけPWA cache version更新
- 本番投入は別承認/検証工程

## 11. 現時点で触らないもの

- main
- PR #14
- 本番GAS
- 実業務Sheets
- StandMaster 292mm
- #17以外のPhase C化
- Microsoft移行
