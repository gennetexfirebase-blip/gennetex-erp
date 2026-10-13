/**
 * Smart Home — Өнөөдөр карт (HomeScreen-д нэмэлтээр)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Box, StatGrid, SectionHeader, IconRow, Chip } from '../ds';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { fetchTodayBundle } from '../../services/todayDashboardService';
import { getPendingCount } from '../../services/offlineQueueService';
import { isFlagOn } from '../../lib/featureFlags';
import { formatCountdown } from '../../lib/callSla';

/**
 * Нүүрний «Өнөөдөр» карт + «Анхаарах» жагсаалт (дизайн §4 Нүүр).
 *
 * `alerts` — Нүүр дэлгэцээс ирэх нэмэлт анхааруулга (ж: ХААБ заавар).
 * `title` — ажилтанд «Миний өнөөдөр».
 */
export default function TodayDashboard({ alerts: extraAlerts = [], title = 'Өнөөдөр' } = {}) {
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

  const disabled = !isFlagOn('smartToday') || data?.enabled === false;

  // Анхаарах зүйлс — Нүүрээс ирсэн + энэ картын өгөгдлөөс.
  const alerts = [...extraAlerts];
  if (!disabled && !loading) {
    if (isAdmin && data?.lowStockCount > 0) {
      alerts.push({ key: 'low', icon: 'cube-outline', tone: 'red', title: `Бага үлдэгдэлтэй ${data.lowStockCount} бараа`, sub: 'Агуулахын нөөц дуусах дөхсөн', onPress: () => navigation.navigate('LowStock') });
    }
    const slaN = data?.slaWarnings?.length || 0;
    if (slaN > 0) {
      alerts.push({ key: 'sla', icon: 'timer-outline', tone: 'red', title: `${slaN} дуудлагын SLA хэтэрсэн`, sub: 'Хариу өгөх хугацаа дууссан', onPress: () => navigation.navigate('SlaReport') });
    }
    if (offlinePending > 0) {
      alerts.push({ key: 'offline', icon: 'cloud-upload-outline', tone: 'slate', title: `Оффлайн дараалал: ${offlinePending}`, sub: 'Сүлжээнд холбогдмогц илгээгдэнэ', onPress: () => navigation.navigate('OfflineQueue') });
    }
  }

  const alertList = alerts.length ? (
    <>
      <SectionHeader title={isAdmin ? 'Анхаарах' : 'Хийх зүйлс'} chip={alerts.length} chipTone={isAdmin ? 'bad' : 'warn'} />
      <Box style={{ paddingVertical: 4 }}>
        {alerts.map((a, i) => (
          <IconRow key={a.key} first={i === 0} icon={a.icon} tone={a.tone} title={a.title} sub={a.sub} onPress={a.onPress} />
        ))}
      </Box>
    </>
  ) : null;

  if (disabled) return alertList;

  if (loading) {
    return (
      <>
        <Box pad style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Өнөөдрийн мэдээлэл ачаалж байна…</Text>
        </Box>
        {alertList}
      </>
    );
  }

  const myOpen = data?.myCalls?.length || 0;
  const sla = data?.slaWarnings?.length || 0;
  const openN = data?.openCalls?.length ?? myOpen;
  const topCalls = (data?.myCalls || data?.openCalls || []).slice(0, 3);

  return (
    <>
      <Box>
        <View style={styles.boxhead}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TodayDetail')} hitSlop={8}>
            <Text style={styles.link}>Дэлгэрэнгүй</Text>
          </TouchableOpacity>
        </View>
        <StatGrid
          topBorder
          items={[
            { label: 'Миний дуудлага', value: String(myOpen), onPress: () => navigation.navigate('Calls') },
            { label: 'SLA хэтэрсэн', value: String(sla), color: sla ? colors.bad : undefined, onPress: () => navigation.navigate('SlaReport') },
            { label: 'Нээлттэй', value: String(openN), onPress: () => navigation.navigate(isAdmin ? 'AdminCalls' : 'Calls') },
          ]}
        />
      </Box>

      {alertList}

      {topCalls.length ? (
        <Box style={{ paddingVertical: 4, marginTop: alertList ? 0 : 0 }}>
          {topCalls.map((c, i) => (
            <IconRow
              key={c.id}
              first={i === 0}
              icon="location-outline"
              tone="blue"
              title={c.customer || '—'}
              sub={[c.address || c.status, formatCountdown(c.slaMs != null ? c.slaMs : null)].filter((x) => x && x !== '—').join(' · ')}
              right={i === 0 ? <Chip text="Дараагийн" tone="blue" /> : null}
              onPress={() => navigation.navigate('CallDetail', { callId: c.id, call: c })}
            />
          ))}
        </Box>
      ) : null}
    </>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    boxhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    link: { color: colors.brand, fontWeight: '600', fontSize: 14 },
    muted: { color: colors.muted, fontSize: 13 },
  });