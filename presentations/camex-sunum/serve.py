#!/usr/bin/env python3
# DiaSAGE sunum sunucusu — ONBELLEKSIZ (no-cache) yerel HTTP sunucusu.
#
# Neden: `python -m http.server` hicbir Cache-Control basligi gondermez, bu yuzden
# tarayici index.html / styles.css / JS dosyalarini sezgisel olarak onbellege alir
# ve start-windows.bat ile actiginizda ESKI surumu gosterebilir. Bu sunucu her yanitta
# `Cache-Control: no-store` gondererek tarayicinin DAIMA en guncel dosyayi
# getirmesini garanti eder. Ayrica soket bind olduktan SONRA tarayiciyi
# her acilista benzersiz bir ust-duzey sorgu (`?open=<ts>`) ile acar; bu, daha
# once onbellege alinmis ESKI index.html'i gecis aninda by-pass eder (boylece
# elle sert-yenileme gerekmez). (Tasarim: collab-board Claude+Codex mutabakati.)
#
# Kullanim: start-windows.bat / start-macos.command / start-linux.sh bunu calistirir. Elle:  python serve.py
import argparse
import errno
import http.server
import os
import re
import socketserver
import threading
import time
import webbrowser

HOST = "127.0.0.1"
PORT = 8242
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Dogru MIME tipleri. Python varsayilani .glb/.stl icin octet-stream verir
    # (calisir ama temiz degil); ES modulu (.mjs) ve WASM (.wasm) zaten dogru,
    # acikca yaziyoruz ki Python surumunden bagimsiz garanti olsun.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".glb": "model/gltf-binary",
        ".stl": "model/stl",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".wasm": "application/wasm",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".woff2": "font/woff2",
    }

    def end_headers(self):
        # Tarayicinin hicbir seyi onbellege almasini engelle -> her zaman taze icerik.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        # Range destegini her yanitta ilan et (200 dahil). Safari <video> oynatmak
        # icin Accept-Ranges + 206 ister; serve.mjs / serve-presentation.ps1 zaten
        # boyle davranir.
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, fmt, *args):
        try:
            super().log_message(fmt, *args)
        except Exception:
            pass

    # --- HTTP Range (206 Partial Content) destegi --------------------------------
    # SimpleHTTPRequestHandler Range'i yok sayar ve daima 200 + tam govde gonderir.
    # Safari, <video> icin byte-range (206) zorunlu kilar; ayrica 16.9 MB tanitim
    # videosunda arama (seek) ve hizli baslangic bunu gerektirir. Node (serve.mjs)
    # ve PowerShell (serve-presentation.ps1) yedekleri zaten Range destekler — bu
    # birincil sunucuyu da ayni davranisa getiriyoruz.
    # (collab-board review 2026-06-29, impl point I1.)

    @staticmethod
    def _parse_byte_range(range_header, file_len):
        # Tek aralik destegi (video icin yeterli): "bytes=start-end" / "bytes=start-"
        # / "bytes=-suffix". Donus: ("full"|"partial"|"unsat", start, end).
        #   full   -> Range yok sayilir, normal 200 (cozumlenemeyen istek)
        #   unsat  -> 416 Range Not Satisfiable
        match = re.match(r"^bytes=(\d*)-(\d*)$", range_header.strip())
        if not match:
            return ("full", 0, 0)

        first, last = match.group(1), match.group(2)
        if first == "" and last == "":
            return ("full", 0, 0)

        if first == "":
            # Son N byte.
            start = max(0, file_len - int(last))
            end = file_len - 1
        else:
            start = int(first)
            end = int(last) if last != "" else file_len - 1
            end = min(end, file_len - 1)

        if start >= file_len or start > end:
            return ("unsat", 0, 0)
        return ("partial", start, end)

    def send_head(self):
        # Her istek basinda sifirla (keep-alive ile ayni handler ornegi yeniden kullanilir).
        self._range_remaining = None

        range_header = self.headers.get("Range")
        if not range_header:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        try:
            st = os.stat(path)
        except OSError:
            return super().send_head()  # var olmayan dosya -> super 404 uretir

        file_len = st.st_size
        status, start, end = self._parse_byte_range(range_header, file_len)

        if status == "full":
            return super().send_head()

        if status == "unsat":
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % file_len)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        try:
            f = open(path, "rb")
        except OSError:
            return super().send_head()

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, file_len))
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Last-Modified", self.date_time_string(st.st_mtime))
        self.end_headers()
        f.seek(start)
        self._range_remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        # 206 ise yalnizca istenen byte araligini gonder; aksi halde normal kopyala.
        remaining = getattr(self, "_range_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)

        self._range_remaining = None
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


MAX_PORT_ATTEMPTS = 50


def parse_args():
    parser = argparse.ArgumentParser(description="DiaSAGE onbelleksiz yerel sunum sunucusu")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--max-port-attempts", type=int, default=MAX_PORT_ATTEMPTS)
    parser.add_argument("--no-browser", action="store_true")
    return parser.parse_args()


def create_server(host, preferred_port, max_attempts):
    last_error = None

    for offset in range(max_attempts):
        port = preferred_port + offset

        try:
            return Server((host, port), NoCacheHandler)
        except OSError as exc:
            last_error = exc

            if offset == 0:
                print("Port %d kullanilamiyor; sonraki portlar denenecek." % preferred_port)

            if exc.errno not in (errno.EADDRINUSE, errno.EACCES, 10048, 10013):
                break

    print("DiaSAGE sunum sunucusu baslatilamadi (%s:%d-%d)." % (host, preferred_port, preferred_port + max_attempts - 1))
    if last_error:
        print(str(last_error))
    print("Lutfen diger sunum pencerelerini kapatip tekrar deneyin.")
    raise SystemExit(2)


def open_browser(host, port):
    # Her acilista benzersiz ust-duzey sorgu -> mevcut bayat index.html onbellegini
    # gecis aninda by-pass eder. Deste yalnizca URL hash'ini (#1, #2 ...) okur;
    # bu sorgu yok sayilir.
    url = "http://%s:%d/index.html?open=%d" % (host, port, int(time.time() * 1000))
    try:
        webbrowser.open(url)
    except Exception:
        pass


if __name__ == "__main__":
    args = parse_args()
    os.chdir(ROOT)

    httpd = create_server(args.host, args.port, args.max_port_attempts)

    with httpd:
        actual_port = httpd.server_address[1]
        print("DiaSAGE sunum sunucusu (no-cache) hazir: http://%s:%d/index.html" % (args.host, actual_port))
        if args.no_browser:
            print("Tarayici test modu nedeniyle acilmadi.")
        else:
            print("Tarayici otomatik acilacak. Bu pencereyi KAPATMAYIN; sunum bitince kapatabilirsiniz.")
            # Soket bind oldu; serve_forever calismaya basladiktan hemen sonra
            # (kisa gecikmeli arka plan thread'i) tarayiciyi ac -> baglanti hazir.
            threading.Timer(0.6, open_browser, args=(args.host, actual_port)).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
