import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  content: string;
}

export function parseConfidence(text: string): number | null {
  // Match patterns like [Konfidenz: 7/10] or (Konfidenz: 5/10)
  const match = text.match(/[\[\(]Konfidenz:\s*(\d+)\s*\/\s*10[\]\)]/i);
  if (match) return parseInt(match[1], 10);

  // Check for uncertainty phrases
  if (/ich bin mir nicht sicher/i.test(text)) return 4;
  if (/ich bin unsicher/i.test(text)) return 4;
  if (/bitte verifizieren/i.test(text)) return 3;

  return null;
}

export default function ConfidenceIndicator({ content }: Props) {
  const confidence = parseConfidence(content);
  if (confidence === null) return null;

  if (confidence >= 7) return null; // High confidence, no indicator needed

  if (confidence < 5) {
    return (
      <View className="flex-row items-center gap-1.5 mt-1.5 bg-orange-500/15 rounded-lg px-2.5 py-1 self-start">
        <Ionicons name="warning" size={12} color="#F0883E" />
        <Text className="text-orange-400 text-[11px] font-medium">
          Bitte verifizieren (Konfidenz: {confidence}/10)
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1.5 mt-1.5 bg-yellow-500/15 rounded-lg px-2.5 py-1 self-start">
      <Ionicons name="information-circle" size={12} color="#D4A72C" />
      <Text className="text-yellow-400 text-[11px] font-medium">
        Konfidenz: {confidence}/10
      </Text>
    </View>
  );
}
