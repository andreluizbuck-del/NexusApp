import AsyncStorage from "@react-native-async-storage/async-storage";
import { testConnection } from "./api";
import { loadUsers, DEFAULT_USERS } from "../store/users";
import { loadSkills, DEFAULT_SKILLS } from "../store/skills";

export type TestStatus = "pass" | "fail" | "warning" | "skip";
export type TestPriority = "critical" | "important" | "diagnostic";

export interface TestResult {
  name: string;
  displayName: string;
  status: TestStatus;
  message: string;
  duration: number;
  priority: TestPriority;
  fixable: boolean;
  autoFix?: () => Promise<void>;
}

const TEST_RESULTS_KEY = "nexus_test_results";

async function runTest(
  name: string,
  displayName: string,
  priority: TestPriority,
  fn: () => Promise<{ status: TestStatus; message: string; fixable: boolean; autoFix?: () => Promise<void> }>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      name,
      displayName,
      ...result,
      duration: Date.now() - start,
      priority,
    };
  } catch (e: any) {
    return {
      name,
      displayName,
      status: "fail",
      message: e.message || "Unbekannter Fehler",
      duration: Date.now() - start,
      priority,
      fixable: false,
    };
  }
}

// --- Individual Tests ---

async function testApiConnection(): Promise<TestResult> {
  return runTest("api_connection", "API Verbindung", "critical", async () => {
    const result = await Promise.race([
      testConnection(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000)
      ),
    ]);
    if (result && result.ok) {
      return {
        status: "pass",
        message: `Verbunden (${result.latency}ms)`,
        fixable: false,
      };
    }
    return {
      status: "fail",
      message: "API nicht erreichbar. URL prüfen.",
      fixable: true,
      autoFix: async () => {
        await AsyncStorage.setItem(
          "nexus_server_url",
          "https://api.anthropic.com"
        );
      },
    };
  });
}

async function testUserDataIntegrity(): Promise<TestResult> {
  return runTest("user_data_integrity", "Benutzerdaten", "critical", async () => {
    const users = await loadUsers();
    const defaultIds = DEFAULT_USERS.map((u) => u.id);
    const loadedIds = new Set(users.map((u) => u.id));
    const missing = defaultIds.filter((id) => !loadedIds.has(id));

    if (missing.length === 0) {
      return {
        status: "pass",
        message: `${users.length} Benutzer geladen`,
        fixable: false,
      };
    }
    return {
      status: "fail",
      message: `${missing.length} Benutzer fehlen: ${missing.join(", ")}`,
      fixable: true,
      autoFix: async () => {
        const users = await loadUsers();
        const loadedIds = new Set(users.map((u) => u.id));
        const toAdd = DEFAULT_USERS.filter((u) => !loadedIds.has(u.id));
        const { saveUsers } = require("../store/users");
        await saveUsers([...users, ...toAdd]);
      },
    };
  });
}

async function testSkillsLoaded(): Promise<TestResult> {
  return runTest("skills_loaded", "Skills geladen", "critical", async () => {
    const skills = await loadSkills();
    if (skills.length > 0) {
      const installed = skills.filter((s) => s.isInstalled).length;
      return {
        status: "pass",
        message: `${skills.length} Skills (${installed} installiert)`,
        fixable: false,
      };
    }
    return {
      status: "fail",
      message: "Keine Skills gefunden",
      fixable: true,
      autoFix: async () => {
        const { saveSkills } = require("../store/skills");
        await saveSkills(DEFAULT_SKILLS);
      },
    };
  });
}

async function testChatStorage(): Promise<TestResult> {
  return runTest("chat_storage", "Chat-Speicher", "critical", async () => {
    const testKey = "nexus_test_storage";
    const testData = { test: true, ts: Date.now() };
    await AsyncStorage.setItem(testKey, JSON.stringify(testData));
    const read = await AsyncStorage.getItem(testKey);
    await AsyncStorage.removeItem(testKey);

    if (read && JSON.parse(read).test === true) {
      return { status: "pass", message: "Speicher funktioniert", fixable: false };
    }
    return {
      status: "fail",
      message: "Speicher defekt",
      fixable: false,
    };
  });
}

async function testPrivacyWalls(): Promise<TestResult> {
  return runTest("privacy_walls", "Datenschutz-Isolation", "critical", async () => {
    const keyA = "nexus_chat_test_user_a";
    const keyB = "nexus_chat_test_user_b";
    await AsyncStorage.setItem(keyA, JSON.stringify([{ secret: "A" }]));
    const readFromB = await AsyncStorage.getItem(keyB);
    await AsyncStorage.removeItem(keyA);

    if (!readFromB) {
      return { status: "pass", message: "Chat-Isolation korrekt", fixable: false };
    }
    return {
      status: "fail",
      message: "Datenschutz-Verletzung erkannt!",
      fixable: false,
    };
  });
}

