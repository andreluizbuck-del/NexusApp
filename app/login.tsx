import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../store/AuthContext";
import { authenticateUser } from "../store/users";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    setError("");
    const user = authenticateUser(username, password);
    if (!user) {
      setError("Benutzername oder Passwort falsch");
      return;
    }
    await login(user);
    router.replace("/(tabs)/chat");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-nexus-bg"
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 rounded-2xl bg-nexus-surface items-center justify-center mb-4 border border-nexus-border">
            <Text className="text-nexus-accent text-3xl font-bold">N</Text>
          </View>
          <Text className="text-nexus-text text-3xl font-bold">Nexus</Text>
          <Text className="text-nexus-textDim text-sm mt-1">
            Familien-Assistent
          </Text>
        </View>

        {/* Form */}
        <View className="gap-4">
          <View>
            <Text className="text-nexus-textDim text-xs uppercase tracking-wider mb-2 ml-1">
              Benutzername
            </Text>
            <TextInput
              className="bg-nexus-surface border border-nexus-border rounded-xl px-4 py-3.5 text-nexus-text text-[15px]"
              placeholder="Benutzername eingeben"
              placeholderTextColor="#555"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View>
            <Text className="text-nexus-textDim text-xs uppercase tracking-wider mb-2 ml-1">
              Passwort
            </Text>
            <TextInput
              className="bg-nexus-surface border border-nexus-border rounded-xl px-4 py-3.5 text-nexus-text text-[15px]"
              placeholder="Passwort eingeben"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={handleLogin}
            />
          </View>

          {error ? (
            <Text className="text-nexus-danger text-sm text-center">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleLogin}
            className="bg-nexus-accent rounded-xl py-3.5 items-center mt-2 active:opacity-80"
          >
            <Text className="text-nexus-bg font-semibold text-[16px]">
              Anmelden
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
