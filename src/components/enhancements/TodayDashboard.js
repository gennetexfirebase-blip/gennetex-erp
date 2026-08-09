/**
 * Smart Home — Өнөөдөр карт (HomeScreen-д нэмэлтээр)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { fetchTodayBundle } from '../../services/todayDashboardService';
import { getPendingCount } from '../../services/offlineQueueService';
import { isFlagOn } from '../../lib/featureFlags';
import { formatCountdown } from '../../lib/callSla';

export default function TodayDashboard() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, isAdmin, isCloud } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offlinePending, setOfflinePending] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!isFlagOn('smartToday') || !isCloud) {
        setLoading(false);
        setData({ enabled: false });
        return;
      }
      let active = true;
      setLoading(true);
      (async () => {
        try {
          const [bundle, pending] = await Promise.all([
            fetchTodayBundle({
              userId: currentUser?.id,
              isAdmin,
              name: currentUser?.name,
            }),
            getPendingCount(),
          ]);
          if (!active) return;
          setData(bundle);
          setOfflinePending(pending);
        } catch {
          if (active) setData({ enabled: true, myCalls: [], slaWarnings: [] });
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [currentUser?.id, isAdmin, isCloud])
  );

  if (!isFlagOn('smartToday') || data?.enabled === false) return null;

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Өнөөдрийн мэдээлэл ачаалж байна…</Text>
      </View>
    );
  }

  const myOpen = data?.myCalls?.length || 0;
  const sla = data?.slaWarnings?.length || 0;
  const topCalls = (data?.myCalls || data?.openCalls || []).slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Өнөөдөр</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TodayDetail')}>
          <Text style={styles.link}>Дэлгэрэнгүй →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <Chip label="Миний дуудлага" value={String(myOpen)} color={colors.primary} onPress={() => navigation.navigate('Calls')} styles={styles} />
        <Chip label="SLA" value={String(sla)} color={sla ? colors.danger : colors.success} onPress={() => navigation.navigate('SlaReport')} styles={styles} />
        <Chip
          label="Ирц"
          value={data?.checkInToday ? '✓' : '—'}
          color={data?.checkInToday ? colors.success : colors.warning}
          onPress={() => navigation.navigate('Attendance')}
          styles={styles}
        />
      </View>

      {offlinePending > 0 ? (
        <TouchableOpacity style={styles.offlineBanner} onPress={() => navigation.navigate('OfflineQueue')}>
          <Text style={styles.offlineText}>Оффлайн queue: {offlinePending} үйлдэл хүлээгдэж байна</Text>
        </TouchableOpacity>
      ) : null}

      {!data?.checkInToday ? (
        <TouchableOpacity style={styles.warn} onPress={() => navigation.navigate('Attendance')}>
          <Text style={styles.warnText}>Өнөөдөр цаг бүртгээгүй · Цаг бүртгэх →</Text>
        </TouchableOpacity>
      ) : null}

      {isAdmin && data?.lowStockCount > 0 ? (
        <TouchableOpacity style={styles.warn} onPress={() => navigation.navigate('LowStock')}>
          <Text style={styles.warnText}>Бага үлдэгдэл: {data.lowStockCount} бараа →</Text>
        </TouchableOpacity>
      ) : null}

      {topCalls.length ? (
        <View style={styles.list}>
          <Text style={styles.subTitle}>Ойрын дуудлагууд</Text>
          {topCalls.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.callRow}
              onPress={() => navigation.navigate('CallDetail', { callId: c.id, call: c })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.callName} numberOfLines={1}>{c.customer || '—'}</Text>
                <Text style={styles.callAddr} numberOfLines={1}>{c.address || c.status}</Text>
              </View>
              <Text style={styles.callSla}>{formatCountdown(
                c.sla_deadline || c.created_at
                  ? (c.slaMs != null ? c.slaMs : null)
                  : null
              )}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>Нээлттэй дуудлага алга</Text>
      )}

      <View style={styles.quickRow}>
        <QBtn label="Зам" onPress={() => navigation.navigate('RouteOptimize')} styles={styles} />
        <QBtn label="KB" onPress={() => navigation.navigate('KnowledgeBase')} styles={styles} />
        {isAdmin ? <QBtn label="Ops" onPress={() => navigation.navigate('LiveOps')} styles={styles} /> : null}
      </View>
    </View>
  );
}

function Chip({ label, value, color, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.chip, { borderColor: color + '55' }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.chipVal, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function QBtn({ label, onPress, styles }) {
  return (
    <TouchableOpacity style={styles.qbtn} onPress={onPress}>
      <Text style={styles.qbtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { color: colors.text, fontSize: 17, fontWeight: '800' },
    link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    chip: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.sm,
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerLow || colors.bgAlt,
    },
    chipVal: { fontSize: 20, fontWeight: '800' },
    chipLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
    muted: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
    warn: {
      backgroundColor: colors.warning + '22',
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    warnText: { color: colors.warning, fontWeight: '700', fontSize: 13 },
    offlineBanner: {
      backgroundColor: colors.accent + '22',
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    offlineText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
    list: { marginTop: spacing.sm },
    subTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: spacing.sm },
    callRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    callName: { color: colors.text, fontWeight: '700', fontSize: 14 },
    callAddr: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    callSla: { color: colors.textFaint, fontSize: 11, fontWeight: '700', marginLeft: 8 },
    quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    qbtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    qbtnText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  });
