#!/usr/bin/env python3
"""
Nexus Agent Lite – Minimal Python agent for family laptops
WebSocket connection to Nexus server
Whitelisted commands ONLY: get_system_info, read_file, list_folder, clipboard_read
Heartbeat every 30 seconds, auto-reconnect on disconnect

Usage:
  pip3 install requests psutil watchdog pymupdf
  python3 nexus_agent_lite.py --code 123456 --server http://100.x.x.x:8000
"""

import argparse
import json
import os
import platform
import socket
import sys
import threading
import time
from pathlib import Path

import psutil
import requests

try:
    import pyperclip
except ImportError:
    pyperclip = None

# ─── Config ───────────────────────────────────────────────────────────────────
HEARTBEAT_INTERVAL = 30  # seconds
RECONNECT_DELAY = 5  # seconds between reconnect attempts
MAX_FILE_SIZE = 1_000_000  # 1 MB max file read
MAX_LIST_ENTRIES = 200  # max files in list_folder

# WHITELIST: only these commands are allowed, nothing else
ALLOWED_COMMANDS = {"get_system_info", "read_file", "list_folder", "clipboard_read"}

# Safe file extensions for read_file
SAFE_EXTENSIONS = {
    ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".csv",
    ".log", ".cfg", ".ini", ".yaml", ".yml", ".toml", ".xml", ".html",
    ".css", ".sh", ".bat", ".ps1", ".pdf",
}


