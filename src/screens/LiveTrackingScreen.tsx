import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import TrackingMap from '../tracking/components/TrackingMap';
import TrackingBottomSheet from '../tracking/components/TrackingBottomSheet';
import { useLiveEmployees, useTrackingClock } from '../tracking/hooks/useLiveEmployees';
import { lastSeen, trackingStatus } from '../tracking/utils/locationUtils';

const FILTERS = [
  ['all', 'Бүгд'], ['online', 'Online'], ['offline', 'Offline'], ['moving', 'Замд'], ['stopped', 'Зогсож байгаа'],
] as const;

export default function LiveTrackingScreen({ navigation }: any) {
  const { isAdmin, isCloud } = useApp();
  const focused = useIsFocused();
  const { employees, loading, error } = useLiveEmployees(isAdmin && isCloud && focused);
  const now = useTrackingClock();
  // Live Tracking нээгдэхэд ажиллаж, байршлаа илгээж буй хүмүүсийг
  // шууд харуулна. Бусад төлөвийг дээрх filter-ээс сонгож болно.
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('online');
  const [query, setQuery] = useState('');
  const [selected, select] = useState<string>();

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
    return <SafeAreaView style={styles.denied}><Ionicons name="lock-closed-outline" size={36} color="#087cff" /><Text style={styles.deniedTitle}>Live Tracking</Text><Text style={styles.deniedText}>Энэ хэсэгт нэвтэрсэн админ хандах эрхтэй.</Text><Pressable onPress={() => navigation.goBack()} style={styles.deniedButton}><Text style={styles.deniedButtonText}>Буцах</Text></Pressable></SafeAreaView>;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityRole="button"><Ionicons name="chevron-back" size={24} color="#fff" /></Pressable>
          <View style={styles.heading}><Text style={styles.title}>LIVE TRACKING</Text><Text style={styles.subtitle}>Ажилтнуудын байршил ({employees.length})</Text></View>
          <View style={styles.onlineWrap}><View style={styles.onlineDot} /><Text style={styles.onlineText}>{counts.online} онлайн</Text></View>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}><Ionicons name="search-outline" size={23} color="#b8c5d4" /><TextInput value={query} onChangeText={setQuery} placeholder="Ажилтан хайх..." placeholderTextColor="#b8c5d4" style={styles.searchInput} /></View>
          <Pressable style={styles.filterButton}><Ionicons name="options-outline" size={25} color="#fff" /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([id, label]) => (
            <Pressable key={id} onPress={() => setFilter(id)} style={[styles.chip, filter === id && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: filter === id }}>
              <Text style={[styles.chipText, filter === id && styles.chipTextActive]}>{label}</Text>
              <View style={[styles.chipCount, filter === id && styles.chipCountActive]}><Text style={[styles.chipCountText, filter === id && styles.chipCountTextActive]}>{counts[id]}</Text></View>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>

      <View style={styles.mapWrap}>
        <TrackingMap employees={shown} now={now} onSelect={select} />
        {loading ? <View style={styles.loading}><ActivityIndicator color="#087cff" /><Text style={styles.loadingText}>Байршил ачаалж байна…</Text></View> : null}
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.mapControls}>
          <Pressable style={styles.mapControl}><Ionicons name="layers-outline" size={22} color="#0c2444" /></Pressable>
          <Pressable style={styles.mapControl}><Ionicons name="navigate" size={22} color="#087cff" /></Pressable>
        </View>
      </View>

      <View style={styles.nearbySheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Ойролцоо байгаа ажилтнууд</Text><Text style={styles.sheetCount}>{shown.length}</Text></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.employeeList}>
          {shown.slice(0, 8).map((point, index) => {
            const state = statusFor(point);
            const color = state === 'offline' ? '#a6b3c3' : state === 'moving' ? '#ff9700' : state === 'stopped' ? '#9b5cff' : '#17c989';
            return <Pressable key={point.employee_id} style={styles.employeeRow} onPress={() => select(point.employee_id)}>
              <View style={[styles.avatar, { borderColor: color }]}><Text style={styles.avatarText}>{String(point.name || 'А').trim().charAt(0).toUpperCase()}</Text><View style={[styles.statusDot, { backgroundColor: color }]} /></View>
              <View style={styles.employeeCopy}><Text style={styles.employeeName} numberOfLines={1}>{point.name || `Ажилтан ${index + 1}`}</Text><Text style={styles.employeeMeta}>{state === 'moving' ? 'Замд' : state === 'stopped' ? 'Зогсож байна' : state === 'offline' ? 'Offline' : 'Онлайн'} · {lastSeen(point.timestamp, now)}</Text></View>
              <Text style={styles.distance}>{point.accuracy == null ? '—' : `±${Math.round(point.accuracy)} м`}</Text>
              <View style={styles.rowAction}><Ionicons name="location" size={20} color="#087cff" /></View>
            </Pressable>;
          })}
          {!loading && !shown.length ? <Text style={styles.empty}>Энэ шүүлтэд байршил алга.</Text> : null}
        </ScrollView>
      </View>

      <TrackingBottomSheet point={employees.find((point) => point.employee_id === selected)} now={now} onClose={() => select(undefined)} onDetail={() => { const employeeId = selected; select(undefined); navigation.navigate('EmployeeLiveTracking', { employeeId }); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef4f8' },
  header: { backgroundColor: '#142638', paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 6 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, heading: { flex: 1 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: .2 }, subtitle: { color: '#c6d1dd', fontSize: 13, marginTop: 2 },
  onlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 }, onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#28d88f' }, onlineText: { color: '#eaf2f8', fontSize: 12 },
  searchRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 16, marginTop: 14 },
  searchBox: { flex: 1, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.11)', borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingHorizontal: 10 },
  filterButton: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8, paddingHorizontal: 16, paddingTop: 13 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,.11)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)' }, chipActive: { backgroundColor: '#2fc7f3', borderColor: '#2fc7f3' },
  chipText: { color: '#edf3f8', fontSize: 12.5, fontWeight: '700' }, chipTextActive: { color: '#08304b' }, chipCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' }, chipCountActive: { backgroundColor: '#1266d5' }, chipCountText: { color: '#fff', fontSize: 11, fontWeight: '900' }, chipCountTextActive: { color: '#fff' },
  mapWrap: { flex: 1, minHeight: 360 },
  loading: { position: 'absolute', top: 14, alignSelf: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 }, loadingText: { color: '#38516e', fontSize: 12 },
  error: { position: 'absolute', left: 14, right: 14, top: 12, padding: 10, borderRadius: 12, backgroundColor: '#fff0ee' }, errorText: { color: '#b42318', fontSize: 12 },
  mapControls: { position: 'absolute', right: 16, top: 18, gap: 10 }, mapControl: { width: 49, height: 49, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  nearbySheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 265, backgroundColor: 'rgba(250,252,255,.98)', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 16, elevation: 18 },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#a9b4bf', alignSelf: 'center', marginTop: 9, marginBottom: 12 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 }, sheetTitle: { color: '#0a1931', fontSize: 18, fontWeight: '900' }, sheetCount: { color: '#087cff', fontSize: 12, fontWeight: '900', backgroundColor: '#e5f2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }, employeeList: { paddingBottom: 16, gap: 7 },
  employeeRow: { minHeight: 68, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: 9, borderWidth: 1, borderColor: '#edf1f5' }, avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, backgroundColor: '#e9f1f7', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#183452', fontSize: 18, fontWeight: '900' }, statusDot: { position: 'absolute', right: -2, top: -2, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#fff' }, employeeCopy: { flex: 1, paddingHorizontal: 11 }, employeeName: { color: '#10213d', fontSize: 14, fontWeight: '900' }, employeeMeta: { color: '#61738a', fontSize: 11.5, marginTop: 3 }, distance: { color: '#324c6b', fontSize: 11, fontWeight: '700' }, rowAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e9f4ff', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, empty: { color: '#61738a', textAlign: 'center', paddingVertical: 30 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f5f9fc' }, deniedTitle: { fontSize: 25, fontWeight: '900', color: '#10213d', marginTop: 14 }, deniedText: { color: '#61738a', textAlign: 'center', marginTop: 8 }, deniedButton: { backgroundColor: '#087cff', borderRadius: 20, paddingHorizontal: 28, paddingVertical: 12, marginTop: 22 }, deniedButtonText: { color: '#fff', fontWeight: '800' },
});
