"""CAMEX desktop shell (Cellular Analysis of Morphology with XAI for PC12) (D16): FastAPI on localhost + a pywebview window.

Double-click flow (launcher/run.bat or the PyInstaller onedir .exe):
  1. start the FastAPI server in a background thread (it spawns the worker
     pools and warms them - the "model preparing" badge)
  2. wait until /api/health answers (the window never opens on a dead backend)
  3. open a native WebView2 window on http://127.0.0.1:<port>

Everything is local; nothing is fetched from the internet.
"""
from __future__ import annotations

import multiprocessing as mp
import os
import socket
import sys
import threading
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "server"))


def _free_port(preferred: int) -> int:
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]


def _wait_healthy(url: str, timeout: float = 60.0) -> bool:
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                if r.status == 200:
                    return True
        except OSError:
            time.sleep(0.2)
    return False


def main() -> None:
    # PyInstaller --windowed sets stdout/stderr to None; uvicorn logging needs a stream
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")

    import uvicorn

    import main as server

    port = _free_port(int(os.environ.get("CAMEX_PORT") or os.environ.get("INTELLICELL_PORT", "8765")))
    config = uvicorn.Config(server.app, host="127.0.0.1", port=port, log_level="warning")
    srv = uvicorn.Server(config)
    threading.Thread(target=srv.run, daemon=True, name="api").start()
    base = f"http://127.0.0.1:{port}"
    if not _wait_healthy(f"{base}/api/health"):
        raise SystemExit("CAMEX backend did not start")

    if os.environ.get("CAMEX_BROWSER") or os.environ.get("INTELLICELL_BROWSER"):   # debugging: use the system browser
        import webbrowser

        webbrowser.open(base)
        while True:
            time.sleep(3600)

    import webview

    webview.create_window("CAMEX — Cellular Analysis of Morphology with XAI for PC12", base, width=1600, height=1000, min_size=(1200, 760), background_color="#0b0c11")
    webview.start()
    srv.should_exit = True


if __name__ == "__main__":
    mp.freeze_support()   # required for the worker process pools in a frozen .exe
    main()
