import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, ScreenHeader, EmptyState, StatCard, formatMNT } from '../components/ui';
import MongoliaPlate from '../components/MongoliaPlate';
import ExcelIcon from '../components/ExcelIcon';
import * as fuelApi from '../services/fuelPriceService';
import * as stockExport from '../services/stockExportService';
import { buildFuelSpendSheets, sheetsToPreview } from '../../admin-web/attendance-report-builder.js';
import { friendlyError } from '../lib/erpMessages';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

/**
 * Шатахууны зарцуулалт — "энэ машинд нийт хэдэн төгрөгөөр бензин
 * хийсэн бэ".
 *
 * ⚠️ Өгөгдөл нь `vehicle_logs` дээр бүртгэгддэг байсан ч ХААНААС Ч
 *    нэгтгэдэггүй байв. Төсвийн хамгийн энгийн, хамгийн их асуугддаг
 *    асуултад хариулах зам байгаагүй.
 */

/** Хугацааны сонголт — эхлэх огноог буцаана (`null` = бүх хугацаа). */
const PERIODS = [
  { key: 'all', label: 'Бүгд', days: null },
  { key: '30', label: '30 хоног', days: 30 },
  { key: '90', label: '3 сар', days: 90 },
  { key: '365', label: 'Жил', days: 365 },
];

