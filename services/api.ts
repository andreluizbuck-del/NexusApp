import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "../store/chatHistory";
import { UserSettings, DEFAULT_SETTINGS } from "../store/userSettings";
import { Skill } from "../store/skills";
import { User } from "../store/users";
import { isIncognito, injectFactsIntoPrompt } from "../store/privacy";
import {
  buildContextWindow,
  prepareMessagesForAPI,
} from "./contextManager";

const API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY || "";
const DEFAULT_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const SERVER_URL_KEY = "nexus_server_url";
const SERVER_MODEL_KEY = "nexus_server_model";

export async function getServerUrl(): Promise<string> {
  return (await AsyncStorage.getItem(SERVER_URL_KEY)) || DEFAULT_URL;
}

export async function setServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url);
}

export async function getServerModel(): Promise<string> {
  return (await AsyncStorage.getItem(SERVER_MODEL_KEY)) || DEFAULT_MODEL;
}

export async function setServerModel(model: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_MODEL_KEY, model);
}

function isOllama(url: string): boolean {
  return url.includes(":11434") || url.includes("/api/chat");
}

// --- NEXUS ALWAYS ASKS (highest priority, always first) ---
const NEXUS_ALWAYS_ASKS = `WICHTIG: Gib NIEMALS unsichere Fakten als Wahrheit aus.
Sage "Konfidenz: X/10" bei unsicheren Aussagen.
Frage IMMER nach bei: fehlendem Datum/Uhrzeit für Erinnerungen, mehrdeutigen Anfragen, irreversiblen Aktionen.
Stelle maximal EINE Frage pro Antwort.`;

// --- AGE-BASED ADAPTATION ---
function getAgeAdaptation(age: number | null): string {
  if (age === null) return "";
  if (age >= 70)
    return "Sprich sehr einfach und klar. Kurze Sätze. Keine Abkürzungen. Sei geduldig und erkläre Schritt für Schritt. Vermeide Fachbegriffe.";
  if (age >= 60)
    return "Sprich klar und deutlich. Erkläre technische Begriffe kurz.";
  if (age <= 12)
    return "Sprich kindgerecht und spielerisch. Nutze einfache Wörter und Beispiele aus dem Alltag. Sei ermutigend und positiv.";
  if (age <= 16)
    return "Sprich auf Augenhöhe. Nicht zu förmlich, aber respektvoll. Direkt und ohne Umschweife.";
  return "";
}

