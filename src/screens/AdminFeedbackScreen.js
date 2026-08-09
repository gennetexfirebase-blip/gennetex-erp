import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, ScreenHeader, SectionTitle, Badge, EmptyState } from '../components/ui';
import { spacing } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as feedbackApi from '../services/feedbackService';

function FeedbackCard({ row, onPress }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card style={styles.row}>
        <View style={styles.head}>
          <Text style={styles.from}>Ажилтан {row.user_name || '—'}</Text>
          <Badge
            text={row.status === 'new' ? 'Шинэ' : feedbackApi.kindLabel(row.kind)}
            color={row.status === 'new' ? colors.danger : colors.textMuted}
          />
        </View>
        <Text style={styles.kind}>{feedbackApi.kindLabel(row.kind)} ирлээ</Text>
        {row.subject ? <Text style={styles.subj}>{row.subject}</Text> : null}
        <Text style={styles.bodyText}>{row.body}</Text>
        {(row.mentioned_employee_names || []).length ? (
          <Text style={styles.mention}>Дурдсан инженер: {(row.mentioned_employee_names || []).join(', ')}</Text>
        ) : null}
        <Text style={styles.date}>{new Date(row.created_at).toLocaleString('mn-MN')}</Text>
      </Card>
    </TouchableOpacity>
  );
}

export default function AdminFeedbackScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await feedbackApi.fetchAllFeedback());
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin && isCloud) load();
    }, [isAdmin, isCloud, load])
  );

  useEffect(() => {
    if (!isAdmin || !isCloud) return undefined;
    return feedbackApi.subscribeFeedback(load);
  }, [isAdmin, isCloud, load]);

  const gomdolRows = useMemo(() => rows.filter((r) => r.kind !== 'sanal'), [rows]);
  const sanalRows = useMemo(() => rows.filter((r) => r.kind === 'sanal'), [rows]);

  const markRead = async (id) => {
    try {
      await feedbackApi.updateFeedbackStatus(id, 'read');
      load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    }
  };

  const exportPdf = async () => {
    if (!rows.length) {
      Alert.alert('Анхаар', 'PDF-д оруулах илгээлт алга.');
      return;
    }
    setExporting(true);
    try {
      await feedbackApi.exportFeedbackPdf(rows, { title: 'Санал гомдол' });
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'PDF үүсгэх амжилтгүй');
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin || !isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Санал гомдол" />
        <EmptyState text="Зөвхөн админ." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Санал гомдол" subtitle={`Гомдол ${gomdolRows.length} · Санал ${sanalRows.length}`} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Card>
          <Text style={styles.desc}>
            Дурдсан инженерийн гomдol «Гomдol» хэсэгт, санал «Санал» хэсэгт харагдана. AI гүйцэтгэлд мөн тусдаа тооцогдоно.
          </Text>
          <Button
            title={exporting ? 'PDF бэлдэж байна...' : 'PDF татах (бүгд)'}
            onPress={exportPdf}
            disabled={exporting || !rows.length}
          />
        </Card>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <SectionTitle>📛 Гomдol ({gomdolRows.length})</SectionTitle>
            {gomdolRows.length === 0 ? (
              <Text style={styles.muted}>Гomдol алга.</Text>
            ) : (
              gomdolRows.map((r) => <FeedbackCard key={r.id} row={r} onPress={() => markRead(r.id)} />)
            )}

            <SectionTitle>💡 Санал ({sanalRows.length})</SectionTitle>
            {sanalRows.length === 0 ? (
              <Text style={styles.muted}>Санал алга.</Text>
            ) : (
              sanalRows.map((r) => <FeedbackCard key={r.id} row={r} onPress={() => markRead(r.id)} />)
            )}

            {!rows.length ? <EmptyState text="Илгээлт алга." /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 40 },
  desc: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.sm },
  muted: { textAlign: 'center', color: colors.textMuted, marginVertical: 12 },
  row: { marginBottom: spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  from: { fontSize: 15, fontWeight: '800', color: colors.text },
  kind: { fontSize: 13, color: colors.primary, fontWeight: '700', marginBottom: 6 },
  subj: { fontWeight: '700', marginBottom: 4, color: colors.text },
  bodyText: { fontSize: 14, lineHeight: 20, color: colors.text },
  mention: { marginTop: 8, fontSize: 12, color: '#b45309', fontWeight: '700' },
  date: { marginTop: 8, fontSize: 11, color: colors.textMuted },
});
