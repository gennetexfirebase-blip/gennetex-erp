import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Button, Card, EmptyState, Field, HeaderButton, ScreenHeader, formatMNT } from '../components/ui';
import * as invApi from '../services/inventoryService';
import * as stockExport from '../services/stockExportService';
import { radius, spacing } from '../theme';

const CATEGORY_LABEL = {
  material: 'Бараа материал',
  tool: 'Багаж',
  supply: 'Хангамж',
};

const EMPTY = { itemId: '', quantity: '', unitPrice: '', supplier: '', note: '' };

function parsePositive(value) {
  const number = Number(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parsePrice(value) {
  const number = Number(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export default function InventoryReceiptsScreen() {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { inventory, refreshInventory, isManager, isCloud } = useApp();
  const [category, setCategory] = useState(
    CATEGORY_LABEL[route.params?.category] ? route.params.category : 'material'
  );
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const items = useMemo(
    () => inventory.filter((item) => (item.category || 'material') === category),
    [inventory, category]
  );
  const filteredRows = useMemo(
    () => rows.filter((row) => (row.category || 'material') === category),
    [rows, category]
  );
  const selected = inventory.find((item) => item.id === form.itemId) || null;
  const receiptTotal = (parsePositive(form.quantity) || 0) * (parsePrice(form.unitPrice) || 0);
  const receivedValue = filteredRows.reduce(
    (sum, row) => sum + (Number(row.total_amount) || Number(row.quantity) * Number(row.unit_price) || 0),
    0
  );

  const load = useCallback(async () => {
    if (!isCloud || !isManager) return;
    try {
      setRows(await invApi.fetchInventoryReceipts());
    } catch (error) {
      Alert.alert('Орлогын бүртгэл', error?.message || 'Орлогын түүх татагдсангүй.');
    }
  }, [isCloud, isManager]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshInventory?.()]);
    setRefreshing(false);
  };

  const openReceipt = () => {
    const first = items[0];
    setForm({
      ...EMPTY,
      itemId: first?.id || '',
      unitPrice: first ? String(Number(first.price) || 0) : '',
      supplier: first?.supplier || '',
    });
    setModal(true);
  };

  const chooseItem = (item) => {
    setForm((current) => ({
      ...current,
      itemId: item.id,
      unitPrice: String(Number(item.price) || 0),
      supplier: current.supplier || item.supplier || '',
    }));
  };

  const save = async () => {
    const quantity = parsePositive(form.quantity);
    const unitPrice = parsePrice(form.unitPrice);
    if (!selected) return Alert.alert('Орлого', 'Бараа сонгоно уу.');
    if (quantity === null) return Alert.alert('Орлого', 'Орлогын тоо 0-ээс их байна.');
    if (unitPrice === null) return Alert.alert('Орлого', 'Нэгж үнэ 0 буюу түүнээс их байна.');
    setSaving(true);
    try {
      await invApi.receiveInventoryStock({
        itemId: selected.id,
        quantity,
        unitPrice,
        supplier: form.supplier,
        note: form.note,
      });
      setModal(false);
      setForm(EMPTY);
      await Promise.all([load(), refreshInventory?.()]);
      Alert.alert(
        'Орлого авлаа',
        `${selected.name}\n+${quantity} ${selected.unit || 'ширхэг'} · ${formatMNT(quantity * unitPrice)}`
      );
    } catch (error) {
      Alert.alert('Орлого авч чадсангүй', error?.message || 'Дахин оролдоно уу.');
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const receipts = rows.length ? rows : await invApi.fetchInventoryReceipts();
      await stockExport.exportInventoryValueExcel({ inventory, receipts });
    } catch (error) {
      Alert.alert('Excel', error?.message || 'Excel файл гаргаж чадсангүй.');
    } finally {
      setExporting(false);
    }
  };

  if (!isManager) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Агуулахын орлого" />
        <EmptyState text="Энэ хэсэг зөвхөн агуулах удирдах эрхтэй хүнд нээлттэй." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Агуулахын орлого"
        subtitle={CATEGORY_LABEL[category]}
        right={
          <View style={styles.headerActions}>
            <HeaderButton title={exporting ? 'Татаж…' : 'Excel'} onPress={exporting ? undefined : exportExcel} />
            <HeaderButton title="Орлого авах" onPress={openReceipt} />
          </View>
        }
      />

      <View style={styles.tabs}>
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => {
          const active = category === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && styles.tabOn]}
              onPress={() => setCategory(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Орлогын бүртгэл</Text>
          <Text style={styles.summaryValue}>{filteredRows.length}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Нийт дүн</Text>
          <Text style={styles.summaryMoney}>{formatMNT(receivedValue)}</Text>
        </Card>
      </View>

      {!isCloud ? (
        <EmptyState text="Supabase холболт шаардлагатай." />
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <Card style={styles.receiptRow}>
              <View style={styles.receiptIcon}>
                <Ionicons name="arrow-down" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.meta}>
                  {new Date(item.received_at || item.created_at).toLocaleString('mn-MN')}
                </Text>
                <Text style={styles.price}>{formatMNT(item.unit_price)} / {item.unit || 'ширхэг'}</Text>
                {item.supplier ? <Text style={styles.meta}>Нийлүүлэгч: {item.supplier}</Text> : null}
              </View>
              <View style={styles.amountCol}>
                <Text style={styles.qty}>+{item.quantity} {item.unit || 'ш'}</Text>
                <Text style={styles.total}>{formatMNT(item.total_amount)}</Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={<EmptyState text="Орлогын бүртгэл алга байна." />}
        />
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>{CATEGORY_LABEL[category]} — орлого авах</Text>
              <Text style={styles.label}>Бараа сонгох</Text>
              <View style={styles.itemPicker}>
                {items.map((item) => {
                  const active = form.itemId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemOption, active && styles.itemOptionOn]}
                      onPress={() => chooseItem(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionName, active && styles.optionNameOn]}>{item.name}</Text>
                        <Text style={styles.optionMeta}>
                          Үлдэгдэл {item.quantity} {item.unit || 'ш'} · Одоогийн үнэ {formatMNT(item.price)}
                        </Text>
                      </View>
                      {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!items.length ? <Text style={styles.warning}>Эхлээд энэ ангилалд бараа бүртгэнэ үү.</Text> : null}
              <View style={styles.twoCol}>
                <Field
                  label="Орлогын тоо *"
                  keyboardType="numeric"
                  value={form.quantity}
                  onChangeText={(quantity) => setForm((current) => ({ ...current, quantity }))}
                  style={{ flex: 1 }}
                />
                <Field
                  label="Нэгж үнэ (₮) *"
                  keyboardType="numeric"
                  value={form.unitPrice}
                  onChangeText={(unitPrice) => setForm((current) => ({ ...current, unitPrice }))}
                  style={{ flex: 1 }}
                />
              </View>
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Орлогын нийт дүн</Text>
                <Text style={styles.totalBig}>{formatMNT(receiptTotal)}</Text>
              </View>
              <Field
                label="Нийлүүлэгч"
                value={form.supplier}
                onChangeText={(supplier) => setForm((current) => ({ ...current, supplier }))}
              />
              <Field
                label="Тэмдэглэл"
                value={form.note}
                onChangeText={(note) => setForm((current) => ({ ...current, note }))}
                multiline
              />
              <Text style={styles.hint}>
                Хадгалахад үлдэгдэл нэмэгдэж, одоогийн нэгж үнэ жигнэсэн дундаж өртгөөр шинэчлэгдэнэ.
              </Text>
              <View style={styles.actions}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setModal(false)} />
                <Button title="Орлого авах" style={{ flex: 1 }} onPress={save} loading={saving} disabled={saving || !items.length} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  tabTextOn: { color: colors.primary },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  summaryCard: { flex: 1, marginBottom: 0 },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  summaryValue: { color: colors.primary, fontSize: 24, fontWeight: '900', marginTop: 4 },
  summaryMoney: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 8 },
  list: { padding: spacing.lg, paddingBottom: 40 },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  receiptIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.success + '18', alignItems: 'center', justifyContent: 'center' },
  itemName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  price: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  amountCol: { alignItems: 'flex-end', gap: 4 },
  qty: { color: colors.success, fontSize: 14, fontWeight: '900' },
  total: { color: colors.text, fontSize: 12, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000bb' },
  sheet: { maxHeight: '92%', padding: spacing.xl, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: colors.borderHi, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  itemPicker: { gap: spacing.sm, marginBottom: spacing.lg },
  itemOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.md, padding: spacing.md },
  itemOptionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  optionNameOn: { color: colors.primary },
  optionMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  totalBox: { padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.md, marginBottom: spacing.md },
  totalLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  totalBig: { color: colors.primary, fontSize: 21, fontWeight: '900', marginTop: 3 },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: spacing.md },
  warning: { color: colors.warning, fontSize: 12, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
});
