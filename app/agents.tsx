import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../store/AuthContext";
import {
  DeviceAgent,
  DeviceType,
  DEVICE_ICONS,
  DEVICE_LABELS,
  DEVICE_CAPABILITIES,
  CAPABILITY_LABELS,
  CAPABILITY_SUGGESTIONS,
  SETUP_GUIDE,
  loadAgents,
  addAgent,
  removeAgent,
  generatePairingCode,
  getInstallInstructions,
  createCommand,
  simulateExecution,
} from "../store/agents";
import { getServerUrl } from "../services/api";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

const PAIRING_DURATION = 10 * 60;
type ModalView = "list" | "pair" | "detail" | "command" | "setup";

export default function AgentsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<DeviceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ModalView>("list");

  // Pair
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentIP, setNewAgentIP] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detail / Command / Setup
  const [selectedAgent, setSelectedAgent] = useState<DeviceAgent | null>(null);
  const [commandText, setCommandText] = useState("");
  const [commandRunning, setCommandRunning] = useState(false);
  const [commandResult, setCommandResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const a = await loadAgents();
    setAgents(a);
    setLoading(false);
  };

  const startCountdown = () => {
    setCountdown(PAIRING_DURATION);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const formatCountdown = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handlePair = async () => {
    if (!user || !selectedDeviceType || !newAgentName.trim()) return;
    const code = generatePairingCode();
    setPairingCode(code);
    startCountdown();
    const agent: DeviceAgent = {
      id: Date.now().toString(),
      name: newAgentName.trim(),
      deviceType: selectedDeviceType,
      owner: user.username,
      tailscaleIP: newAgentIP.trim() || "100.x.x.x",
      isOnline: false,
      lastSeen: new Date().toISOString(),
      capabilities: DEVICE_CAPABILITIES[selectedDeviceType],
      pairingCode: code,
      pairingExpires: new Date(Date.now() + PAIRING_DURATION * 1000).toISOString(),
      isEnabled: true,
    };
    await addAgent(agent);
    loadData();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemove = (agentId: string) => {
    Alert.alert("Gerät entfernen?", "Der Agent wird aus der Liste entfernt.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Entfernen", style: "destructive",
        onPress: async () => {
          await removeAgent(agentId);
          setView("list");
          setSelectedAgent(null);
          loadData();
        },
      },
    ]);
  };

  const handleSendCommand = async () => {
    if (!selectedAgent || !commandText.trim()) return;
    setCommandRunning(true);
    setCommandResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const cmd = await createCommand(selectedAgent.id, selectedAgent.name, commandText.trim());
    const result = await simulateExecution(cmd.id);
    setCommandResult(result);
    setCommandRunning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openCommand = (agent: DeviceAgent) => {
    setSelectedAgent(agent); setCommandText(""); setCommandResult(null); setView("command");
  };
  const openDetail = (agent: DeviceAgent) => { setSelectedAgent(agent); setView("detail"); };
  const openSetup = (agent: DeviceAgent) => { setSelectedAgent(agent); setView("setup"); };
  const closePairModal = () => {
    setView("list"); setPairingCode(""); setCountdown(0);
    setNewAgentName(""); setNewAgentIP(""); setSelectedDeviceType(null);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const canSendCommand = (agent: DeviceAgent) =>
    user && (user.username === agent.owner || user.username === "andre");

  const onlineCount = agents.filter((a) => a.isOnline).length;
  const deviceTypes: DeviceType[] = ["windows_pc", "laptop_mac", "laptop_windows", "raspberry_pi"];

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-nexus-bg items-center justify-center">
        <ActivityIndicator color="#D4A574" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-nexus-border">
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Ionicons name="arrow-back" size={24} color="#E0E0E0" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-nexus-text font-semibold text-lg">Agent Center</Text>
          <Text className="text-nexus-textDim text-xs">
            🟢 {onlineCount} online · 🔴 {agents.length - onlineCount} offline
          </Text>
        </View>
        {user?.username === "andre" && (
          <Pressable
            onPress={() => setView("pair")}
            className="bg-nexus-accent rounded-lg px-3 py-1.5 active:opacity-80"
          >
            <Text className="text-nexus-bg text-xs font-bold">+ Agent</Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-5">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3">
            Agenten ({agents.length})
          </Text>

          {agents.length === 0 ? (
            <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-6 items-center">
              <Text className="text-3xl mb-3">🖥️</Text>
              <Text className="text-nexus-text text-sm font-medium">Keine Agenten konfiguriert</Text>
              <Text className="text-nexus-textDim text-xs mt-1 text-center">
                Füge einen Agenten hinzu um Nexus auf deinen Geräten zu nutzen
              </Text>
            </View>
          ) : (
            agents.map((agent) => (
              <View key={agent.id} className="bg-nexus-surface border border-nexus-border rounded-xl p-4 mb-3">
                {/* Top row */}
                <View className="flex-row items-center gap-3 mb-3">
                  <Text className="text-2xl">{DEVICE_ICONS[agent.deviceType]}</Text>
                  <View className="flex-1">
                    <Text className="text-nexus-text font-semibold">{agent.name}</Text>
                    <Text className="text-nexus-textDim text-xs">
                      {DEVICE_LABELS[agent.deviceType]} · {agent.owner}
                    </Text>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center gap-1.5">
                      <View className={`w-2.5 h-2.5 rounded-full ${agent.isOnline ? "bg-nexus-success" : "bg-nexus-danger"}`} />
                      <Text className={`text-xs font-medium ${agent.isOnline ? "text-nexus-success" : "text-nexus-danger"}`}>
                        {agent.isOnline ? "Online" : "Offline"}
                      </Text>
                    </View>
                    {!agent.isOnline && (
                      <Text className="text-nexus-textDim text-[10px] mt-0.5">
                        {new Date(agent.lastSeen).toLocaleDateString("de-DE")}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Capability tags */}
                <View className="flex-row flex-wrap gap-1.5 mb-3">
                  {agent.capabilities.slice(0, 4).map((cap) => (
                    <View key={cap} className="bg-nexus-card border border-nexus-border rounded-md px-2 py-1">
                      <Text className="text-nexus-textDim text-[10px]">{CAPABILITY_LABELS[cap] || cap}</Text>
                    </View>
                  ))}
                  {agent.capabilities.length > 4 && (
                    <View className="bg-nexus-card border border-nexus-border rounded-md px-2 py-1">
                      <Text className="text-nexus-textDim text-[10px]">+{agent.capabilities.length - 4}</Text>
                    </View>
                  )}
                </View>

                {/* Buttons */}
                <View className="flex-row gap-2">
                  <Pressable onPress={() => openDetail(agent)} className="flex-1 bg-nexus-card border border-nexus-border rounded-lg py-2 items-center active:opacity-70">
                    <Text className="text-nexus-textDim text-xs">Details</Text>
                  </Pressable>
                  {!agent.isOnline && (
                    <Pressable onPress={() => openSetup(agent)} className="flex-1 bg-nexus-card border border-nexus-border rounded-lg py-2 items-center active:opacity-70">
                      <Text className="text-nexus-textDim text-xs">Einrichtung</Text>
                    </Pressable>
                  )}
                  {canSendCommand(agent) && (
                    <Pressable
                      onPress={() => agent.isOnline ? openCommand(agent) : openSetup(agent)}
                      className={`flex-1 rounded-lg py-2 items-center active:opacity-80 ${agent.isOnline ? "bg-nexus-accent" : "bg-nexus-card border border-nexus-border"}`}
                    >
                      <Text className={`text-xs font-semibold ${agent.isOnline ? "text-nexus-bg" : "text-nexus-textDim"}`}>
                        {agent.isOnline ? "Befehl senden" : "Einrichten"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info box */}
        <View className="px-5 pt-2 pb-10">
          <View className="bg-nexus-surface/50 border border-nexus-border rounded-xl p-4">
            <Text className="text-nexus-text text-sm font-medium mb-2">📡 Wie es funktioniert</Text>
            <Text className="text-nexus-textDim text-xs leading-5">
              Nexus-Agenten sind Python-Skripte die auf deinen Geräten laufen und sich via Tailscale VPN verbinden. Tippe auf "Einrichtung" für die Schritte.{"\n\n"}
              ⚠️ Befehle sind aktuell simuliert — echte Ausführung kommt mit dem FastAPI-Backend.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── PAIR MODAL ── */}
      <Modal visible={view === "pair"} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-nexus-text font-semibold text-lg">Agent hinzufügen</Text>
              <Pressable onPress={closePairModal}>
                <Ionicons name="close" size={24} color="#9A9A9A" />
              </Pressable>
            </View>

            {!pairingCode ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-nexus-textDim text-xs mb-3">Gerätetyp</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {deviceTypes.map((dt) => (
                    <Pressable
                      key={dt}
                      onPress={() => setSelectedDeviceType(dt)}
                      className={`w-[48%] p-3 rounded-xl border ${selectedDeviceType === dt ? "bg-nexus-accent/10 border-nexus-accent" : "bg-nexus-surface border-nexus-border"}`}
                    >
                      <Text className="text-2xl mb-1">{DEVICE_ICONS[dt]}</Text>
                      <Text className={`text-sm font-medium ${selectedDeviceType === dt ? "text-nexus-accent" : "text-nexus-text"}`}>
                        {DEVICE_LABELS[dt]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  value={newAgentName} onChangeText={setNewAgentName}
                  placeholder="Gerätename (z.B. Andres Gaming PC)"
                  placeholderTextColor="#555"
                  className="bg-nexus-surface border border-nexus-border rounded-xl p-3 text-nexus-text text-sm mb-3"
                />
                <TextInput
                  value={newAgentIP} onChangeText={setNewAgentIP}
                  placeholder="Tailscale IP (z.B. 100.64.0.2)"
                  placeholderTextColor="#555"
                  className="bg-nexus-surface border border-nexus-border rounded-xl p-3 text-nexus-text text-sm mb-5"
                />

                <Pressable
                  onPress={handlePair}
                  disabled={!selectedDeviceType || !newAgentName.trim()}
                  className={`rounded-xl py-3 items-center ${selectedDeviceType && newAgentName.trim() ? "bg-nexus-accent active:opacity-80" : "bg-nexus-border"}`}
                >
                  <Text className={`font-bold text-sm ${selectedDeviceType && newAgentName.trim() ? "text-nexus-bg" : "text-nexus-textDim"}`}>
                    Pairing-Code generieren
                  </Text>
                </Pressable>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="items-center mb-5">
                  <Text className="text-nexus-textDim text-xs mb-2">Pairing-Code</Text>
                  <View className="bg-nexus-surface border border-nexus-accent rounded-2xl px-8 py-4 mb-2">
                    <Text className="text-nexus-accent text-3xl font-bold tracking-[8px]">{pairingCode}</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="time-outline" size={14} color={countdown > 60 ? "#57AB5A" : "#E5534B"} />
                    <Text className={`text-sm font-mono font-medium ${countdown > 60 ? "text-nexus-success" : "text-nexus-danger"}`}>
                      {countdown > 0 ? `Gültig: ${formatCountdown(countdown)}` : "Abgelaufen"}
                    </Text>
                  </View>
                </View>

                <Text className="text-nexus-text text-sm font-medium mb-2">Auf dem Gerät ausführen:</Text>
                <Pressable
                  onPress={async () => {
                    const serverUrl = await getServerUrl();
                    const txt = selectedDeviceType ? getInstallInstructions(selectedDeviceType, pairingCode, serverUrl) : "";
                    await Clipboard.setStringAsync(txt);
                    Alert.alert("Kopiert", "Befehl kopiert.");
                  }}
                  className="bg-nexus-card rounded-xl p-3 mb-5 active:opacity-80"
                >
                  <Text className="text-green-400 text-xs leading-5 font-mono">
                    $ {selectedDeviceType ? getInstallInstructions(selectedDeviceType, pairingCode, "http://[tailscale-ip]:8000") : ""}
                  </Text>
                  <View className="flex-row items-center gap-1 mt-2 self-end">
                    <Ionicons name="copy-outline" size={12} color="#D4A574" />
                    <Text className="text-nexus-accent text-[10px]">Tippen zum Kopieren</Text>
                  </View>
                </Pressable>

                <Pressable onPress={closePairModal} className="bg-nexus-accent rounded-xl py-3 items-center active:opacity-80">
                  <Text className="text-nexus-bg font-bold text-sm">Fertig</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── DETAIL MODAL ── */}
      <Modal visible={view === "detail"} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5 max-h-[70%]">
            {selectedAgent && (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-2xl">{DEVICE_ICONS[selectedAgent.deviceType]}</Text>
                    <View>
                      <Text className="text-nexus-text font-semibold text-lg">{selectedAgent.name}</Text>
                      <Text className="text-nexus-textDim text-xs">{DEVICE_LABELS[selectedAgent.deviceType]}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setView("list")}>
                    <Ionicons name="close" size={24} color="#9A9A9A" />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View className="bg-nexus-surface border border-nexus-border rounded-xl p-3 mb-4">
                    {[
                      ["Status", selectedAgent.isOnline ? "🟢 Online" : "🔴 Offline"],
                      ["Besitzer", selectedAgent.owner],
                      ["Tailscale IP", selectedAgent.tailscaleIP],
                      ["Zuletzt gesehen", new Date(selectedAgent.lastSeen).toLocaleString("de-DE")],
                    ].map(([label, val]) => (
                      <View key={label} className="flex-row justify-between py-1.5 border-b border-nexus-border/50 last:border-0">
                        <Text className="text-nexus-textDim text-xs">{label}</Text>
                        <Text className="text-nexus-text text-xs font-mono">{val}</Text>
                      </View>
                    ))}
                  </View>

                  <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-2">Fähigkeiten</Text>
                  <View className="flex-row flex-wrap gap-2 mb-5">
                    {selectedAgent.capabilities.map((cap) => (
                      <View key={cap} className="bg-nexus-surface border border-nexus-border rounded-lg px-2.5 py-1.5">
                        <Text className="text-nexus-text text-xs">{CAPABILITY_LABELS[cap] || cap}</Text>
                      </View>
                    ))}
                  </View>

                  <View className="flex-row gap-2 mb-3">
                    <Pressable onPress={() => openSetup(selectedAgent)} className="flex-1 bg-nexus-surface border border-nexus-border rounded-xl py-3 items-center active:opacity-70">
                      <Text className="text-nexus-text text-sm">Einrichtung</Text>
                    </Pressable>
                    {canSendCommand(selectedAgent) && selectedAgent.isOnline && (
                      <Pressable onPress={() => openCommand(selectedAgent)} className="flex-1 bg-nexus-accent rounded-xl py-3 items-center active:opacity-80">
                        <Text className="text-nexus-bg font-bold text-sm">Befehl senden</Text>
                      </Pressable>
                    )}
                  </View>

                  {user?.username === "andre" && (
                    <Pressable onPress={() => handleRemove(selectedAgent.id)} className="bg-nexus-danger/10 border border-nexus-danger/30 rounded-xl py-3 items-center active:opacity-80">
                      <Text className="text-nexus-danger text-sm font-medium">Gerät entfernen</Text>
                    </Pressable>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── COMMAND MODAL ── */}
      <Modal visible={view === "command"} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5">
            {selectedAgent && (
              <>
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xl">{DEVICE_ICONS[selectedAgent.deviceType]}</Text>
                    <Text className="text-nexus-text font-semibold">Befehl senden</Text>
                  </View>
                  <Pressable onPress={() => { setView("list"); setCommandResult(null); }}>
                    <Ionicons name="close" size={24} color="#9A9A9A" />
                  </Pressable>
                </View>
                <Text className="text-nexus-textDim text-xs mb-4">→ {selectedAgent.name}</Text>

                {commandResult && (
                  <View className="bg-nexus-card border border-nexus-success/30 rounded-xl p-3 mb-4">
                    <Text className="text-nexus-success text-xs font-bold mb-1">✅ Ergebnis</Text>
                    <Text className="text-nexus-text text-sm leading-5">{commandResult}</Text>
                  </View>
                )}

                <TextInput
                  value={commandText} onChangeText={setCommandText}
                  placeholder="Was soll der Agent tun?"
                  placeholderTextColor="#555" multiline editable={!commandRunning}
                  className="bg-nexus-surface border border-nexus-border rounded-xl p-3 text-nexus-text text-sm min-h-[70px] mb-3"
                />

                <Text className="text-nexus-textDim text-xs mb-2">Vorschläge:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {(CAPABILITY_SUGGESTIONS[selectedAgent.deviceType] || []).map((s) => (
                    <Pressable
                      key={s} onPress={() => setCommandText(s)}
                      className="bg-nexus-surface border border-nexus-border rounded-lg px-3 py-2 mr-2 active:opacity-70"
                    >
                      <Text className="text-nexus-text text-xs">{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Pressable
                  onPress={handleSendCommand}
                  disabled={!commandText.trim() || commandRunning}
                  className={`rounded-xl py-3 items-center flex-row justify-center gap-2 ${commandText.trim() && !commandRunning ? "bg-nexus-accent active:opacity-80" : "bg-nexus-border"}`}
                >
                  {commandRunning
                    ? <><ActivityIndicator size="small" color="#191919" /><Text className="text-nexus-bg font-bold text-sm">Ausführen...</Text></>
                    : <Text className={`font-bold text-sm ${commandText.trim() ? "text-nexus-bg" : "text-nexus-textDim"}`}>Senden ⚡</Text>
                  }
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── SETUP GUIDE MODAL ── */}
      <Modal visible={view === "setup"} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5 max-h-[80%]">
            {selectedAgent && (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-2xl">{DEVICE_ICONS[selectedAgent.deviceType]}</Text>
                    <View>
                      <Text className="text-nexus-text font-semibold text-lg">Einrichtung</Text>
                      <Text className="text-nexus-textDim text-xs">{selectedAgent.name}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setView("list")}>
                    <Ionicons name="close" size={24} color="#9A9A9A" />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {(SETUP_GUIDE[selectedAgent.deviceType] || []).map((s) => (
                    <View key={s.step} className="flex-row gap-3 mb-4">
                      <View className="w-7 h-7 rounded-full bg-nexus-accent/20 items-center justify-center shrink-0 mt-0.5">
                        <Text className="text-nexus-accent text-xs font-bold">{s.step}</Text>
                      </View>
                      <Text className="text-nexus-text text-sm leading-5 flex-1">{s.text}</Text>
                    </View>
                  ))}

                  <View className="bg-nexus-surface/50 border border-nexus-border rounded-xl p-3 mt-1 mb-4">
                    <Text className="text-nexus-textDim text-xs leading-4">
                      ⚠️ Agent-Kommunikation ist aktuell simuliert. Echte Ausführung wird mit dem Nexus Backend (FastAPI) aktiviert.
                    </Text>
                  </View>

                  <Pressable
                    onPress={async () => {
                      const steps = (SETUP_GUIDE[selectedAgent.deviceType] || []).map((s) => `${s.step}. ${s.text}`).join("\n\n");
                      await Clipboard.setStringAsync(steps);
                      Alert.alert("Kopiert", "Einrichtungsschritte kopiert.");
                    }}
                    className="bg-nexus-surface border border-nexus-border rounded-xl py-3 items-center active:opacity-70"
                  >
                    <Text className="text-nexus-accent text-sm">📋 Schritte kopieren</Text>
                  </Pressable>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
