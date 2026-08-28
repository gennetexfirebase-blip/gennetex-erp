import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LoadingState, EmptyState, ErrorState } from '../components/ui';
import ExcelIcon from '../components/ExcelIcon';
import * as attApi from '../services/attendanceService';
import * as exportApi from '../services/attendanceExportService';
import {
  buildDailyAttendanceSheets,
  sheetsToPreview,
} from '../../admin-web/attendance-report-builder.js';
import { friendlyError } from '../lib/erpMessages';
import { dayKey } from '../lib/workHours';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

/**
 * Ирцийн Excel тайлан — PREVIEW + ТАТАХ.
 *
 * Preview-д харагдаж буй хүснэгт нь Excel-д бичигдэх мөрүүд ЯГ ӨӨРӨӨ
 * (`attendanceReportBuilder`) — тиймээс "харсан зүйл" ба "татсан файл"
 * хоёр зөрөхгүй.
 */
export default function AttendanceReportScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialDate = route.params?.date || dayKey();

  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await attApi.fetchDepartmentAttendanceToday(null, date));
    } catch (e) {
      setError(e?.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, [date]);

  React.useEffect(() => {
    load();
  }, [load]);

  const sheets = useMemo(() => buildDailyAttendanceSheets({ date, rows }), [date, rows]);
  const preview = useMemo(() => sheetsToPreview(sheets), [sheets]);
  const summary = sheets[0];

  const download = async () => {
    if (!rows.length) {
      Alert.alert('Хоосон', 'Энэ өдөрт татах ирцийн бүртгэл алга.');
      return;
    }
    setExporting(true);
    try {
      await exportApi.exportDailyAttendanceExcel({ date, rows });
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setExporting(false);
    }
  };

  const step = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    const next = dayKey(d);
    if (next > dayKey()) return;
    setDate(next);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Ирцийн тайлан</Text>
          <Text style={styles.subtitle}>Excel — урьдчилан харах, татах</Text>
        </View>
      </View>

      {/* Огноо сонгох */}
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => step(-1)} hitSlop={10} style={styles.arrow}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.dateText}>{date}</Text>
        <TouchableOpacity
          onPress={() => step(1)}
          hitSlop={10}
          style={[styles.arrow, date >= dayKey() && { opacity: 0.3 }]}
          disabled={date >= dayKey()}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState text="Ачаалж байна..." />
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorState text={error} onRetry={load} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          {/* Нэгтгэл */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Нэгтгэл</Text>
            {summary.rows.slice(1).map(([label, value], i) => (
              <View key={i} style={styles.sumRow}>
                <Text style={styles.sumLabel}>{label}</Text>
                <Text style={styles.sumValue}>{String(value)}</Text>
              </View>
            ))}
          </View>

          {/* Хүснэгтийн preview — Excel-д орох мөрүүд ЯГ ЭНЭ */}
          <Text style={styles.sectionTitle}>
            {preview.sheetName} ({preview.body.length} мөр)
          </Text>

          {preview.body.length === 0 ? (
            <EmptyState text="Энэ өдөрт ирцийн бүртгэл алга." />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.table}>
                <View style={[styles.tr, styles.thead]}>
                  {preview.header.map((h, i) => (
                    <Text key={i} style={[styles.th, colWidth(i)]} numberOfLines={1}>
                      {h}
                    </Text>
                  ))}
                </View>
                {preview.body.map((r, ri) => (
                  <View key={ri} style={[styles.tr, ri % 2 ? styles.trAlt : null]}>
                    {r.map((cell, ci) => (
                      <Text key={ci} style={[styles.td, colWidth(ci)]} numberOfLines={1}>
                        {cell === 0 ? '0' : String(cell ?? '')}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </ScrollView>
      )}

      {/* Татах */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.downloadBtn, { opacity: exporting || !rows.length ? 0.55 : 1 }]}
          onPress={download}
          disabled={exporting || !rows.length}
          activeOpacity={0.85}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <ExcelIcon size={19} />
              <Text style={styles.downloadText}>Excel татах</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/** Багана бүрийн өргөн — нэр урт, тоо богино. */
function colWidth(i) {
  if (i === 0) return { width: 40 };
  if (i === 1) return { width: 140 };
  if (i === 2) return { width: 110 };
  if (i === 10) return { width: 110 };
  return { width: 90 };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 1 },

  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
  },
  arrow: { padding: 4 },
  dateText: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 110, textAlign: 'center' },

  card: { backgroundColor: colors.surfaceContainer, borderRadius: 18, padding: spacing.lg },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  sumLabel: { color: colors.textMuted, fontSize: 13 },
  sumValue: { color: colors.text, fontSize: 13, fontWeight: '700' },

  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  table: { borderRadius: 12, overflow: 'hidden' },
  tr: { flexDirection: 'row' },
  trAlt: { backgroundColor: 'rgba(255,255,255,0.03)' },
  thead: { backgroundColor: colors.surfaceContainerHigh },
  th: { color: colors.textMuted, fontSize: 11, fontWeight: '700', padding: 10 },
  td: { color: colors.text, fontSize: 12, padding: 10 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  downloadText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
