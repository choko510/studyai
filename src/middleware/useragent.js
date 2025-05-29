// ユーザーエージェント変更機能
const winston = require('winston');

// ログ設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

// ユーザーエージェント定義
const userAgents = {
  // デスクトップブラウザ
  desktop: {
    chrome: {
      name: 'Google Chrome (Windows)',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      features: ['webgl', 'webrtc', 'geolocation']
    },
    firefox: {
      name: 'Mozilla Firefox (Windows)',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      platform: 'Win32',
      vendor: '',
      features: ['webgl', 'webrtc', 'geolocation']
    },
    safari: {
      name: 'Safari (macOS)',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.1 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
      features: ['webgl', 'geolocation']
    },
    edge: {
      name: 'Microsoft Edge (Windows)',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      platform: 'Win32',
      vendor: 'Google Inc.',
      features: ['webgl', 'webrtc', 'geolocation']
    },
    opera: {
      name: 'Opera (Windows)',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
      platform: 'Win32',
      vendor: 'Google Inc.',
      features: ['webgl', 'webrtc', 'geolocation']
    }
  },
  
  // モバイルブラウザ
  mobile: {
    ios_safari: {
      name: 'Safari (iPhone)',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.',
      features: ['geolocation', 'touch']
    },
    ios_chrome: {
      name: 'Chrome (iPhone)',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Google Inc.',
      features: ['geolocation', 'touch']
    },
    android_chrome: {
      name: 'Chrome (Android)',
      ua: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36',
      platform: 'Linux armv7l',
      vendor: 'Google Inc.',
      features: ['webgl', 'webrtc', 'geolocation', 'touch']
    },
    android_firefox: {
      name: 'Firefox (Android)',
      ua: 'Mozilla/5.0 (Mobile; rv:109.0) Gecko/121.0 Firefox/121.0',
      platform: 'Linux armv7l',
      vendor: '',
      features: ['webgl', 'webrtc', 'geolocation', 'touch']
    },
    samsung: {
      name: 'Samsung Internet (Android)',
      ua: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv7l',
      vendor: 'Google Inc.',
      features: ['webgl', 'webrtc', 'geolocation', 'touch']
    }
  },
  
  // タブレット
  tablet: {
    ipad_safari: {
      name: 'Safari (iPad)',
      ua: 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
      features: ['geolocation', 'touch']
    },
    android_tablet: {
      name: 'Chrome (Android Tablet)',
      ua: 'Mozilla/5.0 (Linux; Android 10; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Safari/537.36',
      platform: 'Linux armv7l',
      vendor: 'Google Inc.',
      features: ['webgl', 'webrtc', 'geolocation', 'touch']
    }
  },
  
  // ボット/クローラー
  bots: {
    googlebot: {
      name: 'Googlebot',
      ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      platform: 'unknown',
      vendor: '',
      features: []
    },
    bingbot: {
      name: 'Bingbot',
      ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      platform: 'unknown',
      vendor: '',
      features: []
    }
  },
  
  // 古いブラウザ
  legacy: {
    ie11: {
      name: 'Internet Explorer 11',
      ua: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
      platform: 'Win32',
      vendor: '',
      features: []
    },
    old_chrome: {
      name: 'Chrome 70 (Legacy)',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      features: ['webgl']
    }
  }
};

// 地域別のAccept-Language設定
const acceptLanguages = {
  ja: 'ja-JP,ja;q=0.9,en;q=0.8',
  en: 'en-US,en;q=0.9',
  zh: 'zh-CN,zh;q=0.9,en;q=0.8',
  ko: 'ko-KR,ko;q=0.9,en;q=0.8',
  de: 'de-DE,de;q=0.9,en;q=0.8',
  fr: 'fr-FR,fr;q=0.9,en;q=0.8',
  es: 'es-ES,es;q=0.9,en;q=0.8',
  pt: 'pt-BR,pt;q=0.9,en;q=0.8',
  ru: 'ru-RU,ru;q=0.9,en;q=0.8',
  ar: 'ar-SA,ar;q=0.9,en;q=0.8'
};

