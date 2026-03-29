import "../global.css";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../store/AuthContext";
import { runCriticalTests } from "../services/selfTest";
import { cleanGuestHistory } from "../store/users";

export default function RootLayout() {
  useEffect(() => {
    // Silent critical tests + guest cleanup on launch
    runCriticalTests().catch(() => {});
    cleanGuestHistory().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#191919" },
          animation: "fade",
        }}
      />
    </AuthProvider>
  );
}
