import AsyncStorage from "@react-native-async-storage/async-storage";

export type DeviceType =
  | "windows_pc"
  | "laptop_mac"
  | "laptop_windows"
  | "raspberry_pi"
  | "android"
  | "ios";

export interface DeviceAgent {
  id: string;
  name: string;
  deviceType: DeviceType;
  owner: string;
  tailscaleIP: string;
  isOnline: boolean;
  lastSeen: string;
  capabilities: string[];
  pairingCode?: string;
  pairingExpires?: string;
  isEnabled: boolean;
}

const AGENTS_KEY = "nexus_agents_v1";
const COMMANDS_KEY = "nexus_agent_commands";

// --- AgentCommand ---

export interface AgentCommand {
  id: string;
  agentId: string;
  agentName: string;
  command: string;
  status: "pending" | "running" | "done" | "failed";
  result?: string;
  createdAt: string;
  completedAt?: string;
}

// --- Default preconfigured agents ---

export const DEFAULT_AGENTS: DeviceAgent[] = [
  {
    id: "andre-pc",
    name: "Andres Gaming PC",
    deviceType: "windows_pc",
    owner: "andre",
    tailscaleIP: "100.x.x.x",
    isOnline: false,
    lastSeen: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    capabilities: ["browser_control", "file_manager", "pc_status", "trading_monitor", "screenshot"],
    isEnabled: true,
  },
  {
    id: "pi",
    name: "Raspberry Pi",
    deviceType: "raspberry_pi",
    owner: "andre",
    tailscaleIP: "100.x.x.x",
    isOnline: false,
    lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    capabilities: ["wake_on_lan", "network_monitor", "vpn_status", "uptime_monitor", "server_health"],
    isEnabled: true,
  },
  {
    id: "schwester-laptop",
    name: "Schwester Laptop",
    deviceType: "laptop_windows",
    owner: "schwester",
    tailscaleIP: "100.x.x.x",
    isOnline: false,
    lastSeen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    capabilities: ["document_analyzer", "flashcard_creator", "file_organizer"],
    isEnabled: true,
  },
];

export const DEVICE_ICONS: Record<DeviceType, string> = {
  windows_pc: "🖥️",
  laptop_mac: "💻",
  laptop_windows: "💻",
  raspberry_pi: "🍓",
  android: "📱",
  ios: "📱",
};

export const DEVICE_LABELS: Record<DeviceType, string> = {
  windows_pc: "Windows PC",
  laptop_mac: "MacBook",
  laptop_windows: "Windows Laptop",
  raspberry_pi: "Raspberry Pi",
  android: "Android",
  ios: "iPhone/iPad",
};

export const DEVICE_CAPABILITIES: Record<DeviceType, string[]> = {
  windows_pc: [
    "browser_control",
    "file_manager",
    "app_launcher",
    "pc_status",
    "trading_monitor",
    "screenshot",
    "clipboard_rw",
    "ollama_status",
    "scheduled_tasks",
    "wake_on_lan",
  ],
  laptop_mac: [
    "document_analyzer",
    "folder_watcher",
    "flashcard_creator",
    "clipboard_read",
    "file_organizer",
  ],
  laptop_windows: [
    "document_analyzer",
    "folder_watcher",
    "flashcard_creator",
    "clipboard_read",
    "file_organizer",
  ],
  raspberry_pi: [
    "wake_on_lan",
    "network_monitor",
    "uptime_monitor",
    "vpn_status",
    "server_health",
  ],
  android: [
    "camera_analyze",
    "calendar_read",
    "calendar_write",
    "voice_input",
    "location_current",
    "document_scan",
  ],
  ios: [
    "camera_analyze",
    "calendar_read",
    "calendar_write",
    "voice_input",
    "location_current",
    "document_scan",
  ],
};

