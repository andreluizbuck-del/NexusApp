import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function chatKey(username: string): string {
  return `nexus_chat_${username}`;
}

export async function loadChatHistory(
  username: string
): Promise<ChatMessage[]> {
  const data = await AsyncStorage.getItem(chatKey(username));
  if (!data) return [];
  return JSON.parse(data) as ChatMessage[];
}

export async function saveChatHistory(
  username: string,
  messages: ChatMessage[]
): Promise<void> {
  // Keep last 200 messages to prevent storage bloat
  const trimmed = messages.slice(-200);
  await AsyncStorage.setItem(chatKey(username), JSON.stringify(trimmed));
}

export async function clearChatHistory(username: string): Promise<void> {
  await AsyncStorage.removeItem(chatKey(username));
}