class NexusAgentLite:
    """Minimal Nexus agent with WebSocket-style long-polling and heartbeat."""

    def __init__(self, server_url: str, pairing_code: str, name: str = None):
        self.server_url = server_url.rstrip("/")
        self.pairing_code = pairing_code
        self.agent_id: str | None = None
        self.agent_name = name or platform.node()
        self.running = True
        self.connected = False

    # ─── Registration ─────────────────────────────────────────────────────

    def register(self) -> bool:
        """Register with Nexus server using 6-digit pairing code."""
        print(f"[...] Verbinde mit {self.server_url} (Code: {self.pairing_code})")
        try:
            resp = requests.post(
                f"{self.server_url}/api/agents/register",
                json={
                    "pairingCode": self.pairing_code,
                    "name": self.agent_name,
                    "deviceType": self._detect_device_type(),
                    "capabilities": list(ALLOWED_COMMANDS),
                    "hostname": platform.node(),
                    "os": f"{platform.system()} {platform.release()}",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                self.agent_id = data.get("agentId", self.pairing_code)
                self.connected = True
                print(f"[OK] Registriert als '{self.agent_name}' (ID: {self.agent_id})")
                return True
            print(f"[FEHLER] Registrierung: {resp.status_code} – {resp.text}")
            return False
        except requests.ConnectionError:
            print(f"[FEHLER] Server nicht erreichbar: {self.server_url}")
            return False
        except Exception as e:
            print(f"[FEHLER] {e}")
            return False

    def _detect_device_type(self) -> str:
        s = platform.system().lower()
        if s == "darwin":
            return "laptop_mac"
        return "laptop_windows"

    # ─── Heartbeat ────────────────────────────────────────────────────────

    def _heartbeat_loop(self):
        """Send heartbeat every 30 seconds to keep agent marked online."""
        while self.running:
            try:
                cpu = psutil.cpu_percent(interval=0)
                mem = psutil.virtual_memory()
                requests.post(
                    f"{self.server_url}/api/agents/{self.agent_id}/heartbeat",
                    json={
                        "status": "online",
                        "cpu_percent": cpu,
                        "ram_percent": mem.percent,
                        "ram_used_gb": round(mem.used / (1024 ** 3), 1),
                        "timestamp": int(time.time()),
                    },
                    timeout=5,
                )
                self.connected = True
            except Exception:
                if self.connected:
                    print("[WARN] Heartbeat fehlgeschlagen – Verbindung verloren")
                    self.connected = False
            time.sleep(HEARTBEAT_INTERVAL)

    # ─── Command Polling (WebSocket-style long-poll) ──────────────────────

    def _poll_loop(self):
        """Poll server for commands. Long-poll with 30s timeout."""
        while self.running:
            try:
                resp = requests.get(
                    f"{self.server_url}/api/agents/{self.agent_id}/commands",
                    timeout=35,  # slightly longer than server long-poll
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for cmd in data.get("commands", []):
                        self._handle_command(cmd)
                elif resp.status_code == 204:
                    pass  # no commands pending
                else:
                    time.sleep(RECONNECT_DELAY)
            except requests.Timeout:
                pass  # normal for long-poll
            except requests.ConnectionError:
                if self.connected:
                    print("[WARN] Verbindung verloren – versuche Reconnect...")
                    self.connected = False
                time.sleep(RECONNECT_DELAY)
            except Exception as e:
                print(f"[FEHLER] Poll: {e}")
                time.sleep(RECONNECT_DELAY)

    # ─── Command Handler ─────────────────────────────────────────────────

    def _handle_command(self, cmd: dict):
        """Route command to handler. Only WHITELISTED commands allowed."""
        action = cmd.get("action", "")
        cmd_id = cmd.get("id", "unknown")
        params = cmd.get("params", {})

        # SECURITY: reject anything not in whitelist
        if action not in ALLOWED_COMMANDS:
            self._send_result(cmd_id, "error", f"Befehl nicht erlaubt: {action}")
            print(f"[BLOCKED] Unbekannter Befehl abgelehnt: {action}")
            return

        print(f"[CMD] {action} (ID: {cmd_id})")
        start = time.time()

        try:
            if action == "get_system_info":
                result = self._cmd_system_info()
            elif action == "read_file":
                result = self._cmd_read_file(params.get("path", ""))
            elif action == "list_folder":
                result = self._cmd_list_folder(params.get("path", ""))
            elif action == "clipboard_read":
                result = self._cmd_clipboard_read()
            else:
                result = ("error", "Nicht implementiert")

            duration = round((time.time() - start) * 1000)
            status, data = result
            self._send_result(cmd_id, status, data, duration)
            print(f"  -> {status} ({duration}ms)")
        except Exception as e:
            self._send_result(cmd_id, "error", str(e))
            print(f"  -> error: {e}")

    def _send_result(self, cmd_id: str, status: str, data, duration_ms: int = 0):
        """Send command result back to Nexus server."""
        try:
            requests.post(
                f"{self.server_url}/api/agents/{self.agent_id}/result",
                json={
                    "commandId": cmd_id,
                    "status": status,
                    "data": data,
                    "durationMs": duration_ms,
                },
                timeout=10,
            )
        except Exception as e:
            print(f"[WARN] Ergebnis senden fehlgeschlagen: {e}")

    # ─── Whitelisted Commands ─────────────────────────────────────────────

    def _cmd_system_info(self) -> tuple[str, dict]:
        """Get system info via psutil."""
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/" if platform.system() != "Windows" else "C:\\")
        boot = psutil.boot_time()
        uptime_h = round((time.time() - boot) / 3600, 1)

        return ("success", {
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "python": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(interval=1),
            "ram_total_gb": round(mem.total / (1024 ** 3), 1),
            "ram_used_gb": round(mem.used / (1024 ** 3), 1),
            "ram_percent": mem.percent,
            "disk_total_gb": round(disk.total / (1024 ** 3), 1),
            "disk_used_gb": round(disk.used / (1024 ** 3), 1),
            "disk_percent": disk.percent,
            "uptime_hours": uptime_h,
            "ip": self._get_local_ip(),
        })

    def _cmd_read_file(self, filepath: str) -> tuple[str, str]:
        """Read a file (text only, safe extensions, max 1MB)."""
        if not filepath:
            return ("error", "Kein Dateipfad angegeben")

        path = Path(filepath).expanduser().resolve()

        if not path.exists():
            return ("error", f"Datei nicht gefunden: {path}")

        if not path.is_file():
            return ("error", f"Kein reguläre Datei: {path}")

        if path.suffix.lower() not in SAFE_EXTENSIONS:
            return ("error", f"Dateityp nicht erlaubt: {path.suffix} – Erlaubt: {', '.join(sorted(SAFE_EXTENSIONS))}")

        size = path.stat().st_size
        if size > MAX_FILE_SIZE:
            return ("error", f"Datei zu groß: {size / 1024:.0f} KB (max {MAX_FILE_SIZE / 1024:.0f} KB)")

        try:
            content = path.read_text(encoding="utf-8", errors="replace")
            return ("success", content)
        except Exception as e:
            return ("error", f"Lesefehler: {e}")

    def _cmd_list_folder(self, folder: str) -> tuple[str, list]:
        """List files in a folder with metadata."""
        if not folder:
            return ("error", "Kein Ordnerpfad angegeben")

        path = Path(folder).expanduser().resolve()

        if not path.exists():
            return ("error", f"Ordner nicht gefunden: {path}")

        if not path.is_dir():
            return ("error", f"Kein Ordner: {path}")

        entries = []
        try:
            for item in sorted(path.iterdir()):
                if item.name.startswith("."):
                    continue  # skip hidden files
                stat = item.stat()
                entries.append({
                    "name": item.name,
                    "is_dir": item.is_dir(),
                    "size": stat.st_size if item.is_file() else None,
                    "modified": int(stat.st_mtime),
                    "extension": item.suffix.lower() if item.is_file() else None,
                })
                if len(entries) >= MAX_LIST_ENTRIES:
                    break
            return ("success", entries)
        except PermissionError:
            return ("error", f"Zugriff verweigert: {path}")
        except Exception as e:
            return ("error", f"Fehler: {e}")

    def _cmd_clipboard_read(self) -> tuple[str, str]:
        """Read current clipboard content."""
        if not pyperclip:
            return ("error", "pyperclip nicht installiert – pip3 install pyperclip")
        try:
            content = pyperclip.paste()
            if not content:
                return ("success", "(Zwischenablage leer)")
            # Truncate long content
            if len(content) > 5000:
                return ("success", content[:5000] + f"\n\n[... gekürzt, {len(content)} Zeichen gesamt]")
            return ("success", content)
        except Exception as e:
            return ("error", f"Clipboard-Fehler: {e}")

    # ─── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _get_local_ip() -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "unknown"

    # ─── Main Loop ────────────────────────────────────────────────────────

    def run(self):
        """Start agent: register, heartbeat, poll for commands."""
        print("=" * 50)
        print(f"  NEXUS AGENT LITE")
        print(f"  Gerät: {self.agent_name}")
        print(f"  Server: {self.server_url}")
        print(f"  Befehle: {', '.join(sorted(ALLOWED_COMMANDS))}")
        print("=" * 50)
        print()

        # Register with retry
        for attempt in range(5):
            if self.register():
                break
            if attempt < 4:
                print(f"[...] Neuer Versuch in {RECONNECT_DELAY}s... ({attempt + 2}/5)")
                time.sleep(RECONNECT_DELAY)
        else:
            print("[FEHLER] Registrierung nach 5 Versuchen fehlgeschlagen. Beende.")
            sys.exit(1)

        # Start background threads
        threading.Thread(target=self._heartbeat_loop, daemon=True, name="heartbeat").start()
        threading.Thread(target=self._poll_loop, daemon=True, name="poll").start()

        print()
        print("[OK] Agent läuft. Ctrl+C zum Beenden.")
        print()

        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[INFO] Agent wird beendet...")
            self.running = False
            # Send offline heartbeat
            try:
                requests.post(
                    f"{self.server_url}/api/agents/{self.agent_id}/heartbeat",
                    json={"status": "offline", "timestamp": int(time.time())},
                    timeout=3,
                )
            except Exception:
                pass
            print("[OK] Beendet.")


def main():
    parser = argparse.ArgumentParser(
        description="Nexus Agent Lite – Minimaler Agent für Laptops",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Beispiel:
  python3 nexus_agent_lite.py --code 123456 --server http://100.64.0.1:8000

Erlaubte Befehle:
  get_system_info   CPU, RAM, Disk, Uptime
  read_file         Textdateien lesen (max 1 MB)
  list_folder       Ordnerinhalt auflisten
  clipboard_read    Zwischenablage lesen
        """,
    )
    parser.add_argument("--code", required=True, help="6-stelliger Pairing-Code aus der NexusApp")
    parser.add_argument("--server", required=True, help="Nexus Server URL (z.B. http://100.64.0.1:8000)")
    parser.add_argument("--name", default=None, help="Gerätename (Standard: Hostname)")
    args = parser.parse_args()

    agent = NexusAgentLite(args.server, args.code, args.name)
    agent.run()


if __name__ == "__main__":
    main()
