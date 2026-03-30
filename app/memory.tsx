import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
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
  KnowledgeFact,
  FactCategory,
  FactVisibility,
  getVisibleFacts,
  addFact,
  deleteFact,
  updateFact,
  getPrivacySettings,
  savePrivacySettings,
  PrivacySettings,
  deleteAllUserData,
  isIncognito,
  setIncognito,
} from "../store/privacy";

const CATEGORY_LABELS: Record<FactCategory, { label: string; icon: string }> = {
  family: { label: "Familie", icon: "👨‍👩‍👧‍👦" },
  health: { label: "Gesundheit", icon: "🏥" },
  schedule: { label: "Termine", icon: "📅" },
  preference: { label: "Vorlieben", icon: "❤️" },
  work: { label: "Arbeit", icon: "💼" },
  other: { label: "Sonstiges", icon: "📝" },
};

const VISIBILITY_LABELS: Record<FactVisibility, { label: string; color: string }> = {
  private: { label: "Privat", color: "#E5534B" },
  family: { label: "Familie", color: "#57AB5A" },
  admin_only: { label: "Nur Admin", color: "#D4A574" },
};

export default function MemoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [facts, setFacts] = useState<KnowledgeFact[]>([]);
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    memoryEnabled: true,
    incognitoMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addVisibilityPreset, setAddVisibilityPreset] = useState<FactVisibility>("private");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<FactCategory>("other");
  const [newVisibility, setNewVisibility] = useState<FactVisibility>("private");
  const [deleteStep, setDeleteStep] = useState(0);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [f, p] = await Promise.all([
      getVisibleFacts(user.username, user.role),
      getPrivacySettings(user.username),
    ]);
    setFacts(f);
    setPrivacy(p);
    setLoading(false);
  };

  const handleAddFact = async () => {
    if (!user || !newContent.trim()) return;
    const fact: KnowledgeFact = {
      id: Date.now().toString(),
      content: newContent.trim(),
      category: newCategory,
      visibility: newVisibility,
      createdBy: user.username,
      createdAt: new Date().toISOString(),
      source: "manual",
      verified: true,
    };
    await addFact(fact);
    setNewContent("");
    setShowAddModal(false);
    loadData();
  };

  const handleDelete = async (factId: string) => {
    if (!user) return;
    await deleteFact(factId, user.username);
    loadData();
  };

  const handleToggleVisibility = async (fact: KnowledgeFact) => {
    const order: FactVisibility[] = ["private", "family", "admin_only"];
    const idx = order.indexOf(fact.visibility);
    const next = order[(idx + 1) % order.length];
    await updateFact(fact.id, { visibility: next });
    loadData();
  };

  const handleToggleMemory = async (enabled: boolean) => {
    if (!user) return;
    const updated = { ...privacy, memoryEnabled: enabled };
    setPrivacy(updated);
    await savePrivacySettings(user.username, updated);
  };

  const handleToggleIncognito = (active: boolean) => {
    if (!user) return;
    setIncognito(user.username, active);
    setPrivacy({ ...privacy, incognitoMode: active });
  };

  const handleDeleteAll = () => {
    if (!user) return;
    // Step 1
    Alert.alert(
      "Alle Daten löschen?",
      "Dies löscht ALLE deine Daten: Chat-Verlauf, Einstellungen, Fakten, Skills. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ja, weiter →",
          style: "destructive",
          onPress: () => {
            // Step 2
            Alert.alert(
              "Bist du wirklich sicher?",
              "Diese Aktion kann NICHT rückgängig gemacht werden. Wirklich löschen?",
              [
                { text: "Abbrechen", style: "cancel" },
                {
                  text: "Weiter →",
                  style: "destructive",
                  onPress: () => {
                    // Step 3 — final confirmation
                    Alert.alert(
                      "Letzte Warnung",
                      `Du löschst ALLE Daten von \"${user.displayName}\" unwiderruflich. Wirklich?`,
                      [
                        { text: "Abbrechen", style: "cancel" },
                        {
                          text: "JA, ALLES LÖSCHEN",
                          style: "destructive",
                          onPress: async () => {
                            await deleteAllUserData(user.username);
                            loadData();
                          },
                        },
                      ]
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const openShareModal = () => {
    setAddVisibilityPreset("family");
    setNewVisibility("family");
    setNewContent("");
    setNewCategory("other");
    setShowAddModal(true);
  };

  const openPrivateModal = () => {
    setAddVisibilityPreset("private");
    setNewVisibility("private");
    setNewContent("");
    setNewCategory("other");
    setShowAddModal(true);
  };

  // Private facts I created
  const myPrivateFacts = facts.filter(
    (f) => f.createdBy === user?.username && f.visibility === "private"
  );
  // Family facts I'm sharing
  const mySharedFacts = facts.filter(
    (f) => f.createdBy === user?.username && f.visibility === "family"
  );
  // Family facts shared by others
  const othersSharedFacts = facts.filter(
    (f) => f.visibility === "family" && f.createdBy !== user?.username
  );

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
          Gedächtnis & Privatsphäre
        </Text>
        <Pressable
          onPress={openPrivateModal}
          className="bg-nexus-accent rounded-lg px-3 py-1.5 active:opacity-80"
        >
          <Text className="text-nexus-bg text-xs font-bold">+ Fakt</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Section 1: Mein Gedächtnis (Privat) */}
        <View className="px-5 pt-5">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3">
            Mein Gedächtnis – Privat ({myPrivateFacts.length})
          </Text>
          {myPrivateFacts.length === 0 ? (
            <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-5 items-center gap-1">
              <Text className="text-2xl">🧠</Text>
              <Text className="text-nexus-textDim text-sm mt-1">
                Nexus hat noch nichts gespeichert
              </Text>
              <Text className="text-nexus-textDim text-xs text-center">
                Fakten werden aus Gesprächen gelernt oder manuell hinzugefügt
              </Text>
            </View>
          ) : (
            myPrivateFacts.map((fact) => (
              <View
                key={fact.id}
                className="bg-nexus-surface border border-nexus-border rounded-xl p-3 mb-2 flex-row items-start gap-3"
              >
                <Text className="text-lg mt-0.5">
                  {CATEGORY_LABELS[fact.category]?.icon || "📝"}
                </Text>
                <View className="flex-1">
                  <Text className="text-nexus-text text-sm">{fact.content}</Text>
                  <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                    <View
                      className="rounded px-1.5 py-0.5"
                      style={{ backgroundColor: "#E5534B25" }}
                    >
                      <Text className="text-[10px] font-medium" style={{ color: "#E5534B" }}>
                        {CATEGORY_LABELS[fact.category]?.label}
                      </Text>
                    </View>
                    <Text className="text-nexus-textDim text-[10px]">
                      {new Date(fact.createdAt).toLocaleDateString("de-DE")}
                    </Text>
                    {fact.source === "chat_extracted" && (
                      <Text className="text-nexus-textDim text-[10px]">• aus Chat</Text>
                    )}
                  </View>
                </View>
                <Pressable onPress={() => handleDelete(fact.id)} className="active:opacity-70 p-1">
                  <Ionicons name="trash-outline" size={16} color="#E5534B" />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Section 2: Familienwissen (Geteilt) */}
        <View className="px-5 pt-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider">
              Familienwissen – Geteilt
            </Text>
            <Pressable
              onPress={openShareModal}
              className="bg-nexus-surface border border-nexus-accent/50 rounded-lg px-2.5 py-1 active:opacity-70"
            >
              <Text className="text-nexus-accent text-[11px] font-semibold">+ Fakt teilen</Text>
            </Pressable>
          </View>

          {/* Facts I'm sharing */}
          {mySharedFacts.length > 0 && (
            <>
              <Text className="text-nexus-textDim text-[10px] uppercase tracking-wider mb-2 ml-1">
                Von mir geteilt
              </Text>
              {mySharedFacts.map((fact) => (
                <View
                  key={fact.id}
                  className="bg-nexus-surface border border-green-500/20 rounded-xl p-3 mb-2 flex-row items-start gap-3"
                >
                  <Text className="text-lg mt-0.5">
                    {CATEGORY_LABELS[fact.category]?.icon || "📝"}
                  </Text>
                  <View className="flex-1">
                    <Text className="text-nexus-text text-sm">{fact.content}</Text>
                    <Text className="text-nexus-textDim text-[10px] mt-1">
                      {new Date(fact.createdAt).toLocaleDateString("de-DE")} • Für Familie sichtbar
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => updateFact(fact.id, { visibility: "private" }).then(loadData)}
                    className="bg-nexus-card rounded-lg px-2 py-1 active:opacity-70"
                  >
                    <Text className="text-nexus-textDim text-[10px]">Nicht mehr teilen</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {/* Facts shared by others */}
          {othersSharedFacts.length > 0 && (
            <>
              <Text className="text-nexus-textDim text-[10px] uppercase tracking-wider mb-2 ml-1 mt-2">
                Von Familie geteilt
              </Text>
              {othersSharedFacts.map((fact) => (
                <View
                  key={fact.id}
                  className="bg-nexus-surface border border-nexus-border rounded-xl p-3 mb-2 flex-row items-start gap-3"
                >
                  <Text className="text-lg mt-0.5">
                    {CATEGORY_LABELS[fact.category]?.icon || "📝"}
                  </Text>
                  <View className="flex-1">
                    <Text className="text-nexus-text text-sm">{fact.content}</Text>
                    <Text className="text-nexus-textDim text-[10px] mt-1">
                      Von {fact.createdBy} • {new Date(fact.createdAt).toLocaleDateString("de-DE")}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {mySharedFacts.length === 0 && othersSharedFacts.length === 0 && (
            <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 items-center">
              <Text className="text-nexus-textDim text-sm">Keine geteilten Fakten</Text>
              <Text className="text-nexus-textDim text-xs mt-1 text-center">
                Teile Infos mit der Familie, z.B. Termine oder Allergien
              </Text>
            </View>
          )}
        </View>

        {/* Privatsphäre */}
        <View className="px-5 pt-5 pb-10">
          <Text className="text-nexus-accent text-xs font-bold uppercase tracking-wider mb-3">
            Privatsphäre
          </Text>
          <View className="bg-nexus-surface border border-nexus-border rounded-2xl overflow-hidden">
            <Pressable
              onPress={() => handleToggleIncognito(!privacy.incognitoMode)}
              className="flex-row items-center justify-between px-4 py-3.5 border-b border-nexus-border"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-lg">👻</Text>
                <View>
                  <Text className="text-nexus-text text-sm font-medium">
                    Inkognito-Modus
                  </Text>
                  <Text className="text-nexus-textDim text-xs">
                    Nichts wird gespeichert
                  </Text>
                </View>
              </View>
              <View
                className={`w-12 h-7 rounded-full justify-center px-0.5 ${
                  privacy.incognitoMode ? "bg-purple-500" : "bg-nexus-border"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded-full bg-white ${
                    privacy.incognitoMode ? "self-end" : "self-start"
                  }`}
                />
              </View>
            </Pressable>

            <Pressable
              onPress={() => handleToggleMemory(!privacy.memoryEnabled)}
              className="flex-row items-center justify-between px-4 py-3.5 border-b border-nexus-border"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-lg">🧠</Text>
                <View>
                  <Text className="text-nexus-text text-sm font-medium">
                    Gedächtnis aktiviert
                  </Text>
                  <Text className="text-nexus-textDim text-xs">
                    Fakten aus Gesprächen lernen
                  </Text>
                </View>
              </View>
              <View
                className={`w-12 h-7 rounded-full justify-center px-0.5 ${
                  privacy.memoryEnabled ? "bg-nexus-accent" : "bg-nexus-border"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded-full bg-white ${
                    privacy.memoryEnabled ? "self-end" : "self-start"
                  }`}
                />
              </View>
            </Pressable>

            <Pressable
              onPress={handleDeleteAll}
              className="flex-row items-center gap-3 px-4 py-3.5"
            >
              <Ionicons name="trash" size={20} color="#E5534B" />
              <Text className="text-nexus-danger text-sm font-medium">
                Alle meine Daten löschen
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Add Fact Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-nexus-text font-semibold text-lg">
                Fakt hinzufügen
              </Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#9A9A9A" />
              </Pressable>
            </View>

            <TextInput
              value={newContent}
              onChangeText={setNewContent}
              placeholder="Was möchtest du speichern?"
              placeholderTextColor="#555"
              multiline
              className="bg-nexus-surface border border-nexus-border rounded-xl p-3 text-nexus-text text-sm mb-4 min-h-[80px]"
            />

            <Text className="text-nexus-textDim text-xs mb-2 ml-1">
              Kategorie
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {(Object.keys(CATEGORY_LABELS) as FactCategory[]).map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setNewCategory(cat)}
                  className={`flex-row items-center gap-1.5 mr-2 px-3 py-2 rounded-lg ${
                    newCategory === cat
                      ? "bg-nexus-accent/20 border border-nexus-accent"
                      : "bg-nexus-surface border border-nexus-border"
                  }`}
                >
                  <Text className="text-sm">{CATEGORY_LABELS[cat].icon}</Text>
                  <Text
                    className={`text-xs ${
                      newCategory === cat ? "text-nexus-accent" : "text-nexus-textDim"
                    }`}
                  >
                    {CATEGORY_LABELS[cat].label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-nexus-textDim text-xs mb-2 ml-1">
              Sichtbarkeit
            </Text>
            <View className="flex-row gap-2 mb-5">
              {(Object.keys(VISIBILITY_LABELS) as FactVisibility[]).map((vis) => (
                <Pressable
                  key={vis}
                  onPress={() => setNewVisibility(vis)}
                  className={`flex-1 items-center py-2 rounded-lg border ${
                    newVisibility === vis
                      ? "border-nexus-accent bg-nexus-accent/10"
                      : "border-nexus-border bg-nexus-surface"
                  }`}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color:
                        newVisibility === vis
                          ? VISIBILITY_LABELS[vis].color
                          : "#9A9A9A",
                    }}
                  >
                    {VISIBILITY_LABELS[vis].label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleAddFact}
              className="bg-nexus-accent rounded-xl py-3 items-center active:opacity-80"
            >
              <Text className="text-nexus-bg font-bold text-sm">
                Speichern
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
