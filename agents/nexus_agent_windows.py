#!/usr/bin/env python3
"""
Nexus Agent Windows – Extends Lite with Windows-specific features.
Capabilities: browser_control, app_launcher, screenshot, pc_status,
              trading_monitor, clipboard_rw, scheduled_tasks, ollama_status
"""

import argparse
import json
import os
import platform
import subprocess
import sys
import time
from pathlib import Path

import psutil
import requests

# Import base agent
sys.path.insert(0, os.path.dirname(__file__))
from nexus_agent_lite import NexusAgentLite

try:
    import pyperclip
except ImportError:
    pyperclip = None

try:
    from PIL import ImageGrab
except ImportError:
    ImageGrab = None

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

# Whitelisted apps that can be launched
ALLOWED_APPS = {
    "chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "firefox": r"C:\Program Files\Mozilla Firefox\firefox.exe",
    "vscode": r"C:\Users\Andre\AppData\Local\Programs\Microsoft VS Code\Code.exe",
    "explorer": "explorer.exe",
    "notepad": "notepad.exe",
    "cmd": "cmd.exe",
    "powershell": "powershell.exe",
    "discord": r"C:\Users\Andre\AppData\Local\Discord\Update.exe --processStart Discord.exe",
}

TRADING_LOG_PATH = Path.home() / "trading_bot" / "bot.log"


