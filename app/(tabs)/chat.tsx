import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../store/AuthContext";
import {
  ChatMessage,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
} from "../../store/chatHistory";
import { loadSettings, UserSettings } from "../../store/userSettings";
import {
  Skill,
  loadSkills,
  getActiveSkills,
  setActiveSkills,
} from "../../store/skills";
import { sendMessage, sendBoardOfAdvisors } from "../../services/api";
import {
  parseReminderFromText,
  scheduleReminder,
} from "../../services/notifications";
import {
  isIncognito,
  setIncognito,
  extractFactsFromText,
  addFact,
  getPrivacySettings,
} from "../../store/privacy";
import {
  detectAgentCommand,
  findAgentForCommand,
  DEVICE_ICONS,
  CAPABILITY_LABELS,
} from "../../store/agents";
import {
  loadProactiveMessages,
  dismissProactiveMessage,
  checkTriggers,
  ProactiveMessage,
} from "../../services/familyRadar";
import ChatBubble from "../../components/ChatBubble";
import ChatInput from "../../components/ChatInput";
import TypingIndicator from "../../components/TypingIndicator";
import QuickReplies from "../../components/QuickReplies";
import SkillIndicator from "../../components/SkillIndicator";
import SkillPickerModal from "../../components/SkillPickerModal";
import ConfidenceIndicator from "../../components/ConfidenceIndicator";
import BoardOfAdvisors from "../../components/BoardOfAdvisors";
import ProactiveMessages from "../../components/ProactiveMessages";

