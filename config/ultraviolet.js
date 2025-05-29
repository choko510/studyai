// Ultraviolet プロキシエンジン設定
const Ultraviolet = require('@titaniumnetwork-dev/ultraviolet');

const uvConfig = {
  // プロキシサービスのURLパス
  prefix: '/service/',
  
  // Bare サーバーのパス
  bare: '/bare/',
  
  // URL エンコード/デコード設定
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  
  // 静的ファイルパス
  handler: '/uv/uv.handler.js',
  bundle: '/uv/uv.bundle.js',
  config: '/uv/uv.config.js',
  sw: '/uv/uv.sw.js',
  
  // カスタム設定
  client: {
    // Service Worker のスコープ
    scope: '/service/',
    
    // デバッグモード
    debug: process.env.NODE_ENV !== 'production',
    
    // タイムアウト設定（ミリ秒）
    timeout: 30000,
    
    // リダイレクト処理
    followRedirects: true,
    
    // 最大リダイレクト回数
    maxRedirects: 10
  },
  
  // サーバー側設定
  server: {
    // ログレベル
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'info',
    
    // セキュリティヘッダー
    security: {
      // XSS 保護
      xssProtection: true,
      
      // Content-Type スニッフィング防止
      noSniff: true,
      
      // フレーム埋め込み制御
      frameOptions: 'SAMEORIGIN'
    },
    
    // パフォーマンス設定
    performance: {
      // キャッシュ有効期間（秒）
      cacheMaxAge: 3600,
      
      // 圧縮有効化
      compression: true,
      
      // Keep-Alive 接続
      keepAlive: true
    }
  },
  
  // フィルタリング設定
  filters: {
    // 広告ブロック
    adblock: {
      enabled: true,
      rules: [
        // 一般的な広告ドメイン
        /^https?:\/\/.*\.doubleclick\.net/,
        /^https?:\/\/.*\.googlesyndication\.com/,
        /^https?:\/\/.*\.googleadservices\.com/,
        /^https?:\/\/.*\.facebook\.com\/tr/,
        /^https?:\/\/.*\.amazon-adsystem\.com/,
        
        // 広告関連のパス
        /\/ads\/|\/advertisement\/|\/adv\/|\/banner\//,
        /\/popup\/|\/popunder\/|\/interstitial\//,
        
        // トラッキング
        /analytics|tracking|metrics|telemetry/,
        /beacon|pixel|collector/
      ]
    },
    
    // スクリプトフィルタリング
    scripts: {
      // 危険なスクリプトのブロック
      blockDangerous: true,
      
      // 外部スクリプトの制限
      restrictExternal: false,
      
      // 許可リスト
      whitelist: [
        'cdnjs.cloudflare.com',
        'ajax.googleapis.com',
        'code.jquery.com'
      ]
    },
    
    // メディアフィルタリング
    media: {
      // 自動再生防止
      preventAutoplay: true,
      
      // 大容量ファイルの警告サイズ（MB）
      warnSize: 50
    }
  },
  
  // プロキシ動作設定
  proxy: {
    // User-Agent の書き換え
    userAgent: {
      // デフォルトUA（空の場合は元のまま）
      default: '',
      
      // カスタムUA設定
      custom: {
        chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.1 Safari/537.36',
        mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
      }
    },
    
    // HTTP ヘッダー設定
    headers: {
      // リファラー制御
      referrer: 'no-referrer-when-downgrade',
      
      // 追加ヘッダー
      custom: {
        'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      }
    },
    
    // Cookie 処理
    cookies: {
      // Cookie の転送
      forward: true,
      
      // セキュアフラグの処理
      secure: 'auto',
      
      // SameSite 属性
      sameSite: 'lax'
    }
  },
  
  // 開発・デバッグ設定
  development: {
    // 詳細ログ
    verbose: process.env.NODE_ENV !== 'production',
    
    // エラー詳細表示
    showErrors: process.env.NODE_ENV !== 'production',
    
    // パフォーマンス計測
    measurePerformance: true
  }
};

module.exports = uvConfig;