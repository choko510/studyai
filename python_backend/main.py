# In python_backend/main.py
from fastapi import FastAPI, Request, Depends, HTTPException # Ensure HTTPException is imported
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from dotenv import load_dotenv
import uvicorn
import os
import config
import secrets # Ensure secrets is imported
from typing import Optional # Ensure Optional is imported

from routers import assets as assets_router
from routers import api as api_router
from routers import bare as bare_router

load_dotenv()

# Basic Authentication Setup
security = HTTPBasic()
def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    if not config.CHALLENGE_PASSWORD: # If auth is disabled, always allow
        return "anonymous_user_auth_disabled"

    correct_username_bytes = b""
    correct_password_bytes = b""
    user_found = False

    # Find the user by credentials.username in config.USERS
    if credentials.username in config.USERS:
        correct_username_bytes = credentials.username.encode("utf8")
        correct_password_bytes = config.USERS[credentials.username].encode("utf8")
        user_found = True

    if not user_found: # User not in config, and auth is on (already checked CHALLENGE_PASSWORD)
            # This path is taken if CHALLENGE_PASSWORD is true and user is not found
            raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Basic"},
        )

    current_username_bytes = credentials.username.encode("utf8")
    is_correct_username = secrets.compare_digest(
        current_username_bytes, correct_username_bytes
    )
    current_password_bytes = credentials.password.encode("utf8")
    is_correct_password = secrets.compare_digest(
        current_password_bytes, correct_password_bytes
    )

    if not (is_correct_username and is_correct_password): # Password mismatch
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers that DO NOT get global basic auth
app.include_router(api_router.router)
app.include_router(bare_router.router)
app.include_router(assets_router.router) # /e/* routes, assumed open as per original logic.

# Routes that ARE protected by global basic auth if config.CHALLENGE_PASSWORD is true
# The `Depends(get_current_username)` will only raise HTTPException if config.CHALLENGE_PASSWORD is true
# and authentication fails. If config.CHALLENGE_PASSWORD is false, get_current_username returns a dummy string.
@app.get("/", dependencies=[Depends(get_current_username)])
async def serve_index_protected():
    return FileResponse("static/index.html")

@app.get("/hello_auth", dependencies=[Depends(get_current_username)])
async def hello_auth_route_protected(username: str = Depends(get_current_username)): # username is injected
    # If auth is disabled, username will be "anonymous_user_auth_disabled"
    if username == "anonymous_user_auth_disabled":
        return {"message": "Auth is disabled, hello!"}
    return {"message": f"Hello {username}, you are authenticated!"}

# Top-Level 404 Error Handler
@app.exception_handler(404)
async def custom_404_handler(request: Request, exc: HTTPException):
    # This custom handler will be triggered for 404s not caught by specific routers' 404 handlers.
    # For example, if /api/nonexistent is called, api_router's catch-all should handle it.
    # If /nonexistent is called, this global handler will.

    # We want to serve static/404.html for any 404 that reaches here.
    path_to_404 = "static/404.html"
    if os.path.exists(path_to_404):
        return HTMLResponse(content=open(path_to_404).read(), status_code=404)
    else:
        return HTMLResponse(content="<h1>404 Not Found</h1><p>The requested page could not be found.</p>", status_code=404)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
