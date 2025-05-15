"""
プロキシレスポンス処理モジュール
外部サイトからのレスポンスを処理して変換
"""
from typing import Dict, Any, Optional, Tuple, Union, List
import httpx
from fastapi import Response
from fastapi.responses import HTMLResponse, PlainTextResponse, StreamingResponse

from app.config import CACHE_ENABLED
from app.utils.helpers import (
    get_content_type, is_html, is_css, is_javascript, is_text,
    create_cache_key, cache, CacheEntry
)

# キャッシュに保存するヘッダー
CACHEABLE_HEADERS = {
    'content-type', 'content-language', 'content-encoding',
    'cache-control', 'expires', 'last-modified', 'etag'
}

async def process_response(
    response: httpx.Response,
    target_url: str,
    should_transform: bool = True
) -> Response:
    """
    外部サイトからのレスポンスを処理
    
    Args:
        response: 外部サイトからのHTTPレスポンス
        target_url: リクエスト先のURL
        should_transform: コンテンツを変換するかどうか
        
    Returns:
        Response: FastAPIのレスポンスオブジェクト
    """
    # ステータスコード
    status_code = response.status_code
    
    # レスポンスヘッダー
    headers = dict(response.headers)
    # 不要なエンコーディング・長さヘッダーを削除
    if should_transform:
        headers = {k: v for k, v in headers.items() if k.lower() not in ("content-encoding","content-length")}
    
    # コンテンツタイプを取得
    content_type = get_content_type(headers)
    
    # キャッシュが有効な場合、レスポンスをキャッシュに保存
    if CACHE_ENABLED and should_transform and status_code == 200:
        await cache_response(target_url, response)
    
    # コンテンツの変換が必要なければそのまま返す
    if not should_transform:
        return create_fastapi_response(response.content, status_code, headers)
    
    # コンテンツタイプに応じて処理
    if is_html(content_type):
        from app.transformers.html import transform_html
        transformed_content = await transform_html(response.content, target_url)
        return HTMLResponse(content=transformed_content, status_code=status_code, headers=headers)
        
    elif is_javascript(content_type):
        from app.transformers.javascript import transform_javascript
        transformed_content = await transform_javascript(response.content, target_url)
        return PlainTextResponse(content=transformed_content, status_code=status_code, headers=headers)
        
    elif is_css(content_type):
        from app.transformers.css import transform_css
        transformed_content = await transform_css(response.content, target_url)
        return PlainTextResponse(content=transformed_content, status_code=status_code, headers=headers)
        
    elif is_text(content_type):
        # その他のテキストベースのコンテンツは文字エンコーディングを処理
        return PlainTextResponse(content=response.text, status_code=status_code, headers=headers)
        
    else:
        # その他のコンテンツタイプ（画像、動画など）はそのまま返す
        return create_fastapi_response(response.content, status_code, headers)

def create_fastapi_response(
    content: bytes,
    status_code: int,
    headers: Dict[str, str]
) -> Response:
    """
    FastAPIのレスポンスオブジェクトを作成
    
    Args:
        content: レスポンスの内容
        status_code: HTTPステータスコード
        headers: HTTPヘッダー
        
    Returns:
        Response: FastAPIのレスポンスオブジェクト
    """
    # 不要なエンコーディング・長さ・転送ヘッダーを削除
    headers = {k: v for k, v in headers.items() if k.lower() not in ("content-encoding","content-length","transfer-encoding")}
    return Response(
        content=content,
        status_code=status_code,
        headers=headers,
        media_type=headers.get('content-type', 'application/octet-stream')
    )

async def cache_response(url: str, response: httpx.Response) -> None:
    """
    レスポンスをキャッシュに保存
    
    Args:
        url: リクエスト元のURL
        response: 外部サイトからのHTTPレスポンス
    """
    cache_key = create_cache_key(url)
    
    # キャッシュに保存するヘッダーをフィルタリング
    cached_headers = {
        k: v for k, v in response.headers.items()
        if k.lower() in CACHEABLE_HEADERS
    }
    
    # キャッシュに保存するデータ
    cache_data = {
        'content': response.content,
        'status_code': response.status_code,
        'headers': cached_headers
    }
    
    # キャッシュに保存
    cache.set(cache_key, cache_data)

async def get_cached_response(url: str) -> Optional[CacheEntry]:
    """
    URLに対応するキャッシュされたレスポンスを取得
    
    Args:
        url: リクエスト元のURL
        
    Returns:
        Optional[CacheEntry]: キャッシュされたデータ、または存在しない場合はNone
    """
    if not CACHE_ENABLED:
        return None
        
    cache_key = create_cache_key(url)
    return cache.get(cache_key)

async def create_response_from_cache(cache_data: CacheEntry) -> Response:
    """
    キャッシュデータからFastAPIのレスポンスを作成
    
    Args:
        cache_data: キャッシュされたデータ
        
    Returns:
        Response: FastAPIのレスポンスオブジェクト
    """
    return create_fastapi_response(
        content=cache_data['content'],
        status_code=cache_data['status_code'],
        headers=cache_data['headers']
    )