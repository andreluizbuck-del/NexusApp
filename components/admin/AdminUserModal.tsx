import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { User } from "../../store/users";
import {
  UserSettings,
  loadSettings,
  saveSettings,
} from "../../store/userSettings";
import ToggleRow from "../ToggleRow";
import SegmentButtons from "../SegmentButtons";

interface Props {
  visible: boolean;
  onClose: () => void;
  targetUser: User | null;
}

export default function AdminUserModal({
  visible,
  onClose,
  targetUser,
}: Props) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (targetUser) {
      loadSettings(targetUser.username).then(setSettings);
    }
  }, [targetUser]);

  if (!targetUser || !settings) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View className="flex-1 items-center justify-center bg-black/50">
          <ActivityIndicator color="#D4A574" />
        </View>
      </Modal>
    );
  }

  const update = <K extends keyof UserSettings>(
    key: K,
    val: UserSettings[K]
  ) => {
    setSettings({ ...settings, [key]: val });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(targetUser.username, settings);
    setSaving(false);
    onClose();
  };

  const handleCopyFromAdmin = async () => {
    const adminSettings = await loadSettings("andre");
    setSettings({
      ...adminSettings,
      hackingEnabled: settings.hackingEnabled,
      adultContentEnabled: settings.adultContentEnabled,
      allowedSkills: settings.allowedSkills,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-nexus-bg rounded-t-3xl max-h-[85%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-nexus-border">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-nexus-surface items-center justify-center">
                <Text className="text-nexus-accent font-bold">
                  {targetUser.avatar}
                </Text>
              </View>
              <View>
                <Text className="text-nexus-text font-semibold text-lg">
                  {targetUser.displayName}
                </Text>
                <Text className="text-nexus-textDim text-xs capitalize">
                  {targetUser.role}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#9A9A9A" />
            </Pressable>
          </View>

          <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
            {/* Current Settings Summary */}
            <View className="bg-nexus-surface rounded-xl p-4 mb-4 border border-nexus-border">
              <Text className="text-nexus-accent text-xs font-bold mb-2">
                AKTUELLE EINSTELLUNGEN
              </Text>
              <Text className="text-nexus-textDim text-sm">
                Ton: {settings.tone} · Länge: {settings.responseLength} · Sprache: {settings.language}
              </Text>
              <Text className="text-nexus-textDim text-sm">
                Persona: {settings.persona} · Tiefe: {settings.thinkingDepth}
              </Text>
              <Text className="text-nexus-textDim text-sm">
                KI: {settings.aiName} {settings.aiAvatar}
              </Text>
            </View>

            {/* Permissions */}
            <View className="bg-nexus-surface rounded-xl p-4 mb-4 border border-nexus-border gap-4">
              <Text className="text-nexus-accent text-xs font-bold">
                BERECHTIGUNGEN
              </Text>
              <ToggleRow
                label="Hacking/Security Inhalte erlaubt"
                value={settings.hackingEnabled}
                onToggle={(v) => update("hackingEnabled", v)}
              />
              <ToggleRow
                label="Erwachsene Inhalte erlaubt"
                value={settings.adultContentEnabled}
                onToggle={(v) => update("adultContentEnabled", v)}
              />
              <ToggleRow
                label="Browser erlaubt"
                value={settings.browserEnabled}
                onToggle={(v) => update("browserEnabled", v)}
              />
              <View>
                <Text className="text-nexus-textDim text-xs mb-2">
                  Kontext-Länge
                </Text>
                <SegmentButtons
                  options={[
                    { value: "short", label: "Kurz" },
                    { value: "medium", label: "Normal" },
                    { value: "long", label: "Lang" },
                  ]}
                  value={settings.maxContextLength}
                  onChange={(v) => update("maxContextLength", v)}
                />
              </View>
            </View>

            {/* Actions */}
            <Pressable
              onPress={handleCopyFromAdmin}
              className="bg-nexus-surface border border-nexus-border rounded-xl py-3 items-center mb-3"
            >
              <Text className="text-nexus-text text-sm">
                Standard setzen (Andre's Einstellungen kopieren)
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="bg-nexus-accent rounded-xl py-3.5 items-center mb-8"
            >
              {saving ? (
                <ActivityIndicator color="#191919" />
              ) : (
                <Text className="text-nexus-bg font-semibold text-[16px]">
                  Speichern
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
