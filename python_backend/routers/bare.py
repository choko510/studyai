# In python_backend/routers/bare.py
from fastapi import APIRouter, Request, HTTPException, Response as FastAPIResponse, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse
import httpx
import json
import mimetypes
from .bare_exceptions import BareError, to_bare_error
import asyncio
import websockets as python_websockets_client
import ipaddress
from .bare_utils import is_ip_forbidden, resolve_and_filter_hostname, join_incoming_bare_headers, split_outgoing_bare_headers
import time
import secrets
import urllib.parse


router = APIRouter()

# Configuration
LOG_ERRORS = True
BARE_SERVER_VERSION = "0.3.0"
BARE_PROTOCOL_VERSIONS = ["v1", "v2", "v3"]

# In-memory store for V1/V2/V3 WebSocket metadata
WS_METADATA_STORE = {}
WS_META_EXPIRATION_SECONDS = 30

# --- Utilities within bare.py ---
def random_hex_str(byte_length: int) -> str:
    return secrets.token_hex(byte_length)

def prune_ws_metadata():
    now = time.time()
    keys_to_delete = [k for k, v in WS_METADATA_STORE.items() if v.get("expires", 0) < now]
    for k in keys_to_delete:
        try: del WS_METADATA_STORE[k]
        except KeyError: pass

def decode_protocol_custom(encoded_str: str) -> str:
    result = ''; i = 0
    while i < len(encoded_str):
        char = encoded_str[i]
        if char == '%':
            if i + 2 < len(encoded_str):
                hex_code = encoded_str[i+1:i+3];
                try: result += chr(int(hex_code, 16)); i += 2
                except ValueError: result += char
            else: result += char
        else: result += char
        i += 1
    return result

async def _perform_ip_filtering(target_host_or_url: str, app_log_errors: bool):
    host_to_filter = ""
    if "://" in target_host_or_url:
        try: host_to_filter = httpx.URL(target_host_or_url).host
        except Exception as e: raise BareError(400, "INVALID_URL", "request.remote.url_parse", f"Could not parse URL for IP filtering: {target_host_or_url}")
    else: host_to_filter = target_host_or_url
    if not host_to_filter: raise BareError(400, "MISSING_HOST", "request.remote.host_missing", "Target host for IP filtering is missing.")

    is_host_ip = False
    try: ipaddress.ip_address(host_to_filter); is_host_ip = True
    except ValueError: pass
    if is_host_ip:
        if is_ip_forbidden(host_to_filter): raise BareError(403, "FORBIDDEN_IP", "request.remote.ip_forbidden", f"Target IP address {host_to_filter} is forbidden.")
    else: await resolve_and_filter_hostname(host_to_filter, app_log_errors=app_log_errors)

async def _proxy_websocket_messages(client_ws: WebSocket, remote_ws: python_websockets_client.WebSocketClientProtocol):
    # Renamed log_errors parameter to avoid conflict with global LOG_ERRORS if needed inside
    # but for now, it directly uses the global LOG_ERRORS for any prints.
    async def proxy_to_remote():
        try:
            while True:
                data = await client_ws.receive()
                if data.get("type") == "websocket.disconnect": break
                data_to_send = data.get("text") if data.get("text") is not None else data.get("bytes")
                if data_to_send is not None: await remote_ws.send(data_to_send)
        except WebSocketDisconnect:
            if LOG_ERRORS: print("Client WebSocket disconnected.")
        except python_websockets_client.exceptions.ConnectionClosed:
            if LOG_ERRORS: print("Remote WebSocket connection closed while sending.")
        except Exception as e:
            if LOG_ERRORS: print(f"Error proxying to remote: {type(e).__name__} - {e}")
        finally:
            if not remote_ws.closed: await remote_ws.close()

    async def proxy_to_client():
        try:
            async for message in remote_ws:
                if isinstance(message, str): await client_ws.send_text(message)
                elif isinstance(message, bytes): await client_ws.send_bytes(message)
        except python_websockets_client.exceptions.ConnectionClosed:
            if LOG_ERRORS: print("Remote WebSocket connection closed while receiving.")
        except WebSocketDisconnect: # Should be caught by proxy_to_remote, but good to have defensively
             if LOG_ERRORS: print("Client WebSocket disconnected during remote receive loop.")
        except Exception as e:
            if LOG_ERRORS: print(f"Error proxying to client: {type(e).__name__} - {e}")
        finally:
            try: await client_ws.close()
            except RuntimeError: pass

    done, pending = await asyncio.wait([proxy_to_remote(), proxy_to_client()], return_when=asyncio.FIRST_COMPLETED)
    for task in pending: task.cancel()
    if not remote_ws.closed: await remote_ws.close()
    try: await client_ws.close()
    except RuntimeError: pass

