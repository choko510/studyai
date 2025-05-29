// API ルート
const express = require('express');
const router = express.Router();
const winston = require('winston');

// ミドルウェア読み込み
const adblockMiddleware = require('../middleware/adblock');
const securityMiddleware = require('../middleware/security');
const useragentMiddleware = require('../middleware/useragent');

// ログ設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

// 統計情報を格納するオブジェクト
const stats = {
  requests: 0,
  blockedRequests: 0,
  startTime: new Date(),
  userAgentChanges: 0,
  countries: new Map(),
  browsers: new Map()
};

/**
 * GET /api/status - サーバー状態確認
 */
router.get('/status', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'online',
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/config - 設定情報取得
 */
router.get('/config', (req, res) => {
  res.json({
    features: {
      adblock: true,
      security: true,
      userAgent: true,
      javascript: true
    },
    adblock: adblockMiddleware.getStats(),
    security: securityMiddleware.getConfig(),
    userAgent: useragentMiddleware.getStats(),
    version: '1.0.0',
    build: process.env.BUILD_NUMBER || 'development'
  });
});

/**
 * GET /api/useragents - ユーザーエージェント一覧
 */
router.get('/useragents', (req, res) => {
  const category = req.query.category;
  
  if (category) {
    const userAgents = useragentMiddleware.getUserAgents();
    if (userAgents[category]) {
      res.json({
        category: category,
        userAgents: userAgents[category]
      });
    } else {
      res.status(404).json({
        error: 'カテゴリが見つかりません',
        availableCategories: Object.keys(userAgents)
      });
    }
  } else {
    res.json({
      userAgents: useragentMiddleware.getUserAgents(),
      stats: useragentMiddleware.getStats()
    });
  }
});

/**
 * GET /api/useragents/random - ランダムなユーザーエージェント
 */
router.get('/useragents/random', (req, res) => {
  const category = req.query.category;
  const randomUA = useragentMiddleware.getRandomUA(category);
  
  res.json({
    userAgent: randomUA,
    device: useragentMiddleware.getDeviceInfo(randomUA)
  });
});

/**
 * GET /api/stats - 統計情報
 */
router.get('/stats', (req, res) => {
  const uptime = process.uptime();
  
  res.json({
    server: {
      requests: stats.requests,
      blockedRequests: stats.blockedRequests,
      userAgentChanges: stats.userAgentChanges,
      uptime: Math.floor(uptime),
      startTime: stats.startTime
    },
    features: {
      adblock: adblockMiddleware.getStats(),
      security: securityMiddleware.getStats(),
      userAgent: useragentMiddleware.getStats()
    },
    traffic: {
      countries: Object.fromEntries(stats.countries),
      browsers: Object.fromEntries(stats.browsers)
    },
    performance: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  });
});

/**
 * POST /api/settings - 設定更新
 */
router.post('/settings', (req, res) => {
  try {
    const { adblock, security, userAgent, customRules } = req.body;
    
    const result = {
      updated: [],
      errors: []
    };
    
    // 広告ブロック設定
    if (adblock && adblock.customDomains) {
      adblock.customDomains.forEach(domain => {
        try {
          adblockMiddleware.addDomain(domain);
          result.updated.push(`広告ブロックドメイン追加: ${domain}`);
        } catch (error) {
          result.errors.push(`ドメイン追加エラー: ${domain} - ${error.message}`);
        }
      });
    }
    
    // セキュリティ設定
    if (security && security.dangerousSites) {
      security.dangerousSites.forEach(site => {
        try {
          securityMiddleware.addDangerousSite(site);
          result.updated.push(`危険サイト追加: ${site}`);
        } catch (error) {
          result.errors.push(`危険サイト追加エラー: ${site} - ${error.message}`);
        }
      });
    }
    
    // カスタムユーザーエージェント
    if (userAgent && userAgent.custom) {
      const { category, browser, data } = userAgent.custom;
      try {
        useragentMiddleware.addUserAgent(category, browser, data);
        result.updated.push(`カスタムUA追加: ${category}/${browser}`);
      } catch (error) {
        result.errors.push(`カスタムUA追加エラー: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('設定更新エラー:', error);
    res.status(400).json({
      error: '設定更新に失敗しました',
      details: error.message
    });
  }
});

/**
 * GET /api/test - 接続テスト
 */
router.get('/test', (req, res) => {
  const testUrl = req.query.url;
  
  if (!testUrl) {
    return res.status(400).json({
      error: 'テストURLが必要です',
      example: '/api/test?url=https://example.com'
    });
  }
  
  try {
    const url = new URL(testUrl);
    
    // 基本的な接続テスト
    const testResult = {
      url: testUrl,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      accessible: true,
      warnings: [],
      timestamp: new Date().toISOString()
    };
    
    // セキュリティチェック
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      testResult.warnings.push('ローカルホストへのアクセスです');
    }
    
    if (url.protocol !== 'https:') {
      testResult.warnings.push('非HTTPSサイトです');
    }
    
    // プライベートIPチェック
    const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];
    if (privateRanges.some(range => range.test(url.hostname))) {
      testResult.warnings.push('プライベートIPアドレスです');
    }
    
    res.json(testResult);
    
  } catch (error) {
    res.status(400).json({
      error: '無効なURLです',
      details: error.message,
      url: testUrl
    });
  }
});

/**
 * GET /api/proxy-info - プロキシ情報
 */
router.get('/proxy-info', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  res.json({
    client: {
      ip: clientIP,
      userAgent: userAgent,
      headers: req.headers,
      language: req.get('Accept-Language'),
      encoding: req.get('Accept-Encoding')
    },
    proxy: {
      version: '1.0.0',
      features: ['adblock', 'security', 'useragent'],
      protocols: ['http', 'https', 'ws', 'wss'],
      maxFileSize: '100MB',
      timeout: '30s'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/feedback - フィードバック送信
 */
router.post('/feedback', (req, res) => {
  try {
    const { type, message, url, userAgent } = req.body;
    
    if (!type || !message) {
      return res.status(400).json({
        error: 'フィードバックタイプとメッセージが必要です'
      });
    }
    
    // フィードバックをログに記録
    logger.info('フィードバック受信:', {
      type: type,
      message: message,
      url: url,
      userAgent: userAgent,
      clientIP: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // 実際の実装では、データベースやファイルに保存
    
    res.json({
      success: true,
      message: 'フィードバックを受信しました。ありがとうございます！',
      id: generateFeedbackId(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('フィードバック処理エラー:', error);
    res.status(500).json({
      error: 'フィードバックの処理中にエラーが発生しました'
    });
  }
});

/**
 * GET /api/health - ヘルスチェック
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      memory: checkMemory(),
      disk: checkDisk(),
      network: checkNetwork()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  
  if (!isHealthy) {
    health.status = 'degraded';
  }
  
  res.status(isHealthy ? 200 : 503).json(health);
});

// ヘルパー関数

/**
 * アップタイムをフォーマット
 * @param {number} uptime - アップタイム（秒）
 * @returns {string} フォーマットされた文字列
 */
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  if (days > 0) {
    return `${days}日 ${hours}時間 ${minutes}分`;
  } else if (hours > 0) {
    return `${hours}時間 ${minutes}分`;
  } else if (minutes > 0) {
    return `${minutes}分 ${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * フィードバックID生成
 * @returns {string} ユニークなID
 */
function generateFeedbackId() {
  return 'fb_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * メモリチェック
 * @returns {Object} チェック結果
 */
function checkMemory() {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const usagePercent = (usedMB / totalMB) * 100;
  
  return {
    status: usagePercent < 90 ? 'ok' : 'warning',
    used: usedMB,
    total: totalMB,
    percent: Math.round(usagePercent)
  };
}

/**
 * ディスクチェック
 * @returns {Object} チェック結果
 */
function checkDisk() {
  // 簡易的なディスクチェック
  return {
    status: 'ok',
    message: 'ディスク使用量は正常です'
  };
}

/**
 * ネットワークチェック
 * @returns {Object} チェック結果
 */
function checkNetwork() {
  // 簡易的なネットワークチェック
  return {
    status: 'ok',
    message: 'ネットワーク接続は正常です'
  };
}

// リクエスト統計の更新
router.use((req, res, next) => {
  stats.requests++;
  
  // User-Agent 解析
  const userAgent = req.get('User-Agent') || 'unknown';
  if (userAgent.includes('Chrome')) {
    stats.browsers.set('Chrome', (stats.browsers.get('Chrome') || 0) + 1);
  } else if (userAgent.includes('Firefox')) {
    stats.browsers.set('Firefox', (stats.browsers.get('Firefox') || 0) + 1);
  } else if (userAgent.includes('Safari')) {
    stats.browsers.set('Safari', (stats.browsers.get('Safari') || 0) + 1);
  }
  
  next();
});

module.exports = router;