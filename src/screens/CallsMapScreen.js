import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { canTakeServiceCalls } from '../lib/roles';
import { ScreenHeader, EmptyState } from '../components/ui';
import { CALL_TYPES } from '../data/mockData';
import { siteKindMeta } from '../services/serviceCallService';
import * as serviceCallApi from '../services/serviceCallService';
import {
  CUSTOMER_FILTERS,
  JOB_TYPE_FILTERS,
  STATUS_FILTERS,
  ZONE_FILTERS,
  applyCallFilters,
  filterLabel,
  getCallStatusMeta,
  callStatusLabelMn,
} from '../lib/callStatusColors';
import { callTimeLabel, callDisplayId, callEffectiveDate } from '../lib/callSla';
import CallFilterModal from '../components/CallFilterModal';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const DEFAULT_FILTERS = { customerType: 'all', zone: 'all', status: 'all', jobType: 'all' };
const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function typeMeta(key) {
  return CALL_TYPES.find((t) => t.key === key) || CALL_TYPES[CALL_TYPES.length - 1];
}

function sameMonth(iso, ref) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function isMineCall(call, user) {
  if (!user) return false;
  if (call.engineer_id && String(call.engineer_id) === String(user.id)) return true;
  if (call.partner_engineer_id && String(call.partner_engineer_id) === String(user.id)) return true;
  const en = (call.engineer || '').trim().toLowerCase();
  const un = (user.name || user.email || '').trim().toLowerCase();
  return Boolean(en && un && en === un);
}

function StatusCircle({ call }) {
  const styles = useStyles(makeStyles);
  const meta = getCallStatusMeta(call);
  return (
    <View style={[styles.codeCircle, { borderColor: meta.color }]}>
      <Text style={[styles.codeText, { color: meta.color, fontSize: meta.code.length > 2 ? 9 : 12 }]}>
        {meta.code}
      </Text>
    </View>
  );
}

