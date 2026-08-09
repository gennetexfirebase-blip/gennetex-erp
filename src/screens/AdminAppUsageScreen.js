import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, ScreenHeader, SectionTitle, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as usageApi from '../services/appUsageAnalysisService';

export default function AdminAppUsageScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, authProfile, currentUser } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailText, setDetailText] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  const latestStats = reports[0]?.stats;
  const employees = (latestStats?.employees || []).filter((e) => e.name && e.name !== 'Тодорхойгүй');

  const load = useCallback(async ({ forceAnalysis = true } = {}) => {
    setError(null);
    try {
      const list = await usageApi.fetchAppUsageReports(20);
      setReports(list);
      if (isAdmin) {
        setAnalyzing(true);
        await usageApi.runAutoAppUsageAnalysisIfNeeded(currentUser?.id, authProfile?.name, {
          force: forceAnalysis,
        });
        setReports(await usageApi.fetchAppUsageReports(20));
      }
    } catch (e) {
      setError(e.message || 'AI шинжилгээ амжилтгүй');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setAnalyzing(false);
    }
  }, [isAdmin, currentUser?.id, authProfile?.name]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin && isCloud) {
        setLoading(true);
        load({ forceAnalysis: true });
      }
    }, [isAdmin, isCloud, load])
  );

  const openEmployee = async (emp) => {
    setSelected(emp);
    setDetailLoading(true);
    try {
      const stats = reports[0]?.stats;
      const row = usageApi.getEmployeeFromUsageStats(stats, emp.user_id, emp.name);
      if (row) {
        setDetailText(usageApi.formatUsageEmployeeDetail(row));
      } else {
        const fresh = await usageApi.fetchEmployeeUsageDetail(emp.user_id, emp.name);
        setDetailText(fresh.text);
      }
    } catch (e) {
      setDetailText(usageApi.formatUsageEmployeeDetail(emp));
    } finally {
      setDetailLoading(false);
    }
  };

  const runNow = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await usageApi.runInstantAppUsageAnalysis(currentUser?.id, authProfile?.name);
      setReports(await usageApi.fetchAppUsageReports(20));
      Alert.alert('Болсон', 'Апп хэрэглээний AI шинжилгээ шинэчлэгдлээ.');
    } catch (e) {
      setError(e.message || 'AI шинжилгээ амжилтгүй');
      Alert.alert('Алдаа', e.message || 'AI шинжилгээ амжилтгүй');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!isAdmin || !isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="AI апп хэрэглээ" />
        <EmptyState text="Зөвхөн админ." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="AI апп хэрэглээ"
        subtitle={`${latestStats?.logged_in_count ?? 0}/${latestStats?.employee_count ?? 0} ажилтан`}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load({ forceAnalysis: true });
            }}
          />
        }
      >
        <Card>
          <Text style={styles.desc}>
            Нэвтэрсэн бүх ажилтны апп ашиглалтыг AI шинжилнэ: дэлгэц, үйлдэл, идэвхтэй өдөр. Нэр дээр дарж
            дэлгэрэнгүй харна.
          </Text>
          {analyzing ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.analyzingText}>AI шинжилж байна...</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Дахин шинжлэх" onPress={runNow} disabled={analyzing} />
        </Card>

        {employees.length ? (
          <>
            <SectionTitle>Ажилтан ({employees.length})</SectionTitle>
            {employees.map((e) => (
              <Pressable key={e.user_id || e.name} onPress={() => openEmployee(e)}>
                <Card style={styles.empCard}>
                  <Text style={styles.empName}>{e.name}</Text>
                  <Text style={styles.empMeta}>
                    {e.logged_in ? '✓ Нэвтэрсэн' : '○ Идэвхгүй'} · {e.total_events ?? 0} үйлдэл ·{' '}
                    {e.active_days ?? 0} өдөр
                  </Text>
                  {e.top_screens?.length ? (
                    <Text style={styles.empSub} numberOfLines={1}>
                      {e.top_screens
                        .slice(0, 3)
                        .map((s) => s.label)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : reports.length === 0 ? (
          <EmptyState text={analyzing ? 'AI шинжилж байна...' : error || 'Тайлан алга.'} />
        ) : (
          <>
            <SectionTitle>AI дүгнэлт</SectionTitle>
            {reports.map((r) => (
              <Card key={r.id} style={styles.report}>
                <Text style={styles.reportMeta}>
                  {r.period_label || '—'} · {new Date(r.created_at).toLocaleString('mn-MN')}
                </Text>
                <Text style={styles.reportText}>{r.analysis_text || '—'}</Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{selected?.name || 'Ажилтан'}</Text>
            {detailLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={styles.detailText}>{detailText}</Text>
              </ScrollView>
            )}
            <Button title="Хаах" onPress={() => setSelected(null)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 40 },
  desc: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  analyzingText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md, lineHeight: 18 },
  empCard: { marginBottom: spacing.sm },
  empName: { fontSize: 16, fontWeight: '800', color: colors.text },
  empMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  empSub: { fontSize: 11, color: colors.primary, marginTop: 4 },
  report: { marginBottom: spacing.sm },
  reportMeta: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 8 },
  reportText: { fontSize: 13, color: colors.text, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  detailText: { fontSize: 14, color: colors.text, lineHeight: 22 },
});
