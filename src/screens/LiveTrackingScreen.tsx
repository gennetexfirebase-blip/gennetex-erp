import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import TrackingMap, { TrackingMapHandle } from '../tracking/components/TrackingMap';
import { useTheme } from '../context/ThemeContext';
import { Avatar, Chip, FilterChips, RoundButton } from '../components/ds';
import TrackingBottomSheet from '../tracking/components/TrackingBottomSheet';
import { useLiveEmployees, useTrackingClock } from '../tracking/hooks/useLiveEmployees';
import { lastSeen, trackingStatus } from '../tracking/utils/locationUtils';

const FILTERS = [
  ['all', 'Бүгд'], ['online', 'Онлайн'], ['offline', 'Офлайн'], ['moving', 'Замд'],
] as const;

export default function LiveTrackingScreen({ navigation }: any) {
  const { isAdmin, isCloud, currentUser } = useApp();
  const focused = useIsFocused();
  const { employees, loading, error } = useLiveEmployees(isAdmin && isCloud && focused);
  const now = useTrackingClock();
  // Дизайны дагуу нээгдэхэд бүх ажилтныг харуулна; төлөвөөр filter-ээс шүүнэ.
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const [query, setQuery] = useState('');
  const [selected, select] = useState<string>();
  const [satellite, setSatellite] = useState(false);
  const map = useRef<TrackingMapHandle>(null);
  const { colors, shadow } = useTheme();
  // Доод хуудас: 34% → дарахад 78% (design §4 Байршил хяналт).
  const [big, setBig] = useState(false);

  const statusFor = (point: any) => {
    const base = trackingStatus(point, now);
    if (base === 'offline') return 'offline';
    if ((point.speed || 0) >= 0.5) return 'moving';
    if (point.speed != null) return 'stopped';
    return 'online';
  };
  const counts = useMemo(() => ({
    all: employees.length,
    online: employees.filter((point) => trackingStatus(point, now) !== 'offline').length,
    offline: employees.filter((point) => trackingStatus(point, now) === 'offline').length,
    moving: employees.filter((point) => statusFor(point) === 'moving').length,
    stopped: employees.filter((point) => statusFor(point) === 'stopped').length,
  }), [employees, now]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((point) => {
      const passesFilter = filter === 'all' || (filter === 'online' ? trackingStatus(point, now) !== 'offline' : statusFor(point) === filter);
      const passesSearch = !needle || String(point.name || point.employee_id).toLowerCase().includes(needle);
      return passesFilter && passesSearch;
    });
  }, [employees, filter, query, now]);

  if (!isAdmin || !isCloud) {
    return (
      <SafeAreaView style={[styles.denied, { backgroundColor: colors.ground }]}>
        <Ionicons name="lock-closed-outline" size={36} color={colors.brand} />
        <Text style={[styles.deniedTitle, { color: colors.ink }]}>Байршил хяналт</Text>
        <Text style={[styles.deniedText, { color: colors.muted }]}>Энэ хэсэгт нэвтэрсэн админ хандах эрхтэй.</Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.deniedButton, { backgroundColor: colors.brand }]}>
          <Text style={[styles.deniedButtonText, { color: colors.brandInk }]}>Буцах</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const statusText = (s: string) => (s === 'moving' ? 'Онлайн · Замд' : s === 'stopped' ? 'Онлайн · Зогсож байна' : s === 'offline' ? 'Офлайн' : 'Онлайн');

  return (
    <View style={[styles.root, { backgroundColor: colors.ground }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.ground, zIndex: 2 }}>
        <View style={styles.subhead}>
          <RoundButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Буцах" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: colors.ink }]}>Байршил хяналт</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{employees.length} ажилтан бүртгэлтэй</Text>
          </View>
          <View style={[styles.onlinePill, { backgroundColor: colors.okSoft || colors.brandSoft }]}>
            <View style={[styles.onlineRing, { borderColor: colors.ok }]}><View style={[styles.onlineDot, { backgroundColor: colors.ok }]} /></View>
            <Text style={[styles.onlineText, { color: colors.ok }]}>{counts.online} онлайн</Text>
          </View>
        </View>
        <View style={styles.livetop}>
          <View style={[styles.search, { backgroundColor: colors.card }, shadow.md]}>
            <Ionicons name="search" size={19} color={colors.faint} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Ажилтан хайх…" placeholderTextColor={colors.faint} style={[styles.searchInput, { color: colors.ink }]} />
          </View>
          <FilterChips
            style={{ marginHorizontal: -16 }}
            value={filter}
            onChange={(k: any) => setFilter(k)}
            items={FILTERS.map(([key, label]) => ({
              key,
              label,
              count: counts[key],
              dot: key === 'online' ? colors.ok : key === 'offline' ? colors.faint : key === 'moving' ? colors.brand : undefined,
            }))}
          />
        </View>
      </SafeAreaView>

      <View style={[styles.mapWrap, { backgroundColor: colors.mapBg }]}>
        <TrackingMap ref={map} employees={shown} now={now} onSelect={select} selected={selected} satellite={satellite} meId={(currentUser as any)?.id} />
        {loading ? (
          <View style={[styles.loading, { backgroundColor: colors.bg }, shadow.md]}>
            <ActivityIndicator color={colors.brand} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>Байршил ачаалж байна…</Text>
          </View>
        ) : null}
        {error ? <View style={[styles.error, { backgroundColor: colors.badSoft }]}><Text style={[styles.errorText, { color: colors.bad }]}>{error}</Text></View> : null}
        <View style={styles.mctl}>
          <Pressable style={[styles.mapControl, { backgroundColor: colors.bg }]} onPress={() => setSatellite((v) => !v)} accessibilityRole="button" accessibilityLabel="Хиймэл дагуулын зураг">
            <Ionicons name="layers-outline" size={20} color={satellite ? colors.brand : colors.ink} />
          </Pressable>
          <Pressable style={[styles.mapControl, { backgroundColor: colors.bg }]} onPress={() => map.current?.command('current')} accessibilityRole="button" accessibilityLabel="Ажилтан руу шилжих">
            <Ionicons name="navigate-outline" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.lsheet, { backgroundColor: colors.card, height: big ? '78%' : '34%' }]}>
        <Pressable onPress={() => setBig((v) => !v)} style={styles.grabbtn} accessibilityRole="button" accessibilityLabel={big ? 'Жижигрүүлэх' : 'Томруулах'}>
          <View style={[styles.grab, { backgroundColor: colors.line }]} />
        </Pressable>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>Ажилтнууд</Text>
          <Chip text={String(shown.length)} tone="muted" />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.employeeList}>
          {shown.map((point, index) => {
            const state = statusFor(point);
            const dot = state === 'offline' ? colors.faint : state === 'moving' ? colors.brand : colors.ok;
            const sel = selected === point.employee_id;
            const name = point.name || `Ажилтан ${index + 1}`;
            return (
              <Pressable
                key={point.employee_id}
                style={[styles.lrow, sel && { backgroundColor: colors.field }]}
                onPress={() => { select(point.employee_id); map.current?.command('current'); }}
              >
                <View>
                  <Avatar uri={point.avatar_url} name={name} size={44} />
                  <View style={[styles.st, { backgroundColor: dot, borderColor: colors.card }]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.lrowName, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.lrowMeta, { color: colors.muted }]} numberOfLines={1}>{statusText(state)} · {lastSeen(point.timestamp, now)}</Text>
                </View>
                <Text style={[styles.accu, { color: colors.faint }]}>{point.accuracy == null ? '—' : `±${Math.round(point.accuracy)} м`}</Text>
                <View style={[styles.go, { backgroundColor: colors.brandSoft }]}>
                  <Ionicons name="location-outline" size={18} color={colors.brand} />
                </View>
              </Pressable>
            );
          })}
          {!loading && !shown.length ? <Text style={[styles.empty, { color: colors.muted }]}>Энэ шүүлтэд байршил алга.</Text> : null}
        </ScrollView>
      </View>

      <TrackingBottomSheet point={employees.find((point) => point.employee_id === selected)} now={now} onClose={() => select(undefined)} onDetail={() => { const employeeId = selected; select(undefined); navigation.navigate('EmployeeLiveTracking', { employeeId }); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  subhead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, marginTop: 2 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, height: 32, borderRadius: 16 },
  onlineRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { fontSize: 13, fontWeight: '700' },
  livetop: { paddingHorizontal: 16, paddingBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  mapWrap: { flex: 1, minHeight: 360 },
  loading: { position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  loadingText: { fontSize: 12 },
  error: { position: 'absolute', left: 14, right: 70, top: 12, padding: 10, borderRadius: 12 },
  errorText: { fontSize: 12 },
  mctl: { position: 'absolute', right: 12, top: 12, gap: 8 },
  mapControl: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#0F1722', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 10 },
  lsheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 18, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 20 },
  grabbtn: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  employeeList: { paddingHorizontal: 8, paddingBottom: 30 },
  lrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14 },
  st: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5 },
  lrowName: { fontSize: 15, fontWeight: '700' },
  lrowMeta: { fontSize: 12.5, marginTop: 1 },
  accu: { fontSize: 12, fontVariant: ['tabular-nums'] },
  go: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', paddingVertical: 30 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  deniedTitle: { fontSize: 22, fontWeight: '700', marginTop: 14 },
  deniedText: { textAlign: 'center', marginTop: 8 },
  deniedButton: { borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14, marginTop: 22 },
  deniedButtonText: { fontWeight: '700' },
});
