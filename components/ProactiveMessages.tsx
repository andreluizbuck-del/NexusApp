import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ProactiveMessage } from "../services/familyRadar";

interface Props {
  messages: ProactiveMessage[];
  onDismiss: (id: string) => void;
}

export default function ProactiveMessages({ messages, onDismiss }: Props) {
  if (messages.length === 0) return null;

  return (
    <View className="px-4 pt-2">
      {messages.map((msg) => (
        <View
          key={msg.id}
          className="bg-nexus-surface/80 border border-nexus-border rounded-xl px-3 py-2.5 mb-2 flex-row items-start gap-2"
        >
          <Text className="text-sm mt-0.5">{msg.icon}</Text>
          <Text className="text-nexus-textDim text-xs flex-1 leading-4">
            {msg.content}
          </Text>
          <Pressable
            onPress={() => onDismiss(msg.id)}
            className="active:opacity-70"
          >
            <Ionicons name="close" size={14} color="#555" />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
