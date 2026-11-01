# Phase C — Caliber Usage Template Import Contract

更新日: 2026-11-01
対象: 既存 `カリバ使用状況_記入用.xlsx`
状態: 設計のみ。自動import実装はPhase C core完成後。

## 1. 目的

現場で一度入力したカリバ累計を、再入力なしでPhase Cへ渡す。

入力テンプレート既存ルール:
- 6〜17stは累計使用量を「直」で入力
- 0 = 未使用と確認済み
- 空欄 = unknown
- 中古予備など再使用分も同一カリバへ累積
- 12〜17stは各st3枠

この意味をそのままPhase Cへ保持する。

## 2. 固定行番号に依存しない

現在の17stは例として
- 記入枠1: 143付近
- 記入枠2: 152付近
- 記入枠3: 161付近

だが、importは行番号固定にしない。

マーカー:
- `17st　記入枠1`
- `17st　記入枠2`
- `17st　記入枠3`

を探してblockを検出する。

## 3. blockから読む項目

- RollId
- 状態
- 現用No.
- 総数
- 備考
- caliberNo 1〜22
- size D10/D13
- 累計直数

## 4. cumulative変換

Excel cell:
- blank → `null`, evidence=`unknown`
- 0 → `0`, evidence=`actual_confirmed`
- positive number → numeric, evidence=`actual_confirmed`
- text/non numeric → import error。0へしない

## 5. output

1 caliber = 1 record。

```js
{
  stand: "#17",
  rollId: "17-89",
  caliberNo: "6",
  size: "D10",
  actualCumulativeShifts: 4,
  asOfDate: "YYYY-MM-DD",
  evidence: "actual_confirmed",
  source: "caliber-usage-template",
  note: ""
}
```

## 6. 基準日必須

テンプレートの「基準日・基準時点」が空欄なら、
値が入っていてもPhase Cの最新実績へ自動採用しない。

result:
- import parsed
- evidence freshness = unknown
- needsAsOfDate = true

古いsnapshotで新しいsnapshotを上書きしない。

## 7. #17 D10 pair validation

import後:
- 6と17
- 7と18
- 8と19
- 9と20
- 10と21
- 11と22
のactual cumulativeを比較。

両方confirmedで不一致なら:
- `PAIR_USAGE_MISMATCH`
- 自動で大きい方/小さい方へ統一しない

片方unknownなら:
- pair totalもunknown

## 8. #17 D13 validation

1〜5、12〜16は独立。
D10 pair ruleを適用しない。

## 9. 使用不可備考

「No.3 使用不可」のような備考がある場合:
- 累計値は残す
- usability flagを別に持つ
- 累計=0だから使用可能とは判定しない

推奨:
```js
{
  usability: "usable" | "unusable" | "unknown"
}
```

## 10. 本番保存前の差分確認

自動importの初期版は:
1. Excel parse
2. CaliberUsage形式へ変換
3. 差分preview
4. 本人/検証環境で確認
5. 保存

いきなり本番Sheetsへ書き込まない。

## 11. Phase Cへの接続

最新valid snapshotがある時だけ:
- actual cumulative
- remaining shifts
- actual+planned projected
- capacity conflict
を計算。

snapshot無し:
- incomplete継続。

## 12. 今回の17-89

既存テンプレート:
- RollId 17-89
- サイズ配置は転記済み
- 累計直数は空欄

よって現時点:
- parserがあってもactual cumulativeはunknown
- 0へ補完しない
