import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { fetchSlaReport, formatSlaReportText } from '../../services/slaReportService';

const PERIODS = [
  { key: 'day', label: 'Өдөр' },
  { key: 'week', label: '7 хоног' },
  { key: 'month', label: 'Сар' },
];

export default function SlaReportScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const styles = useStyles(makeStyles);
  const [period, setPeriod] = useState('week');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Динамик хэмжээ тооцоолох
  const bodyPadding = 16; // spacing.lg
  const gap = 8; // spacing.sm
  const availableWidth = SCREEN_WIDTH - bodyPadding * 2;
  const kpiWidth = Math.floor((availableWidth - gap) - 1) / 2;

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const data = await fetchSlaReport(p);
      setReport(data);
    } catch {
      setReport({ stats: {}, byEngineer: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(period);
  }, [period, load]);

  const k = report?.stats || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SLA & KPI тайлан</Text>
      </View>

      <View style={styles.tabs}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.tab, period === p.key && styles.tabOn]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.tabText, period === p.key && styles.tabTextOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(period)} tintColor={colors.primary} />}
        >
          <View style={styles.grid}>
            <Kpi label="Нийт" value={k.total ?? 0} width={kpiWidth} styles={styles} />
            <Kpi label="Хаасан" value={k.closed ?? 0} width={kpiWidth} styles={styles} />
            <Kpi label="Нээлттэй" value={k.open ?? 0} width={kpiWidth} styles={styles} />
            <Kpi label="Compliance %" value={k.slaCompliancePct ?? '—'} width={kpiWidth} styles={styles} />
            <Kpi label="SLA 🔴 open" value={k.slaBreachedOpen ?? 0} width={kpiWidth} styles={styles} />
            <Kpi label="Avg хариу (мин)" value={k.avgFirstResponseMin ?? '—'} width={kpiWidth} styles={styles} />
            <Kpi label="Avg хаах (цаг)" value={k.avgCloseHours ?? '—'} width={kpiWidth} styles={styles} />
            <Kpi label="Revisit" value={k.revisitSites ?? 0} width={kpiWidth} styles={styles} />
          </View>

          <Text style={styles.section}>Инженерээр</Text>
          {(k.byEngineer || []).slice(0, 20).map((e) => (
            <View key={e.name} style={styles.row}>
              <Text style={styles.rowTitle}>{e.name}</Text>
              <Text style={styles.rowSub}>
                {e.closed}/{e.total} хаасан · open {e.open} · breach {e.breached}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.share}
            onPress={() => Share.share({ message: formatSlaReportText(report) })}
          >
            <Text style={styles.shareText}>Тайлан хуваалцах</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Kpi({ label, value, width, styles }) {
  return (
    <View style={[styles.kpi, { width }]}>
      <Text style={styles.kpiVal}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
    tabTextOn: { color: colors.primary },
    body: { padding: spacing.lg, paddingBottom: 60 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    kpi: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    kpiVal: { color: colors.text, fontSize: 22, fontWeight: '800' },
    kpiLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    section: { color: colors.text, fontWeight: '800', fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowTitle: { color: colors.text, fontWeight: '700' },
    rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    share: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    shareText: { color: colors.onPrimary || '#00363a', fontWeight: '800' },
  });
