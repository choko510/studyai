import aiohttp
from typing import Optional, Dict, List
import json

class VoiceVoxAPI:
    """VOICEVOX APIクライアントクラス"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://deprecatedapis.tts.quest/v2/voicevox"
        self.audio_endpoint = f"{self.base_url}/audio/"
        self.speakers_endpoint = f"{self.base_url}/speakers/"
        self.api_info_endpoint = "https://deprecatedapis.tts.quest/v2/api/"
    
    async def text_to_speech(
        self,
        text: str,
        speaker: int = 3,
        pitch: float = 0,
        intonation_scale: float = 1,
        speed: float = 1
    ) -> bytes:
        """
        テキストを音声に変換する
        
        Args:
            text: 読み上げるテキスト
            speaker: 話者ID（デフォルト: 3）
            pitch: ピッチ（デフォルト: 0）
            intonation_scale: イントネーション（デフォルト: 1）
            speed: 話速（デフォルト: 1）
            
        Returns:
            音声データのバイト列
            
        Raises:
            Exception: API呼び出しに失敗した場合
        """
        params = {
            'text': text,
            'key': self.api_key,
            'speaker': speaker,
            'pitch': pitch,
            'intonationScale': intonation_scale,
            'speed': speed
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.audio_endpoint, params=params) as response:
                if response.status == 200:
                    content_type = response.headers.get('Content-Type', '')
                    if 'audio' in content_type:
                        return await response.read()
                    else:
                        # エラーレスポンスの場合
                        error_text = await response.text()
                        raise Exception(f"API Error: {error_text}")
                else:
                    error_text = await response.text()
                    raise Exception(f"HTTP {response.status}: {error_text}")
    
    async def get_speakers(self) -> List[Dict]:
        """
        利用可能な話者一覧を取得する
        
        Returns:
            話者情報のリスト
        """
        async with aiohttp.ClientSession() as session:
            async with session.get(self.speakers_endpoint) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise Exception(f"HTTP {response.status}: {error_text}")
    
    async def get_api_info(self) -> Dict:
        """
        API情報（残りポイントなど）を取得する
        
        Returns:
            API情報の辞書
        """
        params = {'key': self.api_key}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.api_info_endpoint, params=params) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise Exception(f"HTTP {response.status}: {error_text}")
    
    def calculate_points(self, text: str) -> int:
        """
        テキストの消費ポイントを計算する
        計算式: 1500 + 100 * (UTF-8文字数)
        
        Args:
            text: 計算対象のテキスト
            
        Returns:
            消費ポイント数
        """
        utf8_length = len(text.encode('utf-8'))
        return 1500 + 100 * utf8_length


# 互換性のための関数（既存コードとの互換性を保つため）
async def voicevox_tts(
    text: str,
    speaker_id: int = 0,
    api_key: str = "H_5-f3635_q6697",
    speed: float = 1.0,
    pitch: float = 0,
    intonation_scale: float = 1
) -> bytes:
    """
    VoiceVox TTSを使用してテキストを音声に変換する非同期関数
    
    Args:
        text: 音声に変換するテキスト
        speaker_id: 使用するスピーカーのID（デフォルトは0）
        api_key: APIキー
        speed: 話速（デフォルトは1.0）
        pitch: ピッチ（デフォルトは0）
        intonation_scale: イントネーション（デフォルトは1）
        
    Returns:
        音声データのバイト列
    """
    api = VoiceVoxAPI(api_key)
    return await api.text_to_speech(
        text,
        speaker=speaker_id,
        speed=speed,
        pitch=pitch,
        intonation_scale=intonation_scale
    )