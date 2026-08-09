import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CUSTOMER_FILTERS,
  JOB_TYPE_FILTERS,
  STATUS_FILTERS,
  US_GREEN,
  US_SELECT_BG,
  ZONE_FILTERS,
  filterCode,
  filterLabel,
} from '../lib/callStatusColors';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const SECTIONS = [
  { id: 'customerType', title: 'Харилцагчийн төрөл сонгоно уу', items: CUSTOMER_FILTERS },
  { id: 'zone', title: 'Бүс сонгоно уу :', items: ZONE_FILTERS },
  { id: 'status', title: 'Төлөв сонгоно уу :', items: STATUS_FILTERS, statusStyle: true },
  { id: 'jobType', title: 'Ажлын төрөл сонгоно уу :', items: JOB_TYPE_FILTERS },
];

function StatusIcon({ item }) {
  const styles = useStyles(makeStyles);
  if (item.key === 'all') {
    return (
      <View style={[styles.codeCircle, { borderColor: US_GREEN }]}>
        <Text style={[styles.codeText, { color: US_GREEN }]}>A</Text>
      </View>
    );
  }
  return (
    <View style={[styles.codeCircle, { borderColor: item.color }]}>
      <Text style={[styles.codeText, { color: item.color, fontSize: item.code.length > 2 ? 8 : 10 }]}>
        {item.code}
      </Text>
    </View>
  );
}

function FilterDropdown({ title, items, value, onChange, statusStyle }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.key === value) || items[0];

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <TouchableOpacity
        style={[styles.select, open && styles.selectOpen]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
      >
        {statusStyle ? (
          <StatusIcon item={selected} />
        ) : (
          <View style={[styles.codeCircle, { borderColor: '#bdbdbd' }]}>
            <Text style={styles.codeText}>{selected.code || 'A'}</Text>
          </View>
        )}
        <Text style={styles.selectLabel}>{selected.label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {open ? (
        <ScrollView style={styles.menu} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {items.map((item) => {
            const active = item.key === value;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuRow, active && { backgroundColor: US_SELECT_BG }]}
                onPress={() => {
                  onChange(item.key);
                  setOpen(false);
                }}
              >
                {statusStyle ? (
                  <StatusIcon item={item} />
                ) : (
                  <View style={[styles.codeCircle, { borderColor: item.key === 'all' ? US_GREEN : '#90caf9' }]}>
                    <Text style={[styles.codeText, item.key !== 'all' && { color: '#1976d2' }]}>
                      {item.code || 'A'}
                    </Text>
                  </View>
                )}
                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function CallFilterModal({ visible, filters, onChange, onClose }) {
  const styles = useStyles(makeStyles);
  const set = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {SECTIONS.map((sec) => (
              <FilterDropdown
                key={sec.id}
                title={sec.title}
                items={sec.items}
                value={filters[sec.id]}
                onChange={(v) => set(sec.id, v)}
                statusStyle={sec.statusStyle}
              />
            ))}
            <TouchableOpacity style={styles.applyBtn} onPress={onClose}>
              <Text style={styles.applyText}>Хэрэглэх</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export { filterCode, filterLabel };

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  block: { marginBottom: spacing.md },
  blockTitle: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: '600' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainerLow,
  },
  selectOpen: { borderColor: US_GREEN, borderWidth: 1.5 },
  selectLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  menu: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    maxHeight: 220,
    backgroundColor: colors.surface,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuLabel: { flex: 1, fontSize: 14, color: colors.text },
  menuLabelActive: { fontWeight: '700' },
  codeCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  codeText: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  applyBtn: {
    marginTop: spacing.sm,
    backgroundColor: US_GREEN,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
