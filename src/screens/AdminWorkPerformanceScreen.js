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
  Pressable,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenHeader, EmptyState } from '../components/ui';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { Segmented } from '../components/ds';
import { useTheme, useStyles } from '../context/ThemeContext';
import { formatDuration } from '../lib/workHours';
import * as perf from '../services/teamPerformanceService';
import * as perfFile from '../services/teamPerformanceExportService';

const CHART_FONT = Platform.select({ ios: 'System', android: 'GolosText_500Medium', default: 'Golos Text, system-ui, sans-serif' });
const one = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);

export default function AdminWorkPerformanceScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, currentUser, authProfile } = useApp();

  // Шүүлт: горим (өдөр/сар/жил) + тухайн горимын тулгуур цэг.
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(() => perf.currentAnchor('month'));
  const [tab, setTab] = useState('teams');
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

  // Prototype «Ажилчдын гүйцэтгэл»: Өдөр/Сар → хугацаа солих → 4 KPI (эхнийх
  // ногоон) → өдөр бүрийн stacked bar (Айл / Байгууллага) → тайлбар → Excel ·
  // Импорт · Загвар.
  const chartRows = mode === 'day'
    ? (result?.teams || []).map((t) => ({ key: t.teamKey, label: String(t.teamLabel || '').slice(0, 3), ail: t.ail || 0, org: t.baiguulga || 0 }))
    : periodRows.map((d) => ({ key: d.key, label: mode === 'year' ? String(d.key).slice(5, 7) : String(d.key).slice(8, 10), ail: d.ail || 0, org: d.baiguulga || 0 }));

  const header = (
    <View>
      <Segmented
        style={{ marginBottom: 12 }}
        value={mode}
        onChange={changeMode}
        options={perf.PERIOD_MODES.map((p) => ({ key: p.key, label: p.label }))}
      />

      <View style={styles.navRow}>
        <Pressable style={styles.navBtn} onPress={() => setAnchor(perf.shiftAnchor(mode, anchor, -1))} accessibilityLabel="Өмнөх">
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.navLabelBox} onPress={() => !atLatest && setAnchor(perf.currentAnchor(mode))}>
          <Text style={styles.navLabel} numberOfLines={1}>{range.label}</Text>
          {mode !== 'day' ? (
            <Text style={styles.navSub} numberOfLines={1}>{String(range.from).slice(5).replace('-', '.')} — {String(range.to).slice(5).replace('-', '.')}</Text>
          ) : null}
        </Pressable>
        <Pressable
          style={[styles.navBtn, atLatest && styles.navBtnOff]}
          disabled={atLatest}
          onPress={() => setAnchor(perf.shiftAnchor(mode, anchor, 1))}
          accessibilityLabel="Дараах"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.kgrid}>
        <Kpi styles={styles} hl value={s ? String(s.total) : '—'} label="Нийт ажил" sub={s ? `${s.days} өдөр ажилласан` : ''} />
        <Kpi styles={styles} value={s ? one(s.ailPerTeamDay) : '—'} label="Өдөрт айл" sub="1 багийн дундаж" />
        <Kpi styles={styles} value={s ? String(s.teams) : '—'} label="Нийт баг" sub={s ? `${s.teamDays} баг×өдөр` : ''} />
        <Kpi styles={styles} value={s ? formatDuration(s.msPerAil) : '—'} label="1 айлд" sub="дундаж хугацаа" />
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>
          {mode === 'day' ? 'Багуудын гүйцэтгэл' : mode === 'year' ? 'Сар бүрийн гүйцэтгэл' : 'Өдөр бүрийн гүйцэтгэл'}
        </Text>
        <StackedBars rows={chartRows} colors={colors} />
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.brand }]} /><Text style={styles.legendText}>Айл</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.warn }]} /><Text style={styles.legendText}>Байгууллага</Text></View>
        </View>
      </View>

      <Text style={styles.note}>
        Хугацааг ажлын байрны ирсэн/явсан бүртгэлээр тооцно. Бүртгэл байхгүй бол дуудлага үүсгэснээс хаагдах хүртэлх хугацаагаар тооцно.
      </Text>

      <View style={styles.actbar}>
        <ActionBtn styles={styles} colors={colors} icon="document-text-outline" label="Excel" primary onPress={doExport} loading={busy === 'export'} />
        <ActionBtn styles={styles} colors={colors} icon="cloud-upload-outline" label="Импорт" onPress={doImport} loading={busy === 'import'} />
        <ActionBtn styles={styles} colors={colors} icon="document-outline" label="Загвар" onPress={doTemplate} loading={busy === 'template'} />
      </View>

      {result?.importError ? (
        <Text style={styles.warn}>Импортын хүснэгт бэлэн биш: 20260821090000_team_performance.sql-ыг ажиллуулна уу.</Text>
      ) : null}
      {error ? <Text style={styles.warn}>{error}</Text> : null}

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable key={t.key} style={styles.tabBtn} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {tab === t.key ? <View style={styles.tabLine} /> : null}
          </Pressable>
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

