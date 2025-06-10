# In python_backend/routers/assets.py
from fastapi import APIRouter, Request, HTTPException, Response
import httpx
import mimetypes # For Python's built-in mime types
import os
import time

router = APIRouter()

# Cache setup
# For a production app, consider more robust caching like Redis, Memcached, or diskcache.
# For simplicity, using a dictionary-based in-memory cache similar to Node.js version.
CACHE = {}
CACHE_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 days in seconds

# Define base URLs as in the Node.js version
BASE_URLS = {
    "/e/1/": "https://raw.githubusercontent.com/qrs/x/fixy/",
    "/e/2/": "https://raw.githubusercontent.com/3v1/V5-Assets/main/",
    "/e/3/": "https://raw.githubusercontent.com/3v1/V5-Retro/master/",
}

@router.get("/e/{path:path}")
async def get_external_asset(request: Request, path: str):
    # Construct the full request path key for caching, e.g., /e/1/some/asset.js
    cache_key = f"/e/{path}"

    # Check cache first
    if cache_key in CACHE:
        cached_item = CACHE[cache_key]
        if time.time() - cached_item['timestamp'] < CACHE_TTL_SECONDS:
            print(f"Cache HIT for: {cache_key}")
            return Response(content=cached_item['data'], media_type=cached_item['content_type'])
        else:
            print(f"Cache EXPIRED for: {cache_key}")
            del CACHE[cache_key] # Remove expired item

    print(f"Cache MISS for: {cache_key}, attempting to fetch.")

    req_target_url = None
    # Determine the target URL based on the prefix
    # The incoming path from FastAPI under /e/ will be like "1/some/asset.js"
    # So, we need to prepend "/e/" to match keys in BASE_URLS or adjust matching logic.

    # Let's adjust path to include the /e/ prefix for matching BASE_URLS keys
    request_path_prefix_segment = f"/e/{path.split('/')[0]}/" # e.g. /e/1/

    for prefix, base_url in BASE_URLS.items():
        if request_path_prefix_segment == prefix:
            # The actual resource path is the part of 'path' after the first segment (e.g., "1")
            resource_actual_path = '/'.join(path.split('/')[1:])
            req_target_url = base_url + resource_actual_path
            break

    if not req_target_url:
        raise HTTPException(status_code=404, detail="Asset prefix not mapped or path is invalid")

    async with httpx.AsyncClient() as client:
        try:
            print(f"Fetching external asset: {req_target_url}")
            response = await client.get(req_target_url)
            response.raise_for_status() # Raise an exception for 4XX/5XX responses
        except httpx.HTTPStatusError as exc:
            print(f"Error fetching asset {req_target_url}: {exc.response.status_code}")
            raise HTTPException(status_code=exc.response.status_code, detail=f"Error fetching asset: {exc.response.text}")
        except httpx.RequestError as exc:
            print(f"Request error for asset {req_target_url}: {exc}")
            raise HTTPException(status_code=500, detail=f"Error fetching asset: {str(exc)}")

    data = await response.aread()

    # Determine content type
    # path_ext = os.path.splitext(req_target_url)[1] # Get extension like .js, .css
    # The original node.js code used `mime.getType(ext)` and had special handling for .unityweb
    # Python's mimetypes might behave differently or need explicit mapping for some types.
    content_type, _ = mimetypes.guess_type(req_target_url)
    if not content_type:
        # Fallback if mime type can't be guessed (e.g. for .unityweb)
        # The original code used "application/octet-stream" for .unityweb and similar extensions
        # We can replicate this if needed, or rely on a more comprehensive mime library if mimetypes is insufficient.
        path_ext = os.path.splitext(req_target_url)[1].lower()
        if path_ext == ".unityweb":
            content_type = "application/octet-stream"
        else:
            content_type = "application/octet-stream" # Default fallback

    # Store in cache
    CACHE[cache_key] = {
        'data': data,
        'content_type': content_type,
        'timestamp': time.time()
    }
    print(f"Cached and serving: {cache_key} with Content-Type: {content_type}")
    return Response(content=data, media_type=content_type)
