import AsyncStorage from "@react-native-async-storage/async-storage";

export type FactCategory =
  | "family"
  | "health"
  | "schedule"
  | "preference"
  | "work"
  | "other";
export type FactVisibility = "private" | "family" | "admin_only";
export type FactSource = "manual" | "chat_extracted" | "user_shared";

export interface KnowledgeFact {
  id: string;
  content: string;
  category: FactCategory;
  visibility: FactVisibility;
  createdBy: string;
  createdAt: string;
  source: FactSource;
  verified: boolean;
}

const FACTS_KEY = "nexus_knowledge_facts";
const PRIVACY_KEY = "nexus_privacy";

export interface PrivacySettings {
  memoryEnabled: boolean;
  incognitoMode: boolean;
}

const DEFAULT_PRIVACY: PrivacySettings = {
  memoryEnabled: true,
  incognitoMode: false,
};

// --- Privacy Settings ---

export async function getPrivacySettings(
  username: string
): Promise<PrivacySettings> {
  const data = await AsyncStorage.getItem(`${PRIVACY_KEY}_${username}`);
  return data ? { ...DEFAULT_PRIVACY, ...JSON.parse(data) } : DEFAULT_PRIVACY;
}

export async function savePrivacySettings(
  username: string,
  settings: PrivacySettings
): Promise<void> {
  await AsyncStorage.setItem(
    `${PRIVACY_KEY}_${username}`,
    JSON.stringify(settings)
  );
}

// --- Incognito (in-memory only, no persistence) ---

let incognitoUsers = new Set<string>();

export function isIncognito(username: string): boolean {
  return incognitoUsers.has(username);
}

export function setIncognito(username: string, active: boolean): void {
  if (active) {
    incognitoUsers.add(username);
  } else {
    incognitoUsers.delete(username);
  }
}

// --- Knowledge Facts ---

