import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Vibration,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { spacing, radius } from '../theme';
import { useStyles, useTheme } from '../context/ThemeContext';

const BARCODE_TYPES = [
  'qr', 'ean13', 'ean8', 'upc_a', 'upc_e',
  'code39', 'code128', 'code93', 'itf14', 'codabar', 'datamatrix', 'pdf417',
];

/**
 * Тасралтгүй олон код унших самбар.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   Хуучин `BarcodeScanner` нь НЭГ код уншаад хаагддаг. Ажилтанд 5 бараа
 *   олгоход камерыг 5 удаа нээх шаардлагатай болж, нярав удаан ажилладаг.
 *
 *   Энэ хувилбар нь iOS-ийн барааны сканнер шиг ажиллана: уншсан бүр
 *   доорх жагсаалтад нэмэгдэж, тоо нь өснө. Эцэст нь нэг л удаа
 *   "Баталгаажуулах" дарна.
 *
 * ДАВХАРДАЛ:
 *   Камер нэг кодыг секундэд олон удаа уншдаг. `seenAt` цагаар хамгаалж,
 *   ижил кодыг 1.2 секундын дотор дахин тоолохгүй. Ингэснээр хуруугаа
 *   хөдөлгөхгүй байхад тоо санамсаргүй өсөхгүй.
 *
 * @param {(code:string) => Promise<{ok:boolean,name?:string,error?:string}>} onResolve
 *        Уншсан кодыг шалгаж, нэрийг нь буцаана. Алдаатай бол жагсаалтад
 *        улаанаар харагдана — камер хаагдахгүй.
 */
export default function MultiScanSheet({
  visible,
  onClose,
  onResolve,
  onSubmit,
  title = 'Код уншуулах',
  hint = 'Кодыг хүрээн дунд байрлуулна уу',
  submitLabel = 'Баталгаажуулах',
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastSeen = useRef({});   // code -> timestamp

  useEffect(() => {
    if (visible) {
      setItems([]);
      setExpanded(false);
      lastSeen.current = {};
    }
  }, [visible]);

  const total = items.reduce((s, i) => s + (i.ok ? i.qty : 0), 0);

  const handleScanned = useCallback(
    async ({ data }) => {
      const code = String(data || '').trim();
      if (!code) return;

      const now = Date.now();
      if (now - (lastSeen.current[code] || 0) < 1200) return;
      lastSeen.current[code] = now;

      // Аль хэдийн уншсан амжилттай код бол зөвхөн тоог нэмнэ —
      // сервер рүү дахин хүсэлт явуулах шаардлагагүй.
      const existing = items.find((i) => i.code === code && i.ok);
      if (existing) {
        if (Platform.OS !== 'web') Vibration.vibrate(30);
        setItems((prev) =>
          prev.map((i) => (i.code === code && i.ok ? { ...i, qty: i.qty + 1 } : i))
        );
        return;
      }

      setBusy(true);
      try {
        const res = onResolve ? await onResolve(code) : { ok: true, name: code };
        if (Platform.OS !== 'web') Vibration.vibrate(res?.ok ? 40 : [0, 80, 60, 80]);
        setItems((prev) => {
          // Алдаатай мөр давхардвал нэг л удаа харуулна
          if (!res?.ok && prev.some((i) => i.code === code && !i.ok)) return prev;
          return [
            {
              code,
              qty: 1,
              ok: !!res?.ok,
              name: res?.name || code,
              error: res?.error,
            },
            ...prev,
          ];
        });
      } finally {
        setBusy(false);
      }
    },
    [items, onResolve]
  );

  const changeQty = (code, delta) => {
    setItems((prev) =>
      prev
        .map((i) => (i.code === code ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0 || !i.ok)
    );
  };

  const removeItem = (code) => setItems((prev) => prev.filter((i) => i.code !== code));

  const submit = async () => {
    const ok = items.filter((i) => i.ok && i.qty > 0);
    if (!ok.length) return;
    setBusy(true);
    try {
      await onSubmit?.(ok);
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permMsg}>
              Код уншихын тулд камерын зөвшөөрөл шаардлагатай.
            </Text>
            <Button title="Зөвшөөрөл олгох" onPress={requestPermission} />
            <Button title="Хаах" variant="ghost" style={{ marginTop: spacing.md }} onPress={onClose} />
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={handleScanned}
            />

            {/* Дээд хэсэг */}
            <View style={styles.top} pointerEvents="box-none">
              <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setTorch((t) => !t)} hitSlop={10}>
                <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Хүрээ */}
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={styles.frame}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>
              <Text style={styles.hint}>{busy ? 'Шалгаж байна...' : hint}</Text>
            </View>

            {/* Доод жагсаалт */}
            <View style={[styles.sheet, expanded && styles.sheetExpanded]}>
              <TouchableOpacity
                style={styles.sheetHandle}
                onPress={() => setExpanded((e) => !e)}
                activeOpacity={0.8}
              >
                <View style={styles.grabber} />
              </TouchableOpacity>

              <View style={styles.sheetHead}>
                <TouchableOpacity onPress={() => setItems([])} disabled={!items.length}>
                  <Text style={[styles.clear, !items.length && styles.dim]}>Цэвэрлэх</Text>
                </TouchableOpacity>
                <Text style={styles.count}>{total} ширхэг</Text>
                <TouchableOpacity onPress={submit} disabled={busy || !total}>
                  <Text style={[styles.submit, (busy || !total) && styles.dim]}>{submitLabel}</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={items}
                keyExtractor={(i) => i.code}
                style={{ maxHeight: expanded ? 340 : 150 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View style={[styles.row, !item.ok && styles.rowBad]}>
                    <Ionicons
                      name={item.ok ? 'checkmark-circle' : 'alert-circle'}
                      size={20}
                      color={item.ok ? colors.success : colors.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowCode} numberOfLines={1}>
                        {item.ok ? item.code : item.error || 'Олдсонгүй'}
                      </Text>
                    </View>
                    {item.ok ? (
                      <View style={styles.stepper}>
                        <TouchableOpacity onPress={() => changeQty(item.code, -1)} hitSlop={8} style={styles.stepBtn}>
                          <Ionicons name="remove" size={16} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.qty}>{item.qty}</Text>
                        <TouchableOpacity onPress={() => changeQty(item.code, 1)} hitSlop={8} style={styles.stepBtn}>
                          <Ionicons name="add" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => removeItem(item.code)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.7)" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.empty}>Уншсан код энд харагдана</Text>
                }
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    permMsg: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: spacing.lg },

    top: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 28,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },

    frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 160 },
    frame: { width: 240, height: 240 },
    corner: { position: 'absolute', width: 34, height: 34, borderColor: '#fff', borderWidth: 4 },
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 14 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 14 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 14 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 14 },
    hint: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: spacing.lg, textAlign: 'center' },

    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(18,18,20,0.96)',
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    },
    sheetExpanded: {},
    sheetHandle: { alignItems: 'center', paddingVertical: 10 },
    grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    clear: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
    count: { color: '#fff', fontSize: 15, fontWeight: '800' },
    submit: { color: colors.primary, fontSize: 15, fontWeight: '800' },
    dim: { opacity: 0.35 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.12)',
    },
    rowBad: { backgroundColor: 'rgba(229,72,77,0.12)' },
    rowName: { color: '#fff', fontSize: 14, fontWeight: '600' },
    rowCode: { color: 'rgba(255,255,255,0.55)', fontSize: 11.5, marginTop: 1 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    qty: { color: '#fff', fontSize: 15, fontWeight: '800', minWidth: 22, textAlign: 'center' },
    empty: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg },
  });
