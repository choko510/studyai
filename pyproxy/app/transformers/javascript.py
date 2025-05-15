"""
JavaScript変換モジュール
JavaScriptコードを解析して変換
広告と追跡スクリプトの無効化を行う
"""
import re
from typing import Set, List, Pattern, Match, Optional
import json

from app.utils.helpers import create_proxy_url, join_url

# 広告関連のパターン
AD_PATTERNS = [
    r'ad(s|vertis(ing|ement))?[_-]?',
    r'sponsor(ed|ship)?[_-]?',
    r'affiliate[_-]?',
    r'banner[_-]?',
    r'doubleclick\.net',
    r'google.*ads',
    r'adserv(er|ice)?',
    r'analytics',
    r'trackingP?i?x?e?l?',
]

# トラッキング関連のパターン
TRACKING_PATTERNS = [
    r'google[-_]?analytics',
    r'googletagmanager',
    r'gtm\.',
    r'facebook[-_]?pixel',
    r'fb[-_]?pixel',
    r'twitter[-_]?tracker',
    r'hotjar',
    r'matomo',
    r'piwik',
    r'segment\.',
    r'omniture',
    r'chartbeat',
    r'clicktale',
    r'collect\?',
    r'beacon\.',
    r'pixel\?',
    r'track(ing)?\.js',
]

# コンパイル済みの正規表現パターン
compiled_ad_patterns: List[Pattern] = [re.compile(pattern, re.IGNORECASE) for pattern in AD_PATTERNS]
compiled_tracking_patterns: List[Pattern] = [re.compile(pattern, re.IGNORECASE) for pattern in TRACKING_PATTERNS]

async def transform_javascript(js_content: bytes, base_url: str) -> str:
    """
    JavaScriptコードを変換
    
    Args:
        js_content: 元のJavaScriptコード
        base_url: ベースURL
        
    Returns:
        str: 変換されたJavaScriptコード
    """
    try:
        # JavaScriptコードをデコード
        try:
            js_text = js_content.decode('utf-8')
        except UnicodeDecodeError:
            js_text = js_content.decode('iso-8859-1', errors='replace')
        
        # 広告や追跡スクリプトの特徴的な部分を無効化
        if should_block_script(js_text):
            # 特定のパターンに合致する場合はスクリプトを無効化
            return generate_blocked_script()
        
        # URL文字列を変換
        js_text = transform_url_strings(js_text, base_url)
        
        # APIエンドポイントの呼び出しを変換
        js_text = transform_api_calls(js_text, base_url)
        
        return js_text
        
    except Exception as e:
        # 変換に失敗した場合は元のスクリプトをそのまま返す
        print(f"JavaScript変換エラー: {str(e)}")
        return js_content.decode('utf-8', errors='replace')

def should_block_script(js_code: str) -> bool:
    """
    スクリプトが広告または追跡スクリプトに該当するかを判定
    
    Args:
        js_code: JavaScriptコード
        
    Returns:
        bool: ブロックすべき場合はTrue
    """
    # トラッキングスクリプトの特徴的なパターンをチェック
    for pattern in compiled_tracking_patterns:
        if pattern.search(js_code):
            return True
    
    # 広告スクリプトの特徴的なパターンをチェック
    for pattern in compiled_ad_patterns:
        if pattern.search(js_code):
            return True
            
    # その他の特徴的な部分をチェック
    if 'function gtag(' in js_code or 'googletagmanager' in js_code:
        return True
    if 'google-analytics.com' in js_code:
        return True
    if 'fbq(' in js_code and 'facebook' in js_code:
        return True
    if 'function ga(' in js_code:
        return True
        
    return False

def generate_blocked_script() -> str:
    """
    ブロックされたスクリプトの代わりに返すコード
    
    Returns:
        str: 無害なダミースクリプト
    """
    return """
// 広告または追跡スクリプトがブロックされました
(function() {
    // ダミー関数を提供してエラーを防止
    window.ga = window.ga || function() {};
    window.gtag = window.gtag || function() {};
    window.fbq = window.fbq || function() {};
    window._gaq = window._gaq || {
        push: function() {}
    };
    
    // コンソールに情報を表示
    console.info("PyProxy: 広告または追跡スクリプトがブロックされました");
})();
"""

