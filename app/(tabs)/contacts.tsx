import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Alert,
  Modal, TextInput, Linking, Keyboard, Platform,
} from 'react-native';
import axios from 'axios';

const API = "http://10.47.165.201:8000";
const MY_PHONE = '919969784982';

type Contact = { phone: string; name: string };

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // RN's Modal renders in its own native window on Android, so
  // KeyboardAvoidingView inside a Modal often doesn't actually resize
  // anything there — the keyboard just covers the content instead.
  // Tracking the real keyboard height and pushing the modal card up by
  // that amount works reliably on both platforms.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

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

  const fetchContacts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/contacts/${MY_PHONE}`);
      setContacts(res.data);
    } catch (e) {
      console.error('Contacts fetch failed:', e);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
    setRefreshing(false);
  };

  const addContact = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please enter both name and phone number');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/api/contacts`, {
        owner: MY_PHONE,
        phone: phone.replace(/\D/g, ''),
        name: name.trim(),
      });
      setAddModal(false);
      setName('');
      setPhone('');
      fetchContacts();
    } catch {
      Alert.alert('Error', 'Could not add contact');
    }
    setSaving(false);
  };

  const removeContact = async (c: Contact) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${c.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API}/api/contacts/${MY_PHONE}/${c.phone}`);
              fetchContacts();
            } catch {
              Alert.alert('Error', 'Could not remove contact');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#FF6B6B'];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
        <Text style={styles.addBtnText}>+ Add Contact</Text>
      </TouchableOpacity>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#25D366']} />}
      >
        {contacts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptySubtitle}>Add contacts to send broadcast messages</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {contacts.length} Contact{contacts.length !== 1 ? 's' : ''}
        </Text>

        {contacts.map((c, i) => (
          <View key={c.phone} style={styles.contactCard}>
            <View style={[styles.avatar, { backgroundColor: COLORS[i % COLORS.length] }]}>
              <Text style={styles.avatarText}>{getInitials(c.name)}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>+{c.phone}</Text>
            </View>
            <View style={styles.contactActions}>
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => Linking.openURL(`https://wa.me/${c.phone}`)}
              >
                <Text style={styles.whatsappBtnText}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.callIconBtn}
                onPress={() => Linking.openURL(`tel:+${c.phone}`)}
              >
                <Text style={styles.callIconBtnText}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeContact(c)}
              >
                <Text style={styles.removeBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { marginBottom: keyboardHeight }]}>
            <Text style={styles.modalTitle}>👤 Add Contact</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              placeholderTextColor="#555"
            />
            <Text style={styles.modalLabel}>Phone (with country code)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="919876543210"
              placeholderTextColor="#555"
              keyboardType="phone-pad"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, saving && { opacity: 0.6 }]}
                onPress={addContact}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>{saving ? 'Saving...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  addBtn: {
    backgroundColor: '#25D366', margin: 16, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sectionTitle: { fontSize: 13, color: '#555', fontWeight: '600', marginLeft: 16, marginBottom: 8 },
  contactCard: {
    backgroundColor: '#1a1a1a', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center',
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  contactPhone: { fontSize: 13, color: '#666', marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 8 },
  whatsappBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0d2b0d', justifyContent: 'center', alignItems: 'center',
  },
  whatsappBtnText: { fontSize: 16 },
  callIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0d1a2b', justifyContent: 'center', alignItems: 'center',
  },
  callIconBtnText: { fontSize: 16 },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2b0d0d', justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { fontSize: 16 },
  emptyContainer: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  modalLabel: { fontSize: 13, color: '#888', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#333', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#fff', backgroundColor: '#111',
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalSave: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#25D366', alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontWeight: '700' },
});
