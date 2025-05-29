const express = require('express');
const { createBareServer } = require('bare-server-node');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// ログ設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ultraviolet-proxy' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Express アプリケーション初期化
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy 設定（レート制限の前に設定）
app.set('trust proxy', 1);

// Bare サーバー作成
const bareServer = createBareServer('/bare/');

// セキュリティミドルウェア
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS設定
app.use(cors({
  origin: true,
  credentials: true
}));

// 圧縮
app.use(compression());

// レート制限
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 1000, // 最大1000リクエスト
  message: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // ローカルホストはスキップ
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});
app.use(limiter);

// JSON パース
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Ultraviolet 静的ファイル（node_modulesが存在しない場合のフォールバック）
const uvPath = path.join(__dirname, 'node_modules/@titaniumnetwork-dev/ultraviolet/dist/');
const fs = require('fs');

if (fs.existsSync(uvPath)) {
  app.use('/uv/', express.static(uvPath));
} else {
  // フォールバック: Ultravioletファイルが見つからない場合
  app.get('/uv/*', (req, res) => {
    res.status(404).json({
      error: 'Ultravioletファイルが見つかりません',
      message: 'npm installを実行してください',
      missing: req.path
    });
  });
}

// カスタムミドルウェアを条件付きで読み込み
let adblockMiddleware, securityMiddleware, useragentMiddleware;

try {
  adblockMiddleware = require('./src/middleware/adblock');
  securityMiddleware = require('./src/middleware/security');
  useragentMiddleware = require('./src/middleware/useragent');
  
  // ミドルウェア適用
  app.use('/service/', adblockMiddleware);
  app.use('/service/', securityMiddleware);
  app.use('/service/', useragentMiddleware);
  
  logger.info('カスタムミドルウェアを読み込みました');
} catch (error) {
  logger.warn('カスタムミドルウェアの読み込みに失敗しました:', error.message);
}

// API ルートを条件付きで読み込み
try {
  app.use('/api/', require('./src/routes/api'));
  logger.info('APIルートを読み込みました');
} catch (error) {
  logger.warn('APIルートの読み込みに失敗しました:', error.message);
  
  // フォールバックAPI
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/api/config', (req, res) => {
    res.json({
      features: {
        adblock: false,
        security: false,
        userAgent: false,
        javascript: true
      },
      version: '1.0.0',
      build: 'fallback'
    });
  });
}

// メインページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Ultraviolet サービスワーカー
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/sw.js'));
});

// プロキシリクエストの基本処理
app.use('/service/', (req, res, next) => {
  // 基本的なプロキシ処理
  const encodedUrl = req.url.substring(1); // /service/ を除去
  
  if (!encodedUrl) {
    return res.status(400).json({
      error: 'URLが指定されていません',
      usage: '/service/[encoded-url]'
    });
  }
  
  try {
    // 簡易的なBase64デコード
    const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    
    // 基本的なURL検証
    new URL(targetUrl);
    
    // プロキシ処理をBareサーバーに委譲
    if (bareServer.shouldRoute(req)) {
      bareServer.routeRequest(req, res);
    } else {
      res.status(500).json({
        error: 'プロキシ処理に失敗しました',
        url: targetUrl
      });
    }
  } catch (error) {
    res.status(400).json({
      error: 'URLのデコードに失敗しました',
      details: error.message
    });
  }
});

// 404 ハンドラー
app.use((req, res) => {
  res.status(404).json({
    error: 'ページが見つかりません',
    message: '要求されたリソースは存在しません',
    path: req.path
  });
});

// エラーハンドラー
app.use((error, req, res, next) => {
  logger.error('サーバーエラー:', error);
  res.status(500).json({
    error: 'サーバー内部エラー',
    message: process.env.NODE_ENV === 'production' ? 
      'サーバーで問題が発生しました' : 
      error.message
  });
});

// サーバー起動
const server = app.listen(PORT, () => {
  logger.info('🚀 Ultraviolet Proxy サーバーが起動しました');
  logger.info(`📡 ポート: ${PORT}`);
  logger.info(`🌐 URL: http://localhost:${PORT}`);
  logger.info(`🔧 モード: ${process.env.NODE_ENV || 'development'}`);
});

// Bare サーバーのHTTPアップグレード処理
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// Bare サーバーのHTTPリクエスト処理
app.use((req, res, next) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    next();
  }
});

// 優雅なシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERMを受信しました。サーバーを優雅にシャットダウンします...');
  server.close(() => {
    logger.info('サーバーが正常に終了しました');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINTを受信しました。サーバーを優雅にシャットダウンします...');
  server.close(() => {
    logger.info('サーバーが正常に終了しました');
    process.exit(0);
  });
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  logger.error('未処理の例外:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未処理のPromise拒否:', reason);
  process.exit(1);
});

module.exports = app;