import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../store/AuthContext";
import { loadUsers, NexusUser, updateUser, getDisplayName } from "../../store/users";
import {
  UserSettings,
  loadAllUserSettings,
} from "../../store/userSettings";
import {
  testConnection,
  getServerUrl,
  setServerUrl as saveServerUrl,
  getServerModel,
  setServerModel as saveServerModel,
} from "../../services/api";
import {
  runAllTests,
  TestResult,
  getLastTestResults,
  generateReport,
} from "../../services/selfTest";
import AdminUserModal from "../../components/admin/AdminUserModal";

const TIMEOUT_OPTIONS = [
  { label: "1 Std", value: 1 },
  { label: "8 Std", value: 8 },
  { label: "24 Std", value: 24 },
  { label: "Permanent", value: 0 },
];

export default function AdminScreen() {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<NexusUser[]>([]);
  const [allSettings, setAllSettings] = useState<Record<string, UserSettings>>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok: boolean; latency: number; error?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [model, setModel] = useState("");
  const [urlDirty, setUrlDirty] = useState(false);

  // Self-test state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testRunning, setTestRunning] = useState(false);
  const [testTimestamp, setTestTimestamp] = useState<number | null>(null);

  // Guest management
  const [guestModal, setGuestModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<NexusUser | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestTimeout, setGuestTimeout] = useState(8);

  useEffect(() => {
    loadData();
  }, [modalVisible, guestModal]);

  const loadData = async () => {
    const users = await loadUsers();
    setAllUsers(users);
    loadAllUserSettings().then(setAllSettings);
    getServerUrl().then(setServerUrl);
    getServerModel().then(setModel);
    getLastTestResults().then((data) => {
      if (data) {
        setTestResults(data.results);
        setTestTimestamp(data.timestamp);
      }
    });
  };

  if (user?.username !== "andre") {
    return (
      <SafeAreaView className="flex-1 bg-nexus-bg items-center justify-center" edges={["top"]}>
        <Ionicons name="lock-closed" size={48} color="#353535" />
        <Text className="text-nexus-textDim mt-4">Kein Zugriff</Text>
      </SafeAreaView>
    );
  }

  const handleTestConnection = async () => {
    setTesting(true);
    if (urlDirty) {
      await saveServerUrl(serverUrl);
      await saveServerModel(model);
      setUrlDirty(false);
    }
    const result = await testConnection();
    setConnectionStatus(result);
    setTesting(false);
  };

  const applyPreset = async (url: string, m: string) => {
    setServerUrl(url);
    setModel(m);
    await saveServerUrl(url);
    await saveServerModel(m);
    setUrlDirty(false);
    setConnectionStatus(null);
  };

  const handleRunTests = async () => {
    setTestRunning(true);
    const results = await runAllTests();
    setTestResults(results);
    setTestTimestamp(Date.now());
    setTestRunning(false);
  };

  const handleAutoFix = async (result: TestResult) => {
    if (!result.autoFix) return;
    Alert.alert(
      "Automatisch beheben?",
      `${result.displayName}: ${result.message}`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Beheben",
          onPress: async () => {
            await result.autoFix!();
            handleRunTests();
          },
        },
      ]
    );
  };

  const handleCopyReport = async () => {
    const report = generateReport(testResults);
    await Clipboard.setStringAsync(report);
    Alert.alert("Kopiert", "Testbericht in Zwischenablage kopiert.");
  };

  const handleToggleGuest = async (guest: NexusUser) => {
    await updateUser(guest.id, { isEnabled: !guest.isEnabled });
    loadData();
  };

  const handleSaveGuest = async () => {
    if (!editingGuest) return;
    await updateUser(editingGuest.id, {
      customName: guestName.trim() || undefined,
      displayName: guestName.trim() || editingGuest.displayName,
      sessionTimeout: guestTimeout,
    });
    setGuestModal(false);
    setEditingGuest(null);
    loadData();
  };

  const familyUsers = allUsers.filter((u) => u.role !== "guest");
  const guestUsers = allUsers.filter((u) => u.role === "guest");

  const statusIcon = (s: string) => {
    if (s === "pass") return "✅";
    if (s === "fail") return "❌";
    if (s === "warning") return "⚠️";
    return "⏭️";
  };

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      <View className="px-5 py-3 border-b border-nexus-border">
        <View className="flex-row items-center gap-2">
          <Ionicons name="shield-checkmark" size={18} color="#D4A574" />
          <Text className="text-nexus-text font-semibold text-[17px]">
            Admin Panel
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        {/* FAMILIENMITGLIEDER */}
        <View className="mb-6">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3 ml-1">
            Familie ({familyUsers.length})
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl overflow-hidden">
            {familyUsers.map((u, i) => {
              const s = allSettings[u.username];
              return (
                <Pressable
                  key={u.username}
                  onPress={() => {
                    setSelectedUser({
                      username: u.username,
                      displayName: getDisplayName(u),
                      role: u.role === "admin" ? "admin" : "standard",
                      avatar: u.emoji,
                      password: u.password,
                      emoji: u.emoji,
                      age: u.age,
                      language: u.language,
                      isEnabled: u.isEnabled,
                    });
                    setModalVisible(true);
                  }}
                  className={`flex-row items-center px-4 py-3.5 active:bg-nexus-card ${
                    i < familyUsers.length - 1 ? "border-b border-nexus-border" : ""
                  }`}
                >
                  <View className="w-10 h-10 rounded-full bg-nexus-card items-center justify-center mr-3">
                    <Text className="text-lg">{u.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-nexus-text font-medium">
                        {getDisplayName(u)}
                      </Text>
                      {u.role === "admin" && (
                        <View className="bg-nexus-accent/20 rounded px-1.5 py-0.5">
                          <Text className="text-nexus-accent text-[9px] font-bold">ADMIN</Text>
                        </View>
                      )}
                      {u.age !== null && (
                        <Text className="text-nexus-textDim text-[10px]">
                          {u.age}J
                        </Text>
                      )}
                    </View>
                    <Text className="text-nexus-textDim text-xs">
                      {s ? `${s.aiName} · ${s.tone} · ${s.language}` : "Standard"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#555" />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* GÄSTE */}
        <View className="mb-6">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3 ml-1">
            Gäste ({guestUsers.filter((g) => g.isEnabled).length}/{guestUsers.length} aktiv)
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl overflow-hidden">
            {guestUsers.map((g, i) => (
              <View
                key={g.id}
                className={`flex-row items-center px-4 py-3.5 ${
                  i < guestUsers.length - 1 ? "border-b border-nexus-border" : ""
                }`}
              >
                <View className="w-10 h-10 rounded-full bg-nexus-card items-center justify-center mr-3">
                  <Text className="text-lg">{g.emoji}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-nexus-text font-medium">
                    {getDisplayName(g)}
                  </Text>
                  <Text className="text-nexus-textDim text-xs">
                    {g.isEnabled ? "Aktiviert" : "Deaktiviert"}
                    {g.sessionTimeout ? ` · ${g.sessionTimeout}h Timeout` : " · Permanent"}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => {
                      setEditingGuest(g);
                      setGuestName(g.customName || g.displayName);
                      setGuestTimeout(g.sessionTimeout || 8);
                      setGuestModal(true);
                    }}
                    className="active:opacity-70"
                  >
                    <Ionicons name="pencil" size={16} color="#9A9A9A" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleToggleGuest(g)}
                    className="active:opacity-70"
                  >
                    <View
                      className={`w-10 h-6 rounded-full justify-center px-0.5 ${
                        g.isEnabled ? "bg-nexus-accent" : "bg-nexus-border"
                      }`}
                    >
                      <View
                        className={`w-5 h-5 rounded-full bg-white ${
                          g.isEnabled ? "self-end" : "self-start"
                        }`}
                      />
                    </View>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* SYSTEM STATUS */}
        <View className="mb-6">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3 ml-1">
            System Status
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 gap-4">
            {/* Presets */}
            <View>
              <Text className="text-nexus-textDim text-xs mb-2">Server Presets</Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => applyPreset("https://api.anthropic.com/v1/messages", "claude-sonnet-4-20250514")}
                  className={`flex-1 py-2 rounded-lg items-center border ${
                    serverUrl.includes("anthropic") ? "bg-nexus-accent/20 border-nexus-accent" : "bg-nexus-card border-nexus-border"
                  }`}
                >
                  <Text className={`text-xs font-medium ${serverUrl.includes("anthropic") ? "text-nexus-accent" : "text-nexus-textDim"}`}>
                    Claude API
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => applyPreset("http://100.64.0.1:11434", "llama3")}
                  className={`flex-1 py-2 rounded-lg items-center border ${
                    serverUrl.includes("11434") ? "bg-nexus-accent/20 border-nexus-accent" : "bg-nexus-card border-nexus-border"
                  }`}
                >
                  <Text className={`text-xs font-medium ${serverUrl.includes("11434") ? "text-nexus-accent" : "text-nexus-textDim"}`}>
                    Lokaler Server
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* URL */}
            <View>
              <Text className="text-nexus-textDim text-xs mb-2">Server URL</Text>
              <TextInput
                className="bg-nexus-card border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-[13px] font-mono"
                value={serverUrl}
                onChangeText={(v) => { setServerUrl(v); setUrlDirty(true); }}
              />
            </View>

            {/* Model */}
            <View>
              <Text className="text-nexus-textDim text-xs mb-2">Modell</Text>
              <TextInput
                className="bg-nexus-card border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-[13px] font-mono"
                value={model}
                onChangeText={(v) => { setModel(v); setUrlDirty(true); }}
                placeholder="claude-sonnet-4-20250514"
                placeholderTextColor="#555"
              />
            </View>

            {/* Connection test */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className={`w-3 h-3 rounded-full ${
                  connectionStatus === null ? "bg-nexus-textDim"
                    : connectionStatus.ok ? "bg-nexus-success" : "bg-nexus-danger"
                }`} />
                <Text className="text-nexus-text text-sm" numberOfLines={1}>
                  {connectionStatus === null ? "Nicht getestet"
                    : connectionStatus.ok ? `Verbunden (${connectionStatus.latency}ms)`
                    : `Fehler: ${connectionStatus.error?.slice(0, 30)}`}
                </Text>
              </View>
              <Pressable
                onPress={handleTestConnection}
                disabled={testing}
                className="bg-nexus-card border border-nexus-border rounded-lg px-3 py-2"
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#D4A574" />
                ) : (
                  <Text className="text-nexus-accent text-xs font-medium">
                    {urlDirty ? "Speichern & Testen" : "Testen"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* SELBSTTEST */}
        <View className="mb-6">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3 ml-1">
            Selbsttest
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-nexus-text text-sm font-medium">
                  System-Diagnose
                </Text>
                {testTimestamp && (
                  <Text className="text-nexus-textDim text-[10px]">
                    Zuletzt: {new Date(testTimestamp).toLocaleString("de-DE")}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={handleRunTests}
                disabled={testRunning}
                className="bg-nexus-accent rounded-lg px-4 py-2 active:opacity-80"
              >
                {testRunning ? (
                  <ActivityIndicator size="small" color="#191919" />
                ) : (
                  <Text className="text-nexus-bg text-xs font-bold">
                    Alle Tests
                  </Text>
                )}
              </Pressable>
            </View>

            {testResults.length > 0 && (
              <>
                <View className="border-t border-nexus-border pt-3">
                  {testResults.map((r) => (
                    <View
                      key={r.name}
                      className="flex-row items-center justify-between py-1.5"
                    >
                      <View className="flex-row items-center gap-2 flex-1">
                        <Text className="text-xs">{statusIcon(r.status)}</Text>
                        <View className="flex-1">
                          <Text className="text-nexus-text text-xs">
                            {r.displayName}
                          </Text>
                          <Text className="text-nexus-textDim text-[10px]">
                            {r.message} ({r.duration}ms)
                          </Text>
                        </View>
                      </View>
                      {r.fixable && r.status !== "pass" && r.autoFix && (
                        <Pressable
                          onPress={() => handleAutoFix(r)}
                          className="bg-nexus-card border border-nexus-border rounded px-2 py-1 active:opacity-70"
                        >
                          <Text className="text-nexus-accent text-[10px]">
                            Fix
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={handleCopyReport}
                  className="flex-row items-center justify-center gap-2 bg-nexus-card border border-nexus-border rounded-xl py-2.5 active:opacity-80"
                >
                  <Ionicons name="copy-outline" size={14} color="#D4A574" />
                  <Text className="text-nexus-accent text-xs font-medium">
                    Bericht kopieren
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* UPDATES */}
        <View className="mb-10">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3 ml-1">
            Updates
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-nexus-text text-sm">App Version</Text>
              <Text className="text-nexus-textDim text-sm font-mono">v1.0.0</Text>
            </View>
            <Pressable className="bg-nexus-card border border-nexus-border rounded-xl py-3 items-center">
              <Text className="text-nexus-accent text-sm font-medium">
                Nach Updates suchen
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <AdminUserModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        targetUser={selectedUser}
      />

      {/* Guest Edit Modal */}
      <Modal visible={guestModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-nexus-text font-semibold text-lg">
                Gast bearbeiten
              </Text>
              <Pressable onPress={() => setGuestModal(false)}>
                <Ionicons name="close" size={24} color="#9A9A9A" />
              </Pressable>
            </View>

            <Text className="text-nexus-textDim text-xs mb-2 ml-1">
              Name
            </Text>
            <TextInput
              value={guestName}
              onChangeText={setGuestName}
              placeholder="z.B. Max"
              placeholderTextColor="#555"
              className="bg-nexus-surface border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-sm mb-4"
            />

            <Text className="text-nexus-textDim text-xs mb-2 ml-1">
              Session-Timeout
            </Text>
            <View className="flex-row gap-2 mb-5">
              {TIMEOUT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setGuestTimeout(opt.value)}
                  className={`flex-1 items-center py-2 rounded-lg border ${
                    guestTimeout === opt.value
                      ? "border-nexus-accent bg-nexus-accent/10"
                      : "border-nexus-border bg-nexus-surface"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      guestTimeout === opt.value
                        ? "text-nexus-accent"
                        : "text-nexus-textDim"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleSaveGuest}
              className="bg-nexus-accent rounded-xl py-3 items-center active:opacity-80"
            >
              <Text className="text-nexus-bg font-bold text-sm">Speichern</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
