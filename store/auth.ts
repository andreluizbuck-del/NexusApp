import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "./users";

const AUTH_KEY = "nexus_current_user";

export async function saveSession(user: User): Promise<void> {
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export async function getSession(): Promise<User | null> {
  const data = await AsyncStorage.getItem(AUTH_KEY);
  if (!data) return null;
  return JSON.parse(data) as User;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_KEY);
}
