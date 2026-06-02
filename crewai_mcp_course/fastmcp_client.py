"""
FastMCP client helpers (pure Python, no CrewAI dependency)
==========================================================

This module isolates all the HTTP logic for talking to a FastMCP server:
reading configuration from the environment, sending authenticated requests,
and converting failures into readable messages.

Keeping it separate from the CrewAI tools means:
  * the lesson tools (Lessons 2 & 3) stay thin and just delegate here, and
  * this logic can be unit-tested offline with no LLM and no API key
    (see test_offline.py).

Endpoints used:
    POST /query   {"query": ...}            -> {"result": ...}
    POST /store   {"key": ..., "value": ...} -> {"ok": true, ...}
"""

import os

import requests

# Default per-request timeout (seconds). Network calls must never hang forever.
DEFAULT_TIMEOUT = 30


def _base_url() -> str:
    url = os.environ.get("FASTMCP_URL")
    if not url:
        raise RuntimeError("FASTMCP_URL is not set.")
    return url.rstrip("/")


def _headers() -> dict:
    key = os.environ.get("FASTMCP_API_KEY")
    if not key:
        raise RuntimeError("FASTMCP_API_KEY is not set.")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def query(text: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    """Ask the FastMCP server a question and return its answer as a string.

    On any network/auth/HTTP failure this returns a human-readable error string
    (prefixed with '[fastmcp_query error]') instead of raising, so an agent can
    decide how to react rather than crashing the whole crew.
    """
    try:
        response = requests.post(
            f"{_base_url()}/query",
            headers=_headers(),
            json={"query": text},
            timeout=timeout,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        return f"[fastmcp_query error] Request timed out after {timeout}s."
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "?"
        if status == 401:
            return "[fastmcp_query error] Authentication failed (401). Check FASTMCP_API_KEY."
        return f"[fastmcp_query error] Server returned HTTP {status}."
    except requests.exceptions.RequestException as exc:
        return f"[fastmcp_query error] Could not reach the MCP server: {exc}"

    try:
        return str(response.json().get("result", response.text))
    except ValueError:
        return response.text


def store(key: str, value: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    """Persist a value under a key on the FastMCP server.

    Returns a confirmation string, or a '[fastmcp_store error] ...' message on
    failure (never raises for network/HTTP problems).
    """
    if not key:
        return "[fastmcp_store error] A non-empty key is required."
    try:
        response = requests.post(
            f"{_base_url()}/store",
            headers=_headers(),
            json={"key": key, "value": value},
            timeout=timeout,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        return f"[fastmcp_store error] Request timed out after {timeout}s."
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "?"
        if status == 401:
            return "[fastmcp_store error] Authentication failed (401). Check FASTMCP_API_KEY."
        return f"[fastmcp_store error] Server returned HTTP {status}."
    except requests.exceptions.RequestException as exc:
        return f"[fastmcp_store error] Could not reach the MCP server: {exc}"

    return f"Stored finding under key '{key}'."
