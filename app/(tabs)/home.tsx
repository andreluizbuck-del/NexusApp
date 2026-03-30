import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../store/AuthContext";
import { loadChatHistory, ChatMessage } from "../../store/chatHistory";
import { getActiveSkills, Skill } from "../../store/skills";
import { testConnection } from "../../services/api";
import { loadAgents, DeviceAgent } from "../../store/agents";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function formatDate(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeSkills, setActiveSkills] = useState<Skill[]>([]);
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [serverStatus, setServerStatus] = useState<{
    ok: boolean;
    latency: number;
  } | null>(null);
  const [agents, setAgents] = useState<DeviceAgent[]>([]);

  useEffect(() => {
    if (!user) return;
    getActiveSkills(user.username).then(setActiveSkills);
    loadChatHistory(user.username).then((msgs) =>
      setRecentMessages(msgs.slice(-3))
    );
    testConnection().then(setServerStatus);
    loadAgents().then(setAgents);
  }, [user]);

  const quickActions = [
    {
      icon: "chatbubble-ellipses" as const,
      label: "Neuer Chat",
      color: "#D4A574",
      onPress: () => router.push("/(tabs)/chat"),
    },
    {
      icon: "flash" as const,
      label: "Skill Store",
      color: "#6CB6FF",
      onPress: () => router.push("/skills/store"),
    },
    {
      icon: "notifications" as const,
      label: "Erinnerungen",
      color: "#57AB5A",
      onPress: () => router.push("/reminders"),
    },
    {
      icon: "hardware-chip" as const,
      label: "Geräte",
      color: "#E0A856",
      onPress: () => router.push("/agents"),
    },
    {
      icon: "people" as const,
      label: "Spaces",
      color: "#A371F7",
      onPress: () => router.push("/spaces"),
    },
    {
      icon: "brain" as const,
      label: "Gedächtnis",
      color: "#F778BA",
      onPress: () => router.push("/memory"),
    },
    {
      icon: "settings-sharp" as const,
      label: "Einstellungen",
      color: "#E5534B",
      onPress: () => router.push("/(tabs)/settings"),
    },
  ];

  const weekMessages = recentMessages.filter(
    (m) =>
      m.role === "user" &&
      Date.now() - m.timestamp < 7 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* GREETING */}
        <View className="px-5 pt-5 pb-4">
          <Text className="text-nexus-text text-2xl font-bold">
            {getGreeting()}, {user?.displayName}
          </Text>
          <Text className="text-nexus-textDim text-sm mt-1">
            {formatDate()}
          </Text>
        </View>

        {/* QUICK ACTIONS */}
        <View className="px-5 mb-5">
          <View className="flex-row flex-wrap gap-3">
            {quickActions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                className="w-[47%] bg-nexus-surface border border-nexus-border rounded-2xl p-4 flex-row items-center gap-3 active:bg-nexus-card"
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: a.color + "20" }}
                >
                  <Ionicons name={a.icon} size={20} color={a.color} />
                </View>
                <Text className="text-nexus-text text-sm font-medium flex-1">
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ACTIVE SKILLS */}
        <View className="px-5 mb-5">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Aktive Skills ({activeSkills.length}/3)
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4">
            {activeSkills.length > 0 ? (
              <View className="gap-3">
                {activeSkills.map((s) => (
                  <View key={s.id} className="flex-row items-center gap-3">
                    <Text className="text-2xl">{s.icon}</Text>
                    <View className="flex-1">
                      <Text className="text-nexus-text font-medium">{s.name}</Text>
                      <Text className="text-nexus-textDim text-xs" numberOfLines={1}>
                        {s.description}
                      </Text>
                    </View>
                    <View className="bg-nexus-success/20 rounded px-2 py-1">
                      <Text className="text-nexus-success text-[10px] font-bold">AKTIV</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row items-center gap-3">
                <Ionicons name="flash-outline" size={24} color="#555" />
                <Text className="text-nexus-textDim flex-1">
                  Keine Skills aktiv
                </Text>
                <Pressable
                  onPress={() => router.push("/skills/store")}
                  className="bg-nexus-card rounded-lg px-3 py-1.5"
                >
                  <Text className="text-nexus-accent text-xs font-medium">
                    Store
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* AGENT STATUS */}
        {agents.length > 0 && (
          <View className="px-5 mb-5">
            <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-2 ml-1">
              Agenten
            </Text>
            <Pressable
              onPress={() => router.push("/agents")}
              className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 flex-row items-center gap-3 active:bg-nexus-card"
            >
              <Text className="text-2xl">🖥️</Text>
              <View className="flex-1">
                <Text className="text-nexus-text text-sm font-medium">
                  🟢 {agents.filter((a) => a.isOnline).length} online · 🔴 {agents.filter((a) => !a.isOnline).length} offline
                </Text>
                <Text className="text-nexus-textDim text-xs">{agents.length} Geräte konfiguriert</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#555" />
            </Pressable>
          </View>
        )}

        {/* SERVER STATUS */}
        <View className="px-5 mb-5">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Server Status
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 flex-row items-center gap-3">
            <View
              className={`w-3 h-3 rounded-full ${
                serverStatus === null
                  ? "bg-nexus-textDim"
                  : serverStatus.ok
                  ? "bg-nexus-success"
                  : "bg-nexus-danger"
              }`}
            />
            <View className="flex-1">
              <Text className="text-nexus-text text-sm">Claude API</Text>
              <Text className="text-nexus-textDim text-xs">
                {serverStatus === null
                  ? "Prüfe Verbindung..."
                  : serverStatus.ok
                  ? `Verbunden · ${serverStatus.latency}ms`
                  : "Nicht erreichbar"}
              </Text>
            </View>
            <Text className="text-nexus-textDim text-xs font-mono">
              Sonnet
            </Text>
          </View>
        </View>

        {/* STATS */}
        <View className="px-5 mb-10">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Statistiken
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-nexus-surface border border-nexus-border rounded-2xl p-4 items-center">
              <Text className="text-nexus-accent text-2xl font-bold">
                {weekMessages}
              </Text>
              <Text className="text-nexus-textDim text-xs mt-1">
                Nachrichten
              </Text>
            </View>
            <View className="flex-1 bg-nexus-surface border border-nexus-border rounded-2xl p-4 items-center">
              <Text className="text-nexus-accent text-2xl font-bold">
                {activeSkills.length}
              </Text>
              <Text className="text-nexus-textDim text-xs mt-1">
                Skills aktiv
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
