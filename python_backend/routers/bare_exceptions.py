# python_backend/routers/bare_exceptions.py
from fastapi import HTTPException

class BareError(HTTPException):
    def __init__(self, status_code: int, code: str, id_path: str, message: str, stack: str = None):
        self.status_code = status_code  # This is the status for the error *response*, not necessarily the remote's status
        self.detail = {
            "code": code,
            "id": id_path, # e.g., "request.headers.x-bare-host" or "error.Exception"
            "message": message,
        }
        if stack: # Only include stack if available and error logging is verbose
            self.detail["stack"] = stack
        # Ensure HTTPException's detail is set for FastAPI to use
        super().__init__(status_code=status_code, detail=self.detail)

# Helper function to convert httpx or other errors to BareError
def to_bare_error(exc: Exception, id_prefix: str = "error", log_errors: bool = False) -> BareError:
    import httpx

    if isinstance(exc, BareError):
        return exc

    stack = str(exc) if log_errors else None # Simplified stack

    if isinstance(exc, httpx.ConnectError):
        return BareError(500, "CONNECTION_REFUSED", f"{id_prefix}.CONNECTION_REFUSED", "The remote rejected the request.", stack)
    if isinstance(exc, httpx.NameResolutionError):
        return BareError(500, "HOST_NOT_FOUND", f"{id_prefix}.HOST_NOT_FOUND", "The specified host could not be resolved.", stack)
    if isinstance(exc, httpx.ConnectTimeout) or isinstance(exc, httpx.ReadTimeout) or isinstance(exc, httpx.WriteTimeout):
        return BareError(500, "CONNECTION_TIMEOUT", f"{id_prefix}.CONNECTION_TIMEOUT", "The connection timed out.", stack)
    if isinstance(exc, httpx.HTTPStatusError): # Error from remote server (4xx, 5xx)
            # For V1, the proxy itself returns 200, and remote status is in headers.
            # This conversion is more for internal errors or if we decide to reflect remote status directly in some cases.
            # For now, this will be caught and handled by the main proxy logic.
            # Let's make a generic internal error for this if it's not handled before this function.
        return BareError(500, "REMOTE_HTTP_ERROR", f"{id_prefix}.REMOTE_HTTP_ERROR", f"Remote server returned HTTP {exc.response.status_code}", stack)

    # Generic error
    return BareError(500, "UNKNOWN_ERROR", f"{id_prefix}.UNKNOWN_ERROR", "An unexpected error occurred.", stack)
