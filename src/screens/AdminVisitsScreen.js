import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenHeader, EmptyState } from '../components/ui';
import { CALL_TYPES } from '../data/mockData';
import * as tracking from '../services/trackingService';
import { exportVisitsExcel } from '../services/aiAdminService';
import { formatDateTime } from '../lib/callSla';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

function typeMeta(key) {
  return CALL_TYPES.find((t) => t.key === key) || CALL_TYPES[CALL_TYPES.length - 1];
}

export default function AdminVisitsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud, isAdmin } = useApp();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState('summary');

  const load = useCallback(async () => {
    if (!isCloud) return;
    setLoading(true);
    try {
      const rows = await tracking.fetchVisitLogs(2000);
      setVisits(rows);
    } catch (e) {
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [isCloud]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const summary = useMemo(() => {
    const byPerson = {};
    visits.forEach((v) => {
      const name = v.user_name || 'Тодорхойгүй';
      if (!byPerson[name]) byPerson[name] = { name, total: 0, places: new Set(), last: null };
      byPerson[name].total += 1;
      byPerson[name].places.add((v.customer || v.location_name || '—').trim());
      if (v.arrived_at && (!byPerson[name].last || new Date(v.arrived_at) > new Date(byPerson[name].last))) {
        byPerson[name].last = v.arrived_at;
      }
    });
    return Object.values(byPerson)
      .map((p) => ({ ...p, distinct: p.places.size }))
      .sort((a, b) => b.total - a.total);
  }, [visits]);

  const doExport = async () => {
    if (!visits.length) {
      Alert.alert('Excel', 'Татах мэдээлэл алга.');
      return;
    }
    setExporting(true);
    try {
      await exportVisitsExcel(visits);
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Excel гаргаж чадсангүй');
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Очсон лог" />
        <EmptyState text="Энэ хэсгийг зөвхөн админ харна." />
      </View>
    );
  }

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Очсон лог" />
        <EmptyState text="Supabase холболт шаардлагатай." />
      </View>
    );
  }

  const renderSummary = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.sub}>Сүүлд: {item.last ? formatDateTime(item.last) : '—'}</Text>
      </View>
      <View style={styles.countBox}>
        <Text style={styles.countNum}>{item.total}</Text>
        <Text style={styles.countLabel}>удаа · {item.distinct} газар</Text>
      </View>
    </View>
  );

  const renderDetail = ({ item: v }) => {
    const tm = typeMeta(v.call_type);
    return (
      <View style={styles.card}>
        <View style={[styles.typeDot, { backgroundColor: tm.color }]} />
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={1}>{v.customer || v.location_name || 'Айл'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            <Ionicons name="person-outline" size={11} color={colors.primary} /> {v.user_name || '—'} · {tm.label}
          </Text>
          {v.problem ? <Text style={styles.problem} numberOfLines={1}>{v.problem}</Text> : null}
        </View>
        <View style={styles.rightCol}>
          <Text style={styles.time}>{v.arrived_at ? formatDateTime(v.arrived_at) : '—'}</Text>
          {v.face_verified ? (
            <View style={styles.verifyBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={styles.verifyText}>Царай</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Очсон лог"
        subtitle={loading ? 'Шинэчилж байна...' : `${visits.length} бүртгэл · ${summary.length} ажилтан`}
      />

      <TouchableOpacity style={styles.excelBtn} onPress={doExport} activeOpacity={0.85} disabled={exporting}>
        {exporting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.excelBtnText}>Бүгдийн Excel татах (нэгтгэл + дэлгэрэнгүй)</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'summary' && styles.tabBtnActive]}
          onPress={() => setTab('summary')}
        >
          <Text style={[styles.tabText, tab === 'summary' && styles.tabTextActive]}>Хүн бүрээр</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'detail' && styles.tabBtnActive]}
          onPress={() => setTab('detail')}
        >
          <Text style={[styles.tabText, tab === 'detail' && styles.tabTextActive]}>Дэлгэрэнгүй</Text>
        </TouchableOpacity>
      </View>

      {tab === 'summary' ? (
        <FlatList
          data={summary}
          keyExtractor={(p) => p.name}
          renderItem={renderSummary}
          contentContainerStyle={summary.length ? styles.list : styles.listEmpty}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState text="Очсон бүртгэл алга." />}
        />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(v) => String(v.id)}
          renderItem={renderDetail}
          contentContainerStyle={visits.length ? styles.list : styles.listEmpty}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState text="Очсон бүртгэл алга." />}
        />
      )}
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  excelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.success,
  },
  excelBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
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
  list: { padding: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  sep: { height: spacing.sm },
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '18',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  typeDot: { width: 12, height: 12, borderRadius: 6 },
  cardBody: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  problem: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  countBox: { alignItems: 'flex-end' },
  countNum: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  countLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  rightCol: { alignItems: 'flex-end', maxWidth: 110 },
  time: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  verifyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  verifyText: { color: colors.success, fontSize: 11, fontWeight: '700' },
});
