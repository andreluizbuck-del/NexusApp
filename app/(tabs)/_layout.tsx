import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../store/AuthContext";
import { getLastTestResults, hasCriticalFailures } from "../../services/selfTest";

export default function TabLayout() {
  const { user } = useAuth();
  const isAdmin = user?.username === "andre";
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getLastTestResults().then((data) => {
      if (data && hasCriticalFailures(data.results)) {
        setShowBadge(true);
      }
    });
  }, [isAdmin]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#191919",
          borderTopColor: "#353535",
          borderTopWidth: 0.5,
          height: 85,
          paddingBottom: 30,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#D4A574",
        tabBarInactiveTintColor: "#666",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Einstellungen",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-sharp" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="shield-checkmark" size={size} color={color} />
              {showBadge && (
                <View className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-nexus-danger" />
              )}
            </View>
          ),
          href: isAdmin ? "/(tabs)/admin" : null,
        }}
      />
    </Tabs>
  );
}
