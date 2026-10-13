import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { ScreenHeader } from '../components/ui';
import { Chip, EmptyBlock, FilterChips, PillButton } from '../components/ds';
import { hasPermission } from '../lib/permissions';
import * as actApi from '../services/actService';

/**
 * Ажил гүйцэтгэлийн акт — жагсаалт (akt.gennetex.com-той нэг өгөгдөл).
 *
 * Эрх олгогдсон хүнд (энгийн админ ч гэсэн) зөвхөн ӨӨРИЙН акт нь харагдана.
 * Захиралд «Батлах» таб нь баталгаажуулах хүлээгдэж буй актууд. Sysadmin
 * «Тохиргоо»-оос хэнд акт бичих эрх өгөхийг тохируулна.
 */
export default function ActsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile, isCloud } = useApp();
  const isDirector = actApi.isActDirector(authProfile);
  const isSysadmin = authProfile?.role === 'superadmin';
  const seesAll = actApi.canSeeAllActs(authProfile);
  const canOpen = actApi.canUseActs(authProfile);
  const canWrite = hasPermission(authProfile, 'acts.create');
  const myId = authProfile?.id || null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(isDirector ? 'ready' : 'all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!isCloud || !canOpen) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await actApi.fetchActs({ search: query, ownerId: seesAll ? null : myId || '00000000-0000-0000-0000-000000000000' }));
      setError(null);
    } catch (e) {
      setError(actApi.actError(e));
    } finally {
      setLoading(false);
    }
  }, [isCloud, canOpen, seesAll, myId, query]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const counts = useMemo(() => {
    const c = { all: rows.length };
    rows.forEach((r) => {
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [rows]);

  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const filters = [
    { key: 'all', label: 'Бүгд', count: counts.all || 0 },
    { key: 'draft', label: 'Ноорог', count: counts.draft || 0 },
    { key: 'ready', label: isDirector ? 'Батлах' : 'Илгээсэн', count: counts.ready || 0 },
    { key: 'approved', label: 'Баталгаажсан', count: counts.approved || 0 },
  ];

  if (!canOpen) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажил гүйцэтгэлийн акт" />
        <EmptyBlock
          ph="file-text"
          title="Акт бичих эрх алга"
          text="Акт нээгдэхийн тулд sysadmin танд «Акт бичих» эрх олгох шаардлагатай."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Ажил гүйцэтгэлийн акт"
        subtitle={isDirector ? 'Та баталгаажуулна' : seesAll ? 'Бүх акт' : 'Миний бичсэн актууд'}
        right={
          <View style={styles.headActions}>
            {isSysadmin ? <PillButton title="Тохиргоо" icon="settings-outline" soft onPress={() => navigation.navigate('ActSettings')} /> : null}
            {canWrite ? <PillButton title="Шинэ" icon="add" onPress={() => navigation.navigate('ActEditor')} /> : null}
          </View>
        }
      />
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListHeaderComponent={
          <>
            <View style={styles.search}>
              <Ionicons name="search" size={19} color={colors.faint} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={load}
                placeholder="Дугаар, ажил, захиалагч хайх…"
                placeholderTextColor={colors.faint}
                returnKeyType="search"
              />
            </View>
            <FilterChips items={filters} value={filter} onChange={setFilter} style={styles.chips} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyBlock
              ph="file-text"
              title={filter === 'ready' && isDirector ? 'Батлах акт алга' : 'Акт алга'}
              text={canWrite ? 'Хийсэн ажлаа актаар баталгаажуулж Захиралд илгээнэ.' : 'Танд акт бичих эрх олгогдоогүй байна.'}
              actionLabel={canWrite ? 'Акт үүсгэх' : null}
              onAction={() => navigation.navigate('ActEditor')}
            />
          )
        }
        renderItem={({ item }) => {
          const st = actApi.ACT_STATUS[item.status] || actApi.ACT_STATUS.draft;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => navigation.navigate('ActDetail', { id: item.id })}
              accessibilityRole="button"
            >
              <View style={styles.ttl}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.num}>{item.act_number}</Text>
                  <Text style={styles.title} numberOfLines={2}>{item.project_name || 'Нэргүй ажил'}</Text>
                </View>
                <Chip text={st.label} tone={st.tone} />
              </View>
              <Text style={styles.meta} numberOfLines={2}>
                {[item.customer_name, item.location].filter(Boolean).join(' · ') || '—'}
              </Text>
              <View style={styles.foot}>
                <Ionicons name="person-outline" size={14} color={colors.muted} />
                <Text style={styles.footText} numberOfLines={1}>{item.created_by_name || '—'}</Text>
                <Text style={styles.footDate}>{String(item.created_at || '').slice(0, 10)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    body: { paddingHorizontal: 16, paddingBottom: 40 },
    headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.card, marginBottom: 12, ...shadow.md },
    searchInput: { flex: 1, color: colors.ink, fontSize: 15, padding: 0 },
    chips: { marginHorizontal: -16, marginBottom: 14 },
    error: { color: colors.bad, fontSize: 13, marginBottom: 10 },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, marginBottom: 12, ...shadow.md },
    ttl: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    num: { color: colors.muted, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
    title: { color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 2 },
    meta: { color: colors.muted, fontSize: 13.5, marginTop: 6, lineHeight: 19 },
    foot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
    footText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600' },
    footDate: { color: colors.faint, fontSize: 12, fontVariant: ['tabular-nums'] },
  });
