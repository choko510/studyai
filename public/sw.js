// Ultraviolet Proxy Service Worker
// このService WorkerはUltravioletプロキシの中核となります

// Service Worker設定
const SW_VERSION = '1.0.0';
const CACHE_NAME = `ultraviolet-proxy-v${SW_VERSION}`;
const UV_PREFIX = '/service/';
const BARE_PREFIX = '/bare/';

// キャッシュするリソース
const STATIC_CACHE_RESOURCES = [
    '/',
    '/index.html',
    '/assets/css/style.css',
    '/assets/css/themes.css',
    '/assets/css/responsive.css',
    '/assets/js/app.js',
    '/assets/js/settings.js',
    '/assets/js/history.js',
    '/assets/js/bookmarks.js',
    '/manifest.json'
];

// Ultraviolet設定
const UV_CONFIG = {
    prefix: UV_PREFIX,
    bare: BARE_PREFIX,
    encodeUrl: (url) => btoa(url).replace(/=/g, ''),
    decodeUrl: (encoded) => atob(encoded),
    handler: '/uv/uv.handler.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv/uv.config.js',
    sw: '/uv/uv.sw.js'
};

// 統計情報
let proxyStats = {
    requests: 0,
    blocked: 0,
    cached: 0,
    errors: 0
};

// ログ関数
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        data,
        version: SW_VERSION
    };
    
    if (level === 'error') {
        console.error(`[SW ${level.toUpperCase()}]`, message, data);
    } else {
        console.log(`[SW ${level.toUpperCase()}]`, message, data);
    }
}

// Service Worker インストール
self.addEventListener('install', (event) => {
    log('info', 'Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                log('info', 'Caching static resources');
                return cache.addAll(STATIC_CACHE_RESOURCES);
            })
            .then(() => {
                log('info', 'Service Worker installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                log('error', 'Service Worker installation failed', error);
            })
    );
});

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
    log('info', 'Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            log('info', 'Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                log('info', 'Service Worker activated successfully');
                return self.clients.claim();
            })
            .catch((error) => {
                log('error', 'Service Worker activation failed', error);
            })
    );
});

// メインのfetchイベントハンドラー
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // プロキシリクエストの処理
    if (url.pathname.startsWith(UV_PREFIX)) {
        event.respondWith(handleProxyRequest(event.request));
        return;
    }
    
    // 静的リソースのキャッシュ処理
    if (event.request.method === 'GET' && !url.pathname.startsWith('/api/')) {
        event.respondWith(handleStaticRequest(event.request));
        return;
    }
    
    // その他のリクエストはそのまま通す
    event.respondWith(fetch(event.request));
});

// プロキシリクエストの処理
async function handleProxyRequest(request) {
    try {
        proxyStats.requests++;
        
        const url = new URL(request.url);
        const encodedUrl = url.pathname.replace(UV_PREFIX, '');
        
        if (!encodedUrl) {
            return new Response('URLが指定されていません', { status: 400 });
        }
        
        // URLをデコード
        const targetUrl = UV_CONFIG.decodeUrl(encodedUrl);
        log('info', 'Proxying request', { targetUrl, method: request.method });
        
        // セキュリティチェック
        const securityCheck = await performSecurityCheck(targetUrl, request);
        if (!securityCheck.allowed) {
            log('warn', 'Request blocked by security check', securityCheck);
            proxyStats.blocked++;
            return createBlockedResponse(securityCheck.reason);
        }
        
        // 広告ブロックチェック
        const adblockCheck = await performAdblockCheck(targetUrl, request);
        if (!adblockCheck.allowed) {
            log('info', 'Request blocked by adblock', adblockCheck);
            proxyStats.blocked++;
            return createBlockedResponse('広告ブロック');
        }
        
        // プロキシリクエストの作成と送信
        const proxyResponse = await executeProxyRequest(targetUrl, request);
        
        // レスポンスの後処理
        return processProxyResponse(proxyResponse, targetUrl);
        
    } catch (error) {
        log('error', 'Proxy request failed', { error: error.message, url: request.url });
        proxyStats.errors++;
        return createErrorResponse(error.message);
    }
}

// セキュリティチェック
async function performSecurityCheck(targetUrl, request) {
    try {
        // 基本的なURL検証
        const url = new URL(targetUrl);
        
        // 危険なプロトコルをブロック
        if (!['http:', 'https:'].includes(url.protocol)) {
            return {
                allowed: false,
                reason: '許可されていないプロトコルです'
            };
        }
        
        // ローカルネットワークアクセスをブロック
        const hostname = url.hostname.toLowerCase();
        const localHosts = ['localhost', '127.0.0.1', '::1'];
        const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];
        
        if (localHosts.includes(hostname) || privateRanges.some(range => range.test(hostname))) {
            return {
                allowed: false,
                reason: 'ローカルネットワークへのアクセスは禁止されています'
            };
        }
        
        // 危険なファイル拡張子をチェック
        const dangerousExtensions = ['.exe', '.msi', '.scr', '.bat', '.cmd', '.com', '.pif'];
        const pathname = url.pathname.toLowerCase();
        
        if (dangerousExtensions.some(ext => pathname.endsWith(ext))) {
            return {
                allowed: false,
                reason: '危険なファイル拡張子です'
            };
        }
        
        return { allowed: true };
        
    } catch (error) {
        log('error', 'Security check failed', error);
        return { allowed: true }; // エラーの場合は通す
    }
}

