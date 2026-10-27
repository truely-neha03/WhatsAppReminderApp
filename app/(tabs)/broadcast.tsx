import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const API = "http://10.47.165.201:8000";
const MY_PHONE = "919969784982";

type Contact = { phone: string; name: string };
type BroadcastHistory = { message: string; sent_to: number; time: string };

export default function Broadcast() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/contacts/${MY_PHONE}`);
      setContacts(res.data);
      setSelected(res.data.map((c: Contact) => c.phone));
    } catch {}
  }, []);

  useEffect(() => { fetchContacts(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
    setRefreshing(false);
  };

  const toggleContact = (phone: string) => {
    setSelected((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
    );
  };

  const selectAll = () => setSelected(contacts.map((c) => c.phone));
  const deselectAll = () => setSelected([]);

  const sendBroadcast = async () => {
    if (!message.trim()) { Alert.alert("Error", "Please enter a message"); return; }
    if (selected.length === 0) { Alert.alert("Error", "Please select at least one contact"); return; }

    Alert.alert("Send Broadcast", `Send to ${selected.length} contact(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: async () => {
          setSending(true);
          try {
            await axios.post(`${API}/api/broadcast`, {
              owner: MY_PHONE,
              message: message.trim(),
              phones: selected,
            });
            setHistory((prev) => [
              { message: message.trim(), sent_to: selected.length, time: new Date().toLocaleTimeString("en-IN") },
              ...prev,
            ]);
            setMessage("");
            Alert.alert("✅ Broadcast Sent!", `Message sent to ${selected.length} contact(s)`);
          } catch {
            Alert.alert("Error", "Broadcast failed. Please try again.");
          }
          setSending(false);
        },
      },
    ]);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const COLORS = ["#25D366", "#128C7E", "#075E54", "#34B7F1", "#FF6B6B"];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#25D366"]} />
      }
    >
      {/* Message Input */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📝 Message</Text>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type your broadcast message here..."
          placeholderTextColor="#555"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{message.length} characters</Text>
      </View>

      {/* Contacts Selection */}
      <View style={styles.card}>
        <View style={styles.contactsHeader}>
          <Text style={styles.cardTitle}>👥 Send To</Text>
          <View style={styles.selectBtns}>
            <TouchableOpacity onPress={selectAll}>
              <Text style={styles.selectBtn}>All</Text>
            </TouchableOpacity>
            <Text style={styles.selectDivider}>|</Text>
            <TouchableOpacity onPress={deselectAll}>
              <Text style={styles.selectBtn}>None</Text>
            </TouchableOpacity>
          </View>
        </View>

        {contacts.length === 0 && (
          <Text style={styles.emptyText}>No contacts yet. Add contacts in the Contacts tab.</Text>
        )}

        {contacts.map((c, i) => (
          <TouchableOpacity
            key={c.phone}
            style={[styles.contactRow, selected.includes(c.phone) && styles.contactRowSelected]}
            onPress={() => toggleContact(c.phone)}
          >
            <View style={[styles.avatar, { backgroundColor: COLORS[i % COLORS.length] }]}>
              <Text style={styles.avatarText}>{getInitials(c.name)}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>+{c.phone}</Text>
            </View>
            <View style={[styles.checkbox, selected.includes(c.phone) && styles.checkboxSelected]}>
              {selected.includes(c.phone) && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendBtn, (sending || selected.length === 0) && styles.sendBtnDisabled]}
        onPress={sendBroadcast}
        disabled={sending || selected.length === 0}
      >
        <Text style={styles.sendBtnText}>
          {sending ? "⏳ Sending..." : `📢 Send to ${selected.length} Contact(s)`}
        </Text>
      </TouchableOpacity>

      {/* History */}
      {history.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📜 Recent Broadcasts</Text>
          {history.map((h, i) => (
            <View key={i} style={styles.historyItem}>
              <Text style={styles.historyMsg}>"{h.message}"</Text>
              <Text style={styles.historyMeta}>✅ Sent to {h.sent_to} contacts • {h.time}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  card: {
    backgroundColor: "#1a1a1a",
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 12 },
  messageInput: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#fff",
    backgroundColor: "#111",
    minHeight: 100,
  },
  charCount: { fontSize: 12, color: "#555", textAlign: "right", marginTop: 6 },
  contactsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectBtns: { flexDirection: "row", alignItems: "center", gap: 6 },
  selectBtn: { color: "#25D366", fontWeight: "600", fontSize: 14 },
  selectDivider: { color: "#444" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#111",
  },
  contactRowSelected: { backgroundColor: "#0d2b0d" },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  contactPhone: { fontSize: 12, color: "#666" },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: "#444",
    justifyContent: "center", alignItems: "center",
  },
  checkboxSelected: { backgroundColor: "#25D366", borderColor: "#25D366" },
  checkmark: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sendBtn: {
    backgroundColor: "#25D366", margin: 16, borderRadius: 14,
    padding: 16, alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#1a3a1a" },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  emptyText: { color: "#555", fontSize: 14, textAlign: "center", padding: 16 },
  historyItem: {
    backgroundColor: "#111", borderRadius: 10, padding: 12, marginBottom: 8,
  },
  historyMsg: { fontSize: 14, color: "#ddd", fontWeight: "500" },
  historyMeta: { fontSize: 12, color: "#555", marginTop: 4 },
});
