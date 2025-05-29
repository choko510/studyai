// Bare-Client 設定
const bareConfig = {
  // Bare サーバーの基本設定
  server: {
    // ローカルアドレス（未指定の場合は自動）
    localAddress: undefined,
    
    // ファミリー設定（IPv4/IPv6）
    family: undefined,
    
    // 管理者情報
    maintainer: {
      email: 'admin@yourdomain.com',
      website: 'https://yourdomain.com'
    },
    
    // プロジェクト情報
    project: {
      name: 'Ultraviolet Proxy',
      description: '高機能Webプロキシサーバー',
      version: '1.0.0',
      repository: 'https://github.com/yourusername/ultraviolet-proxy'
    }
  },
  
  // ログ設定
  logging: {
    // エラーログの有効化
    logErrors: process.env.NODE_ENV !== 'production',
    
    // リクエストログの有効化
    logRequests: process.env.NODE_ENV !== 'production',
    
    // 詳細ログ
    verbose: process.env.NODE_ENV === 'development'
  },
  
  // セキュリティ設定
  security: {
    // 許可されたオリジン（空の場合は全て許可）
    allowedOrigins: [],
    
    // 禁止されたホスト
    blockedHosts: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ],
    
    // HTTPSリダイレクト強制
    forceHttps: false,
    
    // 危険なプロトコルの制限
    allowedProtocols: ['http:', 'https:'],
    
    // リクエストヘッダーフィルタリング
    headerFiltering: {
      // 除去するヘッダー
      remove: [
        'x-forwarded-for',
        'x-real-ip',
        'cf-connecting-ip',
        'true-client-ip'
      ],
      
      // 追加するヘッダー
      add: {
        'X-Proxy-By': 'Ultraviolet-Proxy'
      }
    }
  },
  
  // パフォーマンス設定
  performance: {
    // 接続タイムアウト（ミリ秒）
    timeout: 30000,
    
    // 最大同時接続数
    maxConnections: 1000,
    
    // キープアライブ設定
    keepAlive: true,
    
    // キープアライブタイムアウト
    keepAliveTimeout: 5000,
    
    // リクエストサイズ制限（バイト）
    maxRequestSize: 100 * 1024 * 1024, // 100MB
    
    // レスポンスサイズ制限（バイト）
    maxResponseSize: 500 * 1024 * 1024, // 500MB
    
    // チャンクサイズ（バイト）
    chunkSize: 64 * 1024 // 64KB
  },
  
  // WebSocket設定
  websocket: {
    // WebSocket有効化
    enabled: true,
    
    // WebSocketタイムアウト
    timeout: 60000,
    
    // 最大メッセージサイズ
    maxMessageSize: 10 * 1024 * 1024, // 10MB
    
    // ping/pong インターバル
    pingInterval: 30000,
    
    // 最大フレームサイズ
    maxFrameSize: 1024 * 1024 // 1MB
  },
  
  // キャッシュ設定
  cache: {
    // キャッシュ有効化
    enabled: true,
    
    // キャッシュタイプ
    type: 'memory', // 'memory', 'redis', 'file'
    
    // メモリキャッシュ設定
    memory: {
      // 最大エントリー数
      maxEntries: 10000,
      
      // TTL（秒）
      ttl: 3600,
      
      // LRU有効化
      lru: true
    },
    
    // キャッシュするヘッダー
    cacheHeaders: [
      'content-type',
      'content-length',
      'last-modified',
      'etag',
      'cache-control'
    ]
  },
  
  // プロキシ動作設定
  proxy: {
    // リダイレクト追跡
    followRedirects: true,
    
    // 最大リダイレクト数
    maxRedirects: 10,
    
    // 自動解凍
    decompress: true,
    
    // IPv6サポート
    ipv6: true,
    
    // DNS設定
    dns: {
      // DNS-over-HTTPS
      doh: false,
      
      // DNSサーバー
      servers: [
        '8.8.8.8',
        '8.8.4.4',
        '1.1.1.1',
        '1.0.0.1'
      ],
      
      // DNSキャッシュTTL
      cacheTtl: 300
    }
  },
  
  // SSL/TLS設定
  tls: {
    // 証明書検証
    rejectUnauthorized: true,
    
    // 最小TLSバージョン
    minVersion: 'TLSv1.2',
    
    // 暗号化スイート
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA384'
    ].join(':'),
    
    // ALPN設定
    alpnProtocols: ['h2', 'http/1.1']
  },
  
  // レート制限設定
  rateLimit: {
    // レート制限有効化
    enabled: true,
    
    // ウィンドウサイズ（ミリ秒）
    windowMs: 15 * 60 * 1000, // 15分
    
    // 最大リクエスト数
    max: 1000,
    
    // スキップ条件
    skip: (req) => {
      // ローカルホストはスキップ
      return req.ip === '127.0.0.1' || req.ip === '::1';
    },
    
    // エラーメッセージ
    message: 'レート制限を超過しました。しばらく待ってから再試行してください。'
  },
  
  // 監視・メトリクス設定
  monitoring: {
    // メトリクス収集
    enabled: process.env.NODE_ENV !== 'production',
    
    // 収集する項目
    metrics: [
      'requests_total',
      'requests_duration',
      'response_size',
      'errors_total',
      'active_connections'
    ],
    
    // 収集間隔（秒）
    interval: 60
  },
  
  // 開発・デバッグ設定
  development: {
    // デバッグモード
    debug: process.env.NODE_ENV === 'development',
    
    // プロファイリング
    profiling: process.env.NODE_ENV === 'development',
    
    // 詳細エラー情報
    verboseErrors: process.env.NODE_ENV !== 'production'
  }
};

module.exports = bareConfig;