"""
HTML変換モジュール
外部サイトのHTMLを解析してリンクやスクリプトをプロキシ経由に書き換え
"""
from typing import Optional, List, Set, Dict, Any
import re
from bs4 import BeautifulSoup, Tag, NavigableString

from app.utils.helpers import create_proxy_url, join_url, normalize_url

# 書き換え対象の属性とその親要素のマッピング
URL_ATTRIBUTES = {
    'a': ['href'],
    'img': ['src', 'srcset', 'data-src'],
    'link': ['href'],
    'script': ['src'],
    'iframe': ['src'],
    'form': ['action'],
    'object': ['data'],
    'embed': ['src'],
    'source': ['src', 'srcset'],
    'video': ['src', 'poster'],
    'audio': ['src'],
    'track': ['src'],
    'input': ['src'],  # type="image"の場合
    'base': ['href'],
    'area': ['href'],
    'meta': ['content'],  # http-equivがrefreshの場合
}

# 広告関連の要素を識別するセレクタ
AD_SELECTORS = [
    'div[id*="ad"]',
    'div[class*="ad"]',
    'div[id*="banner"]',
    'div[class*="banner"]',
    'ins.adsbygoogle',
    'div[id*="google_ads"]',
    'div[class*="ad-container"]',
    'iframe[src*="ads"]',
    'iframe[src*="doubleclick"]',
    'div[class*="sponsored"]',
    # 他にも広告要素のセレクタを追加
]

# トラッキング関連のスクリプトを識別するパターン
TRACKING_PATTERNS = [
    r'google-analytics\.com',
    r'googletagmanager\.com',
    r'facebook\.net',
    r'twitter\.com/widgets\.js',
    r'connect\.facebook\.net',
    r'platform\.twitter\.com',
    r'analytics',
    r'tracker',
    r'pixel',
    # 他にもトラッキングスクリプトのパターンを追加
]

async def transform_html(html_content: bytes, base_url: str) -> str:
    """
    HTMLコンテンツを変換
    
    Args:
        html_content: 元のHTMLコンテンツ
        base_url: ベースURL
        
    Returns:
        str: 変換されたHTML
    """
    try:
        # HTMLコンテンツをデコード
        try:
            html_text = html_content.decode('utf-8')
        except UnicodeDecodeError:
            # UTF-8でデコードできない場合は他のエンコーディングを試す
            html_text = html_content.decode('iso-8859-1')
            
        # HTML解析
        soup = BeautifulSoup(html_text, 'lxml')
        
        # <base>タグの処理
        base_tag = soup.find('base')
        if base_tag and base_tag.get('href'):
            # baseタグのhrefをプロキシURLに書き換え
            base_href = join_url(base_url, base_tag['href'])
            base_tag['href'] = create_proxy_url(base_href)
        
        # メタリフレッシュの処理
        meta_refresh = soup.find('meta', attrs={'http-equiv': lambda x: x and x.lower() == 'refresh'})
        if meta_refresh and meta_refresh.get('content'):
            content = meta_refresh['content']
            # "seconds; url=URL" 形式のコンテンツを検出
            match = re.search(r'(\d+)\s*;\s*url\s*=\s*(.+)', content, re.IGNORECASE)
            if match:
                seconds, url = match.groups()
                new_url = join_url(base_url, url.strip())
                new_content = f"{seconds}; url={create_proxy_url(new_url)}"
                meta_refresh['content'] = new_content
        
        # 全要素のURL属性を書き換え
        for tag_name, attrs in URL_ATTRIBUTES.items():
            for tag in soup.find_all(tag_name):
                transform_tag_attributes(tag, attrs, base_url)
        
        # インラインスクリプトのURL書き換え
        for script in soup.find_all('script', src=None):
            if script.string:
                script.string = transform_inline_js(script.string, base_url)
        
        # インラインCSSのURL書き換え
        for style in soup.find_all('style'):
            if style.string:
                style.string = transform_inline_css(style.string, base_url)
        
        # style属性の変換
        for tag in soup.find_all(style=True):
            tag['style'] = transform_inline_css(tag['style'], base_url)
        
        # 広告要素の削除
        for selector in AD_SELECTORS:
            for ad_tag in soup.select(selector):
                ad_tag.extract()  # 要素を削除
        
        # トラッキングスクリプトの無効化
        for script in soup.find_all('script', src=True):
            src = script.get('src', '')
            if any(re.search(pattern, src, re.IGNORECASE) for pattern in TRACKING_PATTERNS):
                script.extract()  # スクリプトを削除
        
        # プロキシヘルパースクリプトの追加
        add_proxy_helper_script(soup, base_url)
        
        # 変換されたHTMLを返す
        return str(soup)
        
    except Exception as e:
        # 変換に失敗した場合は元のHTMLをそのまま返す
        print(f"HTML変換エラー: {str(e)}")
        return html_content.decode('utf-8', errors='replace')

def transform_tag_attributes(tag: Tag, attributes: List[str], base_url: str) -> None:
    """
    タグの属性を変換
    
    Args:
        tag: BS4タグオブジェクト
        attributes: 変換する属性のリスト
        base_url: ベースURL
    """
    for attr in attributes:
        if tag.has_attr(attr):
            attr_value = tag[attr]
            
            # 特殊な属性の処理
            if attr == 'srcset':
                # srcsetは複数のURLを含む可能性がある
                tag[attr] = transform_srcset(attr_value, base_url)
            else:
                # data:URLやjavascript:などの特殊URLはスキップ
                if attr_value and not attr_value.startswith(('data:', 'javascript:', 'mailto:', 'tel:')):
                    full_url = join_url(base_url, attr_value)
                    tag[attr] = create_proxy_url(full_url)

