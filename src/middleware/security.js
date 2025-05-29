// セキュリティ機能ミドルウェア
const winston = require('winston');
const crypto = require('crypto');

// ログ設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

// セキュリティ設定
const securityConfig = {
  // 危険なサイトのリスト
  dangerousSites: [
    // マルウェア配布サイト
    'malware-distribution.com',
    'virus-download.net',
    
    // フィッシングサイトのパターン
    /.*-phishing\..*/,
    /.*\.tk$/,
    /.*\.ml$/,
    /.*\.ga$/,
    /.*\.cf$/,
    
    // 一般的に危険とされるTLD
    /.*\.xxx$/,
    /.*\.adult$/
  ],
  
  // 禁止されたコンテンツタイプ
  blockedContentTypes: [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-winexe',
    'application/x-dosexec',
    'application/octet-stream' // 実行ファイルの可能性
  ],
  
  // 危険なファイル拡張子
  dangerousExtensions: [
    '.exe', '.msi', '.scr', '.bat', '.cmd', '.com', '.pif',
    '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1',
    '.jar', '.app', '.deb', '.rpm', '.dmg', '.pkg'
  ],
  
  // 許可されたスキーム
  allowedSchemes: ['http:', 'https:', 'ftp:', 'ftps:'],
  
  // CSP設定
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:', 'http:'],
    'connect-src': ["'self'", 'ws:', 'wss:', 'https:', 'http:'],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'frame-src': ["'self'"]
  }
};

// セキュリティチェック関数
const securityChecks = {
  
  /**
   * URL の安全性をチェック
   * @param {string} url - チェックするURL
   * @returns {Object} チェック結果
   */
  checkUrlSafety(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();
      
      // スキームチェック
      if (!securityConfig.allowedSchemes.includes(urlObj.protocol)) {
        return {
          safe: false,
          reason: '許可されていないプロトコルです',
          protocol: urlObj.protocol
        };
      }
      
      // 危険なサイトチェック
      for (const site of securityConfig.dangerousSites) {
        if (typeof site === 'string') {
          if (hostname.includes(site.toLowerCase())) {
            return {
              safe: false,
              reason: '危険なサイトとして識別されました',
              site: site
            };
          }
        } else if (site instanceof RegExp) {
          if (site.test(hostname)) {
            return {
              safe: false,
              reason: '危険なドメインパターンです',
              pattern: site.toString()
            };
          }
        }
      }
      
      // ファイル拡張子チェック
      for (const ext of securityConfig.dangerousExtensions) {
        if (pathname.endsWith(ext.toLowerCase())) {
          return {
            safe: false,
            reason: '危険なファイル拡張子です',
            extension: ext
          };
        }
      }
      
      // ローカルネットワークアクセスチェック
      if (this.isLocalNetwork(hostname)) {
        return {
          safe: false,
          reason: 'ローカルネットワークへのアクセスは禁止されています',
          hostname: hostname
        };
      }
      
      return { safe: true };
      
    } catch (error) {
      return {
        safe: false,
        reason: '無効なURLです',
        error: error.message
      };
    }
  },
  
  /**
   * ローカルネットワークかチェック
   * @param {string} hostname - ホスト名またはIP
   * @returns {boolean} ローカルネットワークかどうか
   */
  isLocalNetwork(hostname) {
    // localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    
    // プライベートIPレンジ
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // リンクローカル
      /^fe80:/ // IPv6 リンクローカル
    ];
    
    return privateRanges.some(range => range.test(hostname));
  },
  
  /**
   * コンテンツタイプの安全性をチェック
   * @param {string} contentType - コンテンツタイプ
   * @returns {Object} チェック結果
   */
  checkContentType(contentType) {
    if (!contentType) {
      return { safe: true };
    }
    
    const lowerContentType = contentType.toLowerCase();
    
    for (const blockedType of securityConfig.blockedContentTypes) {
      if (lowerContentType.includes(blockedType)) {
        return {
          safe: false,
          reason: '危険なコンテンツタイプです',
          contentType: contentType
        };
      }
    }
    
    return { safe: true };
  },
  
  /**
   * HTTPヘッダーの検証
   * @param {Object} headers - HTTPヘッダー
   * @returns {Object} 検証結果
   */
  validateHeaders(headers) {
    const issues = [];
    
    // Content-Length チェック（異常に大きなファイル）
    const contentLength = parseInt(headers['content-length'] || '0');
    if (contentLength > 100 * 1024 * 1024) { // 100MB
      issues.push({
        type: 'large_file',
        message: 'ファイルサイズが大きすぎます',
        size: contentLength
      });
    }
    
    // 危険なContent-Disposition
    const contentDisposition = headers['content-disposition'];
    if (contentDisposition) {
      for (const ext of securityConfig.dangerousExtensions) {
        if (contentDisposition.toLowerCase().includes(ext)) {
          issues.push({
            type: 'dangerous_download',
            message: '危険なファイルダウンロードの可能性があります',
            disposition: contentDisposition
          });
        }
      }
    }
    
    return {
      safe: issues.length === 0,
      issues: issues
    };
  },
  
  /**
   * リクエストレート制限チェック
   * @param {string} clientIp - クライアントIP
   * @returns {Object} チェック結果
   */
  checkRateLimit(clientIp) {
    // シンプルなメモリベースのレート制限
    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }
    
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15分
    const maxRequests = 1000;
    
    const clientData = this.rateLimitStore.get(clientIp) || { count: 0, resetTime: now + windowMs };
    
    // ウィンドウリセット
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }
    
    clientData.count++;
    this.rateLimitStore.set(clientIp, clientData);
    
    return {
      allowed: clientData.count <= maxRequests,
      count: clientData.count,
      limit: maxRequests,
      resetTime: clientData.resetTime
    };
  }
};

