import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { Badge, ScreenHeader, EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CALL_TYPES } from '../data/mockData';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as tracking from '../services/trackingService';

function callTypeLabel(key) {
  const t = CALL_TYPES.find((x) => x.key === key);
  return t ? `${t.label}` : null;
}

function initials(name) {
  if (!name) return ' ?';
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const UB_REGION = {
  latitude: 47.9185,
  longitude: 106.9176,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

function timeAgo(ts) {
  if (!ts) return 'мэдээлэлгүй';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'дөнгөж сая';
  if (m < 60) return `${m} мин өмнө`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг өмнө`;
  return `${Math.floor(h / 24)} өдөр өмнө`;
}

function WorkerMarker({ worker, color, visit, onPress }) {
  const styles = useStyles(makeStyles);
  const [tracks, setTracks] = useState(!!worker.avatar_url);

  return (
    <Marker
      coordinate={{ latitude: worker.latitude, longitude: worker.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      title={worker.name || 'Ажилтан'}
      description={
        visit
          ? ` ${visit.customer || 'Айл'}${visit.problem ? '· ' + visit.problem : ''}`
          : timeAgo(worker.last_seen)
      }
      onPress={onPress}
    >
      <View style={[styles.marker, { borderColor: color }]}>
        {worker.avatar_url ? (
          <Image
            source={{ uri: worker.avatar_url }}
            style={styles.markerImg}
            onLoad={() => setTracks(false)}
            onError={() => setTracks(false)}
          />
        ) : (
          <View style={[styles.markerFallback, { backgroundColor: color }]}>
            <Text style={styles.markerInitials}>{initials(worker.name)}</Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

export default function LiveLocationScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud, isAdmin, trackingState } = useApp();
  const [workers, setWorkers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [tab, setTab] = useState('workers'); // workers | visits
  const mapRef = useRef(null);

  const load = async () => {
    if (!isCloud) return;
    try {
      const [w, v] = await Promise.all([tracking.fetchWorkers(), tracking.fetchVisitLogs()]);
      setWorkers(w);
      setVisits(v);
    } catch (e) {}
  };

  useEffect(() => {
    load();
    if (!isCloud) return;
    const unsub = tracking.subscribeWorkers(() => load());
    const timer = setInterval(load, 20000);
    return () => {
      unsub?.();
      clearInterval(timer);
    };
  }, [isCloud]);

  // Ажилтан бүрийн хамгийн сүүлд очсон айл (visits нь arrived_at-аар буурахаар эрэмбэлэгдсэн)
  const latestVisitByUser = useMemo(() => {
    const map = {};
    for (const v of visits) {
      if (v.user_id && !map[v.user_id]) map[v.user_id] = v;
    }
    return map;
  }, [visits]);

  const located = workers
    .filter((w) => w.latitude != null && w.longitude != null)
    .map((w, i) => ({ ...w, color: COLORS[i % COLORS.length], visit: latestVisitByUser[w.id] }));

  return (
    <View style={styles.container}>
      <ScreenHeader title={isAdmin ? 'Ажилчдын хяналт' : 'Байршил'}
        subtitle={`${isCloud ? 'Supabase' : 'Локал'} · ${located.length} online`}
        right={
          <Badge
            text={trackingState?.active ? 'Илгээж байна' : 'Идэвхгүй'}
            color={trackingState?.active ? colors.success : colors.textFaint}
          />
        }
      />

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={UB_REGION}
        showsUserLocation
      >
        {located.map((w) => (
          <WorkerMarker
            key={w.id}
            worker={w}
            color={w.color}
            visit={w.visit}
            onPress={() => mapRef.current?.animateToRegion?.({
              latitude: w.latitude,
              longitude: w.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 400)}
          />
        ))}
      </MapView>

      <View style={styles.panel}>
        {!isCloud ? (
          <Text style={styles.note}>
            Supabase холбогдоогүй тул бусад ажилчдын байршил харагдахгүй.
          </Text>
        ) : (
          <>
            <View style={styles.tabs}>
              <Tab active={tab === 'workers'} label={`Ажилчид (${located.length})`} onPress={() => setTab('workers')} />
              <Tab active={tab === 'visits'} label={`Очсон лог (${visits.length})`} onPress={() => setTab('visits')} />
            </View>

            <ScrollView style={{ maxHeight: 220 }}>
              {tab === 'workers' ? (
                located.length === 0 ? (
                  <EmptyState text="Online ажилтан алга."/>
                ) : (
                  located.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={styles.row}
                      activeOpacity={0.7}
                      onPress={() => mapRef.current?.animateToRegion?.({
                        latitude: w.latitude,
                        longitude: w.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }, 400)}
                    >
                      <View style={[styles.rowAvatar, { borderColor: w.color }]}>
                        {w.avatar_url ? (
                          <Image source={{ uri: w.avatar_url }} style={styles.rowAvatarImg} />
                        ) : (
                          <View style={[styles.markerFallback, { backgroundColor: w.color }]}>
                            <Text style={styles.markerInitials}>{initials(w.name)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{w.name || 'Нэргүй'}</Text>
                        {w.visit ? (
                          <Text style={styles.rowActivity} numberOfLines={1}>
                             {w.visit.customer || 'Айл'}
                            {callTypeLabel(w.visit.call_type) ? ` · ${callTypeLabel(w.visit.call_type)}` : ''}
                            {w.visit.problem ? ` · ${w.visit.problem}` : ''}
                          </Text>
                        ) : (
                          <Text style={styles.rowSub}>
                            {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.rowTime}>{timeAgo(w.last_seen)}</Text>
                    </TouchableOpacity>
                  ))
                )
              ) : visits.length === 0 ? (
                <EmptyState text="Очсон бүртгэл алга." />
              ) : (
                visits.map((v) => (
                  <View key={v.id} style={styles.row}>
                    <Text style={{ fontSize: 18, marginRight: spacing.sm }}></Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{v.customer || 'Айл'}</Text>
                      <Text style={styles.rowSub}>
                         {v.user_name}
                        {callTypeLabel(v.call_type) ? ` · ${callTypeLabel(v.call_type)}` : ''}
                        {v.problem ? ` · ${v.problem}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.rowTime}>{timeAgo(v.arrived_at)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

function Tab({ active, label, onPress }) {
  const styles = useStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },
  panel: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: -radius.xl,
    ...shadow.md,
  },
  note: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '700'},
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowActivity: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: '600'},
  rowTime: { color: colors.textFaint, fontSize: 11 },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  rowAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover'},
  marker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadow.md,
  },
  markerImg: { width: '100%', height: '100%', resizeMode: 'cover'},
  markerFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'},
  markerInitials: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
