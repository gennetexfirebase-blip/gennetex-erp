import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, ScreenHeader, HeaderButton, EmptyState } from '../components/ui';
import ChatAvatar from '../components/ChatAvatar';
import { computeBalancesByUser } from '../lib/stockBalance';
import * as stockExport from '../services/stockExportService';
import { buildStockHoldingSheets, sheetsToPreview } from '../../admin-web/attendance-report-builder.js';
import { friendlyError } from '../lib/erpMessages';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const CAT_LABEL = { material: 'Бараа материал', tool: 'Багаж', supply: 'Хангамж' };
const CAT_ORDER = ['material', 'tool', 'supply'];

/**
 * "Хэн авсан" — АЖИЛТНЫ талаас харуулна.
 *
 * ⚠️ Өмнө нь барааны талаас (бараа бүрийн доор эзэмшигчид) харуулдаг
 *    байсан тул "энэ ажилтанд юу байна вэ" гэдгийг олохын тулд бүх
 *    барааг гүйлгэж үзэх шаардлагатай байв. Одоо ажилтан бүр нэг мөр
 *    болж, дарахад түүний БҮХ бараа, багаж, хангамж ангилалаараа
 *    бүлэглэгдэн тоо ширхэгтэйгээ гарна.
 */
export default function ToolAllocationScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { inventory, isCloud, fetchStockMovements, fetchEmployees } = useApp();

  const [movements, setMovements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const [mv, emps] = await Promise.all([
        fetchStockMovements(false),
        fetchEmployees().catch(() => []),
      ]);
      setMovements(mv || []);
      setEmployees(emps || []);
    } catch (e) {
      // Дэлгэц хоосон харагдах нь өөрөө шалтгааныг хэлнэ.
    }
  }, [isCloud, fetchStockMovements, fetchEmployees]);

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

  const inventoryById = useMemo(() => {
    const map = {};
    inventory.forEach((it) => {
      map[it.id] = it;
    });
    return map;
  }, [inventory]);

  /** Эзэмшилтэй ажилтнууд (үлдэгдэл > 0). */
  const holders = useMemo(
    () => computeBalancesByUser(movements, inventoryById),
    [movements, inventoryById]
  );

  /**
   * Бүх ажилтан — эзэмшилгүй нь ч жагсаалтад гарна.
   *
   * Зөвхөн эзэмшигчдийг харуулбал "энэ хүн юу ч аваагүй юу, эсвэл
   * жагсаалтад ороогүй юу" гэдэг ялгагдахгүй.
   */
  const rows = useMemo(() => {
    const byId = new Map();
    holders.forEach((h) => byId.set(String(h.user_id || h.user_name), h));

    // ⚠️ `fetchEmployees()`-ийн `id` нь `record_id` — бүртгэлтэй хүнд
    //    `profiles.id`, бүртгэлгүйд `pending:<email>`. `stock_movements`
    //    нь `profiles.id`-аар бичигддэг тул `user_id`-г эхэлж үзнэ.
    const list = employees
      .filter((e) => e.user_id || e.id)
      .map((e) => {
        const key = String(e.user_id || e.id);
        const found = byId.get(key);
        byId.delete(key);
        return {
          user_id: e.user_id || e.id,
          user_name: e.name || e.email || 'Ажилтан',
          avatar_url: e.avatar_url || null,
          items: found?.items || [],
        };
      });

    // Ажилтны жагсаалтад байхгүй ч эзэмшилтэй хүн үлдвэл (гарсан ажилтан)
    // тэднийг ч харуулна — эс бөгөөс барааг нь мөрдөх боломжгүй болно.
    byId.forEach((h) => list.push({ ...h, avatar_url: null }));

    return list.sort((a, b) => {
      if (!!b.items.length !== !!a.items.length) return b.items.length - a.items.length;
      return (a.user_name || '').localeCompare(b.user_name || '', 'mn');
    });
  }, [holders, employees]);

  const totals = useMemo(() => {
    const withItems = rows.filter((r) => r.items.length);
    return {
      people: withItems.length,
      kinds: withItems.reduce((s, r) => s + r.items.length, 0),
      qty: withItems.reduce(
        (s, r) => s + r.items.reduce((q, it) => q + (Number(it.quantity) || 0), 0),
        0
      ),
    };
  }, [rows]);

  // Excel-д зөвхөн эзэмшилтэй хүмүүс орно — хоосон мөр тайланг бөглөрүүлнэ.
  const exportRows = useMemo(() => rows.filter((r) => r.items.length), [rows]);
  const preview = useMemo(
    () => sheetsToPreview(buildStockHoldingSheets({ holders: exportRows })),
    [exportRows]
  );

  const download = async () => {
    if (!exportRows.length) {
      Alert.alert('Хоосон', 'Одоогоор хэн ч бараа, багаж аваагүй байна.');
      return;
    }
    setExporting(true);
    try {
      await stockExport.exportStockHoldingExcel({ holders: exportRows });
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setExporting(false);
    }
  };

  /** Нэг ажилтны зүйлсийг ангилалаар бүлэглэнэ. */
  const groupByCategory = (items) => {
    const groups = {};
    items.forEach((it) => {
      const cat = it.category || 'material';
      (groups[cat] = groups[cat] || []).push(it);
    });
    return CAT_ORDER.filter((c) => groups[c]?.length).map((c) => ({
      category: c,
      label: CAT_LABEL[c],
      items: groups[c].sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'mn')),
    }));
  };

  const renderRow = ({ item }) => {
    const kinds = item.items.length;
    const qty = item.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    return (
      <TouchableOpacity
        activeOpacity={kinds ? 0.75 : 1}
        onPress={() => kinds && setSelected(item)}
      >
        <Card style={[styles.row, !kinds && styles.rowEmpty]}>
          <ChatAvatar name={item.user_name} uri={item.avatar_url} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.user_name}</Text>
            <Text style={styles.sub}>
              {kinds ? `${kinds} нэр төрөл · нийт ${qty}` : 'Юу ч аваагүй'}
            </Text>
          </View>
          {kinds ? (
            <>
              <View style={styles.qtyPill}>
                <Text style={styles.qtyNum}>{qty}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Хэн авсан"
        subtitle={`${totals.people} ажилтан · ${totals.kinds} нэр төрөл · нийт ${totals.qty}`}
        right={
          <HeaderButton
            title="Excel"
            icon="📗"
            onPress={() => setPreviewOpen(true)}
          />
        }
      />

      {!isCloud ? (
        <EmptyState text="Supabase холбогдсон байх шаардлагатай." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.user_id || r.user_name)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={renderRow}
          ListEmptyComponent={<EmptyState text="Ажилтан бүртгэгдээгүй байна." />}
        />
      )}

      {/* ── Нэг ажилтны эзэмшил ─────────────────────────────────── */}
      <Modal
        visible={selected !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <ChatAvatar name={selected?.user_name} uri={selected?.avatar_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{selected?.user_name}</Text>
                <Text style={styles.sheetSub}>
                  {selected?.items.length} нэр төрөл · нийт{' '}
                  {selected?.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
              {selected
                ? groupByCategory(selected.items).map((g) => (
                    <View key={g.category} style={styles.group}>
                      <Text style={styles.groupLabel}>{g.label}</Text>
                      {g.items.map((it, i) => (
                        <View key={`${it.item_id || it.item_name}-${i}`} style={styles.itemRow}>
                          <Text style={styles.itemName} numberOfLines={2}>
                            {it.item_name}
                          </Text>
                          <Text style={styles.itemQty}>
                            {it.quantity} {it.unit || 'ширхэг'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))
                : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Excel: preview + татах ──────────────────────────────── */}
      <Modal
        visible={previewOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={styles.excelIcon}>
                <Ionicons name="document-text" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Ажилтны эзэмшил</Text>
                <Text style={styles.sheetSub}>{preview.sheetName} · Excel</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Preview-д харагдаж буй мөрүүд нь Excel-д бичигдэх мөрүүд ЯГ
                ӨӨРӨӨ (нэг builder) — "харсан зүйл" ба "татсан файл" зөрөхгүй. */}
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
                <View style={styles.tHead}>
                  {preview.header.map((h, i) => (
                    <Text key={i} style={[styles.tCell, styles.tHeadCell]} numberOfLines={1}>
                      {String(h)}
                    </Text>
                  ))}
                </View>
                {preview.body.map((r, ri) => (
                  <View key={ri} style={styles.tRow}>
                    {preview.header.map((_, ci) => (
                      <Text key={ci} style={styles.tCell} numberOfLines={1}>
                        {r[ci] == null ? '' : String(r[ci])}
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </ScrollView>

            <TouchableOpacity
              style={[styles.download, exporting && { opacity: 0.6 }]}
              onPress={download}
              disabled={exporting}
              activeOpacity={0.85}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.downloadText}>Excel татах</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  rowEmpty: { opacity: 0.5 },
  name: { color: colors.text, fontSize: 15.5, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  qtyPill: {
    backgroundColor: colors.primary + '18',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 46,
    alignItems: 'center',
  },
  qtyNum: { color: colors.primary, fontSize: 17, fontWeight: '900' },

  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  excelIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#1D6F42', // Excel-ийн ногоон
    alignItems: 'center',
    justifyContent: 'center',
  },

  group: { marginBottom: spacing.lg },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { flex: 1, color: colors.text, fontSize: 14.5 },
  itemQty: { color: colors.accent, fontSize: 14.5, fontWeight: '800' },

  tHead: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tCell: {
    width: 132,
    paddingVertical: 8,
    paddingHorizontal: 6,
    color: colors.text,
    fontSize: 12.5,
  },
  tHeadCell: { color: colors.textMuted, fontWeight: '800', fontSize: 11.5 },

  download: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: '#1D6F42',
  },
  downloadText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