def _parse_common_bare_request_headers(
    processed_request_headers: httpx.Headers,
    pass_headers_list: list[str],
    pass_status_list: list[int],
    forward_headers_list: list[str],
    forbidden_pass_headers_const: list[str],
    forbidden_forward_headers_const: list[str]
):
    if processed_request_headers.get('x-bare-pass-status'):
        try:
            parsed_statuses = processed_request_headers.get('x-bare-pass-status', '').split(',')
            for s_val in parsed_statuses:
                s_val_stripped = s_val.strip()
                if s_val_stripped: s_int = int(s_val_stripped);_ = s_int not in pass_status_list and pass_status_list.append(s_int)
        except ValueError: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-pass-status", "Invalid number in x-bare-pass-status.")

    if processed_request_headers.get('x-bare-pass-headers'):
        parsed_p_headers = processed_request_headers.get('x-bare-pass-headers', '').split(',')
        for p_h_val in parsed_p_headers:
            p_h_lower = p_h_val.strip().lower()
            if not p_h_lower: continue
            if p_h_lower in forbidden_pass_headers_const: raise BareError(400, "FORBIDDEN_BARE_HEADER", "request.headers.x-bare-pass-headers", f"Forbidden header in x-bare-pass-headers: {p_h_lower}")
            if p_h_lower not in pass_headers_list: pass_headers_list.append(p_h_lower)

    if processed_request_headers.get('x-bare-forward-headers'):
        parsed_f_headers = processed_request_headers.get('x-bare-forward-headers', '').split(',')
        for f_h_val in parsed_f_headers:
            f_h_lower = f_h_val.strip().lower()
            if not f_h_lower: continue
            if f_h_lower in forbidden_forward_headers_const: raise BareError(400, "FORBIDDEN_BARE_HEADER", "request.headers.x-bare-forward-headers", f"Forbidden header in x-bare-forward-headers: {f_h_lower}")
            if f_h_lower not in forward_headers_list: forward_headers_list.append(f_h_lower)

# --- Manifest Route ---
@router.get("/ca/")
async def get_bare_manifest():
    manifest = {
        "versions": BARE_PROTOCOL_VERSIONS, "language": "Python", "memoryUsage": None,
        "maintainer": {}, "project": { "name": "python-bare-server",
        "description": "Python implementation of a TOMPHTTP Bare Server", "version": BARE_SERVER_VERSION}
    }
    return JSONResponse(content=manifest)

# --- Protocol Constants ---
V1_VALID_PROTOCOLS = ['http:', 'https:', 'ws:', 'wss:']
FORBIDDEN_SEND_HEADERS = ['connection', 'content-length', 'transfer-encoding', 'host']
FORBIDDEN_FORWARD_HEADERS = ['connection', 'transfer-encoding', 'origin', 'referer', 'host', 'cookie']
FORBIDDEN_PASS_HEADERS = ['vary', 'connection', 'transfer-encoding', 'access-control-allow-headers',
                           'access-control-allow-methods', 'access-control-expose-headers',
                           'access-control-max-age', 'access-control-request-headers',
                           'access-control-request-method', 'x-bare-status', 'x-bare-status-text', 'x-bare-headers']
V3_NULL_BODY_STATUSES = [101, 204, 205, 304]

# --- V1 ---
# REFACTOR_OPPORTUNITY: Common remote URL parsing (host, port, protocol, path) in v1_read_headers and v2_read_headers (used by V2 WS meta)
# REFACTOR_OPPORTUNITY: Common x-bare-headers JSON parsing in v1_read_headers, v2_read_headers, v3_read_headers
def v1_read_headers(request: Request) -> tuple[httpx.URL, dict]:
    bare_host = request.headers.get("x-bare-host")
    bare_port_str = request.headers.get("x-bare-port")
    bare_protocol = request.headers.get("x-bare-protocol")
    bare_path = request.headers.get("x-bare-path", "/")
    if not bare_host: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-host", "Header x-bare-host was not specified.")
    if not bare_port_str: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-port", "Header x-bare-port was not specified.")
    if not bare_protocol: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-protocol", "Header x-bare-protocol was not specified.")
    try: bare_port = int(bare_port_str)
    except ValueError: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-port", "Header x-bare-port was not a valid integer.")
    if bare_protocol not in V1_VALID_PROTOCOLS: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-protocol", f"Header x-bare-protocol was invalid. Allowed: {V1_VALID_PROTOCOLS}")
    if not bare_path.startswith("/"): bare_path = "/" + bare_path
    try:
        http_protocol = bare_protocol.replace('ws', 'http')
        remote_url_str = f"{http_protocol}//{bare_host}:{bare_port}{bare_path}"
        if request.url.query: remote_url_str += "?" + request.url.query
        remote_url = httpx.URL(remote_url_str)
    except Exception as e: raise BareError(400, "INVALID_BARE_HEADER", "request.remote.url", f"Constructed remote URL is invalid: {e}", stack=str(e) if LOG_ERRORS else None)

    headers_to_send = {}
    x_bare_headers_json = request.headers.get('x-bare-headers')
    if x_bare_headers_json is None: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-headers", "Header x-bare-headers was not specified.")
    try:
        x_bare_headers = json.loads(x_bare_headers_json)
        for k, v in x_bare_headers.items():
            if k.lower() not in FORBIDDEN_SEND_HEADERS: headers_to_send[k] = v
    except json.JSONDecodeError as e: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-headers", f"Header x-bare-headers contained invalid JSON: {e}", stack=str(e) if LOG_ERRORS else None)

    x_bare_forward_headers_json = request.headers.get('x-bare-forward-headers')
    if x_bare_forward_headers_json is None: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-forward-headers", "Header x-bare-forward-headers was not specified.")
    try:
        x_bare_forward_header_names = json.loads(x_bare_forward_headers_json)
        if not isinstance(x_bare_forward_header_names, list): raise ValueError("x-bare-forward-headers must be a JSON array of strings.")
        for header_name in x_bare_forward_header_names:
            header_name_lower = header_name.lower()
            if header_name_lower not in FORBIDDEN_FORWARD_HEADERS:
                client_header_value = request.headers.get(header_name_lower)
                if client_header_value is not None: headers_to_send[header_name] = client_header_value
    except (json.JSONDecodeError, ValueError) as e: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-forward-headers", f"Header x-bare-forward-headers was invalid: {e}", stack=str(e) if LOG_ERRORS else None)
    headers_to_send['Host'] = bare_host
    return remote_url, headers_to_send

