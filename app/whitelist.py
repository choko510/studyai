"""
ドメインホワイトリスト管理モジュール
アクセス可能なドメインを制御
"""
import re
from typing import Set, List, Pattern
from urllib.parse import urlparse

from app.config import get_allowed_domains

class DomainWhitelist:
    """ドメインホワイトリストを管理するクラス"""
    
    def __init__(self):
        self._allowed_domains: Set[str] = set()
        self._patterns: List[Pattern] = []
        self.load_from_config()
    
    def load_from_config(self) -> None:
        """設定ファイルからドメインを読み込む"""
        self._allowed_domains = get_allowed_domains()
        self._compile_patterns()
    
    def _compile_patterns(self) -> None:
        """ワイルドカードパターンを正規表現にコンパイル"""
        self._patterns = []
        for domain in self._allowed_domains:
            # ワイルドカードドメイン（*.example.com）を正規表現に変換
            if domain.startswith('*.'):
                pattern = domain.replace('*.', r'(.*\.)?')
                pattern = pattern.replace('.', r'\.')
                self._patterns.append(re.compile(f'^{pattern}$'))
    
    def is_allowed(self, url: str) -> bool:
        """
        URLのドメインがホワイトリストに含まれているか確認
        
        Args:
            url: チェックするURL
            
        Returns:
            bool: 許可されている場合はTrue、そうでない場合はFalse
        """
        # 全ドメイン許可設定（ワイルドカード）
        if "*" in self._allowed_domains:
            return True
        if not self._allowed_domains:
            return True  # ホワイトリストが空の場合は全て許可
            
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            # ポート番号を削除
            if ':' in domain:
                domain = domain.split(':', 1)[0]
                
            # 完全一致チェック
            if domain in self._allowed_domains:
                return True
                
            # ワイルドカードパターンチェック
            for pattern in self._patterns:
                if pattern.match(domain):
                    return True
                    
            return False
            
        except Exception:
            return False
    
    def add_domain(self, domain: str) -> None:
        """
        ドメインをホワイトリストに追加
        
        Args:
            domain: 追加するドメイン
        """
        self._allowed_domains.add(domain.lower())
        self._compile_patterns()
    
    def remove_domain(self, domain: str) -> bool:
        """
        ドメインをホワイトリストから削除
        
        Args:
            domain: 削除するドメイン
            
        Returns:
            bool: 削除成功の場合はTrue、ドメインが見つからない場合はFalse
        """
        domain = domain.lower()
        if domain in self._allowed_domains:
            self._allowed_domains.remove(domain)
            self._compile_patterns()
            return True
        return False
    
    @property
    def domains(self) -> Set[str]:
        """現在許可されているドメインのセットを取得"""
        return self._allowed_domains.copy()

# シングルトンインスタンス
whitelist = DomainWhitelist()