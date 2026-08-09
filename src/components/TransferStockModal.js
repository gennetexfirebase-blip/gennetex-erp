import React, { useEffect, useMemo, useState } from 'react';
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
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

export default function TransferStockModal({
  visible,
  item,
  holders = [],
  employees = [],
  onClose,
  onSubmit,
}) {
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [qty, setQty] = useState('1');
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const holderOptions = useMemo(
    () =>
      holders
        .filter((h) => h.qty > 0 && h.user_id)
        .map((h) => ({
          id: h.user_id,
          name: h.name,
          qty: h.qty,
        })),
    [holders]
  );

  const toOptions = useMemo(
    () =>
      employees
        .filter((e) => e.id && e.id !== fromUserId)
        .map((e) => ({ id: e.id, name: e.name || e.email || 'Ажилтан' })),
    [employees, fromUserId]
  );

  const fromHolder = holderOptions.find((h) => h.id === fromUserId);
  const maxQty = fromHolder?.qty || 0;

  useEffect(() => {
    if (!visible) return;
    setFromUserId(holderOptions[0]?.id || '');
    setToUserId('');
    setQty('1');
    setFromOpen(false);
    setToOpen(false);
    setSaving(false);
  }, [visible, item?.id, holderOptions]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const submit = async () => {
    if (!fromUserId || !toUserId) {
      Alert.alert('Анхаар', 'Эх болон хүлээн авах ажилтнаа сонгоно уу.');
      return;
    }
    const q = Number(qty) || 0;
    if (q <= 0) {
      Alert.alert('Анхаар', 'Тоо хэмжээ оруулна уу.');
      return;
    }
    if (q > maxQty) {
      Alert.alert('Хүрэлцэхгүй', `${fromHolder?.name || 'Ажилтан'}: ${maxQty} ${item?.unit || 'ширхэг'} л байна.`);
      return;
    }
    const fromEmp = holderOptions.find((h) => h.id === fromUserId);
    const toEmp = toOptions.find((e) => e.id === toUserId);
    setSaving(true);
    try {
      await onSubmit({
        fromUserId,
        fromUserName: fromEmp?.name || 'Ажилтан',
        toUserId,
        toUserName: toEmp?.name || 'Ажилтан',
        qty: q,
      });
      onClose();
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Шилжүүлэхэд алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Шилжүүлэх</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSub}>Агуулах хөндөгдөхгүй — ажилтнаас ажилтан руу</Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Эх ажилтан (үлдэгдэлтэй)</Text>
            <TouchableOpacity style={styles.select} onPress={() => setFromOpen((v) => !v)}>
              <Text style={styles.selectText}>{fromHolder?.name || 'Сонгох'}</Text>
              <Ionicons name={fromOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {fromOpen ? (
              <View style={styles.options}>
                {holderOptions.map((h) => (
                  <TouchableOpacity
                    key={h.id}
                    style={styles.option}
                    onPress={() => {
                      setFromUserId(h.id);
                      setFromOpen(false);
                      setQty(String(Math.min(Number(qty) || 1, h.qty)));
                    }}
                  >
                    <Text style={styles.optionText}>{h.name}</Text>
                    <Text style={styles.optionSub}>{h.qty} {item.unit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Хүлээн авах ажилтан</Text>
            <TouchableOpacity style={styles.select} onPress={() => setToOpen((v) => !v)}>
              <Text style={styles.selectText}>
                {toOptions.find((e) => e.id === toUserId)?.name || 'Сонгох'}
              </Text>
              <Ionicons name={toOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {toOpen ? (
              <View style={styles.options}>
                {toOptions.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.option}
                    onPress={() => {
                      setToUserId(e.id);
                      setToOpen(false);
                    }}
                  >
                    <Text style={styles.optionText}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Тоо хэмжээ ({item.unit})</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />
            {fromHolder ? (
              <Text style={styles.hint}>Боломжит: {maxQty} {item.unit}</Text>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submit, saving && styles.submitDisabled]}
            onPress={submit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Шилжүүлэх</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  itemName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  itemSub: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: spacing.md },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
  },
  selectText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  options: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { color: colors.text, fontWeight: '600' },
  optionSub: { color: colors.textMuted, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.bg,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