def transform_srcset(srcset: str, base_url: str) -> str:
    """
    srcset属性の変換
    
    Args:
        srcset: srcset属性の値
        base_url: ベースURL
        
    Returns:
        str: 変換後のsrcset値
    """
    if not srcset:
        return srcset
        
    parts = []
    for part in srcset.split(','):
        url_parts = part.strip().split(' ', 1)
        if url_parts:
            url = url_parts[0]
            descriptor = url_parts[1] if len(url_parts) > 1 else ""
            
            # URLを変換
            full_url = join_url(base_url, url)
            proxy_url = create_proxy_url(full_url)
            
            if descriptor:
                parts.append(f"{proxy_url} {descriptor}")
            else:
                parts.append(proxy_url)
                
    return ', '.join(parts)

def transform_inline_js(js_code: str, base_url: str) -> str:
    """
    インラインJavaScriptの変換
    URLを含む文字列をプロキシURLに書き換え
    
    Args:
        js_code: JavaScriptコード
        base_url: ベースURL
        
    Returns:
        str: 変換後のJavaScriptコード
    """
    if not js_code:
        return js_code
        
    # URL文字列を検出して書き換え（単純な置換）
    # より複雑なケースはJavaScript変換モジュールで処理
    
    # 単純な置換パターン: "http://..." や 'http://...' など
    patterns = [
        (r'"(https?://[^"]+)"', r'"{}"'),
        (r"'(https?://[^']+)'", r"'{}'"),
        (r"url\(\s*['\"]?(https?://[^'\")]+)['\"]?\s*\)", r"url({})")
    ]
    
    for pattern, template in patterns:
        def replace_url(match):
            url = match.group(1)
            proxy_url = create_proxy_url(url)
            return template.format(proxy_url)
            
        js_code = re.sub(pattern, replace_url, js_code)
    
    return js_code

def transform_inline_css(css_code: str, base_url: str) -> str:
    """
    インラインCSSの変換
    URL()関数内のパスをプロキシURLに書き換え
    
    Args:
        css_code: CSSコード
        base_url: ベースURL
        
    Returns:
        str: 変換後のCSSコード
    """
    if not css_code:
        return css_code
    
    # CSS内のurl()を検出して書き換え
    def replace_css_url(match):
        url = match.group(1).strip("'\"")
        if url.startswith(('data:', 'javascript:', '#')):
            return f"url({match.group(1)})"
        full_url = join_url(base_url, url)
        return f"url('{create_proxy_url(full_url)}')"
    
    return re.sub(r"url\(\s*([^)]+)\s*\)", replace_css_url, css_code)

def add_proxy_helper_script(soup: BeautifulSoup, base_url: str) -> None:
    """
    プロキシヘルパースクリプトを追加
    XHR/fetchをオーバーライドしてプロキシ経由にリダイレクト
    
    Args:
        soup: BeautifulSoupオブジェクト
        base_url: ベースURL
    """
    helper_script = f"""
    <script>
    (function() {{
        // 元のXMLHttpRequestを保存
        var originalXHR = window.XMLHttpRequest;
        
        // XHRをオーバーライド
        window.XMLHttpRequest = function() {{
            var xhr = new originalXHR();
            var originalOpen = xhr.open;
            
            xhr.open = function(method, url, async, user, password) {{
                // 相対URLを絶対URLに変換
                var absoluteUrl = new URL(url, "{base_url}").href;
                
                // プロキシURLを作成
                var proxyUrl = "/proxy?url=" + encodeURIComponent(absoluteUrl);
                
                // 元のopen関数を呼び出し
                return originalOpen.call(this, method, proxyUrl, async, user, password);
            }};
            
            return xhr;
        }};
        
        // 元のfetchを保存
        var originalFetch = window.fetch;
        
        // fetchをオーバーライド
        window.fetch = function(resource, init) {{
            var url;
            
            if (typeof resource === 'string') {{
                url = resource;
            }} else if (resource instanceof Request) {{
                url = resource.url;
                resource = new Request(resource, init);
            }}
            
            if (url) {{
                // 相対URLを絶対URLに変換
                var absoluteUrl = new URL(url, "{base_url}").href;
                
                // プロキシURLを作成
                var proxyUrl = "/proxy?url=" + encodeURIComponent(absoluteUrl);
                
                if (typeof resource === 'string') {{
                    return originalFetch.call(this, proxyUrl, init);
                }} else {{
                    resource = new Request(proxyUrl, {{
                        method: resource.method,
                        headers: resource.headers,
                        body: resource.body,
                        mode: resource.mode,
                        credentials: resource.credentials,
                        cache: resource.cache,
                        redirect: resource.redirect,
                        referrer: resource.referrer,
                        integrity: resource.integrity
                    }});
                    return originalFetch.call(this, resource);
                }}
            }}
            
            return originalFetch.apply(this, arguments);
        }};
    }})();
    </script>
    """
    
    # スクリプトをHTMLに挿入
    script_tag = BeautifulSoup(helper_script, 'lxml').script
    soup.head.append(script_tag) if soup.head else soup.append(script_tag)