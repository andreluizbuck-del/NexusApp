import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export interface Reminder {
  id: string;
  userId: string;
  message: string;
  scheduledFor: string; // ISO string
  recurring: "daily" | "weekly" | "monthly" | null;
  recurringTime: string | null;
  recurringDay: number | null;
  isActive: boolean;
  createdAt: string;
  triggeredCount: number;
  notificationId: string | null;
}

const REMINDERS_KEY = "nexus_reminders";

export async function loadReminders(userId: string): Promise<Reminder[]> {
  const data = await AsyncStorage.getItem(`${REMINDERS_KEY}_${userId}`);
  if (!data) return [];
  return JSON.parse(data) as Reminder[];
}

export async function saveReminders(
  userId: string,
  reminders: Reminder[]
): Promise<void> {
  await AsyncStorage.setItem(
    `${REMINDERS_KEY}_${userId}`,
    JSON.stringify(reminders)
  );
}

export async function addReminder(
  userId: string,
  message: string,
  scheduledFor: Date,
  recurring: "daily" | "weekly" | "monthly" | null = null
): Promise<Reminder> {
  const reminders = await loadReminders(userId);

  let notificationId: string | null = null;
  const secondsUntil = Math.max(
    1,
    Math.floor((scheduledFor.getTime() - Date.now()) / 1000)
  );

  try {
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nexus Erinnerung",
        body: message,
        data: { type: "reminder", userId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        repeats: false,
      },
    });
  } catch {
    // Notifications may not be available on web
  }

  const reminder: Reminder = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    userId,
    message,
    scheduledFor: scheduledFor.toISOString(),
    recurring,
    recurringTime: recurring
      ? `${scheduledFor.getHours().toString().padStart(2, "0")}:${scheduledFor.getMinutes().toString().padStart(2, "0")}`
      : null,
    recurringDay: recurring === "weekly" ? scheduledFor.getDay() : null,
    isActive: true,
    createdAt: new Date().toISOString(),
    triggeredCount: 0,
    notificationId,
  };

  reminders.push(reminder);
  await saveReminders(userId, reminders);
  return reminder;
}

export async function deleteReminder(
  userId: string,
  reminderId: string
): Promise<void> {
  const reminders = await loadReminders(userId);
  const target = reminders.find((r) => r.id === reminderId);
  if (target?.notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(
        target.notificationId
      );
    } catch {}
  }
  const filtered = reminders.filter((r) => r.id !== reminderId);
  await saveReminders(userId, filtered);
}

export async function toggleReminder(
  userId: string,
  reminderId: string
): Promise<void> {
  const reminders = await loadReminders(userId);
  const idx = reminders.findIndex((r) => r.id === reminderId);
  if (idx === -1) return;
  reminders[idx].isActive = !reminders[idx].isActive;
  if (!reminders[idx].isActive && reminders[idx].notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(
        reminders[idx].notificationId!
      );
    } catch {}
  }
  await saveReminders(userId, reminders);
}

export async function rescheduleActiveReminders(
  userId: string
): Promise<void> {
  const reminders = await loadReminders(userId);
  const now = Date.now();
  let changed = false;

  for (const r of reminders) {
    if (!r.isActive) continue;
    const scheduledTime = new Date(r.scheduledFor).getTime();

    if (scheduledTime < now) {
      if (r.recurring) {
        const next = new Date(r.scheduledFor);
        while (next.getTime() < now) {
          if (r.recurring === "daily") next.setDate(next.getDate() + 1);
          else if (r.recurring === "weekly") next.setDate(next.getDate() + 7);
          else if (r.recurring === "monthly")
            next.setMonth(next.getMonth() + 1);
        }
        r.scheduledFor = next.toISOString();
        r.triggeredCount++;
        changed = true;

        try {
          const seconds = Math.max(
            1,
            Math.floor((next.getTime() - now) / 1000)
          );
          r.notificationId =
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Nexus Erinnerung",
                body: r.message,
                data: { type: "reminder", userId },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes
                  .TIME_INTERVAL,
                seconds,
                repeats: false,
              },
            });
        } catch {}
      } else {
        r.isActive = false;
        changed = true;
      }
    }
  }

  if (changed) await saveReminders(userId, reminders);
}

export function parseReminderIntent(text: string): {
  message: string;
  date: Date;
  recurring: "daily" | "weekly" | "monthly" | null;
} | null {
  const patterns = [
    /erinner(?:e|) mich (?:morgen |übermorgen |)um (\d{1,2})[:\.]?(\d{2})?\s*(?:uhr\s*)?(?:an\s+|dass\s+|)(.*)/i,
    /nicht vergessen[:\s]+(.+?)(?:\s+um\s+(\d{1,2})[:\.]?(\d{2})?)?$/i,
    /remind(?:er|) (?:me )?(?:tomorrow |)at (\d{1,2})[:\.]?(\d{2})?\s*(?:to\s+|about\s+|)(.*)/i,
  ];

  for (let pi = 0; pi < patterns.length; pi++) {
    const match = text.match(patterns[pi]);
    if (!match) continue;

    let hour: number, minute: number, msg: string;

    if (pi === 1) {
      // "nicht vergessen" pattern
      msg = match[1]?.trim() || "Erinnerung";
      hour = match[2] ? parseInt(match[2], 10) : new Date().getHours() + 1;
      minute = match[3] ? parseInt(match[3], 10) : 0;
    } else {
      hour = parseInt(match[1], 10);
      minute = match[2] ? parseInt(match[2], 10) : 0;
      msg = match[3]?.trim() || "Erinnerung";
    }

    const date = new Date();
    const lower = text.toLowerCase();
    if (lower.includes("morgen") || lower.includes("tomorrow")) {
      date.setDate(date.getDate() + 1);
    } else if (lower.includes("übermorgen")) {
      date.setDate(date.getDate() + 2);
    }
    date.setHours(hour, minute, 0, 0);
    if (date <= new Date()) date.setDate(date.getDate() + 1);

    let recurring: "daily" | "weekly" | "monthly" | null = null;
    if (lower.includes("jeden tag") || lower.includes("täglich") || lower.includes("daily")) {
      recurring = "daily";
    } else if (lower.includes("jede woche") || lower.includes("wöchentlich") || lower.includes("weekly")) {
      recurring = "weekly";
    } else if (lower.includes("jeden monat") || lower.includes("monatlich") || lower.includes("monthly")) {
      recurring = "monthly";
    }

    return { message: msg, date, recurring };
  }

  return null;
}
