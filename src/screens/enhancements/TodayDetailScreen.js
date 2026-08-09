import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useApp } from '../../context/AppContext';
import { fetchTodayBundle } from '../../services/todayDashboardService';
import { formatCountdown, getSlaRemainingMs } from '../../lib/callSla';

export default function TodayDetailScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, isAdmin, isCloud } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await fetchTodayBundle({ userId: currentUser?.id, isAdmin, name: currentUser?.name })
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      if (isCloud) load();
      else setLoading(false);
    }, [load, isCloud])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Өнөөдрийн самбар</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ирц</Text>
            <Text style={styles.cardBody}>{data?.checkInToday ? 'Бүртгэгдсэн ✓' : 'Бүртгээгүй'}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Attendance')}>
              <Text style={styles.link}>Ирц рүү →</Text>
            </TouchableOpacity>
          </View>

          {(data?.meetingsToday || []).length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Хурал ({data.meetingsToday.length})</Text>
              {data.meetingsToday.map((m) => (
                <Text key={m.id} style={styles.cardBody}>
                  {m.title || 'Хурал'} · {String(m.starts_at || '').slice(11, 16)}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.section}>Миний дуудлагууд</Text>
          {(data?.myCalls || []).map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.row}
              onPress={() => navigation.navigate('CallDetail', { callId: c.id, call: c })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.customer}</Text>
                <Text style={styles.meta}>{c.address} · {c.status}</Text>
              </View>
              <Text style={styles.sla}>{formatCountdown(getSlaRemainingMs(c))}</Text>
            </TouchableOpacity>
          ))}
          {!(data?.myCalls || []).length ? <Text style={styles.empty}>Нээлттэй дуудлага алга</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    body: { padding: spacing.lg, paddingBottom: 60 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    cardTitle: { color: colors.text, fontWeight: '800' },
    cardBody: { color: colors.textMuted, marginTop: 4 },
    link: { color: colors.primary, fontWeight: '700', marginTop: 8 },
    section: { color: colors.text, fontWeight: '800', marginVertical: spacing.md },
    row: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    name: { color: colors.text, fontWeight: '700' },
    meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    sla: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
    empty: { color: colors.textMuted },
  });