export function buildSystemPrompt(
  user: User,
  settings: UserSettings,
  activeSkills?: Skill[]
): string {
  const parts: string[] = [];

  // 1. "Nexus Always Asks" FIRST (highest priority)
  parts.push(NEXUS_ALWAYS_ASKS);

  // 2. Identity
  parts.push(
    `\nDu bist ${settings.aiName}, ein persönlicher KI-Assistent für ${user.displayName}.`
  );
  if (settings.aiPersonality) {
    parts.push(`Deine Persönlichkeit: ${settings.aiPersonality}`);
  }

  // 3. Age adaptation
  const ageHint = getAgeAdaptation(user.age ?? null);
  if (ageHint) parts.push(ageHint);

  // 4. Tone
  const toneMap: Record<string, string> = {
    casual: "Antworte locker und freundlich wie ein guter Freund.",
    direct: "Antworte direkt und präzise. Keine unnötigen Floskeln.",
    formal: "Antworte professionell und höflich.",
  };
  parts.push(toneMap[settings.tone] || toneMap.casual);

  // 5. Length
  const lengthMap: Record<string, string> = {
    short: "Halte Antworten kurz (1-3 Sätze wenn möglich).",
    medium: "Normale Antwortlänge.",
    long: "Antworte ausführlich und detailliert.",
  };
  parts.push(lengthMap[settings.responseLength] || lengthMap.medium);

  // 6. Language
  if (settings.language !== "auto") {
    const langMap: Record<string, string> = {
      deutsch: "Antworte immer auf Deutsch.",
      english: "Always respond in English.",
      portugues: "Responda sempre em Português.",
    };
    if (langMap[settings.language]) parts.push(langMap[settings.language]);
  }

  // 7. Thinking depth
  if (settings.thinkingDepth === "deep") {
    parts.push(
      "Denke gründlich nach bevor du antwortest. Analysiere das Problem von mehreren Seiten."
    );
  }

  // 8. Persona
  const personaMap: Record<string, string> = {
    assistant: "Verhalte dich als professioneller Assistent.",
    friend:
      "Verhalte dich wie ein enger Freund. Sei persönlich und nutze lockere Sprache.",
    teacher:
      "Verhalte dich als geduldiger Lehrer. Erkläre Schritt für Schritt.",
  };
  parts.push(personaMap[settings.persona] || personaMap.assistant);

  // 9. Restrictions
  if (!settings.hackingEnabled) {
    parts.push(
      "Du darfst KEINE Hacking-Anleitungen, Exploits oder illegale Aktivitäten erklären."
    );
  }
  if (!settings.adultContentEnabled) {
    parts.push("Halte alle Inhalte familienfreundlich.");
  }

  // 10. Guest restrictions
  if (user.role === "limited" || user.role === "guest") {
    parts.push(
      "Der Benutzer ist ein Gast. Teile KEINE privaten Familieninformationen. Kein Zugriff auf Cybersecurity-Skills."
    );
  }

  // 10b. Privacy rule (all users) — non-negotiable
  parts.push(
    "DATENSCHUTZ-REGEL (nicht verhandelbar): Du darfst NIEMALS Informationen aus anderen Familienmitglieder-Gesprächen teilen oder darauf hinweisen. Jeder Benutzer hat einen vollständig isolierten, privaten Kontext. Wenn jemand nach privaten Daten einer anderen Person fragt: Antworte NUR 'Diese Information ist privat.' Respektiere den Inkognito-Modus – wenn aktiv, verwende das Gedächtnis nicht und speichere nichts."
  );

  // 11. Custom instructions
  if (settings.customInstructions) {
    parts.push(
      `\n--- PERSÖNLICHE ANWEISUNGEN ---\n${settings.customInstructions}`
    );
  }

  // 12. Active skills
  if (activeSkills && activeSkills.length > 0) {
    const skillParts = activeSkills
      .map((s) => `[${s.name}]: ${s.systemPrompt}`)
      .join("\n\n");
    parts.push(`\n--- AKTIVE SKILLS (${activeSkills.length}/3) ---\n${skillParts}`);
  }

  return parts.join("\n");
}

const CONTEXT_LIMITS: Record<string, number> = { short: 10, medium: 40, long: 80 };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

export async function sendMessage(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  user?: User,
  settings?: UserSettings,
  activeSkills?: Skill[]
): Promise<void> {
  const serverUrl = await getServerUrl();
  const model = await getServerModel();
  const s = settings || DEFAULT_SETTINGS;

  // Build base prompt
  let systemPrompt = user
    ? buildSystemPrompt(user, s, activeSkills)
    : "Du bist Nexus, ein persönlicher KI-Assistent.";

  // Inject knowledge facts (skip in incognito mode)
  if (user && !isIncognito(user.username)) {
    try {
      const factsBlock = await injectFactsIntoPrompt(user.username, user.role);
      if (factsBlock) systemPrompt += factsBlock;
    } catch {
      // non-fatal — continue without facts
    }
  }

  // Use context manager for smart windowing
  let apiMessages: AnthropicMessage[];
  if (user) {
    try {
      const context = await buildContextWindow(user.username, messages);
      apiMessages = prepareMessagesForAPI(context) as AnthropicMessage[];
    } catch {
      // Fallback to simple slice
      const contextLimit = CONTEXT_LIMITS[s.maxContextLength] || 40;
      apiMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-contextLimit)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    }
  } else {
    apiMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-40)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }

  if (isOllama(serverUrl)) {
    return sendOllama(serverUrl, model, systemPrompt, apiMessages, callbacks, signal);
  }

  return sendClaude(serverUrl, model, systemPrompt, apiMessages, callbacks, signal);
}