/**
 * ユーザーエージェントを取得
 * @param {string} category - カテゴリ (desktop, mobile, tablet, bots, legacy)
 * @param {string} browser - ブラウザ名
 * @returns {Object|null} ユーザーエージェント情報
 */
function getUserAgent(category, browser) {
  if (!userAgents[category] || !userAgents[category][browser]) {
    return null;
  }
  
  return userAgents[category][browser];
}

/**
 * ランダムなユーザーエージェントを取得
 * @param {string} category - カテゴリ (オプション)
 * @returns {Object} ユーザーエージェント情報
 */
function getRandomUserAgent(category = null) {
  const categories = category ? [category] : Object.keys(userAgents);
  const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
  
  const browsers = Object.keys(userAgents[selectedCategory]);
  const selectedBrowser = browsers[Math.floor(Math.random() * browsers.length)];
  
  return {
    category: selectedCategory,
    browser: selectedBrowser,
    ...userAgents[selectedCategory][selectedBrowser]
  };
}

/**
 * ユーザーエージェントのリストを取得
 * @returns {Object} 全てのユーザーエージェント
 */
function getAllUserAgents() {
  const result = {};
  
  for (const [category, browsers] of Object.entries(userAgents)) {
    result[category] = {};
    for (const [browser, data] of Object.entries(browsers)) {
      result[category][browser] = {
        name: data.name,
        ua: data.ua
      };
    }
  }
  
  return result;
}

/**
 * プラットフォーム固有のヘッダーを生成
 * @param {Object} userAgent - ユーザーエージェント情報
 * @param {string} language - 言語設定
 * @returns {Object} HTTP ヘッダー
 */
function generateHeaders(userAgent, language = 'ja') {
  const headers = {
    'User-Agent': userAgent.ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': acceptLanguages[language] || acceptLanguages.en,
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
  
  // ブラウザ固有のヘッダー
  if (userAgent.ua.includes('Chrome') && !userAgent.ua.includes('Edge')) {
    headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    headers['sec-ch-ua-mobile'] = userAgent.platform.includes('iPhone') || userAgent.platform.includes('Android') ? '?1' : '?0';
    headers['sec-ch-ua-platform'] = `"${userAgent.platform.includes('Win') ? 'Windows' : userAgent.platform.includes('Mac') ? 'macOS' : 'Linux'}"`;
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
  }
  
  if (userAgent.ua.includes('Firefox')) {
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
  }
  
  if (userAgent.ua.includes('Safari') && !userAgent.ua.includes('Chrome')) {
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
  }
  
  return headers;
}

/**
 * デバイス情報を取得
 * @param {Object} userAgent - ユーザーエージェント情報
 * @returns {Object} デバイス情報
 */
function getDeviceInfo(userAgent) {
  const deviceInfo = {
    type: 'desktop',
    os: 'unknown',
    browser: 'unknown',
    mobile: false,
    tablet: false
  };
  
  const ua = userAgent.ua.toLowerCase();
  
  // デバイスタイプ判定
  if (ua.includes('mobile') || ua.includes('iphone')) {
    deviceInfo.type = 'mobile';
    deviceInfo.mobile = true;
  } else if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    deviceInfo.type = 'tablet';
    deviceInfo.tablet = true;
  }
  
  // OS判定
  if (ua.includes('windows')) {
    deviceInfo.os = 'windows';
  } else if (ua.includes('mac os') || ua.includes('macos')) {
    deviceInfo.os = 'macos';
  } else if (ua.includes('linux')) {
    deviceInfo.os = 'linux';
  } else if (ua.includes('android')) {
    deviceInfo.os = 'android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    deviceInfo.os = 'ios';
  }
  
  // ブラウザ判定
  if (ua.includes('chrome') && !ua.includes('edge')) {
    deviceInfo.browser = 'chrome';
  } else if (ua.includes('firefox')) {
    deviceInfo.browser = 'firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    deviceInfo.browser = 'safari';
  } else if (ua.includes('edge')) {
    deviceInfo.browser = 'edge';
  } else if (ua.includes('opera')) {
    deviceInfo.browser = 'opera';
  }
  
  return deviceInfo;
}

