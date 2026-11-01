# Phase C #17 — Caliber Usage Persistence Proposal

更新日: 2026-11-01
状態: 設計のみ。本番Google Sheetsはまだ変更しない。

## 1. 結論

Phase Cで新しい永続化先が必要なのは主に「カリバ別実累計」。

既存データで足りるもの:
- 17-90戻り後実測径 → Roles.currentDiameterへ確認後に保存
- 17-90組込完了 → Roles.status
- 組替指示期限 → Roles.assemblyInstructionDue
- 搬出/搬入 → Roles.workProgress / 既存履歴

新しく必要:
- 同一ロール・同一カリバのactual cumulative shifts

## 2. 既存シートを流用しない理由

### 入力
現状ヘッダは
- スタンド番号
- ステータス
- メモ
のみ。
Apps Script経由ロール追加用の補助シート。

カリバ累計には使わない。

### 作業履歴
現状は径変更理由=改削の時に
- before/after diameter
- 改削量
を記録する用途。

カリバ使用実績を混ぜると責務が変わるため、Phase C初期では流用しない。

### Roles
1ロール22カリバ分を列追加すると横持ち・肥大化し、D10/D13/再使用に弱い。
Rolesにはロール状態を維持する。

## 3. 推奨新規シート

hidden sheet:
`CaliberUsage`

Phase C検証合格後にのみ追加。

### columns

| column | meaning |
|---|---|
| Stand | #17 |
| RollId | 17-89 |
| CaliberNo | 1〜22 |
| Size | D10 / D13 |
| ActualCumulativeShifts | confirmed cumulative |
| AsOfDate | snapshot基準日 |
| Source | manual / imported / app |
| SourceRef | 任意の参照 |
| Note | 使用不可等 |
| UpdatedAt | ISO timestamp |
| UpdatedBy | 担当者 |

## 4. 値ルール

- `0` = 未使用と確認済み
- blank = unknown
- 未確認を0にしない
- planned値をこのsheetへ入れない
- actual only

plannedは別の計画入力・fixtureとして保持する。

## 5. #17 validation

Phase C coreで:
- D10/D13 max 6
- D10 pairのactual cumulativeは原則一致を期待
- pair mismatchは自動補正せずwarning
- >6はactual over-limit warning
- =6は上限到達
- D13は個別

例:
```
#17 | 17-89 | 6  | D10 | 4
#17 | 17-89 | 17 | D10 | 4
```

6と17が4/3なら:
- mismatch warning
- どちらかへ自動統一しない

## 6. 読み込み契約

Phase C adapterは
`CaliberUsage`
から対象rollの最新AsOfDate snapshotを読む。

同じRollId+CaliberNoで複数行がある場合:
- UpdatedAtだけで勝手に古い基準日を上書きしない
- AsOfDate → UpdatedAtの順で最新を選ぶ
- 同AsOfDateで競合値ならconflict

## 7. 書き込み契約

初期Phaseではread-only integrationを先に作る。

書き込みUIは後。

理由:
- まず既存の手入力テンプレートからデータを移せるか検証
- sync conflictを増やさない
- Phase C coreの価値を先に確認

## 8. 手入力テンプレートとの接続

既存 `カリバ使用状況_記入用.xlsx` は
- 0=確認済み未使用
- 空欄=unknown
- 6〜17stは直数
という意味が既にPhase Cと一致。

将来:
1. 記入Excelを読む
2. CaliberUsage形式へ変換
3. 検証画面で差分確認
4. 本番保存
の順。

自動importはPhase C core完成後。

## 9. GAS変更

CaliberUsage追加時だけ別工程で:
- readCaliberUsage
- optional writeCaliberUsage
を追加検討。

Phase C core / adapter初期ではGAS変更不要。

## 10. 安全条件

- 本番Sheet追加はWork保存版46保全・coreテスト合格後
- 既存Roles列を大量追加しない
- plannedとactualを同じ列/同じsheetへ混在させない
- unknownを0化しない
- D10 pair mismatchを自動修正しない
