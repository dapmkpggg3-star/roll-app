# Phase C #17 — Work Test Runbook

更新日: 2026-11-01
対象: Work/Astra
目的: 実装・検証を同じ順序で実施し、失敗時に先へ進まない。

## 0. 前提

repo rootにpackage.jsonは現時点でない。
既存testはNode標準:
- `node:test`
- `node:assert/strict`

不要:
- npm install
- 新規test framework
- bundler導入

## Gate 0 — Work保存版46の保全

実装前に必須。

確認:
```
git status
git rev-parse HEAD
git branch --show-current
```

保存版46をnon-prod remote branchへpush後:
```
git fetch origin
git rev-parse origin/work-preserve-v46-20261101
git status
```

さらにGitHub remoteからPhase B core/testが読めることを確認。

FAILなら:
- Phase C実装を開始しない
- mainから作り直さない
- Notionへ保全失敗理由を記録

## Gate 1 — 保存版46 baseline

Phase C変更前に既存テスト:
```
node --test
```

目的:
- 保存版46自体のbaselineを残す
- Phase C変更後の回帰比較

記録:
- pass/fail
- test countは実行結果から記録
- 事前失敗がある場合は既存不具合として分離

既存失敗をPhase C修正で“ついでに”直さない。

## Gate 2 — Phase C pure core

app.jsへ接続する前。

対象:
- evidence入力
- normal / shortage / incomplete
- 290mm境界
- #17 return lead: actual/explicit plan優先。+25日仮搬入/legacy30日をconfirmedへ使わない
- planned/actual
- D10 pair / D13
- reason/advisory/guard canonical code
- exchange candidate

推奨target:
```
node --test test/phase-c-17-core.test.js
```

保存版46に既存Phase B testがあれば、そのtestへ追加してよい。

PASS条件:
- golden expected outputと一致
- deprecated codeを出さない
- DOM/localStorage/fetch/GASへ依存しない

FAILなら:
- adapterへ進まない

## Gate 3 — Full regression after core

```
node --test
```

PASS条件:
- Gate 1 baselineでpassしていた既存testを壊さない
- Phase A/B safety testを維持

FAILなら:
- app.jsへ進まない
- core差分を最小化して修正

## Gate 4 — #17 adapter

対象:
- Phase C result → legacy card model
- #17のみ
- #16以下legacy維持
- useEndDateへlegacy +3か月を入れない

推奨:
```
node --test test/phase-c-17-adapter.test.js
```

PASS:
- current fixture = 要確認
- useEndDate=""
- next candidate=#17-90
- reason=17-89累計未確認
- incompleteをlegacy維持可能で上書きしない

FAILなら:
- UI DOM変更へ進まない

## Gate 5 — Today task期限表示

対象:
- 17-88 + 17-90 assembly candidate 1件
- assemblyInstructionDue=2026-12-18
- 「日程未設定」の矛盾解消
- Phase Cで同一taskを重複生成しない

推奨target:
```
node --test test/today-task-assembly-warning.test.js
```

または既存関連testへ追加。

## Gate 6 — Syntax / static

変更したJSについて:
```
node --check <changed-js-file>
```

最低:
- Phase C core
- adapter
- app.js（変更した場合）

service-worker.jsを変更していないならcheck対象追加不要。

## Gate 7 — Full automated regression

```
node --test
```

ここで初めてブラウザ検証へ進む。

記録:
- total
- pass
- fail
- skipped
- failing test names

数は実行結果だけを記録し、推測しない。

## Gate 8 — Local / validation browser

本番ではなく検証版。

#17確認:
1. 17-89 online
2. 17-88 used standby
3. 17-90 assembly possible
4. 3セット維持予測 = 要確認
5. 2027-01-14を確定次回終了として表示しない
6. 組替候補が1件
7. 12/18期限があるのに日程未設定と表示しない
8. ready spare 0を不足確定にしない
9. 338mmを戻り後実測と表示しない
10. 17-91を在庫に数えない

## Gate 9 — PWA cache

新しいJS参照やブラウザ資産を変えた場合だけ。

確認:
- hard reload
- Service Worker更新
- 旧runtime cacheとの混在なし

pure core/testだけならcache versionを変更しない。

本番反映時に必要ならCACHE_NAME更新。
検証だけのために無駄にversionを上げない。

## Gate 10 — Google roundtrip

Phase C初期core/adapterで新Sheet/GASが不要ならスキップ。

CaliberUsage等を後で導入する時だけ:
- 検証Sheets
- 検証GAS
- read roundtrip
- writeはread-only検証後

会社本番へ直接入れない。

## Gate 11 — Save checkpoint

完了単位ごとに:
- branch
- commit SHA
- test result
- browser result
- Google result（実施時のみ）
- unresolved
- next

をNotionへ保存し、再読込確認。

## Stop Conditions

以下ならそこで止める:
- v46 remote保全できない
- baseline既存testが多数失敗し原因不明
- golden outputとcoreが一致しない
- deprecated reason codeが出る
- #16以下回帰が発生
- Phase C incompleteがlegacy normalへ化ける
- 本番変更が必要になったが検証経路が無い

停止は失敗ではなく、安全ゲートの正常動作として記録する。

## Astra使用量節約

優先:
1. targeted test
2. full regression
3. browser

同じfull suiteを小修正ごとに毎回回さず、
targeted pass後にcheckpoint単位でfull suite。

実ブラウザはautomated gate通過後だけ。


## Gate 2.1 — #17 lead-time guard

必須:
- +25日仮搬入をPhase C returnDueへ使わない
- legacy30日を使わない
- actualReturnがあればactual優先
- explicit return planがあればevidence付きで採用
- 無ければunknown
- historical recent median64 / max80はscenarioのみ
