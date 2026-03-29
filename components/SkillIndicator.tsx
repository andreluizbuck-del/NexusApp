import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Skill } from "../store/skills";

interface Props {
  skills: Skill[];
  onPress: () => void;
  onRemove: (skill: Skill) => void;
}

export default function SkillIndicator({ skills, onPress, onRemove }: Props) {
  if (skills.length === 0) {
    return (
      <Pressable
        onPress={onPress}
        className="flex-row items-center gap-1.5 bg-nexus-card rounded-lg px-2.5 py-1 active:opacity-70"
      >
        <Ionicons name="flash-outline" size={14} color="#9A9A9A" />
        <Text className="text-nexus-textDim text-xs">Skills</Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center gap-1">
      {skills.map((skill) => (
        <Pressable
          key={skill.id}
          onPress={() => onRemove(skill)}
          className="flex-row items-center gap-1 bg-nexus-accent/15 rounded-lg px-2 py-1 active:opacity-70"
        >
          <Text className="text-xs">{skill.icon}</Text>
          <Text className="text-nexus-accent text-[10px] font-medium" numberOfLines={1}>
            {skill.name.length > 10 ? skill.name.slice(0, 10) + "…" : skill.name}
          </Text>
          <Ionicons name="close-circle" size={12} color="#D4A574" />
        </Pressable>
      ))}
      {skills.length < 3 && (
        <Pressable
          onPress={onPress}
          className="w-6 h-6 rounded-md bg-nexus-card items-center justify-center active:opacity-70"
        >
          <Ionicons name="add" size={14} color="#9A9A9A" />
        </Pressable>
      )}
    </View>
  );
}
