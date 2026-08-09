import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { TIME_OPTIONS } from '../lib/timeOptions';
import { spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';

export default function TimeSelect({ label, value, onChange, placeholder = 'Сонгох', allowClear = true }) {
  const [open, setOpen] = useState(false);
  const styles = useStyles(makeStyles);

  const pick = (t) => {
    onChange(t);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.box} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Text style={styles.chev}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label || 'Цаг сонгох'}</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {allowClear ? (
                <TouchableOpacity style={styles.opt} onPress={() => pick('')}>
                  <Text style={[styles.optText, !value && styles.optOn]}>— Амралтгүй</Text>
                </TouchableOpacity>
              ) : null}
              {TIME_OPTIONS.map((t) => (
                <TouchableOpacity key={t} style={styles.opt} onPress={() => pick(t)}>
                  <Text style={[styles.optText, value === t && styles.optOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Хаах</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  wrap: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  value: { color: colors.text, fontSize: 15, fontWeight: '700'},
  placeholder: { color: colors.textMuted, fontWeight: '500'},
  chev: { color: colors.textMuted, fontSize: 12 },
  overlay: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md },
  opt: { paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  optText: { color: colors.text, fontSize: 16, textAlign: 'center'},
  optOn: { color: colors.primary, fontWeight: '800'},
  closeBtn: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm },
  closeText: { color: colors.textMuted, fontWeight: '700' },
});