export const CAPABILITY_LABELS: Record<string, string> = {
  browser_control: "Browser steuern",
  file_manager: "Dateiverwaltung",
  app_launcher: "Apps starten",
  pc_status: "PC Status",
  trading_monitor: "Trading Monitor",
  screenshot: "Screenshot",
  clipboard_rw: "Zwischenablage",
  ollama_status: "Ollama Status",
  scheduled_tasks: "Geplante Aufgaben",
  wake_on_lan: "Wake-on-LAN",
  document_analyzer: "Dokument-Analyse",
  folder_watcher: "Ordner überwachen",
  flashcard_creator: "Karteikarten",
  clipboard_read: "Zwischenablage lesen",
  file_organizer: "Dateien sortieren",
  network_monitor: "Netzwerk-Monitor",
  uptime_monitor: "Uptime Monitor",
  vpn_status: "VPN Status",
  server_health: "Server Health",
  camera_analyze: "Kamera-Analyse",
  calendar_read: "Kalender lesen",
  calendar_write: "Kalender schreiben",
  voice_input: "Spracheingabe",
  location_current: "Standort",
  document_scan: "Dokument scannen",
};

// --- Agent CRUD ---

/**
 * Load agents. Seeds DEFAULT_AGENTS on first run (if storage is empty).
 */
export async function loadAgents(): Promise<DeviceAgent[]> {
  const data = await AsyncStorage.getItem(AGENTS_KEY);
  if (data) return JSON.parse(data);
  // First run — seed defaults
  await saveAgents(DEFAULT_AGENTS);
  return DEFAULT_AGENTS;
}

export async function saveAgents(agents: DeviceAgent[]): Promise<void> {
  await AsyncStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
}

export async function addAgent(agent: DeviceAgent): Promise<void> {
  const agents = await loadAgents();
  agents.push(agent);
  await saveAgents(agents);
}

export async function removeAgent(agentId: string): Promise<void> {
  const agents = await loadAgents();
  await saveAgents(agents.filter((a) => a.id !== agentId));
}

export async function updateAgent(
  agentId: string,
  updates: Partial<DeviceAgent>
): Promise<void> {
  const agents = await loadAgents();
  const idx = agents.findIndex((a) => a.id === agentId);
  if (idx >= 0) {
    agents[idx] = { ...agents[idx], ...updates };
    await saveAgents(agents);
  }
}

// --- Pairing ---

export function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function isPairingExpired(agent: DeviceAgent): boolean {
  if (!agent.pairingExpires) return true;
  return new Date(agent.pairingExpires).getTime() < Date.now();
}

// --- Agent Command Detection ---

interface AgentCommand {
  capability: string;
  deviceTypes: DeviceType[];
  params: Record<string, string>;
}

const COMMAND_PATTERNS: {
  regex: RegExp;
  capability: string;
  deviceTypes: DeviceType[];
  paramExtract?: (m: RegExpMatchArray) => Record<string, string>;
}[] = [
  {
    regex: /öffne\s+(https?:\/\/\S+|\S+\.\S+)/i,
    capability: "browser_control",
    deviceTypes: ["windows_pc"],
    paramExtract: (m) => ({ url: m[1] }),
  },
  {
    regex: /screenshot/i,
    capability: "screenshot",
    deviceTypes: ["windows_pc"],
  },
  {
    regex: /(?:mein\s+)?pc\s*status/i,
    capability: "pc_status",
    deviceTypes: ["windows_pc"],
  },
  {
    regex: /trading\s*(?:bot)?\s*status/i,
    capability: "trading_monitor",
    deviceTypes: ["windows_pc"],
  },
  {
    regex: /analysiere\s+(.+\.pdf)/i,
    capability: "document_analyzer",
    deviceTypes: ["laptop_mac", "laptop_windows"],
    paramExtract: (m) => ({ file: m[1] }),
  },
  {
    regex: /(?:erstelle\s+)?karteikarten\s+(?:aus|von)\s+(.+)/i,
    capability: "flashcard_creator",
    deviceTypes: ["laptop_mac", "laptop_windows"],
    paramExtract: (m) => ({ file: m[1] }),
  },
  {
    regex: /(?:wecke?|wake)\s+(?:meinen?\s+)?(?:pc|computer|rechner)/i,
    capability: "wake_on_lan",
    deviceTypes: ["raspberry_pi"],
  },
  {
    regex: /(?:netzwerk|network)\s*(?:status|monitor)/i,
    capability: "network_monitor",
    deviceTypes: ["raspberry_pi"],
  },
  {
    regex: /(?:was ist auf|analysiere)\s+(?:dem|das|diesem)\s+foto/i,
    capability: "camera_analyze",
    deviceTypes: ["android", "ios"],
  },
];

