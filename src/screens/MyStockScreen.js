import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  Card,
  Button,
  Field,
  ScreenHeader,
  HeaderButton,
  EmptyState,
} from '../components/ui';
import InventoryThumb from '../components/InventoryThumb';
import BarcodeScanner from '../components/BarcodeScanner';
import { movementTypeLabel } from '../lib/stockBalance';
import * as invApi from '../services/inventoryService';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

export default function MyStockScreen() {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const category = route.params?.category === 'tool' ? 'tool' : 'material';
  const isTool = category === 'tool';
  const { inventory, isCloud, currentUser, consumeItem, fetchMyStock, getItemByBarcode } = useApp();
  const [balances, setBalances] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [consumeTarget, setConsumeTarget] = useState(null);
  const [consumeQty, setConsumeQty] = useState('1');
  const [scanMode, setScanMode] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const rows = await fetchMyStock();
      setBalances(rows.filter((b) => (b.category || 'material') === category));
    } catch (e) {}
  }, [isCloud, fetchMyStock, category]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalQty = useMemo(
    () => balances.reduce((s, b) => s + Number(b.quantity || 0), 0),
    [balances]
  );

  const openConsume = (item) => {
    setConsumeTarget(item);
    setConsumeQty('1');
  };

  const confirmConsume = async () => {
    const q = Number(consumeQty) || 0;
    if (!consumeTarget || q <= 0) return;
    if (q > consumeTarget.quantity) {
      Alert.alert('Хүрэлцэхгүй', `Таны үлдэгдэл ${consumeTarget.quantity} ${consumeTarget.unit} л байна.`);
      return;
    }
    const item = consumeTarget;
    setConsumeTarget(null);
    try {
      const left = await consumeItem(item, q);
      Alert.alert('Хэрэглэгдлээ', `${item.item_name}\n${q} ${item.unit} хэрэглэв.\nҮлдэгдэл: ${left} ${item.unit}`);
      load();
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Хэрэглэхэд алдаа гарлаа');
    }
  };

  const handleScan = async (code) => {
    setScanMode(false);
    let item = getItemByBarcode(code);
    if (!item && isCloud) {
      try {
        item = await invApi.fetchItemByBarcode(code);
      } catch (e) {}
    }
    if (!item) {
      Alert.alert('Олдсонгүй', `"${code}"кодтой бараа бүртгэлд алга.`);
      return;
    }
    const row = balances.find((b) => b.item_id === item.id);
    if (!row) {
      Alert.alert('Үлдэгдэлгүй', `Танд "${item.name}"үлдэгдэл байхгүй байна.`);
      return;
    }
    openConsume(row);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isTool ? 'Миний багаж' : 'Миний бараа'}
        subtitle={`${balances.length} төрөл · ${totalQty.toFixed(totalQty % 1 ? 1 : 0)} нэгж`}
        right={
          <HeaderButton title="Скан" onPress={() => setScanMode(true)} />
        }
      />

      {!isCloud ? (
        <EmptyState text="Supabase холбогдсон байх шаардлагатай."/>
      ) : (
        <FlatList
          data={balances}
          keyExtractor={(it) => it.item_id || it.item_name}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Миний үлдэгдэл</Text>
              <Text style={styles.bannerText}>
                Агуулахаас авсан барааны үлдэгдэл. Ажил дээр хэрэглэхэд «Хэрэглэх» дарна.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const invItem = inventory.find((it) => it.id === item.item_id);
            return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <InventoryThumb
                  name={item.item_name}
                  category={item.category || category}
                  size={46}
                  imageUrl={invItem?.image_url}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.item_name}</Text>
                  <Text style={styles.sub}>{movementTypeLabel('withdraw')} − хэрэглээ = үлдэгдэл</Text>
                </View>
                <View style={styles.qtyPill}>
                  <Text style={styles.qtyNum}>{Number(item.quantity).toFixed(item.quantity % 1 ? 1 : 0)}</Text>
                  <Text style={styles.qtyUnit}>{item.unit}</Text>
                </View>
              </View>
              <Button
                title="Хэрэглэх" variant="success"
                size="sm"
                style={{ marginTop: spacing.md }}
                onPress={() => openConsume(item)}
              />
            </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState text={isTool ? 'Танд багажийн үлдэгдэл алга.' : 'Танд бараа материалын үлдэгдэл алга.\nАгуулахаас жагсаалтаас сонгон авна уу.'}
            />
          }
        />
      )}

      <Modal visible={consumeTarget !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Хэрэглэх</Text>
            {consumeTarget ? (
              <>
                <Text style={styles.takeName}>{consumeTarget.item_name}</Text>
                <Text style={styles.takeSub}>
                  Таны үлдэгдэл: {consumeTarget.quantity} {consumeTarget.unit}
                </Text>
                <Field
                  label={`Хэрэглэх тоо (${consumeTarget.unit})`}
                  placeholder="1"
                  keyboardType="numeric"
                  value={consumeQty}
                  onChangeText={setConsumeQty}
                />
                <View style={styles.modalActions}>
                  <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setConsumeTarget(null)} />
                  <Button title="Хэрэглэх" variant="success" style={{ flex: 1 }} onPress={confirmConsume} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <BarcodeScanner
        visible={scanMode}
        onClose={() => setScanMode(false)}
        onScanned={handleScan}
        title={isTool ? 'Багажийн бар код' : 'Барааны бар код'}
        hint="Хэрэглэх барааны кодыг уншуулна уу"
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.xs },
  bannerText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, fontSize: 16, fontWeight: '800'},
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  qtyPill: {
    backgroundColor: colors.success + '18',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 58,
  },
  qtyNum: { color: colors.success, fontSize: 18, fontWeight: '900'},
  qtyUnit: { color: colors.textMuted, fontSize: 10 },
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end'},
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.lg },
  takeName: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  takeSub: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.lg },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
