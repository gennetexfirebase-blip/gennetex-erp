import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { fetchLiveOpsSnapshot } from '../../services/liveOpsService';

export default function LiveOpsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const styles = useStyles(makeStyles);
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);

  // Динамик хэмжээ тооцоолох
  const bodyPadding = 16; // spacing.lg
  const gap = 8; // spacing.sm
  const availableWidth = SCREEN_WIDTH - bodyPadding * 2;
  const statWidth = Math.floor((availableWidth - gap) - 1) / 2;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLiveOpsSnapshot();
      setSnap(data);
    } catch (e) {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const s = snap || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Live Ops</Text>
        <Text style={styles.sub}>Системийн шууд хяналт</Text>
      </View>

      {loading && !snap ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        >
          <View style={styles.statGrid}>
            <Stat label="Нээлттэй" value={s.openCalls ?? 0} color={colors.primary} width={statWidth} styles={styles} />
            <Stat label="Online" value={s.online ?? 0} color={colors.success} width={statWidth} styles={styles} />
            <Stat label="SLA 🔴" value={s.slaRed ?? 0} color={colors.danger} width={statWidth} styles={styles} />
            <Stat label="Оноогдоогүй" value={s.unassigned ?? 0} color={colors.warning} width={statWidth} styles={styles} />
          </View>

          <Section title="SLA хэтэрсэн" styles={styles}>
            {(snap?.red || []).length === 0 ? (
              <Text style={styles.empty}>Байхгүй</Text>
            ) : (
              snap.red.map((c) => (
                <CallRow key={c.id} c={c} styles={styles} onPress={() => navigation.navigate('CallDetail', { callId: c.id, call: c })} />
              ))
            )}
          </Section>

          <Section title="Оноогдоогүй" styles={styles}>
            {(snap?.unassigned || []).length === 0 ? (
              <Text style={styles.empty}>Байхгүй</Text>
            ) : (
              snap.unassigned.map((c) => (
                <CallRow key={c.id} c={c} styles={styles} onPress={() => navigation.navigate('AutoDispatch', { call: c })} />
              ))
            )}
          </Section>

          <Section title="Бүх нээлттэй" styles={styles}>
            {(snap?.calls || []).slice(0, 40).map((c) => (
              <CallRow key={c.id} c={c} styles={styles} onPress={() => navigation.navigate('CallDetail', { callId: c.id, call: c })} />
            ))}
          </Section>

          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Live')}>
            <Text style={styles.ctaText}>Газрын зураг · байршил →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('AutoDispatch')}>
            <Text style={styles.ctaText}>Автомат оноолт →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, color, width, styles }) {
  return (
    <View style={[styles.stat, { borderColor: color + '44', width }]}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children, styles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CallRow({ c, styles, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{c.customer}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {c.address || '—'} · {c.engineer || 'оноогдоогүй'} · {c.status}
        </Text>
      </View>
      <Text style={[styles.sla, c.slaExceeded && styles.slaRed]}>{c.slaLabel || '—'}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    body: { padding: spacing.lg, paddingBottom: 80 },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    stat: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      ...shadow.sm,
    },
    statVal: { fontSize: 24, fontWeight: '800' },
    statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    section: { marginBottom: spacing.lg },
    sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: spacing.sm },
    empty: { color: colors.textMuted, fontSize: 13 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowTitle: { color: colors.text, fontWeight: '700' },
    rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    sla: { color: colors.textFaint, fontSize: 11, fontWeight: '700', marginLeft: 8 },
    slaRed: { color: colors.danger },
    cta: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
    },
    ctaText: { color: colors.primary, fontWeight: '800' },
  });
