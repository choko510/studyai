"""
URL変換モジュール
相対URLを絶対URLに変換し、プロキシリンクを生成
"""
from urllib.parse import urlparse, urlunparse, urljoin, ParseResult
from typing import Optional, Tuple

from app.utils.helpers import create_proxy_url

def transform_url(url: str, base_url: str) -> str:
    """
    URLを変換
    
    Args:
        url: 変換するURL
        base_url: ベースURL
        
    Returns:
        str: 変換されたURL
    """
    # 特殊なURLプロトコルはそのまま返す
    if url.startswith(('data:', 'javascript:', 'mailto:', 'tel:', 'sms:', '#', 'about:')):
        return url
    
    # 絶対URLかどうかを確認
    parsed = urlparse(url)
    
    # スキームがなければ相対URLとみなす
    if not parsed.scheme:
        # ベースURLと結合して絶対URLを生成
        absolute_url = urljoin(base_url, url)
    else:
        absolute_url = url
    
    # プロキシURLを生成
    return create_proxy_url(absolute_url)

def normalize_base_url(url: str) -> str:
    """
    ベースURLを正規化
    
    Args:
        url: 正規化するURL
        
    Returns:
        str: 正規化されたベースURL
    """
    parsed = urlparse(url)
    
    # クエリパラメータとフラグメントを削除
    normalized = urlunparse(
        ParseResult(
            scheme=parsed.scheme,
            netloc=parsed.netloc,
            path=parsed.path,
            params=parsed.params,
            query='',
            fragment=''
        )
    )
    
    # パスがファイル名で終わる場合は親ディレクトリを取得
    if '/' in parsed.path and not parsed.path.endswith('/'):
        # 最後の/より後ろを削除
        path_parts = normalized.split('/')
        normalized = '/'.join(path_parts[:-1]) + '/'
    
    return normalized

def get_url_components(url: str) -> Tuple[str, str, str, str, str]:
    """
    URLを構成要素に分解
    
    Args:
        url: 分解するURL
        
    Returns:
        Tuple[str, str, str, str, str]: (スキーム, ネットロック, パス, クエリ, フラグメント)
    """
    parsed = urlparse(url)
    return (
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.query,
        parsed.fragment
    )

def get_domain_with_protocol(url: str) -> str:
    """
    URLからプロトコルを含むドメイン部分を取得
    
    Args:
        url: 対象のURL
        
    Returns:
        str: プロトコルを含むドメイン（例: https://example.com）
    """
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"

def is_same_origin(url1: str, url2: str) -> bool:
    """
    2つのURLが同一オリジンかどうかを判定
    
    Args:
        url1: 1つ目のURL
        url2: 2つ目のURL
        
    Returns:
        bool: 同一オリジンの場合はTrue
    """
    parsed1 = urlparse(url1)
    parsed2 = urlparse(url2)
    
    return (
        parsed1.scheme == parsed2.scheme and
        parsed1.netloc == parsed2.netloc
    )

def is_relative_url(url: str) -> bool:
    """
    相対URLかどうかを判定
    
    Args:
        url: 判定するURL
        
    Returns:
        bool: 相対URLの場合はTrue
    """
    return not urlparse(url).netloc and not url.startswith(('data:', 'javascript:', 'mailto:', 'tel:', '#'))

def is_absolute_url(url: str) -> bool:
    """
    絶対URLかどうかを判定
    
    Args:
        url: 判定するURL
        
    Returns:
        bool: 絶対URLの場合はTrue
    """
    return bool(urlparse(url).netloc)