import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, ScreenHeader, EmptyState, Button } from '../components/ui';
import BarcodeScanner from '../components/BarcodeScanner';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';
import * as boxApi from '../services/boxService';
import { canManageInventory } from '../lib/roles';

/**
 * Хайрцгийн жагсаалт + QR уншуулах.
 *
 * Гол хэрэглээ нь ЖАГСААЛТААС хайх биш — агуулахад зогсоод хайрцгийн
 * QR-ыг уншуулах. Тиймээс уншуулах товч хамгийн дээр, том байрлана.
 */
export default function BoxesScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud, currentUser } = useApp();
  const canManage = canManageInventory(currentUser?.role);

  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', location: '' });

  const load = useCallback(async () => {
    if (!isCloud || !canManage) {
      setLoading(false);
      return;
    }
    try {
      setBoxes(await boxApi.fetchBoxes());
    } catch (e) {
      Alert.alert('Хайрцаг', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isCloud, canManage]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openBox = (code) => navigation.navigate('BoxDetail', { code });

  const onScanned = (raw) => {
    setScanning(false);
    const code = boxApi.parseQr(raw);
    if (!code) {
      Alert.alert('QR', 'Код уншигдсангүй.');
      return;
    }
    openBox(code);
  };

  const createBox = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      Alert.alert('Хайрцаг', 'Код болон нэрийг бөглөнө үү.');
      return;
    }
    try {
      await boxApi.upsertBox(form);
      setCreating(false);
      setForm({ code: '', name: '', location: '' });
      await load();
    } catch (e) {
      Alert.alert('Хайрцаг', e.message);
    }
  };

  // Хайрцгийн бүртгэл нь ЗӨВХӨН админы үүрэг. Нүүр цэснээс нуусан ч
  // навигацийн нэрээр шууд орох боломж үлддэг тул дэлгэц дээр нь ч
  // хаалт тавина — UI-д нуух нь хамгаалалт биш.
  if (!canManage) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Хайрцаг" />
        <EmptyState text="Энэ хэсэг зөвхөн админд нээлттэй. Бараа авахын тулд Бараа материал эсвэл Багаж хэсгээр орж, админаас олгуулна уу." />
      </View>
    );
  }

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Хайрцаг" />
        <EmptyState text="Supabase холболт шаардлагатай." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Хайрцаг"
        subtitle={`${boxes.length} хайрцаг`}
        right={
          canManage ? (
            <TouchableOpacity onPress={() => setCreating(true)} hitSlop={10}>
              <Ionicons name="add-circle" size={26} color={colors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      <TouchableOpacity style={styles.scanBtn} onPress={() => setScanning(true)} activeOpacity={0.85}>
        <Ionicons name="qr-code-outline" size={26} color={colors.onPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.scanTitle}>QR уншуулах</Text>
          <Text style={styles.scanHint}>Хайрцаг дээрх кодыг уншуулж агуулгыг харна</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.onPrimary} />
      </TouchableOpacity>

      <FlatList
        data={boxes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.75} onPress={() => openBox(item.code)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.boxIcon}>
                  <Ionicons name="cube" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.code}
                    {item.location ? ` · ${item.location}` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {Number(item.item_kinds) || 0} нэр төрөл · нийт {Number(item.total_qty) || 0} ширхэг
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              text={
                canManage
                  ? 'Хайрцаг бүртгэгдээгүй байна. Баруун дээрх + товчоор нэмнэ үү.'
                  : 'Хайрцаг бүртгэгдээгүй байна.'
              }
            />
          )
        }
      />

      <BarcodeScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={onScanned}
        title="Хайрцгийн QR"
        hint="Хайрцаг дээрх QR кодыг хүрээнд тааруулна уу"
        frameWidth={240}
        frameHeight={240}
      />

      {/* Шинэ хайрцаг */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Шинэ хайрцаг</Text>
            <TextInput
              style={styles.input}
              placeholder="Код (QR дээр бичигдэх) — ж: BOX-001"
              placeholderTextColor={colors.textFaint}
              value={form.code}
              onChangeText={(v) => setForm((f) => ({ ...f, code: v }))}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Нэр — ж: Кабелийн хайрцаг"
              placeholderTextColor={colors.textFaint}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Байршил — ж: 2-р тавиур"
              placeholderTextColor={colors.textFaint}
              value={form.location}
              onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
            />
            <View style={styles.sheetRow}>
              <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setCreating(false)} />
              <Button title="Хадгалах" style={{ flex: 1 }} onPress={createBox} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.primary,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
    },
    scanTitle: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
    scanHint: { color: colors.onPrimary, fontSize: 12, opacity: 0.85, marginTop: 2 },

    card: { marginBottom: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    boxIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { color: colors.text, fontSize: 16, fontWeight: '800' },
    meta: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      gap: spacing.md,
    },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      backgroundColor: colors.bgAlt,
    },
    sheetRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  });
