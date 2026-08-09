import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, ScreenHeader, SectionTitle, Badge, EmptyState } from '../components/ui';
import { spacing } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { DEVELOPER_EMAIL, DEVELOPER_LABEL } from '../lib/developerConfig';
import * as devApi from '../services/developerMessageService';

function MessageCard({ row, onOpen, onPdf }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onOpen(row)}>
      <Card style={styles.row}>
        <View style={styles.head}>
          <Text style={styles.from}>{row.user_name || '—'}</Text>
          <Badge text={row.status === 'new' ? 'Шинэ' : 'Уншсан'} color={row.status === 'new' ? colors.danger : colors.textMuted} />
        </View>
        {row.user_email ? <Text style={styles.email}>{row.user_email}</Text> : null}
        {row.subject ? <Text style={styles.subj}>{row.subject}</Text> : null}
        <Text style={styles.preview} numberOfLines={3}>{row.body}</Text>
        <View style={styles.actions}>
          <Text style={styles.date}>{new Date(row.created_at).toLocaleString('mn-MN')}</Text>
          <Button title="PDF" size="sm" variant="ghost" onPress={() => onPdf(row)} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function DeveloperInboxScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isSuperAdmin, isCloud } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await devApi.fetchDeveloperInbox());
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isSuperAdmin && isCloud) load();
    }, [isSuperAdmin, isCloud, load])
  );

  useEffect(() => {
    if (!isSuperAdmin || !isCloud) return undefined;
    return devApi.subscribeDeveloperMessages(load);
  }, [isSuperAdmin, isCloud, load]);

  const openDetail = async (row) => {
    setDetail(row);
    if (row.status === 'new') {
      try {
        await devApi.updateDeveloperMessageStatus(row.id, 'read');
        load();
      } catch (e) {}
    }
  };

  const exportAllPdf = async () => {
    if (!rows.length) {
      Alert.alert('Анхаар', 'PDF-д оруулах мэдээ алга.');
      return;
    }
    setExporting(true);
    try {
      await devApi.exportDeveloperMessagesPdf(rows, { title: `${DEVELOPER_LABEL}ид ирсэн мэдээ` });
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'PDF үүсгэх амжилтгүй');
    } finally {
      setExporting(false);
    }
  };

  const exportOnePdf = async (row) => {
    try {
      await devApi.exportSingleDeveloperMessagePdf(row);
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'PDF үүсгэх амжилтгүй');
    }
  };

  if (!isSuperAdmin || !isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ирсэн мэдээ" />
        <EmptyState text="Зөвхөн хөгжүүлэгч." />
      </View>
    );
  }

  const newCount = rows.filter((r) => r.status === 'new').length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Над руу ирсэн мэдээ"
        subtitle={`${DEVELOPER_LABEL} · ${newCount} шинэ · ${DEVELOPER_EMAIL}`}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Card>
          <Text style={styles.desc}>Бүх хэрэглэгчийн илгээсэн мэдээг текст эсвэл PDF-ээр харна.</Text>
          <View style={styles.btnRow}>
            <Button title={exporting ? 'PDF...' : 'PDF (бүгд)'} onPress={exportAllPdf} disabled={exporting || !rows.length} style={{ flex: 1 }} />
          </View>
        </Card>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : rows.length === 0 ? (
          <EmptyState text="Ирсэн мэдээ алга." />
        ) : (
          rows.map((r) => (
            <MessageCard key={r.id} row={r} onOpen={openDetail} onPdf={exportOnePdf} />
          ))
        )}
      </ScrollView>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <SectionTitle>{detail?.subject || 'Мэдээ'}</SectionTitle>
              <Text style={styles.meta}>
                {detail?.user_name || '—'}
                {detail?.user_email ? ` · ${detail.user_email}` : ''}
              </Text>
              <Text style={styles.meta}>{detail ? new Date(detail.created_at).toLocaleString('mn-MN') : ''}</Text>
              <Text style={styles.fullBody}>{detail?.body || ''}</Text>
              <View style={styles.btnRow}>
                <Button title="Хаах" variant="ghost" style={{ flex: 1 }} onPress={() => setDetail(null)} />
                <Button title="PDF" style={{ flex: 1 }} onPress={() => detail && exportOnePdf(detail)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 40 },
  desc: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.sm },
  btnRow: { flexDirection: 'row', gap: spacing.md },
  row: { marginBottom: spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  from: { fontSize: 15, fontWeight: '800', color: colors.text },
  email: { fontSize: 12, color: colors.primary, marginBottom: 4 },
  subj: { fontWeight: '700', marginBottom: 4, color: colors.text },
  preview: { fontSize: 14, lineHeight: 20, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  date: { fontSize: 11, color: colors.textMuted },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  fullBody: { fontSize: 15, lineHeight: 22, color: colors.text, marginVertical: spacing.md },
});
