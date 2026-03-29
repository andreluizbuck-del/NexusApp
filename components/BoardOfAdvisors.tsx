import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface BoardResult {
  analyst: string;
  critic: string;
  optimist: string;
}

interface Props {
  result: BoardResult | null;
  loading: boolean;
  onClose: () => void;
}

const TABS = [
  { key: "analyst" as const, label: "Analytiker", icon: "🧠", color: "#6CB6FF" },
  { key: "critic" as const, label: "Kritiker", icon: "😈", color: "#E5534B" },
  { key: "optimist" as const, label: "Optimist", icon: "⭐", color: "#57AB5A" },
];

export default function BoardOfAdvisors({ result, loading, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"analyst" | "critic" | "optimist">("analyst");

  return (
    <View className="bg-nexus-surface border border-nexus-border rounded-2xl mx-4 mb-3 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-nexus-border">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm">🏛️</Text>
          <Text className="text-nexus-text font-semibold text-sm">Board of Advisors</Text>
        </View>
        <Pressable onPress={onClose} className="active:opacity-70">
          <Ionicons name="close" size={18} color="#9A9A9A" />
        </Pressable>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-nexus-border">
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 ${
              activeTab === tab.key ? "border-b-2" : ""
            }`}
            style={activeTab === tab.key ? { borderBottomColor: tab.color } : undefined}
          >
            <Text className="text-xs">{tab.icon}</Text>
            <Text
              className={`text-xs font-medium ${
                activeTab === tab.key ? "text-nexus-text" : "text-nexus-textDim"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView className="max-h-64 px-4 py-3">
        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#D4A574" />
            <Text className="text-nexus-textDim text-xs mt-2">
              Drei Perspektiven werden analysiert...
            </Text>
          </View>
        ) : result ? (
          <Text className="text-nexus-text text-sm leading-5">
            {result[activeTab]}
          </Text>
        ) : (
          <Text className="text-nexus-textDim text-sm text-center py-4">
            Kein Ergebnis
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
