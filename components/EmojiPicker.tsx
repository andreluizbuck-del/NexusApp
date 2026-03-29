import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

const EMOJIS = [
  "🤖", "🧠", "⚡", "🔥", "💎", "🌟", "🎯", "🛡️",
  "🦊", "🐺", "🦅", "🐉", "🦁", "🐱", "🐶", "🦉",
  "👨‍💻", "👩‍🔬", "🧙‍♂️", "🥷", "👾", "🎭", "🌀", "💜",
  "🔮", "🌙", "☀️", "🍀", "🎪", "🏴‍☠️", "🚀", "💫",
];

interface Props {
  selected: string;
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 py-1">
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => onSelect(e)}
            className={`w-10 h-10 rounded-xl items-center justify-center ${
              selected === e
                ? "bg-nexus-accent/30 border border-nexus-accent"
                : "bg-nexus-card"
            }`}
          >
            <Text className="text-xl">{e}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
