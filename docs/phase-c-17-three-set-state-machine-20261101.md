# Phase C #17 — Three-Set State Machine

更新日: 2026-11-01
目的: 現行アプリの確認済み自動遷移と固定3セット運用を、12か月予測の状態遷移へそのまま接続する。

## 1. 原則

Phase Cは実Rolesを変更しない。

- actual state: Rolesの実績
- simulated state: Phase C内部のコピー
- proposed event: 将来候補

を分離する。

予測イベントを実績ステータスへ自動保存しない。

## 2. 使用する主要状態

- ONLINE = オンライン
- USED = 中古予備（バラシ前）
- REWORK_READY = 改削行き（搬出可能）
- REWORKING = 改削中
- NEW_READY = 新品予備（組替可能）
- NEW_INSTALLED = 新品予備（組込完了）

## 3. 現行アプリで確認済みの実遷移

### A. チョック組替完了

target:
`NEW_READY -> NEW_INSTALLED`

既存main:
`autoMoveUsedStandbyToReworkReadyForNewInstalled()`

同一スタンドのUSEDを自動で:
`USED -> REWORK_READY`

したがって1つの組替完了イベントは2本の状態を同時に変える。

例 #17:
- 17-90 NEW_READY -> NEW_INSTALLED
- 17-88 USED -> REWORK_READY

### B. オンライン交代

確認済みRollOnlineSafety:
- 新ロール `NEW_INSTALLED -> ONLINE`
- 旧ONLINE `ONLINE -> USED`
- 旧ONLINEへuseEndDate
- 新ONLINEへuseStartDate
- exchangeId付き履歴

例:
- 17-90 NEW_INSTALLED -> ONLINE
- 17-89 ONLINE -> USED

### C. 搬出・改削開始

実績操作で:
`REWORK_READY -> REWORKING`

dispatchDateは実績または明示予定として別保持。

Phase Cはdispatch未確認なら日付を作らない。

### D. 改削戻り

実績で:
`REWORKING -> NEW_READY`

ただしPhase Cの「次回使用可能」の根拠には:
- return date
- post-return measured diameter
が必要。

statusだけNEW_READYでも径がunknownなら径依存判定はincomplete。

## 4. #17現在状態

2026-11-01:

- 17-89 = ONLINE
- 17-88 = USED
- 17-90 = NEW_READY

次の実務候補:
```
ASSEMBLY_COMPLETED(17-88 -> 17-90)
```

結果:
- 17-89 ONLINE
- 17-88 REWORK_READY
- 17-90 NEW_INSTALLED

その後:
```
DISPATCH(17-88)
```
- 17-88 REWORKING

次回交換時:
```
ONLINE_EXCHANGE(17-89 -> 17-90)
```
- 17-90 ONLINE
- 17-89 USED
- 17-88 REWORKING or NEW_READY depending on actual return

17-88が戻れば:
- 17-88 NEW_READY

次の組替:
- 17-88 NEW_READY -> NEW_INSTALLED
- 17-89 USED -> REWORK_READY

この循環を固定3セットローテーションとしてシミュレートする。

## 5. event structure

```js
{
  eventType:
    "ASSEMBLY_COMPLETED" |
    "DISPATCHED" |
    "REWORK_RETURNED" |
    "ONLINE_EXCHANGE",
  effectiveDate: "YYYY-MM-DD" | null,
  evidence: "actual_confirmed" | "planned_confirmed" | "simulated" | "unknown",
  rollIds: [],
  before: {},
  after: {},
  reasons: []
}
```

## 6. invariant

Phase C入力時:

- active three-set roles = exactly 3
- ONLINE = exactly 1
- NEW_INSTALLED <= 1
- USED <= 1
- same roll cannot occupy multiple simulated roles
- discarded roll cannot be active three-set

違反時:
- 自動修復しない
- result = incomplete
- reason = `THREE_SET_STATE_CONFLICT`

## 7. transition guards

### ASSEMBLY_COMPLETED

必要:
- target = NEW_READY
- source = USED
- same stand
- both active three-set

予測上:
- assembly due/planがあるだけではcompleted扱いしない
- actual completedならactual state更新
- simulated eventならtimelineだけ更新

### ONLINE_EXCHANGE

必要:
- incoming = NEW_INSTALLED
- outgoing = ONLINE
- same stand

交換日unknownなら実行しない。

### DISPATCHED

必要:
- roll = REWORK_READY
- actual/explicit dispatch date

日付が無ければREWORKING開始日を捏造しない。

### REWORK_RETURNED

必要:
- roll = REWORKING
- actual return date

戻り後径unknownでもstatusはNEW_READYになり得るが、
Phase C readinessはdiameter evidence不足としてincomplete。

## 8. predicted timeline

各event後にsnapshotを保存:

```js
{
  at: "YYYY-MM-DD" | null,
  eventType: "...",
  onlineRollId: "...",
  readySpareRollId: "...",
  usedStandbyRollId: "...",
  reworkReadyRollId: "...",
  reworkingRollId: "...",
  assemblyPossibleRollId: "...",
  evidenceState: {}
}
```

同じ日付でもevent順序を保持。

## 9. current #17 expected transition

current:
- online=17-89
- used=17-88
- assemblyPossible=17-90
- readySpare=null

assembly actual未完了なので:
- current actual snapshotはそのまま
- next proposed eventとして17-88→17-90組替を保持
- 17-90をreadySpareへ先取りしない
- 17-88をREWORK_READYへ先取りしない

## 10. test cases

1. 17-90 NEW_READY + 17-88 USED → simulated assembly event:
   - 17-90 NEW_INSTALLED
   - 17-88 REWORK_READY
2. assembly due dateだけでは状態を変えない
3. 17-90 NEW_INSTALLED + 17-89 ONLINE → exchange:
   - 17-90 ONLINE
   - 17-89 USED
4. exchangeDate unknown → exchange eventを実行しない
5. REWORK_READY + dispatch unknown → REWORKINGへ進めない
6. REWORKING + actual return → NEW_READY
7. NEW_READYだがpost-return diameter unknown → result normalへしない
8. active roles !=3 → THREE_SET_STATE_CONFLICT
9. ONLINE 2本 → THREE_SET_STATE_CONFLICT
10. USED 2本 → THREE_SET_STATE_CONFLICT

## 11. existing implementation boundary

既存の実績更新:
- RollOnlineSafety
- autoMoveUsedStandbyToReworkReadyForNewInstalled

は壊さない。

Phase Cはこれらを直接呼んでactual Rolesを変えず、
同じ遷移規則をpure simulationへ写す。

Work保存版46の構造に合わせ、重複ロジックを最小にする。
