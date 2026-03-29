import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Skill,
  SkillCategory,
  SKILL_CATEGORIES,
  loadSkills,
  saveSkills,
  setActiveSkill,
} from "../../store/skills";
import { useAuth } from "../../store/AuthContext";

function StarRating({ rating }: { rating: number }) {
  return (
    <View className="flex-row items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? "star" : "star-outline"}
          size={10}
          color="#D4A574"
        />
      ))}
      <Text className="text-nexus-textDim text-[10px] ml-1">
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

export default function SkillStoreScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<SkillCategory | null>(null);

  useEffect(() => {
    loadSkills().then(setSkills);
  }, []);

  const filtered = useMemo(() => {
    let result = skills;
    if (selectedCategory) {
      result = result.filter((s) => s.category === selectedCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [skills, search, selectedCategory]);

  const installed = skills.filter((s) => s.isInstalled);

  const toggleInstall = async (skill: Skill) => {
    const updated = skills.map((s) =>
      s.id === skill.id ? { ...s, isInstalled: !s.isInstalled, isActive: false } : s
    );
    setSkills(updated);
    await saveSkills(updated);
    if (skill.isInstalled && user) {
      await setActiveSkill(user.username, null);
    }
  };

  const activateSkill = async (skill: Skill) => {
    if (!user) return;
    const updated = skills.map((s) => ({
      ...s,
      isActive: s.id === skill.id,
    }));
    setSkills(updated);
    await saveSkills(updated);
    await setActiveSkill(user.username, { ...skill, isActive: true });
    router.back();
  };

  const renderSkill = ({ item }: { item: Skill }) => (
    <View className="bg-nexus-surface border border-nexus-border rounded-2xl p-4 mb-3 mx-5">
      <View className="flex-row items-start gap-3">
        <View className="w-12 h-12 rounded-xl bg-nexus-card items-center justify-center">
          <Text className="text-2xl">{item.icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-nexus-text font-semibold">{item.name}</Text>
          <Text className="text-nexus-textDim text-xs mt-0.5" numberOfLines={2}>
            {item.description}
          </Text>
          <View className="flex-row items-center gap-3 mt-2">
            <StarRating rating={item.rating} />
            {item.source === "official" && (
              <View className="bg-nexus-accent/15 rounded px-1.5 py-0.5">
                <Text className="text-nexus-accent text-[9px] font-bold">
                  OFFIZIELL
                </Text>
              </View>
            )}
          </View>
        </View>
        <View className="gap-1.5">
          <Pressable
            onPress={() => toggleInstall(item)}
            className={`rounded-lg px-3 py-1.5 ${
              item.isInstalled
                ? "bg-nexus-card border border-nexus-border"
                : "bg-nexus-accent"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                item.isInstalled ? "text-nexus-textDim" : "text-nexus-bg"
              }`}
            >
              {item.isInstalled ? "Entfernen" : "Installieren"}
            </Text>
          </Pressable>
          {item.isInstalled && (
            <Pressable
              onPress={() => activateSkill(item)}
              className="bg-nexus-success/20 rounded-lg px-3 py-1.5"
            >
              <Text className="text-nexus-success text-xs font-medium text-center">
                Aktivieren
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-nexus-border">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ECECEC" />
        </Pressable>
        <Text className="text-nexus-text font-semibold text-[17px] flex-1">
          Skill Store
        </Text>
        <Text className="text-nexus-textDim text-xs">
          {installed.length} installiert
        </Text>
      </View>

      {/* Search */}
      <View className="px-5 py-3">
        <View className="flex-row items-center bg-nexus-surface border border-nexus-border rounded-xl px-4 gap-2">
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            className="flex-1 text-nexus-text text-[15px] py-3"
            placeholder="Skills durchsuchen..."
            placeholderTextColor="#555"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#555" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}
      >
        <Pressable
          onPress={() => setSelectedCategory(null)}
          className={`rounded-full px-4 py-2 ${
            !selectedCategory
              ? "bg-nexus-accent"
              : "bg-nexus-surface border border-nexus-border"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              !selectedCategory ? "text-nexus-bg" : "text-nexus-textDim"
            }`}
          >
            Alle
          </Text>
        </Pressable>
        {SKILL_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() =>
              setSelectedCategory(
                selectedCategory === cat.id ? null : cat.id
              )
            }
            className={`rounded-full px-4 py-2 ${
              selectedCategory === cat.id
                ? "bg-nexus-accent"
                : "bg-nexus-surface border border-nexus-border"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                selectedCategory === cat.id
                  ? "text-nexus-bg"
                  : "text-nexus-textDim"
              }`}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Skills List */}
      <FlatList
        data={filtered}
        renderItem={renderSkill}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Ionicons name="search" size={48} color="#353535" />
            <Text className="text-nexus-textDim mt-4">
              Keine Skills gefunden
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
