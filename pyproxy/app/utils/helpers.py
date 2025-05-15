"""
ユーティリティ関数モジュール
URLの処理やその他の共通機能を提供
"""
from typing import Dict, Any, Optional, Union
import re
import time
from urllib.parse import urlparse, urljoin, quote, unquote, ParseResult, urlencode, parse_qs

def is_valid_url(url: str) -> bool:
    """
    URLが有効かどうかを確認
    
    Args:
        url: 検証するURL
        
    Returns:
        bool: URLが有効な場合はTrue、そうでない場合はFalse
    """
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
    except Exception:
        return False

def normalize_url(url: str) -> str:
    """
    URLを正規化（標準化）
    
    Args:
        url: 正規化するURL
        
    Returns:
        str: 正規化されたURL
    """
    try:
        # スキームが含まれていない場合はhttpsを追加
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        parsed = urlparse(url)
        
        # パスが空の場合は/を追加
        path = parsed.path
        if not path:
            path = '/'
            
        # 正規化されたURLを再構築
        normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
        
        # クエリパラメータがある場合は追加
        if parsed.query:
            normalized += f"?{parsed.query}"
            
        # フラグメントがある場合は追加
        if parsed.fragment:
            normalized += f"#{parsed.fragment}"
            
        return normalized
    except Exception:
        return url

def create_proxy_url(original_url: str, proxy_path: str = '/proxy') -> str:
    """
    プロキシ用のURLを生成
    
    Args:
        original_url: 元のURL
        proxy_path: プロキシエンドポイントのパス
        
    Returns:
        str: プロキシ用のURL
    """
    if not is_valid_url(original_url):
        return ""
        
    encoded_url = quote(original_url)
    return f"{proxy_path}?url={encoded_url}"

def get_original_url(proxy_url: str) -> str:
    """
    プロキシURLから元のURLを取得
    
    Args:
        proxy_url: プロキシURL
        
    Returns:
        str: 元のURL
    """
    try:
        parsed = urlparse(proxy_url)
        query_params = parse_qs(parsed.query)
        
        if 'url' in query_params and query_params['url']:
            return unquote(query_params['url'][0])
            
        return ""
    except Exception:
        return ""

def join_url(base: str, relative: str) -> str:
    """
    ベースURLと相対URLを結合
    
    Args:
        base: ベースURL
        relative: 相対URL
        
    Returns:
        str: 結合されたURL
    """
    try:
        return urljoin(base, relative)
    except Exception:
        return relative

def get_content_type(headers: Dict[str, str]) -> str:
    """
    レスポンスヘッダーからコンテンツタイプを取得
    
    Args:
        headers: HTTPレスポンスヘッダー
        
    Returns:
        str: コンテンツタイプ（小文字）
    """
    content_type = headers.get('content-type', '')
    if ';' in content_type:
        content_type = content_type.split(';', 1)[0]
    return content_type.strip().lower()

def is_html(content_type: str) -> bool:
    """HTMLコンテンツかどうかを確認"""
    return content_type == 'text/html'

def is_css(content_type: str) -> bool:
    """CSSコンテンツかどうかを確認"""
    return content_type == 'text/css'

def is_javascript(content_type: str) -> bool:
    """JavaScriptコンテンツかどうかを確認"""
    return content_type in ['text/javascript', 'application/javascript', 'application/x-javascript']

def is_text(content_type: str) -> bool:
    """テキストベースのコンテンツかどうかを確認"""
    return content_type.startswith('text/') or is_javascript(content_type)

def get_domain(url: str) -> str:
    """
    URLからドメイン名を取得
    
    Args:
        url: 対象のURL
        
    Returns:
        str: ドメイン名
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        
        # ポート番号を削除
        if ':' in domain:
            domain = domain.split(':', 1)[0]
            
        return domain.lower()
    except Exception:
        return ""

def create_cache_key(url: str) -> str:
    """
    キャッシュのキーを生成
    
    Args:
        url: 対象のURL
        
    Returns:
        str: キャッシュキー
    """
    return f"cache:{url}"

# キャッシュエントリの型定義
CacheEntry = Dict[str, Any]

class SimpleCache:
    """シンプルなインメモリキャッシュ"""
    
    def __init__(self, expiry: int = 3600):
        """
        キャッシュの初期化
        
        Args:
            expiry: キャッシュの有効期限（秒）
        """
        self._cache: Dict[str, CacheEntry] = {}
        self.expiry = expiry
    
    def get(self, key: str) -> Optional[CacheEntry]:
        """
        キャッシュからデータを取得
        
        Args:
            key: キャッシュキー
            
        Returns:
            Optional[CacheEntry]: キャッシュされたデータ、または存在しない場合はNone
        """
        if key not in self._cache:
            return None
            
        entry = self._cache[key]
        
        # 有効期限切れかどうかを確認
        if time.time() > entry.get('expire_at', 0):
            self.delete(key)
            return None
            
        return entry.get('data')
    
    def set(self, key: str, data: Any, expiry: Optional[int] = None) -> None:
        """
        データをキャッシュに保存
        
        Args:
            key: キャッシュキー
            data: 保存するデータ
            expiry: カスタム有効期限（秒）
        """
        expire_at = time.time() + (expiry if expiry is not None else self.expiry)
        
        self._cache[key] = {
            'data': data,
            'expire_at': expire_at
        }
    
    def delete(self, key: str) -> bool:
        """
        キャッシュからデータを削除
        
        Args:
            key: キャッシュキー
            
        Returns:
            bool: 削除成功の場合はTrue
        """
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    def clear(self) -> None:
        """キャッシュをクリア"""
        self._cache.clear()
    
    def cleanup(self) -> int:
        """
        期限切れのキャッシュエントリを削除
        
        Returns:
            int: 削除されたエントリの数
        """
        now = time.time()
        expired_keys = [
            key for key, entry in self._cache.items()
            if now > entry.get('expire_at', 0)
        ]
        
        for key in expired_keys:
            self.delete(key)
            
        return len(expired_keys)

# グローバルキャッシュインスタンス
cache = SimpleCache()