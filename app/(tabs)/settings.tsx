import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../store/AuthContext";
import {
  UserSettings,
  loadSettings,
  saveSettings,
} from "../../store/userSettings";
import SettingsSection from "../../components/SettingsSection";
import SegmentButtons from "../../components/SegmentButtons";
import ToggleRow from "../../components/ToggleRow";
import EmojiPicker from "../../components/EmojiPicker";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (user) loadSettings(user.username).then(setSettings);
  }, [user]);

  if (!settings) {
    return (
      <SafeAreaView className="flex-1 bg-nexus-bg items-center justify-center" edges={["top"]}>
        <ActivityIndicator color="#D4A574" />
      </SafeAreaView>
    );
  }

  const update = <K extends keyof UserSettings>(
    key: K,
    val: UserSettings[K]
  ) => {
    setSettings({ ...settings, [key]: val });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await saveSettings(user.username, settings);
    setSaving(false);
    setDirty(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      <View className="px-5 py-3 border-b border-nexus-border flex-row items-center justify-between">
        <Text className="text-nexus-text font-semibold text-[17px]">
          Einstellungen
        </Text>
        {dirty && (
          <View className="bg-nexus-accent/20 rounded px-2 py-0.5">
            <Text className="text-nexus-accent text-[10px] font-bold">
              UNGESPEICHERT
            </Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        {/* PROFIL */}
        <SettingsSection title="Profil">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-nexus-card items-center justify-center border border-nexus-border">
              <Text className="text-2xl">{settings.aiAvatar}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-nexus-text font-semibold text-lg">
                  {user?.displayName}
                </Text>
                {user?.role === "admin" && (
                  <View className="bg-nexus-accent/20 rounded px-1.5 py-0.5">
                    <Text className="text-nexus-accent text-[10px] font-bold">
                      ADMIN
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-nexus-textDim text-sm capitalize">
                {user?.role}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleLogout}
            className="bg-nexus-card border border-nexus-danger/30 rounded-xl py-2.5 items-center"
          >
            <Text className="text-nexus-danger text-sm font-medium">
              Abmelden
            </Text>
          </Pressable>
        </SettingsSection>

        {/* KI VERHALTEN */}
        <SettingsSection title="KI Verhalten">
          <View>
            <Text className="text-nexus-textDim text-xs mb-2">Tonfall</Text>
            <SegmentButtons
              options={[
                { value: "casual", label: "Locker" },
                { value: "direct", label: "Direkt" },
                { value: "formal", label: "Formell" },
              ]}
              value={settings.tone}
              onChange={(v) => update("tone", v)}
            />
          </View>

          <View>
            <Text className="text-nexus-textDim text-xs mb-2">
              Antwortlänge
            </Text>
            <SegmentButtons
              options={[
                { value: "short", label: "Kurz" },
                { value: "medium", label: "Normal" },
                { value: "long", label: "Ausführlich" },
              ]}
              value={settings.responseLength}
              onChange={(v) => update("responseLength", v)}
            />
          </View>

          <View>
            <Text className="text-nexus-textDim text-xs mb-2">Sprache</Text>
            <SegmentButtons
              options={[
                { value: "auto", label: "Auto" },
                { value: "deutsch", label: "Deutsch" },
                { value: "english", label: "English" },
                { value: "portugues", label: "Português" },
              ]}
              value={settings.language}
              onChange={(v) => update("language", v)}
            />
          </View>

          <View>
            <Text className="text-nexus-textDim text-xs mb-2">Denktiefe</Text>
            <SegmentButtons
              options={[
                { value: "fast", label: "Schnell" },
                { value: "deep", label: "Gründlich" },
              ]}
              value={settings.thinkingDepth}
              onChange={(v) => update("thinkingDepth", v)}
            />
          </View>

          <View>
            <Text className="text-nexus-textDim text-xs mb-2">Persona</Text>
            <SegmentButtons
              options={[
                { value: "assistant", label: "Assistent" },
                { value: "friend", label: "Freund" },
                { value: "teacher", label: "Lehrer" },
              ]}
              value={settings.persona}
              onChange={(v) => update("persona", v)}
            />
          </View>
        </SettingsSection>

        {/* PERSÖNLICHE ANWEISUNGEN */}
        <SettingsSection title="Persönliche Anweisungen">
          <TextInput
            className="bg-nexus-card border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-[14px] min-h-[100px]"
            placeholder="Schreib hier was Nexus über dich wissen soll... z.B. 'Ich studiere Jura in der Schweiz. Fokussiere dich auf ZGB und OR.'"
            placeholderTextColor="#555"
            value={settings.customInstructions}
            onChangeText={(v) => update("customInstructions", v)}
            multiline
            textAlignVertical="top"
          />
        </SettingsSection>

        {/* KI CHARAKTER EDITOR */}
        <SettingsSection title="KI Charakter Editor">
          <View>
            <Text className="text-nexus-textDim text-xs mb-2">KI Name</Text>
            <TextInput
              className="bg-nexus-card border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-[15px]"
              placeholder="Nexus"
              placeholderTextColor="#555"
              value={settings.aiName}
              onChangeText={(v) => update("aiName", v)}
            />
          </View>

          <View>
            <Text className="text-nexus-textDim text-xs mb-2">
              Persönlichkeit
            </Text>
            <TextInput
              className="bg-nexus-card border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-[14px] min-h-[70px]"
              placeholder="z.B. 'Witzig, sarkastisch, aber immer hilfreich'"
              placeholderTextColor="#555"
              value={settings.aiPersonality}
              onChangeText={(v) => update("aiPersonality", v)}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View>
            <Text className="text-nexus-textDim text-xs mb-2">
              KI Avatar
            </Text>
            <EmojiPicker
              selected={settings.aiAvatar}
              onSelect={(v) => update("aiAvatar", v)}
            />
          </View>
        </SettingsSection>

        {/* TOOLS */}
        <SettingsSection title="Tools">
          <ToggleRow
            label="Browser erlaubt"
            value={settings.browserEnabled}
            onToggle={(v) => update("browserEnabled", v)}
          />
          <ToggleRow
            label="Benachrichtigungen"
            value={settings.notificationsEnabled}
            onToggle={(v) => update("notificationsEnabled", v)}
          />
        </SettingsSection>

        {/* DATENSCHUTZ */}
        <SettingsSection title="Datenschutz & Gedächtnis">
          <Pressable
            onPress={() => router.push("/memory")}
            className="flex-row items-center justify-between py-1 active:opacity-70"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-lg">🧠</Text>
              <View>
                <Text className="text-nexus-text text-sm font-medium">
                  Mein Gedächtnis
                </Text>
                <Text className="text-nexus-textDim text-xs">
                  Gespeicherte Fakten, Inkognito, Daten löschen
                </Text>
              </View>
            </View>
            <Text className="text-nexus-textDim text-lg">›</Text>
          </Pressable>
        </SettingsSection>

        {/* SPEICHERN */}
        <Pressable
          onPress={handleSave}
          disabled={saving || !dirty}
          className={`rounded-2xl py-4 items-center mb-10 ${
            dirty ? "bg-nexus-accent" : "bg-nexus-card"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#191919" />
          ) : (
            <Text
              className={`font-semibold text-[16px] ${
                dirty ? "text-nexus-bg" : "text-nexus-textDim"
              }`}
            >
              Speichern
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
