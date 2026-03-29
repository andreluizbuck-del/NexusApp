import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ProactiveMessage {
  id: string;
  type: "skill_new" | "trading_alert" | "tip" | "update" | "agent_offline" | "reminder_soon";
  content: string;
  icon: string;
  timestamp: number;
  dismissed: boolean;
  targetUser: string;
}

const PROACTIVE_KEY = "nexus_proactive";
const MAX_UNREAD = 3;

export async function loadProactiveMessages(
  username: string
): Promise<ProactiveMessage[]> {
  const data = await AsyncStorage.getItem(`${PROACTIVE_KEY}_${username}`);
  if (!data) return [];
  const messages: ProactiveMessage[] = JSON.parse(data);
  // Only return undismissed, max 3
  return messages
    .filter((m) => !m.dismissed)
    .slice(-MAX_UNREAD);
}

export async function addProactiveMessage(
  username: string,
  message: Omit<ProactiveMessage, "id" | "timestamp" | "dismissed">
): Promise<void> {
  const data = await AsyncStorage.getItem(`${PROACTIVE_KEY}_${username}`);
  const messages: ProactiveMessage[] = data ? JSON.parse(data) : [];

  messages.push({
    ...message,
    id: Date.now().toString(),
    timestamp: Date.now(),
    dismissed: false,
  });

  // Keep last 20
  const trimmed = messages.slice(-20);
  await AsyncStorage.setItem(
    `${PROACTIVE_KEY}_${username}`,
    JSON.stringify(trimmed)
  );
}

export async function dismissProactiveMessage(
  username: string,
  messageId: string
): Promise<void> {
  const data = await AsyncStorage.getItem(`${PROACTIVE_KEY}_${username}`);
  if (!data) return;
  const messages: ProactiveMessage[] = JSON.parse(data);
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx >= 0) {
    messages[idx].dismissed = true;
    await AsyncStorage.setItem(
      `${PROACTIVE_KEY}_${username}`,
      JSON.stringify(messages)
    );
  }
}

export async function dismissAll(username: string): Promise<void> {
  const data = await AsyncStorage.getItem(`${PROACTIVE_KEY}_${username}`);
  if (!data) return;
  const messages: ProactiveMessage[] = JSON.parse(data);
  for (const m of messages) m.dismissed = true;
  await AsyncStorage.setItem(
    `${PROACTIVE_KEY}_${username}`,
    JSON.stringify(messages)
  );
}

// --- Check triggers (called periodically or on app open) ---

export async function checkTriggers(username: string): Promise<void> {
  // Check upcoming reminders (within 1 hour)
  try {
    const { loadReminders } = require("../store/reminders");
    const reminders = await loadReminders(username);
    const oneHour = Date.now() + 60 * 60 * 1000;
    for (const r of reminders) {
      if (r.isActive && new Date(r.dateTime).getTime() < oneHour && new Date(r.dateTime).getTime() > Date.now()) {
        const existing = await loadProactiveMessages(username);
        const alreadyNotified = existing.some(
          (m) => m.type === "reminder_soon" && m.content.includes(r.title)
        );
        if (!alreadyNotified) {
          await addProactiveMessage(username, {
            type: "reminder_soon",
            content: `⏰ Erinnerung in weniger als 1 Stunde: ${r.title}`,
            icon: "⏰",
            targetUser: username,
          });
        }
      }
    }
  } catch {
    // reminders module may not be loaded
  }

  // Check offline agents
  try {
    const { loadAgents } = require("../store/agents");
    const agents = await loadAgents();
    for (const agent of agents) {
      if (agent.owner === username && agent.isEnabled && !agent.isOnline) {
        const lastSeen = new Date(agent.lastSeen).getTime();
        const hourAgo = Date.now() - 60 * 60 * 1000;
        if (lastSeen > hourAgo) {
          // Was online recently, now offline
          const existing = await loadProactiveMessages(username);
          const alreadyNotified = existing.some(
            (m) => m.type === "agent_offline" && m.content.includes(agent.name)
          );
          if (!alreadyNotified) {
            await addProactiveMessage(username, {
              type: "agent_offline",
              content: `${agent.name} ist offline gegangen`,
              icon: "📴",
              targetUser: username,
            });
          }
        }
      }
    }
  } catch {
    // agents module may not be loaded
  }
}