# REFACTOR_OPPORTUNITY: Core HTTP proxy execution logic (IP filter, httpx request, response streaming, error handling)
# is very similar across bare_v1_http_proxy, bare_v2_http_proxy, bare_v3_http_proxy.
# Consider a shared function that takes a "read_headers_func" and protocol-specific details.
async def _execute_http_proxy(
    request: Request,
    remote_url: httpx.URL,
    headers_to_send: dict,
    response_for_client_cors_headers: dict, # CORS headers to add to final response
    pass_status_to_client: list[int] = None, # V2/V3: list of statuses to pass directly
    pass_headers_to_client: list[str] = None, # V2/V3: list of headers to pass directly
    is_v1_style_response: bool = False # V1 has specific x-bare-* header format
):
    await _perform_ip_filtering(str(remote_url.host), app_log_errors=LOG_ERRORS) # Use str(remote_url.host)

    async with httpx.AsyncClient(http2=True, follow_redirects=False) as client:
        body_bytes = await request.body() if request.method not in ["GET", "HEAD"] else None
        if LOG_ERRORS: print(f"HTTP Proxy ({'V1' if is_v1_style_response else 'V2/V3'}): {request.method} {remote_url} Headers: {json.dumps(headers_to_send)}")
        remote_response = await client.request(method=request.method, url=remote_url, headers=headers_to_send, content=body_bytes, timeout=60.0)

    actual_response_status_to_client = 200 # Default for V1 & V2/V3 non-passed status
    if not is_v1_style_response and pass_status_to_client and remote_response.status_code in pass_status_to_client:
        actual_response_status_to_client = remote_response.status_code

    final_response_headers_to_client = dict(response_for_client_cors_headers)

    if is_v1_style_response:
        outgoing_bare_headers = {}
        for k, v_list_or_val in remote_response.headers.multi_items():
            k_lower = k.lower()
            current_val = outgoing_bare_headers.get(k_lower)
            if current_val is None: outgoing_bare_headers[k_lower] = v_list_or_val
            elif isinstance(current_val, list): current_val.append(v_list_or_val)
            else: outgoing_bare_headers[k_lower] = [current_val, v_list_or_val]
        final_response_headers_to_client["x-bare-status"] = str(remote_response.status_code)
        final_response_headers_to_client["x-bare-status-text"] = remote_response.reason_phrase if remote_response.reason_phrase else ""
        final_response_headers_to_client["x-bare-headers"] = json.dumps(outgoing_bare_headers)
        if "content-encoding" in remote_response.headers: final_response_headers_to_client["content-encoding"] = remote_response.headers["content-encoding"]
        if "content-length" in remote_response.headers: final_response_headers_to_client["content-length"] = remote_response.headers["content-length"]
        if "content-type" in remote_response.headers: final_response_headers_to_client["content-type"] = remote_response.headers["content-type"]
    else: # V2/V3 style
        if pass_headers_to_client:
            for p_header_name in pass_headers_to_client:
                if p_header_name in remote_response.headers: final_response_headers_to_client[p_header_name] = remote_response.headers[p_header_name]
        if actual_response_status_to_client != 304: # cacheNotModified
            final_response_headers_to_client["x-bare-status"] = str(remote_response.status_code)
            final_response_headers_to_client["x-bare-status-text"] = remote_response.reason_phrase if remote_response.reason_phrase else ""
            # Corrected multi-item processing for V2/V3 x-bare-headers
            outgoing_xbare_json_headers = {}
            for k, v in remote_response.headers.multi_items():
                k_lower = k.lower()
                if k_lower in outgoing_xbare_json_headers:
                    if isinstance(outgoing_xbare_json_headers[k_lower], list):
                        outgoing_xbare_json_headers[k_lower].append(v)
                    else:
                        outgoing_xbare_json_headers[k_lower] = [outgoing_xbare_json_headers[k_lower], v]
                else:
                    outgoing_xbare_json_headers[k_lower] = v
            final_response_headers_to_client["x-bare-headers"] = json.dumps(outgoing_xbare_json_headers)

    final_response_headers_to_client = split_outgoing_bare_headers(final_response_headers_to_client)

    null_body_statuses = V3_NULL_BODY_STATUSES if not is_v1_style_response else [] # V1 doesn't have null body concept from pass_status
    if actual_response_status_to_client in null_body_statuses :
         return FastAPIResponse(status_code=actual_response_status_to_client, headers=final_response_headers_to_client)
    else:
        async def stream_response_content():
            async for chunk in remote_response.aiter_bytes(): yield chunk
        return StreamingResponse(stream_response_content(), status_code=actual_response_status_to_client, headers=final_response_headers_to_client)

