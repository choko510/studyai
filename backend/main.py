import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import uuid
from faster_whisper import WhisperModel
import os
from PIL import Image
import aiohttp
import google.generativeai as genai
from voicevox import voicevox_tts
from dotenv import load_dotenv
import json
from typing import Dict, List
from datetime import datetime
import asyncio

# 環境変数を読み込み
load_dotenv()

# ロギングの設定
logging.basicConfig(level=logging.INFO)

# FastAPIアプリケーションのインスタンスを作成
app = FastAPI()

# 必要なディレクトリを作成
os.makedirs("cache", exist_ok=True)
os.makedirs("conversation_history", exist_ok=True)

# グローバルなWhisperモデルインスタンス（初回読み込み時間を削減）
_whisper_model = None
_whisper_device = None
_whisper_compute_type = None

def get_whisper_model():
    """Whisperモデルのシングルトンインスタンスを取得"""
    global _whisper_model, _whisper_device, _whisper_compute_type
    
    if _whisper_model is None:
        # GPU利用可能性をチェック
        try:
            import torch
            if torch.cuda.is_available():
                device = "cuda"
                compute_type = "float16"
                logging.info("CUDA GPU が利用可能です。GPUを使用して音声認識を実行します。")
            else:
                device = "cpu"
                compute_type = "int8"
                logging.info("GPU が利用できません。CPUを使用して音声認識を実行します。")
        except ImportError:
            device = "cpu"
            compute_type = "int8"
            logging.info("PyTorch が見つかりません。CPUを使用して音声認識を実行します。")
        
        _whisper_model = WhisperModel("base", device=device, compute_type=compute_type)
        _whisper_device = device
        _whisper_compute_type = compute_type
        logging.info(f"Whisperモデルを初期化しました (デバイス: {device}, compute_type: {compute_type})")
    
    return _whisper_model, _whisper_device, _whisper_compute_type

# 会話履歴を保存するクラス
class ConversationHistory:
    def __init__(self):
        self.conversations: Dict[str, List[Dict]] = {}
    
    def add_message(self, session_id: str, user_message: str, ai_response: str, emotion_id: int = 3, speed: float = 1.0):
        """会話履歴にメッセージを追加"""
        if session_id not in self.conversations:
            self.conversations[session_id] = []
        
        message_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_message": user_message,
            "ai_response": ai_response,
            "emotion_id": emotion_id,
            "speed": speed
        }
        
        self.conversations[session_id].append(message_entry)
        
        # 会話履歴が長くなりすぎた場合は古いものを削除（最新20件まで保持）
        if len(self.conversations[session_id]) > 20:
            self.conversations[session_id] = self.conversations[session_id][-20:]
    
    def get_history(self, session_id: str, limit: int = 10) -> List[Dict]:
        """指定されたセッションの履歴を取得"""
        if session_id not in self.conversations:
            return []
        return self.conversations[session_id][-limit:]
    
    def get_history_text(self, session_id: str, limit: int = 5) -> str:
        """履歴をテキスト形式で取得（プロンプトに挿入用）"""
        history = self.get_history(session_id, limit)
        if not history:
            return "（過去の会話履歴はありません）"
        
        history_text = ""
        for entry in history:
            history_text += f"ユーザー: {entry['user_message']}\n"
            history_text += f"AI: {entry['ai_response']}\n"
            history_text += "---\n"
        
        return history_text
    
    def save_to_file(self, session_id: str):
        """会話履歴をファイルに保存"""
        if session_id in self.conversations:
            filename = f"conversation_history/{session_id}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.conversations[session_id], f, ensure_ascii=False, indent=2)
    
    def load_from_file(self, session_id: str):
        """ファイルから会話履歴を読み込み"""
        filename = f"conversation_history/{session_id}.json"
        if os.path.exists(filename):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    self.conversations[session_id] = json.load(f)
            except Exception as e:
                logging.error(f"会話履歴の読み込みエラー: {e}")

