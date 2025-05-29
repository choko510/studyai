// 広告ブロック機能
const winston = require('winston');

// ログ設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

// 広告ブロックルール
const adblockRules = {
  // ドメインベースのブロック
  domains: [
    // Google Ads
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'googletagservices.com',
    
    // Facebook/Meta
    'facebook.com/tr',
    'connect.facebook.net',
    'facebook.net',
    
    // Amazon
    'amazon-adsystem.com',
    'amazonaax.com',
    'assoc-amazon.com',
    
    // その他の広告ネットワーク
    'adsystem.com',
    'advertising.com',
    'adsense.com',
    'adnxs.com',
    'adsystem.windows.com',
    'ads.yahoo.com',
    'media.net',
    'outbrain.com',
    'taboola.com',
    'criteo.com',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.com',
    'rlcdn.com',
    'smartadserver.com',
    'yieldmo.com',
    'contextweb.com',
    'turn.com',
    'adform.net',
    'adsystem.windows.com',
    'scorecardresearch.com',
    'quantserve.com',
    'chartbeat.com',
    'newrelic.com',
    
    // 日本の広告ネットワーク
    'i-mobile.co.jp',
    'microad.jp',
    'genieesspv.jp',
    'logly.co.jp',
    'impact-ad.jp',
    'fluct.jp'
  ],
  
  // URLパターンベースのブロック
  patterns: [
    // 広告関連パス
    /\/ads?\/|\/ad\/|\/advertisement\/|\/adv\/|\/banner\//i,
    /\/popup\/|\/popunder\/|\/interstitial\//i,
    /\/sponsor\/|\/promoted\/|\/affiliate\//i,
    
    // トラッキング
    /analytics|tracking|metrics|telemetry|beacon/i,
    /pixel|collector|logger|monitor/i,
    /impression|click|conversion/i,
    
    // ソーシャル系トラッキング
    /facebook\.com\/tr|\/fbevents\.js/i,
    /twitter\.com\/i\/adsct|\/analytics\.twitter\.com/i,
    /linkedin\.com\/analytics|\/snap\.licdn\.com/i,
    
    // 特定のファイル名
    /adsense|adwords|admeld|adsystem/i,
    /ga\.js|gtag\.js|gtm\.js|analytics\.js/i,
    /fbevents\.js|fbpixel\.js/i,
    /outbrain|taboola|criteo/i
  ],
  
  // ファイル拡張子ベースのブロック
  fileExtensions: [
    // 一般的でない実行ファイル
    '.exe',
    '.msi',
    '.dmg',
    '.pkg',
    '.deb',
    '.rpm'
  ],
  
  // クエリパラメータベースのブロック
  queryParams: [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'fbclid',
    'msclkid',
    '_ga',
    '_gac',
    '_gat'
  ]
};

// ブロック理由の定義
const BLOCK_REASONS = {
  DOMAIN: 'ドメインが広告ブロックリストに含まれています',
  PATTERN: 'URLパターンが広告として検出されました',
  FILE_EXT: '危険なファイル拡張子が検出されました',
  CONTENT_TYPE: 'コンテンツタイプが広告として識別されました',
  SIZE: 'ファイルサイズが異常に大きいです'
};

/**
 * URLがブロック対象かチェック
 * @param {string} url - チェックするURL
 * @returns {Object} ブロック情報
 */
function isBlocked(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    const search = urlObj.search.toLowerCase();
    
    // ドメインチェック
    for (const domain of adblockRules.domains) {
      if (hostname.includes(domain.toLowerCase())) {
        return {
          blocked: true,
          reason: BLOCK_REASONS.DOMAIN,
          rule: domain
        };
      }
    }
    
    // パターンチェック
    const fullUrl = url.toLowerCase();
    for (const pattern of adblockRules.patterns) {
      if (pattern.test(fullUrl)) {
        return {
          blocked: true,
          reason: BLOCK_REASONS.PATTERN,
          rule: pattern.toString()
        };
      }
    }
    
    // ファイル拡張子チェック
    for (const ext of adblockRules.fileExtensions) {
      if (pathname.endsWith(ext.toLowerCase())) {
        return {
          blocked: true,
          reason: BLOCK_REASONS.FILE_EXT,
          rule: ext
        };
      }
    }
    
    // クエリパラメータチェック（削除のみ、ブロックはしない）
    const cleanParams = new URLSearchParams(urlObj.search);
    let hasTrackingParams = false;
    
    for (const param of adblockRules.queryParams) {
      if (cleanParams.has(param)) {
        cleanParams.delete(param);
        hasTrackingParams = true;
      }
    }
    
    return {
      blocked: false,
      cleanUrl: hasTrackingParams ? 
        `${urlObj.origin}${urlObj.pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}${urlObj.hash}` : 
        url,
      trackingRemoved: hasTrackingParams
    };
    
  } catch (error) {
    logger.error('URL解析エラー:', error.message);
    return {
      blocked: false,
      error: error.message
    };
  }
}

