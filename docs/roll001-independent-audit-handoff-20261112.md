# ROLL-001 独立監査引継ぎ｜2026-11-12 16:34 JST

**判定: 隔離Node/Chromium検証済み、別モデル独立監査未実施、本番適用禁止。** これは監査の依頼資料であり監査済み証明ではない。

## 対象と再現可能な証拠

- Repository: `dapmkpggg3-star/roll-app`
- 検証主線: `fix/roll001-visibility-safe-20261110`、head `68989f4febfb23f25db705653955a594f917c6eb`
- 保全原本: `work-preserve-v46-20261101`。本番 `main`、PR14、非公開版57へ未反映。
- 実コード: `js/app.js` blob `f9a80625c45df7f8d99991aed3560d5f4dd7e5c0`。関数 `getTodayTaskTargetRole`、`getTodayTaskStandTargetRole`、`getFilteredRoles`。
- テスト: `test/today-task-target-visibility.test.js` blob `0edfec26f52860a97d284fe28c18771bf06c553a`（12ケース、実関数を切出し、匿名VM）。
- 関連購入監査: `test/roll001-procurement-risk-audit.test.cjs` blob `3690414ab77de7061f500c62fd15055a5638e7ac`。購入LT無効値の未検証扱いをテストするが、年間計画・発注数量・納入予定の検証ではない。
- GitHub Actions workflow: `.github/workflows/roll001-isolated-test.yml` blob `715d7057f269f9d99ba7ff73c9ea98468f528dc1`。
- CI: https://github.com/dapmkpggg3-star/roll-app/actions/runs/43161963441 （Node job `130995026964`、26/26 PASS、Chromium job `130995027300` 成功）。
- 画面証拠: https://github.com/dapmkpggg3-star/roll-app/actions/runs/43161963441/artifacts/13918077521 （PNG 13枚、JSON 3件、16ファイル）。実 `index.html` とscript bundleの匿名・ネットワーク遮断ブラウザで押下前後を検証。日本語フォント `Noto Sans CJK JP` を導入して可読化。

## コードから確認した動作・残る反証ポイント

1. 直接ロール指定のタスクは、対象IDが存在しフィルター表示対象である場合のみ返す。非表示なら `null`。
2. スタンド指定タスクは全ロールから優先候補を先に決め、非表示なら次順位ロールへ勝手に飛ばず `null`。予備不足はスタンド単位タスクであり特定ロールカードへ誘導しない。
3. 実装の `getStandKey(role.name) === task.standKey` は厳密比較。スタンドキーの型・表記が異なる場合（例: 数値 `10` と文字列 `'10'`）候補がゼロになる。タスク生成元の型・表記を監査で照合すること。現行12ケースは文字列 `'10'` 中心。
4. `getFilteredRoles` の結果に依存するため、検索・状態フィルター・要注意スタンドフィルターの組合せで候補が消えると案内表示へ移る。誤ロール選択は防ぐが、すべての画面・端末で案内が理解できるかは別途確認する。
5. テストは実関数の部分抽出・匿名fixturesとネットワーク遮断ブラウザ。認証・Sheets・Local/Remote差分3件・原本バックアップと復元・業務データに対する受入証明ではない。
6. 購入計画の `getPurchasePlanningInfo` はロール径/廃却径/採用改削量が不正な場合 `null` を返す。`getPurchaseConfirmationItems` はそのロールを一覧から除外する。**データ欠損が警告一覧から消える可能性**があり、「表示されない=安全」は成立しない。別の安全判定・警告経路があるかを独立監査で確認すること。既存の6種LTテストだけでは検出できない。
7. 購入LTの既定6か月、注意窓3か月、3セット購入判断の固定8か月、スタンド番号による使用月数推定は、1年以上先の実操業・購入数量・納入見込みを保証しない。監査では「安全判定不能」を含む保守的表示を要求する。

## 独立監査の受入・停止条件

- 別モデルが実際に上記実コードとCI証拠を読んで、対象ID・優先順位・フィルター組合せ・数値/文字列スタンドキー・欠損マスタ・3セット・長期購入の反証試験を行い、監査者/日時/使用コミット/判定を記録する。ChatGPT自身の再点検を独立監査と称しない。
- 監査指摘は同じ隔離枝で最小修正し、修正後headのNode/Chromiumを再実行。以前のPASSを新headへ流用しない。
- 実保存・同期・ステータス変更・全件送信・実認証・実Sheets/GAS接続・公開/配信/mergeは禁止。固定3セット、ID、スタンド、履歴・予定、Roles C/管理表H/現場表Iを維持。
- `roles_backup_before_sync` は合成後バックアップでありLocal/Remote独立原本の復元証拠ではない。実データ試験前に別々の原本保全、差分ID/項目/前後値、revision、本人認証、復元手順を確認する。
- 期限: 2026-11-12 21:00 JSTに隔離証拠の到達判定。独立監査未完了ならROLL-001は未解決のまま。担当: チャッピー。次の確認: 2026-11-12 21:00 JST。
