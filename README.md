## 主な機能

- ドメインホワイトリストによるアクセス制限
- HTML、JavaScript、CSSの自動変換
- 広告ブロックとトラッキングスクリプトの無効化
- すべてのリンクをプロキシ経由に書き換え
- コンテンツのキャッシュ機能

## インストール方法

```bash
# 依存関係のインストール
pip install -r requirements.txt
```

## 使用方法

```bash
# 開発サーバーの起動
cd pyproxy
uvicorn app.main:app --reload
```

ブラウザで http://localhost:8000 にアクセスし、プロキシしたいURLを入力してください。

## 設定

`.env`ファイルでプロキシの設定をカスタマイズできます：

```
# .envファイルの例
DEBUG=True
HOST=0.0.0.0
PORT=8000
ALLOWED_DOMAINS=example.com,wikipedia.org
CACHE_ENABLED=True
CACHE_EXPIRY=3600  # 秒単位
```
