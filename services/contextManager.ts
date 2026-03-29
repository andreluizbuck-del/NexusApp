import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "../store/chatHistory";

const SUMMARY_KEY = "nexus_context_summary";
const RECENT_COUNT = 20;
const COMPRESS_THRESHOLD = 30;
const COMPRESS_BATCH = 10;

export interface ContextWindow {
  summary: string;
  summaryUpTo: number; // message index where summary ends
  recentMessages: ChatMessage[];
}

async function getSummary(username: string): Promise<{ text: string; upTo: number }> {
  const data = await AsyncStorage.getItem(`${SUMMARY_KEY}_${username}`);
  if (!data) return { text: "", upTo: 0 };
  return JSON.parse(data);
}

async function saveSummary(
  username: string,
  text: string,
  upTo: number
): Promise<void> {
  await AsyncStorage.setItem(
    `${SUMMARY_KEY}_${username}`,
    JSON.stringify({ text, upTo })
  );
}

// Build context window: summary + recent messages
export async function buildContextWindow(
  username: string,
  allMessages: ChatMessage[]
): Promise<ContextWindow> {
  const { text: existingSummary, upTo } = await getSummary(username);

  // Filter to only user/assistant messages (skip system)
  const chatMessages = allMessages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  if (chatMessages.length <= RECENT_COUNT) {
    return {
      summary: existingSummary,
      summaryUpTo: upTo,
      recentMessages: chatMessages,
    };
  }

  // Return last RECENT_COUNT messages + existing summary
  const recentMessages = chatMessages.slice(-RECENT_COUNT);

  return {
    summary: existingSummary,
    summaryUpTo: upTo,
    recentMessages,
  };
}

// Generate summary of older messages (call after getting AI response)
export async function maybeCompressHistory(
  username: string,
  allMessages: ChatMessage[],
  summarizer: (text: string) => Promise<string>
): Promise<void> {
  const chatMessages = allMessages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  if (chatMessages.length < COMPRESS_THRESHOLD) return;

  const { upTo } = await getSummary(username);
  const toCompress = chatMessages.slice(upTo, upTo + COMPRESS_BATCH);

  if (toCompress.length < COMPRESS_BATCH) return;

  const text = toCompress
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n");

  try {
    const summary = await summarizer(text);
    const { text: existingSummary } = await getSummary(username);
    const newSummary = existingSummary
      ? `${existingSummary}\n${summary}`
      : summary;
    await saveSummary(username, newSummary, upTo + COMPRESS_BATCH);
  } catch {
    // Don't block on summary failure
  }
}

// Prepare messages array for API call with context window
export function prepareMessagesForAPI(
  context: ContextWindow
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [];

  if (context.summary) {
    messages.push({
      role: "user",
      content: `[FRÜHERE GESPRÄCHE]\n${context.summary}\n[AKTUELLE NACHRICHTEN]`,
    });
    messages.push({
      role: "assistant",
      content: "Verstanden, ich erinnere mich an den Kontext.",
    });
  }

  for (const msg of context.recentMessages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}

// Clear summary when chat is cleared
export async function clearContextSummary(username: string): Promise<void> {
  await AsyncStorage.removeItem(`${SUMMARY_KEY}_${username}`);
}
