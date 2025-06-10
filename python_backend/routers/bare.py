# In python_backend/routers/bare.py
from fastapi import APIRouter, Request, HTTPException, Response, WebSocket # Added WebSocket for type hinting
from fastapi.responses import StreamingResponse
import httpx
import websockets # Library for WebSocket client
import asyncio
import json # For parsing x-bare-headers

router = APIRouter()

# Helper to prepare headers for outgoing request, based on x-bare-headers
def prepare_remote_headers(client_request: Request):
    bare_headers_json = client_request.headers.get("x-bare-headers", "{}")
    try:
        bare_headers = json.loads(bare_headers_json)
    except json.JSONDecodeError:
        bare_headers = {}

    # Standard headers to forward if not overridden by x-bare-headers
    # Filter out FastAPI/Uvicorn specific headers and host header for remote request
    excluded_headers = ['host', 'x-forwarded-for', 'x-forwarded-proto', 'x-bare-host', 'x-bare-port', 'x-bare-path', 'x-bare-protocol', 'x-bare-headers', 'cookie', 'accept-encoding'] # Keep cookies separate, remove accept-encoding

    headers = {k: v for k, v in client_request.headers.items() if k.lower() not in excluded_headers}

    # Merge/override with x-bare-headers
    for name, value in bare_headers.items():
        headers[name] = value

    # User-Agent might be specified in x-bare-headers, otherwise use client's
    if 'user-agent' not in headers:
        ua = client_request.headers.get('user-agent')
        if ua:
            headers['user-agent'] = ua

    # Cookies: x-bare-headers might specify 'cookie', otherwise pass client's cookies
    if 'cookie' not in headers and client_request.headers.get('cookie'):
            headers['cookie'] = client_request.headers.get('cookie')

    return headers

# HTTP Proxying for Bare Server
@router.api_route("/ca/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def bare_http_proxy(request: Request, path: str):
    bare_host = request.headers.get("x-bare-host")
    bare_port = request.headers.get("x-bare-port")
    bare_path = request.headers.get("x-bare-path", "/")
    bare_protocol = request.headers.get("x-bare-protocol", "http:")

    if not bare_host:
        raise HTTPException(status_code=400, detail="x-bare-host header is required.")
    if not bare_port:
        raise HTTPException(status_code=400, detail="x-bare-port header is required.")

    if not bare_path.startswith("/") and bare_path != "":
        bare_path = "/" + bare_path

    remote_url = f"{bare_protocol}//{bare_host}:{bare_port}{bare_path}"

    if request.url.query:
        remote_url += "?" + request.url.query

    remote_request_headers = prepare_remote_headers(request)

    async with httpx.AsyncClient(http2=True, follow_redirects=True) as client:
        try:
            body = await request.body() if request.method not in ["GET", "HEAD", "OPTIONS"] else None
            print(f"Bare HTTP Proxy: {request.method} {remote_url}")

            rp = await client.request(
                method=request.method,
                url=remote_url,
                headers=remote_request_headers,
                content=body,
                timeout=60.0
            )

            response_headers = {}
            excluded_response_headers = [
                'content-encoding',
                'transfer-encoding',
                'connection',
            ]
            for name, value in rp.headers.items():
                if name.lower() not in excluded_response_headers:
                    response_headers[name] = value

            response_headers["Access-Control-Allow-Origin"] = "*"
            response_headers["Access-Control-Allow-Headers"] = "*"
            response_headers["Access-Control-Expose-Headers"] = "*"

            if request.method == "OPTIONS":
                response_headers["Access-Control-Allow-Methods"] = "GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS"
                return Response(status_code=204, headers=response_headers)

            async def stream_response_content():
                async for chunk in rp.aiter_bytes():
                    yield chunk

            return StreamingResponse(
                stream_response_content(),
                status_code=rp.status_code,
                headers=response_headers,
                media_type=rp.headers.get("content-type")
            )

        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail=f"Timeout connecting to {remote_url}")
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Could not connect to {remote_url}")
        except httpx.RequestError as e:
            print(f"Bare Proxy Error: {e}")
            raise HTTPException(status_code=500, detail=f"Error proxying request to {remote_url}: {str(e)}")

