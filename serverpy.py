import functools
import http.server
import json
import os
import socket
import socketserver
import subprocess
import threading
import time
import requests
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 3001

# Track the currently playing audio subprocess
_audio_process: subprocess.Popen = None
_audio_lock = threading.Lock()

# Google Apps Script Email Bridge Settings
# This is used to bypass network restrictions on standard SMTP ports
GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxS2_nf5XRzvP6O10IXm95L_AZKDkecODWNc6eM2UiyUkINAB35vhgVwW4nzI3awYLr/exec"
GOOGLE_SCRIPT_SECRET = "MY_STETHO_TOKEN_2026"

# (Fallback) Actual Email settings
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465  # Use 465 for SSL or 587 for STARTTLS
SMTP_USER = "heartlung18@gmail.com"
SMTP_PASS = "ctii ntrw hnij wizo"

# Shared state for the latest scan delivered to the web app.
state_lock = threading.Lock()
latest_scan: Dict[str, Any] = {
    "uid": None,
    "raw_uid": None,
    "timestamp": None,
    "sequence": 0,
    "source": None,
}

# RFID libraries fallback
try:
    import RPi.GPIO as GPIO  # type: ignore
    from mfrc522 import SimpleMFRC522  # type: ignore

    reader = SimpleMFRC522()
    RFID_AVAILABLE = True
    RFID_ERROR = None
except Exception as exc:  # pragma: no cover - hardware dependent
    print("[WARNING] Hardware libraries or RFID reader are not available.")
    print(f"Running without live RFID hardware. Reason: {exc}")
    RFID_AVAILABLE = False
    RFID_ERROR = str(exc)
    GPIO = None
    reader = None


def _bytes_from_uid(uid_raw: Any) -> Optional[List[int]]:
    """Convert several UID formats into a list of byte values."""
    if uid_raw is None:
        return None

    if isinstance(uid_raw, (list, tuple)):
        try:
            values = [int(part) & 0xFF for part in uid_raw]
            return values or None
        except Exception:
            return None

    if isinstance(uid_raw, int):
        try:
            hex_value = format(uid_raw, "X")
            if len(hex_value) % 2:
                hex_value = "0" + hex_value
            return [int(hex_value[i:i + 2], 16) for i in range(0, len(hex_value), 2)]
        except Exception:
            return None

    raw = str(uid_raw).strip().upper()
    if not raw:
        return None

    if raw.isdigit():
        try:
            return _bytes_from_uid(int(raw))
        except Exception:
            return None

    compact = "".join(ch for ch in raw if ch in "0123456789ABCDEF")
    if compact and len(compact) % 2 == 0:
        try:
            return [int(compact[i:i + 2], 16) for i in range(0, len(compact), 2)]
        except Exception:
            return None

    return None


def normalize_uid(uid_raw: Any) -> Optional[str]:
    bytes_list = _bytes_from_uid(uid_raw)
    if not bytes_list:
        return None
    return " ".join(f"{byte:02X}" for byte in bytes_list)


def uid_aliases(uid_raw: Any) -> List[str]:
    """Return useful aliases for matching short and long UID forms."""
    bytes_list = _bytes_from_uid(uid_raw)
    if not bytes_list:
        return []

    aliases = []

    def add(alias_bytes: List[int]) -> None:
        alias = " ".join(f"{byte:02X}" for byte in alias_bytes)
        if alias not in aliases:
            aliases.append(alias)

    add(bytes_list)

    # RC522 often reports the short cascade representation:
    # 88 04 A8 3C 18  -> useful core is 04 A8 3C
    if len(bytes_list) == 5 and bytes_list[0] == 0x88:
        core3 = bytes_list[1:4]
        add(core3)

    # Some older maps stored the 7-byte UID. Accept its 3-byte prefix too.
    if len(bytes_list) >= 7:
        add(bytes_list[:3])
        short = [0x88, bytes_list[0], bytes_list[1], bytes_list[2], 0]
        short[4] = short[0] ^ short[1] ^ short[2] ^ short[3]
        add(short)

    return aliases


def set_latest_scan(uid: Optional[str], raw_uid: Any, source: str) -> None:
    now = time.time()
    with state_lock:
        latest_scan["uid"] = uid
        latest_scan["raw_uid"] = str(raw_uid) if raw_uid is not None else None
        latest_scan["timestamp"] = now
        latest_scan["sequence"] = int(latest_scan.get("sequence", 0)) + 1
        latest_scan["source"] = source


