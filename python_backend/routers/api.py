# In python_backend/routers/api.py
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request
from fastapi.responses import StreamingResponse
import google.generativeai as genai
import os
import config # To access GEMINI_API_KEY
from typing import Optional # Added for Optional

router = APIRouter()

# Configure the Gemini API key
if config.GEMINI_API_KEY and config.GEMINI_API_KEY != "YOUR_GEMINI_API_KEY_HERE":
    genai.configure(api_key=config.GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY is not configured or is set to placeholder. /api/aireq will not work.")
    # Optionally, you could disable the endpoint if the key is missing,
    # but for now, it will try and likely fail at runtime if key is bad.

@router.post("/api/aireq")
async def analyze_image_stream(
    request: Request, # Added request to check headers later if needed
    image: UploadFile = File(...),
    prompt: Optional[str] = Form(None) # Optional prompt from form data
):
    if not genai.api_key:
         raise HTTPException(status_code=500, detail="Gemini API key not configured on server.")

    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only images are allowed.")

    # Default prompt if not provided
    user_prompt = prompt if prompt else "この画像について詳しく説明してください" # "Please describe this image in detail."

    try:
        image_bytes = await image.read()

        # Prepare the image data for the Gemini API
        image_parts = [
            {
                "mime_type": image.content_type,
                "data": image_bytes
            }
        ]

        # Initialize the model - using gemini-pro-vision as it's common for image inputs
        # The original Node.js used "gemini-pro-vision". Let's ensure we use a compatible or current one.
        # The node version used "gemini-1.5-flash"
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")

        # Prepare content for streaming
        # The new API for `generate_content_stream` takes a list of parts.
        # A simple string prompt and image parts should be passed in a list.
        content_parts = [user_prompt, image_parts[0]]


        async def stream_generator():
            try:
                stream = await model.generate_content_async(content_parts, stream=True)
                async for chunk in stream:
                    if chunk.text:
                        yield chunk.text
            except Exception as e:
                # This error will be caught by the outer try-except,
                # but good to log it here if needed during generation.
                print(f"Error during Gemini content generation stream: {e}")
                # Yield an error message to the client if stream already started
                yield f"\n\n[エラー: 画像解析中に問題が発生しました: {str(e)}]"
                # No need to raise here as it might be hard to catch by FastAPI after stream starts

        # Check if client accepts text/plain for streaming (optional, but good practice)
        # accept_header = request.headers.get("accept", "")

        return StreamingResponse(stream_generator(), media_type="text/plain; charset=utf-8")

    except genai.types.generation_types.BlockedPromptException as e:
        print(f"Gemini API request blocked: {e}")
        raise HTTPException(status_code=400, detail=f"Request blocked by API: {e}")
    except Exception as e:
        print(f"Error in /api/aireq: {e}")
        # Ensure we don't try to send a JSON response if streaming headers were already sent
        # However, StreamingResponse itself handles this. If stream_generator fails early,
        # StreamingResponse might send a 500.
        raise HTTPException(status_code=500, detail=f"An error occurred during image analysis: {str(e)}")
