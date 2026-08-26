/**
 * Ажилчдын гүйцэтгэл (админ).
 *
 * Дөрвөн асуултад ХАРИУЛНА:
 *   Нийт хэдэн баг · өдөрт хэдэн айл · нийт хэр хугацаанд · 1 баг өдөрт
 *   хэдэн айл.
 *
 * Тооцоолол нь бүхэлдээ `teamPerformanceService` дотор — энэ файл зөвхөн
 * харуулна. Ингэснээр admin-web дэх ижил тайлантай тоо зөрөхгүй.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenHeader, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { formatDuration } from '../lib/workHours';
import PerformanceChart from '../components/PerformanceChart';
import * as perf from '../services/teamPerformanceService';
import * as perfFile from '../services/teamPerformanceExportService';

const one = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);

export default function AdminWorkPerformanceScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, currentUser, authProfile } = useApp();

  // Шүүлт: горим (өдөр/сар/жил) + тухайн горимын тулгуур цэг.
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(() => perf.currentAnchor('month'));
  const [tab, setTab] = useState('teams');
  const [metric, setMetric] = useState('work');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const range = useMemo(() => perf.periodRange(mode, anchor), [mode, anchor]);
  const atLatest = perf.isAtLatestPeriod(mode, anchor);

  const changeMode = (next) => {
    setMode(next);
    setAnchor((prev) => perf.normalizeAnchor(next, prev));
    // Жилийн горимд өдрийн жагсаалт хэт урт болно — сарын хүснэгт рүү.
    setTab((prev) => (prev === 'detail' && next === 'year' ? 'days' : prev));
  };

  const load = useCallback(async () => {
    if (!isCloud || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await perf.buildTeamPerformance({ from: range.from, to: range.to, mode });
      setResult(res);
    } catch (e) {
      setError(e?.message || 'Тайлан бэлдэж чадсангүй');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [isCloud, isAdmin, range.from, range.to, mode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doExport = async () => {
    if (!result?.rows.length) {
      Alert.alert('Excel', 'Татах мэдээлэл алга.');
      return;
    }
    setBusy('export');
    try {
      await perfFile.exportPerformanceExcel(result);
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Excel гаргаж чадсангүй');
    } finally {
      setBusy('');
    }
  };

  const doTemplate = async () => {
    setBusy('template');
    try {
      await perfFile.shareImportTemplate();
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Загвар гаргаж чадсангүй');
    } finally {
      setBusy('');
    }
  };

  const doImport = async () => {
    setBusy('import');
    try {
      const parsed = await perfFile.pickAndParseImportFile();
      if (!parsed) return;
      if (!parsed.rows.length) {
        Alert.alert('Импорт', parsed.errors.join('\n') || 'Оруулах мөр олдсонгүй.');
        return;
      }
      const preview = parsed.rows
        .slice(0, 5)
        .map((r) => `${r.work_date} · ${r.team_name} · ${r.ail_count} айл`)
        .join('\n');
      const warn = parsed.errors.length
        ? `\n\nАлгассан ${parsed.skipped} мөр:\n${parsed.errors.slice(0, 5).join('\n')}`
        : '';
      Alert.alert(
        'Импортлох уу?',
        `${parsed.fileName}\n${parsed.rows.length} мөр:\n\n${preview}${parsed.rows.length > 5 ? '\n…' : ''}${warn}\n\nНэг өдөр · нэг багийн хуучин мөр байвал ДАРАГДАНА.`,
        [
          { text: 'Болих', style: 'cancel' },
          {
            text: 'Импортлох',
            onPress: async () => {
              try {
                const saved = await perf.saveImportedRows(parsed.rows, {
                  userId: currentUser?.id,
                  userName: authProfile?.name,
                  batchName: parsed.fileName,
                });
                Alert.alert('Импорт', `${saved.inserted} мөр хадгалагдлаа.`);
                load();
              } catch (e) {
                Alert.alert('Алдаа', e?.message || 'Хадгалж чадсангүй');
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Файл уншиж чадсангүй');
    } finally {
      setBusy('');
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажилчдын гүйцэтгэл" />
        <EmptyState text="Энэ хэсгийг зөвхөн админ харна." />
      </View>
    );
  }
  if (!isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажилчдын гүйцэтгэл" />
        <EmptyState text="Supabase холболт шаардлагатай." />
      </View>
    );
  }

  const s = result?.summary;

  // Жилийн горимд «Өдрөөр» гэсэн хүснэгт 365 мөр болно — сараар харуулна.
  const periodTabLabel = mode === 'year' ? 'Сараар' : 'Өдрөөр';
  const periodRows = mode === 'year' ? result?.months || [] : result?.days || [];
  const tabs = [
    { key: 'teams', label: 'Багаар' },
    { key: 'days', label: periodTabLabel },
    { key: 'detail', label: 'Дэлгэрэнгүй' },
  ];

  const header = (
    <View>
      <View style={styles.chipRow}>
        {perf.PERIOD_MODES.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.chip, mode === p.key && styles.chipActive]}
            onPress={() => changeMode(p.key)}
          >
            <Text style={[styles.chipText, mode === p.key && styles.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Сонгосон өдөр · сар · жил дээгүүр урагш хойш алхна. */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setAnchor(perf.shiftAnchor(mode, anchor, -1))}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navLabelBox}>
          <Text style={styles.navLabel} numberOfLines={1}>{range.label}</Text>
          {mode !== 'day' ? (
            <Text style={styles.navSub} numberOfLines={1}>{range.from} — {range.to}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.navBtn, atLatest && styles.navBtnOff]}
          disabled={atLatest}
          onPress={() => setAnchor(perf.shiftAnchor(mode, anchor, 1))}
        >
          <Ionicons name="chevron-forward" size={18} color={atLatest ? colors.textFaint : colors.text} />
        </TouchableOpacity>
        {!atLatest ? (
          <TouchableOpacity style={styles.todayBtn} onPress={() => setAnchor(perf.currentAnchor(mode))}>
            <Text style={styles.todayText}>Одоо</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {s ? (
        <View style={styles.statGrid}>
          <Stat styles={styles} label="Нийт баг" value={s.teams} sub={`${s.days} өдөр ажилласан`} />
          <Stat styles={styles} label="Өдөрт айл" value={one(s.ailPerDay)} sub={`нийт ${s.ail} айл`} />
          <Stat
            styles={styles}
            label="1 баг өдөрт айл"
            value={one(s.ailPerTeamDay)}
            sub={`${s.teamDays} баг×өдөр`}
            highlight
          />
          <Stat
            styles={styles}
            label="Нийт хугацаа"
            value={formatDuration(s.durationMs)}
            sub={`1 айлд ${formatDuration(s.msPerAil)}`}
            wide
          />
        </View>
      ) : null}

      {result?.chart?.points?.length ? (
        <PerformanceChart
          chart={result.chart}
          metric={metric}
          onMetricChange={setMetric}
          title={
            mode === 'day'
              ? 'Багууд — тухайн өдөр'
              : mode === 'year'
                ? 'Сар бүрийн үзүүлэлт'
                : 'Өдөр бүрийн үзүүлэлт'
          }
        />
      ) : null}

      {s ? (
        <Text style={styles.note}>
          Байгууллага: {s.baiguulga} · нийт ажил {s.total}. Хугацааг ажлын байрны ирсэн/явсан
          бүртгэлээр, байхгүй бол дуудлага үүсэхээс хаагдтал хугацаагаар тооцов.
        </Text>
      ) : null}

      <View style={styles.btnRow}>
        <ActionBtn styles={styles} colors={colors} icon="bar-chart-outline" label="Excel + график" tone="success" onPress={doExport} loading={busy === 'export'} />
        <ActionBtn styles={styles} colors={colors} icon="cloud-upload-outline" label="Excel импорт" tone="primary" onPress={doImport} loading={busy === 'import'} />
        <ActionBtn styles={styles} colors={colors} icon="document-text-outline" label="Загвар" tone="ghost" onPress={doTemplate} loading={busy === 'template'} />
      </View>

      {result?.importError ? (
        <Text style={styles.warn}>
          Импортын хүснэгт бэлэн биш: 20260821090000_team_performance.sql-ыг ажиллуулна уу.
        </Text>
      ) : null}
      {error ? <Text style={styles.warn}>{error}</Text> : null}

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTeam = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{item.teamLabel}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.days} өдөр · {item.baiguulga} байгууллага · {formatDuration(item.durationMs)}
        </Text>
        <Text style={styles.faint}>Сүүлд: {item.lastDay} · 1 айлд {formatDuration(item.msPerAil)}</Text>
      </View>
      <View style={styles.countBox}>
        <Text style={styles.countNum}>{item.ail}</Text>
        <Text style={styles.countLabel}>айл · өдөрт {one(item.ailPerDay)}</Text>
      </View>
    </View>
  );

  const renderPeriod = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.label}</Text>
        <Text style={styles.sub}>
          {item.teams} баг{mode === 'year' ? ` · ${item.days} өдөр` : ''} · {item.baiguulga} байгууллага ·{' '}
          {formatDuration(item.durationMs)}
        </Text>
      </View>
      <View style={styles.countBox}>
        <Text style={styles.countNum}>{item.ail}</Text>
        <Text style={styles.countLabel}>айл · 1 баг {one(item.ailPerTeam)}</Text>
      </View>
    </View>
  );

  const renderDetail = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{item.teamLabel}</Text>
        <Text style={styles.sub}>
          {item.dayKey} · {item.calls} дуудлага · {item.sessions} ажлын байр
        </Text>
        <Text style={styles.faint}>
          {formatDuration(item.durationMs)} ({item.durationSource})
        </Text>
      </View>
      <View style={styles.countBox}>
        <Text style={styles.countNum}>{item.ail}</Text>
        <Text style={styles.countLabel}>айл{item.baiguulga ? ` · ${item.baiguulga} байг` : ''}</Text>
      </View>
    </View>
  );

  const config = {
    teams: { data: result?.teams || [], keyExtractor: (t) => t.teamKey, renderItem: renderTeam },
    days: { data: periodRows, keyExtractor: (d) => d.key, renderItem: renderPeriod },
    detail: { data: result?.rows || [], keyExtractor: (r) => r.key, renderItem: renderDetail },
  }[tab];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Ажилчдын гүйцэтгэл"
        subtitle={loading ? 'Тооцоолж байна…' : range.label}
      />
      <FlatList
        data={config.data}
        keyExtractor={config.keyExtractor}
        renderItem={config.renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? null : <EmptyState text="Энэ хугацаанд бүртгэгдсэн ажил алга." />
        }
      />
    </View>
  );
}

