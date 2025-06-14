import torch
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from transformers import pipeline # transformersのpipelineをインポート
from gtts import gTTS
import io
import tempfile
import os
import json

# FastAPIアプリのインスタンス化
app = FastAPI()

# --- モデル読み込み部分の変更 ---

# GPUが利用可能かチェックし、デバイスとデータ型を設定
if torch.cuda.is_available():
    device = "cuda:0"
    torch_dtype = torch.float16
    print("GPU is available. Using CUDA.")
else:
    device = "cpu"
    torch_dtype = torch.float32
    print("GPU not available. Using CPU.")

# Hugging Faceのpipelineを使用してモデルをロード
print("Kotoba-Whisperモデルをロード中...")
pipe = pipeline(
    "automatic-speech-recognition",
    model="kotoba-tech/kotoba-whisper-v2.2",
    torch_dtype=torch_dtype,
    device=device,
)
print("Kotoba-Whisperモデルのロード完了。")

@app.websocket("/ws/speech")
async def websocket_speech_endpoint(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = io.BytesIO()
    
    try:
        while True:
            # クライアントから音声データ（バイナリ）を受け取る
            data = await websocket.receive_bytes()
            
            # 音声データをバッファに追加
            audio_buffer.write(data)
            
            # バッファのサイズが一定以上になったら処理
            if audio_buffer.tell() > 32768:  # 32KB以上
                try:
                    # バッファの内容を取得
                    audio_buffer.seek(0)
                    audio_data = audio_buffer.read()
                    
                    # 一時ファイルに保存
                    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
                        temp_file.write(audio_data)
                        temp_file_path = temp_file.name
                    
                    try:
                        # Whisperで音声認識
                        result = pipe(
                            temp_file_path,
                            generate_kwargs={"language": "japanese", "task": "transcribe"},
                        )
                        text = result.get("text", "").strip()
                        
                        # 結果が空でなく、意味のあるテキストであれば送信
                        if text and len(text) > 1:
                            print(f"認識結果: {text}")
                            response = {"text": text, "type": "transcript"}
                            await websocket.send_text(json.dumps(response))
                            
                    except Exception as model_error:
                        print(f"音声認識エラー: {model_error}")
                        error_response = {"error": f"音声認識に失敗しました: {str(model_error)}"}
                        await websocket.send_text(json.dumps(error_response))
                    
                    finally:
                        # 一時ファイルを削除
                        if os.path.exists(temp_file_path):
                            os.unlink(temp_file_path)
                    
                    # バッファをリセット
                    audio_buffer = io.BytesIO()
                    
                except Exception as processing_error:
                    print(f"データ処理エラー: {processing_error}")
                    # バッファをリセット
                    audio_buffer = io.BytesIO()

    except WebSocketDisconnect:
        print("クライアントが切断されました。")
    except Exception as e:
        print(f"WebSocketエラー: {e}")
        try:
            error_response = {"error": f"WebSocketエラー: {str(e)}"}
            await websocket.send_text(json.dumps(error_response))
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass

@app.post("/tts")
async def text_to_speech(text_input: dict):
    text = text_input.get("text")
    if not text:
        return {"error": "Text not provided"}

    try:
        tts = gTTS(text=text, lang='ja')
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return StreamingResponse(fp, media_type="audio/mpeg")
    except Exception as e:
        print(f"TTSエラー: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)