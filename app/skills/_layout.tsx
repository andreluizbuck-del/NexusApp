import { Stack } from "expo-router";

export default function SkillsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#191919" },
      }}
    />
  );
}