def get_latest_scan(clear: bool = False) -> Dict[str, Any]:
    with state_lock:
        payload = dict(latest_scan)
        if clear:
            latest_scan["uid"] = None
            latest_scan["raw_uid"] = None
            latest_scan["timestamp"] = None
            latest_scan["source"] = None
        return payload


def rfid_loop() -> None:  # pragma: no cover - hardware dependent
    """Continuously listen for RFID tags and expose the latest scan to the web app."""
    global reader

    print("RFID reader is ready. Scan a tag...")

    while True:
        try:
            text = None
            try:
                uid = reader.read_id()  # safer when text blocks are not needed
            except AttributeError:
                uid, text = reader.read()

            normalized = normalize_uid(uid)
            aliases = uid_aliases(uid)
            set_latest_scan(normalized, uid, "hardware")

            print("\n[RFID] Tag detected!")
            print(f"[RFID] Raw UID:       {uid}")
            print(f"[RFID] Normalized UID: {normalized}")
            if aliases:
                print(f"[RFID] Match aliases:  {', '.join(aliases)}")
            if text:
                text_value = str(text).strip()
                if text_value:
                    print(f"[RFID] Text:          {text_value}")

            # Debounce repeated reads from the same card resting on the reader.
            time.sleep(1.0)
        except Exception as exc:
            print(f"[RFID ERROR] {exc}")
            time.sleep(1.0)


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self) -> None:
        # Avoid stale JS/CSS/HTML on the Raspberry Pi kiosk browser.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/latest-scan":
            payload = get_latest_scan(clear=True)
            uid = payload.get("uid")
            aliases = uid_aliases(uid)
            self._send_json(
                {
                    "uid": uid,
                    "raw_uid": payload.get("raw_uid"),
                    "timestamp": payload.get("timestamp"),
                    "sequence": payload.get("sequence"),
                    "source": payload.get("source"),
                    "aliases": aliases,
                }
            )
            return

        if self.path == "/health":
            payload = get_latest_scan(clear=False)
            self._send_json(
                {
                    "ok": True,
                    "rfid_available": RFID_AVAILABLE,
                    "rfid_error": RFID_ERROR,
                    "latest_uid": payload.get("uid"),
                    "latest_raw_uid": payload.get("raw_uid"),
                    "latest_timestamp": payload.get("timestamp"),
                    "latest_sequence": payload.get("sequence"),
                    "server_time": time.time(),
                }
            )
            return

        super().do_GET()

    def do_POST(self) -> None:
        global _audio_process
        if self.path == "/scan-rfid":
            content_length = int(self.headers.get("Content-Length", "0"))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode("utf-8")) if post_data else {}
                raw_uid = data.get("raw_uid", data.get("uid"))
                normalized_uid = normalize_uid(data.get("uid") or raw_uid)
                set_latest_scan(normalized_uid, raw_uid, "post")
                print(f"[{self.log_date_time_string()}] RFID scan injected: raw={raw_uid} normalized={normalized_uid}")
                self._send_json({"success": True, "uid": normalized_uid})
            except Exception as exc:
                self._send_json({"success": False, "error": str(exc)}, status=500)
            return

        if self.path == "/send-email":
            content_length = int(self.headers.get("Content-Length", "0"))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode("utf-8")) if post_data else {}
                to_email = data.get("to")
                subject = data.get("subject")
                text = data.get("text")

                # Prefer Google Apps Script Bridge if configured
                if GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_URL != "YOUR_URL_HERE":
                    payload = {
                        "to": to_email,
                        "subject": subject,
                        "text": text,
                        "secret": GOOGLE_SCRIPT_SECRET
                    }
                    print(f"[{self.log_date_time_string()}] Sending email via Google Apps Script Bridge...")
                    resp = requests.post(GOOGLE_SCRIPT_URL, json=payload, timeout=15)
                    
                    if resp.status_code == 200 and resp.json().get("success"):
                        print(f"[{self.log_date_time_string()}] Bridge success: Email sent to {to_email}")
                        self._send_json({"success": True, "message": "Email sent via Google Bridge"})
                    else:
                        error_msg = resp.json().get("error") if resp.status_code == 200 else f"HTTP {resp.status_code}"
                        print(f"[{self.log_date_time_string()}] Bridge FAILED: {error_msg}")
                        raise Exception(f"Bridge error: {error_msg}")

                # Fallback to SMTP if bridge is not used and SMTP is configured
                elif SMTP_USER and SMTP_PASS:
                    import smtplib # local import to ensure it's there
                    msg = EmailMessage()
                    msg.set_content(text)
                    msg["Subject"] = subject
                    msg["From"] = SMTP_USER
                    msg["To"] = to_email

                    if SMTP_PORT == 465:
                        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
                            server.login(SMTP_USER, SMTP_PASS.replace(" ", ""))
                            server.send_message(msg)
                    else:
                        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                            server.starttls()
                            server.login(SMTP_USER, SMTP_PASS.replace(" ", ""))
                            server.send_message(msg)
                    
                    print(f"[{self.log_date_time_string()}] Real SMTP Email sent to {to_email}")
                    self._send_json({"success": True, "message": "Real email sent successfully via SMTP"})
                else:
                    # Fallback if unconfigured
                    print("\n" + "=" * 40)
                    print("--- MOCK EMAIL (SMTP NOT CONFIGURED) ---")
                    print("=" * 40)
                    print(f"To: {to_email}")
                    print(f"Subject: {subject}")
                    print(f"Body:\n{text}")
                    print("=" * 40 + "\n")
                    self._send_json({"success": True, "message": "Email logged to console (SMTP credentials missing)"})

            except Exception as exc:
                print(f"Error handling /send-email: {exc}")
                self._send_json({"success": False, "error": str(exc)}, status=500)
            return

        if self.path == "/play-sound":
            content_length = int(self.headers.get("Content-Length", "0"))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode("utf-8")) if post_data else {}
                point_id = data.get("pointId")
                point_name = data.get("pointName", "")
                status = data.get("status", "normal").upper()

                sound_file = os.path.join(
                    BASE_DIR, "sounds",
                    f"{point_id}{point_name}",
                    f"{status}{point_id}.mp3"
                )

                if not os.path.isfile(sound_file):
                    self._send_json({"success": False, "error": f"Sound file not found: {sound_file}"}, status=404)
                    return

                # Stop any currently playing audio
                with _audio_lock:
                    if _audio_process and _audio_process.poll() is None:
                        _audio_process.terminate()
                        try:
                            _audio_process.wait(timeout=2)
                        except subprocess.TimeoutExpired:
                            _audio_process.kill()

                    # Play the sound using mpg123 (lightweight MP3 player for Linux/RPi)
                    try:
                        _audio_process = subprocess.Popen(
                            ["mpg123", "-q", sound_file],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL
                        )
                    except FileNotFoundError:
                        # Fallback to aplay via ffmpeg conversion or omxplayer
                        try:
                            _audio_process = subprocess.Popen(
                                ["omxplayer", "--no-osd", sound_file],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL
                            )
                        except FileNotFoundError:
                            self._send_json({"success": False, "error": "No audio player found. Install mpg123: sudo apt install mpg123"}, status=500)
                            return

                print(f"[{self.log_date_time_string()}] Playing sound: {sound_file}")
                self._send_json({"success": True, "file": sound_file})
            except Exception as exc:
                print(f"Error handling /play-sound: {exc}")
                self._send_json({"success": False, "error": str(exc)}, status=500)
            return

        if self.path == "/stop-sound":
            try:
                with _audio_lock:
                    if _audio_process and _audio_process.poll() is None:
                        _audio_process.terminate()
                        try:
                            _audio_process.wait(timeout=2)
                        except subprocess.TimeoutExpired:
                            _audio_process.kill()
                        _audio_process = None
                self._send_json({"success": True})
            except Exception as exc:
                self._send_json({"success": False, "error": str(exc)}, status=500)
            return

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()


def get_local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("10.255.255.255", 1))
        ip = sock.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        sock.close()
    return ip


class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


try:
    if RFID_AVAILABLE:
        rfid_thread = threading.Thread(target=rfid_loop, daemon=True)
        rfid_thread.start()

    with ThreadingHTTPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        local_ip = get_local_ip()
        print("Server is running!")
        print(f"Access the project locally at: http://localhost:{PORT}/main.html")
        print(f"Access the project on your network at: http://{local_ip}:{PORT}/main.html")
        print(f"RFID available: {RFID_AVAILABLE}")
        if RFID_ERROR:
            print(f"RFID note: {RFID_ERROR}")
        print("Listening for RFID scans...")
        print("Listening for health checks on GET /health...")
        print("Listening for mock emails on POST /send-email...")
        print("Press Ctrl+C to stop the server.")
        httpd.serve_forever()
except OSError:
    print(f"Error: Port {PORT} is already in use. Please close any other servers or restart.")
except KeyboardInterrupt:
    print("\nShutting down...")
finally:
    if RFID_AVAILABLE and GPIO is not None:
        try:
            GPIO.cleanup()
        except Exception:
            pass
