"""
基本的なテストモジュール
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.whitelist import whitelist

# テストクライアント
client = TestClient(app)

def test_home_page():
    """ホームページが正常に表示されるかテスト"""
    response = client.get("/")
    assert response.status_code == 200
    assert "PyProxy" in response.text
    assert "Webプロキシサービス" in response.text

def test_health_check():
    """ヘルスチェックエンドポイントのテスト"""
    response = client.get("/health")
    assert response.status_code == 200
    assert "status" in response.json()
    assert response.json()["status"] == "ok"

def test_whitelist():
    """ホワイトリストのテスト"""
    # 現在の許可ドメインを一時的に保存
    original_domains = whitelist.domains.copy()
    
    try:
        # テスト用のドメインを追加
        whitelist.add_domain("example.com")
        
        # ドメインが存在するか確認
        assert "example.com" in whitelist.domains
        
        # ドメインの許可状態をチェック
        assert whitelist.is_allowed("https://example.com/page") == True
        assert whitelist.is_allowed("https://not-allowed.com/page") == False
        
        # ドメインを削除
        assert whitelist.remove_domain("example.com") == True
        assert "example.com" not in whitelist.domains
        
    finally:
        # 元のドメインリストを復元
        whitelist._allowed_domains = original_domains
        whitelist._compile_patterns()

def test_url_helpers():
    """URLヘルパー関数のテスト"""
    from app.utils.helpers import (
        is_valid_url, normalize_url, create_proxy_url,
        get_original_url, join_url
    )
    
    # 有効なURL
    assert is_valid_url("https://example.com") == True
    
    # 無効なURL
    assert is_valid_url("not-a-url") == False
    
    # URLの正規化
    assert normalize_url("example.com") == "https://example.com/"
    
    # プロキシURL生成
    proxy_url = create_proxy_url("https://example.com")
    assert "url=https%3A%2F%2Fexample.com" in proxy_url
    
    # オリジナルURLの取得
    original_url = get_original_url("/proxy?url=https%3A%2F%2Fexample.com")
    assert original_url == "https://example.com"
    
    # URLの結合
    joined_url = join_url("https://example.com", "/page")
    assert joined_url == "https://example.com/page"

def test_proxy_without_url():
    """URLなしでプロキシエンドポイントにアクセスした場合のリダイレクトテスト"""
    response = client.get("/proxy")
    assert response.status_code == 307  # 一時リダイレクト
    assert response.headers["location"] == "/"