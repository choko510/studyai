"""
CSS変換モジュール
CSSファイル内のURL関数を変換
"""
import re
from typing import Match, Optional

from app.utils.helpers import create_proxy_url, join_url

# CSS内のURL関数を検出する正規表現パターン
URL_PATTERN = re.compile(r"""
    url\(                            # url( の部分
    \s*                              # 空白文字（任意）
    (?P<quote>['"]?)                # 引用符（オプション）
    (?P<url>[^'"()]+?)              # URL（引用符と括弧を含まない）
    (?P=quote)                       # 同じ引用符で閉じる
    \s*                              # 空白文字（任意）
    \)                               # 閉じ括弧
""", re.VERBOSE)

# @importルールを検出する正規表現パターン
IMPORT_PATTERN = re.compile(r"""
    @import\s+                       # @import キーワード
    (?:url\(\s*)?                    # url( （オプション）
    (?P<quote>['"]?)                # 引用符（オプション）
    (?P<url>[^'"()]+?)              # URL（引用符と括弧を含まない）
    (?P=quote)                       # 同じ引用符で閉じる
    (?:\s*\))?                      # 閉じ括弧（オプション）
""", re.VERBOSE)

async def transform_css(css_content: bytes, base_url: str) -> str:
    """
    CSSコンテンツを変換
    
    Args:
        css_content: 元のCSSコンテンツ
        base_url: ベースURL
        
    Returns:
        str: 変換されたCSS
    """
    try:
        # CSSコンテンツをデコード
        try:
            css_text = css_content.decode('utf-8')
        except UnicodeDecodeError:
            css_text = css_content.decode('iso-8859-1', errors='replace')
        
        # URL関数を変換
        transformed_css = URL_PATTERN.sub(
            lambda match: transform_css_url(match, base_url),
            css_text
        )
        
        # @importルールを変換
        transformed_css = IMPORT_PATTERN.sub(
            lambda match: transform_css_import(match, base_url),
            transformed_css
        )
        
        # 広告ブロックCSSを追加
        transformed_css += generate_ad_block_css()
        
        return transformed_css
        
    except Exception as e:
        # 変換に失敗した場合は元のCSSをそのまま返す
        print(f"CSS変換エラー: {str(e)}")
        return css_content.decode('utf-8', errors='replace')

def transform_css_url(match: Match, base_url: str) -> str:
    """
    CSS内のURL関数を変換
    
    Args:
        match: 正規表現のマッチオブジェクト
        base_url: ベースURL
        
    Returns:
        str: 変換後のURL関数
    """
    quote = match.group('quote') or ''
    url = match.group('url')
    
    # data:URLやJavaScriptプロトコルはそのまま返す
    if url.startswith(('data:', 'javascript:', '#')):
        return f"url({quote}{url}{quote})"
    
    # 絶対URLに変換
    absolute_url = join_url(base_url, url)
    
    # プロキシURLを作成
    proxy_url = create_proxy_url(absolute_url)
    
    return f"url({quote}{proxy_url}{quote})"

def transform_css_import(match: Match, base_url: str) -> str:
    """
    CSS内の@importルールを変換
    
    Args:
        match: 正規表現のマッチオブジェクト
        base_url: ベースURL
        
    Returns:
        str: 変換後の@importルール
    """
    quote = match.group('quote') or ''
    url = match.group('url')
    
    # 絶対URLに変換
    absolute_url = join_url(base_url, url)
    
    # プロキシURLを作成
    proxy_url = create_proxy_url(absolute_url)
    
    return f"@import {quote}{proxy_url}{quote}"

def generate_ad_block_css() -> str:
    """
    広告ブロック用のCSSを生成
    
    Returns:
        str: 広告ブロック用CSS
    """
    return """

/* PyProxy広告ブロックCSS */
.adsbygoogle,
.ad-container,
div[id*="google_ads"],
div[id*="banner"],
div[class*="banner"],
div[id*="ad-"],
div[class*="ad-"],
div[class*="ads-"],
div[id*="ads-"],
[id*="ScriptRoot"],
iframe[src*="doubleclick"],
iframe[src*="ads"],
.advertisement,
.sponsored-content,
.sponsor-wrapper,
.sponsor-container,
#sponsored-content,
#ad-container,
#adunit,
#adwrapper,
#banner_ad {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    height: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
    position: absolute !important;
    left: -9999px !important;
    pointer-events: none !important;
}
"""