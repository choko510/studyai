"""
設定管理モジュール
.envファイルとデフォルト値からアプリケーション設定を管理
"""
import os
from typing import List, Set, Optional
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv()

# デバッグモード
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")

# サーバー設定
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ドメインホワイトリスト
def get_allowed_domains() -> Set[str]:
    """
    ALLOWED_DOMAINSをセットとして取得
    """
    allowed = os.getenv("ALLOWED_DOMAINS", "")
    if not allowed:
        return set()  # デフォルトでは許可ドメインなし
    return {domain.strip() for domain in allowed.split(",")}

# キャッシュ設定
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "False").lower() in ("true", "1", "t")
CACHE_EXPIRY = int(os.getenv("CACHE_EXPIRY", "3600"))  # デフォルト：1時間（秒単位）

# HTTPクライアント設定
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "30"))  # リクエストのタイムアウト（秒）

# デフォルトのユーザーエージェント（偽装用）
DEFAULT_USER_AGENT = os.getenv(
    "DEFAULT_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
)

# フォワードされるヘッダー（安全に転送可能なHTTPヘッダー）
FORWARDED_HEADERS = {
    "accept", "accept-encoding", "accept-language", "cache-control",
    "content-length", "content-type", "if-modified-since", "if-none-match",
    "range", "referer"
}

# フィルターリストのパス
FILTERS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "filters")