// 広告ブロックチェック
async function performAdblockCheck(targetUrl, request) {
    try {
        const url = new URL(targetUrl);
        const hostname = url.hostname.toLowerCase();
        const pathname = url.pathname.toLowerCase();
        const fullUrl = targetUrl.toLowerCase();
        
        // 広告ドメインリスト
        const adDomains = [
            'doubleclick.net',
            'googlesyndication.com',
            'googleadservices.com',
            'facebook.com/tr',
            'amazon-adsystem.com',
            'adsystem.com',
            'advertising.com'
        ];
        
        // ドメインチェック
        if (adDomains.some(domain => hostname.includes(domain))) {
            return {
                allowed: false,
                reason: '広告ドメインがブロックされました'
            };
        }
        
        // パスパターンチェック
        const adPatterns = [
            /\/ads?\/|\/ad\/|\/advertisement\/|\/banner\//i,
            /\/popup\/|\/interstitial\//i,
            /analytics|tracking|metrics|beacon/i
        ];
        
        if (adPatterns.some(pattern => pattern.test(fullUrl))) {
            return {
                allowed: false,
                reason: '広告パターンがブロックされました'
            };
        }
        
        return { allowed: true };
        
    } catch (error) {
        log('error', 'Adblock check failed', error);
        return { allowed: true }; // エラーの場合は通す
    }
}

// プロキシリクエストの実行
async function executeProxyRequest(targetUrl, originalRequest) {
    // リクエストヘッダーを準備
    const headers = new Headers();
    
    // 必要なヘッダーをコピー
    const allowedHeaders = [
        'accept',
        'accept-language',
        'accept-encoding',
        'cache-control',
        'content-type',
        'user-agent',
        'referer'
    ];
    
    for (const header of allowedHeaders) {
        const value = originalRequest.headers.get(header);
        if (value) {
            headers.set(header, value);
        }
    }
    
    // プロキシ特有のヘッダーを追加
    headers.set('X-Forwarded-For', 'proxy');
    headers.set('X-Requested-With', 'UltravioletProxy');
    
    // リクエストオプション
    const requestOptions = {
        method: originalRequest.method,
        headers: headers,
        credentials: 'omit',
        redirect: 'follow'
    };
    
    // ボディがある場合は追加
    if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
        try {
            requestOptions.body = await originalRequest.clone().arrayBuffer();
        } catch (error) {
            log('warn', 'Failed to clone request body', error);
        }
    }
    
    // リクエストを送信
    const response = await fetch(targetUrl, requestOptions);
    
    if (!response.ok) {
        log('warn', 'Proxy request returned error status', {
            status: response.status,
            statusText: response.statusText,
            url: targetUrl
        });
    }
    
    return response;
}

// プロキシレスポンスの後処理
async function processProxyResponse(response, targetUrl) {
    const url = new URL(targetUrl);
    const contentType = response.headers.get('content-type') || '';
    
    // HTMLの場合はURLを書き換え
    if (contentType.includes('text/html')) {
        return await processHTMLResponse(response, url);
    }
    
    // CSSの場合もURLを書き換え
    if (contentType.includes('text/css')) {
        return await processCSSResponse(response, url);
    }
    
    // JavaScriptの場合は制限チェック
    if (contentType.includes('javascript') || contentType.includes('ecmascript')) {
        return await processJSResponse(response, url);
    }
    
    // その他のリソースはそのまま返す
    return createProxyResponse(response);
}

// HTMLレスポンスの処理
async function processHTMLResponse(response, baseUrl) {
    try {
        let html = await response.text();
        
        // ベースURLを設定
        html = html.replace(/<head>/i, `<head><base href="${baseUrl.origin}">`);
        
        // 相対URLを絶対URLに変換
        html = rewriteHTMLUrls(html, baseUrl);
        
        // セキュリティヘッダーを追加
        html = addSecurityHeaders(html);
        
        return new Response(html, {
            status: response.status,
            statusText: response.statusText,
            headers: createResponseHeaders(response, 'text/html')
        });
    } catch (error) {
        log('error', 'HTML processing failed', error);
        return createProxyResponse(response);
    }
}

// CSSレスポンスの処理
async function processCSSResponse(response, baseUrl) {
    try {
        let css = await response.text();
        
        // CSS内のURLを書き換え
        css = rewriteCSSUrls(css, baseUrl);
        
        return new Response(css, {
            status: response.status,
            statusText: response.statusText,
            headers: createResponseHeaders(response, 'text/css')
        });
    } catch (error) {
        log('error', 'CSS processing failed', error);
        return createProxyResponse(response);
    }
}

// JavaScriptレスポンスの処理
async function processJSResponse(response, baseUrl) {
    try {
        let js = await response.text();
        
        // 危険な関数をサンドボックス化
        js = sandboxJavaScript(js);
        
        return new Response(js, {
            status: response.status,
            statusText: response.statusText,
            headers: createResponseHeaders(response, 'application/javascript')
        });
    } catch (error) {
        log('error', 'JavaScript processing failed', error);
        return createProxyResponse(response);
    }
}

