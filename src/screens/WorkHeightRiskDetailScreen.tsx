import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useStyles, useTheme } from '../context/ThemeContext';
import * as UI from '../components/ui';
import { radius, spacing } from '../theme';
import { hasPermission } from '../lib/permissions';
import { PpeChecklist, RiskBadge } from '../modules/workHeightRisk/components';
import { approvalBlockReason, AUDIT_ACTION_LABELS, STATUS_LABELS, STATUS_TONES } from '../modules/workHeightRisk/domain';
import * as api from '../modules/workHeightRisk/service';
import type { WorkHeightAssessment } from '../modules/workHeightRisk/types';
const { Badge, Button, Card, EmptyState, Field, LoadingState, ScreenHeader, SectionTitle } = UI as any;

export default function WorkHeightRiskDetailScreen({ navigation, route }: any) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { currentUser, isAdmin, authProfile } = useApp() as any;
  const [assessment, setAssessment] = useState<WorkHeightAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState('');
  const id = route.params?.assessmentId;

  const load = useCallback(async () => {
    try { setAssessment(await api.fetchAssessment(id)); }
    catch (error) { Alert.alert('Алдаа', api.mapWorkHeightError(error)); }
    finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const block = useMemo(() => assessment ? approvalBlockReason(assessment) : null, [assessment]);
  const act = async (action: string, requireNote = false) => {
    if (!assessment?.id) return;
    if (requireNote && !note.trim()) return Alert.alert('Тайлбар шаардлагатай', 'Шалтгаан, тайлбар оруулна уу.');
    setActing(true);
    try {
      await api.transitionAssessment(assessment.id, action, note);
      setNote('');
      await load();
    } catch (error) { Alert.alert('Үйлдэл амжилтгүй', api.mapWorkHeightError(error)); }
    finally { setActing(false); }
  };

  if (loading) return <View style={styles.container}><ScreenHeader title="Эрсдэлийн үнэлгээ" /><LoadingState /></View>;
  if (!assessment) return <View style={styles.container}><ScreenHeader title="Эрсдэлийн үнэлгээ" /><EmptyState text="Үнэлгээ олдсонгүй." /></View>;
  const mine = assessment.employee_id === currentUser?.id || (assessment as any).created_by === currentUser?.id;
  const canReview = isAdmin || hasPermission(authProfile, 'approve');
  const editable = ['draft', 'changes_required'].includes(assessment.status) && (mine || isAdmin);
  const statusTone = STATUS_TONES[assessment.status];
  const statusColor = statusTone === 'danger' ? colors.danger : statusTone === 'success' ? colors.success : statusTone === 'warning' ? colors.warning : colors.primary;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Өндөрт ажиллах зөвшөөрөл" subtitle={assessment.location_name} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <View style={styles.rowBetween}><Badge text={STATUS_LABELS[assessment.status]} color={statusColor} /><RiskBadge score={assessment.max_risk_score || 0} /></View>
          <Text style={styles.title}>{assessment.work_type}</Text>
          <Info label="Ажилтан" value={`${assessment.employee_name}${assessment.employee_code ? ` · ${assessment.employee_code}` : ''}`} styles={styles} />
          <Info label="Байршил" value={assessment.location_name} styles={styles} />
          <Info label="Өндөр" value={`${assessment.height_m} метр`} styles={styles} />
          <Info label="Хугацаа" value={`${new Date(assessment.starts_at).toLocaleString('mn-MN')} — ${new Date(assessment.ends_at).toLocaleString('mn-MN')}`} styles={styles} />
          <Info label="Цаг агаар" value={assessment.weather} styles={styles} />
          <Info label="Хамтрагчид" value={assessment.partner_names?.join(', ') || '—'} styles={styles} />
          <Info label="Тоног төхөөрөмж" value={assessment.equipment?.join(', ') || '—'} styles={styles} />
          {editable ? <Button title="Үнэлгээ засах" variant="ghost" onPress={() => navigation.navigate('WorkHeightRiskForm', { assessment })} style={{ marginTop: spacing.md }} /> : null}
        </Card>

        {block ? <Card style={{ borderColor: colors.danger }}><Text style={styles.blockTitle}>ЗӨВШӨӨРӨЛ ХААЛТТАЙ</Text><Text style={styles.blockText}>{block}</Text></Card> : null}

        <Card>
          <SectionTitle>Аюул ба эрсдэлийн оноо</SectionTitle>
          {assessment.hazards.map((hazard, index) => (
            <View key={hazard.id || index} style={[styles.hazard, { borderColor: colors.border }]}>
              <View style={styles.rowBetween}><Text style={styles.hazardTitle}>{index + 1}. {hazard.description}</Text><RiskBadge score={hazard.risk_score || hazard.likelihood * hazard.consequence} /></View>
              <Text style={styles.meta}>Магадлал {hazard.likelihood} × Үр дагавар {hazard.consequence}</Text>
              <Text style={styles.control}>Хяналт: {hazard.control_measure}</Text>
            </View>
          ))}
        </Card>

        <Card><SectionTitle>Хамгаалах хэрэгсэл</SectionTitle><PpeChecklist items={assessment.ppe_checks} readonly /></Card>

        <Card>
          <SectionTitle>Фото нотолгоо</SectionTitle>
          {assessment.evidence?.length ? <View style={styles.photos}>{assessment.evidence.map((item, index) => item.signed_url ? <Image key={item.id || index} source={{ uri: item.signed_url }} style={styles.photo} /> : null)}</View> : <Text style={styles.muted}>Фото нотолгоо байхгүй.</Text>}
        </Card>

        <Card>
          <SectionTitle>Зөвшөөрөл ба үйлдэл</SectionTitle>
          <Field label="Шийдвэрийн тайлбар" value={note} onChangeText={setNote} multiline inputStyle={{ minHeight: 70, textAlignVertical: 'top' }} placeholder="Засвар, зогсоох шалтгаан..." />
          <View style={styles.actions}>
            {mine && ['draft', 'changes_required'].includes(assessment.status) ? <Button title="Үнэлгээнд илгээх" loading={acting} onPress={() => act('submit')} style={styles.action} /> : null}
            {canReview && assessment.status === 'pending_review' ? <Button title="ХАБЭА баталгаажуулах" loading={acting} disabled={!!block} onPress={() => act('hse_approve')} style={styles.action} /> : null}
            {canReview && ['pending_review', 'hse_approved'].includes(assessment.status) ? <Button title="Засвар буцаах" variant="warning" loading={acting} onPress={() => act('request_changes', true)} style={styles.action} /> : null}
            {canReview && assessment.status === 'hse_approved' ? <Button title="Удирдлага зөвшөөрөх" variant="success" loading={acting} disabled={!!block} onPress={() => act('management_approve')} style={styles.action} /> : null}
            {(mine || canReview) && assessment.status === 'management_approved' ? <Button title="Ажил эхлүүлэх" variant="success" loading={acting} disabled={!!block} onPress={() => act('start')} style={styles.action} /> : null}
            {(mine || canReview) && assessment.status === 'in_progress' ? <Button title="Ажил дуусгах" variant="success" loading={acting} onPress={() => act('complete')} style={styles.action} /> : null}
            {!['completed', 'stopped'].includes(assessment.status) ? <Button title="Ажил зогсоох" variant="danger" loading={acting} onPress={() => act('stop', true)} style={styles.action} /> : null}
            <Button title="Осол, зөрчил бүртгэх" variant="ghost" onPress={() => navigation.navigate('WorkHeightIncident', { assessment })} style={styles.action} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Audit trail</SectionTitle>
          {!assessment.audit?.length ? <Text style={styles.muted}>Түүх байхгүй.</Text> : assessment.audit.map((item) => (
            <View key={item.id} style={[styles.audit, { borderLeftColor: colors.primary }]}>
              <Text style={styles.auditTitle}>{item.actor_name} · {AUDIT_ACTION_LABELS[item.action] || item.action}</Text>
              <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('mn-MN')}{item.to_status ? ` · ${STATUS_LABELS[item.to_status]}` : ''}</Text>
              {item.note ? <Text style={styles.control}>{item.note}</Text> : null}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function Info({ label, value, styles }: any) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

const makeStyles = ({ colors }: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg }, body: { padding: spacing.lg, paddingBottom: 50 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontWeight: '900', fontSize: 20, marginVertical: spacing.md },
  info: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6 }, infoLabel: { color: colors.textMuted, width: 100, fontSize: 13 }, infoValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' },
  blockTitle: { color: colors.danger, fontWeight: '900', marginBottom: 5 }, blockText: { color: colors.text, lineHeight: 20 },
  hazard: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }, hazardTitle: { color: colors.text, fontWeight: '800', flex: 1 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 5 }, control: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 7 }, muted: { color: colors.textMuted },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, photo: { width: 105, height: 105, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  actions: { gap: spacing.sm }, action: { width: '100%' },
  audit: { borderLeftWidth: 3, paddingLeft: spacing.md, paddingVertical: spacing.sm }, auditTitle: { color: colors.text, fontWeight: '700' },
});
