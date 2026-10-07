import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { useStyles, useTheme } from '../context/ThemeContext';
import * as UI from '../components/ui';
import { hasPermission } from '../lib/permissions';
import { spacing, radius } from '../theme';
import * as api from '../modules/workHeightRisk/service';
import type { WorkHeightIncident } from '../modules/workHeightRisk/types';

const { Badge, Button, Card, Field, ScreenHeader, SectionTitle } = UI as any;

const TYPE_LABELS = {
  unsafe_condition: 'Аюултай нөхцөл',
  near_miss: 'Осол дөхсөн',
  accident: 'Осол',
};

const SEVERITY_LABELS = {
  low: 'Бага',
  medium: 'Дунд',
  serious: 'Ноцтой',
  critical: 'Маш ноцтой',
};

export default function WorkHeightIncidentDetailScreen({ navigation, route }: any) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { authProfile, isAdmin } = useApp() as any;
  const [incident, setIncident] = useState<WorkHeightIncident>(route.params?.incident);
  const [resolution, setResolution] = useState(incident?.resolution || '');
  const [saving, setSaving] = useState(false);
  const canResolve = Boolean(isAdmin || hasPermission(authProfile, 'approve'));
  const isOpen = !['resolved', 'closed'].includes(incident?.status || 'open');

  const resolve = async (close: boolean) => {
    if (!incident?.id || !resolution.trim()) {
      Alert.alert('Тайлбар шаардлагатай', 'Шийдвэрлэсэн арга хэмжээ, тайлбарыг оруулна уу.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.resolveIncident(incident.id, resolution.trim(), close);
      setIncident((current) => ({ ...current, ...updated, resolution: resolution.trim() }));
      Alert.alert('Амжилттай', close ? 'Зөрчлийг хаалаа.' : 'Зөрчлийг шийдвэрлэсэн төлөвт орууллаа.');
    } catch (error) {
      Alert.alert('Алдаа', api.mapWorkHeightError(error));
    } finally {
      setSaving(false);
    }
  };

  if (!incident) {
    return <View style={styles.container}><ScreenHeader title="Осол, зөрчил" /><Text style={styles.empty}>Мэдээлэл олдсонгүй.</Text></View>;
  }

  const severityColor = ['serious', 'critical'].includes(incident.severity)
    ? colors.danger
    : incident.severity === 'medium' ? colors.warning : colors.success;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Осол, зөрчлийн дэлгэрэнгүй" subtitle={incident.location_name} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>{TYPE_LABELS[incident.incident_type]}</Text>
            <Badge text={SEVERITY_LABELS[incident.severity]} color={severityColor} />
          </View>
          <Text style={styles.meta}>{new Date(incident.occurred_at).toLocaleString('mn-MN')}</Text>
          <Text style={styles.description}>{incident.description}</Text>
          <Text style={styles.meta}>Байршил: {incident.location_name}</Text>
          {incident.latitude != null && incident.longitude != null ? (
            <Text style={styles.meta}>GPS: {Number(incident.latitude).toFixed(6)}, {Number(incident.longitude).toFixed(6)}</Text>
          ) : null}
          <Text style={styles.status}>Төлөв: {incident.status === 'closed' ? 'Хаасан' : incident.status === 'resolved' ? 'Шийдвэрлэсэн' : incident.status === 'investigating' ? 'Шалгаж байна' : 'Нээлттэй'}</Text>
        </Card>

        {incident.evidence?.length ? (
          <Card>
            <SectionTitle>Фото нотолгоо</SectionTitle>
            <View style={styles.photos}>
              {incident.evidence.map((item, index) => item.signed_url ? (
                <Image key={item.id || `${item.storage_path}-${index}`} source={{ uri: item.signed_url }} style={styles.photo} />
              ) : null)}
            </View>
          </Card>
        ) : null}

        {incident.resolution && !isOpen ? (
          <Card><SectionTitle>Шийдвэрлэсэн арга хэмжээ</SectionTitle><Text style={styles.description}>{incident.resolution}</Text></Card>
        ) : null}

        {canResolve && isOpen ? (
          <Card>
            <SectionTitle>Зөрчил шийдвэрлэх</SectionTitle>
            <Field
              label="Авсан арга хэмжээ"
              required
              value={resolution}
              onChangeText={setResolution}
              multiline
              inputStyle={{ minHeight: 110, textAlignVertical: 'top' }}
              placeholder="Шалтгаан, засварласан арга хэмжээ, дахин гарахаас сэргийлсэн шийдэл..."
            />
            <View style={styles.actions}>
              <Button title="Шийдвэрлэсэн" loading={saving} onPress={() => resolve(false)} style={{ flex: 1 }} />
              <Button title="Хаах" variant="success" loading={saving} onPress={() => resolve(true)} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        <Button title="Буцах" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 50 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  description: { color: colors.text, fontSize: 15, lineHeight: 22, marginTop: spacing.md },
  status: { color: colors.primary, fontWeight: '800', marginTop: spacing.md },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  actions: { flexDirection: 'row', gap: spacing.sm },
  empty: { color: colors.textMuted, padding: spacing.lg, textAlign: 'center' },
});