export default function ChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeSkillList, setActiveSkillList] = useState<Skill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [skillPickerVisible, setSkillPickerVisible] = useState(false);
  const [incognito, setIncognitoState] = useState(false);
  const [proactiveMessages, setProactiveMessages] = useState<ProactiveMessage[]>([]);
  // Board of Advisors
  const [boardMode, setBoardMode] = useState(false);
  const [boardResult, setBoardResult] = useState<{
    analyst: string;
    critic: string;
    optimist: string;
  } | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user) return;
    loadChatHistory(user.username).then(setMessages);
    loadSettings(user.username).then(setSettings);
    getActiveSkills(user.username).then(setActiveSkillList);
    loadSkills().then(setAllSkills);
    setIncognitoState(isIncognito(user.username));
    loadProactiveMessages(user.username).then(setProactiveMessages);
    checkTriggers(user.username).catch(() => {});
  }, [user]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const addSystemMessage = (text: string, msgs: ChatMessage[]): ChatMessage[] => {
    const sysMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "system" as any,
      content: text,
      timestamp: Date.now(),
    };
    const updated = [...msgs, sysMsg];
    if (user && !incognito) saveChatHistory(user.username, updated);
    return updated;
  };

  const handleSkillToggle = async (skill: Skill) => {
    if (!user) return;
    const isActive = activeSkillList.some((s) => s.id === skill.id);
    let newList: Skill[];
    let msg: string;
    if (isActive) {
      newList = activeSkillList.filter((s) => s.id !== skill.id);
      msg = `Skill "${skill.name}" deaktiviert`;
    } else {
      if (activeSkillList.length >= 3) return;
      newList = [...activeSkillList, skill];
      msg = `${skill.icon} Skill "${skill.name}" aktiviert`;
    }
    setActiveSkillList(newList);
    await setActiveSkills(user.username, newList);
    setMessages((prev) => addSystemMessage(msg, prev));
  };

  const handleSkillRemove = async (skill: Skill) => {
    if (!user) return;
    const newList = activeSkillList.filter((s) => s.id !== skill.id);
    setActiveSkillList(newList);
    await setActiveSkills(user.username, newList);
    setMessages((prev) => addSystemMessage(`Skill "${skill.name}" deaktiviert`, prev));
  };

  const handleClearAllSkills = async () => {
    if (!user) return;
    setActiveSkillList([]);
    await setActiveSkills(user.username, []);
    setMessages((prev) => addSystemMessage("Alle Skills deaktiviert", prev));
  };

  const handleToggleIncognito = () => {
    if (!user) return;
    const next = !incognito;
    setIncognitoState(next);
    setIncognito(user.username, next);
    setMessages((prev) =>
      addSystemMessage(
        next
          ? "👻 Inkognito-Modus aktiviert – nichts wird gespeichert"
          : "Inkognito-Modus deaktiviert",
        prev
      )
    );
  };

  const handleDismissProactive = async (id: string) => {
    if (!user) return;
    await dismissProactiveMessage(user.username, id);
    setProactiveMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSend = async (text: string) => {
    if (!user || isStreaming || !settings) return;

    // Board of Advisors mode
    if (boardMode) {
      setBoardLoading(true);
      setBoardResult(null);
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: `🏛️ Board: ${text}`,
        timestamp: Date.now(),
      };
      const updated = [...messages, userMsg];
      setMessages(updated);
      if (!incognito) saveChatHistory(user.username, updated);

      try {
        const result = await sendBoardOfAdvisors(text, user as any, settings);
        setBoardResult(result);
      } catch {
        setBoardResult({
          analyst: "Fehler bei der Analyse.",
          critic: "Fehler bei der Analyse.",
          optimist: "Fehler bei der Analyse.",
        });
      }
      setBoardLoading(false);
      return;
    }

    // Check for agent commands
    const agentCmd = detectAgentCommand(text);
    if (agentCmd) {
      const agent = await findAgentForCommand(agentCmd);
      if (agent) {
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "user",
          content: text,
          timestamp: Date.now(),
        };
        const pendingMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "system" as any,
          content: `__AGENT_PENDING__${JSON.stringify({ device: agent.name, icon: DEVICE_ICONS[agent.deviceType], capability: agentCmd.capability })}`,
          timestamp: Date.now(),
        };
        const updated = [...messages, userMsg, pendingMsg];
        setMessages(updated);

        // Simulate agent execution (real: WebSocket to agent)
        const execStart = Date.now();
        setTimeout(() => {
          const duration = Date.now() - execStart;
          const resultMsg: ChatMessage = {
            id: (Date.now() + 2).toString(),
            role: "system" as any,
            content: `__AGENT_RESULT__${JSON.stringify({
              device: agent.name,
              icon: DEVICE_ICONS[agent.deviceType],
              capability: agentCmd.capability,
              duration,
              result: `Befehl "${CAPABILITY_LABELS[agentCmd.capability] || agentCmd.capability}" an ${agent.name} gesendet. Agent ist ${agent.isOnline ? "online" : "offline"}.`,
            })}`,
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.content.startsWith("__AGENT_PENDING__"));
            const all = [...filtered, resultMsg];
            if (!incognito && user) saveChatHistory(user.username, all);
            return all;
          });
        }, 1500);
        return;
      }
    }

    // Check for reminder
    const reminder = parseReminderFromText(text);
    if (reminder) {
      try {
        await scheduleReminder("Nexus Erinnerung", reminder.text, reminder.date);
        const timeStr = reminder.date.toLocaleString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        const userMsg: ChatMessage = {
          id: (Date.now() - 1).toString(),
          role: "user",
          content: text,
          timestamp: Date.now(),
        };
        const sysMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "system" as any,
          content: `Erinnerung gesetzt für ${timeStr}: ${reminder.text}`,
          timestamp: Date.now(),
        };
        const updated = [...messages, userMsg, sysMsg];
        setMessages(updated);
        if (!incognito) saveChatHistory(user.username, updated);
        return;
      } catch {
        // Fall through to normal chat
      }
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsStreaming(true);
    setStreamingText("");
    scrollToBottom();

    const controller = new AbortController();
    abortRef.current = controller;

    await sendMessage(
      updatedMessages,
      {
        onToken: (token) => {
          setStreamingText((prev) => prev + token);
          scrollToBottom();
        },
        onDone: (finalText) => {
          const assistantMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: finalText,
            timestamp: Date.now(),
          };
          const allMessages = [...updatedMessages, assistantMsg];
          setMessages(allMessages);
          if (!incognito) {
            saveChatHistory(user.username, allMessages);
            // Auto fact extraction (non-blocking)
            extractAndSaveFacts(user.username, text);
          }
          setIsStreaming(false);
          setStreamingText("");
          scrollToBottom();
        },
        onError: (error) => {
          const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Fehler: ${error}`,
            timestamp: Date.now(),
          };
          const allMessages = [...updatedMessages, errorMsg];
          setMessages(allMessages);
          if (!incognito) saveChatHistory(user.username, allMessages);
          setIsStreaming(false);
          setStreamingText("");
        },
      },
      controller.signal,
      user as any,
      settings,
      activeSkillList
    );
  };

  const extractAndSaveFacts = async (username: string, userText: string) => {
    try {
      const privacy = await getPrivacySettings(username);
      if (!privacy.memoryEnabled) return;
      const facts = extractFactsFromText(userText);
      for (const f of facts) {
        await addFact({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          content: f.content,
          category: f.category,
          visibility: f.suggestedVisibility,
          createdBy: username,
          createdAt: new Date().toISOString(),
          source: "chat_extracted",
          verified: false,
        });
      }
    } catch {
      // Never block UI
    }
  };

  const handleClearChat = () => {
    if (!user) return;
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    setStreamingText("");
    clearChatHistory(user.username);
    setBoardResult(null);
    setBoardMode(false);
  };

  const handleCopy = (content: string) => {
    Clipboard.setStringAsync(content);
  };

  const handleDelete = (id: string) => {
    if (!user) return;
    const filtered = messages.filter((m) => m.id !== id);
    setMessages(filtered);
    if (!incognito) saveChatHistory(user.username, filtered);
  };

  const aiName = settings?.aiName || "Nexus";
  const aiAvatar = settings?.aiAvatar || "N";

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      // Agent pending bubble
      if (item.content.startsWith("__AGENT_PENDING__")) {
        try {
          const data = JSON.parse(item.content.replace("__AGENT_PENDING__", ""));
          return (
            <View className="mx-4 mb-3">
              <View className="bg-nexus-card border border-nexus-border rounded-2xl px-4 py-3 flex-row items-center gap-3 self-start max-w-[85%]">
                <Text className="text-lg">{data.icon}</Text>
                <View className="flex-1">
                  <Text className="text-nexus-textDim text-xs font-medium">{data.device}</Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <ActivityIndicator size="small" color="#D4A574" />
                    <Text className="text-nexus-text text-sm">Führe aus...</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        } catch { return null; }
      }

      // Agent result bubble (gray bg, device icon, execution time)
      if (item.content.startsWith("__AGENT_RESULT__")) {
        try {
          const data = JSON.parse(item.content.replace("__AGENT_RESULT__", ""));
          return (
            <View className="mx-4 mb-3">
              <View className="bg-nexus-card border border-nexus-border rounded-2xl px-4 py-3 self-start max-w-[85%]">
                <View className="flex-row items-center gap-2.5 mb-2">
                  <Text className="text-lg">{data.icon}</Text>
                  <Text className="text-nexus-text text-sm font-medium flex-1">{data.device}</Text>
                  <Text className="text-nexus-textDim text-[10px] font-mono">{data.duration}ms</Text>
                </View>
                <Text className="text-nexus-text text-sm">{data.result}</Text>
              </View>
            </View>
          );
        } catch { return null; }
      }

      return (
        <View>
          <ChatBubble
            role={item.role as any}
            content={item.content}
            timestamp={item.timestamp}
            onCopy={() => handleCopy(item.content)}
            onDelete={() => handleDelete(item.id)}
            onFeedback={() => {}}
          />
          {item.role === "assistant" && (
            <ConfidenceIndicator content={item.content} />
          )}
        </View>
      );
    },
    [messages]
  );

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-nexus-border">
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-full bg-nexus-surface items-center justify-center border border-nexus-border">
            <Text className="text-sm">
              {aiAvatar.length > 1 ? aiAvatar : null}
            </Text>
            {aiAvatar.length <= 1 && (
              <Text className="text-nexus-accent font-bold text-sm">
                {aiAvatar}
              </Text>
            )}
          </View>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-nexus-text font-semibold text-[17px]">
                {aiName}
              </Text>
              {user?.role === "admin" && (
                <View className="bg-nexus-accent/20 rounded px-1.5 py-0.5">
                  <Text className="text-nexus-accent text-[10px] font-bold">
                    ADMIN
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-nexus-textDim text-xs">
              {user?.displayName}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          {/* Board of Advisors toggle */}
          <Pressable
            onPress={() => {
              setBoardMode(!boardMode);
              setBoardResult(null);
            }}
            className={`w-8 h-8 rounded-full items-center justify-center ${
              boardMode ? "bg-purple-500/20" : "bg-nexus-surface"
            }`}
          >
            <Text className="text-xs">🏛️</Text>
          </Pressable>
          {/* Incognito toggle */}
          <Pressable
            onPress={handleToggleIncognito}
            className={`w-8 h-8 rounded-full items-center justify-center ${
              incognito ? "bg-purple-500/20" : "bg-nexus-surface"
            }`}
          >
            <Text className="text-xs">👻</Text>
          </Pressable>
          {/* Skills */}
          <SkillIndicator
            skills={activeSkillList}
            onPress={() => setSkillPickerVisible(true)}
            onRemove={handleSkillRemove}
          />
          <Pressable
            onPress={handleClearChat}
            className="w-8 h-8 rounded-full bg-nexus-surface items-center justify-center active:opacity-70"
          >
            <Ionicons name="create-outline" size={16} color="#9A9A9A" />
          </Pressable>
        </View>
      </View>

      {/* Incognito Banner */}
      {incognito && (
        <View className="flex-row items-center gap-2 px-5 py-2 bg-purple-500/15 border-b border-purple-500/30">
          <Text className="text-sm">👻</Text>
          <Text className="text-purple-400 text-xs font-medium flex-1">
            Inkognito – wird nicht gespeichert
          </Text>
        </View>
      )}

      {/* Board Mode Banner */}
      {boardMode && (
        <View className="flex-row items-center gap-2 px-5 py-2 bg-purple-500/10 border-b border-purple-500/20">
          <Text className="text-sm">🏛️</Text>
          <Text className="text-purple-300 text-xs font-medium flex-1">
            Board of Advisors – 3 Perspektiven gleichzeitig
          </Text>
          <Pressable onPress={() => { setBoardMode(false); setBoardResult(null); }}>
            <Ionicons name="close-circle" size={16} color="#A371F7" />
          </Pressable>
        </View>
      )}

      {/* Active Skills Banner */}
      {activeSkillList.length > 0 && !incognito && !boardMode && (
        <View className="flex-row items-center gap-2 px-5 py-2 bg-nexus-accent/10 border-b border-nexus-accent/20">
          <Text className="text-nexus-accent text-xs font-medium flex-1" numberOfLines={1}>
            {activeSkillList.map((s) => `${s.icon} ${s.name}`).join(" · ")}
          </Text>
          <Pressable onPress={handleClearAllSkills}>
            <Ionicons name="close-circle" size={16} color="#D4A574" />
          </Pressable>
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          className="flex-1"
          contentContainerStyle={{ paddingVertical: 16 }}
          onContentSizeChange={scrollToBottom}
          ListHeaderComponent={
            <ProactiveMessages
              messages={proactiveMessages}
              onDismiss={handleDismissProactive}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-32">
              <View className="w-16 h-16 rounded-2xl bg-nexus-surface items-center justify-center mb-4 border border-nexus-border">
                <Text className="text-2xl">{settings?.aiAvatar || "🤖"}</Text>
              </View>
              <Text className="text-nexus-text text-lg font-medium">
                Hallo, {user?.displayName}
              </Text>
              <Text className="text-nexus-textDim text-sm mt-1 mb-6">
                Wie kann ich dir helfen?
              </Text>
              <QuickReplies
                username={user?.username || "andre"}
                onSelect={handleSend}
              />
            </View>
          }
          ListFooterComponent={
            <>
              {/* Board of Advisors Result */}
              {(boardResult || boardLoading) && (
                <BoardOfAdvisors
                  result={boardResult}
                  loading={boardLoading}
                  onClose={() => {
                    setBoardResult(null);
                    setBoardMode(false);
                  }}
                />
              )}
              {isStreaming ? (
                streamingText ? (
                  <ChatBubble role="assistant" content={streamingText} />
                ) : (
                  <TypingIndicator />
                )
              ) : null}
            </>
          }
        />
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </KeyboardAvoidingView>

      <SkillPickerModal
        visible={skillPickerVisible}
        onClose={() => setSkillPickerVisible(false)}
        skills={allSkills}
        activeSkills={activeSkillList}
        onToggle={handleSkillToggle}
        onClearAll={handleClearAllSkills}
      />
    </SafeAreaView>
  );
}
