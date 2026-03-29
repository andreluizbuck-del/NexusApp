#!/usr/bin/env python3
"""
Nexus Agent Raspberry Pi – Minimal dependencies, always-on monitor.
Capabilities: wake_on_lan, network_monitor, uptime_monitor, vpn_status, server_health
"""

import argparse
import json
import os
import platform
import subprocess
import threading
import time

import psutil
import requests

try:
    from wakeonlan import send_magic_packet
except ImportError:
    send_magic_packet = None

HEARTBEAT_INTERVAL = 30

# MAC addresses of devices that can be woken
WOL_DEVICES = {
    "gaming_pc": "XX:XX:XX:XX:XX:XX",  # Replace with actual MAC
}

# Devices to monitor (Tailscale IPs)
MONITORED_DEVICES = {
    "Gaming PC": "100.64.0.2",
    "Schwester Laptop": "100.64.0.3",
    "Router": "192.168.1.1",
}


class NexusAgentPi:
    def __init__(self, server_url: str, pairing_code: str, agent_name: str = None):
        self.server_url = server_url.rstrip("/")
        self.pairing_code = pairing_code
        self.agent_id = None
        self.agent_name = agent_name or "Raspberry Pi"
        self.running = True
        self.capabilities = [
            "wake_on_lan",
            "network_monitor",
            "uptime_monitor",
            "vpn_status",
            "server_health",
        ]

    def register(self) -> bool:
        try:
            resp = requests.post(
                f"{self.server_url}/api/agents/register",
                json={
                    "pairingCode": self.pairing_code,
                    "name": self.agent_name,
                    "deviceType": "raspberry_pi",
                    "capabilities": self.capabilities,
                    "hostname": platform.node(),
                    "os": f"{platform.system()} {platform.release()}",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                self.agent_id = resp.json().get("agentId")
                print(f"[OK] Registriert: {self.agent_name} (ID: {self.agent_id})")
                return True
            print(f"[FEHLER] Registrierung: {resp.status_code}")
            return False
        except Exception as e:
            print(f"[FEHLER] Server nicht erreichbar: {e}")
            return False

    def heartbeat(self):
        while self.running:
            try:
                requests.post(
                    f"{self.server_url}/api/agents/{self.agent_id}/heartbeat",
                    json={
                        "status": "online",
                        "cpu": psutil.cpu_percent(),
                        "ram": psutil.virtual_memory().percent,
                        "temp": self._get_cpu_temp(),
                        "uptime_hours": round((time.time() - psutil.boot_time()) / 3600, 1),
                    },
                    timeout=5,
                )
            except Exception:
                pass
            time.sleep(HEARTBEAT_INTERVAL)

    def _get_cpu_temp(self) -> float:
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                return round(int(f.read().strip()) / 1000, 1)
        except Exception:
            return 0.0

    def poll_commands(self):
        while self.running:
            try:
                resp = requests.get(
                    f"{self.server_url}/api/agents/{self.agent_id}/commands",
                    timeout=10,
                )
                if resp.status_code == 200:
                    for cmd in resp.json().get("commands", []):
                        result = self.execute_command(cmd)
                        requests.post(
                            f"{self.server_url}/api/agents/{self.agent_id}/result",
                            json=result,
                            timeout=10,
                        )
            except Exception:
                pass
            time.sleep(2)

    def execute_command(self, command: dict) -> dict:
        action = command.get("action", "")
        params = command.get("params", {})
        cmd_id = command.get("id", "")

        if action == "wake_on_lan":
            return self.wake_device(params.get("device", "gaming_pc"), cmd_id)
        elif action == "network_monitor":
            return self.scan_network(cmd_id)
        elif action == "uptime_monitor":
            return self.get_uptime(cmd_id)
        elif action == "vpn_status":
            return self.check_vpn(cmd_id)
        elif action == "server_health":
            return self.get_health(cmd_id)

        return {"commandId": cmd_id, "status": "error", "data": f"Unbekannt: {action}"}

    def wake_device(self, device: str, cmd_id: str) -> dict:
        if not send_magic_packet:
            return {"commandId": cmd_id, "status": "error", "data": "wakeonlan nicht installiert"}

        mac = WOL_DEVICES.get(device)
        if not mac or mac.startswith("XX"):
            return {"commandId": cmd_id, "status": "error", "data": f"MAC-Adresse für '{device}' nicht konfiguriert"}

        try:
            send_magic_packet(mac)
            return {"commandId": cmd_id, "status": "success", "data": f"WOL-Paket gesendet an {device} ({mac})"}
        except Exception as e:
            return {"commandId": cmd_id, "status": "error", "data": str(e)}

    def scan_network(self, cmd_id: str) -> dict:
        results = {}
        for name, ip in MONITORED_DEVICES.items():
            try:
                ret = subprocess.run(
                    ["ping", "-c", "1", "-W", "2", ip],
                    capture_output=True, timeout=5,
                )
                results[name] = {"ip": ip, "online": ret.returncode == 0}
            except Exception:
                results[name] = {"ip": ip, "online": False}
        return {"commandId": cmd_id, "status": "success", "data": results}

    def get_uptime(self, cmd_id: str) -> dict:
        return {
            "commandId": cmd_id,
            "status": "success",
            "data": {
                "uptime_hours": round((time.time() - psutil.boot_time()) / 3600, 1),
                "boot_time": time.strftime("%Y-%m-%d %H:%M", time.localtime(psutil.boot_time())),
                "cpu_temp": self._get_cpu_temp(),
            },
        }

    def check_vpn(self, cmd_id: str) -> dict:
        try:
            result = subprocess.run(
                ["tailscale", "status", "--json"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                peers = []
                for peer_id, peer in data.get("Peer", {}).items():
                    peers.append({
                        "name": peer.get("HostName", "?"),
                        "online": peer.get("Online", False),
                        "ip": peer.get("TailscaleIPs", ["?"])[0],
                    })
                return {
                    "commandId": cmd_id,
                    "status": "success",
                    "data": {
                        "connected": True,
                        "self_ip": data.get("Self", {}).get("TailscaleIPs", ["?"])[0],
                        "peers": peers,
                    },
                }
        except Exception:
            pass
        return {"commandId": cmd_id, "status": "success", "data": {"connected": False, "peers": []}}

    def get_health(self, cmd_id: str) -> dict:
        return {
            "commandId": cmd_id,
            "status": "success",
            "data": {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "ram_percent": psutil.virtual_memory().percent,
                "ram_total_mb": round(psutil.virtual_memory().total / (1024**2)),
                "disk_percent": psutil.disk_usage("/").percent,
                "cpu_temp": self._get_cpu_temp(),
                "load_avg": os.getloadavg() if hasattr(os, "getloadavg") else [0, 0, 0],
            },
        }

    def run(self):
        print(f"[NEXUS AGENT PI] {self.agent_name}")
        print(f"Server: {self.server_url}")

        if not self.register():
            print("[FEHLER] Registrierung fehlgeschlagen.")
            return

        threading.Thread(target=self.heartbeat, daemon=True).start()
        threading.Thread(target=self.poll_commands, daemon=True).start()

        print("[OK] Agent läuft. Ctrl+C zum Beenden.")
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[INFO] Beende...")
            self.running = False


def main():
    parser = argparse.ArgumentParser(description="Nexus Agent Raspberry Pi")
    parser.add_argument("--code", required=True)
    parser.add_argument("--server", required=True)
    parser.add_argument("--name", default="Raspberry Pi")
    args = parser.parse_args()

    agent = NexusAgentPi(args.server, args.code, args.name)
    agent.run()


if __name__ == "__main__":
    main()
