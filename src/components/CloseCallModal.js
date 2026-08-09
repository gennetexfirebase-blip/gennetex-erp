import React, { useMemo, useState } from 'react';
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
import { searchEmptyText } from '../lib/erpMessages';
import { suggestMaterialsForCall, estimateMaterialCost } from '../lib/materialSuggest';
import { isFlagOn } from '../lib/featureFlags';

export const CLOSE_TYPES = [
  { key: 'corp', label: 'Корп' },
  { key: 'ger', label: 'Гэр хороолол' },
  { key: 'subcontractor', label: 'Туслан гүйцэтгэгч' },
  { key: 'apartment', label: 'Орон сууц' },
];

export default function CloseCallModal({
  visible,
  callId,
  callType,
  stockItems = [],
  catalogItems = [],
  onClose,
  onSubmit,
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [step, setStep] = useState(1);
  const [programDone, setProgramDone] = useState(false);
  const [customerInformed, setCustomerInformed] = useState(false);
  const [closeType, setCloseType] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [pickItem, setPickItem] = useState('');
  const [pickQty, setPickQty] = useState('1');
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const materialItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const stockMap = {};
    (stockItems || []).forEach((s) => {
      stockMap[s.item_id] = Number(s.quantity) || 0;
    });

    const merged = [];
    const seen = new Set();
    (catalogItems || [])
      .filter((it) => (it.category || 'material') !== 'tool')
      .forEach((it) => {
        if (!it?.id) return;
        seen.add(it.id);
        merged.push({
          id: it.id,
          name: it.name,
          unit: it.unit || 'ширхэг',
          quantity: stockMap[it.id] || 0,
          warehouseQty: Number(it.quantity) || 0,
        });
      });
    (stockItems || [])
      .filter((s) => (s.category || 'material') !== 'tool')
      .forEach((s) => {
        if (seen.has(s.item_id)) return;
        merged.push({
          id: s.item_id,
          name: s.item_name,
          unit: s.unit || 'ширхэг',
          quantity: Number(s.quantity) || 0,
          warehouseQty: 0,
        });
      });

    return merged
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'mn'));
  }, [stockItems, catalogItems, itemSearch]);

  /** Call type-д тохирсон барааны санал (additive) */
  const suggestions = useMemo(() => {
    if (!isFlagOn('materialSuggest')) return [];
    return suggestMaterialsForCall(callType || 'other', catalogItems, stockItems);
  }, [callType, catalogItems, stockItems]);

  const costEstimate = useMemo(
    () => (isFlagOn('callCost') ? estimateMaterialCost(materials, catalogItems) : null),
    [materials, catalogItems]
  );

  const applySuggestion = (s) => {
    const available = getAvailableQty(s.id);
    const qty = Math.max(1, Number(s.qty) || 1);
    if (available > 0 && qty > available) {
      Alert.alert('Хүрэлцэхгүй', `Таны үлдэгдэл ${available} ${s.unit || 'ширхэг'}`);
      return;
    }
    setMaterials((prev) => {
      const ex = prev.find((m) => m.id === s.id);
      if (ex) {
        return prev.map((m) => (m.id === s.id ? { ...m, qty: m.qty + qty, unit: s.unit } : m));
      }
      return [...prev, { id: s.id, name: s.name, qty, unit: s.unit, price: s.price }];
    });
  };

  const getAvailableQty = (itemId) => {
    const stock = (stockItems || []).find((s) => s.item_id === itemId);
    const base = Number(stock?.quantity) || 0;
    const used = materials.find((m) => m.id === itemId)?.qty || 0;
    return Math.max(0, base - used);
  };

  const reset = () => {
    setStep(1);
    setProgramDone(false);
    setCustomerInformed(false);
    setCloseType('');
    setMaterials([]);
    setPickItem('');
    setPickQty('1');
    setItemOpen(false);
    setItemSearch('');
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canNextStep1 = programDone && customerInformed && closeType;

  const findItem = (itemId) =>
    materialItems.find((i) => i.id === itemId) ||
    (stockItems || [])
      .map((s) => ({
        id: s.item_id,
        name: s.item_name,
        unit: s.unit || 'ширхэг',
        quantity: Number(s.quantity) || 0,
      }))
      .find((i) => i.id === itemId) ||
    (catalogItems || [])
      .map((it) => ({
        id: it.id,
        name: it.name,
        unit: it.unit || 'ширхэг',
        quantity: 0,
        warehouseQty: Number(it.quantity) || 0,
      }))
      .find((i) => i.id === itemId);

  const addMaterial = () => {
    const item = findItem(pickItem);
    if (!item) return;
    const qty = Math.max(1, parseInt(pickQty, 10) || 1);
    const available = getAvailableQty(item.id);
    if (available > 0 && qty > available) {
      Alert.alert(
        'Хүрэлцэхгүй',
        `Таны үлдэгдэл ${available} ${item.unit || 'ширхэг'} л байна.`
      );
      return;
    }
    setMaterials((prev) => {
      const ex = prev.find((m) => m.id === item.id);
      if (ex) {
        return prev.map((m) =>
          m.id === item.id ? { ...m, qty: m.qty + qty, unit: item.unit } : m
        );
      }
      return [...prev, { id: item.id, name: item.name, qty, unit: item.unit }];
    });
    setPickItem('');
    setPickQty('1');
    setItemOpen(false);
    setItemSearch('');
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        program_done: programDone,
        customer_informed: customerInformed,
        close_type: closeType,
        materials,
        closed_at: new Date().toISOString(),
      });
      handleClose();
    } catch (e) {
      setSaving(false);
    }
  };

  const typeLabel = CLOSE_TYPES.find((t) => t.key === closeType)?.label || 'Сонгоно уу!';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Захиалгыг хаах</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {step === 1 ? (
            <ScrollView keyboardShouldPersistTaps="handled">
              <CheckRow
                label="Programm-н үйлдлээ бүрэн хийсэн эсэх"
                checked={programDone}
                onPress={() => setProgramDone((v) => !v)}
              />
              <CheckRow
                label="Хэрэглэгчид мэдээлэл бүрэн өгсөн эсэх"
                checked={customerInformed}
                onPress={() => setCustomerInformed((v) => !v)}
              />

              <Text style={styles.fieldLabel}>
                <Text style={styles.req}>* </Text>Төрөл
              </Text>
              <TouchableOpacity style={styles.select} onPress={() => setTypeOpen((v) => !v)}>
                <Text style={[styles.selectText, !closeType && styles.placeholder]}>{typeLabel}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {typeOpen ? (
                <View style={styles.dropdown}>
                  {CLOSE_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      style={styles.dropItem}
                      onPress={() => {
                        setCloseType(t.key);
                        setTypeOpen(false);
                      }}
                    >
                      <Text style={styles.dropText}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View style={styles.footer}>
                <TouchableOpacity style={styles.backBtn} onPress={handleClose}>
                  <Text style={styles.backText}>Буцах</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, !canNextStep1 && styles.primaryDisabled]}
                  disabled={!canNextStep1}
                  onPress={() => setStep(2)}
                >
                  <Text style={styles.primaryText}>Үргэлжлүүлэх</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Бараа материал</Text>
              <Text style={styles.hint}>
                Бүх бараагаар хайж сонгоно. Таны үлдэгдэл байвал захиалга хаахад автоматаар хасагдана.
              </Text>
              {materials.map((m) => (
                <View key={m.id} style={styles.matRow}>
                  <Text style={styles.matName}>{m.name}</Text>
                  <Text style={styles.matQty}>× {m.qty} {m.unit || ''}</Text>
                  <TouchableOpacity onPress={() => setMaterials((p) => p.filter((x) => x.id !== m.id))}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.select} onPress={() => setItemOpen((v) => !v)}>
                <Text style={[styles.selectText, !pickItem && styles.placeholder]}>Бараа сонгох</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {itemOpen ? (
                <View style={styles.itemListWrap}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Хайх..."
                    value={itemSearch}
                    onChangeText={setItemSearch}
                  />
                  <ScrollView
                    style={styles.itemList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                  >
                    {materialItems.length === 0 ? (
                      <Text style={styles.emptyList}>{searchEmptyText(itemSearch, 'Бараа бүртгэл алга')}</Text>
                    ) : (
                      materialItems.map((it) => {
                        const left = getAvailableQty(it.id);
                        return (
                          <TouchableOpacity
                            key={it.id}
                            style={[styles.dropItem, pickItem === it.id && styles.dropItemActive]}
                            onPress={() => {
                              setPickItem(it.id);
                              setPickQty('1');
                              setItemOpen(false);
                            }}
                          >
                            <Text style={styles.dropText} numberOfLines={2}>{it.name}</Text>
                            <Text style={styles.dropSub}>
                              Миний: {left} {it.unit}
                              {it.warehouseQty != null ? ` · Агуулах: ${it.warehouseQty} ${it.unit}` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              ) : null}

              {pickItem ? (
                <Text style={styles.pickHint}>
                  Сонгосон: {findItem(pickItem)?.name || '—'} · миний үлдэгдэл{' '}
                  {getAvailableQty(pickItem)} {findItem(pickItem)?.unit || ''}
                  {getAvailableQty(pickItem) <= 0 ? ' (зөвхөн бүртгэнэ)' : ''}
                </Text>
              ) : null}

              <View style={styles.addRow}>
                <TextInput
                  style={styles.qtyInput}
                  placeholder="Тоо"
                  keyboardType="number-pad"
                  value={pickQty}
                  onChangeText={setPickQty}
                />
                <TouchableOpacity
                  style={[styles.addBtn, !pickItem && styles.primaryDisabled]}
                  disabled={!pickItem}
                  onPress={addMaterial}
                >
                  <Text style={styles.addBtnText}>+ Нэмэх</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                  <Text style={styles.backText}>Буцах</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Захиалга хаах</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CheckRow({ label, checked, onPress }) {
  const styles = useStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkLabel: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
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
  dropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, marginBottom: spacing.md },
  itemListWrap: { marginBottom: spacing.sm },
  itemList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, maxHeight: 240 },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 6,
  },
  emptyList: { padding: 16, textAlign: 'center', color: colors.textMuted, fontSize: 13 },
  dropItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropItemActive: { backgroundColor: colors.successSoft },
  dropText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  dropSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
  pickHint: { fontSize: 12, color: '#166534', marginBottom: spacing.sm, fontWeight: '600' },
  matRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  matName: { flex: 1, fontSize: 13, color: colors.text },
  matQty: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  qtyInput: {
    width: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: { flex: 1, backgroundColor: '#22c55e', borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderHi,
  },
  backText: { fontWeight: '700', color: colors.text },
  primaryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: '#22c55e',
    minWidth: 140,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