# 会話履歴管理インスタンス
conversation_history = ConversationHistory()

def parse_ai_response_json(response_text: str) -> Dict:
    """AI応答からJSONを解析する関数"""
    try:
        # JSONブロックを探す
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start == -1 or json_end == 0:
            # JSONが見つからない場合はデフォルト値を返す
            return {
                "text": response_text.strip(),
                "emotion_id": 3,
                "speed": 1.0
            }
        
        json_str = response_text[json_start:json_end]
        parsed_json = json.loads(json_str)
        
        # 必要なキーが存在するかチェック
        if "text" not in parsed_json:
            parsed_json["text"] = response_text.strip()
        if "emotion_id" not in parsed_json:
            parsed_json["emotion_id"] = 3
        if "speed" not in parsed_json:
            parsed_json["speed"] = 1.0
            
        return parsed_json
        
    except json.JSONDecodeError as e:
        logging.error(f"JSON解析エラー: {e}")
        # JSONの解析に失敗した場合はデフォルト値を返す
        return {
            "text": response_text.strip(),
            "emotion_id": 3,
            "speed": 1.0
        }
    except Exception as e:
        logging.error(f"AI応答解析エラー: {e}")
        return {
            "text": response_text.strip(),
            "emotion_id": 3,
            "speed": 1.0
        }

def validate_emotion_id(emotion_id: int) -> int:
    """感情IDの妥当性をチェックし、無効な場合はデフォルト値を返す"""
    valid_emotions = [3, 1, 7, 5, 22, 38, 75, 76]
    return emotion_id if emotion_id in valid_emotions else 3

def validate_speed(speed: float) -> float:
    """話速の妥当性をチェックし、無効な場合はデフォルト値を返す"""
    return max(0.5, min(2.0, speed)) if isinstance(speed, (int, float)) else 1.0