// HTML内のURL書き換え
function rewriteHTMLUrls(html, baseUrl) {
    const base = baseUrl.origin + baseUrl.pathname;
    
    // href属性の書き換え
    html = html.replace(/href=["']([^"']+)["']/gi, (match, url) => {
        const newUrl = resolveUrl(url, base);
        return `href="${newUrl}"`;
    });
    
    // src属性の書き換え
    html = html.replace(/src=["']([^"']+)["']/gi, (match, url) => {
        const newUrl = resolveUrl(url, base);
        return `src="${newUrl}"`;
    });
    
    // action属性の書き換え
    html = html.replace(/action=["']([^"']+)["']/gi, (match, url) => {
        const newUrl = resolveUrl(url, base);
        return `action="${newUrl}"`;
    });
    
    return html;
}

// CSS内のURL書き換え
function rewriteCSSUrls(css, baseUrl) {
    const base = baseUrl.origin + baseUrl.pathname;
    
    return css.replace(/url\(['"]?([^)''"]+)['"]?\)/gi, (match, url) => {
        const newUrl = resolveUrl(url, base);
        return `url("${newUrl}")`;
    });
}

// JavaScript のサンドボックス化
function sandboxJavaScript(js) {
    // 危険な関数の制限
    const restrictions = [
        'eval(',
        'Function(',
        'setTimeout(',
        'setInterval(',
        'document.write(',
        'document.writeln('
    ];
    
    for (const restriction of restrictions) {
        const regex = new RegExp(restriction.replace('(', '\\('), 'gi');
        js = js.replace(regex, `console.warn('Restricted function: ${restriction}'); void(`);
    }
    
    return js;
}

// URLの解決
function resolveUrl(url, base) {
    try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return UV_PREFIX + UV_CONFIG.encodeUrl(url);
        }
        
        if (url.startsWith('//')) {
            return UV_PREFIX + UV_CONFIG.encodeUrl('https:' + url);
        }
        
        if (url.startsWith('/')) {
            const baseUrl = new URL(base);
            return UV_PREFIX + UV_CONFIG.encodeUrl(baseUrl.origin + url);
        }
        
        const resolvedUrl = new URL(url, base).href;
        return UV_PREFIX + UV_CONFIG.encodeUrl(resolvedUrl);
    } catch (error) {
        log('error', 'URL resolution failed', { url, base, error: error.message });
        return url;
    }
}

// セキュリティヘッダーの追加
function addSecurityHeaders(html) {
    const securityMeta = `
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' ws: wss: *;">
        <meta http-equiv="X-Content-Type-Options" content="nosniff">
        <meta http-equiv="X-Frame-Options" content="SAMEORIGIN">
    `;
    
    return html.replace(/<head>/i, `<head>${securityMeta}`);
}

// レスポンスヘッダーの作成
function createResponseHeaders(originalResponse, contentType) {
    const headers = new Headers();
    
    // 基本ヘッダー
    headers.set('Content-Type', contentType);
    headers.set('X-Proxy-By', 'UltravioletProxy');
    
    // オリジナルの有用なヘッダーをコピー
    const preserveHeaders = ['cache-control', 'expires', 'last-modified', 'etag'];
    for (const header of preserveHeaders) {
        const value = originalResponse.headers.get(header);
        if (value) {
            headers.set(header, value);
        }
    }
    
    return headers;
}

// プロキシレスポンスの作成
function createProxyResponse(response) {
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: createResponseHeaders(response, response.headers.get('content-type'))
    });
}

// ブロックレスポンスの作成
function createBlockedResponse(reason) {
    return new Response(JSON.stringify({
        blocked: true,
        reason: reason,
        timestamp: new Date().toISOString()
    }), {
        status: 204,
        headers: {
            'Content-Type': 'application/json',
            'X-Blocked-Reason': reason
        }
    });
}

// エラーレスポンスの作成
function createErrorResponse(message) {
    return new Response(JSON.stringify({
        error: true,
        message: message,
        timestamp: new Date().toISOString()
    }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

// 静的リクエストの処理
async function handleStaticRequest(request) {
    try {
        // キャッシュから確認
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            proxyStats.cached++;
            return cachedResponse;
        }
        
        // ネットワークから取得
        const response = await fetch(request);
        
        // キャッシュに保存
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        log('error', 'Static request failed', error);
        return createErrorResponse('リソースの取得に失敗しました');
    }
}

// メッセージハンドラー
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'GET_STATS':
            event.ports[0].postMessage({
                type: 'STATS_RESPONSE',
                data: proxyStats
            });
            break;
            
        case 'CLEAR_CACHE':
            caches.delete(CACHE_NAME).then(() => {
                event.ports[0].postMessage({
                    type: 'CACHE_CLEARED',
                    success: true
                });
            });
            break;
            
        default:
            log('warn', 'Unknown message type', type);
    }
});

log('info', 'Service Worker script loaded', { version: SW_VERSION });