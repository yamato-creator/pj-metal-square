# Precious Metal Mine（貴金属売買システム）

スクエア合同会社向けの貴金属（金 / 銀 / プラチナ / パラジウム）売買・在庫管理ダッシュボード。
ユーザーは預入・現物返却・売却見積依頼を行い、管理者はスプレッドシート（DBの代用）で承認業務を回す。

## 本番環境

| 環境 | URL | 補足 |
|------|-----|------|
| バックエンド | https://api.preciousmetalmine.com | Render（main push で自動デプロイ） |
| フロント | https://www.preciousmetalmine.com | Vercel（旧チーム所属、要DNS移行） |
| フロント新 | https://pj-metal-square-three.vercel.app | Vercel（最新コード即時反映） |
| DB | Google Sheets (`SPREADSHEET_ID` 環境変数) | サービスアカウント経由 |

## アーキテクチャ

- バックエンド: FastAPI + bcrypt + slowapi（rate limit）+ google-api-python-client
- フロント: React 18 + TypeScript + MUI + sessionStorage（XSS対策）
- メール: Cloud Function `send_email_http_square` → 503 不安定時は GAS Web App に切替可能（`EMAIL_FUNCTION_URL` 環境変数）
- 認証: API キー方式（`x-api-key` ヘッダ）、bcrypt ハッシュ、レート制限 login 10/min

## 重要な変更（2026-06-17）

セキュリティ・データ整合性 22 件修正：

- パスワードを bcrypt ハッシュ化、自動移行ロジック付き
- 認可漏れ修正（他人の資産・パスワード閲覧/変更を403）
- 取引可能時間（JST 10:00-24:00）をサーバー側で強制
- 同一ユーザー取引を asyncio.Lock で直列化（並行更新レース防止）
- 退会時 API キーを `REVOKED_` プレフィックスでローテ
- credentials.json を gitignore / dockerignore で除外
- フロント API キーを localStorage → sessionStorage
- 37 件の単体テスト全緑、GitHub Actions CI で自動実行

詳細: `docs/デプロイ状況.md`, `進捗報告/20260617_進捗報告.html`

---

# 開発者向けセットアップガイド

このガイドでは、開発環境のセットアップから、アプリケーションの起動までの手順を説明します。

バックエンドとフロントエンドを立ち上げる必要がある。
## 前提条件

以下のツールがインストールされていることを確認してください：
- Python 
- Node.js 
- npm (Node.jsと一緒にインストールされます)
- Poetry (Pythonパッケージ管理ツール)

これらがインストールされていない場合は、各公式サイトからダウンロードしてインストールしてください：

- [Python のダウンロード](https://www.python.org/downloads/)
- [Node.js のダウンロード](https://nodejs.org/)
- [Poetry のインストール手順](https://python-poetry.org/docs/#installation)

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone [リポジトリのURL]
cd pj-metal
```

### 2. バックエンドのセットアップ

1. Poetry を使って Python の依存パッケージをインストール:
```bash
cd mt-dashboard-backend  # バックエンドのディレクトリに移動
poetry install
```

2. バックエンドの起動:
```bash
poetry run uvicorn mt_dashboard_backend.main:app --reload
```

バックエンドが正常に起動すると、通常 http://localhost:8000 でアクセス可能になります。

### 3. フロントエンドのセットアップ

1. 新しいターミナルを開き、フロントエンドのディレクトリに移動:(バックエンドのターミナルは閉じない)
```bash
cd mt-dashboard-frontend  # フロントエンドのディレクトリに移動
```

2. npm で依存パッケージをインストール:
```bash
npm install
```

3. フロントエンドの起動:
```bash
npm run start
```

フロントエンドが正常に起動すると、ブラウザが自動的に開き（または http://localhost:3000 にアクセス）、アプリケーションが表示されます。

## トラブルシューティング

### よくある問題と解決方法

1. **ポートが既に使用されている場合**
  - バックエンド (8000番ポート) やフロントエンド (3000番ポート) が起動できない場合:
    - 該当のポートを使用している他のプロセスを終了させる
    - または、別のポートを指定して起動する

2. **依存関係のインストールに失敗する場合**
  - インターネット接続を確認
  - npm や Poetry のキャッシュをクリアして再試行:
    ```bash
    npm cache clean --force  # npmの場合
    poetry cache clear . --all  # Poetryの場合
    ```

3. **`poetry` コマンドが見つからない場合**
  - Poetry が正しくインストールされているか確認
  - PATHが正しく設定されているか確認
