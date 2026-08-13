import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Card, ScreenHeader, EmptyState, Button } from '../components/ui';
import MultiScanSheet from '../components/MultiScanSheet';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';
import * as boxApi from '../services/boxService';
import { canManageInventory } from '../lib/roles';

/**
 * Хайрцгийн агуулга + олголт.
 *
 * ОЛГОЛТЫН УРСГАЛ (нярав хийнэ):
 *   1. "Олгох" дарна            → ажилтны жагсаалт гарна
 *   2. Ажилтнаа сонгоно         → зураасан код уншуулах камер нээгдэнэ
 *   3. Барааны кодыг уншуулна   → ЯГ ТЭР хайрцгаас хасагдана
 *   4. Камер нээлттэй хэвээр    → дараагийн барааг үргэлжлүүлж уншуулна
 *
 * 4-р алхам чухал: ажилтанд 5 зүйл олгоход камерыг 5 удаа нээх нь удаан.
 */
export default function BoxDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { code } = route.params || {};
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud, currentUser, fetchDirectory } = useApp();
  const canManage = canManageInventory(currentUser?.role);

  const [box, setBox] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pickingUser, setPickingUser] = useState(false);
  const [target, setTarget] = useState(null);      // хэнд олгож байгаа
  const [scanning, setScanning] = useState(false); // олгох камер
  const [putting, setPutting] = useState(false);   // хайрцагт хийх камер
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qty, setQty] = useState('1');
  const [employees, setEmployees] = useState([]);

  const load = useCallback(async () => {
    if (!isCloud || !code) return;
    try {
      setError(null);
      const res = await boxApi.fetchBoxByCode(code);
      setBox(res.box || { code, name: code });
      setItems(res.items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isCloud, code]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // --- Олгох урсгал ---

  const startIssue = async () => {
    if (!canManage) {
      Alert.alert('Олгох', 'Танд олгох эрх байхгүй. Зөвхөн админ бараа олгоно.');
      return;
    }
    if (!items.length) {
      Alert.alert('Олгох', 'Хайрцаг хоосон байна.');
      return;
    }
    try {
      const list = await fetchDirectory();
      setEmployees((list || []).filter((u) => u.id && u.id !== currentUser?.id));
    } catch (e) {
      Alert.alert('Олгох', e.message || 'Ажилтны жагсаалт татагдсангүй.');
      return;
    }
    setPickingUser(true);
  };

  const chooseUser = (user) => {
    setTarget(user);
    setPickingUser(false);
    setQty('1');
    setScanning(true);
  };

  /**
   * Уншсан кодыг ШАЛГАНА (хасахгүй).
   *
   * Хайрцгийн агуулга аль хэдийн ачаалагдсан тул серверт хандахгүйгээр
   * шууд хариу өгнө — сканнер саадгүй, шуурхай ажиллана. Бодит хасалт
   * нь `submitIssue` дээр, сервер талын шалгалттайгаар хийгдэнэ.
   */
  const resolveItem = useCallback(
    async (raw) => {
      const c = String(raw || '').trim().toLowerCase();
      const found = items.find(
        (i) =>
          String(i.barcode || '').trim().toLowerCase() === c ||
          String(i.serial_no || '').trim().toLowerCase() === c
      );
      if (!found) {
        return { ok: false, error: 'Энэ хайрцагт байхгүй' };
      }
      if (found.quantity <= 0) {
        return { ok: false, error: 'Үлдэгдэлгүй' };
      }
      return { ok: true, name: found.name };
    },
    [items]
  );

  /** Уншсан бүх барааг нэг дор олгоно. */
  const submitIssue = async (scanned) => {
    if (!target?.id) return;
    const done = [];
    const failed = [];

    for (const row of scanned) {
      try {
        const res = await boxApi.issueByBarcode({
          boxCode: box?.code || code,
          barcode: row.code,
          userId: target.id,
          quantity: row.qty,
        });
        done.push(`${res.itemName} × ${res.issued}`);
      } catch (e) {
        // Нэг бараа амжилтгүй болсон нь бусдыг зогсоох ёсгүй —
        // юу олгогдож, юу олгогдоогүйг тодорхой хэлнэ.
        failed.push(`${row.name}: ${e.message}`);
      }
    }

    setScanning(false);
    setTarget(null);
    await load();

    const parts = [];
    if (done.length) parts.push('Олгосон:\n' + done.join('\n'));
    if (failed.length) parts.push('Олгогдоогүй:\n' + failed.join('\n'));
    Alert.alert(
      failed.length ? 'Хэсэгчлэн олгогдлоо' : 'Олголт дууслаа',
      `${target?.name || 'Ажилтан'}\n\n${parts.join('\n\n')}`
    );
  };

  const finishIssue = () => {
    setScanning(false);
    setTarget(null);
  };

  // --- Хайрцагт бараа хийх ---

  /** Хайрцагт нэмэхэд уншсан код агуулахад бүртгэлтэй эсэхийг шалгана. */
  const resolveForPut = async (raw) => {
    const c = String(raw || '').trim();
    if (!c) return { ok: false, error: 'Хоосон код' };
    // Хайрцагт БАЙХГҮЙ бараа ч нэмэгдэж болно — тиймээс энд зөвхөн
    // кодыг хүлээж авна. Агуулахад бүртгэлгүй бол сервер хэлнэ.
    const known = items.find(
      (i) =>
        String(i.barcode || '').trim().toLowerCase() === c.toLowerCase() ||
        String(i.serial_no || '').trim().toLowerCase() === c.toLowerCase()
    );
    return { ok: true, name: known ? known.name : c };
  };

  /** Уншсан бүх барааг хайрцагт нэмнэ. */
  const submitPut = async (scanned) => {
    const done = [];
    const failed = [];
    for (const row of scanned) {
      try {
        const res = await boxApi.putItem({
          boxCode: box?.code || code,
          barcode: row.code,
          quantity: row.qty,
        });
        done.push(`${res.itemName} → ${res.quantity}`);
      } catch (e) {
        failed.push(`${row.name}: ${e.message}`);
      }
    }
    setPutting(false);
    await load();
    const parts = [];
    if (done.length) parts.push('Нэмэгдсэн:\n' + done.join('\n'));
    if (failed.length) parts.push('Нэмэгдээгүй:\n' + failed.join('\n'));
    Alert.alert(failed.length ? 'Хэсэгчлэн нэмэгдлээ' : 'Нэмэгдлээ', parts.join('\n\n'));
  };

  // Зөвхөн админ. Цэснээс нуусан ч навигацийн нэрээр шууд орох боломж
  // үлддэг тул энд ч хаана — UI-д нуух нь хамгаалалт биш.
  if (!canManage) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Хайрцаг" />
        <EmptyState text="Энэ хэсэг зөвхөн админд нээлттэй." />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Хайрцаг" />
        <EmptyState text={error} />
        <View style={{ padding: spacing.lg }}>
          <Button title="Дахин оролдох" onPress={load} />
        </View>
      </View>
    );
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={box?.name || 'Хайрцаг'}
        subtitle={`${box?.code || code}${box?.location ? ` · ${box.location}` : ''}`}
        right={
          <TouchableOpacity onPress={() => setShowQr(true)} hitSlop={10}>
            <Ionicons name="qr-code" size={24} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {items.length} нэр төрөл · нийт {totalQty} ширхэг
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View style={styles.itemIcon}>
                <Ionicons
                  name={item.category === 'tool' ? 'construct' : 'cube-outline'}
                  size={20}
                  color={item.category === 'tool' ? colors.warning : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.serial_no ? (
                  <Text style={styles.itemMeta}>Сериал: {item.serial_no}</Text>
                ) : null}
                {item.barcode ? <Text style={styles.itemMeta}>Код: {item.barcode}</Text> : null}
              </View>
              <View style={styles.qtyBox}>
                <Text style={styles.qtyNum}>{item.quantity}</Text>
                <Text style={styles.qtyUnit}>{item.unit || 'ш'}</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState text="Энэ хайрцаг хоосон байна." />}
      />

      {canManage ? (
        <View style={styles.actions}>
          <Button
            title="Хайрцагт хийх"
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() => {
              setQty('1');
              setPutting(true);
            }}
          />
          <Button title="Олгох" style={{ flex: 1 }} onPress={startIssue} />
        </View>
      ) : null}

      {/* --- Ажилтан сонгох --- */}
      <Modal visible={pickingUser} animationType="slide" onRequestClose={() => setPickingUser(false)}>
        <View style={styles.container}>
          <ScreenHeader title="Хэнд олгох вэ?" back onBackPress={() => setPickingUser(false)} />

          {/* Нэг уншилтаар хэдийг олгохыг эндээс тохируулна. Ихэнхдээ 1
              байдаг тул анхдагчаар 1 — кабель, боолт зэрэг олноор
              олгодог зүйлд л өөрчилнө. */}
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Нэг уншилтаар олгох тоо</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setQty((q) => String(Math.max(1, (Number(q) || 1) - 1)))}
                hitSlop={8}
              >
                <Ionicons name="remove" size={18} color={colors.text} />
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={qty}
                onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setQty((q) => String((Number(q) || 1) + 1))}
                hitSlop={8}
              >
                <Ionicons name="add" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={employees}
            keyExtractor={(u) => String(u.id)}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.75} onPress={() => chooseUser(item)}>
                <Card style={styles.userCard}>
                  <View style={styles.itemRow}>
                    <View style={styles.itemIcon}>
                      <Ionicons name="person" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name || item.email || '—'}</Text>
                      {item.position ? <Text style={styles.itemMeta}>{item.position}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                  </View>
                </Card>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<EmptyState text="Ажилтан олдсонгүй." />}
          />
        </View>
      </Modal>

      {/* --- Олгох: тасралтгүй олон код уншуулах ---
          Нэг бараа тутамд камер хаагдаж, дахин нээгддэг байсныг өөрчилж
          нэг удаагийн сессэд бүгдийг уншуулаад эцэст нь баталгаажуулдаг
          болгов — нярав хамаагүй хурдан ажиллана. */}
      <MultiScanSheet
        visible={scanning}
        onClose={finishIssue}
        onResolve={resolveItem}
        onSubmit={submitIssue}
        title={`${target?.name || 'Ажилтан'}-д олгох`}
        hint="Барааны зураасан код эсвэл сериалыг уншуулна уу"
        submitLabel="Олгох"
      />

      {/* --- Хайрцагт хийх: код уншуулах --- */}
      <MultiScanSheet
        visible={putting}
        onClose={() => setPutting(false)}
        onResolve={resolveForPut}
        onSubmit={submitPut}
        title="Хайрцагт хийх"
        hint="Хайрцагт хийх барааны кодыг уншуулна уу"
        submitLabel="Нэмэх"
      />

      {/* --- QR хэвлэх --- */}
      <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
        <View style={styles.backdrop}>
          <View style={styles.qrSheet}>
            <Text style={styles.sheetTitle}>{box?.name}</Text>
            <Text style={styles.qrCode}>{box?.code || code}</Text>
            <View style={styles.qrWrap}>
              <QRCode value={boxApi.qrValue(box?.code || code)} size={220} backgroundColor="#ffffff" color="#000000" />
            </View>
            <Text style={styles.qrHint}>
              Энэ QR-ыг хэвлээд хайрцаг дээр наана уу. Агуулга өөрчлөгдөхөд QR дахин хэвлэх
              шаардлагагүй — код тогтмол, агуулга нь системээс ирнэ.
            </Text>
            <Button title="Хаах" variant="ghost" onPress={() => setShowQr(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

    summary: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    summaryText: { color: colors.textMuted, fontSize: 13 },

    itemCard: { marginBottom: spacing.sm },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    itemIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemName: { color: colors.text, fontSize: 15, fontWeight: '700' },
    itemMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    qtyBox: { alignItems: 'center', minWidth: 46 },
    qtyNum: { color: colors.text, fontSize: 18, fontWeight: '800' },
    qtyUnit: { color: colors.textFaint, fontSize: 11 },

    userCard: { marginBottom: spacing.sm },

    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    qtyLabel: { color: colors.textMuted, fontSize: 13, flex: 1 },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    stepBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.bgAlt },
    qtyInput: {
      minWidth: 52,
      textAlign: 'center',
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      paddingVertical: spacing.sm,
    },

    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },

    issuedBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing.md,
      backgroundColor: 'rgba(11,122,68,0.92)',
    },
    issuedText: { color: '#fff', fontSize: 13, textAlign: 'center' },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    qrSheet: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.md,
      width: '100%',
    },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    qrCode: { color: colors.textMuted, fontSize: 14, letterSpacing: 1 },
    qrWrap: { backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md },
    qrHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  });
