# Phase C — 既存「3セット維持予測」ダッシュボード統合方針

更新日: 2026-11-01
対象: #17 Phase C と main の既存 three-set forecast UI

## 1. mainの現行予測ロジックで確認できたこと

`getStandOnlineUseMonths(standKey)` は
- #2〜#5: 1か月
- #6〜#17: 3か月

を固定で返す。

`getOnlineUseEndDate(role)` はオンラインロールの使用開始日に上記固定月数を加え、予測終了日を作る。

したがって#17-89（使用開始2026-10-14）は、現行heuristicでは2027-01-14相当を「次回終了」候補として扱う可能性がある。

これは
- カリバ別実累計
- D10/D13の実使用
- 生産予定変更
- SD345専用カリバ
- 3セットの実準備日
を直接使った日付ではない。

Phase Cではこの日付を `exchangeDate` や確定使用終了日へ昇格しない。

## 2. 現行ダッシュボードの判定

`getThreeSetForecastItem` は現行heuristicのuseEndDateを基準に次候補を探し、
- 維持可能
- 要段取り
- 要確認
- データ不足
- 不足見込み
を返す。

これは現在の簡易支援としては有用だが、#17の12か月根拠付きシミュレーション結果とは別物。

## 3. Phase Cとの統合原則

Phase Cコア:
- `normal`
- `shortage`
- `incomplete`
- `reasons[]`
- `advisories[]`

を正とする。

既存UIは再利用してよいが、既存heuristic値とPhase C値を同じ根拠レベルで混ぜない。

### #17でPhase C入力が利用可能な場合

- `normal` → UI表示候補「維持可能」
- `shortage` → UI表示候補「不足見込み」
- `incomplete` → UI表示候補「要確認」または「データ不足」
- 実務アクションは既存「本日のタスク／工作課ボード」と重複させない。
- `exchangeDate` がunknownなら、既存固定3か月日付を「次回終了」としてPhase Cカードへ表示しない。

### Phase C入力がないスタンド

既存heuristicは直ちに全廃しない。
#17限定でPhase Cを検証し、他スタンドは現行挙動を維持する。

## 4. 根拠表示

Phase Cカードには最低限、判定と一緒に根拠状態を表示できる構造にする。

例:
- 実績確認済み
- 計画のみ
- 未確認
- 短期期限あり／交換日未確認

「不足見込み」「維持可能」だけを表示して根拠を隠さない。

## 5. #17現行fixtureでの期待

入力:
- online: 17-89
- useStart: 2026-10-14
- caliberActualUsage: unknown
- exchangeDate: unknown
- ready spare installed: 0
- assembly candidate: 17-88 → 17-90
- assemblyInstructionDue: 2026-12-18
- 17-90 latest returned diameter: unknown
- planned schedule exists through 2026-12-10, but actualではない

期待:
- Phase C result = `incomplete`
- 2027-01-14を確定exchangeDateとして使わない
- 12/18はassembly deadlineとして保持し、exchangeDateへ変換しない
- 17-88→17-90組替は既存today task/workshop boardで扱う
- Phase C側に同じ作業タスクを重複生成しない

## 6. Work復帰後の安全な実装順

保存版46のGitHub保全完了後:

1. Phase C純粋ロジックを保存版46へ接続。
2. まずUIなしで必須テストを通す。
3. #17だけのadapterを作り、Phase C出力を既存three-set forecast card形へ変換。
4. adapterが有効な#17では、legacy fixed-3-month useEndDateをPhase CのexchangeDate代用にしない。
5. 他スタンドはlegacy挙動を維持。
6. UI回帰テストと実ブラウザ確認後に範囲拡大を判断。

## 7. 必須テスト追加

1. #17-89 useStart=2026-10-14でも、Phase C exchangeDate=unknownなら2027-01-14を確定終了として出力しない。
2. Phase C incomplete → legacy heuristicの「維持可能」で上書きしない。
3. Phase C shortage → legacy heuristicの候補有無で打ち消さない。
4. Phase C normal → 必要根拠がconfirmedの時だけ。
5. #16などPhase C未対応スタンドは既存heuristic挙動を維持。
6. 12/18 assemblyInstructionDueをexchangeDateへ流用しない。
7. planned 12/10をexchangeDateへ流用しない。

## 8. 実装境界

この文書は設計・受入条件。
main / 本番PWA / GAS / Sheetsは変更しない。
Work保存版46保全前に既存forecastコードを編集しない。
