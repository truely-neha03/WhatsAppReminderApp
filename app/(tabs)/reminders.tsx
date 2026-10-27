import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const API = "http://10.47.165.201:8000";
const MY_PHONE = "919969784982";
const TZ = "Asia/Kolkata";

const CALL_STATUS_COLORS: Record<string, string> = {
  Pending: "#FF9800",
  Completed: "#4CAF50",
  Missed: "#f44336",
  Rescheduled: "#2196F3",
};

// remind_at from the backend is an ISO 8601 string with IST offset,
// e.g. "2026-03-07T08:37:00+05:30" — always parse via `new Date(...)`
// and format explicitly in Asia/Kolkata so it's correct regardless of
// device timezone or JS engine quirks.

const dateKey = (iso: string) => {
  // stable YYYY-MM-DD grouping key in IST
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // en-CA -> YYYY-MM-DD
};

const formatDateHeader = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
  const timePart = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
  return `${datePart}, ${timePart}`;
};

// Convert an ISO string to "YYYY-MM-DD HH:MM" (IST) for the edit input,
// since that's the format the backend's create/parse logic expects.
const toEditableFormat = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
};

export default function Reminders() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [editModal, setEditModal] = useState(false);
  const [editTask, setEditTask] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
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

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/reminders`);
      const data = await res.json();
      setReminders(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReminders();
    setRefreshing(false);
  };

  const cancelReminder = (id: number, task: string) => {
    Alert.alert("Cancel Reminder", `Cancel "${task}"?`, [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${API}/api/reminders/${id}`, { method: "DELETE" });
            fetchReminders();
            Alert.alert("✅ Cancelled", "Reminder has been removed.");
          } catch {
            Alert.alert("Error", "Could not cancel reminder.");
          }
        },
      },
    ]);
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
      fetchReminders();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not snooze reminder.");
    }
  };

  const callContact = (phone: string) => {
    Linking.openURL(`tel:+${phone}`).catch(() =>
      Alert.alert("Error", "Could not open phone dialer.")
    );
  };

  const saveEdit = async () => {
    if (!editTask.trim()) {
      Alert.alert("Error", "Please enter a task");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/reminders/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: editTask, remind_at: editTime }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }
      setEditModal(false);
      fetchReminders();
      Alert.alert("✅ Updated!", "Reminder has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not update reminder.");
    }
    setSaving(false);
  };

  // Fix: handle null/0/false for sent field
  const filtered = reminders.filter((r) =>
    filter === "all"
      ? true
      : filter === "pending"
      ? !r.sent || r.sent === 0 || r.sent === null
      : r.sent === true || r.sent === 1
  );

  // Group by date (IST calendar day, not device-local day)
  const grouped: Record<string, any[]> = {};
  filtered.forEach((r) => {
    const key = r.remind_at ? dateKey(r.remind_at) : "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {["all", "pending", "done"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f === "all" ? "All" : f === "pending" ? "⏳ Pending" : "✅ Done"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4CAF50"
          />
        }
      >
        {filtered.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No reminders</Text>
            <Text style={styles.emptySubtitle}>
              Set reminders via WhatsApp bot
            </Text>
          </View>
        )}

        {Object.entries(grouped).map(([key, items]) => (
          <View key={key}>
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>
                📅 {items[0]?.remind_at ? formatDateHeader(items[0].remind_at) : "Unknown"} ({items.length})
              </Text>
            </View>
            {items.map((r) => (
              <View
                key={r.id}
                style={[styles.reminderCard, r.sent && { opacity: 0.6 }]}
              >
                {/* Call Status Badge */}
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.callBadge,
                      {
                        backgroundColor:
                          CALL_STATUS_COLORS[r.call_status || "Pending"] + "25",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.callBadgeText,
                        {
                          color: CALL_STATUS_COLORS[r.call_status || "Pending"],
                        },
                      ]}
                    >
                      📞 {r.call_status || "Pending"}
                    </Text>
                  </View>
                  {r.recurrence && r.recurrence !== "none" && (
                    <View style={styles.recurBadge}>
                      <Text style={styles.recurText}>🔁 {r.recurrence}</Text>
                    </View>
                  )}
                  {r.sent ? (
                    <View style={styles.doneBadge}>
                      <Text style={styles.doneText}>✅ Done</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.taskText}>{r.task}</Text>
                <Text style={styles.timeText}>
                  ⏰ {r.remind_at ? formatDateTime(r.remind_at) : "—"}
                </Text>
                <Text style={styles.phoneText}>📱 +{r.phone}</Text>

                {/* Action Buttons - always show call, edit/snooze/cancel only for pending */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => callContact(r.phone)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.callBtnText}>📞 Call</Text>
                  </TouchableOpacity>

                  {!r.sent && (
                    <>
                      <TouchableOpacity
                        style={styles.snoozeBtn}
                        onPress={() => snoozeReminder(r)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.snoozeBtnText}>⏱ +10 min</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => {
                          setEditId(r.id);
                          setEditTask(r.task);
                          setEditTime(r.remind_at ? toEditableFormat(r.remind_at) : "");
                          setEditModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editBtnText}>✏️ Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => cancelReminder(r.id, r.task)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { marginBottom: keyboardHeight }]}>
            <Text style={styles.modalTitle}>✏️ Edit Reminder</Text>
            <Text style={styles.modalLabel}>Task</Text>
            <TextInput
              style={styles.input}
              value={editTask}
              onChangeText={setEditTask}
              placeholderTextColor="#555"
              placeholder="Enter task..."
            />
            <Text style={styles.modalLabel}>Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={editTime}
              onChangeText={setEditTime}
              placeholderTextColor="#555"
              placeholder="e.g. 2026-06-12 14:30"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, saving && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>
                  {saving ? "Saving..." : "Save"}
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
  filterRow: {
    flexDirection: "row",
    backgroundColor: "#111",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  filterBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  filterActive: { backgroundColor: "#4CAF50" },
  filterText: { fontSize: 13, color: "#666", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0f0f0f",
  },
  dateHeaderText: { color: "#4CAF50", fontSize: 13, fontWeight: "700" },
  reminderCard: {
    backgroundColor: "#111",
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#4CAF50",
  },
  cardTop: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  callBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  callBadgeText: { fontSize: 12, fontWeight: "700" },
  recurBadge: {
    backgroundColor: "#1a237e40",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  recurText: { fontSize: 12, color: "#7986CB", fontWeight: "600" },
  doneBadge: {
    backgroundColor: "#1b5e2040",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  doneText: { fontSize: 12, color: "#4CAF50", fontWeight: "600" },
  taskText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  timeText: { fontSize: 13, color: "#888", marginBottom: 2 },
  phoneText: { fontSize: 13, color: "#555", marginBottom: 8 },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  callBtn: {
    flex: 1,
    backgroundColor: "#1b5e2040",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  callBtnText: { color: "#4CAF50", fontWeight: "600", fontSize: 13 },
  snoozeBtn: {
    flex: 1,
    backgroundColor: "#1a237e40",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  snoozeBtnText: { color: "#7986CB", fontWeight: "600", fontSize: 13 },
  editBtn: {
    flex: 1,
    backgroundColor: "#22222280",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  editBtnText: { color: "#aaa", fontWeight: "600", fontSize: 13 },
  cancelBtn: {
    backgroundColor: "#b71c1c40",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    width: 42,
  },
  cancelBtnText: { color: "#ef5350", fontWeight: "600", fontSize: 13 },
  emptyContainer: { alignItems: "center", padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  emptySubtitle: { fontSize: 14, color: "#555", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#111",
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
  modalLabel: { fontSize: 13, color: "#666", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#fff",
    backgroundColor: "#1a1a1a",
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222",
    alignItems: "center",
  },
  modalCancelText: { color: "#666", fontWeight: "600" },
  modalSave: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
