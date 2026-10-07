import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStyles, useTheme } from '../context/ThemeContext';
import * as UI from '../components/ui';
import { radius, spacing } from '../theme';
import { STATUS_LABELS } from '../modules/workHeightRisk/domain';
import * as api from '../modules/workHeightRisk/service';
import type { WorkHeightAssessment, WorkHeightIncident, WorkHeightStatus } from '../modules/workHeightRisk/types';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const { Button, Card, Field, LoadingState, ScreenHeader, SectionTitle, StatCard } = UI as any;

export default function WorkHeightRiskReportScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [employee, setEmployee] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'all' | WorkHeightStatus>('all');
  const [rows, setRows] = useState<WorkHeightAssessment[]>([]);
  const [incidents, setIncidents] = useState<WorkHeightIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assessmentRows, incidentRows] = await Promise.all([
        api.fetchAssessments({ from, to }),
        api.fetchIncidents({ from, to }),
      ]);
      setRows(assessmentRows);
      setIncidents(incidentRows);
    } catch (error) {
      Alert.alert('Алдаа', api.mapWorkHeightError(error));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => rows.filter((row) =>
    (!employee.trim() || `${row.employee_name} ${row.employee_code || ''}`.toLowerCase().includes(employee.trim().toLowerCase()))
    && (!location.trim() || row.location_name.toLowerCase().includes(location.trim().toLowerCase()))
    && (status === 'all' || row.status === status)
  ), [rows, employee, location, status]);
  const filteredIncidents = useMemo(() => incidents.filter((row) =>
    (!employee.trim() || (row.reporter_name || '').toLowerCase().includes(employee.trim().toLowerCase()))
    && (!location.trim() || row.location_name.toLowerCase().includes(location.trim().toLowerCase()))
  ), [incidents, employee, location]);
  const summary = useMemo(() => api.reportSummary(filtered, filteredIncidents), [filtered, filteredIncidents]);

  const exportFile = async (kind: 'pdf' | 'excel') => {
    setExporting(true);
    try {
      if (kind === 'pdf') await api.exportReportPdf(filtered, filteredIncidents, `${from} — ${to} өндөрт ажиллах тайлан`);
      else await api.exportReportExcel(filtered, filteredIncidents);
    } catch (error) {
      Alert.alert('Экспортын алдаа', api.mapWorkHeightError(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Өндөрт ажиллах тайлан" subtitle="Өдөр · сар · ажилтан · байршил" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card>
          <SectionTitle>Шүүлтүүр</SectionTitle>
          <View style={styles.two}>
            <Field label="Эхлэх өдөр" value={from} onChangeText={setFrom} style={styles.half} />
            <Field label="Дуусах өдөр" value={to} onChangeText={setTo} style={styles.half} />
          </View>
          <Field label="Ажилтан" value={employee} onChangeText={setEmployee} placeholder="Нэр эсвэл ID" />
          <Field label="Байршил" value={location} onChangeText={setLocation} placeholder="Байршлын нэр" />
          <Text style={styles.label}>Төлөв</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Бүгд" active={status === 'all'} onPress={() => setStatus('all')} colors={colors} styles={styles} />
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Chip key={key} label={label} active={status === key} onPress={() => setStatus(key as WorkHeightStatus)} colors={colors} styles={styles} />
            ))}
          </ScrollView>
          <Button title="Шинэчлэх" variant="ghost" onPress={load} />
        </Card>

        {loading ? <LoadingState /> : (
          <>
            <View style={styles.stats}>
              <StatCard label="Нийт үнэлгээ" value={summary.total} />
              <StatCard label="Зөвшөөрсөн" value={summary.approved} color={colors.success} />
              <StatCard label="Өндөр эрсдэл" value={summary.highRisk} color={colors.danger} />
              <StatCard label="Шийдээгүй зөрчил" value={summary.unresolvedIncidents} color={colors.warning} />
            </View>
            <Card>
              <SectionTitle>Хамгаалалтын шалгалт</SectionTitle>
              <Text style={styles.big}>{summary.ppeComplete} / {summary.total}</Text>
              <Text style={styles.muted}>PPE checklist бүрэн үнэлгээ</Text>
            </Card>
            <View style={styles.two}>
              <Button title="PDF экспорт" loading={exporting} onPress={() => exportFile('pdf')} style={styles.half} />
              <Button title="Excel экспорт" variant="success" loading={exporting} onPress={() => exportFile('excel')} style={styles.half} />
            </View>
            <Text style={styles.result}>Шүүлтүүрийн үр дүн: {filtered.length} үнэлгээ · {filteredIncidents.length} зөрчил</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress, colors, styles }: any) {
  return <Pressable onPress={onPress} style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.surfaceAlt }]}><Text style={{ color: active ? colors.primary : colors.text, fontWeight: '700', fontSize: 12 }}>{label}</Text></Pressable>;
}

const makeStyles = ({ colors }: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 50 },
  two: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  chips: { gap: 7, paddingBottom: spacing.md },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 9 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  big: { color: colors.success, fontSize: 30, fontWeight: '900' },
  muted: { color: colors.textMuted },
  result: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
