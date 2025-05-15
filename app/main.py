"""
メインアプリケーションモジュール
FastAPIアプリケーションのエントリーポイント
"""
import os
from typing import Optional
from fastapi import FastAPI, Request, Depends, HTTPException, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

from app.config import DEBUG, HOST, PORT
from app.proxy.handler import proxy_handler, handle_form_submission, health_check
from app.whitelist import whitelist

# FastAPIアプリケーションの作成
app = FastAPI(
    title="PyProxy",
    description="FastAPIベースのWebプロキシサーバー",
    version="0.1.0",
    debug=DEBUG
)

# テンプレートと静的ファイルのパスを設定
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """
    ホームページ
    """
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "allowed_domains": whitelist.domains
        }
    )

@app.post("/submit")
async def submit_url(request: Request):
    """
    URL提出フォーム処理
    """
    return await handle_form_submission(request)

@app.get("/proxy")
async def proxy(request: Request, url: Optional[str] = None):
    """
    プロキシエンドポイント
    URLパラメータで指定されたWebサイトにアクセスしてコンテンツを取得
    """
    return await proxy_handler(request, url)

@app.get("/health")
async def health():
    """
    ヘルスチェックエンドポイント
    """
    return await health_check()

@app.exception_handler(404)
async def not_found_exception_handler(request: Request, exc: HTTPException):
    """
    404エラーハンドラ
    """
    return templates.TemplateResponse(
        "error.html",
        {
            "request": request,
            "status_code": 404,
            "detail": "ページが見つかりません"
        },
        status_code=404
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    グローバルエラーハンドラ
    """
    status_code = 500
    detail = "サーバーエラーが発生しました"
    
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = exc.detail
    
    return templates.TemplateResponse(
        "error.html",
        {
            "request": request,
            "status_code": status_code,
            "detail": detail
        },
        status_code=status_code
    )

# アプリケーションを直接実行した場合
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG
    )