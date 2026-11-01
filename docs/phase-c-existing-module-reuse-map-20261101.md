# Phase C #17 — Existing Module Reuse Map

更新日: 2026-11-01
対象: `js/planning-calibers.js`
目的: Work/Astraが既存moduleを過剰流用して#17ルールを壊さないための再利用境界

## 1. 再利用してよい候補

### normalizeRunSize
D10/D13表記正規化として再利用可。

### buildProductionRuns
生産予定から実際に生産があるshiftだけをrunへ展開する処理として再利用候補。
ただし入力scheduleのactual/planned evidenceは別に保持する。

### buildProductionCampaigns
同サイズの連続campaignを把握する補助として再利用候補。
ただしcampaign単位だけで#17カリバ累計を決めない。

## 2. #17 Phase Cへ直接使わない

### detectCampaignCaliberRequirements
理由:
- size campaign長をmaxRunsで区切る設計。
- #17は「同一ロール・同一カリバ」の累計管理。
- 同じD13でも14番を2直→後日2直のように再使用する。
- D10はペアごとに累計。
- campaignの6直境界=カリバ交換とは限らない。

### nextCaliber
直接使用禁止。
理由:
- `sequence`の次を循環して選ぶ。
- #17は番号順に自動で使い切る運用ではない。
- D10は6+17等の固定ペア。
- 8+19はSD345専用。
- D13も明示計画・位置・残量で決める。

### projectCaliberChange / projectCaliberChanges
直接使用禁止。
理由:
- stateが単一currentCaliber / maxRuns / usedRuns前提。
- 自動nextCaliber選択を含む。
- D10ペア2本の累計を同時管理できない。
- explicit planned blockとactual evidenceの区別がない。
- actual unknown=0に近い扱いへ流れやすい。

## 3. Phase C側に必要な新しい責務

Phase C coreまたは専用adapterで以下を持つ:

- `actualCumulativeByCaliber`
- `plannedBlocks[]`
- D10 pair mapping
- D13 independent counters
- evidence state
- max cumulative 6
- earliest capacity conflict
- exchangeDateはcapacity conflictだけで確定しない

## 4. 既存moduleとPhase Cのつなぎ方

推奨:
1. planning schedule parsingに `normalizeRunSize` / `buildProductionRuns` を必要に応じ再利用。
2. explicit caliber assignmentはPhase C fixture/planned blockから受け取る。
3. Phase C専用のper-caliber累積validatorで上限照合。
4. planning-calibersのnextCaliber/projectCaliberChangeへ渡さない。
5. 将来の自動計画Phaseで最適化する時に初めて既存planning moduleとの統合を再評価。

## 5. 回帰テスト

1. #17 D13 14番を2直+後日2直 → 累計4。campaignが分かれてもリセットしない。
2. D10 6+17を2直 → 両方+2、operation total+2。
3. 6+17の次を自動で7+18へ選ばない。
4. 8+19を通常D10へ自動選択しない。
5. D13をpairにしない。
6. actual unknown時にprojectCaliberChangeのusedRuns=0相当へ変換しない。

## 6. 結論

Phase Cで再利用するのは「生産runの抽出・サイズ正規化」まで。
「どのカリバを使うか」「残量」「次カリバ」「交換時点」は#17専用の根拠付きロジックで扱う。
