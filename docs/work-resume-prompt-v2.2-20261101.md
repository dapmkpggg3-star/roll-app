# ロール管理システム｜WORK再開プロンプト v2.2

更新日: 2026-11-01

あなたはロール管理システムの開発・検証担当です。
モデルはAstraを想定しますが、モデル名よりも下記の再開順序を優先してください。

## 最終目的

各スタンドについて12か月先まで予測し、固定3セットのロールローテーションを維持し、ロール不足による工場停止を防ぐ。

現行Google版:
- GitHub Pages
- PWA
- GAS
- Google Sheets

を完成させる。
Microsoft移行は後回し。

## 重要原則

このプロンプトに書かれた静的な「現在地」だけを信用しない。
通常Chat側でも設計・資料照合が進むため、**再開時点のNotionとGitHubを正とする。**

## 再開直後の必須順序

### 1. Notion最新記録を読む

既存案件:
https://app.notion.com/p/3ffc3505de3381b78894da6c3887990f

最新の:
- 現在地
- 決定事項
- 未解決
- 次の行動
- Chat側で追加された仕様

を読む。

10/29以前のWork会話だけを基準にしない。

### 2. Work保存版46を実体確認する

Work側の開発ディレクトリで:
- git status
- current branch
- HEAD
- uncommitted changes
- Phase B core
- Phase B tests
を確認。

Notionに記録されたローカルcommit SHAがGitHub remoteに存在すると仮定しない。

### 3. 保存版46をPhase Cより先にGitHubへ保全する

推奨branch:
`work-preserve-v46-20261101`

禁止:
- mainへの直接push
- PR #14 headへの上書き
- force push
- 保存前の大規模変更

push後:
- remote branch SHAを再取得
- GitHubからPhase B core/testを読み戻す

保全確認できない場合はPhase C実装を開始しない。

### 4. Chat側handoff indexを読む

branch:
`chat-phase-c-17-contract-20261101`

最初に:
`docs/phase-c-17-handoff-index-20261101.md`

を読む。

indexに記載された順に必要な仕様を読む。

特に:
- simulation contract
- current input snapshot
- code registry
- golden expected output
- machine-readable test vectors
- Work test runbook
- implementation map

を優先。

### 5. Chat仕様を実装本体としてコピーしない

Chat branchは:
- 設計
- fixture
- acceptance criteria
- test vectors
の保全場所。

実装基点は必ずWork保存版46。

mainからPhase Bを作り直さない。

## Phase C対象

最初は#17のみ:
- 17-88
- 17-89
- 17-90

他スタンドへ自動展開しない。

## Phase Cの現在の基本判定

result:
- normal
- shortage
- incomplete

優先順位:
`shortage > incomplete > normal`

unknownを0へ変換しない。
plannedをactualへ昇格しない。
既知shortageをunknownで隠さない。

machine codeは:
`docs/phase-c-code-registry-20261101.md`
を唯一の辞書とする。

deprecated aliasを新規実装しない。

## 実装順

推奨implementation branch:
`work-phase-c-17-20261101`

順序:
1. Phase C pure core
2. targeted node:test
3. full regression
4. #17 adapter
5. today task期限表示回帰
6. existing 3-set forecast UIへ#17限定接続
7. full regression
8. validation browser
9. 必要時のみPWA cache
10. GAS/Sheets変更が必要なら別工程

詳細:
`docs/phase-c-work-test-runbook-20261101.md`

## #17で直接流用しないlegacy推論

- useStart + 3か月をexchangeDate扱い
- 改削30日heuristic
- dispatch不明中古予備にtoday+2日仮搬出
- StandMaster292mm + > 判定を年間290mm以上判定へ流用
- nextCaliberの番号順自動選択

## 本番保護

Phase C検証完了まで変更しない:
- main
- PR #14 merge
- 会社本番GAS
- 実業務Sheets
- StandMaster #17=292
- #17以外のPhase C化

## 作業終了時

同じNotion案件へ:
- preservation branch / commit
- implementation branch / commit
- 実装結果
- test結果
- browser結果
- Google結果（実施時のみ）
- 未解決
- 判断理由
- 次の行動

を追記。

保存後に読み直して確認。

Work内だけの未保存状態を完成扱いしない。

## 本人操作

本人操作が不可欠な場合だけ1件に絞って依頼。
同じログインやクリックを繰り返し依頼しない。
