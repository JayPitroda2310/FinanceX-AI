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
TICKER_URL = (
    "https://query1.finance.yahoo.com/v7/finance/spark"
    "?range=1d&interval=1d"
    "&symbols=%5ENSEI,%5EBSESN,BTC-USD,ETH-USD,GC%3DF,INR%3DX,CL%3DF,%5EN225,%5EDJI,RELIANCE.NS,TCS.NS,HDFCBANK.NS"
)
MODEL_ID = "openrouter/auto"
FALLBACK_MODELS = []
TICKER_INSTRUMENTS = [
    {"key": "^NSEI", "label": "NIFTY 50", "format": "inr"},
    {"key": "^BSESN", "label": "SENSEX", "format": "inr"},
    {"key": "BTC-USD", "label": "BTC/USD", "format": "usd"},
    {"key": "ETH-USD", "label": "ETH/USD", "format": "usd"},
    {"key": "GC=F", "label": "GOLD", "format": "usd"},
    {"key": "INR=X", "label": "USD/INR", "format": "fx"},
    {"key": "CL=F", "label": "CRUDE OIL", "format": "usd"},
    {"key": "^N225", "label": "NIKKEI", "format": "plain"},
    {"key": "^DJI", "label": "DOW JONES", "format": "plain"},
    {"key": "RELIANCE.NS", "label": "RELIANCE", "format": "inr"},
    {"key": "TCS.NS", "label": "TCS", "format": "inr"},
    {"key": "HDFCBANK.NS", "label": "HDFC BANK", "format": "inr"},
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

    def do_GET(self) -> None:
        if self.path == "/api/market-ticker":
            self.handle_market_ticker()
            return

        super().do_GET()

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
        except urllib.error.URLError as error:
            self.send_json(
                500,
                {"error": {"message": f"Server request to OpenRouter failed: {error.reason}"}},
            )
        except Exception as error:
            self.send_json(
                500,
                {"error": {"message": f"Unexpected server error: {error}"}},
            )

    def handle_market_ticker(self) -> None:
        request = urllib.request.Request(
            TICKER_URL,
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0",
                "X-Title": "FinanceAI",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(request) as response:
                raw_response = response.read().decode("utf-8")
                data = parse_json(raw_response)
                self.send_json(200, {"items": normalize_ticker_items(data)})
        except urllib.error.HTTPError as error:
            raw_response = error.read().decode("utf-8")
            self.send_json(error.code, parse_json(raw_response))
        except urllib.error.URLError as error:
            self.send_json(
                500,
                {"error": {"message": f"Ticker request failed: {error.reason}"}},
            )
        except Exception as error:
            self.send_json(
                500,
                {"error": {"message": f"Unexpected ticker error: {error}"}},
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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


def parse_json(raw_body: str) -> dict:
    try:
        return json.loads(raw_body)
    except json.JSONDecodeError:
        return {}


def normalize_ticker_items(data: dict) -> list[dict]:
    results = {
        item.get("symbol"): (item.get("response") or [{}])[0].get("meta", {})
        for item in data.get("spark", {}).get("result", [])
    }
    items = []

    for instrument in TICKER_INSTRUMENTS:
        meta = results.get(instrument["key"], {})
        current = float(meta.get("regularMarketPrice") or 0)
        previous = float(meta.get("chartPreviousClose") or current or 0)
        if current <= 0:
            continue

        change_percent = ((current - previous) / previous * 100) if previous else 0
        items.append(
            {
                "s": instrument["label"],
                "v": format_ticker_value(current, instrument["format"]),
                "c": format_ticker_change(change_percent),
                "u": 1 if change_percent >= 0 else 0,
            }
        )

    return items


def format_ticker_value(value: float, format_name: str) -> str:
    if format_name == "usd":
        digits = 0 if value >= 100 else 2
        return f"${value:,.{digits}f}"

    if format_name == "inr":
        digits = 0 if value >= 100 else 2
        return f"Rs{value:,.{digits}f}"

    if format_name == "fx":
        return f"{value:.2f}"

    digits = 0 if value >= 100 else 2
    return f"{value:,.{digits}f}"


def format_ticker_change(value: float) -> str:
    sign = "+" if value >= 0 else ""
    return f"{sign}{value:.2f}%"


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
