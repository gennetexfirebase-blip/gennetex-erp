import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, ScreenHeader, EmptyState } from '../components/ui';
import AutoboxTables from '../components/AutoboxTables';
import MongoliaPlate from '../components/MongoliaPlate';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as vehicleApi from '../services/vehicleService';
import * as autoboxApi from '../services/autoboxService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyAdmins, showLocalNotification } from '../services/notificationService';

export default function VehicleSpecsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud } = useApp();
  const [list, setList] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoboxData, setAutoboxData] = useState(null);
  const [autoboxLoading, setAutoboxLoading] = useState(false);
  const [autoboxError, setAutoboxError] = useState(null);
  const [autoboxStatus, setAutoboxStatus] = useState('');
  const autoboxHashRef = useRef('');

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const [veh, tr] = await Promise.all([vehicleApi.fetchVehicles(), vehicleApi.fetchTrips(800).catch(() => [])]);
      setList(veh);
      setTrips(tr || []);
    } catch (e) {
      setAutoboxError(e.message);
    }
  }, [isCloud]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadAutobox = useCallback(async (plate, { silent = false } = {}) => {
    if (!plate) return;
    if (!silent) {
      setAutoboxLoading(true);
      setAutoboxError(null);
      setAutoboxStatus('Мэдээлэл уншиж байна...');
    }
    try {
      const json = await autoboxApi.fetchAutoboxVehicle(plate);
      if (silent && json.hash && json.hash === autoboxHashRef.current) return;
      autoboxHashRef.current = json.hash || '';
      setAutoboxData(json);
      setAutoboxError(null);
      setAutoboxStatus(`Сүүлд шинэчлэгдсэн: ${new Date().toLocaleTimeString('mn-MN')}`);
    } catch (e) {
      if (!silent) {
        setAutoboxError(e.message || String(e));
        setAutoboxData(null);
      }
      autoboxHashRef.current = '';
      if (!silent) setAutoboxStatus('');
    } finally {
      if (!silent) setAutoboxLoading(false);
    }
  }, []);

  const openVehicle = (item) => {
    setSelected(item);
    setAutoboxData(null);
    setAutoboxError(null);
    autoboxHashRef.current = '';
    loadAutobox(item.plate_number);
  };

  const closeDetail = () => {
    setSelected(null);
    setAutoboxData(null);
    setAutoboxError(null);
    autoboxHashRef.current = '';
    setAutoboxStatus('');
  };

  useEffect(() => {
    if (!selected?.plate_number) return undefined;
    const timer = setInterval(() => loadAutobox(selected.plate_number, { silent: true }), 45000);
    return () => clearInterval(timer);
  }, [selected?.id, selected?.plate_number, loadAutobox]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    if (selected) await loadAutobox(selected.plate_number);
    setRefreshing(false);
  };

  const fineWithDriver = useMemo(() => {
    const plate = selected?.plate_number;
    const finesRows = autoboxData?.finesRows || [];
    if (!plate || !finesRows.length) return [];

    const tripList = (trips || []).filter((t) => t.plate_number === plate && t.driver_name);
    const guessDriver = (fineDateStr) => {
      const fineDt = parseMnDateTime(fineDateStr);
      if (!fineDt || !tripList.length) return null;
      const ft = fineDt.getTime();
      // In-range trip
      for (const t of tripList) {
        const s = t.started_at ? new Date(t.started_at).getTime() : null;
        const e = t.ended_at ? new Date(t.ended_at).getTime() : null;
        if (!s) continue;
        const end = e || (s + 24 * 3600 * 1000);
        if (ft >= s && ft <= end) return t.driver_name;
      }
      // Closest within 12h
      let best = null;
      let bestDiff = Infinity;
      for (const t of tripList) {
        const s = t.started_at ? new Date(t.started_at).getTime() : null;
        if (!s) continue;
        const diff = Math.abs(ft - s);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = t;
        }
      }
      if (best && bestDiff <= 12 * 3600 * 1000) return best.driver_name;
      return null;
    };

    // fines: [Улсын дугаар, Хаана, Зөрчил, Мөнгөн дүн, Огноо, Төлөв]
    return finesRows.slice(0, 30).map((r, idx) => ({
      id: `${idx}-${r[4] || ''}-${r[3] || ''}`,
      plate: r[0] || plate,
      where: r[1] || '',
      violation: r[2] || '',
      amount: r[3] || '',
      date: r[4] || '',
      status: r[5] || '',
      driver: guessDriver(r[4]) || '—',
    }));
  }, [autoboxData?.hash, selected?.plate_number, trips]);

  useEffect(() => {
    const plate = selected?.plate_number;
    const untilIso = autoboxData?.diagnosisValidUntil;
    if (!plate || !untilIso) return;
    const until = new Date(untilIso);
    if (Number.isNaN(until.getTime())) return;
    const now = Date.now();
    const daysLeft = Math.floor((until.getTime() - now) / (24 * 3600 * 1000));
    const expired = until.getTime() < now;
    if (!expired && daysLeft > 3) return;

    const key = `veh_diag_warn:${plate}:${until.toISOString().slice(0, 10)}`;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(key);
        if (seen) return;
        await AsyncStorage.setItem(key, '1');
        await showLocalNotification({
          title: expired ? 'Техникийн үзлэг дууссан' : 'Техникийн үзлэг дуусах гэж байна',
          body: `${plate} · хүчинтэй: ${until.toLocaleString('mn-MN')}`.slice(0, 200),
          data: { type: 'vehicle_diagnosis', plate_number: plate, valid_until: untilIso },
          channelId: 'chat',
        });
        await notifyAdmins({
          title: expired ? 'Техникийн үзлэг дууссан' : 'Техникийн үзлэг дуусах гэж байна',
          body: `${plate} · хүчинтэй: ${until.toLocaleString('mn-MN')}`.slice(0, 200),
          data: { type: 'vehicle_diagnosis', plate_number: plate, valid_until: untilIso },
          priority: 'high',
          channelId: 'chat',
        });
      } catch (e) {}
    })();
  }, [autoboxData?.diagnosisValidUntil, selected?.plate_number]);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Машины оншилгоо" />
        <EmptyState text="Энэ хэсэг зөвхөн админд нээлттэй." />
      </View>
    );
  }

  if (selected) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Машины оншилгоо"
          subtitle={selected.plate_number}
          onBackPress={closeDetail}
        />
        <ScrollView
          contentContainerStyle={styles.detailPad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <Card style={styles.detailHead}>
            <MongoliaPlate plate={selected.plate_number} size="lg" />
            <Text style={styles.license}>Улсын дугаар: {selected.plate_number}</Text>
            <Text style={styles.meta}>
              {selected.code}
              {selected.driver_name ? ` · ${selected.driver_name}` : ''}
            </Text>
          </Card>
          {fineWithDriver.length ? (
            <Card style={styles.fineCard}>
              <Text style={styles.fineTitle}>Торгууль (ажилтан)</Text>
              {fineWithDriver.slice(0, 10).map((x) => (
                <View key={x.id} style={styles.fineRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.fineLine} numberOfLines={1}>
                      {x.date} · {x.amount} · {x.status}
                    </Text>
                    <Text style={styles.fineSub} numberOfLines={2}>
                      {x.driver} · {x.where}
                    </Text>
                    <Text style={styles.fineSub} numberOfLines={2}>
                      {x.violation}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
          <AutoboxTables
            plate={selected.plate_number}
            data={autoboxData}
            loading={autoboxLoading}
            error={autoboxError}
            statusText={autoboxStatus}
            title="Машины мэдээлэл"
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Машины оншилгоо"
        subtitle={`${list.length} бүртгэлтэй машин`}
      />
      {!isCloud ? (
        <EmptyState text="Supabase холбогдсон байх шаардлагатай." />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.listPad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => openVehicle(item)}>
              <Card style={styles.row}>
                <MongoliaPlate plate={item.plate_number} size="sm" />
                <View style={styles.rowBody}>
                  <Text style={styles.rowPlate}>{item.plate_number}</Text>
                  <Text style={styles.rowSub}>
                    {item.code}
                    {item.driver_name ? ` · ${item.driver_name}` : ''}
                  </Text>
                </View>
                <Text style={[styles.chev, { color: colors.textMuted }]}>›</Text>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState text="Бүртгэлтэй машин алга." />}
        />
      )}
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    listPad: { padding: spacing.lg, paddingBottom: 40, gap: spacing.sm },
    detailPad: { padding: spacing.lg, paddingBottom: 48 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowPlate: { color: colors.text, fontSize: 16, fontWeight: '800' },
    rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    chev: { fontSize: 22, fontWeight: '300' },
    detailHead: { alignItems: 'center', marginBottom: spacing.lg, paddingVertical: spacing.lg },
    license: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: spacing.md },
    meta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
    fineCard: { padding: spacing.lg, marginBottom: spacing.lg },
    fineTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: spacing.sm },
    fineRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    fineLine: { color: colors.text, fontSize: 13, fontWeight: '800' },
    fineSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  });

function parseMnDateTime(s) {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(String(s || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hh = Number(m[4] || 0);
  const mm = Number(m[5] || 0);
  const ss = Number(m[6] || 0);
  const dt = new Date(y, mo, d, hh, mm, ss);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
