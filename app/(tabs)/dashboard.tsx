import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

const API = "http://10.47.165.201:8000";
const MY_PHONE = "919969784982";

// The 3 quick actions all save to the same /api/reminders endpoint.
// This just changes the modal copy + success message shown to the user.
type ActionType = "reminder" | "meeting" | "call";

const ACTION_CONFIG: Record<
  ActionType,
  { title: string; successTitle: string; successMsg: string }
> = {
  reminder: {
    title: "🔔 Set Reminder",
    successTitle: "✅ Reminder Set!",
    successMsg: "Your reminder has been created.",
  },
  meeting: {
    title: "📅 Schedule Meeting",
    successTitle: "✅ Meeting Scheduled!",
    successMsg: "Your meeting has been added to your reminders.",
  },
  call: {
    title: "📞 Phone Reminder",
    successTitle: "✅ Phone Reminder Set!",
    successMsg: "We'll call you at the scheduled time.",
  },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function Dashboard() {
  const router = useRouter();
  const [health, setHealth] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: `Hey! 👋\nHope your day is going wonderfully so far. Let's get a head start on your tasks!`,
      time: "Just now",
      isBot: true,
    },
  ]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [reminderModal, setReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);
  const [modalTitle, setModalTitle] = useState("🔔 Set Reminder");
  const [actionType, setActionType] = useState<ActionType>("reminder");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // RN's Modal renders in its own native window on Android, so
  // KeyboardAvoidingView inside a Modal often doesn't actually resize
  // anything there — the keyboard just covers the content instead.
  // Tracking the real keyboard height and pushing the modal card up by
  // that amount works reliably on both platforms.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  const openModal = (type: ActionType) => {
    setActionType(type);
    setModalTitle(ACTION_CONFIG[type].title);
    setReminderText("");
    setReminderTime("");
    setReminderModal(true);
  };

  const QUICK_ACTIONS = [
    {
      icon: "🔔",
      label: "Set a\nReminder",
      onPress: () => openModal("reminder"),
    },
    {
      icon: "📅",
      label: "Schedule\nMeeting",
      onPress: () => openModal("meeting"),
    },
    {
      icon: "✅",
      label: "Tasks",
      onPress: () => router.push("/reminders"),
    },
    {
      icon: "📞",
      label: "Phone\nReminder",
      onPress: () => openModal("call"),
    },
  ];

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, remRes] = await Promise.all([
        fetch(`${API}/health`),
        fetch(`${API}/api/reminders`),
      ]);
      const healthData = await healthRes.json();
      const remData = await remRes.json();
      setHealth(healthData);
      setReminders(
        remData
          .filter((r: any) => !r.sent && r.sent !== 1)
          .slice(0, 3)
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    setupNotifications();

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as any;
        if (data?.type === "REMINDER") {
          handleReminderNotification(data.task, data.phone, data.id);
        }
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        if (data?.type === "REMINDER") {
          handleReminderNotification(data.task, data.phone, data.id);
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const setupNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("reminders", {
          name: "Reminders",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#4CAF50",
          sound: "default",
        });
      }

      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: "8b4f1ef5-9fdd-4328-b789-f44d27b253f5",
      });
      console.log("EXPO PUSH TOKEN:", data);
    } catch (e: any) {
      console.error("Notification setup error:", e);
    }
  };

  const handleReminderNotification = (task: string, phone: string, reminderId?: number) => {
    Alert.alert(
      "⏰ Reminder!",
      task,
      [
        {
          text: "📞 Call Now",
          onPress: () => Linking.openURL(`tel:+${phone}`),
        },
        {
          text: "⏱ Snooze 10 min",
          onPress: () => {
            if (reminderId) {
              snoozeReminder({ id: reminderId });
            } else {
              Alert.alert(
                "Can't snooze",
                "This reminder is missing an ID — open the app and use the Remind in 10 mins button instead."
              );
            }
          },
        },
        { text: "Dismiss", style: "cancel" },
      ],
      { cancelable: false }
    );
  };

  const snoozeReminder = async (reminder: any) => {
    const snoozeTime = new Date(Date.now() + 10 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted = `${snoozeTime.getFullYear()}-${pad(snoozeTime.getMonth() + 1)}-${pad(snoozeTime.getDate())} ${pad(snoozeTime.getHours())}:${pad(snoozeTime.getMinutes())}`;

    try {
      const res = await fetch(`${API}/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remind_at: formatted, sent: false }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }
      Alert.alert("⏱ Snoozed!", "Reminder set for 10 minutes later.");
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not snooze reminder.");
    }
  };

  const createReminder = async () => {
    if (!reminderText.trim()) {
      Alert.alert("Error", "Please enter a task");
      return;
    }
    if (!reminderTime.trim()) {
      Alert.alert("Error", "Please enter a time (e.g. 2026-07-12 14:30)");
      return;
    }

    setSavingReminder(true);
    try {
      const res = await fetch(`${API}/api/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: MY_PHONE,
          task: reminderText.trim(),
          remind_at: reminderTime.trim(),
          recurrence: "none",
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }

      setReminderModal(false);
      setReminderText("");
      setReminderTime("");

      const { successTitle, successMsg } = ACTION_CONFIG[actionType];
      Alert.alert(successTitle, successMsg);

      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save. Please try again.");
    } finally {
      setSavingReminder(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long" });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4CAF50"
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRight}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: health ? "#4CAF50" : "#f44336" },
                ]}
              />
              <Text style={styles.statusText}>
                {health?.reminders_pending ?? 0} rem
              </Text>
            </View>
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickCard}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.quickIcon}>{action.icon}</Text>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Today's Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{today}</Text>
          </View>

          {/* Chat Messages */}
          {chatMessages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.chatBubble,
                msg.isBot ? styles.botBubble : styles.userBubble,
              ]}
            >
              <Text style={styles.chatText}>{msg.text}</Text>
              <Text style={styles.chatTime}>{msg.time}</Text>
            </View>
          ))}

          {/* Upcoming Reminders */}
          {reminders.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming</Text>
              </View>
              <View style={styles.reminderSection}>
                <Text style={styles.reminderSectionTitle}>
                  🔴 {reminders.length} Reminder
                  {reminders.length > 1 ? "s" : ""}
                </Text>
                {reminders.map((r, i) => (
                  <View key={i} style={styles.reminderCard}>
                    <View style={styles.reminderLeft}>
                      <Text style={styles.reminderTime} numberOfLines={1}>
                        {new Date(r.remind_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Kolkata",
                        })}
                      </Text>
                      <View style={styles.reminderDot} />
                    </View>
                    <View style={styles.reminderContent}>
                      <Text style={styles.reminderTask}>{r.task}</Text>
                      {r.recurrence && r.recurrence !== "none" && (
                        <Text style={styles.reminderRecur}>
                          🔁 Recurring Reminder
                        </Text>
                      )}
                      <View style={styles.reminderActions}>
                        <TouchableOpacity
                          style={styles.reminderBtn}
                          onPress={() => snoozeReminder(r)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.reminderBtnText}>
                            ⏱ Remind in 10 mins
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.reminderCancelBtn}
                          onPress={() =>
                            Alert.alert(
                              "Cancel Reminder",
                              `Cancel "${r.task}"?`,
                              [
                                { text: "No", style: "cancel" },
                                {
                                  text: "Yes",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      const res = await fetch(
                                        `${API}/api/reminders/${r.id}`,
                                        { method: "DELETE" }
                                      );
                                      if (!res.ok) {
                                        throw new Error(`Request failed (${res.status})`);
                                      }
                                      fetchData();
                                    } catch (e: any) {
                                      Alert.alert(
                                        "Error",
                                        e?.message || "Could not cancel reminder."
                                      );
                                    }
                                  },
                                },
                              ]
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <Text style={styles.reminderCancelBtnText}>
                            🗑️ Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.callIconBtn}
                      onPress={() => Linking.openURL(`tel:+${r.phone}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 20 }}>📞</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Create Reminder / Meeting / Phone Reminder Modal */}
      <Modal visible={reminderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { marginBottom: keyboardHeight }]}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalLabel}>Task</Text>
            <TextInput
              style={styles.input}
              value={reminderText}
              onChangeText={setReminderText}
              placeholder="e.g. Call doctor"
              placeholderTextColor="#555"
            />
            <Text style={styles.modalLabel}>Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={reminderTime}
              onChangeText={setReminderTime}
              placeholder="e.g. 2026-07-12 14:30"
              placeholderTextColor="#555"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setReminderModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, savingReminder && { opacity: 0.6 }]}
                onPress={createReminder}
                disabled={savingReminder}
              >
                <Text style={styles.modalSaveText}>
                  {savingReminder ? "Saving..." : "Set Reminder"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  inner: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 16,
    paddingTop: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  quickCard: {
    width: "30%",
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 14,
    alignItems: "flex-start",
    minHeight: 80,
  },
  quickIcon: { fontSize: 24, marginBottom: 6 },
  quickLabel: { color: "#ccc", fontSize: 12, lineHeight: 16 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  sectionTitle: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chatBubble: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 16,
    maxWidth: "85%",
  },
  botBubble: {
    backgroundColor: "#1a1a1a",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: "#1a3a1a",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  chatText: { color: "#ddd", fontSize: 14, lineHeight: 20 },
  chatTime: { color: "#555", fontSize: 11, marginTop: 6, textAlign: "right" },
  reminderSection: {
    margin: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
  },
  reminderSectionTitle: {
    color: "#ff6b6b",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  reminderCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  reminderLeft: { alignItems: "center", marginRight: 14, width: 62, paddingTop: 2 },
  reminderTime: {
    color: "#4CAF50",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  reminderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    marginTop: 6,
  },
  reminderContent: { flex: 1 },
  reminderTask: { color: "#fff", fontSize: 15, fontWeight: "600" },
  reminderRecur: { color: "#666", fontSize: 12, marginTop: 2 },
  reminderActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  reminderBtn: {
    backgroundColor: "#222",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  reminderBtnText: { color: "#4CAF50", fontSize: 12, fontWeight: "600" },
  reminderCancelBtn: {
    backgroundColor: "#2b0d0d",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  reminderCancelBtnText: { color: "#ef5350", fontSize: 12, fontWeight: "600" },
  callIconBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  modalLabel: { fontSize: 13, color: "#888", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#fff",
    backgroundColor: "#111",
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
  },
  modalCancelText: { color: "#888", fontWeight: "600" },
  modalSave: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