function Kpi({ styles, value, label, sub, hl }) {
  return (
    <View style={[styles.kpi, hl && styles.kpiHl]}>
      <Text style={[styles.kpiValue, hl && styles.kpiOnHl]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.kpiLabel, hl && styles.kpiOnHl]}>{label}</Text>
      {sub ? <Text style={[styles.kpiSub, hl && styles.kpiSubHl]} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

/** Өдөр бүрийн stacked bar — доор Байгууллага (шар), дээр Айл (ногоон), орой дээр нийт. */
function StackedBars({ rows, colors }) {
  const [w, setW] = useState(0);
  const H = 150;
  const top = 16;
  const bottom = 22;
  const left = 22;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...rows.map((r) => r.ail + r.org));
  const nice = max <= 10 ? 10 : Math.ceil(max / 5) * 5;
  const n = Math.max(rows.length, 1);
  const slot = w > left ? (w - left) / n : 0;
  const bw = Math.max(4, Math.min(16, slot * 0.6));
  const y = (v) => top + plotH - (v / nice) * plotH;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w ? (
        <Svg width={w} height={H}>
          {[0, nice / 2, nice].map((t) => (
            <React.Fragment key={t}>
              <Line x1={left} x2={w} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
              <SvgText x={0} y={y(t) + 4} fontSize={10} fill={colors.faint} fontFamily={CHART_FONT}>{String(t)}</SvgText>
            </React.Fragment>
          ))}
          {rows.map((r, i) => {
            const cx = left + slot * i + slot / 2;
            const total = r.ail + r.org;
            const hOrg = (r.org / nice) * plotH;
            const hAil = (r.ail / nice) * plotH;
            return (
              <React.Fragment key={r.key}>
                {total ? (
                  <>
                    <Rect x={cx - bw / 2} y={y(total)} width={bw} height={hAil} rx={3} fill={colors.brand} />
                    {r.org ? <Rect x={cx - bw / 2} y={y(r.org)} width={bw} height={hOrg} rx={3} fill={colors.warn} /> : null}
                    <SvgText x={cx} y={y(total) - 4} fontSize={10} fontWeight="700" fill={colors.ink} textAnchor="middle" fontFamily={CHART_FONT}>{String(total)}</SvgText>
                  </>
                ) : null}
                {n <= 16 || i % Math.ceil(n / 12) === 0 ? (
                  <SvgText x={cx} y={H - 6} fontSize={9.5} fill={colors.faint} textAnchor="middle" fontFamily={CHART_FONT}>{r.label}</SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

function ActionBtn({ styles, colors, icon, label, primary, onPress, loading }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionBtn, primary && styles.actionPri, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? colors.brandInk : colors.ink} />
      ) : (
        <>
          <Ionicons name={icon} size={17} color={primary ? colors.brandInk : colors.ink} />
          <Text style={[styles.actionText, primary && { color: colors.brandInk }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  sep: { height: 0 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, ...shadow.md },
  navBtnOff: { opacity: 0.35 },
  navLabelBox: { flex: 1, alignItems: 'center' },
  navLabel: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  navSub: { color: colors.muted, fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },

  kgrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 18, padding: 14, ...shadow.md },
  kpiHl: { backgroundColor: colors.brand },
  kpiValue: { color: colors.ink, fontSize: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  kpiLabel: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 2 },
  kpiSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  kpiOnHl: { color: colors.brandInk },
  kpiSubHl: { color: colors.brandInk, opacity: 0.75 },

  chartCard: { backgroundColor: colors.card, borderRadius: 20, paddingTop: 16, paddingHorizontal: 12, paddingBottom: 12, marginBottom: 4, ...shadow.md },
  chartTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginHorizontal: 4, marginBottom: 10 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 6, marginHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 12.5 },

  note: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 10, marginHorizontal: 4 },
  warn: { color: colors.warn, fontSize: 12.5, marginTop: 8, fontWeight: '600' },

  actbar: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionPri: { backgroundColor: colors.brand, borderColor: colors.brand },
  actionText: { color: colors.ink, fontSize: 13, fontWeight: '700' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, marginTop: 18, marginBottom: 12 },
  tabBtn: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.ink },
  tabLine: { position: 'absolute', left: '18%', right: '18%', bottom: -1, height: 3, borderRadius: 3, backgroundColor: colors.brand },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, padding: 14, marginBottom: 10, ...shadow.md },
  cardBody: { flex: 1 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  faint: { color: colors.faint, fontSize: 11.5, marginTop: 2 },
  countBox: { alignItems: 'flex-end', maxWidth: 130 },
  countNum: { color: colors.brand, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countLabel: { color: colors.muted, fontSize: 11.5, marginTop: 2, textAlign: 'right' },
});
