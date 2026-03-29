import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../store/AuthContext";
import {
  Reminder,
  loadReminders,
  addReminder,
  deleteReminder,
  toggleReminder,
} from "../store/reminders";
import SegmentButtons from "../components/SegmentButtons";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (d.toDateString() === now.toDateString()) return `Heute, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Morgen, ${time}`;
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}, ${time}`;
}

export default function RemindersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [newHour, setNewHour] = useState("18");
  const [newMinute, setNewMinute] = useState("00");
  const [newRecurring, setNewRecurring] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");
  const [isTomorrow, setIsTomorrow] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const r = await loadReminders(user.username);
    r.sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    );
    setReminders(r);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!user || !newMessage.trim()) return;
    const date = new Date();
    if (isTomorrow) date.setDate(date.getDate() + 1);
    date.setHours(parseInt(newHour, 10), parseInt(newMinute, 10), 0, 0);
    if (date <= new Date()) date.setDate(date.getDate() + 1);

    await addReminder(
      user.username,
      newMessage.trim(),
      date,
      newRecurring === "none" ? null : newRecurring
    );
    setNewMessage("");
    setModalVisible(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteReminder(user.username, id);
    refresh();
  };

  const handleToggle = async (id: string) => {
    if (!user) return;
    await toggleReminder(user.username, id);
    refresh();
  };

  const now = Date.now();

  const renderReminder = ({ item }: { item: Reminder }) => {
    const isOverdue =
      new Date(item.scheduledFor).getTime() < now && item.isActive;

    return (
      <View
        className={`flex-row items-center mx-5 mb-2 bg-nexus-surface border rounded-xl p-4 ${
          isOverdue ? "border-nexus-danger/50" : "border-nexus-border"
        }`}
      >
        <Pressable onPress={() => handleToggle(item.id)} className="mr-3">
          <Ionicons
            name={
              item.isActive ? "checkmark-circle" : "ellipse-outline"
            }
            size={24}
            color={item.isActive ? "#D4A574" : "#555"}
          />
        </Pressable>
        <View className="flex-1">
          <Text
            className={`text-[15px] ${
              item.isActive ? "text-nexus-text" : "text-nexus-textDim line-through"
            }`}
          >
            {item.message}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Text
              className={`text-xs ${
                isOverdue ? "text-nexus-danger" : "text-nexus-textDim"
              }`}
            >
              {isOverdue ? "Überfällig · " : ""}
              {formatDate(item.scheduledFor)}
            </Text>
            {item.recurring && (
              <View className="bg-nexus-accent/15 rounded px-1.5 py-0.5">
                <Text className="text-nexus-accent text-[9px] font-bold uppercase">
                  {item.recurring === "daily"
                    ? "Täglich"
                    : item.recurring === "weekly"
                    ? "Wöchentlich"
                    : "Monatlich"}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Pressable
          onPress={() => handleDelete(item.id)}
          className="ml-2 p-1"
        >
          <Ionicons name="trash-outline" size={18} color="#E5534B" />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-nexus-bg" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-nexus-border">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ECECEC" />
        </Pressable>
        <Text className="text-nexus-text font-semibold text-[17px] flex-1">
          Erinnerungen
        </Text>
        <Pressable
          onPress={() => setModalVisible(true)}
          className="bg-nexus-accent rounded-lg px-3 py-1.5"
        >
          <Text className="text-nexus-bg text-xs font-semibold">+ Neu</Text>
        </Pressable>
      </View>

      <FlatList
        data={reminders}
        renderItem={renderReminder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 16 }}
        ListEmptyComponent={
          <View className="items-center py-20 px-10">
            <Ionicons name="notifications-outline" size={48} color="#353535" />
            <Text className="text-nexus-text font-medium mt-4">
              Keine Erinnerungen
            </Text>
            <Text className="text-nexus-textDim text-sm mt-2 text-center">
              Sag Nexus: "Erinnere mich morgen um 18 Uhr an..."
            </Text>
          </View>
        }
      />

      {/* New Reminder Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-nexus-bg rounded-t-3xl px-5 pt-5 pb-10">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-nexus-text font-semibold text-lg">
                Neue Erinnerung
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9A9A9A" />
              </Pressable>
            </View>

            <TextInput
              className="bg-nexus-surface border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-[15px] mb-4"
              placeholder="Woran möchtest du erinnert werden?"
              placeholderTextColor="#555"
              value={newMessage}
              onChangeText={setNewMessage}
            />

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-nexus-textDim text-xs mb-2">Stunde</Text>
                <TextInput
                  className="bg-nexus-surface border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-center text-lg"
                  value={newHour}
                  onChangeText={setNewHour}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text className="text-nexus-text text-2xl self-end pb-3">:</Text>
              <View className="flex-1">
                <Text className="text-nexus-textDim text-xs mb-2">Minute</Text>
                <TextInput
                  className="bg-nexus-surface border border-nexus-border rounded-xl px-4 py-3 text-nexus-text text-center text-lg"
                  value={newMinute}
                  onChangeText={setNewMinute}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View className="flex-1">
                <Text className="text-nexus-textDim text-xs mb-2">Tag</Text>
                <SegmentButtons
                  options={[
                    { value: "today", label: "Heute" },
                    { value: "tomorrow", label: "Morgen" },
                  ]}
                  value={isTomorrow ? "tomorrow" : "today"}
                  onChange={(v) => setIsTomorrow(v === "tomorrow")}
                />
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-nexus-textDim text-xs mb-2">
                Wiederholung
              </Text>
              <SegmentButtons
                options={[
                  { value: "none", label: "Einmalig" },
                  { value: "daily", label: "Täglich" },
                  { value: "weekly", label: "Wöchentl." },
                  { value: "monthly", label: "Monatl." },
                ]}
                value={newRecurring}
                onChange={setNewRecurring}
              />
            </View>

            <Pressable
              onPress={handleAdd}
              disabled={!newMessage.trim()}
              className={`rounded-xl py-3.5 items-center ${
                newMessage.trim() ? "bg-nexus-accent" : "bg-nexus-card"
              }`}
            >
              <Text
                className={`font-semibold ${
                  newMessage.trim() ? "text-nexus-bg" : "text-nexus-textDim"
                }`}
              >
                Erinnerung erstellen
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
