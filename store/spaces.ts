import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SpaceMessage {
  id: string;
  authorId: string; // userId or 'nexus'
  content: string;
  type: "text" | "ai_response" | "file" | "fact";
  timestamp: string;
}

export interface FamilySpace {
  id: string;
  name: string;
  icon: string;
  createdBy: string;
  members: string[];
  messages: SpaceMessage[];
  sharedFacts: string[];
  isArchived: boolean;
  createdAt: string;
}

const SPACES_KEY = "nexus_spaces_v1";

export async function loadSpaces(): Promise<FamilySpace[]> {
  const data = await AsyncStorage.getItem(SPACES_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveSpaces(spaces: FamilySpace[]): Promise<void> {
  await AsyncStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
}

export async function createSpace(space: FamilySpace): Promise<void> {
  const spaces = await loadSpaces();
  spaces.push(space);
  await saveSpaces(spaces);
}

export async function deleteSpace(spaceId: string): Promise<void> {
  const spaces = await loadSpaces();
  await saveSpaces(spaces.filter((s) => s.id !== spaceId));
}

export async function addSpaceMessage(
  spaceId: string,
  message: SpaceMessage
): Promise<void> {
  const spaces = await loadSpaces();
  const idx = spaces.findIndex((s) => s.id === spaceId);
  if (idx >= 0) {
    spaces[idx].messages.push(message);
    await saveSpaces(spaces);
  }
}

export async function getSpacesForUser(
  userId: string
): Promise<FamilySpace[]> {
  const spaces = await loadSpaces();
  return spaces.filter(
    (s) => !s.isArchived && s.members.includes(userId)
  );
}

export async function updateSpace(
  spaceId: string,
  updates: Partial<FamilySpace>
): Promise<void> {
  const spaces = await loadSpaces();
  const idx = spaces.findIndex((s) => s.id === spaceId);
  if (idx >= 0) {
    spaces[idx] = { ...spaces[idx], ...updates };
    await saveSpaces(spaces);
  }
}

export const SPACE_TEMPLATES = [
  { icon: "🏖️", name: "Sommerurlaub 2026" },
  { icon: "🏠", name: "Hausrenovierung" },
  { icon: "🎓", name: "Schule & Studium" },
  { icon: "💰", name: "Familienfinanzen" },
  { icon: "🛒", name: "Einkauf & Haushalt" },
  { icon: "🎉", name: "Party Planung" },
];
