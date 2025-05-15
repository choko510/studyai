#!/usr/bin/env python3
"""
PyProxy 実行スクリプト
FastAPIアプリケーションを起動
"""
import os
import uvicorn
from app.config import HOST, PORT, DEBUG

if __name__ == "__main__":
    # アプリケーションを起動
    print(f"PyProxy サーバーを起動しています... http://{HOST}:{PORT}")
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG
    )