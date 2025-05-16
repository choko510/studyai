"""
プロキシハンドラのメイン処理モジュール
FastAPIのエンドポイントとして機能
"""
from typing import Optional
from fastapi import Request, Response, HTTPException, Depends
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
import os

from app.utils.helpers import (
    is_valid_url, normalize_url, create_proxy_url, get_original_url,
    get_domain
)
from app.whitelist import whitelist
from app.proxy.request import forward_request
from app.proxy.response import (
    process_response, get_cached_response, create_response_from_cache
)
from app.config import CACHE_ENABLED

# テンプレートの設定
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

async def proxy_handler(request: Request, url: Optional[str] = None) -> Response:
    """
    プロキシリクエストを処理するメインハンドラ
    
    Args:
        request: FastAPIのリクエストオブジェクト
        url: プロキシ先のURL（クエリパラメータ）
        
    Returns:
        Response: プロキシレスポンス
    """
    # URLパラメータが指定されていない場合はホームページへリダイレクト
    if not url:
        return RedirectResponse(url="/")
    
    # URLを正規化
    target_url = normalize_url(url)
    
    # URLの有効性を確認
    if not is_valid_url(target_url):
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "status_code": 400,
                "detail": "無効なURLです"
            },
            status_code=400
        )
    
    # ドメインがホワイトリストに含まれているか確認
    domain = get_domain(target_url)
    if not whitelist.is_allowed(target_url):
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "status_code": 403,
                "detail": f"ドメイン '{domain}' へのアクセスは許可されていません"
            },
            status_code=403
        )
    
    try:
        # キャッシュからレスポンスを取得
        if CACHE_ENABLED:
            cached_data = await get_cached_response(target_url)
            if cached_data:
                return await create_response_from_cache(cached_data)
        
        # 外部サイトへリクエストを転送
        response, normalized_url = await forward_request(target_url, request)
        
        # レスポンスを処理して変換
        return await process_response(response, normalized_url)
    except HTTPException as exc:
        # エラーテンプレートを返す
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "status_code": exc.status_code,
                "detail": exc.detail
            },
            status_code=exc.status_code
        )
    except Exception as e:
        # 予期せぬエラー
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "status_code": 500,
                "detail": f"サーバーエラーが発生しました: {str(e)}"
            },
            status_code=500
        )

async def handle_form_submission(request: Request) -> Response:
    """
    フォーム送信からのURLリクエストを処理
    
    Args:
        request: FastAPIのリクエストオブジェクト
        
    Returns:
        Response: リダイレクトレスポンス
    """
    form_data = await request.form()
    url = form_data.get("url", "")
    
    if not url:
        return RedirectResponse(url="/")
    
    # URLを正規化して有効性を確認
    normalized_url = normalize_url(url)
    if not is_valid_url(normalized_url):
        raise HTTPException(status_code=400, detail="無効なURLです")
    
    # プロキシURLを作成してリダイレクト
    proxy_url = create_proxy_url(normalized_url)
    return RedirectResponse(url=proxy_url)

async def health_check() -> dict:
    """
    ヘルスチェックエンドポイント
    
    Returns:
        dict: サービスの状態情報
    """
    return {
        "status": "ok",
        "allowed_domains": list(whitelist.domains),
        "cache_enabled": CACHE_ENABLED
    }