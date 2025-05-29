# Ultraviolet Proxy - 高機能Webプロキシサーバー

UltravioletとBare-Clientを使用した、高機能なWebプロキシサーバーです。学校や職場のネットワーク制限を回避し、安全かつプライベートなウェブブラウジングを提供します。

## 🚀 主な機能

### ✨ 基本機能
- **完全なウェブブラウジング**: JavaScript、CSS、画像の完全サポート
- **高速プロキシエンジン**: Ultraviolet + Bare-Client による高性能通信
- **レスポンシブデザイン**: デスクトップ・タブレット・モバイル対応

### 🛡️ セキュリティ機能
- **セキュリティ保護**: 危険なサイトや悪意のあるコンテンツの自動ブロック
- **プライベートネットワーク保護**: ローカルネットワークへのアクセス制限
- **安全なファイルダウンロード**: 危険なファイル拡張子の検出とブロック

### 🚫 広告ブロック機能
- **高度な広告ブロック**: EasyListベースのフィルタリング
- **トラッキング防止**: 各種アナリティクス・トラッキングピクセルをブロック
- **カスタムフィルター**: 独自のブロックルール追加可能

### 🎭 プライバシー機能
- **ユーザーエージェント変更**: Chrome、Firefox、Safari、モバイルブラウザに偽装
- **リファラー制御**: 適切なリファラーポリシーの設定
- **Cookie管理**: セキュアなCookie処理

### ⚙️ 高度な機能
- **JavaScript制御**: 有効・制限付き・無効の3段階制御
- **カスタムCSS**: サイト表示のカスタマイズ
- **履歴・お気に入り**: ローカルストレージベースの管理
- **テーマ切り替え**: ライト・ダーク・ブルーテーマ

## 📦 インストール

### 前提条件
- Node.js 16.x 以上
- npm または yarn
- VPS または専用サーバー

### セットアップ手順

1. **リポジトリのクローン**
```bash
git clone https://github.com/yourusername/ultraviolet-proxy.git
cd ultraviolet-proxy
```

2. **依存関係のインストール**
```bash
npm install
```

3. **環境変数の設定**
```bash
cp .env.example .env
nano .env
```

4. **アプリケーションの起動**
```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

## 🖥️ サーバー要件

### 最小要件
- **CPU**: 1 vCPU
- **RAM**: 1GB
- **ストレージ**: 5GB
- **帯域幅**: 100Mbps

### 推奨要件
- **CPU**: 2+ vCPU
- **RAM**: 2GB+
- **ストレージ**: 10GB+
- **帯域幅**: 1Gbps

## ⚙️ 設定

### 環境変数

```bash
# サーバー設定
PORT=3000
NODE_ENV=production

# ログ設定
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# セキュリティ設定
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000

# プロキシ設定
UV_PREFIX=/service/
BARE_PREFIX=/bare/
```

### Nginx設定例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # HTTPS リダイレクト
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL証明書設定
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # プロキシ設定
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 静的ファイルのキャッシュ
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### PM2設定例

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ultraviolet-proxy',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

## 🎨 カスタマイズ

### テーマのカスタマイズ

`public/assets/css/themes.css` でテーマをカスタマイズできます：

```css
/* カスタムテーマ例 */
.theme-custom {
    --primary-color: #e91e63;
    --primary-dark: #c2185b;
    --bg-primary: #fce4ec;
}
```

### 広告ブロックルールの追加

`src/middleware/adblock.js` でカスタムルールを追加：

```javascript
// カスタムドメインの追加
adblockMiddleware.addDomain('example-ads.com');

// カスタムパターンの追加
adblockMiddleware.addPattern(/\/custom-ad-pattern\//i);
```

### ユーザーエージェントの追加

`src/middleware/useragent.js` でカスタムUAを追加：

```javascript
// カスタムユーザーエージェントの追加
useragentMiddleware.addUserAgent('custom', 'my-browser', {
    name: 'My Custom Browser',
    ua: 'Mozilla/5.0 (Custom) Browser/1.0',
    platform: 'Custom',
    vendor: 'Custom Inc.',
    features: ['custom-feature']
});
```

## 📊 監視とログ

### ログファイル
- `logs/error.log` - エラーログ
- `logs/combined.log` - 全てのログ
- `logs/access.log` - アクセスログ

### 統計API
- `GET /api/stats` - 統計情報の取得
- `GET /api/status` - サーバー状態の確認
- `GET /api/health` - ヘルスチェック

### 監視設定例（Grafana + Prometheus）

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ultraviolet-proxy'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
```

## 🔧 トラブルシューティング

### よくある問題

#### 1. プロキシが動作しない
```bash
# ログを確認
tail -f logs/combined.log

# ポートの確認
netstat -tulpn | grep 3000

# プロセスの確認
ps aux | grep node
```

#### 2. 広告ブロックが効かない
- ブラウザのキャッシュをクリア
- 設定で広告ブロックが有効になっているか確認
- カスタムルールの構文を確認

#### 3. セキュリティ警告が多発する
- セキュリティレベルを調整
- ホワイトリストにドメインを追加
- ログでブロック理由を確認

#### 4. パフォーマンスが低下
```bash
# メモリ使用量確認
free -h

# CPU使用率確認
top -p $(pgrep -f "node.*server.js")

# ディスク容量確認
df -h
```

## 🚀 本番デプロイ

### Docker を使用したデプロイ

```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

USER node
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  ultraviolet-proxy:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - ultraviolet-proxy
    restart: unless-stopped
```

### セキュリティ強化

```bash
# ファイアウォール設定
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable

# 自動更新設定
echo 'unattended-upgrades unattended-upgrades/enable_auto_updates boolean true' | debconf-set-selections
apt-get install unattended-upgrades

# ログローテーション設定
cat > /etc/logrotate.d/ultraviolet-proxy << 'EOF'
/path/to/ultraviolet-proxy/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 node node
    postrotate
        systemctl reload ultraviolet-proxy
    endscript
}
EOF
```

## 📈 パフォーマンス最適化

### Node.js 最適化
```bash
# メモリ制限の設定
export NODE_OPTIONS="--max-old-space-size=2048"

# クラスター化
npm install pm2 -g
pm2 start ecosystem.config.js
```

### CDN設定
```javascript
// 静的ファイルのCDN化
const CDN_URL = process.env.CDN_URL || '';

app.use('/assets', express.static('public/assets', {
    maxAge: '1y',
    setHeaders: (res, path) => {
        if (CDN_URL) {
            res.setHeader('X-CDN-URL', CDN_URL);
        }
    }
}));
```

## 🤝 コントリビューション

コントリビューションを歓迎します！

1. フォークしてください
2. フィーチャーブランチを作成してください (`git checkout -b feature/AmazingFeature`)
3. 変更をコミットしてください (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュしてください (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成してください

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は `LICENSE` ファイルを参照してください。

## ⚠️ 免責事項

このソフトウェアは教育目的で提供されています。利用者は自己責任でご使用ください。開発者は、このソフトウェアの使用によって生じたいかなる損害についても責任を負いません。

## 🙏 謝辞

- [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) - 高性能プロキシエンジン
- [Bare-Client](https://github.com/tomphttp/bare-client) - 効率的なHTTPトランスポート
- その他のオープンソースプロジェクト

## 📞 サポート

問題が発生した場合は、以下の方法でサポートを受けられます：

- [GitHub Issues](https://github.com/yourusername/ultraviolet-proxy/issues)
- [Discord サーバー](https://discord.gg/your-server)
- [ドキュメント](https://docs.your-domain.com)

---

**Ultraviolet Proxy** - 自由で安全なインターネットアクセスを提供します 🌐