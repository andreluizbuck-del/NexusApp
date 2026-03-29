import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserSettings {
  tone: "casual" | "direct" | "formal";
  responseLength: "short" | "medium" | "long";
  language: "deutsch" | "english" | "portugues" | "auto";
  thinkingDepth: "fast" | "deep";
  persona: "assistant" | "friend" | "teacher";
  aiName: string;
  aiPersonality: string;
  aiAvatar: string;
  customInstructions: string;
  browserEnabled: boolean;
  notificationsEnabled: boolean;
  hackingEnabled: boolean;
  adultContentEnabled: boolean;
  maxContextLength: "short" | "medium" | "long";
  allowedSkills: string[];
  dailyGreetingTime: string | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  tone: "casual",
  responseLength: "medium",
  language: "auto",
  thinkingDepth: "fast",
  persona: "assistant",
  aiName: "Nexus",
  aiPersonality: "",
  aiAvatar: "🤖",
  customInstructions: "",
  browserEnabled: true,
  notificationsEnabled: false,
  hackingEnabled: false,
  adultContentEnabled: false,
  maxContextLength: "medium",
  allowedSkills: [],
  dailyGreetingTime: null,
};

const USER_DEFAULTS: Record<string, Partial<UserSettings>> = {
  schwester: {
    language: "deutsch",
    persona: "teacher",
    customInstructions:
      "Ich studiere Jura in Deutschland. Fokussiere dich auf deutsches Recht: BGB, StGB, HGB, GG, ZPO. Erkläre Paragraphen verständlich mit praktischen Beispielen und Urteilen.",
  },
};

function settingsKey(username: string): string {
  return `nexus_settings_${username}`;
}

export async function loadSettings(username: string): Promise<UserSettings> {
  const data = await AsyncStorage.getItem(settingsKey(username));
  const userDefaults = USER_DEFAULTS[username] || {};
  if (!data) return { ...DEFAULT_SETTINGS, ...userDefaults };
  return { ...DEFAULT_SETTINGS, ...userDefaults, ...JSON.parse(data) };
}

export async function saveSettings(
  username: string,
  settings: UserSettings
): Promise<void> {
  await AsyncStorage.setItem(settingsKey(username), JSON.stringify(settings));
}

export async function loadAllUserSettings(): Promise<
  Record<string, UserSettings>
> {
  const users = ["andre", "schwester", "mama", "papa", "oma"];
  const result: Record<string, UserSettings> = {};
  for (const u of users) {
    result[u] = await loadSettings(u);
  }
  return result;
}
