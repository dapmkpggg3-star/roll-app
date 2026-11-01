# Phase C #17 — Adapter / Acceptance Test Matrix

更新日: 2026-11-01
対象: Work保存版46へPhase Cを実装する際の必須受入テスト
前提: main / 本番GAS / 実Sheetsは変更しない

## A. 現行実データfixture

### A-01 現在地
入力:
- 17-89 = online / useStart 2026-10-14 / diameter 320.11
- 17-88 = 中古予備（バラシ前） / diameter 314.90 / assemblyInstructionDue 2026-12-18
- 17-90 = 新品予備（組替可能） / latest return 2026-10-26 / returned diameter unknown
- caliberActualUsage(17-89) = unknown
- exchangeDate = unknown
- planned schedule = 59直 + 8/19未定

期待:
- core result = incomplete
- shortageConfirmed = false
- READY_SPARE_COUNT_ZERO advisory
- CHOCK_SWAP_CANDIDATE_17_88_TO_17_90 advisory
- NEXT_EXCHANGE_DATE_UNKNOWN advisory
- planned 59直をactualへ昇格しない
- 2027-01-14をexchangeDateにしない
- 2026-12-18をexchangeDateにしない
- 2026-12-10をexchangeDateにしない

## B. 径境界

### B-01 290.00mmちょうど
入力:
- future machined diameter = 290.00
- 他の必須根拠 = confirmed

期待:
- diameter理由でshortageにしない
- `>=290` を満たす

### B-02 289.99mm
期待:
- shortage
- reason = DIAMETER_BELOW_FORECAST_MINIMUM

### B-03 current 292.50 - future cut 2.50
期待:
- predicted = 290.00
- diameter理由でshortageにしない

### B-04 current 292.40 - future cut 2.50
期待:
- predicted = 289.90
- shortage

### B-05 StandMaster 292の影響隔離
入力:
- forecast result diameter 291.0
- forecastMinimum=290
- standMasterScrap=292

期待:
- Phase C年間見通しの径判定だけなら291.0は通過
- StandMasterを291/290へ書換えない
- 本番廃却処理のルール変更とは扱わない

## C. 二重減径防止

### C-01 17-89実測320.11
入力:
- prior actual before=322.11
- prior actual after=320.11
- actualReduction=2.00

期待:
- current diameter=320.11
- 318.11へ再減算しない

### C-02 future cutのみ適用
入力:
- current confirmed diameter=320.11
- next future machining planned/rule cut=2.50

期待:
- future predicted=317.61
- 2.00過去実績を追加減算しない

## D. 改削日程

### D-01 confirmed dispatch + no actual return
入力:
- dispatch=2026-11-20
- machiningLeadDays=25

期待:
- returnDue=2026-12-15
- legacy 30日（12/20）を使わない

### D-02 actual returnあり
入力:
- dispatch=2026-11-20
- actualReturn=2026-12-13

期待:
- actualReturnを採用
- 25日予定より実績優先

### D-03 中古予備・dispatch未確認
入力:
- status=中古予備（バラシ前）
- dispatch=null

期待:
- returnDue unknown
- today+2日を仮dispatchにしない
- today+32日を戻り予定にしない

## E. ready spare / 組替

### E-01 ready spare=0、exchange unknown
期待:
- incomplete
- shortageにしない

### E-02 ready spare=0、交換日確定、間に合わないこと確定
期待:
- shortage
- NO_READY_SPARE or ASSEMBLY_OVERDUE

### E-03 17-90が組込完了へ
期待:
- 現行assembly candidateは解消
- READY_SPARE_COUNT_ZERO advisoryは解消
- caliber actual / exchangeDate等がunknownなら総合normalにはしない

### E-04 12/18組替指示期限
期待:
- assembly deadlineとして保持
- exchangeDateへ流用しない
- today taskで期限があるのに「日程未設定」を出さない

## F. planned / actual分離

### F-01 59直
期待:
- evidence=planned
- caliberActualUsageはunknownのまま

### F-02 過去日付のplanned
入力:
- 計画期間が現在日より過去

期待:
- 過去日付だからactualへ自動昇格しない

### F-03 8+19直数未定
期待:
- null/unknown
- 0へ補完しない

## G. UI adapter

### G-01 Phase C incomplete
期待:
- 既存3セット維持予測カードでは「要確認」または「データ不足」
- legacy heuristicの「維持可能」で上書きしない
- 次回終了欄に固定3か月日付をPhase C確定日として表示しない

### G-02 Phase C shortage
期待:
- 「不足見込み」
- legacy candidateが存在してもshortageを打ち消さない

### G-03 Phase C normal
期待:
- 必須根拠がすべてconfirmedの時だけ「維持可能」

### G-04 他スタンド
期待:
- #16などPhase C未対応は既存legacy挙動を維持
- #17限定導入で全スタンド回帰を起こさない

## H. today task / workshop board統合

### H-01 現行17-88 + 17-90
期待:
- assembly candidate 1件
- Phase C advisory追加でtoday taskを2件にしない

### H-02 期限表示
入力:
- 17-88 assemblyInstructionDue=2026-12-18

期待:
- 工作課ボードと本日のタスクで期限有無が矛盾しない

## I. 結果優先順位

