import React, { useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import {
  ATTENDANCE_REQUEST_TYPES,
  ATTENDANCE_REQUEST_CATEGORIES,
} from '../lib/attendanceRequestTypes';

/** "Хүсэлтийн төрөл сонгох" bottom sheet — search + ангилалаар бүлэглэсэн жагсаалт. */
export default function RequestTypeSheet({ visible, onClose, onSelect, selectedKey, colors }) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = ATTENDANCE_REQUEST_TYPES.filter((t) =>
      q ? t.label.toLowerCase().includes(q) : true
    );
    const byCategory = {};
    filtered.forEach((t) => {
      if (!byCategory[t.category]) byCategory[t.category] = [];
      byCategory[t.category].push(t);
    });
    return byCategory;
  }, [query]);

  const [pending, setPending] = useState(selectedKey || null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Хүсэлтийн төрөл сонгох</Text>
          <TextInput
            style={[styles.search, { borderColor: colors.border, color: colors.text }]}
            placeholder="Хүсэлтийн төрөл сонгох..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {Object.entries(grouped).map(([category, items]) => (
              <View key={category} style={{ marginBottom: 12 }}>
                <Text style={[styles.categoryLabel, { color: colors.textMuted }]}>
                  {ATTENDANCE_REQUEST_CATEGORIES[category] || category}
                </Text>
                {items.map((item) => {
                  const active = pending === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.row,
                        active && { backgroundColor: colors.primarySoft || 'rgba(0,153,219,0.08)' },
                      ]}
                      onPress={() => setPending(item.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.rowText,
                          { color: active ? colors.primary : colors.text },
                          active && { fontWeight: '700' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.selectBtn, { backgroundColor: colors.primary, opacity: pending ? 1 : 0.5 }]}
            disabled={!pending}
            onPress={() => pending && onSelect(pending)}
          >
            <Text style={[styles.selectText, { color: colors.onPrimary || '#fff' }]}>Сонгох</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(23,23,23,0.48)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14,
  },
  categoryLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginLeft: 4 },
  row: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12 },
  rowText: { fontSize: 15 },
  selectBtn: { marginTop: 8, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  selectText: { fontSize: 16, fontWeight: '700' },
});
