"""
Mock FastMCP Server (for the CrewAI + FastMCP course)
=====================================================

A tiny, zero-dependency stand-in for a real FastMCP server, so the lesson
scripts can be exercised end-to-end without any external infrastructure.

It implements just the two endpoints the lessons use:

    POST /query   body: {"query": "..."}            -> {"result": "..."}
    POST /store   body: {"key": "...", "value": ...} -> {"ok": true, "key": "..."}

Plus a couple of conveniences for experimentation:

    GET  /fetch?key=KEY                              -> {"key": ..., "value": ...}
    GET  /health                                     -> {"status": "ok"}

Authentication
--------------
Every request must send  `Authorization: Bearer <token>`.
The expected token is read from FASTMCP_API_KEY (default: "test-key").

Stored values live in an in-memory dict, so they reset when the server stops.

Run
---
    # uses sensible defaults: http://127.0.0.1:8000 and api key "test-key"
    python mock_fastmcp_server.py

    # or customise
    FASTMCP_API_KEY=my-secret python mock_fastmcp_server.py --host 0.0.0.0 --port 9000

Then point the lessons at it (in another terminal):

    export FASTMCP_URL=http://127.0.0.1:8000
    export FASTMCP_API_KEY=test-key
    python lesson2_mcp_integration.py
"""

import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# In-memory key/value store shared across requests (single process).
_STORE: dict[str, str] = {}

# Default API key if the environment does not override it. Kept obvious on
# purpose — this is a local teaching mock, not a real credential.
EXPECTED_TOKEN = os.environ.get("FASTMCP_API_KEY", "test-key")


class MockFastMCPHandler(BaseHTTPRequestHandler):
    # ----- helpers --------------------------------------------------------
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        header = self.headers.get("Authorization", "")
        return header == f"Bearer {EXPECTED_TOKEN}"

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        # Compact one-line logging so the console stays readable.
        print(f"[mock-fastmcp] {self.command} {self.path} -> {fmt % args}")

    # ----- routes ---------------------------------------------------------
    def do_GET(self) -> None:  # noqa: N802 (stdlib naming)
        parsed = urlparse(self.path)

        if parsed.path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        if not self._authorized():
            self._send_json(401, {"error": "unauthorized"})
            return

        if parsed.path == "/fetch":
            key = parse_qs(parsed.query).get("key", [""])[0]
            if key in _STORE:
                self._send_json(200, {"key": key, "value": _STORE[key]})
            else:
                self._send_json(404, {"error": f"no value stored for key '{key}'"})
            return

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)

        if not self._authorized():
            self._send_json(401, {"error": "unauthorized"})
            return

        body = self._read_json_body()

        if parsed.path == "/query":
            query = str(body.get("query", "")).strip()
            if not query:
                self._send_json(400, {"error": "missing 'query'"})
                return
            # A real server would search a knowledge base or call a model.
            # The mock returns a deterministic, obviously-fake answer so it is
            # clear the data came from here and not from the LLM's own memory.
            result = (
                f"[mock data] Here is what the FastMCP server knows about "
                f"'{query}': it is a lightweight protocol for exposing tools "
                f"and data to AI agents. (This is placeholder content served "
                f"by mock_fastmcp_server.py.)"
            )
            self._send_json(200, {"result": result})
            return

        if parsed.path == "/store":
            key = str(body.get("key", "")).strip()
            value = body.get("value", "")
            if not key:
                self._send_json(400, {"error": "missing 'key'"})
                return
            _STORE[key] = value
            self._send_json(200, {"ok": True, "key": key})
            return

        self._send_json(404, {"error": "not found"})


def main() -> None:
    parser = argparse.ArgumentParser(description="Mock FastMCP server for the course.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), MockFastMCPHandler)
    print(
        f"Mock FastMCP server listening on http://{args.host}:{args.port}\n"
        f"  expected api key: {EXPECTED_TOKEN!r} (set FASTMCP_API_KEY to change)\n"
        f"  endpoints: POST /query, POST /store, GET /fetch?key=, GET /health\n"
        f"  press Ctrl+C to stop."
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
