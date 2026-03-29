import React from "react";
import { View, Text, Pressable } from "react-native";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (val: T) => void;
}

export default function SegmentButtons<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <View className="flex-row gap-2">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`flex-1 py-2.5 rounded-xl items-center ${
            value === opt.value
              ? "bg-nexus-accent"
              : "bg-nexus-surface border border-nexus-border"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              value === opt.value ? "text-nexus-bg" : "text-nexus-textDim"
            }`}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
