#!/usr/bin/env python3
"""
Nexus Agent Schwester – Extends Lite with Jura-specific features.
Auto-analyzes PDFs in Jura folder, creates flashcards, summaries.
"""

import argparse
import os
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, os.path.dirname(__file__))
from nexus_agent_lite import NexusAgentLite

try:
    import fitz  # pymupdf
except ImportError:
    fitz = None

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    Observer = None

# Folders to watch for new PDFs
JURA_FOLDERS = [
    Path.home() / "Jura",
    Path.home() / "Desktop" / "Uni",
    Path.home() / "Documents" / "Jura",
]

ANALYSIS_PROMPT = """Analysiere dieses Rechtsdokument. Erstelle:
1. Kurze Zusammenfassung (5 Sätze)
2. Wichtigste Rechtsprinzipien
3. Relevante Paragraphen (BGB/StGB/GG/ZPO/StPO etc.)
4. 10 Lernkarteikarten im Format:
   FRAGE: [Frage]
   ANTWORT: [Antwort]
   ---
5. 3 mögliche Prüfungsfragen

Dokument:
{text}"""


class JuraFileHandler(FileSystemEventHandler):
    """Watch for new PDFs and auto-analyze them."""

    def __init__(self, agent: "NexusAgentSchwester"):
        self.agent = agent
        self.processed: set[str] = set()

    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() != ".pdf":
            return
        if str(path) in self.processed:
            return

        # Wait a moment for file to finish writing
        time.sleep(2)

        print(f"[NEU] PDF erkannt: {path.name}")
        self.processed.add(str(path))
        self.agent.analyze_jura_pdf(path)


class NexusAgentSchwester(NexusAgentLite):
    def __init__(self, server_url: str, pairing_code: str, agent_name: str = None):
        super().__init__(server_url, pairing_code, agent_name or "Schwesters Laptop")
        self.capabilities.extend(["jura_folder_watcher", "flashcard_creator"])
        self.jura_observers: list[Observer] = []

    def _detect_device_type(self) -> str:
        import platform
        return "laptop_mac" if platform.system() == "Darwin" else "laptop_windows"

    def execute_command(self, command: dict):
        action = command.get("action", "")
        params = command.get("params", {})
        cmd_id = command.get("id", "")

        if action == "flashcard_creator":
            filepath = params.get("file", "")
            result = self.create_flashcards(filepath, cmd_id)
            try:
                requests.post(
                    f"{self.server_url}/api/agents/{self.agent_id}/result",
                    json=result,
                    timeout=10,
                )
            except Exception:
                pass
        else:
            super().execute_command(command)

    def analyze_jura_pdf(self, path: Path):
        """Extract text from PDF and send for analysis."""
        if not fitz:
            print("[FEHLER] pymupdf nicht installiert")
            return

        try:
            doc = fitz.open(str(path))
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()

            if len(text) < 50:
                print(f"[SKIP] Zu wenig Text in {path.name}")
                return

            # Truncate to fit context
            if len(text) > 15000:
                text = text[:15000] + "\n\n[... Dokument gekürzt]"

            print(f"[ANALYSE] Sende {path.name} ({len(text)} Zeichen) an Nexus...")

            # Send to Nexus server for AI analysis
            resp = requests.post(
                f"{self.server_url}/api/analyze",
                json={
                    "agentId": self.agent_id,
                    "prompt": ANALYSIS_PROMPT.format(text=text),
                    "filename": path.name,
                    "type": "jura_analysis",
                },
                timeout=120,
            )

            if resp.status_code == 200:
                analysis = resp.json().get("response", "")

                # Save analysis as markdown
                output_path = path.with_name(f"{path.stem}_nexus_analyse.md")
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(f"# Nexus-Analyse: {path.name}\n\n")
                    f.write(f"*Analysiert am {time.strftime('%d.%m.%Y %H:%M')}*\n\n")
                    f.write(analysis)

                print(f"[OK] Analyse gespeichert: {output_path.name}")

                # Notify via server
                requests.post(
                    f"{self.server_url}/api/agents/{self.agent_id}/event",
                    json={
                        "type": "jura_analysis_complete",
                        "filename": path.name,
                        "output": str(output_path),
                        "summary": analysis[:200],
                    },
                    timeout=10,
                )
            else:
                print(f"[FEHLER] Analyse fehlgeschlagen: {resp.status_code}")

        except Exception as e:
            print(f"[FEHLER] {e}")

    def create_flashcards(self, filepath: str, cmd_id: str) -> dict:
        """Create flashcards from a document."""
        if not fitz:
            return {"commandId": cmd_id, "status": "error", "data": "pymupdf nicht installiert"}

        path = Path(filepath).expanduser()
        if not path.exists():
            return {"commandId": cmd_id, "status": "error", "data": f"Datei nicht gefunden: {filepath}"}

        try:
            doc = fitz.open(str(path))
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()

            if len(text) > 15000:
                text = text[:15000]

            return {
                "commandId": cmd_id,
                "status": "success",
                "data": {
                    "text": text,
                    "filename": path.name,
                    "pages": len(doc),
                    "prompt": f"Erstelle 20 Lernkarteikarten aus diesem Text im Format FRAGE | ANTWORT:\n\n{text[:8000]}",
                },
            }
        except Exception as e:
            return {"commandId": cmd_id, "status": "error", "data": str(e)}

    def start_jura_watcher(self):
        """Start watching Jura folders for new PDFs."""
        if not Observer:
            print("[WARNUNG] watchdog nicht installiert – Ordnerüberwachung deaktiviert")
            return

        handler = JuraFileHandler(self)
        for folder in JURA_FOLDERS:
            if folder.exists():
                observer = Observer()
                observer.schedule(handler, str(folder), recursive=True)
                observer.start()
                self.jura_observers.append(observer)
                print(f"[WATCH] Überwache: {folder}")

        if not self.jura_observers:
            print("[INFO] Keine Jura-Ordner gefunden. Erstelle einen unter:")
            for f in JURA_FOLDERS:
                print(f"  - {f}")

    def run(self):
        print(f"[NEXUS AGENT SCHWESTER] {self.agent_name}")
        print(f"Server: {self.server_url}")

        if not self.register():
            print("[FEHLER] Registrierung fehlgeschlagen.")
            return

        import threading
        threading.Thread(target=self.heartbeat, daemon=True).start()
        threading.Thread(target=self.poll_commands, daemon=True).start()

        # Start Jura folder watcher
        self.start_jura_watcher()

        print("[OK] Agent läuft. Ctrl+C zum Beenden.")
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[INFO] Beende...")
            self.running = False
            for obs in self.jura_observers:
                obs.stop()


def main():
    parser = argparse.ArgumentParser(description="Nexus Agent Schwester")
    parser.add_argument("--code", required=True)
    parser.add_argument("--server", required=True)
    parser.add_argument("--name", default="Schwesters Laptop")
    args = parser.parse_args()

    agent = NexusAgentSchwester(args.server, args.code, args.name)
    agent.run()


if __name__ == "__main__":
    main()