/**
 * セキュリティヘッダーを追加
 * @param {Object} res - レスポンスオブジェクト
 */
function addSecurityHeaders(res) {
  // CSP ヘッダー
  const cspDirectives = Object.entries(securityConfig.contentSecurityPolicy)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
  
  res.setHeader('Content-Security-Policy', cspDirectives);
  
  // その他のセキュリティヘッダー
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

/**
 * セキュリティミドルウェア
 */
const securityMiddleware = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  
  // レート制限チェック
  const rateLimitResult = securityChecks.checkRateLimit(clientIp);
  if (!rateLimitResult.allowed) {
    logger.warn(`レート制限超過: ${clientIp} - ${rateLimitResult.count}/${rateLimitResult.limit}`);
    return res.status(429).json({
      error: 'レート制限超過',
      message: 'リクエスト頻度が高すぎます。しばらく待ってから再試行してください。',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    });
  }
  
  // セキュリティ設定確認
  const securityEnabled = req.query.security !== 'false';
  
  if (!securityEnabled) {
    addSecurityHeaders(res);
    return next();
  }
  
  // リクエストURLをデコード
  let targetUrl;
  try {
    const encodedUrl = req.url.replace('/service/', '');
    targetUrl = decodeURIComponent(encodedUrl);
  } catch (error) {
    logger.error('URL デコードエラー:', error.message);
    addSecurityHeaders(res);
    return next();
  }
  
  // URL安全性チェック
  const safetyResult = securityChecks.checkUrlSafety(targetUrl);
  
  if (!safetyResult.safe) {
    logger.warn(`危険なURL検出: ${targetUrl} - ${safetyResult.reason}`);
    
    // 警告ページを表示（本来は専用の警告ページを作成）
    return res.status(403).json({
      blocked: true,
      reason: safetyResult.reason,
      url: targetUrl,
      suggestion: 'このサイトは安全でない可能性があります。アクセスを続行する場合は十分注意してください。',
      timestamp: new Date().toISOString()
    });
  }
  
  // レスポンス検証のための傍受
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    // レスポンスヘッダー検証
    const headerValidation = securityChecks.validateHeaders(res.getHeaders());
    
    if (!headerValidation.safe) {
      logger.warn(`危険なレスポンス検出: ${targetUrl}`, headerValidation.issues);
      
      // 重大な問題がある場合はブロック
      const criticalIssues = headerValidation.issues.filter(issue => 
        issue.type === 'dangerous_download'
      );
      
      if (criticalIssues.length > 0) {
        return res.status(403).json({
          blocked: true,
          reason: '危険なファイルダウンロードがブロックされました',
          issues: criticalIssues,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // コンテンツタイプチェック
    const contentType = res.getHeader('content-type');
    const contentSafety = securityChecks.checkContentType(contentType);
    
    if (!contentSafety.safe) {
      logger.warn(`危険なコンテンツタイプ: ${targetUrl} - ${contentSafety.reason}`);
      return res.status(403).json({
        blocked: true,
        reason: contentSafety.reason,
        contentType: contentType,
        timestamp: new Date().toISOString()
      });
    }
    
    addSecurityHeaders(res);
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    addSecurityHeaders(res);
    return originalJson.call(this, data);
  };
  
  // セキュリティヘッダーを追加
  addSecurityHeaders(res);
  
  next();
};

// 設定管理機能
securityMiddleware.addDangerousSite = (site) => {
  if (!securityConfig.dangerousSites.includes(site)) {
    securityConfig.dangerousSites.push(site);
    logger.info(`危険サイトを追加: ${site}`);
  }
};

securityMiddleware.removeDangerousSite = (site) => {
  const index = securityConfig.dangerousSites.indexOf(site);
  if (index > -1) {
    securityConfig.dangerousSites.splice(index, 1);
    logger.info(`危険サイトを削除: ${site}`);
  }
};

// 統計情報
securityMiddleware.getStats = () => {
  const rateLimitStore = securityChecks.rateLimitStore || new Map();
  return {
    dangerousSites: securityConfig.dangerousSites.length,
    blockedContentTypes: securityConfig.blockedContentTypes.length,
    dangerousExtensions: securityConfig.dangerousExtensions.length,
    activeRateLimits: rateLimitStore.size
  };
};

// 設定取得
securityMiddleware.getConfig = () => {
  return {
    dangerousSites: securityConfig.dangerousSites.length,
    blockedContentTypes: securityConfig.blockedContentTypes,
    dangerousExtensions: securityConfig.dangerousExtensions,
    allowedSchemes: securityConfig.allowedSchemes
  };
};

module.exports = securityMiddleware;