@router.api_route("/ca/v1/", methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def bare_v1_http_proxy(request: Request):
    response_for_client_cors_headers = {
        'x-robots-tag': 'noindex', 'access-control-allow-headers': '*', 'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS',
        'access-control-expose-headers': '*', 'access-control-max-age': '7200'
    }
    if request.method == "OPTIONS": return FastAPIResponse(status_code=204, headers=response_for_client_cors_headers)
    try:
        remote_url, headers_to_send = v1_read_headers(request)
        return await _execute_http_proxy(request, remote_url, headers_to_send, response_for_client_cors_headers, is_v1_style_response=True)
    except BareError as e:
        if LOG_ERRORS and not e.detail.get("stack"): e.detail["stack"] = f"BareError caught in V1 HTTP proxy: {type(e).__name__}"
        return JSONResponse(status_code=e.status_code, content=e.detail, headers=response_for_client_cors_headers)
    except Exception as e:
        bare_err = to_bare_error(e, "error.proxy.v1.http", LOG_ERRORS)
        return JSONResponse(status_code=bare_err.status_code, content=bare_err.detail, headers=response_for_client_cors_headers)

# --- V1 WebSocket Endpoints ---
@router.post("/ca/v1/ws-new-meta")
async def bare_v1_ws_new_meta_route(request: Request):
    prune_ws_metadata()
    new_id = random_hex_str(16)
    WS_METADATA_STORE[new_id] = {"v": 1, "expires": time.time() + WS_META_EXPIRATION_SECONDS, "response_headers": None}
    return FastAPIResponse(content=new_id, media_type="text/plain")
@router.get("/ca/v1/ws-meta")
async def bare_v1_ws_meta_route(request: Request):
    prune_ws_metadata()
    bare_id = request.headers.get("x-bare-id")
    if not bare_id: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-id", "Header x-bare-id was not specified.")
    meta = WS_METADATA_STORE.get(bare_id)
    if not meta or meta.get("v") != 1: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-id", "Unregistered or invalid ID for V1.")
    try: del WS_METADATA_STORE[bare_id]
    except KeyError: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-id", "ID already used or expired.")
    response_data = {"headers": meta.get("response_headers", {})}
    return JSONResponse(content=response_data)
@router.websocket("/ca/v1/")
async def bare_v1_websocket_proxy(client_ws: WebSocket):
    await client_ws.accept()
    sec_websocket_protocol_header = client_ws.headers.get("sec-websocket-protocol", "")
    protocols = [p.strip() for p in sec_websocket_protocol_header.split(',')]
    if not protocols or protocols[0].lower() != "bare":
        await client_ws.close(code=1002, reason="Invalid Sec-WebSocket-Protocol, 'bare' not found."); return
    if len(protocols) < 2 or not protocols[1]:
        await client_ws.close(code=1002, reason="Missing encoded metadata in Sec-WebSocket-Protocol."); return
    encoded_meta = protocols[1]
    try:
        decoded_meta_str = decode_protocol_custom(encoded_meta)
        v1_meta = json.loads(decoded_meta_str)
        bare_remote_info = v1_meta.get("remote"); bare_headers_for_remote = v1_meta.get("headers", {})
        forward_header_names = v1_meta.get("forward_headers", []); meta_id = v1_meta.get("id")
        if not all([bare_remote_info, isinstance(bare_headers_for_remote, dict), isinstance(forward_header_names, list), meta_id]):
            raise ValueError("Missing or invalid essential fields in V1 WebSocket metadata")
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        await client_ws.close(code=1002, reason=f"Invalid V1 WebSocket metadata: {e}"); return

    remote_protocol = bare_remote_info.get("protocol", "ws:"); remote_host = bare_remote_info.get("host")
    remote_port = bare_remote_info.get("port"); remote_path = bare_remote_info.get("path", "/")
    if not remote_host or not remote_port: await client_ws.close(code=1008, reason="Remote host/port missing in metadata."); return
    if not remote_path.startswith("/"): remote_path = "/" + remote_path
    remote_ws_url = f"{remote_protocol}//{remote_host}:{remote_port}{remote_path}"

    try: await _perform_ip_filtering(remote_host, app_log_errors=LOG_ERRORS)
    except BareError as e:
        await client_ws.close(code=1008, reason=f"{e.detail.get('code', 'FORBIDDEN_IP')}: {e.detail.get('message', 'Target host is forbidden.')}"); return

    for header_name in forward_header_names:
        header_name_lower = header_name.lower()
        if header_name_lower not in FORBIDDEN_FORWARD_HEADERS:
            client_header_value = client_ws.headers.get(header_name_lower)
            if client_header_value is not None: bare_headers_for_remote[header_name] = client_header_value
    try:
        async with python_websockets_client.connect(remote_ws_url, extra_headers=bare_headers_for_remote, subprotocols=[]) as remote_ws:
            if meta_id in WS_METADATA_STORE and WS_METADATA_STORE[meta_id]["v"] == 1:
                stored_headers = {}; remote_resp_hdrs = remote_ws.response_headers
                for k,v in remote_resp_hdrs.items():
                    k_l = k.lower(); e_h = stored_headers.get(k_l)
                    if e_h is None: stored_headers[k_l] = v
                    elif isinstance(e_h, list): e_h.append(v)
                    else: stored_headers[k_l] = [e_h, v]
                WS_METADATA_STORE[meta_id]["response_headers"] = stored_headers
            else: print(f"Warning: Meta ID {meta_id} not found/invalid for storing remote WS headers (V1).")
            await _proxy_websocket_messages(client_ws, remote_ws)
    except python_websockets_client.exceptions.InvalidHandshake as e:
        await client_ws.close(code=1002, reason=f"Remote WebSocket handshake failed: {e.status_code}")
    except ConnectionRefusedError: await client_ws.close(code=1002, reason="Connection refused by remote server.")
    except Exception as e:
        if LOG_ERRORS: print(f"V1 WebSocket Proxy Error: {type(e).__name__} - {e}")
        await client_ws.close(code=1011, reason=f"An unexpected error occurred: {type(e).__name__}")
    finally:
        try: await client_ws.close()
        except RuntimeError: pass

# --- V2 ---
# REFACTOR_OPPORTUNITY: Common parsing for pass_status, pass_headers, forward_headers in v2_read_headers and v3_read_headers.
def v2_read_headers(request: Request, query_params: httpx.QueryParams) -> tuple[httpx.URL, dict, list[str], list[int], list[str]]:
    processed_request_headers = join_incoming_bare_headers(request.headers)
    pass_headers = ['content-encoding', 'content-length', 'last-modified']
    pass_status: list[int] = []
    forward_headers = ['accept-encoding', 'accept-language', 'sec-websocket-extensions', 'sec-websocket-key', 'sec-websocket-version']
    if query_params.get("cache") is not None:
        pass_headers.extend(['cache-control', 'etag']); pass_status.append(304)
        forward_headers.extend(['if-modified-since', 'if-none-match', 'cache-control'])

    bare_host = processed_request_headers.get("x-bare-host")
    bare_port_str = processed_request_headers.get("x-bare-port")
    bare_protocol = processed_request_headers.get("x-bare-protocol")
    bare_path = processed_request_headers.get("x-bare-path", "/")
    if not bare_host: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-host", "Header x-bare-host was not specified.")
    if not bare_port_str: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-port", "Header x-bare-port was not specified.")
    if not bare_protocol: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-protocol", "Header x-bare-protocol was not specified.")
    try:  _ = int(bare_port_str)
    except ValueError: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-port", "Header x-bare-port was not a valid integer.")
    if bare_protocol not in V1_VALID_PROTOCOLS: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-protocol", f"Header x-bare-protocol was invalid. Allowed: {V1_VALID_PROTOCOLS}")
    if not bare_path.startswith("/"): bare_path = "/" + bare_path
    try:
        http_protocol = bare_protocol.replace('ws', 'http')
        remote_url_str = f"{http_protocol}//{bare_host}:{bare_port_str}{bare_path}"
        remote_url = httpx.URL(remote_url_str) # V2 does not add request.url.query to remote_url_str
    except Exception as e: raise BareError(400, "INVALID_BARE_HEADER", "request.remote.url", f"Constructed remote URL is invalid: {e}")

    send_headers = {}
    x_bare_headers_json = processed_request_headers.get('x-bare-headers')
    if x_bare_headers_json is None: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-headers", "Header x-bare-headers was not specified.")
    try:
        x_bare_headers = json.loads(x_bare_headers_json)
        for k, v in x_bare_headers.items():
            if k.lower() not in FORBIDDEN_SEND_HEADERS: send_headers[k] = v
    except json.JSONDecodeError as e: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-headers", f"Header x-bare-headers contained invalid JSON: {e}")

    _parse_common_bare_request_headers(processed_request_headers, pass_headers, pass_status, forward_headers, FORBIDDEN_PASS_HEADERS, FORBIDDEN_FORWARD_HEADERS)
    send_headers['Host'] = bare_host
    return remote_url, send_headers, pass_headers, pass_status, forward_headers

@router.api_route("/ca/v2/", methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def bare_v2_http_proxy(request: Request):
    response_for_client_cors_headers = {
        'x-robots-tag': 'noindex', 'access-control-allow-headers': '*',
        'access-control-allow-origin': '*', 'access-control-allow-methods': '*',
        'access-control-expose-headers': '*', 'access-control-max-age': '7200'
    }
    if request.method == "OPTIONS": return FastAPIResponse(status_code=204, headers=response_for_client_cors_headers)
    try:
        remote_url, send_headers_to_remote, pass_headers_to_client, pass_status_to_client, forward_headers_from_client = v2_read_headers(request, httpx.QueryParams(request.url.query))
        for f_header_name in forward_headers_from_client:
            client_header_value = request.headers.get(f_header_name) # Original request headers
            if client_header_value is not None: send_headers_to_remote[f_header_name] = client_header_value

        return await _execute_http_proxy(request, remote_url, send_headers_to_remote, response_for_client_cors_headers, pass_status_to_client, pass_headers_to_client, is_v1_style_response=False)
    except BareError as e: return JSONResponse(status_code=e.status_code, content=e.detail, headers=response_for_client_cors_headers)
    except Exception as e:
        bare_err = to_bare_error(e, "error.proxy.v2.http", LOG_ERRORS)
        return JSONResponse(status_code=bare_err.status_code, content=bare_err.detail, headers=response_for_client_cors_headers)

@router.post("/ca/v2/ws-new-meta")
async def bare_v2_ws_new_meta(request: Request):
    default_cors = {'access-control-allow-origin': '*'}
    try:
        # V2 ws-new-meta expects x-bare- S headers on the POST request itself.
        # It does not take parameters from query string for 'cache' etc.
        # So, pass empty QueryParams if v2_read_headers expects it.
        remote_url, send_headers, _, _, forward_headers = v2_read_headers(request, httpx.QueryParams())
        new_id = random_hex_str(16)
        WS_METADATA_STORE[new_id] = {
            "v": 2, "expires": time.time() + WS_META_EXPIRATION_SECONDS,
            "remote_url_str": str(remote_url), "send_headers": send_headers,
            "forward_headers": forward_headers, "response_data": None
        }
        return FastAPIResponse(content=new_id, media_type="text/plain", headers=default_cors)
    except BareError as e: return JSONResponse(status_code=e.status_code, content=e.detail, headers=default_cors)
    except Exception as e:
        bare_err = to_bare_error(e, "error.ws.new_meta.v2", LOG_ERRORS)
        return JSONResponse(status_code=bare_err.status_code, content=bare_err.detail, headers=default_cors)
@router.get("/ca/v2/ws-meta")
async def bare_v2_ws_meta(request: Request):
    default_cors = {'access-control-allow-origin': '*'}
    bare_id = request.headers.get("x-bare-id")
    if not bare_id: return JSONResponse(status_code=400, content=BareError(400,"MISSING_BARE_HEADER", "request.headers.x-bare-id","Header x-bare-id was not specified.").detail, headers=default_cors)
    meta = WS_METADATA_STORE.get(bare_id)
    if not meta or meta.get("v") != 2: return JSONResponse(status_code=400, content=BareError(400,"INVALID_BARE_HEADER", "request.headers.x-bare-id","Unregistered or invalid ID for V2.").detail, headers=default_cors)
    if not meta.get("response_data"): return JSONResponse(status_code=400, content=BareError(400,"INVALID_BARE_HEADER", "request.headers.x-bare-id","Meta not ready.").detail, headers=default_cors)

    response_data_from_meta = meta["response_data"]
    client_response_headers = {
        **default_cors,
        'x-bare-status': str(response_data_from_meta.get("status", "500")),
        'x-bare-status-text': response_data_from_meta.get("statusText", "Internal Server Error"),
        'x-bare-headers': json.dumps(response_data_from_meta.get("headers", {}))
    }
    client_response_headers = split_outgoing_bare_headers(client_response_headers)
    try: del WS_METADATA_STORE[bare_id]
    except KeyError: pass
    return FastAPIResponse(status_code=200, headers=client_response_headers)
@router.websocket("/ca/v2/")
async def bare_v2_websocket_proxy(client_ws: WebSocket):
    await client_ws.accept()
    meta_id = client_ws.headers.get("sec-websocket-protocol")
    if not meta_id: await client_ws.close(code=1002, reason="Missing Sec-WebSocket-Protocol (expected ID)."); return
    stored_meta = WS_METADATA_STORE.get(meta_id)
    if not stored_meta or stored_meta.get("v") != 2:
        await client_ws.close(code=1002, reason="Invalid or expired ID in Sec-WebSocket-Protocol."); return

    remote_url_str = stored_meta["remote_url_str"]; send_headers_to_remote = stored_meta["send_headers"].copy()
    forward_headers_from_client_upgrade = stored_meta["forward_headers"]
    for f_header_name in forward_headers_from_client_upgrade:
        client_upgrade_header_value = client_ws.headers.get(f_header_name.lower())
        if client_upgrade_header_value is not None: send_headers_to_remote[f_header_name] = client_upgrade_header_value

    try: await _perform_ip_filtering(httpx.URL(remote_url_str).host, app_log_errors=LOG_ERRORS)
    except BareError as e:
        await client_ws.close(code=1008, reason=f"{e.detail.get('code', 'FORBIDDEN_IP')}: {e.detail.get('message', 'Target host is forbidden.')}"); return
    try:
        async with python_websockets_client.connect(remote_url_str, extra_headers=send_headers_to_remote) as remote_ws:
            remote_resp_headers_dict = {k.lower(): v for k,v in remote_ws.response_headers.items()}
            stored_meta["response_data"] = { "status": remote_ws.status_code, "statusText": remote_ws.reason_phrase, "headers": remote_resp_headers_dict }
            await _proxy_websocket_messages(client_ws, remote_ws)
    except python_websockets_client.exceptions.InvalidHandshake as e:
        if meta_id in WS_METADATA_STORE: WS_METADATA_STORE[meta_id]["response_data"] = { "status": e.status_code, "statusText": "WebSocket Handshake Failed", "headers": {} }
        await client_ws.close(code=1002, reason=f"Remote WebSocket handshake failed: {e.status_code}")
    except ConnectionRefusedError:
        if meta_id in WS_METADATA_STORE: WS_METADATA_STORE[meta_id]["response_data"] = { "status": 503, "statusText": "Connection Refused", "headers": {} }
        await client_ws.close(code=1002, reason="Connection refused by remote server.")
    except Exception as e:
        if LOG_ERRORS: print(f"V2 WebSocket Proxy Error: {type(e).__name__} - {e}")
        if meta_id in WS_METADATA_STORE : WS_METADATA_STORE[meta_id]["response_data"] = { "status": 500, "statusText": "Proxy Error", "headers": {"x-proxy-error": str(e)} }
        await client_ws.close(code=1011)
    finally:
        try: await client_ws.close()
        except RuntimeError: pass

# --- V3 ---
def v3_read_headers(request: Request, query_params: httpx.QueryParams) -> tuple[httpx.URL, dict, list[str], list[int], list[str]]:
    processed_request_headers = join_incoming_bare_headers(request.headers)
    x_bare_url_str = processed_request_headers.get("x-bare-url")
    if not x_bare_url_str: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-url", "Header x-bare-url was not specified.")
    try:
        temp_remote_url = httpx.URL(x_bare_url_str)
        # V3 appends client query string to the path from x-bare-url
        final_remote_url_str = str(temp_remote_url.copy_with(query=request.url.query.encode('utf-8') if request.url.query else None))
        remote_url = httpx.URL(final_remote_url_str)
    except Exception as e: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-url", f"Header x-bare-url was invalid or led to invalid URL: {e}")

    pass_headers = ['content-encoding', 'content-length', 'last-modified']
    pass_status: list[int] = []
    forward_headers = ['accept-encoding', 'accept-language']
    if query_params.get("cache") is not None:
        pass_headers.extend(['cache-control', 'etag']); pass_status.append(304)
        forward_headers.extend(['if-modified-since', 'if-none-match', 'cache-control'])

    send_headers = {}
    x_bare_headers_json = processed_request_headers.get('x-bare-headers')
    if x_bare_headers_json is None: raise BareError(400, "MISSING_BARE_HEADER", "request.headers.x-bare-headers", "Header x-bare-headers was not specified.")
    try:
        x_bare_headers_parsed = json.loads(x_bare_headers_json)
        for k, v in x_bare_headers_parsed.items():
            if k.lower() not in FORBIDDEN_SEND_HEADERS: send_headers[k] = v
    except json.JSONDecodeError as e: raise BareError(400, "INVALID_BARE_HEADER", "request.headers.x-bare-headers", f"Invalid JSON in x-bare-headers: {e}")

    _parse_common_bare_request_headers(processed_request_headers, pass_headers, pass_status, forward_headers, FORBIDDEN_PASS_HEADERS, FORBIDDEN_FORWARD_HEADERS)
    send_headers['Host'] = remote_url.host
    return remote_url, send_headers, pass_headers, pass_status, forward_headers

@router.api_route("/ca/v3/", methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def bare_v3_http_proxy(request: Request):
    response_for_client_cors_headers = {
        'x-robots-tag': 'noindex', 'access-control-allow-headers': '*',
        'access-control-allow-origin': '*', 'access-control-allow-methods': '*',
        'access-control-expose-headers': '*', 'access-control-max-age': '7200'
    }
    if request.method == "OPTIONS": return FastAPIResponse(status_code=204, headers=response_for_client_cors_headers)
    try:
        remote_url, send_headers_to_remote, pass_headers_to_client, pass_status_to_client, forward_headers_from_client = v3_read_headers(request, request.url.params)
        for f_header_name in forward_headers_from_client: # Apply forwarded headers
            client_header_value = request.headers.get(f_header_name)
            if client_header_value is not None: send_headers_to_remote[f_header_name] = client_header_value

        return await _execute_http_proxy(request, remote_url, send_headers_to_remote, response_for_client_cors_headers, pass_status_to_client, pass_headers_to_client, is_v1_style_response=False)
    except BareError as e: return JSONResponse(status_code=e.status_code, content=e.detail, headers=response_for_client_cors_headers)
    except Exception as e:
        bare_err = to_bare_error(e, "error.proxy.v3.http", LOG_ERRORS)
        return JSONResponse(status_code=bare_err.status_code, content=bare_err.detail, headers=response_for_client_cors_headers)

@router.websocket("/ca/v3/")
async def bare_v3_websocket_proxy(client_ws: WebSocket):
    await client_ws.accept()
    try:
        connect_packet_str = await client_ws.receive_text()
        connect_packet = json.loads(connect_packet_str)
        if connect_packet.get("type") != "connect":
            await client_ws.close(code=1002, reason="First message type was not 'connect'."); return
        remote_url_str = connect_packet.get("remote")
        headers_for_remote = connect_packet.get("headers", {})
        forward_header_names_v3 = connect_packet.get("forwardHeaders", [])
        remote_subprotocols = connect_packet.get("protocols", [])
        if not remote_url_str: await client_ws.close(code=1002, reason="Missing 'remote' URL in connect packet."); return

        for f_header_name in forward_header_names_v3:
            client_upgrade_header_value = client_ws.headers.get(f_header_name.lower())
            if client_upgrade_header_value is not None: headers_for_remote[f_header_name] = client_upgrade_header_value

        try: await _perform_ip_filtering(remote_url_str, app_log_errors=LOG_ERRORS)
        except BareError as e:
            await client_ws.close(code=1008, reason=f"{e.detail.get('code', 'FORBIDDEN_IP')}: Target host is forbidden."); return

        async with python_websockets_client.connect(remote_url_str, extra_headers=headers_for_remote, subprotocols=remote_subprotocols) as remote_ws:
            set_cookie_headers = []
            for k, v_list_or_val in remote_ws.response_headers.multi_items():
                 # Ensure v is string for list append
                if isinstance(v_list_or_val, list): # Should not happen with websockets headers but defensive
                    for item_in_list in v_list_or_val:
                         if k.lower() == 'set-cookie': set_cookie_headers.append(str(item_in_list))
                elif k.lower() == 'set-cookie':
                    set_cookie_headers.append(str(v_list_or_val))

            open_packet_to_client = {"type": "open", "protocol": remote_ws.subprotocol or "", "setCookies": set_cookie_headers}
            await client_ws.send_json(open_packet_to_client)
            await _proxy_websocket_messages(client_ws, remote_ws)
    except WebSocketDisconnect: pass
    except json.JSONDecodeError: await client_ws.close(code=1002, reason="Invalid JSON in first message.")
    except python_websockets_client.exceptions.InvalidHandshake as e:
        await client_ws.close(code=1002, reason=f"Remote WebSocket handshake failed: {e.status_code}")
    except ConnectionRefusedError: await client_ws.close(code=1002, reason="Connection refused by remote V3 server.")
    except Exception as e:
        if LOG_ERRORS: print(f"V3 WebSocket Proxy Error: {type(e).__name__} - {e}")
        await client_ws.close(code=1011, reason=f"Unexpected error in V3 proxy: {type(e).__name__}")
    finally:
        try: await client_ws.close()
        except RuntimeError: pass