/**
 * レスポンスヘッダーベースのブロック
 * @param {Object} headers - レスポンスヘッダー
 * @returns {Object} ブロック情報
 */
function checkResponseHeaders(headers) {
  const contentType = headers['content-type'] || '';
  const contentLength = parseInt(headers['content-length'] || '0');
  
  // 異常に大きなファイル（50MB以上）をブロック
  if (contentLength > 50 * 1024 * 1024) {
    return {
      blocked: true,
      reason: BLOCK_REASONS.SIZE,
      size: contentLength
    };
  }
  
  // 特定のコンテンツタイプをブロック
  const blockedContentTypes = [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-winexe'
  ];
  
  for (const blockedType of blockedContentTypes) {
    if (contentType.includes(blockedType)) {
      return {
        blocked: true,
        reason: BLOCK_REASONS.CONTENT_TYPE,
        contentType: contentType
      };
    }
  }
  
  return { blocked: false };
}

/**
 * 広告ブロックミドルウェア
 */
const adblockMiddleware = (req, res, next) => {
  // 設定確認
  const adblockEnabled = req.query.adblock !== 'false';
  
  if (!adblockEnabled) {
    return next();
  }
  
  // リクエストURLをデコード
  let targetUrl;
  try {
    // Ultraviolet のURL デコード
    const encodedUrl = req.url.replace('/service/', '');
    targetUrl = decodeURIComponent(encodedUrl);
  } catch (error) {
    logger.error('URL デコードエラー:', error.message);
    return next();
  }
  
  // URLブロックチェック
  const blockResult = isBlocked(targetUrl);
  
  if (blockResult.blocked) {
    logger.info(`広告ブロック: ${targetUrl} - ${blockResult.reason}`);
    
    // ブロック応答
    return res.status(204).json({
      blocked: true,
      reason: blockResult.reason,
      rule: blockResult.rule,
      timestamp: new Date().toISOString()
    });
  }
  
  // トラッキングパラメータの除去
  if (blockResult.cleanUrl && blockResult.cleanUrl !== targetUrl) {
    logger.info(`トラッキングパラメータを除去: ${targetUrl} -> ${blockResult.cleanUrl}`);
    // リダイレクトではなく、内部的にクリーンURLを使用
    req.cleanUrl = blockResult.cleanUrl;
  }
  
  // レスポンス傍受
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    // レスポンスヘッダーチェック
    const headerCheck = checkResponseHeaders(res.getHeaders());
    
    if (headerCheck.blocked) {
      logger.info(`レスポンスブロック: ${targetUrl} - ${headerCheck.reason}`);
      return res.status(204).json({
        blocked: true,
        reason: headerCheck.reason,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    // レスポンスヘッダーチェック
    const headerCheck = checkResponseHeaders(res.getHeaders());
    
    if (headerCheck.blocked) {
      logger.info(`レスポンスブロック: ${targetUrl} - ${headerCheck.reason}`);
      return res.status(204).json({
        blocked: true,
        reason: headerCheck.reason,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// カスタムルール追加機能
adblockMiddleware.addDomain = (domain) => {
  if (!adblockRules.domains.includes(domain)) {
    adblockRules.domains.push(domain);
    logger.info(`広告ブロックドメインを追加: ${domain}`);
  }
};

adblockMiddleware.addPattern = (pattern) => {
  if (!adblockRules.patterns.includes(pattern)) {
    adblockRules.patterns.push(pattern);
    logger.info(`広告ブロックパターンを追加: ${pattern}`);
  }
};

// 統計情報
adblockMiddleware.getStats = () => {
  return {
    domains: adblockRules.domains.length,
    patterns: adblockRules.patterns.length,
    fileExtensions: adblockRules.fileExtensions.length,
    queryParams: adblockRules.queryParams.length
  };
};

module.exports = adblockMiddleware;