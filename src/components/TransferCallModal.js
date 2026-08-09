import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { callDisplayId } from '../lib/callSla';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const TRANSFER_TYPES = [
  { key: 'Cancel', label: 'Татгалзах' },
  { key: 'Dahimdah', label: 'Дахимдах' },
];

const CANCEL_REASONS = [
  'Сүлжээ ороогүй',
  'Ил утас татуулахгүй',
  'Ханаа цоолуулахгүй',
  'Дропгүй',
  'Өөрсдөө эргэж холбогдоно',
  'Дроптой',
];

export default function TransferCallModal({ visible, call, onClose, onSubmit }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [type, setType] = useState('Cancel');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType('Cancel');
    setReason('');
    setComment('');
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ type, reason, comment: comment.trim() });
      handleClose();
    } catch (e) {
      setSaving(false);
      Alert.alert('Алдаа', e?.message || 'Шилжүүлэхэд алдаа гарлаа');
    }
  };

  const typeLabel = TRANSFER_TYPES.find((t) => t.key === type)?.label || type;

  const canSubmit = type && reason.trim();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {call ? `${callDisplayId(call)} Ticket-г шилжүүлэх гэж байна.` : 'Шилжүүлэх'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>
              <Text style={styles.req}>* </Text>Төрөл
            </Text>
            <TouchableOpacity style={styles.select} onPress={() => setTypeOpen((v) => !v)}>
              <Text style={styles.selectText}>{typeLabel}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {type === 'Dahimdah' ? (
              <Text style={styles.hint}>
                Таны нэр дээр хэвээр үлдэнэ · өнөөдөр «Дахимдах» гэж харагдана · маргааш 00:00-өөс автоматаар өөр инженер оноогдоно
              </Text>
            ) : null}
            {typeOpen ? (
              <View style={styles.dropdown}>
                {TRANSFER_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={styles.dropItem}
                    onPress={() => {
                      setType(t.key);
                      setTypeOpen(false);
                    }}
                  >
                    <Text style={styles.dropText}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>
              <Text style={styles.req}>* </Text>Шалтгаан
            </Text>
            <TouchableOpacity style={styles.select} onPress={() => setReasonOpen((v) => !v)}>
              <Text style={[styles.selectText, !reason && styles.placeholder]}>
                {reason || 'Сонгоно уу!'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {reasonOpen ? (
              <View style={styles.dropdown}>
                {CANCEL_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={styles.dropItem}
                    onPress={() => {
                      setReason(r);
                      setReasonOpen(false);
                    }}
                  >
                    <Text style={styles.dropText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Тайлбар</Text>
            <TextInput
              style={styles.input}
              placeholder="Тайлбар"
              value={comment}
              onChangeText={setComment}
              multiline
            />

            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Цуцлах</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
                disabled={!canSubmit || saving}
                onPress={submit}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.submitText}>Шилжүүлэх</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, maxHeight: '90%' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md, gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 22 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  req: { color: '#ef4444' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#22c55e',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  selectText: { fontSize: 14, color: colors.text, flex: 1 },
  placeholder: { color: colors.textFaint },
  dropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, marginBottom: spacing.sm },
  dropItem: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dropText: { fontSize: 14, color: colors.text },
  hint: { fontSize: 12, color: '#b45309', marginBottom: spacing.sm, lineHeight: 17, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: spacing.md },
  cancelText: { fontWeight: '700', color: colors.text },
  submitBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderHi,
    minWidth: 120,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { fontWeight: '800', color: colors.text },
});
