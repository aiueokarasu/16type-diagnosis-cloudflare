
# Cloudflare アクセス解析・管理画面セットアップ

このプロジェクトは、1つのGitHubリポジトリから2つのWorkerをデプロイします。

| Worker | 設定ファイル | 役割 |
| --- | --- | --- |
| `16type-diagnosis` | `wrangler.jsonc` | 既存の診断サイトと `/api/analytics` |
| `type-navi-console` | `wrangler.admin.jsonc` | ログイン、管理画面、管理API、保存期間管理 |

両Workerは同じD1データベース `type-navi-analytics` を参照します。Wrangler 4の自動プロビジョニングを利用できるよう、初回デプロイ前はリソースIDを記載していません。CloudflareでデータベースIDを確認できた後は、明示的な紐付けのため両方の設定ファイルへ同じIDを追加できます。

## 既存の公開Worker

現在のGit連携設定を維持します。

- Build command: `pnpm run build`
- Deploy command: `pnpm exec wrangler deploy`
- Root directory: `/`
- Production branch: `main`

Worker名と公開URLは変わりません。Workerコードを先に通すのは `/api/analytics` だけで、それ以外は従来どおり静的ファイルを配信します。

初回デプロイでD1が作成された後、マイグレーションを1回だけ適用します。

```text
pnpm exec wrangler d1 migrations apply type-navi-analytics --remote
```

Cloudflare Dashboardから `type-navi-analytics` に `migrations/0001_analytics_and_admin.sql` を実行する方法でも構いません。SQLへパスワードを記載しないでください。

公開Workerへ次のSecretを登録します。

- `ANALYTICS_PEPPER`: 32バイト以上の暗号学的にランダムな値

ブラウザが作る匿名の訪問者IDとセッションIDは、このSecretを使ったHMACで不可逆化してからD1へ保存します。このSecretを変更すると匿名訪問者の識別体系が新しくなります。

## 管理WorkerのGit連携

`type-navi-console` というWorkerを作成し、同じGitHubリポジトリの `main` ブランチへ接続します。

- Build command: `pnpm run build:admin`
- Deploy command: `pnpm exec wrangler deploy --config wrangler.admin.jsonc`
- Root directory: `/`
- Production branch: `main`

管理Workerへ次のSecretを登録します。

- `ADMIN_PATH`: 先頭の `/` を除いた管理画面パス
- `AUTH_PEPPER`: 公開Workerとは別の、32バイト以上のランダムな値
- `ADMIN_SETUP_TOKEN`: 初期登録で1回だけ使う、32バイト以上のランダムな値

Secretの値はGitHub、Wrangler設定、ビルドログ、URL、この文書のいずれにも記録しません。

## 2名の管理者を1名ずつ登録する

1. D1マイグレーションが完了していることを確認します。
2. 管理Workerへ上記3つのSecretを登録します。
3. `https://type-navi-console.type-navi-jp.workers.dev/<ADMIN_PATH>/setup` を開きます。
4. `ADMIN_SETUP_TOKEN` と、1人目の管理者名・パスワードを入力します。
5. 1人目でログインし、「管理者アカウント」欄から2人目の管理者名・初期パスワードを登録します。
6. それぞれのパスワードは12文字以上にし、パスワード管理アプリで生成した異なる値を推奨します。
7. 2人目の登録成功後、管理Workerから `ADMIN_SETUP_TOKEN` Secretを削除します。
8. `https://type-navi-console.type-navi-jp.workers.dev/<ADMIN_PATH>` で2名が別々にログインできることを確認します。

初期登録APIは管理者が1名でも存在すれば再実行を拒否します。2人目の追加APIはログインとCSRF検証を必須とし、データベースも3人目の登録を拒否します。パスワードは `AUTH_PEPPER` と個別saltを組み合わせたPBKDF2-SHA-256ハッシュだけを保存します。

## 管理者のブラウザを本番集計から除外する

本番確認に使う各ブラウザで、公開サイトを次のURLから一度開きます。

```text
https://16type-diagnosis.type-navi-jp.workers.dev/?analytics=exclude
```

除外設定はそのブラウザ内だけに保存されます。再び集計へ含める場合は `?analytics=include` を開きます。

結果プレビュー、localhost、公開URL以外のWorkerホストは自動で集計対象外になります。

## データ保存期間

管理WorkerのCronは毎日03:00（日本時間、UTCでは `0 18 * * *`）に実行され、次を削除します。

- 90日を過ぎた匿名アクセス解析セッション
- 有効期限を過ぎた管理画面ログインセッション

IPアドレス、氏名、メールアドレス、生のブラウザ識別子は保存しません。

## 今後のmainブランチへのPush

2つのWorkerを同じGitHubリポジトリへ接続すると、`main` へのPushでそれぞれ独立したCloudflareビルドが始まります。公開Workerは `wrangler.jsonc`、管理Workerは `wrangler.admin.jsonc` を使用します。

GitHub CIではCloudflareへ反映する前に、両WorkerのビルドとWrangler dry-runを確認します。

