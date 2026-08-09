import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { suggestDispatch, autoAssignCall } from '../../services/autoDispatchService';
import * as tracking from '../../services/trackingService';
import * as serviceCallApi from '../../services/serviceCallService';

export default function AutoDispatchScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const initialCall = route.params?.call || null;

  const [call, setCall] = useState(initialCall);
  const [unassigned, setUnassigned] = useState([]);
  const [ranked, setRanked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const workers = await tracking.fetchWorkers().catch(() => []);
      if (call) {
        const r = await suggestDispatch(call, workers);
        setRanked(r);
      } else {
        const all = await serviceCallApi.fetchServiceCalls();
        const open = (all || []).filter(
          (c) => c.status !== 'Дууссан' && c.status !== 'Татгалзсан' && !c.engineer_id
        );
        setUnassigned(open);
        setRanked([]);
      }
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, [call]);

  React.useEffect(() => {
    load();
  }, [load]);

  const pickCall = async (c) => {
    setCall(c);
  };

  const assign = async (dryRun = false) => {
    if (!call) return;
    setAssigning(true);
    try {
      const workers = await tracking.fetchWorkers().catch(() => []);
      const res = await autoAssignCall(call.id, call, workers, { dryRun });
      if (dryRun) {
        Alert.alert('Санал', res.suggestion ? `${res.suggestion.name} (${res.suggestion.distKm} км)` : 'Инженер олдсонгүй');
        setRanked(res.ranked || []);
      } else if (res.assigned) {
        Alert.alert('Оноогдлоо', res.engineer?.name || '');
        navigation.goBack();
      } else {
        Alert.alert('Болсонгүй', res.reason || '');
      }
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Оноож чадсангүй');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Автомат оноолт</Text>
        <Text style={styles.sub}>Ойр + free + skill</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {!call ? (
            <>
              <Text style={styles.section}>Оноогдоогүй дуудлага</Text>
              {unassigned.length === 0 ? (
                <Text style={styles.empty}>Байхгүй</Text>
              ) : (
                unassigned.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.row} onPress={() => pickCall(c)}>
                    <Text style={styles.rowTitle}>{c.customer}</Text>
                    <Text style={styles.rowSub}>{c.address}</Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.rowTitle}>{call.customer}</Text>
                <Text style={styles.rowSub}>{call.address}</Text>
                <TouchableOpacity onPress={() => setCall(null)}>
                  <Text style={styles.link}>Өөр дуудлага сонгох</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.section}>Зэрэглэл</Text>
              {ranked.map((w, i) => (
                <View key={w.id || i} style={styles.row}>
                  <Text style={styles.rank}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{w.name}</Text>
                    <Text style={styles.rowSub}>
                      {w.distKm} км · open {w.open_calls} · {w.online ? 'online' : 'offline'} · score {w.score}
                    </Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.btnGhost} onPress={() => assign(true)} disabled={assigning}>
                <Text style={styles.btnGhostText}>Preview (оноохгүй)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => assign(false)} disabled={assigning}>
                <Text style={styles.btnText}>{assigning ? '…' : 'Хамгийн тохиромжтойд оноох'}</Text>
              </TouchableOpacity>
            </>
          )}
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
    sub: { color: colors.textMuted, marginTop: 2 },
    body: { padding: spacing.lg, paddingBottom: 60 },
    section: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.md },
    empty: { color: colors.textMuted },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    rank: { color: colors.primary, fontWeight: '900', width: 28 },
    rowTitle: { color: colors.text, fontWeight: '700' },
    rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    link: { color: colors.primary, marginTop: 8, fontWeight: '700' },
    btn: {
      marginTop: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    btnText: { color: colors.onPrimary || '#00363a', fontWeight: '800' },
    btnGhost: {
      marginTop: spacing.lg,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnGhostText: { color: colors.text, fontWeight: '700' },
  });
