from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import webbrowser


HOST = "127.0.0.1"
PORT = 8000
APP_FILE = "index.html"


def get_local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def main() -> None:
    root = Path(__file__).resolve().parent
    handler = lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer((HOST, PORT), handler)

    local_url = f"http://{HOST}:{PORT}/{APP_FILE}"
    lan_url = f"http://{get_local_ip()}:{PORT}/{APP_FILE}"

    print("FinanceAI local server is running.")
    print(f"Desktop test URL: {local_url}")
    print(f"Same-network URL: {lan_url}")
    print("Note: mobile home-screen install usually requires HTTPS, not a local network HTTP URL.")

    webbrowser.open(local_url)
    server.serve_forever()


if __name__ == "__main__":
    main()
