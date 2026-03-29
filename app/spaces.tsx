import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../store/AuthContext";
import {
  FamilySpace,
  SpaceMessage,
  loadSpaces,
  createSpace,
  addSpaceMessage,
  getSpacesForUser,
  updateSpace,
  SPACE_TEMPLATES,
} from "../store/spaces";
import { loadUsers, NexusUser } from "../store/users";
import { sendMessage, StreamCallbacks } from "../services/api";
import { loadSettings } from "../store/userSettings";

export default function SpacesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [spaces, setSpaces] = useState<FamilySpace[]>([]);
  const [allUsers, setAllUsers] = useState<NexusUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSpaceChat, setShowSpaceChat] = useState(false);
  const [activeSpace, setActiveSpace] = useState<FamilySpace | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🏠");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [s, u] = await Promise.all([
      getSpacesForUser(user.username),
      loadUsers(),
    ]);
    setSpaces(s);
    setAllUsers(u.filter((u) => u.isEnabled && u.role !== "guest"));
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const space: FamilySpace = {
      id: Date.now().toString(),
      name: newName.trim(),
      icon: newIcon,
      createdBy: user.username,
      members: [user.username, ...selectedMembers],
      messages: [],
      sharedFacts: [],
      isArchived: false,
      createdAt: new Date().toISOString(),
    };
    await createSpace(space);
    setShowCreateModal(false);
    setNewName("");
    setSelectedMembers([]);
    loadData();
  };

  const handleOpenSpace = (space: FamilySpace) => {
    setActiveSpace(space);
    setShowSpaceChat(true);
  };

  const handleSendInSpace = async () => {
    if (!user || !activeSpace || !messageText.trim() || isStreaming) return;

    const msg: SpaceMessage = {
      id: Date.now().toString(),
      authorId: user.username,
      content: messageText.trim(),
      type: "text",
      timestamp: new Date().toISOString(),
    };

    await addSpaceMessage(activeSpace.id, msg);
    const updatedSpace = {
      ...activeSpace,
      messages: [...activeSpace.messages, msg],
    };
    setActiveSpace(updatedSpace);
    setMessageText("");

    // If message starts with @nexus or @Nexus, get AI response
    if (messageText.trim().toLowerCase().startsWith("@nexus")) {
      setIsStreaming(true);
      const settings = await loadSettings(user.username);
      const userMessage = messageText.trim().replace(/^@nexus\s*/i, "");

      let responseText = "";
      const callbacks: StreamCallbacks = {
        onToken: (token) => {
          responseText += token;
        },
        onDone: async (fullText) => {
          const aiMsg: SpaceMessage = {
            id: (Date.now() + 1).toString(),
            authorId: "nexus",
            content: fullText,
            type: "ai_response",
            timestamp: new Date().toISOString(),
          };
          await addSpaceMessage(activeSpace.id, aiMsg);
          setActiveSpace((prev) =>
            prev ? { ...prev, messages: [...prev.messages, msg, aiMsg] } : prev
          );
          setIsStreaming(false);
        },
        onError: async (error) => {
          const errMsg: SpaceMessage = {
            id: (Date.now() + 1).toString(),
            authorId: "nexus",
            content: `Fehler: ${error}`,
            type: "ai_response",
            timestamp: new Date().toISOString(),
          };
          await addSpaceMessage(activeSpace.id, errMsg);
          setActiveSpace((prev) =>
            prev ? { ...prev, messages: [...prev.messages, errMsg] } : prev
          );
          setIsStreaming(false);
        },
      };

      await sendMessage(
        [{ id: "1", role: "user", content: userMessage, timestamp: Date.now() }],
        callbacks,
        undefined,
        user as any,
        settings
      );
    }
  };

  const handleArchive = (spaceId: string) => {
    Alert.alert("Space archivieren?", "Der Space wird ausgeblendet.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Archivieren",
        onPress: async () => {
          await updateSpace(spaceId, { isArchived: true });
          setShowSpaceChat(false);
          loadData();
        },
      },
    ]);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-nexus-bg items-center justify-center">
        <ActivityIndicator color="#D4A574" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-nexus-border">
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Ionicons name="arrow-back" size={24} color="#E0E0E0" />
        </Pressable>
        <Text className="text-nexus-text font-semibold text-lg flex-1">
          Family Spaces
        </Text>
        {user?.role === "admin" && (
          <Pressable
            onPress={() => setShowCreateModal(true)}
            className="bg-nexus-accent rounded-lg px-3 py-1.5 active:opacity-80"
          >
            <Text className="text-nexus-bg text-xs font-bold">+ Space</Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        {spaces.length === 0 ? (
          <View className="items-center pt-16">
            <Text className="text-4xl mb-3">🏠</Text>
            <Text className="text-nexus-text text-lg font-medium">
              Keine Spaces vorhanden
            </Text>
            <Text className="text-nexus-textDim text-sm mt-1 text-center">
              Spaces sind geteilte Gespräche{"\n"}für die ganze Familie
            </Text>
          </View>
        ) : (
          spaces.map((space) => (
            <Pressable
              key={space.id}
              onPress={() => handleOpenSpace(space)}
              className="bg-nexus-surface border border-nexus-border rounded-xl p-4 mb-3 active:bg-nexus-card"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">{space.icon}</Text>
                <View className="flex-1">
                  <Text className="text-nexus-text font-medium">
                    {space.name}
                  </Text>
                  <Text className="text-nexus-textDim text-xs">
                    {space.members.length} Mitglieder •{" "}
                    {space.messages.length} Nachrichten
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Create Space Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-nexus-text font-semibold text-lg">
                Neuer Space
              </Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#9A9A9A" />
              </Pressable>
            </View>

            <Text className="text-nexus-textDim text-xs mb-2">Vorlagen</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {SPACE_TEMPLATES.map((t) => (
                <Pressable
                  key={t.name}
                  onPress={() => {
                    setNewName(t.name);
                    setNewIcon(t.icon);
                  }}
                  className="bg-nexus-surface border border-nexus-border rounded-lg px-3 py-2 mr-2 flex-row items-center gap-1.5"
                >
                  <Text>{t.icon}</Text>
                  <Text className="text-nexus-text text-xs">{t.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Space-Name"
              placeholderTextColor="#555"
              className="bg-nexus-surface border border-nexus-border rounded-xl p-3 text-nexus-text text-sm mb-4"
            />

            <Text className="text-nexus-textDim text-xs mb-2">
              Mitglieder einladen
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {allUsers
                .filter((u) => u.username !== user?.username)
                .map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => toggleMember(u.username)}
                    className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg border ${
                      selectedMembers.includes(u.username)
                        ? "bg-nexus-accent/10 border-nexus-accent"
                        : "bg-nexus-surface border-nexus-border"
                    }`}
                  >
                    <Text className="text-sm">{u.emoji}</Text>
                    <Text
                      className={`text-xs ${
                        selectedMembers.includes(u.username)
                          ? "text-nexus-accent"
                          : "text-nexus-text"
                      }`}
                    >
                      {u.displayName}
                    </Text>
                  </Pressable>
                ))}
            </View>

            <Pressable
              onPress={handleCreate}
              disabled={!newName.trim()}
              className={`rounded-xl py-3 items-center ${
                newName.trim()
                  ? "bg-nexus-accent active:opacity-80"
                  : "bg-nexus-border"
              }`}
            >
              <Text
                className={`font-bold text-sm ${
                  newName.trim() ? "text-nexus-bg" : "text-nexus-textDim"
                }`}
              >
                Space erstellen
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Space Chat Modal */}
      <Modal visible={showSpaceChat} animationType="slide">
        <SafeAreaView className="flex-1 bg-nexus-bg">
          {activeSpace && (
            <>
              <View className="flex-row items-center gap-3 px-5 py-3 border-b border-nexus-border">
                <Pressable
                  onPress={() => setShowSpaceChat(false)}
                  className="active:opacity-70"
                >
                  <Ionicons name="arrow-back" size={24} color="#E0E0E0" />
                </Pressable>
                <Text className="text-lg">{activeSpace.icon}</Text>
                <View className="flex-1">
                  <Text className="text-nexus-text font-semibold">
                    {activeSpace.name}
                  </Text>
                  <Text className="text-nexus-textDim text-xs">
                    {activeSpace.members.length} Mitglieder • @nexus für
                    KI-Antwort
                  </Text>
                </View>
                {user?.role === "admin" && (
                  <Pressable
                    onPress={() => handleArchive(activeSpace.id)}
                    className="active:opacity-70"
                  >
                    <Ionicons name="archive-outline" size={20} color="#9A9A9A" />
                  </Pressable>
                )}
              </View>

              <FlatList
                ref={flatListRef}
                data={activeSpace.messages}
                keyExtractor={(item) => item.id}
                className="flex-1"
                contentContainerStyle={{ padding: 16 }}
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
                ListEmptyComponent={
                  <View className="items-center pt-20">
                    <Text className="text-nexus-textDim text-sm">
                      Noch keine Nachrichten
                    </Text>
                    <Text className="text-nexus-textDim text-xs mt-1">
                      Schreibe @nexus für eine KI-Antwort
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isNexus = item.authorId === "nexus";
                  const isMe = item.authorId === user?.username;
                  const author = allUsers.find(
                    (u) => u.username === item.authorId
                  );

                  return (
                    <View
                      className={`mb-3 ${isMe ? "items-end" : "items-start"}`}
                    >
                      {!isMe && (
                        <Text className="text-nexus-textDim text-[10px] mb-0.5 ml-1">
                          {isNexus ? "🤖 Nexus" : `${author?.emoji || "👤"} ${author?.displayName || item.authorId}`}
                        </Text>
                      )}
                      <View
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isNexus
                            ? "bg-nexus-surface border border-nexus-border"
                            : isMe
                            ? "bg-nexus-accent"
                            : "bg-nexus-card"
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            isMe ? "text-nexus-bg" : "text-nexus-text"
                          }`}
                        >
                          {item.content}
                        </Text>
                      </View>
                      <Text className="text-nexus-textDim text-[9px] mt-0.5 mx-1">
                        {new Date(item.timestamp).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  );
                }}
              />

              <View className="flex-row items-center gap-2 px-4 py-3 border-t border-nexus-border">
                <TextInput
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Nachricht (@nexus für KI)..."
                  placeholderTextColor="#555"
                  className="flex-1 bg-nexus-surface border border-nexus-border rounded-xl px-4 py-2.5 text-nexus-text text-sm"
                />
                <Pressable
                  onPress={handleSendInSpace}
                  disabled={!messageText.trim() || isStreaming}
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    messageText.trim() && !isStreaming
                      ? "bg-nexus-accent active:opacity-80"
                      : "bg-nexus-border"
                  }`}
                >
                  {isStreaming ? (
                    <ActivityIndicator size="small" color="#191919" />
                  ) : (
                    <Ionicons name="send" size={16} color="#191919" />
                  )}
                </Pressable>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
