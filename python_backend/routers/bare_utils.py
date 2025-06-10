# python_backend/routers/bare_utils.py
import ipaddress
import socket
import asyncio # Required for getaddrinfo

# Local import for BareError, assuming it's in bare_exceptions.py at the same level
# from .bare_exceptions import BareError # This will be used by resolve_and_filter_hostname

def is_ip_forbidden(ip_str: str) -> bool:
    """Checks if an IP address string is forbidden (e.g., private, loopback, multicast)."""
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
            or ip_obj.is_unspecified # Added this for completeness
        ):
            return True
        if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.is_unique_local:
            return True
        return False
    except ValueError:
        # If ip_str is not a valid IP address (e.g. a hostname string passed by mistake)
        return True # Treat invalid IP strings as problematic/forbidden for this check

async def resolve_and_filter_hostname(hostname: str, log_errors: bool = False, app_log_errors: bool = False) -> list[str]:
    """
    Resolves a hostname to a list of IP addresses and filters them.
    Returns a list of allowed IP addresses.
    Raises an exception (e.g., BareError) if any resolved IP is forbidden or resolution fails.
    """
    # Import here to avoid circular dependency issues at module load time
    from .bare_exceptions import BareError

    allowed_ips = []
    try:
        addr_infos = await asyncio.get_running_loop().getaddrinfo(
            hostname, None,
            type=socket.SOCK_STREAM
        )

        if not addr_infos:
            raise BareError(500, "HOST_NOT_FOUND", "dns.resolve", f"DNS resolution failed for {hostname}: No addresses found.", stack=None)

        resolved_ips = list(set([info[4][0] for info in addr_infos])) # Use set to get unique IPs

        for ip_str in resolved_ips:
            if is_ip_forbidden(ip_str):
                if app_log_errors or log_errors: print(f"Forbidden IP resolved for {hostname}: {ip_str}")
                raise BareError(403, "FORBIDDEN_IP", "dns.resolve.forbidden", f"Resolved IP address {ip_str} for host {hostname} is forbidden.", stack=None)
            allowed_ips.append(ip_str)

        if not allowed_ips:
            raise BareError(500, "HOST_NOT_FOUND", "dns.resolve.no_allowed_ips", f"No allowed IP addresses found for {hostname} after filtering.", stack=None)

        return allowed_ips

    except socket.gaierror as e:
        if app_log_errors or log_errors: print(f"DNS resolution failed for {hostname}: {e}")
        raise BareError(500, "HOST_NOT_FOUND", "dns.resolve.gaierror", f"DNS resolution failed for host {hostname}: {e}", stack=str(e) if (app_log_errors or log_errors) else None)
    except BareError:
        raise
    except Exception as e:
        if app_log_errors or log_errors: print(f"Unexpected error during DNS resolution for {hostname}: {e}")
        raise BareError(500, "INTERNAL_ERROR", "dns.resolve.unexpected", f"An unexpected error occurred during DNS resolution for {hostname}.", stack=str(e) if (app_log_errors or log_errors) else None)


MAX_HEADER_VALUE = 3072 # From splitHeaderUtil.ts

def join_incoming_bare_headers(request_headers: 'httpx.Headers') -> 'httpx.Headers': # Forward reference for httpx.Headers
    # Implements logic from joinHeaders in splitHeaderUtil.ts
    # Modifies a copy of headers if reconstruction happens.
    import httpx # Import here for type checking if needed, or rely on caller's context for httpx types

    # Check if x-bare-headers-0 exists
    if f"x-bare-headers-0" not in request_headers:
        return request_headers # No split headers, return original

    reconstructed_parts = []
    # Create a mutable dictionary from the Headers object items
    temp_headers_dict = {k.lower(): v for k, v in request_headers.items()}

    i = 0
    while True:
        part_header_name = f"x-bare-headers-{i}"
        if part_header_name in temp_headers_dict:
            value = temp_headers_dict[part_header_name]
            if not value.startswith(';'):
                # from .bare_exceptions import BareError # Conditional import
                # raise BareError(400, "INVALID_BARE_HEADER", f"request.headers.{part_header_name}", "Split header part didn't begin with semi-colon.")
                print(f"Warning: Split header {part_header_name} didn't begin with semi-colon.")
                return request_headers # Return original on error

            reconstructed_parts.append(value[1:]) # Strip leading ';'
            del temp_headers_dict[part_header_name] # Remove processed part
            i += 1
        else:
            break

    if reconstructed_parts:
        full_xbare_headers_value = "".join(reconstructed_parts)
        temp_headers_dict["x-bare-headers"] = full_xbare_headers_value
        # Create a new httpx.Headers object
        return httpx.Headers(temp_headers_dict)

    # This case should ideally not be reached if x-bare-headers-0 was present
    # but implies no parts were processed correctly or found after the first.
    return request_headers

def split_outgoing_bare_headers(response_headers: dict) -> dict:
    # Implements logic from splitHeaders in splitHeaderUtil.ts
    # Operates on a dictionary of headers before they are sent.
    if "x-bare-headers" in response_headers:
        value = response_headers["x-bare-headers"]
        # Ensure value is a string, as json.dumps might be used
        if not isinstance(value, str):
            value = str(value) # Or json.dumps(value) if it's complex, but Bare expects stringified JSON here

        if len(value) > MAX_HEADER_VALUE:
            del response_headers["x-bare-headers"]
            split_id = 0
            for i in range(0, len(value), MAX_HEADER_VALUE):
                part = value[i:i + MAX_HEADER_VALUE]
                response_headers[f"x-bare-headers-{split_id}"] = f";{part}"
                split_id += 1
    return response_headers
