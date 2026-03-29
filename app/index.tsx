import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../store/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/(tabs)/chat");
    } else {
      router.replace("/login");
    }
  }, [user, loading]);

  return (
    <View className="flex-1 bg-nexus-bg items-center justify-center">
      <ActivityIndicator size="large" color="#D4A574" />
    </View>
  );
}
