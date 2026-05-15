from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import socket
import urllib.error
import urllib.request
import webbrowser


HOST = "127.0.0.1"
PORT = 8000
APP_FILE = "index.html"
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_ID = "openrouter/free"
FALLBACK_MODELS = [
    "openrouter/free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-120b:free",
]


def load_env_file(root: Path) -> None:
    for env_name in (".env.local", ".env"):
        env_path = root / env_name
        if not env_path.exists():
            continue

        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def get_local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


class FinanceAIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            self.send_json(404, {"error": {"message": "API route not found."}})
            return

        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            self.send_json(
                500,
                {
                    "error": {
                        "message": "Missing OPENROUTER_API_KEY. Add it to .env.local or your server environment."
                    }
                },
            )
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            self.send_json(400, {"error": {"message": "Invalid JSON request body."}})
            return

        upstream_body = json.dumps(
            {
                "model": MODEL_ID,
                "models": FALLBACK_MODELS,
                "max_tokens": 400,
                "temperature": 0.4,
                "provider": {"allow_fallbacks": True},
                "messages": payload.get("messages", []),
            }
        ).encode("utf-8")

        request = urllib.request.Request(
            API_URL,
            data=upstream_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "X-Title": "FinanceAI",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request) as response:
                raw_response = response.read().decode("utf-8")
                self.send_json(response.status, parse_json(raw_response))
        except urllib.error.HTTPError as error:
            raw_response = error.read().decode("utf-8")
            self.send_json(error.code, parse_json(raw_response))
        except urllib.error.URLError:
            self.send_json(
                500,
                {"error": {"message": "Server request to OpenRouter failed."}},
            )

    def send_json(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def send_cors_headers(self) -> None:
        origin = self.headers.get("Origin")
        allow_origin = origin if origin else "*"
        self.send_header("Access-Control-Allow-Origin", allow_origin)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


def parse_json(raw_body: str) -> dict:
    try:
        return json.loads(raw_body)
    except json.JSONDecodeError:
        return {}


def main() -> None:
    root = Path(__file__).resolve().parent
    load_env_file(root)

    handler = lambda *args, **kwargs: FinanceAIHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer((HOST, PORT), handler)

    local_url = f"http://{HOST}:{PORT}/{APP_FILE}"
    lan_url = f"http://{get_local_ip()}:{PORT}/{APP_FILE}"

    print("FinanceAI local server is running.")
    print(f"Desktop test URL: {local_url}")
    print(f"Same-network URL: {lan_url}")
    print("For local chat requests, add OPENROUTER_API_KEY to .env.local.")

    webbrowser.open(local_url)
    server.serve_forever()


if __name__ == "__main__":
    main()
