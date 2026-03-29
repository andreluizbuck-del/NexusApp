import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  andre: ["Trading Bot Status", "Was gibt's Neues?", "Code Review"],
  schwester: ["Jura Frage", "Zusammenfassung", "Lernplan"],
  mama: ["Rezept Ideen", "Übersetzung", "Einkaufsliste"],
  oma: ["Erkläre mir...", "Was ist...?", "Hilf mir mit..."],
  papa: ["Nachrichten", "Wetter", "Kalender"],
};

interface Props {
  username: string;
  onSelect: (text: string) => void;
}

export default function QuickReplies({ username, onSelect }: Props) {
  const suggestions = ROLE_SUGGESTIONS[username] || ROLE_SUGGESTIONS.andre;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="mb-3"
    >
      {suggestions.map((s) => (
        <Pressable
          key={s}
          onPress={() => onSelect(s)}
          className="bg-nexus-surface border border-nexus-border rounded-xl px-4 py-2.5 active:bg-nexus-card"
        >
          <Text className="text-nexus-text text-sm">{s}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
