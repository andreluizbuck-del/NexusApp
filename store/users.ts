import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "admin" | "family" | "guest";

export interface NexusUser {
  id: string;
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  emoji: string;
  age: number | null;
  language: string;
  isEnabled: boolean;
  customName?: string;
  sessionTimeout?: number; // hours: 1, 8, 24, 0=permanent
}

// Legacy compat
export interface User {
  username: string;
  password: string;
  displayName: string;
  role: string;
  avatar: string;
  // New fields
  emoji: string;
  age: number | null;
  language: string;
  isEnabled: boolean;
  customName?: string;
  sessionTimeout?: number;
}

const USERS_KEY = "nexus_users_v3";

export const DEFAULT_USERS: NexusUser[] = [
  // Familie
  {
    id: "andre",
    username: "andre",
    displayName: "Andre",
    password: "4985",
    role: "admin",
    emoji: "👑",
    age: 15,
    language: "deutsch",
    isEnabled: true,
  },
  {
    id: "schwester",
    username: "schwester",
    displayName: "Schwester",
    password: "schwester123",
    role: "family",
    emoji: "⚖️",
    age: 22,
    language: "deutsch",
    isEnabled: true,
  },
  {
    id: "mama",
    username: "mama",
    displayName: "Mama",
    password: "mama123",
    role: "family",
    emoji: "👩",
    age: 45,
    language: "portugues",
    isEnabled: true,
  },
  {
    id: "papa",
    username: "papa",
    displayName: "Papa",
    password: "papa123",
    role: "family",
    emoji: "👨",
    age: 48,
    language: "deutsch",
    isEnabled: true,
  },
  {
    id: "oma",
    username: "oma",
    displayName: "Oma",
    password: "oma123",
    role: "family",
    emoji: "👵",
    age: 72,
    language: "deutsch",
    isEnabled: true,
  },
  {
    id: "bruder",
    username: "bruder",
    displayName: "Bruder",
    password: "bruder123",
    role: "family",
    emoji: "🧑",
    age: 18,
    language: "deutsch",
    isEnabled: true,
  },
  // Gäste
  {
    id: "gast1",
    username: "gast1",
    displayName: "Gast 1",
    password: "gast1234",
    role: "guest",
    emoji: "👤",
    age: null,
    language: "auto",
    isEnabled: false,
    sessionTimeout: 8,
  },
  {
    id: "gast2",
    username: "gast2",
    displayName: "Gast 2",
    password: "gast1234",
    role: "guest",
    emoji: "👤",
    age: null,
    language: "auto",
    isEnabled: false,
    sessionTimeout: 8,
  },
  {
    id: "gast3",
    username: "gast3",
    displayName: "Gast 3",
    password: "gast1234",
    role: "guest",
    emoji: "👤",
    age: null,
    language: "auto",
    isEnabled: false,
    sessionTimeout: 8,
  },
  {
    id: "gast4",
    username: "gast4",
    displayName: "Gast 4",
    password: "gast1234",
    role: "guest",
    emoji: "👤",
    age: null,
    language: "auto",
    isEnabled: false,
    sessionTimeout: 8,
  },
];

// Convert NexusUser to legacy User for backward compat
function toLegacyUser(u: NexusUser): User {
  return {
    username: u.username,
    password: u.password,
    displayName: u.customName || u.displayName,
    role: u.role === "admin" ? "admin" : u.role === "family" ? "standard" : "limited",
    avatar: u.emoji,
    emoji: u.emoji,
    age: u.age,
    language: u.language,
    isEnabled: u.isEnabled,
    customName: u.customName,
    sessionTimeout: u.sessionTimeout,
  };
}

export const USERS: User[] = DEFAULT_USERS.map(toLegacyUser);

export async function loadUsers(): Promise<NexusUser[]> {
  const data = await AsyncStorage.getItem(USERS_KEY);
  if (!data) return DEFAULT_USERS.map((u) => ({ ...u }));
  const saved: NexusUser[] = JSON.parse(data);
  const savedIds = new Set(saved.map((u) => u.id));
  return [
    ...saved,
    ...DEFAULT_USERS.filter((u) => !savedIds.has(u.id)),
  ];
}

export async function saveUsers(users: NexusUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function updateUser(
  userId: string,
  updates: Partial<NexusUser>
): Promise<void> {
  const users = await loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...updates };
    await saveUsers(users);
  }
}

export function authenticateUser(
  username: string,
  password: string
): User | null {
  const user = DEFAULT_USERS.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password &&
      u.isEnabled
  );
  return user ? toLegacyUser(user) : null;
}

// Async version that checks persisted users (for renamed guests etc.)
export async function authenticateUserAsync(
  username: string,
  password: string
): Promise<User | null> {
  const users = await loadUsers();
  const user = users.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password &&
      u.isEnabled
  );
  return user ? toLegacyUser(user) : null;
}

export function getDisplayName(user: NexusUser): string {
  return user.customName || user.displayName;
}

// Clean up guest chat history older than 7 days
export async function cleanGuestHistory(): Promise<void> {
  const users = await loadUsers();
  const guests = users.filter((u) => u.role === "guest");
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const guest of guests) {
    const key = `nexus_chat_${guest.username}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) continue;
    try {
      const messages = JSON.parse(data);
      const filtered = messages.filter(
        (m: any) => m.timestamp > sevenDaysAgo
      );
      if (filtered.length < messages.length) {
        await AsyncStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }
}
