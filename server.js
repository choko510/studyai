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
  legacyHeaders: false
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

// Ultraviolet 静的ファイル
app.use('/uv/', express.static(path.join(__dirname, 'node_modules/@titaniumnetwork-dev/ultraviolet/dist/')));

// ミドルウェア読み込み
const adblockMiddleware = require('./src/middleware/adblock');
const securityMiddleware = require('./src/middleware/security');
const useragentMiddleware = require('./src/middleware/useragent');

// カスタムミドルウェア適用
app.use('/service/', adblockMiddleware);
app.use('/service/', securityMiddleware);
app.use('/service/', useragentMiddleware);

// ルート設定
app.use('/api/', require('./src/routes/api'));

// メインページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Ultraviolet サービスワーカー
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/sw.js'));
});

// 404 ハンドラー
app.use((req, res) => {
  res.status(404).json({
    error: 'ページが見つかりません',
    message: '要求されたリソースは存在しません'
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
  logger.info(`🚀 Ultraviolet Proxy サーバーが起動しました`);
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

module.exports = app;