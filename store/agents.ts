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

export async function loadAgents(): Promise<DeviceAgent[]> {
  const data = await AsyncStorage.getItem(AGENTS_KEY);
  return data ? JSON.parse(data) : [];
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
