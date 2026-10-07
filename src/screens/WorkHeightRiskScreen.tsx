import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useStyles, useTheme } from '../context/ThemeContext';
import * as UI from '../components/ui';
import { radius, spacing } from '../theme';
import { STATUS_LABELS, STATUS_TONES, riskLevel } from '../modules/workHeightRisk/domain';
import * as api from '../modules/workHeightRisk/service';
import type { WorkHeightAssessment, WorkHeightIncident } from '../modules/workHeightRisk/types';

type Props = { navigation: any };
const { Badge, Button, Card, EmptyState, ScreenHeader, SectionTitle, StatCard } = UI as any;

export default function WorkHeightRiskScreen({ navigation }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { currentUser, isCloud, isAdmin } = useApp() as any;
  const currentUserId = currentUser?.id;
  const [tab, setTab] = useState<'assessments' | 'incidents' | 'reports'>('assessments');
  const [assessments, setAssessments] = useState<WorkHeightAssessment[]>([]);
  const [incidents, setIncidents] = useState<WorkHeightIncident[]>([]);
  const [offline, setOffline] = useState<WorkHeightAssessment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const drafts = await api.loadOfflineDrafts(currentUserId);
      setOffline(drafts);
      if (isCloud) {
        const [rows, issueRows] = await Promise.all([api.fetchAssessments(), api.fetchIncidents()]);
        setAssessments(rows);
        setIncidents(issueRows);
      }
    } catch (error) {
      Alert.alert('Алдаа', api.mapWorkHeightError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId, isCloud]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const summary = useMemo(() => api.reportSummary(assessments, incidents), [assessments, incidents]);
  const sync = async () => {
    if (!currentUserId || !isCloud) return;
    setRefreshing(true);
    const result = await api.syncOfflineDrafts(currentUserId);
    await load();
    Alert.alert('Синхрончлол', `${result.synced} ноорог илгээгдлээ${result.failed.length ? ` · ${result.failed.length} алдаатай` : ''}.`);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Өндөрт ажиллах ХАБЭА" subtitle="Эрсдэлийн үнэлгээ · зөвшөөрөл · зөрчил" />
      <View style={styles.tabs}>
        {[
          ['assessments', 'Үнэлгээ'], ['incidents', 'Осол, зөрчил'], ['reports', 'Тайлан'],
        ].map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key as any)} style={[styles.tab, tab === key && { backgroundColor: colors.surface, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]}>
            <Text style={[styles.tabText, { color: tab === key ? colors.primary : colors.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {!isCloud ? <Card><Text style={styles.notice}>Офлайн горим — ноорог төхөөрөмж дээр хадгалагдана.</Text></Card> : null}
        {offline.length ? (
          <Card style={styles.offlineCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}><Text style={styles.offlineTitle}>Офлайн ноорог: {offline.length}</Text><Text style={styles.muted}>Сүлжээ орсон үед синхрончилно.</Text></View>
              {isCloud ? <Button title="Синк" size="sm" onPress={sync} /> : null}
            </View>
          </Card>
        ) : null}

        {tab === 'assessments' ? (
          <>
            <View style={styles.actions}>
              <Button title="Шинэ үнэлгээ" icon="＋" onPress={() => navigation.navigate('WorkHeightRiskForm')} style={{ flex: 1 }} />
              <Button title="Зөрчил бүртгэх" variant="danger" onPress={() => navigation.navigate('WorkHeightIncident')} style={{ flex: 1 }} />
            </View>
            <SectionTitle>Сүүлийн үнэлгээнүүд</SectionTitle>
            {!assessments.length && !offline.length && !loading ? <EmptyState text="Эрсдэлийн үнэлгээ бүртгэгдээгүй байна." /> : null}
            {offline.map((item) => <AssessmentCard key={item.offline_id} item={item} offline colors={colors} onPress={() => navigation.navigate('WorkHeightRiskForm', { offlineDraft: item })} styles={styles} />)}
            {assessments.map((item) => <AssessmentCard key={item.id} item={item} colors={colors} onPress={() => navigation.navigate('WorkHeightRiskDetail', { assessmentId: item.id })} styles={styles} />)}
          </>
        ) : null}

        {tab === 'incidents' ? (
          <>
            <Button title="Осол, зөрчил бүртгэх" variant="danger" onPress={() => navigation.navigate('WorkHeightIncident')} />
            <View style={{ height: spacing.md }} />
            {!incidents.length ? <EmptyState text="Осол, зөрчил бүртгэгдээгүй байна." /> : incidents.map((item) => (
              <Pressable key={item.id} onPress={() => navigation.navigate('WorkHeightIncidentDetail', { incident: item })}>
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{item.incident_type === 'accident' ? 'Осол' : item.incident_type === 'near_miss' ? 'Осол дөхсөн' : 'Аюултай нөхцөл'}</Text>
                  <Badge text={item.severity === 'critical' ? 'Маш ноцтой' : item.severity === 'serious' ? 'Ноцтой' : item.severity === 'medium' ? 'Дунд' : 'Бага'} color={['serious', 'critical'].includes(item.severity) ? colors.danger : item.severity === 'medium' ? colors.warning : colors.success} />
                </View>
                <Text style={styles.meta}>{item.location_name} · {new Date(item.occurred_at).toLocaleString('mn-MN')}</Text>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.muted}>Төлөв: {item.status === 'resolved' || item.status === 'closed' ? 'Шийдвэрлэсэн' : 'Шийдвэрлээгүй'}</Text>
              </Card>
              </Pressable>
            ))}
          </>
        ) : null}

        {tab === 'reports' ? (
          <>
            {!isAdmin ? <Card><Text style={styles.notice}>Та өөрийн үнэлгээ, зөрчлийн тайланг харна. Эрх бүхий удирдлага бүх ажилтны тайланг харна.</Text></Card> : null}
            <View style={styles.stats}>
              <StatCard label="Нийт үнэлгээ" value={summary.total} icon="📋" />
              <StatCard label="Зөвшөөрсөн" value={summary.approved} color={colors.success} icon="✓" />
              <StatCard label="Өндөр эрсдэл" value={summary.highRisk} color={colors.danger} icon="!" />
              <StatCard label="Шийдээгүй зөрчил" value={summary.unresolvedIncidents} color={colors.warning} icon="⚠" />
            </View>
            <Card>
              <SectionTitle>Тайлан ба шүүлтүүр</SectionTitle>
              <Text style={styles.description}>Өдөр, сар, ажилтан, байршлын нарийвчилсан шүүлтүүр болон экспортын дэлгэц.</Text>
              <Button title="Тайлан нээх" onPress={() => navigation.navigate('WorkHeightRiskReport')} />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function AssessmentCard({ item, offline, onPress, colors, styles }: any) {
  const risk = riskLevel(Number(item.max_risk_score || 0));
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{item.work_type || 'Өндөрт ажиллах ажил'}</Text>
          {offline ? <Badge text="Офлайн ноорог" color={colors.warning} /> : <Badge text={STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] || item.status} color={STATUS_TONES[item.status as keyof typeof STATUS_TONES] === 'danger' ? colors.danger : STATUS_TONES[item.status as keyof typeof STATUS_TONES] === 'success' ? colors.success : colors.primary} />}
        </View>
        <Text style={styles.meta}>{item.employee_name} · {item.location_name}</Text>
        <View style={styles.detailRow}>
          <Text style={styles.muted}><Ionicons name="resize-outline" /> {item.height_m} м</Text>
          <Text style={[styles.risk, { color: risk.color }]}>Эрсдэл {item.max_risk_score || 0} · {risk.label}</Text>
          <Text style={styles.muted}>{new Date(item.starts_at).toLocaleDateString('mn-MN')}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const makeStyles = ({ colors }: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 50 },
  // Segmented control — дэвсгэр дээр хөвсөн капсул, идэвхтэй нь цагаан карт.
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 4, padding: 4, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh || colors.surfaceAlt },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabText: { fontWeight: '800', fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 8 },
  description: { color: colors.text, lineHeight: 21, marginVertical: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  risk: { fontSize: 12, fontWeight: '900' },
  notice: { color: colors.warning, lineHeight: 20, fontWeight: '600' },
  offlineCard: { borderColor: colors.warning, borderRadius: radius.lg },
  offlineTitle: { color: colors.text, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
});