function Stat({ styles, label, value, sub, highlight, wide }) {
  return (
    <View style={[styles.stat, wide && styles.statWide, highlight && styles.statHighlight]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

function ActionBtn({ styles, colors, icon, label, tone, onPress, loading }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, styles[`action_${tone}`]]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone === 'ghost' ? colors.text : '#fff'} />
      ) : (
        <>
          <Ionicons name={icon} size={16} color={tone === 'ghost' ? colors.text : '#fff'} />
          <Text style={[styles.actionText, tone === 'ghost' && { color: colors.text }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  sep: { height: spacing.sm },

  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff' },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navBtnOff: { opacity: 0.4 },
  navLabelBox: { flex: 1, alignItems: 'center' },
  navLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  navSub: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  todayText: { color: colors.primary, fontSize: 12, fontWeight: '800' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statWide: { flexBasis: '100%' },
  statHighlight: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  statSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },

  note: { color: colors.textFaint, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  warn: { color: colors.warning, fontSize: 12, marginTop: spacing.sm, fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  action_success: { backgroundColor: colors.success },
  action_primary: { backgroundColor: colors.primary },
  action_ghost: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  tabRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#fff' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardBody: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  faint: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  countBox: { alignItems: 'flex-end', maxWidth: 130 },
  countNum: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  countLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2, textAlign: 'right' },
});