function isoDaysAgo(days) {
  if (days == null) return null;
  const d = new Date(Date.now() - days * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

export default function FuelSpendReportScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [period, setPeriod] = useState('all');
  const [rows, setRows] = useState([]);
  const [refuels, setRefuels] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const from = useMemo(() => isoDaysAgo(PERIODS.find((p) => p.key === period)?.days), [period]);
  const periodLabel = useMemo(
    () => (from ? `${from} — өнөөдөр` : 'Бүх хугацаа'),
    [from]
  );

  const load = useCallback(async () => {
    try {
      const list = await fuelApi.fetchFuelSpendReport({ from });
      setRows(list);

      /**
       * Цэнэглэлт бүрийг Excel-д оруулахын тулд урьдчилж татна.
       *
       * ⚠️ Зөвхөн зардалтай машиныг татна — 0₮-тэй машин бүрд хоосон
       *    хүсэлт явуулах нь утгагүй бөгөөд флот томрох тусам удаашрана.
       */
      const withSpend = list.filter((v) => v.totalCost > 0);
      const all = await Promise.all(
        withSpend.map((v) => fuelApi.fetchVehicleRefuels(v.vehicleId, { from }).catch(() => []))
      );
      setRefuels(all.flat().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totals = useMemo(() => {
    const withSpend = rows.filter((r) => r.totalCost > 0);
    const cost = withSpend.reduce((s, r) => s + r.totalCost, 0);
    const liters = withSpend.reduce((s, r) => s + r.totalLiters, 0);
    return {
      vehicles: withSpend.length,
      cost,
      liters,
      fills: withSpend.reduce((s, r) => s + r.refuelCount, 0),
      avg: liters > 0 ? Math.round(cost / liters) : 0,
    };
  }, [rows]);

  const preview = useMemo(
    () => sheetsToPreview(buildFuelSpendSheets({ vehicles: rows, refuels, periodLabel })),
    [rows, refuels, periodLabel]
  );

  const download = async () => {
    if (!totals.vehicles) {
      Alert.alert('Хоосон', 'Энэ хугацаанд шатахууны бүртгэл алга.');
      return;
    }
    setExporting(true);
    try {
      await stockExport.exportFuelSpendExcel({ vehicles: rows, refuels, periodLabel });
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setExporting(false);
    }
  };

  const byVehicle = useCallback(
    (vehicleId) => refuels.filter((r) => rows.find((v) => v.vehicleId === vehicleId)?.plateNumber === r.plate_number),
    [refuels, rows]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Шатахууны зардал"
        subtitle={`${totals.vehicles} машин · ${formatMNT(totals.cost)}`}
        right={
          <TouchableOpacity
            style={styles.excelBtn}
            onPress={() => setPreviewOpen(true)}
            activeOpacity={0.8}
          >
            <ExcelIcon size={17} />
            <Text style={styles.excelText}>Excel</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.filterRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, period === p.key && styles.chipOn]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.chipText, period === p.key && styles.chipTextOn]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statRow}>
          <StatCard label="Нийт зардал" value={formatMNT(totals.cost)} color={colors.danger} />
          <StatCard label="Нийт литр" value={totals.liters.toFixed(1)} color={colors.accent} />
        </View>
        <View style={styles.statRow}>
          <StatCard label="Цэнэглэлт" value={String(totals.fills)} color={colors.primary} />
          <StatCard
            label="Дундаж 1л"
            value={totals.avg ? formatMNT(totals.avg) : '—'}
            color={colors.success}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !rows.filter((r) => r.totalCost > 0).length ? (
          <EmptyState text="Энэ хугацаанд шатахууны бүртгэл алга." />
        ) : (
          rows
            .filter((r) => r.totalCost > 0)
            .map((v) => {
              const open = expanded === v.vehicleId;
              const list = open ? byVehicle(v.vehicleId) : [];
              return (
                <Card key={v.vehicleId} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardHead}
                    onPress={() => setExpanded(open ? null : v.vehicleId)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      {/* ⚠️ Улсын дугаар ХАМГИЙН тод байх ёстой — санхүү
                          зардлыг машинаар нь таних цорын ганц багана. */}
                      <MongoliaPlate plate={v.plateNumber} size="sm" />
                      <Text style={styles.meta}>
                        {v.driverName || 'Жолоочгүй'} · {fuelApi.fuelTypeLabel(v.fuelType)}
                      </Text>
                      <Text style={styles.meta}>
                        {v.refuelCount} удаа · {v.totalLiters.toFixed(1)} л
                        {v.avgPrice ? ` · дундаж ${formatMNT(v.avgPrice)}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cost}>{formatMNT(v.totalCost)}</Text>
                      <Ionicons
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  {open ? (
                    <View style={styles.detail}>
                      {list.length ? (
                        list.map((r) => (
                          <View key={r.id} style={styles.detailRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.detailDate}>{fmtDateTime(r.created_at)}</Text>
                              <Text style={styles.detailMeta}>
                                {Number(r.liters).toFixed(2)} л ×{' '}
                                {formatMNT(Number(r.price_per_liter))}
                                {r.discounted ? ' · хөнгөлөлттэй' : ''}
                              </Text>
                            </View>
                            <Text style={styles.detailCost}>{formatMNT(Number(r.cost))}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.detailMeta}>Дэлгэрэнгүй ачаалж байна…</Text>
                      )}
                    </View>
                  ) : null}
                </Card>
              );
            })
        )}
      </ScrollView>

      {/* ── Excel урьдчилан харах ─────────────────────────────── */}
      <Modal visible={previewOpen} animationType="slide" transparent onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Шатахууны зардал</Text>
                <Text style={styles.sheetSub}>{preview.sheetName} · {periodLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* ⚠️ `sheetsToPreview` нь `{ header, body, sheetName }`
                буцаадаг — `rows` БИШ. Агуулахын дэлгэцтэй ижил хэлбэр. */}
            <ScrollView horizontal>
              <ScrollView style={{ maxHeight: 380 }}>
                <View>
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
                </View>
              </ScrollView>
            </ScrollView>

            <TouchableOpacity
              style={styles.dlBtn}
              onPress={download}
              disabled={exporting}
              activeOpacity={0.85}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <ExcelIcon size={18} />
                  <Text style={styles.dlText}>Excel татах</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  excelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  excelText: { color: colors.text, fontSize: 13, fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },

  statRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },

  card: { marginBottom: spacing.md, padding: 0, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  meta: { color: colors.textMuted, fontSize: 12.5, marginTop: 3 },
  cost: { color: colors.danger, fontSize: 16, fontWeight: '800' },

  detail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft || colors.border,
  },
  detailDate: { color: colors.text, fontSize: 13.5, fontWeight: '600' },
  detailMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  detailCost: { color: colors.accent, fontSize: 14, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
    ...shadow.lg,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },

  tHead: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tHeadCell: { fontWeight: '800', color: colors.textMuted, fontSize: 11 },
  tCell: {
    width: 118,
    paddingVertical: 7,
    paddingHorizontal: 6,
    color: colors.text,
    fontSize: 11.5,
  },

  dlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginTop: spacing.md,
  },
  dlText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