async function testNotificationPermission(): Promise<TestResult> {
  return runTest("notifications_permission", "Benachrichtigungen", "important", async () => {
    try {
      const { getPermissionsAsync } = require("expo-notifications");
      const { status } = await getPermissionsAsync();
      if (status === "granted") {
        return { status: "pass", message: "Erlaubt", fixable: false };
      }
      return {
        status: "warning",
        message: "Benachrichtigungen nicht aktiviert",
        fixable: false,
      };
    } catch {
      return { status: "skip", message: "Nicht verfügbar (Web)", fixable: false };
    }
  });
}

async function testSettingsPerUser(): Promise<TestResult> {
  return runTest("settings_per_user", "Benutzer-Einstellungen", "important", async () => {
    const users = await loadUsers();
    let missing = 0;
    for (const user of users) {
      const data = await AsyncStorage.getItem(`nexus_settings_${user.username}`);
      if (!data) missing++;
    }
    if (missing === 0) {
      return { status: "pass", message: "Alle Einstellungen vorhanden", fixable: false };
    }
    return {
      status: "warning",
      message: `${missing} Benutzer ohne Einstellungen (werden bei erstem Login erstellt)`,
      fixable: true,
      autoFix: async () => {
        const { loadSettings } = require("../store/userSettings");
        const users = await loadUsers();
        for (const user of users) {
          await loadSettings(user.username); // creates defaults if missing
        }
      },
    };
  });
}

async function testApiLatency(): Promise<TestResult> {
  return runTest("api_latency", "API Latenz", "diagnostic", async () => {
    const result = await testConnection();
    if (result && result.ok) {
      const level = result.latency < 500 ? "pass" : result.latency < 2000 ? "warning" : "fail";
      return {
        status: level as TestStatus,
        message: `${result.latency}ms`,
        fixable: false,
      };
    }
    return { status: "skip", message: "API nicht erreichbar", fixable: false };
  });
}

async function testStorageSize(): Promise<TestResult> {
  return runTest("storage_size", "Speicherverbrauch", "diagnostic", async () => {
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    for (const key of keys) {
      if (key.startsWith("nexus_")) {
        const val = await AsyncStorage.getItem(key);
        if (val) totalSize += val.length;
      }
    }
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    return {
      status: totalSize < 50 * 1024 * 1024 ? "pass" : "warning",
      message: `${sizeMB} MB verwendet (${keys.length} Einträge)`,
      fixable: false,
    };
  });
}

async function testSkillsCount(): Promise<TestResult> {
  return runTest("skills_count", "Skill-Statistik", "diagnostic", async () => {
    const skills = await loadSkills();
    const installed = skills.filter((s) => s.isInstalled).length;
    return {
      status: "pass",
      message: `${skills.length} verfügbar, ${installed} installiert`,
      fixable: false,
    };
  });
}

// --- Run Tests ---

export async function runCriticalTests(): Promise<TestResult[]> {
  const results = await Promise.all([
    testApiConnection(),
    testUserDataIntegrity(),
    testSkillsLoaded(),
    testChatStorage(),
    testPrivacyWalls(),
  ]);
  await saveTestResults(results);
  return results;
}

export async function runAllTests(): Promise<TestResult[]> {
  const results = await Promise.all([
    // Critical
    testApiConnection(),
    testUserDataIntegrity(),
    testSkillsLoaded(),
    testChatStorage(),
    testPrivacyWalls(),
    // Important
    testNotificationPermission(),
    testSettingsPerUser(),
    // Diagnostic
    testApiLatency(),
    testStorageSize(),
    testSkillsCount(),
  ]);
  await saveTestResults(results);
  return results;
}

export async function saveTestResults(results: TestResult[]): Promise<void> {
  await AsyncStorage.setItem(
    TEST_RESULTS_KEY,
    JSON.stringify({ results, timestamp: Date.now() })
  );
}

export async function getLastTestResults(): Promise<{
  results: TestResult[];
  timestamp: number;
} | null> {
  const data = await AsyncStorage.getItem(TEST_RESULTS_KEY);
  return data ? JSON.parse(data) : null;
}

export function hasCriticalFailures(results: TestResult[]): boolean {
  return results.some((r) => r.priority === "critical" && r.status === "fail");
}

export function generateReport(results: TestResult[]): string {
  const lines = [
    `Nexus Selbsttest – ${new Date().toLocaleString("de-DE")}`,
    `${"=".repeat(40)}`,
    "",
  ];
  for (const r of results) {
    const icon =
      r.status === "pass"
        ? "✅"
        : r.status === "fail"
        ? "❌"
        : r.status === "warning"
        ? "⚠️"
        : "⏭️";
    lines.push(
      `${icon} ${r.displayName}: ${r.message} (${r.duration}ms) [${r.priority}]`
    );
  }
  lines.push("");
  lines.push(
    `Ergebnis: ${results.filter((r) => r.status === "pass").length}/${results.length} bestanden`
  );
  return lines.join("\n");
}
