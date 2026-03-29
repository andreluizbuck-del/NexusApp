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
  loadAgents,
  addAgent,
  removeAgent,
  generatePairingCode,
  getInstallInstructions,
} from "../store/agents";
import { getServerUrl } from "../services/api";
import * as Clipboard from "expo-clipboard";

const PAIRING_DURATION = 10 * 60; // 10 minutes in seconds

export default function AgentsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<DeviceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPairModal, setShowPairModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<DeviceAgent | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] =
    useState<DeviceType | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentIP, setNewAgentIP] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
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
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
      pairingExpires: new Date(
        Date.now() + PAIRING_DURATION * 1000
      ).toISOString(),
      isEnabled: true,
    };

    await addAgent(agent);
    loadData();
  };

  const handleRemove = (agentId: string) => {
    Alert.alert("Gerät entfernen?", "Das Gerät wird entkoppelt.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Entfernen",
        style: "destructive",
        onPress: async () => {
          await removeAgent(agentId);
          setShowDetailModal(false);
          setSelectedAgent(null);
          loadData();
        },
      },
    ]);
  };

  const handleCopyInstructions = async () => {
    if (!selectedDeviceType || !pairingCode) return;
    const serverUrl = await getServerUrl();
    const instructions = getInstallInstructions(
      selectedDeviceType,
      pairingCode,
      serverUrl
    );
    await Clipboard.setStringAsync(instructions);
    Alert.alert("Kopiert", "Befehl in Zwischenablage kopiert.");
  };

  const handleClosePairModal = () => {
    setShowPairModal(false);
    setPairingCode("");
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const deviceTypes: DeviceType[] = [
    "windows_pc",
    "laptop_mac",
    "laptop_windows",
    "raspberry_pi",
  ];

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
        <Text className="text-nexus-text font-semibold text-lg flex-1">
          Geräte & Agenten
        </Text>
        <Pressable
          onPress={() => {
            setSelectedDeviceType(null);
            setPairingCode("");
            setNewAgentName("");
            setNewAgentIP("");
            setShowPairModal(true);
          }}
          className="bg-nexus-accent rounded-lg px-3 py-1.5 active:opacity-80"
        >
          <Text className="text-nexus-bg text-xs font-bold">+ Gerät</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Meine Geräte */}
        <View className="px-5 pt-5">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3">
            Meine Geräte ({agents.length})
          </Text>
          {agents.length === 0 ? (
            <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-6 items-center">
              <Text className="text-3xl mb-3">🖥️</Text>
              <Text className="text-nexus-text text-sm font-medium">
                Keine Geräte verbunden
              </Text>
              <Text className="text-nexus-textDim text-xs mt-1 text-center">
                Verbinde deinen PC, Laptop oder Raspberry Pi{"\n"}um Nexus
                Aufgaben auf deinen Geräten auszuführen
              </Text>
            </View>
          ) : (
            agents.map((agent) => (
              <Pressable
                key={agent.id}
                onPress={() => {
                  setSelectedAgent(agent);
                  setShowDetailModal(true);
                }}
                className="bg-nexus-surface border border-nexus-border rounded-xl p-4 mb-2 flex-row items-center gap-3 active:bg-nexus-card"
              >
                <Text className="text-2xl">
                  {DEVICE_ICONS[agent.deviceType]}
                </Text>
                <View className="flex-1">
                  <Text className="text-nexus-text font-medium">
                    {agent.name}
                  </Text>
                  <Text className="text-nexus-textDim text-xs">
                    {DEVICE_LABELS[agent.deviceType]} • {agent.tailscaleIP}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <View className="flex-row items-center gap-1.5">
                    <View
                      className={`w-2.5 h-2.5 rounded-full ${
                        agent.isOnline ? "bg-nexus-success" : "bg-nexus-textDim"
                      }`}
                    />
                    <Text
                      className={`text-xs ${
                        agent.isOnline
                          ? "text-nexus-success"
                          : "text-nexus-textDim"
                      }`}
                    >
                      {agent.isOnline ? "Online" : "Offline"}
                    </Text>
                  </View>
                  {!agent.isOnline && (
                    <Text className="text-nexus-textDim text-[10px]">
                      {new Date(agent.lastSeen).toLocaleDateString("de-DE")}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Info */}
        <View className="px-5 pt-5 pb-10">
          <View className="bg-nexus-surface/50 border border-nexus-border rounded-xl p-4">
            <Text className="text-nexus-text text-sm font-medium mb-2">
              ℹ️ So funktioniert's
            </Text>
            <Text className="text-nexus-textDim text-xs leading-4">
              Nexus-Agenten sind kleine Python-Programme die auf deinen Geräten
              laufen. Sie verbinden sich über Tailscale VPN sicher mit der App.
              {"\n\n"}
              Du kannst Nexus dann bitten, Aufgaben auf deinen Geräten
              auszuführen: "Öffne YouTube", "Mach einen Screenshot", "Wecke
              meinen PC auf", etc.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Pair Modal */}
      <Modal visible={showPairModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-nexus-text font-semibold text-lg">
                Gerät verbinden
              </Text>
              <Pressable onPress={handleClosePairModal}>
                <Ionicons name="close" size={24} color="#9A9A9A" />
              </Pressable>
            </View>

            {!pairingCode ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-nexus-textDim text-xs mb-3">
                  Gerätetyp wählen
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {deviceTypes.map((dt) => (
                    <Pressable
                      key={dt}
                      onPress={() => setSelectedDeviceType(dt)}
                      className={`w-[48%] p-3 rounded-xl border ${
                        selectedDeviceType === dt
                          ? "bg-nexus-accent/10 border-nexus-accent"
                          : "bg-nexus-surface border-nexus-border"
                      }`}
                    >
                      <Text className="text-2xl mb-1">{DEVICE_ICONS[dt]}</Text>
                      <Text
                        className={`text-sm font-medium ${
                          selectedDeviceType === dt
                            ? "text-nexus-accent"
                            : "text-nexus-text"
                        }`}
                      >
                        {DEVICE_LABELS[dt]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  value={newAgentName}
                  onChangeText={setNewAgentName}
                  placeholder="Gerätename (z.B. Andres Gaming PC)"
                  placeholderTextColor="#555"
                  className="bg-nexus-surface border border-nexus-border rounded-xl p-3 text-nexus-text text-sm mb-3"
                />

                <TextInput
                  value={newAgentIP}
                  onChangeText={setNewAgentIP}
                  placeholder="Tailscale IP (z.B. 100.64.0.2)"
                  placeholderTextColor="#555"
                  className="bg-nexus-surface border border-nexus-border rounded-xl p-3 text-nexus-text text-sm mb-5"
                />

                <Pressable
                  onPress={handlePair}
                  disabled={!selectedDeviceType || !newAgentName.trim()}
                  className={`rounded-xl py-3 items-center ${
                    selectedDeviceType && newAgentName.trim()
                      ? "bg-nexus-accent active:opacity-80"
                      : "bg-nexus-border"
                  }`}
                >
                  <Text
                    className={`font-bold text-sm ${
                      selectedDeviceType && newAgentName.trim()
                        ? "text-nexus-bg"
                        : "text-nexus-textDim"
                    }`}
                  >
                    Pairing-Code generieren
                  </Text>
                </Pressable>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="items-center mb-5">
                  <Text className="text-nexus-textDim text-xs mb-2">
                    Pairing-Code
                  </Text>
                  <View className="bg-nexus-surface border border-nexus-accent rounded-2xl px-8 py-4 mb-2">
                    <Text className="text-nexus-accent text-3xl font-bold tracking-[8px]">
                      {pairingCode}
                    </Text>
                  </View>
                  {/* Countdown */}
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={countdown > 0 ? "#57AB5A" : "#E5534B"}
                    />
                    <Text
                      className={`text-sm font-mono font-medium ${
                        countdown > 0
                          ? countdown <= 60
                            ? "text-nexus-danger"
                            : "text-nexus-success"
                          : "text-nexus-danger"
                      }`}
                    >
                      {countdown > 0
                        ? `Gültig: ${formatCountdown(countdown)}`
                        : "Abgelaufen"}
                    </Text>
                  </View>
                </View>

                <Text className="text-nexus-text text-sm font-medium mb-2">
                  Auf dem Gerät ausführen:
                </Text>
                <Pressable
                  onPress={handleCopyInstructions}
                  className="bg-nexus-card rounded-xl p-3 mb-4 active:opacity-80"
                >
                  <Text className="text-green-400 text-xs leading-5 font-mono">
                    ${" "}
                    {selectedDeviceType
                      ? getInstallInstructions(
                          selectedDeviceType,
                          pairingCode,
                          "http://[tailscale-ip]:8000"
                        )
                      : ""}
                  </Text>
                  <View className="flex-row items-center gap-1 mt-2 self-end">
                    <Ionicons name="copy-outline" size={12} color="#D4A574" />
                    <Text className="text-nexus-accent text-[10px]">
                      Tippen zum Kopieren
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={handleClosePairModal}
                  className="bg-nexus-accent rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-nexus-bg font-bold text-sm">
                    Fertig
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5 max-h-[70%]">
            {selectedAgent && (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-2xl">
                      {DEVICE_ICONS[selectedAgent.deviceType]}
                    </Text>
                    <View>
                      <Text className="text-nexus-text font-semibold text-lg">
                        {selectedAgent.name}
                      </Text>
                      <Text className="text-nexus-textDim text-xs">
                        {DEVICE_LABELS[selectedAgent.deviceType]} •{" "}
                        {selectedAgent.tailscaleIP}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setShowDetailModal(false)}>
                    <Ionicons name="close" size={24} color="#9A9A9A" />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-2">
                    Fähigkeiten
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mb-5">
                    {selectedAgent.capabilities.map((cap) => (
                      <View
                        key={cap}
                        className="bg-nexus-surface border border-nexus-border rounded-lg px-2.5 py-1.5"
                      >
                        <Text className="text-nexus-text text-xs">
                          {CAPABILITY_LABELS[cap] || cap}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View className="bg-nexus-surface border border-nexus-border rounded-xl p-3 mb-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-nexus-textDim text-xs">Status</Text>
                      <View className="flex-row items-center gap-1.5">
                        <View
                          className={`w-2.5 h-2.5 rounded-full ${
                            selectedAgent.isOnline
                              ? "bg-nexus-success"
                              : "bg-nexus-textDim"
                          }`}
                        />
                        <Text
                          className={`text-xs ${
                            selectedAgent.isOnline
                              ? "text-nexus-success"
                              : "text-nexus-textDim"
                          }`}
                        >
                          {selectedAgent.isOnline ? "Online" : "Offline"}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-nexus-textDim text-xs">
                        Zuletzt gesehen
                      </Text>
                      <Text className="text-nexus-text text-xs">
                        {new Date(selectedAgent.lastSeen).toLocaleString(
                          "de-DE"
                        )}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleRemove(selectedAgent.id)}
                    className="bg-nexus-danger/10 border border-nexus-danger/30 rounded-xl py-3 items-center active:opacity-80"
                  >
                    <Text className="text-nexus-danger text-sm font-medium">
                      Gerät entfernen
                    </Text>
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
