```markdown
# テスト用プロジェクト

このプロジェクトはテスト用のリポジトリです。
プルリクエストの練習として作成しています。
# プロジェクトセットアップガイド

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