### I-01 unknown + known shortage
入力:
- caliber usage unknown
- diameter 289.9 confirmed

期待:
- shortage
- incompleteで不足を隠さない

### I-02 unknown only
期待:
- incomplete

### I-03 all confirmed / no shortage
期待:
- normal

## 完了条件

Phase C #17の実装完了と呼べるのは:
1. 上記必須ケースが通る
2. 既存Phase A/Bテストが通る
3. mainではなく検証ブランチ
4. Work保存版46を基点にしている
5. UI接続前に純粋ロジックの結果を確認
6. 実ブラウザでは#17の表示が二重タスクにならない
7. GAS/実Sheetsを書き換える必要がある工程は別途明示し、無断で本番へ入れない


## J. 17-90戻り後径の誤採用防止

### J-01 Roles表示338.0を今回戻り後実測へ使わない
根拠:
- Roles履歴でφ338.0は2026-06-08に登録。
- その後、2026-08〜10月の改削サイクルでdiameter変更履歴なし。
- 作業履歴にも17-90の改削後径記録なし。
- 2026-10-26搬入、2026-10-30新品予備（組替可能）変更はあるが、径更新はない。

入力:
- role.currentDiameter = 338.0
- latestMachining.returnDate = 2026-10-26
- latestMachining.afterDiameter = unknown

期待:
- `forecastDiameterMm = unknown`
- `338.0`を今回戻り後実測値へ昇格しない
- reasonに `LATEST_RETURN_DIAMETER_UNKNOWN_17_90` を保持

### J-02 過去径と現行径のevidence分離
期待:
- 338.0はhistorical/displayed valueとして保持可能
- current forecast-ready diameterとは別フィールド
- 今回戻り後径が入力されるまで径依存normal判定に使わない


## K. 17-88次回改削の径面可否

### K-01 次回1回の標準改削
入力:
- current diameter = 314.90
- standard cut = 2.50
- forecast minimum = 290
- StandMaster scrap = 292

期待:
- predicted after cut = 312.40
- diameter result = viable
- shortage理由を出さない

### K-02 径だけの参考残回数を予定へ昇格しない
入力:
- 314.90mm
- 2.50mm standard cut
- 290mm forecast floor

参考計算:
- 9回後 = 292.40mm
- 10回後 = 289.90mm

期待:
- diameter-only referenceとして9を保持してもよい
- 9回の改削・9サイクルが実行可能と確定しない
- フラット加工/追加減径/日程/実使用を無視した年間normal判定に使わない


## L. 17-89次回改削とリスク分解

### L-01 次回1回の標準改削
入力:
- current diameter = 320.11
- standard cut = 2.50

期待:
- predicted after cut = 317.61
- 径理由でshortageにしない

### L-02 リスク分解
現行fixture期待:
- diameterRisk = low（17-88/17-89の次回標準改削に限る）
- readinessRisk = attention（組込完了予備0）
- scheduleRisk = unknown（次回交換日未確認）
- evidenceRisk = incomplete（17-89実累計、17-90戻り後径など）

期待:
- 総合resultはincomplete
- readiness attentionだけでshortageへ昇格しない
- diameter lowだけでnormalへ昇格しない


## M. #17カリバ累計上限

### M-01 D10ペア6+17
入力:
- actual cumulative = 4
- future planned = 2

期待:
- caliber 6 projected = 6
- caliber 17 projected = 6
- operation planned shifts = 2
- 4として二重計上しない
- 超過なし

### M-02 D10ペア超過
入力:
- actual 5
- planned future 2

期待:
- projected 7
- PLAN_EXCEEDS_CALIBER_MAX warning

### M-03 actual unknown
入力:
- actual = unknown
- planned = 6

期待:
- remaining shifts = unknown
- projected cumulative = unknown
- planned 6をactual cumulativeへ置換しない

### M-04 D13再使用
入力:
- caliber14 actual confirmed periods = 2 + 2

期待:
- cumulative = 4
- remaining = 2

### M-05 上限ちょうど
入力:
- cumulative = 6

期待:
- exhausted/limit reached
- over-limitではない

### M-06 SD345専用8+19
期待:
- 8/19はD10ペアとして同時使用
- SD295通常ペアへ統合しない
- 1チャージ=1直と仮定しない

### M-07 D13へペアルールを流用しない
期待:
- D13各カリバを独立累計


## N. Exchange candidate algorithm

### N-01 actual 0 + planned 6
期待:
- projected=6
- limit reached
- conflictなし

### N-02 actual 1 + planned 6
期待:
- projected=7
- capacity conflict
- ただちにexchangeDate確定にはしない

### N-03 actual unknown + planned 6
期待:
- projected unknown
- incomplete
- actual=0として扱わない

### N-04 最初の超過block
複数planのうち初めてprojected>6となるblockをearliestCapacityConflictとして返す。

### N-05 conflictでも代替未確認
期待:
- exchangeDate unknown
- CAPACITY_CONFLICT_REQUIRES_PLANNING_DECISION advisory

### N-06 D10 pair
planned 2直をpair両方へ+2。
operation totalは2直であり4直にしない。

### N-07 D13独立
D13は指定caliberだけへ加算。

### N-08 8+19 SD345
SD345の明示plan以外へ自動流用しない。