# Corrected WebSocket Proxying for Bare Server using FastAPI's WebSocket
@router.websocket("/ca/")
async def bare_websocket_proxy_corrected(client_ws: WebSocket):
    await client_ws.accept()

    query_params = client_ws.query_params
    bare_host = query_params.get("x-bare-host") or client_ws.headers.get("x-bare-host")
    bare_port = query_params.get("x-bare-port") or client_ws.headers.get("x-bare-port")
    bare_path = query_params.get("x-bare-path", "/") or client_ws.headers.get("x-bare-path", "/")
    bare_protocol = query_params.get("x-bare-protocol", "ws:") or client_ws.headers.get("x-bare-protocol", "ws:")

    bare_headers_json = query_params.get("x-bare-headers", "{}") or client_ws.headers.get("x-bare-headers", "{}")
    try:
        remote_ws_headers = json.loads(bare_headers_json)
    except json.JSONDecodeError:
        remote_ws_headers = {}

    if not bare_host or not bare_port:
        await client_ws.close(code=1008, reason="x-bare-host and x-bare-port are required.")
        return

    if not bare_path.startswith("/"):
        bare_path = "/" + bare_path

    remote_ws_url = f"{bare_protocol}//{bare_host}:{bare_port}{bare_path}"

    if 'origin' not in remote_ws_headers and client_ws.headers.get('origin'):
        remote_ws_headers['origin'] = client_ws.headers.get('origin')
    if 'user-agent' not in remote_ws_headers and client_ws.headers.get('user-agent'):
        remote_ws_headers['user-agent'] = client_ws.headers.get('user-agent')

    # Extract subprotocols from the client WebSocket handshake
    client_subprotocols = []
    for header, value in client_ws.scope['headers']:
        if header == b'sec-websocket-protocol':
            client_subprotocols = [proto.strip() for proto in value.decode().split(',')]
            break

    try:
        print(f"Bare WebSocket Proxy: Connecting to {remote_ws_url}")
        async with websockets.connect(
            remote_ws_url,
            extra_headers=remote_ws_headers,
            subprotocols=client_subprotocols # Pass subprotocols to remote
        ) as remote_ws:
            print(f"Bare WebSocket Proxy: Connected to {remote_ws_url}")
            # Pass back the subprotocol agreed by the remote server to the client
            # This needs to be done during the accept() call if possible, or by modifying handshake
            # FastAPI's accept() can take subprotocol. We need to connect to remote FIRST, then accept client.
            # This is a limitation. For now, we accept client first.
            # If a subprotocol was agreed, remote_ws.subprotocol will have it.

            async def proxy_to_remote():
                while True:
                    try:
                        message = await client_ws.receive()
                        if message.get("type") == "websocket.disconnect": break

                        data_to_send = None
                        if message.get("text") is not None: data_to_send = message["text"]
                        elif message.get("bytes") is not None: data_to_send = message["bytes"]

                        if data_to_send is not None: await remote_ws.send(data_to_send)
                        else: print(f"Unknown message type from client: {message}")

                    except websockets.exceptions.ConnectionClosed: break
                    except Exception as e:
                        print(f"Error proxying client to remote: {e}")
                        break
                if not remote_ws.closed: await remote_ws.close()
                try: # client_ws could already be closed by client
                    if client_ws.client_state != client_ws.client_state.DISCONNECTED: # Check state
                        await client_ws.close()
                except Exception: pass


            async def proxy_to_client():
                while True:
                    try:
                        message = await remote_ws.recv()
                        if isinstance(message, str): await client_ws.send_text(message)
                        elif isinstance(message, bytes): await client_ws.send_bytes(message)
                    except websockets.exceptions.ConnectionClosed: break
                    except Exception as e:
                        print(f"Error proxying remote to client: {e}")
                        break
                if not remote_ws.closed: await remote_ws.close()
                try: # client_ws could already be closed by client
                    if client_ws.client_state != client_ws.client_state.DISCONNECTED: # Check state
                        await client_ws.close()
                except Exception: pass

            await asyncio.gather(proxy_to_remote(), proxy_to_client())

    except websockets.exceptions.InvalidURI:
        await client_ws.close(code=1008, reason=f"Invalid remote WebSocket URI: {remote_ws_url}")
    except websockets.exceptions.InvalidHandshake as e:
        await client_ws.close(code=1011, reason=f"WebSocket handshake failed with remote: {str(e)}")
    except ConnectionRefusedError:
            await client_ws.close(code=1011, reason=f"Connection refused by remote server: {remote_ws_url}")
    except Exception as e:
        print(f"Bare WebSocket Proxy Error: {type(e).__name__} {e}")
        await client_ws.close(code=1011, reason=f"An unexpected error occurred: {str(e)}")
    finally:
        try:
            if client_ws.client_state != client_ws.client_state.DISCONNECTED:
                    await client_ws.close()
        except Exception: pass
