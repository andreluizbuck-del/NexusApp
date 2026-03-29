import React from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Skill } from "../store/skills";

interface Props {
  visible: boolean;
  onClose: () => void;
  skills: Skill[];
  activeSkills: Skill[];
  onToggle: (skill: Skill) => void;
  onClearAll: () => void;
}

export default function SkillPickerModal({
  visible,
  onClose,
  skills,
  activeSkills,
  onToggle,
  onClearAll,
}: Props) {
  const installed = skills.filter((s) => s.isInstalled);
  const activeIds = new Set(activeSkills.map((s) => s.id));
  const isFull = activeSkills.length >= 3;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-nexus-bg rounded-t-3xl max-h-[60%]">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-nexus-border">
            <View>
              <Text className="text-nexus-text font-semibold text-lg">
                Skills wählen
              </Text>
              <Text className="text-nexus-textDim text-xs">
                {activeSkills.length}/3 aktiv
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#9A9A9A" />
            </Pressable>
          </View>

          {activeSkills.length > 0 && (
            <Pressable
              onPress={() => {
                onClearAll();
                onClose();
              }}
              className="flex-row items-center gap-3 px-5 py-3 border-b border-nexus-border"
            >
              <Ionicons name="close-circle" size={20} color="#E5534B" />
              <Text className="text-nexus-danger text-[15px]">
                Alle deaktivieren
              </Text>
            </Pressable>
          )}

          <FlatList
            data={installed}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View className="items-center py-10">
                <Text className="text-nexus-textDim">
                  Keine Skills installiert
                </Text>
                <Text className="text-nexus-textDim text-xs mt-1">
                  Installiere Skills im Skill Store
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isActive = activeIds.has(item.id);
              const disabled = !isActive && isFull;

              return (
                <Pressable
                  onPress={() => {
                    if (disabled) return;
                    onToggle(item);
                    if (!isActive && activeSkills.length >= 2) onClose();
                  }}
                  className={`flex-row items-center gap-3 px-5 py-3.5 ${
                    isActive ? "bg-nexus-accent/10" : ""
                  } ${disabled ? "opacity-40" : ""}`}
                >
                  <Text className="text-2xl">{item.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-nexus-text font-medium">
                      {item.name}
                    </Text>
                    <Text
                      className="text-nexus-textDim text-xs"
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                  </View>
                  {isActive ? (
                    <Ionicons name="checkmark-circle" size={20} color="#D4A574" />
                  ) : disabled ? (
                    <Text className="text-nexus-textDim text-[10px]">Max 3</Text>
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color="#9A9A9A" />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
