"""
Offline test for the CrewAI + FastMCP course
============================================

Exercises the data-plane of the lessons end-to-end WITHOUT any LLM API key and
WITHOUT CrewAI installed:

    mock_fastmcp_server  <-->  fastmcp_client  (the same client the lesson tools use)

It starts the mock server on a free port in a background thread, points the
client at it via environment variables, and checks the happy paths plus the
error handling (bad auth, unreachable server).

Run
---
    python test_offline.py        # prints PASS/FAIL per check, exits non-zero on failure

Only depends on the standard library + `requests` (already in requirements.txt),
so it is safe to run in CI with no secrets configured.
"""

import os
import socket
import threading
from http.server import ThreadingHTTPServer

import fastmcp_client
import mock_fastmcp_server


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _Checker:
    def __init__(self) -> None:
        self.failures = 0

    def check(self, name: str, condition: bool, detail: str = "") -> None:
        status = "PASS" if condition else "FAIL"
        line = f"[{status}] {name}"
        if detail and not condition:
            line += f"  -- {detail}"
        print(line)
        if not condition:
            self.failures += 1


def main() -> int:
    port = _free_port()
    api_key = "test-key"

    # Configure both the mock server and the client through the environment,
    # exactly as a learner would.
    os.environ["FASTMCP_API_KEY"] = api_key
    os.environ["FASTMCP_URL"] = f"http://127.0.0.1:{port}"
    # The handler reads the expected token at request time from this module-level
    # value, so keep it in sync with the env var.
    mock_fastmcp_server.EXPECTED_TOKEN = api_key

    server = ThreadingHTTPServer(("127.0.0.1", port), mock_fastmcp_server.MockFastMCPHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    c = _Checker()
    try:
        # --- happy path: query returns server-sourced data -----------------
        answer = fastmcp_client.query("what is FastMCP?")
        c.check(
            "query returns mock data",
            answer.startswith("[mock data]"),
            detail=f"got: {answer!r}",
        )

        # --- happy path: store then verify it round-trips ------------------
        store_msg = fastmcp_client.store("research:topic", "key finding one")
        c.check(
            "store confirms success",
            store_msg == "Stored finding under key 'research:topic'.",
            detail=f"got: {store_msg!r}",
        )

        # Read it back through the mock's /fetch endpoint to prove persistence.
        import requests

        fetched = requests.get(
            f"http://127.0.0.1:{port}/fetch",
            params={"key": "research:topic"},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=5,
        ).json()
        c.check(
            "stored value is retrievable",
            fetched.get("value") == "key finding one",
            detail=f"got: {fetched!r}",
        )

        # --- error path: wrong API key -> 401 handled gracefully ----------
        os.environ["FASTMCP_API_KEY"] = "wrong-key"
        bad_auth = fastmcp_client.query("anything")
        c.check(
            "bad auth returns a 401 error string (no exception)",
            bad_auth.startswith("[fastmcp_query error]") and "401" in bad_auth,
            detail=f"got: {bad_auth!r}",
        )
        os.environ["FASTMCP_API_KEY"] = api_key  # restore

        # --- error path: unreachable server -> handled gracefully ---------
        os.environ["FASTMCP_URL"] = f"http://127.0.0.1:{_free_port()}"  # nothing listening
        unreachable = fastmcp_client.query("anything", timeout=2)
        c.check(
            "unreachable server returns an error string (no exception)",
            unreachable.startswith("[fastmcp_query error]"),
            detail=f"got: {unreachable!r}",
        )
        os.environ["FASTMCP_URL"] = f"http://127.0.0.1:{port}"  # restore
    finally:
        server.shutdown()

    print()
    if c.failures:
        print(f"{c.failures} check(s) FAILED")
        return 1
    print("All checks PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