export default function CallsMapScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { isCloud, isAdmin, authProfile, currentUser } = useApp();
  const [allCalls, setAllCalls] = useState([]);
  const [scope, setScope] = useState('mine');
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const takesCalls = canTakeServiceCalls(authProfile);
  const blockedAdmin = isAdmin && !takesCalls;

  const load = useCallback(async () => {
    if (blockedAdmin || !isCloud) return;
    setLoading(true);
    try {
      const rows = await serviceCallApi.fetchServiceCalls();
      setAllCalls(rows);
    } catch (e) {
      setAllCalls([]);
    } finally {
      setLoading(false);
    }
  }, [blockedAdmin, isCloud]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (blockedAdmin || !isCloud) return undefined;
      const unsub = serviceCallApi.subscribeServiceCalls(load);
      return () => unsub && unsub();
    }, [load, blockedAdmin, isCloud])
  );

  const monthCalls = useMemo(
    () => allCalls.filter((c) => sameMonth(callEffectiveDate(c) || c.created_at, monthDate)),
    [allCalls, monthDate]
  );

  const scopeCalls = useMemo(() => {
    if (scope === 'mine') return monthCalls.filter((c) => isMineCall(c, currentUser));
    return monthCalls.filter((c) => !isMineCall(c, currentUser));
  }, [monthCalls, scope, currentUser]);

  const filtered = useMemo(() => applyCallFilters(scopeCalls, filters), [scopeCalls, filters]);
  const pending = useMemo(() => filtered.filter((c) => c.status !== 'Дууссан').length, [filtered]);

  const mineCount = useMemo(
    () => monthCalls.filter((c) => isMineCall(c, currentUser)).length,
    [monthCalls, currentUser]
  );
  const othersCount = monthCalls.length - mineCount;

  const monthLabel = `${monthDate.getFullYear()} оны ${MONTHS[monthDate.getMonth()]}-р сар`;
  const shiftMonth = (delta) =>
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  const isThisMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === monthDate.getFullYear() && now.getMonth() === monthDate.getMonth();
  }, [monthDate]);

  const activePills = useMemo(() => {
    const pills = [];
    if (filters.customerType !== 'all') pills.push(filterLabel(CUSTOMER_FILTERS, filters.customerType));
    if (filters.zone !== 'all') pills.push(filterLabel(ZONE_FILTERS, filters.zone));
    if (filters.status !== 'all') pills.push(filterLabel(STATUS_FILTERS, filters.status));
    if (filters.jobType !== 'all') pills.push(filterLabel(JOB_TYPE_FILTERS, filters.jobType));
    return pills;
  }, [filters]);

  if (blockedAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Миний дуудлага" />
        <EmptyState text="Дуудлага бүртгэхийг админ вэб (admin-web) хэсгээс хийнэ. Дуудлагаар явахын тулд Хөгжүүлэгч танд эрх өгөх шаардлагатай." />
      </View>
    );
  }

  const renderItem = ({ item: call }) => {
    const tm = typeMeta(call.type);
    const sk = siteKindMeta(call.site_kind);
    const statusMeta = getCallStatusMeta(call);
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CallDetail', { call })}
      >
        <StatusCircle call={call} />
        <View style={styles.rowBody}>
          <Text style={styles.customer} numberOfLines={1}>{call.customer || '—'}</Text>
          {scope === 'others' ? (
            <Text style={styles.engineer} numberOfLines={1}>
              <Ionicons name="person-outline" size={11} color={colors.primary} /> {call.engineer || 'Тодорхойгүй'}
            </Text>
          ) : null}
          <Text style={styles.addr} numberOfLines={1}>{call.address || 'Хаяг байхгүй'}</Text>
          <View style={styles.metaLine}>
            <View style={[styles.typeDot, { backgroundColor: tm.color }]} />
            <Text style={styles.metaText} numberOfLines={1}>
              {tm.label} · {sk.label}{call.phone ? ` · ${call.phone}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.time}>{callTimeLabel(call)}</Text>
          <Text style={[styles.statusText, { color: statusMeta.color }]} numberOfLines={1}>
            {callStatusLabelMn(call)}
          </Text>
          <Text style={styles.soId}>{callDisplayId(call)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Миний дуудлага"
        subtitle={loading ? 'Шинэчилж байна...' : `${filtered.length} дуудлага · ${pending} хүлээгдэж буй`}
      />

      {!isCloud ? (
        <EmptyState text="Дуудлага хүлээн авахын тулд Supabase холболт шаардлагатай." />
      ) : (
        <>
          <View style={styles.monthBar}>
            <TouchableOpacity style={styles.monthNav} onPress={() => shiftMonth(-1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.monthLabelWrap}
              onPress={() => setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              {!isThisMonth ? <Text style={styles.monthReset}>· Энэ сар</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.monthNav} onPress={() => shiftMonth(1)} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.scopeRow}>
            <TouchableOpacity
              style={[styles.scopeBtn, scope === 'mine' && styles.scopeBtnActive]}
              onPress={() => setScope('mine')}
            >
              <Text style={[styles.scopeText, scope === 'mine' && styles.scopeTextActive]}>
                Миний ({mineCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scopeBtn, scope === 'others' && styles.scopeBtnActive]}
              onPress={() => setScope('others')}
            >
              <Text style={[styles.scopeText, scope === 'others' && styles.scopeTextActive]}>
                Бусад инженер ({othersCount})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterBar}>
            <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.85}>
              <Ionicons name="funnel-outline" size={16} color={colors.primary} />
              <Text style={styles.filterBtnText}>Шүүлт</Text>
            </TouchableOpacity>
            {activePills.length ? (
              <View style={styles.pillRow}>
                {activePills.map((p, i) => (
                  <View key={i} style={styles.pill}>
                    <Text style={styles.pillText}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.filterHint}>Бүх дуудлага</Text>
            )}
            {activePills.length ? (
              <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)} hitSlop={8}>
                <Text style={styles.clearText}>Цэвэрлэх</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(c) => String(c.id)}
            renderItem={renderItem}
            contentContainerStyle={filtered.length ? styles.list : styles.listEmpty}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
            ListEmptyComponent={
              <EmptyState
                text={
                  scope === 'mine'
                    ? `${monthLabel}-д ${currentUser?.name || 'танд'} оноогдсон дуудлага алга.`
                    : `${monthLabel}-д бусад инженерийн дуудлага алга.`
                }
              />
            }
          />
        </>
      )}

      <CallFilterModal
        visible={filterOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthNav: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  monthLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  monthReset: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  scopeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scopeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scopeText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  scopeTextActive: { color: '#fff' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '12',
  },
  filterBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  filterHint: { flex: 1, color: colors.textMuted, fontSize: 13 },
  pillRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  clearText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  list: { padding: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  sep: { height: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  codeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  codeText: { fontWeight: '800' },
  rowBody: { flex: 1 },
  customer: { color: colors.text, fontSize: 15, fontWeight: '800' },
  engineer: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  addr: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { flex: 1, color: colors.textFaint, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', maxWidth: 96 },
  time: { color: colors.text, fontSize: 13, fontWeight: '800' },
  statusText: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  soId: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
});
