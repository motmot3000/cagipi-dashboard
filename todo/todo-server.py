#!/usr/bin/env python3
"""Mini-serveur todos du dashboard {CagiPi} — stdlib uniquement.

GET /todos  -> liste JSON [{id, text, done}, ...]
PUT /todos  -> remplace la liste entière (écriture atomique tmp+rename)

Écoute sur 127.0.0.1:8765, exposé par nginx via `location /todos`.
Stockage : ~/cagibi-dashboard/todos.json (séparé de data.json, jamais
touché par generate.sh).
"""
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PATH = os.path.expanduser("~/cagibi-dashboard/todos.json")
MAX_BODY = 256 * 1024  # garde-fou : la liste reste petite


def load():
    try:
        with open(PATH, encoding="utf-8") as f:
            todos = json.load(f)
        return todos if isinstance(todos, list) else []
    except (OSError, ValueError):
        return []


def save(todos):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(PATH), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(todos, f, ensure_ascii=False)
    os.replace(tmp, PATH)


def sanitize(raw):
    """Ne garder que id/text/done, types forcés — le client n'est pas fiable."""
    todos = []
    for t in raw:
        if not isinstance(t, dict) or not t.get("text"):
            continue
        todos.append({
            "id": str(t.get("id", ""))[:64],
            "text": str(t["text"])[:500],
            "done": bool(t.get("done")),
        })
    return todos[:200]


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/todos":
            self._send(200, load())
        else:
            self._send(404, {"error": "not found"})

    def do_PUT(self):
        if self.path.rstrip("/") != "/todos":
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            return self._send(400, {"error": "bad length"})
        if n <= 0 or n > MAX_BODY:
            return self._send(413, {"error": "too large"})
        try:
            raw = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(raw, list):
                raise ValueError
        except ValueError:
            return self._send(400, {"error": "bad json"})
        todos = sanitize(raw)
        save(todos)
        self._send(200, todos)

    def log_message(self, *args):
        pass  # silence : nginx logge déjà


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
