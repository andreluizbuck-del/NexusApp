import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TOKEN_KEY = "nexus_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Nexus",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}

export async function scheduleReminder(
  title: string,
  body: string,
  date: Date
): Promise<string> {
  const seconds = Math.max(
    1,
    Math.floor((date.getTime() - Date.now()) / 1000)
  );

  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { type: "reminder" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
  });
  return id;
}

export async function scheduleDailyGreeting(
  name: string,
  hour: number,
  minute: number
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Guten Morgen, ${name}!`,
      body: "Wie kann Nexus dir heute helfen?",
      data: { type: "greeting" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  return id;
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export interface ParsedReminder {
  text: string;
  date: Date;
}

export function parseReminderFromText(text: string): ParsedReminder | null {
  const patterns = [
    /erinner(?:e|) mich (?:morgen |)um (\d{1,2})[:\.]?(\d{2})?\s*(?:uhr\s*)?(?:an\s+|dass\s+|)(.*)/i,
    /remind me (?:tomorrow |)at (\d{1,2})[:\.]?(\d{2})?\s*(?:to\s+|about\s+|)(.*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = match[2] ? parseInt(match[2], 10) : 0;
      const reminderText = match[3]?.trim() || "Erinnerung";

      const date = new Date();
      if (text.toLowerCase().includes("morgen") || text.toLowerCase().includes("tomorrow")) {
        date.setDate(date.getDate() + 1);
      }
      date.setHours(hour, minute, 0, 0);
      if (date <= new Date()) date.setDate(date.getDate() + 1);

      return { text: reminderText, date };
    }
  }
  return null;
}
