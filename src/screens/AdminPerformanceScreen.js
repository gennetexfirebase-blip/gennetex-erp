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
import * as engPerf from '../services/engineerPerformanceService';
import { formatEngineerDetailText, getEngineerFromStats, formatEngineerDetailWithAi, getAiInsightForEngineer } from '../services/engineerPerformanceService';

export default function AdminPerformanceScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, authProfile, currentUser } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [detailText, setDetailText] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  const latestReport = reports[0];
  const latestStats = latestReport?.stats;
  const summaryText = latestStats?.summary || latestReport?.analysis_text?.split('\n')[0] || '';
  const engineers = (latestStats?.engineers || []).filter((e) => e.name && e.name !== 'Тодорхойгүй');

  const load = useCallback(async ({ forceAnalysis = true } = {}) => {
    setError(null);
    try {
      const list = await perfApi.fetchPerformanceReports(20);
      setReports(list);
      if (isAdmin) {
        setAnalyzing(true);
        await perfApi.runAutoPerformanceAnalysisIfNeeded(currentUser?.id, authProfile?.name, {
          force: forceAnalysis,
        });
        const again = await perfApi.fetchPerformanceReports(20);
        setReports(again);
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

  const openEngineer = async (eng) => {
    setSelectedEngineer(eng);
    setDetailLoading(true);
    try {
      const stats = reports[0]?.stats;
      const row = getEngineerFromStats(stats, eng.engineer_id, eng.name);
      const ai = getAiInsightForEngineer(stats, eng.name);
      if (row) {
        setDetailText(formatEngineerDetailWithAi(row, stats?.anomalies || [], ai));
      } else {
        const fresh = await perfApi.fetchEngineerPerformanceDetail(eng.engineer_id, eng.name);
        setDetailText(formatEngineerDetailWithAi(fresh.row, fresh.stats?.anomalies || [], getAiInsightForEngineer(fresh.stats, eng.name)));
      }
    } catch (e) {
      setDetailText(formatEngineerDetailText(eng, []));
    } finally {
      setDetailLoading(false);
    }
  };

  const runNow = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await perfApi.runInstantPerformanceAnalysis(currentUser?.id, authProfile?.name);
      const again = await perfApi.fetchPerformanceReports(20);
      setReports(again);
      Alert.alert('Болсон', 'AI шинжилгээ шинэчлэгдлээ.');
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
        <ScreenHeader title="AI гүйцэтгэл" />
        <EmptyState text="Зөвхөн админ." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="AI гүйцэтгэл" subtitle="Инженер · айл · бараа · гomдol" />
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
            Инженерийн нэр дээр дарж дэлгэрэнгүй харна: айл хэд, гomдol, бараа/бagаж авалт, зөрүү. AI маргааш
            шинэчлэгдэнэ.
          </Text>
          {analyzing ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.analyzingText}>AI шинжилж байна...</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {summaryText ? <Text style={styles.summary}>{summaryText}</Text> : null}
          <Button title="Дахин шинжлэх" onPress={runNow} disabled={analyzing} />
        </Card>

        {engineers.length ? (
          <>
            <SectionTitle>Инженерүүд ({engineers.length})</SectionTitle>
            {engineers.map((e) => (
              <Pressable key={e.engineer_id || e.name} onPress={() => openEngineer(e)}>
                <Card style={styles.engCard}>
                  <Text style={styles.engName}>{e.name}</Text>
                  <Text style={styles.engMeta}>
                    Айл: {e.ail_calls ?? 0} · Гomдol: {e.gomdol_mentioned ?? e.complaints_mentioned ?? 0} · Санал:{' '}
                    {e.sanal_mentioned ?? 0} · Бараа: {e.materials_withdrawn ?? 0} · Бagаж: {e.tools_withdrawn ?? 0}
                  </Text>
                  <Text style={styles.engMeta}>
                    Ирц: {e.days_worked ?? 0} ажилласан · {e.days_absent ?? 0} тасалсан · {e.days_leave ?? 0} чөлөө
                  </Text>
                  {(e.suspicious_flags?.length ?? 0) > 0 ? (
                    <Text style={styles.engWarn}>⚠️ Зөрүү илэрсэн</Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}

        {!loading && !engineers.length && !analyzing ? (
          <EmptyState text={error || 'Инженерийн мэдээлэл алга.'} />
        ) : null}
      </ScrollView>

      <Modal visible={!!selectedEngineer} transparent animationType="slide" onRequestClose={() => setSelectedEngineer(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{selectedEngineer?.name || 'Инженер'}</Text>
            {detailLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={styles.detailText}>{detailText}</Text>
              </ScrollView>
            )}
            <Button title="Хаах" onPress={() => setSelectedEngineer(null)} style={{ marginTop: spacing.md }} />
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
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  analyzingText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md, lineHeight: 18 },
  engCard: { marginBottom: spacing.sm },
  engName: { fontSize: 16, fontWeight: '800', color: colors.text },
  engMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  engWarn: { fontSize: 12, color: colors.danger, marginTop: 6, fontWeight: '700' },
  summary: { fontSize: 13, color: colors.text, lineHeight: 20, marginBottom: spacing.md, fontWeight: '600' },
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
