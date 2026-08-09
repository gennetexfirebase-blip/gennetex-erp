import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, Field, ScreenHeader, SectionTitle, Badge } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as feedbackApi from '../services/feedbackService';

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile, isCloud } = useApp();
  const [kind, setKind] = useState('gomdol');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setRows(await feedbackApi.fetchMyFeedback(currentUser.id));
    } catch (e) {
      setRows([]);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const submit = async () => {
    if (!body.trim()) {
      Alert.alert('Анхаар', 'Агуулга бичнэ үү.');
      return;
    }
    setLoading(true);
    try {
      await feedbackApi.submitFeedback({
        userId: currentUser?.id,
        userName: authProfile?.name || currentUser?.name,
        kind,
        subject,
        body,
      });
      setSubject('');
      setBody('');
      await load();
      Alert.alert('Амжилттай', 'Админд илгээгдлээ.');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Санал гомдол" subtitle="Админ шууд харах болно" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {!isCloud ? (
          <Text style={styles.muted}>Supabase холболт шаардлагатай.</Text>
        ) : (
          <>
            <Card>
              <SectionTitle>Шинэ илгээх</SectionTitle>
              <View style={styles.kindRow}>
                {feedbackApi.FEEDBACK_KINDS.map((k) => (
                  <Button
                    key={k.key}
                    title={k.label}
                    variant={kind === k.key ? 'primary' : 'ghost'}
                    style={styles.kindBtn}
                    onPress={() => setKind(k.key)}
                  />
                ))}
              </View>
              <Field label="Гарчиг (заавал биш)" value={subject} onChangeText={setSubject} placeholder="Товч гарчиг" />
              <Field
                label="Агуулга"
                value={body}
                onChangeText={setBody}
                placeholder="Ажилтны нэр дурвал AI шинжилгээнд тооцогдоно"
                multiline
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />
              <Text style={styles.hint}>Жишээ: «Бат залхуу, удаан очдог» гэж бичвэл Бат нэртэй инженерт холбогдоно.</Text>
              <Button title={loading ? 'Илгээж байна...' : 'Илгээх'} onPress={submit} disabled={loading} style={{ marginTop: spacing.sm }} />
            </Card>

            <SectionTitle>📛 Миний гomдol</SectionTitle>
            {rows.filter((r) => r.kind !== 'sanal').length === 0 ? (
              <Text style={styles.muted}>Гomдol илгээгдээгүй.</Text>
            ) : (
              rows.filter((r) => r.kind !== 'sanal').map((r) => (
                <Card key={r.id} style={styles.row}>
                  <View style={styles.rowHead}>
                    <Badge text={feedbackApi.kindLabel(r.kind)} color={colors.danger} />
                    <Text style={styles.date}>{new Date(r.created_at).toLocaleString('mn-MN')}</Text>
                  </View>
                  {r.subject ? <Text style={styles.subj}>{r.subject}</Text> : null}
                  <Text style={styles.bodyText}>{r.body}</Text>
                  {(r.mentioned_employee_names || []).length ? (
                    <Text style={styles.mention}>Дурдсан: {(r.mentioned_employee_names || []).join(', ')}</Text>
                  ) : null}
                </Card>
              ))
            )}

            <SectionTitle>💡 Миний санал</SectionTitle>
            {rows.filter((r) => r.kind === 'sanal').length === 0 ? (
              <Text style={styles.muted}>Санал илгээгдээгүй.</Text>
            ) : (
              rows.filter((r) => r.kind === 'sanal').map((r) => (
                <Card key={r.id} style={styles.row}>
                  <View style={styles.rowHead}>
                    <Badge text={feedbackApi.kindLabel(r.kind)} color={colors.primary} />
                    <Text style={styles.date}>{new Date(r.created_at).toLocaleString('mn-MN')}</Text>
                  </View>
                  {r.subject ? <Text style={styles.subj}>{r.subject}</Text> : null}
                  <Text style={styles.bodyText}>{r.body}</Text>
                  {(r.mentioned_employee_names || []).length ? (
                    <Text style={styles.mention}>Дурдсан: {(r.mentioned_employee_names || []).join(', ')}</Text>
                  ) : null}
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 40 },
  kindRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kindBtn: { flex: 1 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  row: { marginBottom: spacing.sm },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date: { fontSize: 11, color: colors.textMuted },
  subj: { fontWeight: '700', color: colors.text, marginBottom: 4 },
  bodyText: { color: colors.text, lineHeight: 20, fontSize: 14 },
  mention: { marginTop: 6, fontSize: 12, color: '#b45309', fontWeight: '600' },
});
