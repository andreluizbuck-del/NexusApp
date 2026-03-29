import React from "react";
import { View, Text, Switch } from "react-native";

interface Props {
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  disabled?: boolean;
}

export default function ToggleRow({ label, value, onToggle, disabled }: Props) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className={`text-[15px] ${disabled ? "text-nexus-textDim" : "text-nexus-text"}`}
      >
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: "#353535", true: "#D4A574" }}
        thumbColor={value ? "#fff" : "#666"}
      />
    </View>
  );
}
