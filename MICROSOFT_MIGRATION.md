# Microsoft ローカル試作環境

この環境は、現在のHTML/CSS/JavaScript画面を保ったまま、Azure Static Web AppsとAzure Functionsを想定した完成イメージを家庭のPCで確認するためのものです。会社のMicrosoft環境、Entra ID、SharePoint、実データには接続しません。

## 必要なソフト

- Git
- Node.js 22 LTS（Azure FunctionsがサポートするNode.js 22を使用）
- npm（Node.jsに同梱）

Azure Static Web Apps CLIはプロジェクトへ開発用依存関係として入るため、グローバルインストールは不要です。初回だけインターネット接続が必要です。

## 家でMicrosoftローカル版を起動する

PowerShellでリポジトリへ移動し、次を実行します。

```powershell
git switch microsoft-migration
npm install
npm --prefix api install
npm run start:microsoft-local
```

ブラウザで `http://localhost:4280` を開きます。初期設定は管理者としてログイン済みになる想定です。表示されない場合は開発者ツールのConsoleで次を実行して再読込します。

このコマンドは家庭で確実に確認できる軽量サーバーを使います。Node.js 22とAzure Functions Core Toolsが揃った環境でStatic Web Appsエミュレーターそのものを使う場合は、代わりに次を実行します。

```powershell
npm run start:swa
```

```javascript
RollAuth.setLocalRole('admin')
```

認証状態は次の3種類を切り替えられます。

```javascript
RollAuth.setLocalRole('logged-out') // 未ログイン
RollAuth.setLocalRole('user')       // 一般利用者
RollAuth.setLocalRole('admin')      // 管理者
```

これはローカル表示確認だけの模擬認証です。会社のEntra ID認証を装うものではありません。

## Google版との切替

接続設定は `js/config/runtime-config.js` の1か所だけです。このファイルはGitに保存されません。

Microsoftローカル:

```javascript
window.ROLL_APP_RUNTIME_CONFIG = {
  backendMode: 'microsoft-local',
  authMode: 'microsoft-local',
  apiBaseUrl: '/api',
  localAuthRole: 'admin',
  googleEndpoint: ''
};
```

Google:

```javascript
window.ROLL_APP_RUNTIME_CONFIG = {
  backendMode: 'google',
  authMode: 'legacy',
  apiBaseUrl: '/api',
  localAuthRole: 'logged-out',
  googleEndpoint: '個別に管理しているApps Script URL'
};
```

`runtime-config.example.js` をコピーして作成できます。GoogleのURLはチャット、文書、Gitへ貼らず、安全な社内手順で設定してください。`microsoft` モードは将来の会社API用の予約です。会社確認前は使用しません。

## 架空データの保存と初期化

編集内容は `api/local-data/roles.json` にだけ保存されます。このフォルダーはGit対象外です。クラウド保存ではありません。

初期状態へ戻すには、起動中のプロセスを止めて次を実行します。

```powershell
npm run reset:local-data
```

初期データはすべて架空で、オンライン、次回組み込み、改削待ち、改削中、新品予備保管、作業依頼進行中、使用開始/終了日、3セット指定を確認できます。

## 動作確認

1. `http://localhost:4280/api/health` が `production: false` を返す。
2. 一覧に `#2-101` などの架空データが表示される。
3. ロールを編集して保存する。
4. ページを再読込し、編集内容が保持される。
5. 3セット、次回組み込み、カード、工作課ボードを開く。
6. `http://localhost:4280/api/roles` でRoles A～P相当の16項目を取得できる。
7. APIプロセスを停止した状態で操作し、同期メッセージにAPI接続エラーが表示される。
8. `npm test` でデータ項目、日付、booleanの検証を行う。

## 会社で後から設定する項目

- Azure Static Web Appsのサブスクリプション、リソース、デプロイ設定
- Microsoft Entra IDのテナント、アプリ登録、利用者/管理者ロール
- 会社が許可する保存基盤（SharePoint Lists等）
- Azure Functionsから保存基盤へ接続する認証方式
- 会社GitHubまたはAzure DevOpsのリポジトリとCI/CD
- APIの認可、監査ログ、バックアップ、保持期間
- マスターデータとロール管理表相当APIの正式仕様

SharePointへ直接依存させず、画面は `RollDataService` の `getRoles()`、`saveRoles()`、`getMasterData()`、`saveMasterData()`、`healthCheck()` を使う構成です。

## セキュリティ上の注意

- 会社データを家庭PCへコピーしない。
- テナントID、クライアント秘密鍵、APIキー、実URLをGitへ保存しない。
- `.env`、`local.settings.json`、`runtime-config.js`、`api/local-data/` はGit対象外。
- 架空データへ実在の担当者名、設備履歴、日付、径、メモを混ぜない。
- このローカルAPIは認証・本番耐久性を備えたクラウド保存ではない。

## 元のGoogle版へ戻す

現在のGoogle版は `main` のコミット `4ce6b7492ccd7a6c625a472ef5a5a331e0ab3d42` に残っています。未コミット変更がないことを `git status` で確認してから次を実行します。

```powershell
git switch main
```

未コミット変更がある場合は、破棄せず先に内容を確認してください。Google版のApps ScriptとSheets同期を削除する作業は今回行いません。
