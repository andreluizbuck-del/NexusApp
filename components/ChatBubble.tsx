import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  onCopy?: () => void;
  onDelete?: () => void;
  onFeedback?: (positive: boolean) => void;
}

function formatTime(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function renderContent(content: string, isUser: boolean) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text
          key={key++}
          className={`text-[15px] leading-[22px] ${isUser ? "text-nexus-bg" : "text-nexus-text"}`}
        >
          {content.slice(lastIndex, match.index)}
        </Text>
      );
    }
    parts.push(
      <View key={key++} className="bg-[#1a1a2e] rounded-lg p-3 my-1">
        {match[1] ? (
          <Text className="text-nexus-accent text-[10px] mb-1 font-bold">
            {match[1].toUpperCase()}
          </Text>
        ) : null}
        <Text className="text-[#E0E0E0] text-[13px] font-mono">
          {match[2].trim()}
        </Text>
      </View>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <Text
        key={key++}
        className={`text-[15px] leading-[22px] ${isUser ? "text-nexus-bg" : "text-nexus-text"}`}
      >
        {content.slice(lastIndex)}
      </Text>
    );
  }

  return parts.length > 0 ? parts : (
    <Text
      className={`text-[15px] leading-[22px] ${isUser ? "text-nexus-bg" : "text-nexus-text"}`}
    >
      {content}
    </Text>
  );
}

export default function ChatBubble({
  role,
  content,
  timestamp,
  onCopy,
  onDelete,
  onFeedback,
}: Props) {
  const [showActions, setShowActions] = useState(false);

  if (role === "system") {
    return (
      <View className="items-center my-2 px-8">
        <Text className="text-nexus-textDim text-xs text-center">
          {content}
        </Text>
      </View>
    );
  }

  const isUser = role === "user";

  return (
    <View className={`mb-3 px-4 ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && (
        <Text className="text-nexus-accent text-xs font-semibold mb-1 ml-1">
          Nexus
        </Text>
      )}
      <Pressable
        onLongPress={() => setShowActions(!showActions)}
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-nexus-accent rounded-br-sm"
            : "bg-nexus-surface rounded-bl-sm"
        }`}
      >
        {renderContent(content, isUser)}
      </Pressable>
      {timestamp ? (
        <Text className="text-nexus-textDim text-[10px] mt-0.5 mx-1">
          {formatTime(timestamp)}
        </Text>
      ) : null}
      {showActions && (
        <View className="flex-row gap-3 mt-1 mx-1">
          {onCopy && (
            <Pressable onPress={onCopy}>
              <Ionicons name="copy-outline" size={16} color="#9A9A9A" />
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color="#E5534B" />
            </Pressable>
          )}
          {!isUser && onFeedback && (
            <>
              <Pressable onPress={() => onFeedback(true)}>
                <Ionicons name="thumbs-up-outline" size={16} color="#57AB5A" />
              </Pressable>
              <Pressable onPress={() => onFeedback(false)}>
                <Ionicons name="thumbs-down-outline" size={16} color="#E5534B" />
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}