export function detectAgentCommand(message: string): AgentCommand | null {
  for (const pattern of COMMAND_PATTERNS) {
    const match = message.match(pattern.regex);
    if (match) {
      return {
        capability: pattern.capability,
        deviceTypes: pattern.deviceTypes,
        params: pattern.paramExtract ? pattern.paramExtract(match) : {},
      };
    }
  }
  return null;
}

export async function findAgentForCommand(
  command: AgentCommand
): Promise<DeviceAgent | null> {
  const agents = await loadAgents();
  return (
    agents.find(
      (a) =>
        a.isEnabled &&
        a.isOnline &&
        command.deviceTypes.includes(a.deviceType) &&
        a.capabilities.includes(command.capability)
    ) || null
  );
}

// --- Install Instructions ---

// --- AgentCommand CRUD ---

export async function loadCommands(): Promise<AgentCommand[]> {
  const data = await AsyncStorage.getItem(COMMANDS_KEY);
  return data ? JSON.parse(data) : [];
}

async function saveCommands(cmds: AgentCommand[]): Promise<void> {
  await AsyncStorage.setItem(COMMANDS_KEY, JSON.stringify(cmds.slice(-100)));
}

export async function createCommand(
  agentId: string,
  agentName: string,
  command: string
): Promise<AgentCommand> {
  const cmd: AgentCommand = {
    id: Date.now().toString(),
    agentId,
    agentName,
    command,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const cmds = await loadCommands();
  cmds.push(cmd);
  await saveCommands(cmds);
  return cmd;
}

/**
 * Simulate agent execution — resolves after 2 seconds with a fake result.
 * Replace with real WebSocket call when backend is ready.
 */
export async function simulateExecution(cmdId: string): Promise<string> {
  const cmds = await loadCommands();
  const idx = cmds.findIndex((c) => c.id === cmdId);
  if (idx < 0) return "Befehl nicht gefunden.";

  // Mark running
  cmds[idx].status = "running";
  await saveCommands(cmds);

  // Simulate 2s delay
  await new Promise((r) => setTimeout(r, 2000));

  const cmd = cmds[idx];
  const result = generateSimulatedResult(cmd.command);

  cmds[idx].status = "done";
  cmds[idx].result = result;
  cmds[idx].completedAt = new Date().toISOString();
  await saveCommands(cmds);
  return result;
}

function generateSimulatedResult(command: string): string {
  const lower = command.toLowerCase();
  if (lower.includes("status") || lower.includes("pc")) {
    return "CPU: 12% · RAM: 6.2/16 GB · GPU: RTX 4070 23% · Temp: 45°C · Uptime: 3h 22min";
  }
  if (lower.includes("browser") || lower.includes("öffne")) {
    return "Browser geöffnet.";
  }
  if (lower.includes("screenshot")) {
    return "Screenshot erstellt und gespeichert.";
  }
  if (lower.includes("trading")) {
    return "Trading Bot aktiv · Letzter Trade: vor 14 Min · P&L heute: +2.3%";
  }
  if (lower.includes("weck") || lower.includes("wake")) {
    return "Magic Packet gesendet. PC sollte in ~30 Sekunden online sein.";
  }
  if (lower.includes("vpn")) {
    return "WireGuard VPN aktiv · 3 Peers verbunden · ↑ 1.2 MB/s ↓ 0.4 MB/s";
  }
  if (lower.includes("netzwerk") || lower.includes("network")) {
    return "4 Geräte online: PC (192.168.1.10), Laptop (192.168.1.11), Pi (192.168.1.1), Phone (192.168.1.20)";
  }
  if (lower.includes("karteikarten") || lower.includes("flashcard")) {
    return "15 Karteikarten erstellt und in Lernliste gespeichert.";
  }
  if (lower.includes("dokument") || lower.includes("analysiere")) {
    return "Dokument analysiert: 12 Seiten · Hauptthemen: 3 · Zusammenfassung erstellt.";
  }
  return "Befehl ausgeführt. ✓";
}

// --- Capability suggestions per device type ---

export const CAPABILITY_SUGGESTIONS: Record<DeviceType, string[]> = {
  windows_pc: [
    "Zeig PC Status",
    "Mach einen Screenshot",
    "Trading Bot Status",
    "Öffne YouTube",
  ],
  raspberry_pi: [
    "Wecke meinen PC auf",
    "VPN Status",
    "Netzwerk Status",
    "Zeig Uptime",
  ],
  laptop_mac: [
    "Analysiere dieses Dokument",
    "Erstelle Karteikarten",
    "Dateien sortieren",
  ],
  laptop_windows: [
    "Analysiere dieses Dokument",
    "Erstelle Karteikarten",
    "Dateien sortieren",
  ],
  android: ["Kalender lesen", "Standort", "Dokument scannen"],
  ios: ["Kalender lesen", "Standort", "Dokument scannen"],
};

// --- Setup guide steps per device type ---

export const SETUP_GUIDE: Record<DeviceType, { step: number; text: string }[]> = {
  windows_pc: [
    { step: 1, text: "Python 3.11+ installieren: python.org/downloads" },
    { step: 2, text: "Terminal öffnen und ausführen:\npip install requests psutil playwright" },
    { step: 3, text: "playwright install chromium" },
    { step: 4, text: "API Key in .env setzen:\nEXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-..." },
    { step: 5, text: "Agenten starten:\npython nexus_agent.py --type windows --owner andre" },
    { step: 6, text: "Tailscale IP in der App eintragen" },
  ],
  raspberry_pi: [
    { step: 1, text: "Raspberry Pi OS installieren (64-bit empfohlen)" },
    { step: 2, text: "Tailscale installieren:\ncurl -fsSL https://tailscale.com/install.sh | sh" },
    { step: 3, text: "tailscale up — einloggen und verbinden" },
    { step: 4, text: "pip3 install requests wakeonlan psutil" },
    { step: 5, text: "python3 nexus_agent.py --type pi" },
    { step: 6, text: "Wake-on-LAN MAC-Adresse in den Agent-Einstellungen hinterlegen" },
  ],
  laptop_mac: [
    { step: 1, text: "Python 3.11+ installieren: python.org oder brew install python" },
    { step: 2, text: "pip3 install requests psutil watchdog pymupdf" },
    { step: 3, text: "python3 nexus_agent.py --type laptop --owner [deinName]" },
    { step: 4, text: "Tailscale IP in der App eintragen" },
  ],
  laptop_windows: [
    { step: 1, text: "Python 3.11+ installieren: python.org/downloads" },
    { step: 2, text: "pip install requests psutil watchdog pymupdf" },
    { step: 3, text: "python nexus_agent.py --type laptop --owner [deinName]" },
    { step: 4, text: "Tailscale IP in der App eintragen" },
  ],
  android: [
    { step: 1, text: "Nexus App auf dem Android-Gerät installieren" },
    { step: 2, text: "In der App einloggen und Agent-Modus aktivieren" },
    { step: 3, text: "Berechtigungen erteilen: Kalender, Kamera, Standort" },
  ],
  ios: [
    { step: 1, text: "Nexus App aus dem App Store installieren" },
    { step: 2, text: "Einloggen und Agent-Modus aktivieren" },
    { step: 3, text: "Berechtigungen erteilen: Kalender, Kamera, Standort" },
  ],
};

export function getInstallInstructions(
  deviceType: DeviceType,
  code: string,
  serverUrl: string
): string {
  switch (deviceType) {
    case "windows_pc":
      return `pip install requests psutil playwright && python nexus_agent.py --code ${code} --server ${serverUrl}`;
    case "laptop_mac":
    case "laptop_windows":
      return `pip3 install requests psutil watchdog pymupdf && python3 nexus_agent_lite.py --code ${code} --server ${serverUrl}`;
    case "raspberry_pi":
      return `pip3 install requests wakeonlan psutil && python3 nexus_agent_pi.py --code ${code} --server ${serverUrl}`;
    default:
      return "Dieses Gerät wird über die App verbunden.";
  }
}