export async function loadFacts(): Promise<KnowledgeFact[]> {
  const data = await AsyncStorage.getItem(FACTS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveFacts(facts: KnowledgeFact[]): Promise<void> {
  await AsyncStorage.setItem(FACTS_KEY, JSON.stringify(facts));
}

export async function addFact(fact: KnowledgeFact): Promise<void> {
  const facts = await loadFacts();
  facts.push(fact);
  await saveFacts(facts);
}

/**
 * Only the creator or admin (andre) can delete a fact.
 * Returns true if deleted, false if not authorized.
 */
export async function deleteFact(
  factId: string,
  requestingUsername: string
): Promise<boolean> {
  const facts = await loadFacts();
  const fact = facts.find((f) => f.id === factId);
  if (!fact) return false;
  if (fact.createdBy !== requestingUsername && requestingUsername !== "andre") {
    return false;
  }
  await saveFacts(facts.filter((f) => f.id !== factId));
  return true;
}

export async function updateFact(
  factId: string,
  updates: Partial<KnowledgeFact>
): Promise<void> {
  const facts = await loadFacts();
  const idx = facts.findIndex((f) => f.id === factId);
  if (idx >= 0) {
    facts[idx] = { ...facts[idx], ...updates };
    await saveFacts(facts);
  }
}

// Get facts visible to a specific user
export async function getVisibleFacts(
  username: string,
  userRole: string
): Promise<KnowledgeFact[]> {
  const facts = await loadFacts();
  return facts.filter((f) => {
    if (f.visibility === "private") return f.createdBy === username;
    if (f.visibility === "admin_only") return username === "andre";
    if (f.visibility === "family")
      return userRole === "family" || userRole === "admin";
    return false;
  });
}

// Alias used in api.ts
export const getFactsVisibleTo = getVisibleFacts;

/**
 * Returns a formatted string of facts to inject into the system prompt.
 * Returns empty string when incognito or no facts.
 */
export async function injectFactsIntoPrompt(
  username: string,
  userRole: string
): Promise<string> {
  const facts = await getVisibleFacts(username, userRole);
  if (facts.length === 0) return "";

  const myFacts = facts.filter(
    (f) => f.createdBy === username && f.visibility === "private"
  );
  const familyFacts = facts.filter((f) => f.visibility === "family");

  const lines: string[] = ["\n--- GEDÄCHTNIS ---"];

  if (myFacts.length > 0) {
    lines.push("[MEINE PRIVATEN INFORMATIONEN – nur für diesen Nutzer]");
    myFacts.forEach((f) => lines.push(`• ${f.content}`));
  }

  if (familyFacts.length > 0) {
    lines.push("[FAMILIENWISSEN – geteilt]");
    familyFacts.forEach((f) =>
      lines.push(`• ${f.content} (geteilt von ${f.createdBy})`)
    );
  }

  lines.push("--- ENDE GEDÄCHTNIS ---");
  return lines.join("\n");
}

// --- Auto Fact Extraction ---

interface ExtractedFact {
  content: string;
  category: FactCategory;
  suggestedVisibility: FactVisibility;
}

const EXTRACTION_PATTERNS: {
  regex: RegExp;
  category: FactCategory;
  extract: (match: RegExpMatchArray) => string;
}[] = [
  {
    regex: /(?:wir|ich) (?:fahren?|fliegen?|reisen?) (?:nach|in|auf) (.+?)(?:\.|!|$)/i,
    category: "schedule",
    extract: (m) => `Reise nach ${m[1].trim()}`,
  },
  {
    regex: /ich (?:mag|esse|trinke) (?:kein(?:e|en)?|nicht) (.+?)(?:\.|!|$)/i,
    category: "preference",
    extract: (m) => `Mag nicht: ${m[1].trim()}`,
  },
  {
    regex: /ich (?:mag|liebe|esse gern(?:e)?|trinke gern(?:e)?) (.+?)(?:\.|!|$)/i,
    category: "preference",
    extract: (m) => `Mag: ${m[1].trim()}`,
  },
  {
    regex: /(\w+) hat (?:am |)(\d{1,2})\.?\s*(\w+)\.?\s*(?:geburtstag|birthday)/i,
    category: "family",
    extract: (m) => `${m[1]} hat Geburtstag am ${m[2]}. ${m[3]}`,
  },
  {
    regex: /(?:ich bin|ich habe) allergisch (?:gegen|auf) (.+?)(?:\.|!|$)/i,
    category: "health",
    extract: (m) => `Allergie: ${m[1].trim()}`,
  },
  {
    regex: /(?:meine|unsere) (?:adresse|anschrift) ist (.+?)(?:\.|!|$)/i,
    category: "other",
    extract: (m) => `Adresse: ${m[1].trim()}`,
  },
  {
    regex: /ich (?:arbeite|bin beschäftigt) (?:bei|als|in) (.+?)(?:\.|!|$)/i,
    category: "work",
    extract: (m) => `Arbeit: ${m[1].trim()}`,
  },
  {
    regex: /(?:termin|arzttermin|meeting) (?:am|um|bei) (.+?)(?:\.|!|$)/i,
    category: "schedule",
    extract: (m) => `Termin: ${m[1].trim()}`,
  },
];

export function extractFactsFromText(text: string): ExtractedFact[] {
  const results: ExtractedFact[] = [];
  for (const pattern of EXTRACTION_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      results.push({
        content: pattern.extract(match),
        category: pattern.category,
        suggestedVisibility: "private", // NEVER auto-family
      });
    }
  }
  return results;
}

// Delete all data for a user (GDPR-style)
export async function deleteAllUserData(username: string): Promise<void> {
  // Remove user's facts
  const facts = await loadFacts();
  await saveFacts(facts.filter((f) => f.createdBy !== username));

  // Remove user's privacy settings
  await AsyncStorage.removeItem(`${PRIVACY_KEY}_${username}`);

  // Remove user's chat history
  await AsyncStorage.removeItem(`nexus_chat_${username}`);

  // Remove user's settings
  await AsyncStorage.removeItem(`nexus_settings_${username}`);

  // Remove user's active skills
  await AsyncStorage.removeItem(`nexus_active_skills_${username}`);

  // Remove user's skill ratings
  await AsyncStorage.removeItem(`nexus_skill_ratings_${username}`);

  // Remove user's reminders and proactive messages
  await AsyncStorage.multiRemove([
    `nexus_reminders_${username}`,
    `nexus_proactive_${username}`,
  ]);

  // Clear in-memory incognito state
  incognitoUsers.delete(username);
}
