"""
プロキシリクエスト処理モジュール
外部サイトへのHTTPリクエストを管理
"""
from typing import Dict, Any, Optional, Tuple, Set, List
import httpx
from fastapi import Request, HTTPException

from app.config import DEFAULT_USER_AGENT, FORWARDED_HEADERS, HTTP_TIMEOUT
from app.whitelist import whitelist
from app.utils.helpers import is_valid_url, normalize_url, get_domain

async def forward_request(
    target_url: str, 
    client_request: Request,
    allowed_content_types: Optional[Set[str]] = None
) -> Tuple[httpx.Response, str]:
    """
    外部サイトへのHTTPリクエストを転送
    
    Args:
        target_url: プロキシ先のURL
        client_request: クライアントからのリクエスト
        allowed_content_types: 許可するコンテンツタイプのセット（Noneの場合は制限なし）
        
    Returns:
        Tuple[httpx.Response, str]: HTTPXのレスポンスオブジェクトと正規化されたURL
        
    Raises:
        HTTPException: ドメインが許可されていない、または他のエラーが発生した場合
    """
    # URLを正規化
    normalized_url = normalize_url(target_url)
    
    # URLの有効性を確認
    if not is_valid_url(normalized_url):
        raise HTTPException(status_code=400, detail="無効なURLです")
    
    # ドメインがホワイトリストに含まれているか確認
    domain = get_domain(normalized_url)
    if not whitelist.is_allowed(normalized_url):
        raise HTTPException(
            status_code=403, 
            detail=f"ドメイン '{domain}' へのアクセスは許可されていません"
        )
    
    # リクエストヘッダーを準備
    headers = await prepare_request_headers(client_request)
    
    # HTTPメソッドを取得
    method = client_request.method
    
    # リクエストのボディデータを取得
    data = await client_request.body() if method in ["POST", "PUT", "PATCH"] else None
    
    # クエリパラメータを取得
    params = dict(client_request.query_params)
    if "url" in params:
        del params["url"]  # プロキシのURLパラメータを削除
    
    try:
        # 非同期HTTPクライアントでリクエスト
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
            response = await client.request(
                method=method,
                url=normalized_url,
                headers=headers,
                data=data,
                params=params
            )
            
            # 特定のコンテンツタイプのみを許可する場合
            if allowed_content_types and response.headers.get("content-type"):
                content_type = response.headers["content-type"].split(";")[0].strip().lower()
                if content_type not in allowed_content_types:
                    raise HTTPException(
                        status_code=415, 
                        detail=f"コンテンツタイプ '{content_type}' は許可されていません"
                    )
            
            return response, normalized_url
            
    except httpx.RequestError as exc:
        # リクエストエラー（タイムアウト、接続エラーなど）
        raise HTTPException(
            status_code=502, 
            detail=f"外部サイトへのリクエストに失敗しました: {str(exc)}"
        )
    except httpx.HTTPStatusError as exc:
        # HTTPステータスエラー
        raise HTTPException(
            status_code=exc.response.status_code, 
            detail=f"外部サイトがエラーを返しました: {exc.response.status_code}"
        )
    except Exception as exc:
        # その他のエラー
        raise HTTPException(
            status_code=500, 
            detail=f"リクエスト処理中にエラーが発生しました: {str(exc)}"
        )

async def prepare_request_headers(client_request: Request) -> Dict[str, str]:
    """
    外部サイトへのリクエスト用のヘッダーを準備
    
    Args:
        client_request: クライアントからのリクエスト
        
    Returns:
        Dict[str, str]: 転送用のヘッダー
    """
    # 基本ヘッダーを設定
    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "*/*",
    }
    
    # クライアントヘッダーから転送可能なヘッダーをコピー
    for name, value in client_request.headers.items():
        name_lower = name.lower()
        if name_lower in FORWARDED_HEADERS:
            headers[name] = value
    
    # 特別なヘッダーを設定
    if "x-forwarded-for" in client_request.headers:
        headers["X-Forwarded-For"] = client_request.headers["x-forwarded-for"]
        
    # 言語設定があれば転送
    if "accept-language" in client_request.headers:
        headers["Accept-Language"] = client_request.headers["accept-language"]
    
    return headers