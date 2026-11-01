# Phase C #17 — Exchange Candidate Algorithm

更新日: 2026-11-01
目的: 実累計が入った後、提供済みカリバ計画を上限6直と照合し、交換が必要になる最初の地点を安全に求める。

## 1. 方針

Phase Cでは、未確定のカリバ割付を自動生成しない。

使うもの:
- actual cumulative usage per caliber
- confirmed caliber max = 6 shifts
- explicit planned blocks
- explicit size / pair / steel restrictions

使わないもの:
- 番号順に自動で次カリバを選ぶ
- planが無い期間を勝手に補完する
- actual unknownを0と仮定する
- 12/10や組替期限を交換日へ置換する

## 2. planned block構造

```js
{
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  size: "D10" | "D13",
  calibers: ["6","17"],
  plannedShifts: 2 | null,
  steelGrade: "SD295" | "SD345" | null,
  evidence: "planned"
}
```

## 3. actual cumulative構造

```js
{
  "1": 0,
  "2": 3,
  "6": 4,
  "17": 4,
  ...
}
```

未確認はkey欠落またはnull。
0は「未使用と確認済み」の時だけ。

## 4. 検証順序

各planned blockを日付順に処理する。

### 4.1 入力完全性
- plannedShifts=null → block判定 incomplete
- 対象caliberのactual=null → projected判定 incomplete
- D10でpairが不正 → rule error
- SD345で8+19以外 → rule error/unsupported
- D13でpair扱い → rule error

### 4.2 projected cumulative
D10:
- pair両方へplannedShiftsを加算
- operation shiftsは1回分のみ

D13:
- 指定caliberへplannedShiftsを加算

```js
projected = actual + accumulatedPlanned
```

### 4.3 上限
- projected < 6 → capacity remains
- projected === 6 → limit reached after block
- projected > 6 → capacity conflict

## 5. earliestCapacityConflict

最初にprojected > 6となるplanned blockを返す。

```js
{
  conflictDate: block.startDate,
  block,
  calibers,
  projectedUsage,
  reason: "PLANNED_USAGE_EXCEEDS_CONFIRMED_CALIBER_MAX"
}
```

ただしこれは即 `exchangeDate` ではない。

意味:
「この明示計画を現在ロールの当該カリバで実行するには、ここまでに別対応が必要」

別対応例:
- 別の使用可能カリバへ計画変更
- ロール交換
- 生産計画変更

Phase Cはこの段階で勝手にどれを選ばない。

## 6. exchange candidate

`exchangeCandidateDate` を出せる条件:

1. capacity conflictがconfirmed actual + explicit planから導ける
2. そのproduction blockに代替カリバ割付がないことが確認済み
3. 他の運用制約でも現ロール継続不可が確認済み

3条件が揃わなければ:
- exchangeDate = unknown
- advisory = CAPACITY_CONFLICT_REQUIRES_PLANNING_DECISION

## 7. current #17-89 planned fixture

既知planned:
- D10 6+17 = 6
- D10 7+18 = 6
- D10 9+20 = 6
- D10 10+21 = 4
- D10 11+22 = 5
- D10 8+19 = unknown
- D13 1 = 6
- D13 2 = 5
- D13 12 = 6
- D13 13 = 6
- D13 14 = 4
- D13 15 = 5

actual cumulativeはunknown。

よって:
- known plan単独は6直上限を超えない
- actual unknownのためprojected cumulativeは確定しない
- exchange candidateはまだ出さない

## 8. 重要な境界

planned=6でもactual=0 confirmedなら上限ちょうどで超過ではない。
planned=6かつactual unknownなら「上限内」と断定しない。

例:
- actual 0 + planned 6 = 6 → valid, limit reached
- actual 1 + planned 6 = 7 → conflict
- actual unknown + planned 6 → incomplete

## 9. 将来の自動計画との分離

Phase Cでは「既存planの検証」まで。

将来の自動計画Phaseで初めて:
- 残カリバから候補選定
- 位置合わせ
- D10/D13切替
- SD345制約
- 連動スタンド
- 作業時間
を含む割付最適化へ進む。

今は自動割付をPhase Cへ混ぜない。
