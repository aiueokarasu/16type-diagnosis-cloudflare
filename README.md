# 16 compass

16の質問で、自分の傾向を4つの軸から見つめる16タイプ診断サイトです。診断結果は端末内で計算され、回答データは保存しません。

## ローカル開発

```bash
pnpm install
pnpm dev
```

`http://localhost:3000` を開いて確認できます。

## 品質チェック

```bash
pnpm build
pnpm lint
```

## Cloudflare Workers へのデプロイ

CloudflareのGit連携では、次の設定を使用します。

- Build command: `pnpm run build`
- Deploy command: `pnpm exec wrangler deploy`
- Root directory: `/`（リポジトリ直下。入力欄は空欄でも可）

`wrangler.jsonc` を入力設定として読み込み、ビルド時にCloudflare Vite Pluginが
`dist/server/wrangler.json` と `.wrangler/deploy/config.json` を生成します。
Deploy commandはこの生成済み設定を自動的に使用します。

## GitHubでの開発フロー

1. `main` から作業ブランチを作成（例: `feature/add-question`）
2. 変更をコミットして GitHub に push
3. Pull Request を作成
4. 自動チェックが通ったことを確認して `main` にマージ

`.github/workflows/ci.yml` により、Pull Request と `main` への push 時にビルドが自動実行されます。

## 構成

- `app/page.tsx`: 質問、判定ロジック、16タイプの結果文
- `app/globals.css`: デザインとレスポンシブ対応
- `app/layout.tsx`: ページタイトルなどの基本情報

## 注意

この診断は自己理解を楽しむための簡易コンテンツで、医学的・心理学的な診断ではありません。