class NexusAgentWindows(NexusAgentLite):
    def __init__(self, server_url: str, pairing_code: str, agent_name: str = None):
        super().__init__(server_url, pairing_code, agent_name or "Andres Gaming PC")
        self.capabilities.extend([
            "browser_control",
            "app_launcher",
            "screenshot",
            "pc_status",
            "trading_monitor",
            "clipboard_rw",
            "ollama_status",
            "scheduled_tasks",
            "wake_on_lan",
        ])

    def _detect_device_type(self) -> str:
        return "windows_pc"

    def execute_command(self, command: dict):
        action = command.get("action", "")
        params = command.get("params", {})
        command_id = command.get("id", "")

        # Try Windows-specific commands first
        result = None
        if action == "browser_control":
            result = self.browser_control(params, command_id)
        elif action == "app_launcher":
            result = self.launch_app(params.get("app", ""), command_id)
        elif action == "screenshot":
            result = self.take_screenshot(command_id)
        elif action == "pc_status":
            result = self.get_pc_status(command_id)
        elif action == "trading_monitor":
            result = self.check_trading(command_id)
        elif action == "clipboard_rw":
            if params.get("write"):
                result = self.write_clipboard(params["write"], command_id)
            else:
                result = self.read_clipboard(command_id)
        elif action == "ollama_status":
            result = self.check_ollama(command_id)
        elif action == "scheduled_tasks":
            result = self.list_scheduled_tasks(command_id)

        if result:
            try:
                requests.post(
                    f"{self.server_url}/api/agents/{self.agent_id}/result",
                    json=result,
                    timeout=10,
                )
            except Exception:
                pass
        else:
            # Fall back to base class
            super().execute_command(command)

    def browser_control(self, params: dict, cmd_id: str) -> dict:
        """Open URL in Chrome via Playwright CDP."""
        url = params.get("url", "")
        if not url:
            return {"commandId": cmd_id, "status": "error", "data": "Keine URL angegeben"}

        if not sync_playwright:
            # Fallback: open in default browser
            os.startfile(url)
            return {"commandId": cmd_id, "status": "success", "data": f"URL geöffnet: {url} (Standard-Browser)"}

        try:
            with sync_playwright() as p:
                browser = p.chromium.connect_over_cdp("http://localhost:9222")
                context = browser.contexts[0] if browser.contexts else browser.new_context()
                page = context.new_page()
                page.goto(url)
                title = page.title()
                return {
                    "commandId": cmd_id,
                    "status": "success",
                    "data": f"URL geöffnet: {url}\nTitel: {title}",
                }
        except Exception as e:
            # Fallback
            os.startfile(url)
            return {"commandId": cmd_id, "status": "success", "data": f"URL geöffnet: {url} (Fallback)"}

    def launch_app(self, app_name: str, cmd_id: str) -> dict:
        """Launch a whitelisted application."""
        app_lower = app_name.lower().strip()
        if app_lower not in ALLOWED_APPS:
            return {
                "commandId": cmd_id,
                "status": "error",
                "data": f"App nicht erlaubt: {app_name}. Erlaubt: {', '.join(ALLOWED_APPS.keys())}",
            }

        try:
            subprocess.Popen(ALLOWED_APPS[app_lower], shell=True)
            return {"commandId": cmd_id, "status": "success", "data": f"{app_name} gestartet"}
        except Exception as e:
            return {"commandId": cmd_id, "status": "error", "data": str(e)}

    def take_screenshot(self, cmd_id: str) -> dict:
        """Capture screenshot and save it."""
        if not ImageGrab:
            return {"commandId": cmd_id, "status": "error", "data": "PIL nicht installiert"}

        try:
            screenshot = ImageGrab.grab()
            path = Path.home() / "nexus_screenshots" / f"screenshot_{int(time.time())}.png"
            path.parent.mkdir(exist_ok=True)
            screenshot.save(str(path))
            return {
                "commandId": cmd_id,
                "status": "success",
                "data": f"Screenshot gespeichert: {path}",
                "metadata": {"path": str(path), "size": f"{screenshot.size[0]}x{screenshot.size[1]}"},
            }
        except Exception as e:
            return {"commandId": cmd_id, "status": "error", "data": str(e)}

    def get_pc_status(self, cmd_id: str) -> dict:
        """Get detailed PC status including GPU."""
        info = {
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "cpu_percent": psutil.cpu_percent(interval=1),
            "cpu_cores": psutil.cpu_count(),
            "cpu_freq_mhz": round(psutil.cpu_freq().current) if psutil.cpu_freq() else 0,
            "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 1),
            "ram_used_gb": round(psutil.virtual_memory().used / (1024**3), 1),
            "ram_percent": psutil.virtual_memory().percent,
            "disk_total_gb": round(psutil.disk_usage("C:\\").total / (1024**3), 1),
            "disk_used_percent": psutil.disk_usage("C:\\").percent,
            "uptime_hours": round((time.time() - psutil.boot_time()) / 3600, 1),
        }

        # Try nvidia-smi for GPU info
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                parts = result.stdout.strip().split(", ")
                info["gpu_name"] = parts[0]
                info["gpu_temp_c"] = int(parts[1])
                info["gpu_util_percent"] = int(parts[2])
                info["gpu_mem_used_mb"] = int(parts[3])
                info["gpu_mem_total_mb"] = int(parts[4])
        except Exception:
            info["gpu_name"] = "Nicht verfügbar"

        return {"commandId": cmd_id, "status": "success", "data": info}

    def check_trading(self, cmd_id: str) -> dict:
        """Check trading bot status from log file."""
        if not TRADING_LOG_PATH.exists():
            return {
                "commandId": cmd_id,
                "status": "warning",
                "data": f"Trading Bot Log nicht gefunden: {TRADING_LOG_PATH}",
            }

        try:
            with open(TRADING_LOG_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
            last_lines = lines[-20:] if len(lines) >= 20 else lines
            last_log = "".join(last_lines)

            # Parse last run time
            last_run = "Unbekannt"
            errors = []
            for line in reversed(lines):
                if "RUN COMPLETE" in line or "run_complete" in line.lower():
                    last_run = line.strip()[:25]
                    break
                if "ERROR" in line or "error" in line.lower():
                    errors.append(line.strip())

            return {
                "commandId": cmd_id,
                "status": "success",
                "data": {
                    "last_run": last_run,
                    "recent_errors": errors[:5],
                    "log_tail": last_log,
                    "log_size_kb": round(TRADING_LOG_PATH.stat().st_size / 1024, 1),
                },
            }
        except Exception as e:
            return {"commandId": cmd_id, "status": "error", "data": str(e)}

    def write_clipboard(self, text: str, cmd_id: str) -> dict:
        """Write text to clipboard."""
        if not pyperclip:
            return {"commandId": cmd_id, "status": "error", "data": "pyperclip nicht installiert"}
        try:
            pyperclip.copy(text)
            return {"commandId": cmd_id, "status": "success", "data": f"In Zwischenablage: {text[:100]}"}
        except Exception as e:
            return {"commandId": cmd_id, "status": "error", "data": str(e)}

    def check_ollama(self, cmd_id: str) -> dict:
        """Check if Ollama is running and which models are loaded."""
        try:
            resp = requests.get("http://localhost:11434/api/tags", timeout=3)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                model_names = [m["name"] for m in models]
                return {
                    "commandId": cmd_id,
                    "status": "success",
                    "data": {"running": True, "models": model_names, "count": len(model_names)},
                }
        except Exception:
            pass
        return {
            "commandId": cmd_id,
            "status": "success",
            "data": {"running": False, "models": [], "count": 0},
        }

    def list_scheduled_tasks(self, cmd_id: str) -> dict:
        """List Windows scheduled tasks."""
        try:
            result = subprocess.run(
                ["schtasks", "/query", "/fo", "csv", "/nh"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                tasks = []
                for line in result.stdout.strip().split("\n")[:20]:
                    parts = line.strip('"').split('","')
                    if len(parts) >= 3:
                        tasks.append({"name": parts[0], "next_run": parts[1], "status": parts[2]})
                return {"commandId": cmd_id, "status": "success", "data": tasks}
        except Exception as e:
            return {"commandId": cmd_id, "status": "error", "data": str(e)}
        return {"commandId": cmd_id, "status": "error", "data": "Fehler beim Lesen der Aufgaben"}


def main():
    parser = argparse.ArgumentParser(description="Nexus Agent Windows")
    parser.add_argument("--code", required=True, help="6-digit pairing code")
    parser.add_argument("--server", required=True, help="Nexus server URL")
    parser.add_argument("--name", default="Andres Gaming PC", help="Agent name")
    args = parser.parse_args()

    agent = NexusAgentWindows(args.server, args.code, args.name)
    agent.run()


if __name__ == "__main__":
    main()
