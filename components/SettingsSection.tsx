import React from "react";
import { View, Text } from "react-native";

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function SettingsSection({ title, children }: Props) {
  return (
    <View className="mb-6">
      <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3 ml-1">
        {title}
      </Text>
      <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 gap-4">
        {children}
      </View>
    </View>
  );
}
