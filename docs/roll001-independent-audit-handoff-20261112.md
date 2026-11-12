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

## 2026-11-13 02:30 JST 追補｜現行隔離headと監査前提の訂正

- **現行検証head**: `128bcb3ef4c2aa9fe670898162cfe0babd4c52aa`（本追補追加前）。上の古い `68989f4`・26件の記述は履歴証拠であり、現行headの証拠ではない。
- [GitHub Actions run 43248475989](https://github.com/dapmkpggg3-star/roll-app/actions/runs/43248475989): 同一headの `isolated-node` と `isolated-browser` はともに `success`。Notion 01:27記録にNode 49件PASS・Chromium成功と記録。今回ジョブ状態とartifactのhead一致を再照合した。
- [artifact 13957144000](https://github.com/dapmkpggg3-star/roll-app/actions/runs/43248475989/artifacts/13957144000): `roll001-dom-evidence`、2,291,982 bytes、`sha256:15726539c365effad855a14051c0ca1987a15e5bdd505a84316afc97fd057f40`。**ZIP内PNG/JSONは今回未取得・未目視**。17ファイルという件数は前回記録によるものであり、今回の個別内容検証ではない。
- **修正済みの旧監査指摘**: 数値10と文字列'10'の厳密比較による不一致、欠損マスタを購入確認から消す問題、廃却待ち混入は隔離実コードで修正され同一head CI成功。ただし本番再現・独立監査は未実施。
- **監査者の重点反証**: タスクの優先順位と検索/非表示組合せ、ステータス旧表記、購入マスタ欠損時の「安全判定不能」表示、3セット固定と年間生産計画に基づく12か月以上の不足予測、意図しない外部通信、Local/Remote原本の保全・復元未証明。旧記述の「未修正の可能性」は現在のコードに対する事実と混同しない。
- **判定**: ROLL-001〜005は未解決5件、解消確認0件、概算6合目、業務受入No-Go。11/12期限は未達のまま。独立監査前の本体・本番適用禁止。main/PR14/版57/保全枝/GAS/Sheets/実データには変更禁止。次工程はartifact実取得・画像/JSON照合→別モデル監査、担当チャッピー、再確認2026-11-13。

## 2026-11-13 08:36 JST 追補｜ROLL-002/003 独立監査依頼（未実施）

**対象を更新:** 最新隔離headは `a8e5ce936a6ae1107a5a0408e3de18a33431d38f`（この文書の追補前）。保全原本 `work-preserve-v46-20261101` との比較は ahead 60 / behind 0、変更15ファイル、`js/sync.js` +41/-6、`js/app.js` +108/-45。これらは監査範囲の説明であり監査結果ではない。

### 直近の確定CIと未検証部分
- [run 43325808202](https://github.com/dapmkpggg3-star/roll-app/actions/runs/43325808202) は旧head `dc5021c` で Node 53/53 PASS、Chromium DOM4/実フィルター6/フルUI6 PASS。これは新headの検証ではない。
- 最新head `a8e5ce9` には `js/sync.js` のRemote POST・再読成功後Local確定への移動と、送信中Local変更時の署名再検査が含まれる。**最新head CI・別モデル監査は未確認**。

### 別モデル監査者への具体的な反証依頼
1. `js/sync.js` の `syncRoles()`、`saveData()`、`fetchRemoteRolesForGuard()`、`verifySavedRoles()`、`getLocalStorageSyncSignature()` を呼び出し順で追跡。POSTが `false` / 例外 / 実際には書込済みだが応答消失 / 読戻し失敗 / 不一致の各場合に、Local・Remote・削除待ちID・同期確認状態がどうなるかを表で示す。
2. Remote POST中のLocal編集・削除・二重同期・タブ競合・LocalStorage保存失敗を匿名fixtureで反証。特に成功後の署名不一致時はRemoteが更新済みでもLocal確定を拒否するため、次回再同期で競合が安全停止するか検証。無条件の自動再送を推奨しない。
3. `storeIndependentSyncOriginals` / `readIndependentSyncOriginals` の固定キー上書き・ブラウザ消失・破損・容量不足を調査。`roles_backup_before_sync` は独立した原状復元点と認めない。Local/Remoteそれぞれの**同期前**原本を世代・検証用ハッシュ・外部保全で残す設計と、実データ非接続の復元試験手順を要求。
4. `test/roll003-independent-originals.test.cjs` と `test/sync-revision-guard.test.js` が実コードをどこまで呼んでいるか確認し、モックが危険な経路を隠していないか、検証されない分岐を列挙。
5. 認証・GAS/Sheets ID・Remote revision・60件差分3件・固定3セット・Roles C/管理表H/現場表I・履歴と予定・オンライン交代への影響を「未検証」と明記し、証拠がない安全宣言を拒否。

### 監査成果物の形式
- 監査者のモデル名、日時、対象headとファイルblob、独立に実行したテスト、指摘ID/重大度/再現条件/影響/最小修正案/再試験条件を残す。
- **合格条件:** 新headのNode/Chromium CI生ログ＋重要分岐の反証試験＋Local/Remote独立復元の証拠＋認証/実接続の安全ゲート。満たさなければ「監査待ち／業務No-Go」を維持。
- 禁止: 実データ、実認証、実GAS/Sheets、main、PR14、非公開版57、公開/merge/配信への変更。監査用匿名情報以外を外部モデルへ渡さない。

**状態:** この文書は監査依頼資料。独立監査を実施した証拠はない。担当チャッピー、再確認2026-11-13。

## 2026-11-13｜コード実査結果（ChatGPTによる一次監査・独立監査ではない）

対象: `js/sync.js` の `syncRoles()`, `getLocalStorageSyncSignature()`, `parseStoredJsonArrayFromText()`, `storeIndependentSyncOriginals()`。コードを直接読んで以下を指摘。**別モデルの監査実施実績はなし**。

- **AUD-SYNC-01 / 高 / 未解決**: `getLocalStorageSyncSignature()` は保存文字列をJSONとして解釈し、`parseStoredJsonArrayFromText()` はJSON破損・配列以外を `[]` に変換する。開始時と保存直前に両方破損していた場合、異常が「空配列」の同一署名に正規化される可能性がある。署名一致を原本一致と誤認しないこと。Local原本のJSON破損を**書込前に停止**する匿名反証テストが必要。
- **AUD-SYNC-02 / 高 / 未解決**: Remote保存成功後の再読・照合が成功しても、Local編集競合時は `return false` でLocal確定を止める一方、Remoteは更新済み。現在のガードは自動再送しないが、`isSyncQueued` が別操作でtrueなら `finally` の `syncRoles()` 再実行が起き得る。Remote/Local不一致の明示的な手動差分確認・自動再試行抑止が必要。
- **AUD-SYNC-03 / 高 / 未解決**: `storeIndependentSyncOriginals` は2つのlocalStorageキーに逐次保存し、原子的な保存ではない。途中で容量エラーが出ればLocalだけ新世代・Remote旧世代の不整合が起こり得る。固定キー上書き/端末消失と合わせ、独立復元点として不合格。
- **AUD-SYNC-04 / 中 / 未解決**: Remote POST `false` の表示「ブラウザ内には保存されています」は、結合結果がLocalに反映されていない新仕様では曖昧。Local旧データ保全とRemoteの保存結果未確定を区別する必要がある。

一次監査の判定: **No-Go、隔離変更の統合禁止**。監査証拠は静的コード読取りであり、匿名Node/Chromium反証テストの新head実行・別モデル独立監査・本番検証は未実施。次: まず AUD-SYNC-01/02 の匿名回帰テストと最小隔離修正案、次に別モデル監査、CI照合。担当チャッピー、再確認2026-11-13。
