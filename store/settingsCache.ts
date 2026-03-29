import { UserSettings, loadSettings, saveSettings } from "./userSettings";

interface CacheEntry {
  settings: UserSettings;
  loadedAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

export async function getCachedSettings(
  username: string
): Promise<UserSettings> {
  const entry = cache.get(username);
  if (entry && Date.now() - entry.loadedAt < CACHE_TTL) {
    return entry.settings;
  }
  const settings = await loadSettings(username);
  cache.set(username, { settings, loadedAt: Date.now() });
  return settings;
}

export async function saveCachedSettings(
  username: string,
  settings: UserSettings
): Promise<void> {
  await saveSettings(username, settings);
  cache.set(username, { settings, loadedAt: Date.now() });
}

export function invalidateCache(username?: string): void {
  if (username) {
    cache.delete(username);
  } else {
    cache.clear();
  }
}

export function isCached(username: string): boolean {
  const entry = cache.get(username);
  return !!entry && Date.now() - entry.loadedAt < CACHE_TTL;
}
