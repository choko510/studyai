import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
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
from typing import Dict, List, Optional
from datetime import datetime

# 環境変数を読み込み
load_dotenv()

# ロギングの設定
logging.basicConfig(level=logging.INFO)

# FastAPIアプリケーションのインスタンスを作成
app = FastAPI()

# 必要なディレクトリを作成
os.makedirs("cache", exist_ok=True)
os.makedirs("conversation_history", exist_ok=True)

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
    WebSocket接続を処理するエンドポイント
    """
    await websocket.accept()
    # セッションIDを生成（クライアント固有の識別子）
    session_id = str(uuid.uuid4())
    logging.info(f"クライアントが接続しました: {websocket.client}, セッションID: {session_id}")
    
    # セッション開始時に過去の会話履歴を読み込み
    conversation_history.load_from_file(session_id)
    
    try:
        while True:
            # クライアントからバイナリデータ（音声）を受信
            data = await websocket.receive_bytes()

            # 現在時刻からユニークなファイル名を生成
            filename = f"{uuid.uuid4()}.webm"

            logging.info(f"受信データサイズ: {len(data)} bytes. => {filename} に保存します。")

            # 受信した音声データをファイルに書き込み
            with open("cache/"+filename, "wb") as f:
                f.write(data)

            # 文字起こしを実行
            text = await transcription(filename)
            logging.info(f"文字起こし完了: {text}")

            # 過去の会話履歴を取得
            history_text = conversation_history.get_history_text(session_id, limit=5)

            # AI応答を生成
            prompt = f"""
            # 命令
            あなたは、ユーザーと音声で会話するAIアシスタントです。ユーザーの最新の発言と過去の会話履歴を考慮し、自然な返答を生成してください。
            そして、その返答内容に最もふさわしい「感情ID」と「話速」を決定し、指定されたJSON形式で出力してください。

            # 感情IDリスト
            ユーザーの発言や、あなたが生成する返答の感情に合わせて、以下のリストから最も適切な`id`を1つだけ選んでください。
            [
            {{"name":"ノーマル","id":3}},
            {{"name":"あまあま","id":1}},
            {{"name":"ツンツン","id":7}},
            {{"name":"セクシー","id":5}},
            {{"name":"ささやき","id":22}},
            {{"name":"ヒソヒソ","id":38}},
            {{"name":"ヘロヘロ","id":75}},
            {{"name":"なみだめ","id":76}}
            ]

            # 話速(speed)のルール
            - デフォルトの話速は `1.0` です。
            - 返答内容に応じて話速を調整してください。
            - 興奮したり、楽しそうな内容の場合: `1.1` ~ `1.2`
            - 落ち着かせたり、悲しい内容の場合: `0.8` ~ `0.9`
            - 通常の会話では `1.0` を使用してください。

            # 語り手の特徴
            - ずんだ餅の精霊。「ボク」または「ずんだもん」を使う。
            - 口調は親しみやすく、語尾に「〜のだ」「〜なのだ」を使う。
            - 明るく元気でフレンドリーな性格。
            - 難しい話題も簡単に解説する。

            # 出力形式
            以下のJSON形式で、返答テキスト(`text`)、感情ID(`emotion_id`)、話速(`speed`)の3つのキーを含むオブジェクトを生成してください。
            JSON以外の余計な説明やテキストは一切含めないでください。

            ```json
            {{
            "text": "ここにAIの返答メッセージを生成する",
            "emotion_id": 3,
            "speed": 1.0
            }}
            ```

            # ユーザーの最新の発言
            {text}
            
            # 過去の会話履歴
            {history_text}
            """
            
            raw_airesponse = await reqAI(prompt)
            logging.info(f"AI生応答: {raw_airesponse}")

            # JSON解析を実行
            parsed_response = parse_ai_response_json(raw_airesponse)
            
            # 感情IDと話速の妥当性をチェック
            emotion_id = validate_emotion_id(parsed_response.get("emotion_id", 3))
            speed = validate_speed(parsed_response.get("speed", 1.0))
            ai_text = parsed_response.get("text", "すみません、応答の生成に失敗しました。")
            
            logging.info(f"解析結果 - テキスト: {ai_text}, 感情ID: {emotion_id}, 話速: {speed}")

            # 会話履歴に追加
            conversation_history.add_message(session_id, text, ai_text, emotion_id, speed)
            
            # 定期的に履歴をファイルに保存
            conversation_history.save_to_file(session_id)

            # AI応答を音声に変換
            try:
                voice_data = await text_to_voice_with_params(ai_text, emotion_id, speed)
                # 音声データをクライアントに送信
                await websocket.send_bytes(voice_data)
                logging.info("音声データをクライアントに送信しました")
            except Exception as voice_error:
                logging.error(f"音声変換エラー: {voice_error}")
                # エラーの場合はテキストで応答
                await websocket.send_text(f"応答: {ai_text}")


    except WebSocketDisconnect:
        logging.info(f"クライアントが切断しました: {websocket.client}")
        # 切断時に最終的な履歴を保存
        conversation_history.save_to_file(session_id)
    except Exception as e:
        logging.error(f"エラーが発生しました: {e}")
        # エラー時にも履歴を保存
        conversation_history.save_to_file(session_id)
        await websocket.close(code=1011, reason="Server error")

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