/**
 * ユーザーエージェント変更ミドルウェア
 */
const useragentMiddleware = (req, res, next) => {
  // 設定確認
  const uaEnabled = req.query.useragent !== 'false';
  const customUA = req.query.ua;
  const uaCategory = req.query.ua_category;
  const uaBrowser = req.query.ua_browser;
  const language = req.query.lang || 'ja';
  
  if (!uaEnabled && !customUA) {
    return next();
  }
  
  let selectedUA = null;
  
  // カスタムUA が指定されている場合
  if (customUA) {
    if (customUA === 'random') {
      selectedUA = getRandomUserAgent(uaCategory);
    } else {
      // 特定のUA を検索
      for (const [category, browsers] of Object.entries(userAgents)) {
        for (const [browser, data] of Object.entries(browsers)) {
          if (browser === customUA || data.name.toLowerCase().includes(customUA.toLowerCase())) {
            selectedUA = { category, browser, ...data };
            break;
          }
        }
        if (selectedUA) break;
      }
    }
  } else if (uaCategory && uaBrowser) {
    // カテゴリとブラウザが指定されている場合
    const uaData = getUserAgent(uaCategory, uaBrowser);
    if (uaData) {
      selectedUA = { category: uaCategory, browser: uaBrowser, ...uaData };
    }
  }
  
  // デフォルトUA
  if (!selectedUA) {
    selectedUA = getUserAgent('desktop', 'chrome');
    selectedUA.category = 'desktop';
    selectedUA.browser = 'chrome';
  }
  
  if (selectedUA) {
    // ヘッダー生成
    const customHeaders = generateHeaders(selectedUA, language);
    
    // デバイス情報取得
    const deviceInfo = getDeviceInfo(selectedUA);
    
    // ログ出力
    logger.info(`ユーザーエージェント変更: ${selectedUA.name} (${deviceInfo.type}/${deviceInfo.os})`);
    
    // リクエストヘッダーを更新
    Object.assign(req.headers, customHeaders);
    
    // レスポンスに情報を追加
    req.userAgentInfo = {
      original: req.get('User-Agent'),
      modified: selectedUA.ua,
      device: deviceInfo,
      features: selectedUA.features || []
    };
    
    // レスポンスヘッダーにUA情報を追加
    res.setHeader('X-Modified-UA', selectedUA.name);
    res.setHeader('X-Device-Type', deviceInfo.type);
  }
  
  next();
};

// ユーザーエージェント管理機能
useragentMiddleware.getUserAgents = getAllUserAgents;
useragentMiddleware.getRandomUA = getRandomUserAgent;
useragentMiddleware.getUserAgent = getUserAgent;
useragentMiddleware.getDeviceInfo = getDeviceInfo;

// カスタムUA追加機能
useragentMiddleware.addUserAgent = (category, browser, data) => {
  if (!userAgents[category]) {
    userAgents[category] = {};
  }
  
  userAgents[category][browser] = data;
  logger.info(`カスタムユーザーエージェントを追加: ${category}/${browser} - ${data.name}`);
};

// 統計情報
useragentMiddleware.getStats = () => {
  let totalUAs = 0;
  const stats = {};
  
  for (const [category, browsers] of Object.entries(userAgents)) {
    stats[category] = Object.keys(browsers).length;
    totalUAs += stats[category];
  }
  
  return {
    total: totalUAs,
    categories: stats,
    languages: Object.keys(acceptLanguages).length
  };
};

module.exports = useragentMiddleware;