// Board of Advisors: send same message to 3 personas
export async function sendBoardOfAdvisors(
  message: string,
  user: User,
  settings: UserSettings,
  signal?: AbortSignal
): Promise<{ analyst: string; critic: string; optimist: string }> {
  const serverUrl = await getServerUrl();
  const model = await getServerModel();

  const personas = [
    {
      key: "analyst",
      prompt: `Du bist der ANALYTIKER im Board of Advisors. Sei logisch, datengetrieben, liste Pro und Contra auf. Antworte auf ${settings.language === "english" ? "Englisch" : "Deutsch"}.`,
    },
    {
      key: "critic",
      prompt: `Du bist der ADVOCATUS DIABOLI im Board of Advisors. Finde ALLE Probleme, Risiken und Schwachstellen. Sei kritisch aber konstruktiv. Antworte auf ${settings.language === "english" ? "Englisch" : "Deutsch"}.`,
    },
    {
      key: "optimist",
      prompt: `Du bist der OPTIMIST im Board of Advisors. Zeige das Best-Case-Szenario. Sei ermutigend und zeige Chancen auf. Antworte auf ${settings.language === "english" ? "Englisch" : "Deutsch"}.`,
    },
  ];

  const results: Record<string, string> = {};

  await Promise.all(
    personas.map(async (p) => {
      try {
        const msgs: AnthropicMessage[] = [{ role: "user", content: message }];
        let text = "";
        await new Promise<void>((resolve, reject) => {
          const cb: StreamCallbacks = {
            onToken: (t) => { text += t; },
            onDone: (t) => { results[p.key] = t; resolve(); },
            onError: (e) => { results[p.key] = `Fehler: ${e}`; resolve(); },
          };
          if (isOllama(serverUrl)) {
            sendOllama(serverUrl, model, p.prompt, msgs, cb, signal).catch(reject);
          } else {
            sendClaude(serverUrl, model, p.prompt, msgs, cb, signal).catch(reject);
          }
        });
      } catch {
        results[p.key] = "Fehler bei der Abfrage.";
      }
    })
  );

  return {
    analyst: results.analyst || "",
    critic: results.critic || "",
    optimist: results.optimist || "",
  };
}

async function sendClaude(
  url: string,
  model: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  if (!API_KEY) {
    callbacks.onError("API Key nicht konfiguriert. Setze EXPO_PUBLIC_CLAUDE_API_KEY in .env.");
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages, stream: true }),
      signal,
    });

    if (!response.ok) {
      callbacks.onError(`API Fehler ${response.status}: ${await response.text()}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) { callbacks.onError("Kein Response-Stream"); return; }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
            fullText += parsed.delta.text;
            callbacks.onToken(parsed.delta.text);
          } else if (parsed.type === "error") {
            callbacks.onError(parsed.error?.message || "Stream Fehler");
            return;
          }
        } catch {}
      }
    }
    callbacks.onDone(fullText);
  } catch (err: any) {
    if (err.name === "AbortError") return;
    callbacks.onError(err.message || "Netzwerkfehler");
  }
}

async function sendOllama(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const url = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/api/chat`;
  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "llama3", messages: ollamaMessages, stream: true }),
      signal,
    });

    if (!response.ok) {
      callbacks.onError(`Ollama Fehler ${response.status}: ${await response.text()}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) { callbacks.onError("Kein Response-Stream"); return; }

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            fullText += parsed.message.content;
            callbacks.onToken(parsed.message.content);
          }
        } catch {}
      }
    }
    callbacks.onDone(fullText);
  } catch (err: any) {
    if (err.name === "AbortError") return;
    callbacks.onError(err.message || "Netzwerkfehler");
  }
}

export async function testConnection(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const serverUrl = await getServerUrl();
  const start = Date.now();

  if (isOllama(serverUrl)) {
    try {
      const url = serverUrl.replace(/\/api\/chat\/?$/, "");
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return { ok: res.ok, latency: Date.now() - start };
    } catch (e: any) {
      return { ok: false, latency: Date.now() - start, error: e.message };
    }
  }

  if (!API_KEY) return { ok: false, latency: 0, error: "Kein API Key" };
  try {
    const res = await fetch(serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: await getServerModel(),
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok, latency: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latency: Date.now() - start, error: e.message };
  }
}