# Gemini APIキーの設定（環境変数から取得）
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
else:
    logging.warning("GEMINI_API_KEY環境変数が設定されていません")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket接続を処理するエンドポイント（高速化版）
    """
    await websocket.accept()
    # セッションIDを生成（クライアント固有の識別子）
    session_id = str(uuid.uuid4())
    logging.info(f"クライアントが接続しました: {websocket.client}, セッションID: {session_id}")
    
    # セッション開始時に過去の会話履歴を読み込み
    conversation_history.load_from_file(session_id)
    
    # Whisperモデルを事前に初期化（接続時に一度だけ）
    get_whisper_model()
    
    try:
        while True:
            # クライアントからバイナリデータ（音声）を受信
            data = await websocket.receive_bytes()

            # 現在時刻からユニークなファイル名を生成
            filename = f"{uuid.uuid4()}.webm"

            logging.info(f"受信データサイズ: {len(data)} bytes. => {filename} に保存します。")

            # 非同期でファイル書き込み
            def write_file():
                with open("cache/"+filename, "wb") as f:
                    f.write(data)
            
            # ファイル書き込みと文字起こしを並列実行
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, write_file)

            # 文字起こし、AI応答生成、音声合成を並列化
            transcription_task = asyncio.create_task(transcription(filename))
            
            # 文字起こし結果を待機
            text = await transcription_task
            logging.info(f"文字起こし完了: {text}")

            # 過去の会話履歴を取得
            history_text = conversation_history.get_history_text(session_id, limit=3)  # 履歴を3件に削減

            # 簡潔なプロンプトで高速化
            prompt = f"""あなたはずんだもんです。以下のJSON形式で返答してください：
            {{"text": "返答メッセージ（〜のだ口調）", "emotion_id": 3, "speed": 1.0}}

            ユーザー: {text}
            履歴: {history_text}"""
            
            # AI応答と音声変換を並列実行するためのタスクを準備
            ai_task = asyncio.create_task(reqAI(prompt))
            
            raw_airesponse = await ai_task
            logging.info(f"AI生応答: {raw_airesponse}")

            # JSON解析を実行
            parsed_response = parse_ai_response_json(raw_airesponse)
            
            # 感情IDと話速の妥当性をチェック
            emotion_id = validate_emotion_id(parsed_response.get("emotion_id", 3))
            speed = validate_speed(parsed_response.get("speed", 1.0))
            ai_text = parsed_response.get("text", "すみません、応答の生成に失敗しました。")
            
            logging.info(f"解析結果 - テキスト: {ai_text}, 感情ID: {emotion_id}, 話速: {speed}")

            # 会話履歴に追加（非同期）
            conversation_history.add_message(session_id, text, ai_text, emotion_id, speed)
            
            # 音声変換と履歴保存を並列実行
            voice_task = asyncio.create_task(text_to_voice_with_params(ai_text, emotion_id, speed))
            save_task = asyncio.create_task(asyncio.to_thread(conversation_history.save_to_file, session_id))
            
            try:
                voice_data = await voice_task
                # 音声データをクライアントに送信
                await websocket.send_bytes(voice_data)
                logging.info("音声データをクライアントに送信しました")
                
                # 履歴保存の完了を待機（バックグラウンド）
                await save_task
            except Exception as voice_error:
                logging.error(f"音声変換エラー: {voice_error}")
                # エラーの場合はテキストで応答
                await websocket.send_text(f"応答: {ai_text}")
                await save_task  # 履歴保存は継続

            # ファイルクリーンアップ（非同期）
            asyncio.create_task(asyncio.to_thread(cleanup_file, filename))

    except WebSocketDisconnect:
        logging.info(f"クライアントが切断しました: {websocket.client}")
        # 切断時に最終的な履歴を保存
        conversation_history.save_to_file(session_id)
    except Exception as e:
        logging.error(f"エラーが発生しました: {e}")
        # エラー時にも履歴を保存
        conversation_history.save_to_file(session_id)
        await websocket.close(code=1011, reason="Server error")

def cleanup_file(filename: str):
    """一時ファイルを削除する関数"""
    try:
        if os.path.exists("cache/" + filename):
            os.remove("cache/" + filename)
            logging.info(f"一時ファイルを削除しました: {filename}")
    except Exception as e:
        logging.warning(f"ファイル削除エラー: {e}")

async def transcription(filename: str):
    """ 音声ファイルの文字起こしを行う関数（faster-whisper対応版）
    """
    try:
        # GPU利用可能性をチェック
        try:
            import torch
            if torch.cuda.is_available():
                device = "cuda"
                compute_type = "float16"  # GPUの場合はfloat16で高速化
                usemodel = "large-v3-turbo"
                logging.info("CUDA GPU が利用可能です。GPUを使用して音声認識を実行します。")
            else:
                device = "cpu"
                compute_type = "int8"  # CPUの場合はint8で軽量化
                usemodel = "base"
                logging.info("GPU が利用できません。CPUを使用して音声認識を実行します。")
        except ImportError:
            # torchがインストールされていない場合はCPUを使用
            device = "cpu"
            compute_type = "int8"
            usemodel = "base"
            logging.info("PyTorch が見つかりません。CPUを使用して音声認識を実行します。")
        
        # faster-whisperを使用
        model = WhisperModel(usemodel, device=device, compute_type=compute_type)
        segments, info = model.transcribe("cache/" + filename, beam_size=5, language="ja")
        
        # セグメントからテキストを結合
        transcribed_text = ""
        for segment in segments:
            transcribed_text += segment.text
        
        logging.info(f"文字起こし結果 (デバイス: {device}): {transcribed_text}")
        return transcribed_text.strip()
    except Exception as e:
        logging.error(f"音声認識エラー: {e}")
        return "音声認識に失敗しました"

async def reqAI(prompt: str, model: str = "gemini-2.0-flash", images=None):
    """
    AIモデルにテキスト生成リクエストを送信する非同期関数

    Parameters:
    - prompt: 送信するプロンプト文字列
    - model: 使用するモデル名（デフォルト: gemini-2.0-flash）
    - images: 単一の画像または画像リスト（PIL.Image.Image型または画像のパス）

    Returns:
    - 生成されたテキスト
    
    Raises:
    - Exception: 両方のAIプロバイダでリクエストが失敗した場合
    """
    # 入力の準備
    input_contents = []
    if prompt:
        input_contents.append(prompt)
    
    if images:
        if not isinstance(images, list):
            images = [images]
        
        for img in images:
            if isinstance(img, str) and os.path.exists(img):
                img = Image.open(img)
            
            if img:
                input_contents.append(img)
    
    # 1. まずGeminiでの生成を試みる
    try:
        gemini_model = genai.GenerativeModel(model)
        response = await gemini_model.generate_content_async(input_contents)
        return response.text
    except Exception as gemini_error:
        # Gemini失敗の詳細をログ出力
        print(f"Gemini request failed: {str(gemini_error)}")
        
        # 画像が含まれている場合はフォールバックできないので直接エラーを返す
        if images:
            raise Exception(f"Gemini request with images failed: {str(gemini_error)}")
        
        # 2. テキストのみの場合のフォールバック: OpenRouterを使用
        api_key = os.getenv("OPENROUTER_APIKEY")
        if not api_key:
            raise Exception(f"Gemini request failed and OpenRouter API key is not set")
            
        # OpenRouterへのリクエスト
        try:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}"}
            payload = {
                "model": "deepseek/deepseek-chat-v3-0324:free",
                "messages": [{"role": "user", "content": prompt}]
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"OpenRouter HTTP error {response.status}: {error_text}")
                        
                    result = await response.json()
                    return result["choices"][0]["message"]["content"]
        except Exception as openrouter_error:
            # 両方の方法が失敗した場合は詳細なエラーメッセージで例外を発生
            raise Exception(f"AI generation failed: Gemini error: {str(gemini_error)}; OpenRouter error: {str(openrouter_error)}")

async def text_to_voice(text: str):
    """ テキストを音声に変換する関数（後方互換性のため残す）"""
    try:
        # VoiceVox APIを使用してテキストを音声に変換
        voice_data = await voicevox_tts(text, speaker_id=0)
        return voice_data
    except Exception as e:
        logging.error(f"音声合成エラー: {e}")
        raise e

async def text_to_voice_with_params(text: str, emotion_id: int = 3, speed: float = 1.0):
    """ テキストを音声に変換する関数（感情ID・話速対応版）"""
    try:
        # 感情IDをVOICEVOXのspeaker_idにマッピング
        # ここでは簡単な例として、いくつかの感情IDを異なるspeaker_idにマッピング
        speaker_id_map = {
            3: 3,   # ノーマル -> ずんだもん（ノーマル）
            1: 1,   # あまあま -> ずんだもん（あまあま）
            7: 7,   # ツンツン -> ずんだもん（ツンツン）
            5: 5,   # セクシー -> ずんだもん（セクシー）
            22: 22, # ささやき -> ずんだもん（ささやき）
            38: 38, # ヒソヒソ -> ずんだもん（ヒソヒソ）
            75: 75, # ヘロヘロ -> ずんだもん（ヘロヘロ）
            76: 76  # なみだめ -> ずんだもん（なみだめ）
        }
        
        # speaker_idを決定（マッピングに存在しない場合はデフォルトの3を使用）
        speaker_id = speaker_id_map.get(emotion_id, 3)
        
        logging.info(f"音声合成パラメータ - テキスト: '{text}', speaker_id: {speaker_id}, 速度: {speed}")
        
        # VoiceVox APIを使用してテキストを音声に変換
        voice_data = await voicevox_tts(text, speaker_id=speaker_id, speed=speed)
        return voice_data
    except Exception as e:
        logging.error(f"音声合成エラー: {e}")
        raise e

if __name__ == "__main__":
    """
    このスクリプトを直接実行したときにサーバーを起動する
    例: python main.py
    """
    # サーバーを localhost:8000 で起動
    uvicorn.run(app, host="localhost", port=8000)