def transform_url_strings(js_code: str, base_url: str) -> str:
    """
    JavaScriptコード内のURL文字列を変換
    
    Args:
        js_code: JavaScriptコード
        base_url: ベースURL
        
    Returns:
        str: 変換されたJavaScriptコード
    """
    # 文字列リテラル内のURLを検出して変換
    patterns = [
        # ダブルクォート文字列
        (r'"(https?://[^"]+)"', lambda m: f'"{transform_url(m.group(1), base_url)}"'),
        # シングルクォート文字列
        (r"'(https?://[^']+)'", lambda m: f"'{transform_url(m.group(1), base_url)}'"),
        # テンプレートリテラル
        (r"`(https?://[^`]+)`", lambda m: f"`{transform_url(m.group(1), base_url)}`"),
        # URLコンストラクタ
        (r"new URL\s*\(\s*['\"`](https?://[^'\"`;]+)['\"`]", 
         lambda m: f"new URL(\"{transform_url(m.group(1), base_url)}\""),
        # fetch APIの呼び出し
        (r"fetch\s*\(\s*['\"`](https?://[^'\"`;]+)['\"`]", 
         lambda m: f"fetch(\"{transform_url(m.group(1), base_url)}\""),
        # XMLHttpRequest.open
        (r"\.open\s*\(\s*['\"`](GET|POST|PUT|DELETE)['\"`]\s*,\s*['\"`](https?://[^'\"`;]+)['\"`]",
         lambda m: f".open(\"{m.group(1)}\", \"{transform_url(m.group(2), base_url)}\""),
    ]
    
    for pattern, replacement in patterns:
        js_code = re.sub(pattern, replacement, js_code)
    
    return js_code

def transform_api_calls(js_code: str, base_url: str) -> str:
    """
    JavaScriptコード内のAPI呼び出しを変換
    
    Args:
        js_code: JavaScriptコード
        base_url: ベースURL
        
    Returns:
        str: 変換されたJavaScriptコード
    """
    # APIエンドポイント呼び出しのオーバーライド
    overrides = """
    // PyProxy: XMLHttpRequestとfetchのオーバーライド
    (function() {
        if (window.__pyproxy_patched) return;
        
        // 元のXMLHttpRequestを保存
        var originalXHR = window.XMLHttpRequest;
        
        // XHRをオーバーライド
        window.XMLHttpRequest = function() {
            var xhr = new originalXHR();
            var originalOpen = xhr.open;
            
            xhr.open = function(method, url, async, user, password) {
                // 相対URLを絶対URLに変換
                var absoluteUrl;
                try {
                    absoluteUrl = new URL(url, window.location.href).href;
                } catch (e) {
                    absoluteUrl = url;
                }
                
                // プロキシURLを作成
                var proxyUrl = "/proxy?url=" + encodeURIComponent(absoluteUrl);
                
                // 元のopen関数を呼び出し
                return originalOpen.call(this, method, proxyUrl, async, user, password);
            };
            
            return xhr;
        };
        
        // 元のfetchを保存
        var originalFetch = window.fetch;
        
        // fetchをオーバーライド
        if (originalFetch) {
            window.fetch = function(resource, init) {
                var url;
                
                if (typeof resource === 'string') {
                    url = resource;
                } else if (resource instanceof Request) {
                    url = resource.url;
                    resource = new Request(resource, init);
                }
                
                if (url) {
                    // 相対URLを絶対URLに変換
                    var absoluteUrl;
                    try {
                        absoluteUrl = new URL(url, window.location.href).href;
                    } catch (e) {
                        absoluteUrl = url;
                    }
                    
                    // プロキシURLを作成
                    var proxyUrl = "/proxy?url=" + encodeURIComponent(absoluteUrl);
                    
                    if (typeof resource === 'string') {
                        return originalFetch.call(this, proxyUrl, init);
                    } else {
                        resource = new Request(proxyUrl, {
                            method: resource.method,
                            headers: resource.headers,
                            body: resource.body,
                            mode: resource.mode,
                            credentials: resource.credentials,
                            cache: resource.cache,
                            redirect: resource.redirect,
                            referrer: resource.referrer,
                            integrity: resource.integrity
                        });
                        return originalFetch.call(this, resource);
                    }
                }
                
                return originalFetch.apply(this, arguments);
            };
        }
        
        window.__pyproxy_patched = true;
        console.info("PyProxy: XMLHttpRequestとfetchをオーバーライドしました");
    })();
    """
    
    # すでにオーバーライドコードが含まれていなければ追加
    if "window.__pyproxy_patched" not in js_code:
        js_code = overrides + "\n\n" + js_code
    
    return js_code

def transform_url(url: str, base_url: str) -> str:
    """
    URLをプロキシ経由のURLに変換
    
    Args:
        url: 元のURL
        base_url: ベースURL
        
    Returns:
        str: 変換されたURL
    """
    # データURLやJavaScriptプロトコルはそのまま返す
    if url.startswith(('data:', 'javascript:', 'blob:', 'about:', '#')):
        return url
    
    # 絶対URLかどうかを確認
    absolute_url = url
    if not url.startswith(('http://', 'https://')):
        absolute_url = join_url(base_url, url)
    
    # プロキシURLを作成
    return create_proxy_url(absolute_url)