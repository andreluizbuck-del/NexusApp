import React, { useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <View className="flex-row items-end px-4 py-3 border-t border-nexus-border bg-nexus-bg">
      <View className="flex-1 bg-nexus-surface rounded-2xl flex-row items-end px-4 min-h-[44px]">
        <TextInput
          className="flex-1 text-nexus-text text-[15px] py-3 max-h-[120px]"
          placeholder="Message Nexus..."
          placeholderTextColor="#666"
          value={text}
          onChangeText={setText}
          multiline
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        className={`ml-2 w-10 h-10 rounded-full items-center justify-center ${
          text.trim() && !disabled ? "bg-nexus-accent" : "bg-nexus-card"
        }`}
      >
        <Ionicons
          name="arrow-up"
          size={20}
          color={text.trim() && !disabled ? "#191919" : "#666"}
        />
      </Pressable>
    </View>
  );
}
