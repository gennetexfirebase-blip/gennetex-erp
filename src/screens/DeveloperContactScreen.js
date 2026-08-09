import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, Field, ScreenHeader, SectionTitle, Badge } from '../components/ui';
import { spacing } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { DEVELOPER_EMAIL, DEVELOPER_LABEL, SUPERADMIN_EMAIL, HAS_DEVELOPER_EMAIL } from '../lib/developerConfig';
import * as devApi from '../services/developerMessageService';

export default function DeveloperContactScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { currentUser, authProfile, isCloud, isSuperAdmin } = useApp();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sent, setSent] = useState([]);

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setSent(await devApi.fetchMyDeveloperMessages(currentUser.id));
    } catch (e) {
      setSent([]);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openEmailApp = () => {
    if (!HAS_DEVELOPER_EMAIL) {
      Alert.alert('Тохиргоо', '.env файлд EXPO_PUBLIC_DEVELOPER_EMAIL оруулна уu.');
      return;
    }
    const sub = subject.trim() || 'Gennetex ERP — холбоо барих';
    const who = authProfile?.name || currentUser?.name || '';
    const from = authProfile?.email || '';
    const footer = who || from ? `\n\n---\nИлгээгч: ${who}${from ? `\n${from}` : ''}` : '';
    const url =
      `mailto:${SUPERADMIN_EMAIL}?subject=${encodeURIComponent(sub)}` +
      `&body=${encodeURIComponent((body.trim() || '') + footer)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Superadmin имэйл', SUPERADMIN_EMAIL);
    });
  };

  const submit = async () => {
    if (!body.trim()) {
      Alert.alert('Анхаар', 'Мессеж бичнэ үү.');
      return;
    }
    setLoading(true);
    try {
      const result = await devApi.submitDeveloperMessage({
        userId: currentUser?.id,
        userName: authProfile?.name || currentUser?.name,
        userEmail: authProfile?.email,
        subject,
        body,
      });
      setSubject('');
      setBody('');
      await load();
      const detail = result.emailSent
        ? `${SUPERADMIN_EMAIL || 'тохируулсан имэйл'} руу илгээгдлээ.\nPush мэдэгдэл ирнэ.`
        : `${DEVELOPER_LABEL}ид хадгалагдлаа.\nPush мэдэгдэл ирнэ.${
            HAS_DEVELOPER_EMAIL ? '' : '\n\nИмэйл: .env дээр EXPO_PUBLIC_DEVELOPER_EMAIL тохируулна.'
          }`;
      Alert.alert('Амжилттай', detail);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={`${DEVELOPER_LABEL}тэй холбогдох`} subtitle="ERP дэмжлэг, санал, алдаа" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Card>
          <SectionTitle>Холбоо барих имэйл</SectionTitle>
          <Text style={styles.desc}>
            Аппаас шууд бичиж илгээх боломжтой.{HAS_DEVELOPER_EMAIL ? ` Мэдээ ${SUPERADMIN_EMAIL} руу ирнэ.` : ''}
          </Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailLabel}>Хүлээн авагч</Text>
            {HAS_DEVELOPER_EMAIL ? (
              <TouchableOpacity onPress={openEmailApp} activeOpacity={0.7}>
                <Text style={styles.emailValue}>{SUPERADMIN_EMAIL}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.mutedSmall}>.env → EXPO_PUBLIC_DEVELOPER_EMAIL</Text>
            )}
          </View>
          {isSuperAdmin ? (
            <Button
              title="Над руу ирсэн мэдээ"
              style={{ marginTop: spacing.sm }}
              onPress={() => navigation.navigate('DeveloperInbox')}
            />
          ) : null}
        </Card>

        {!isCloud ? (
          <Text style={styles.muted}>Supabase холболт шаардлагатай.</Text>
        ) : (
          <Card>
            <SectionTitle>Имэйл бичиж илгээх</SectionTitle>
            <Field label="Гарчиг" placeholder="Ж: Апп удаан ачааллагдаж байна" value={subject} onChangeText={setSubject} />
            <Field
              label="Агуулга"
              placeholder="Асуудлаа дэлгэрэнгүй бичнэ үү..."
              value={body}
              onChangeText={setBody}
              multiline
              inputStyle={{ minHeight: 110, textAlignVertical: 'top' }}
            />
            <Button title={loading ? 'Илгээж байна...' : 'Илгээх'} onPress={submit} disabled={loading} />
            <Button
              title="Имэйл апп нээх (Gmail г.м)"
              variant="ghost"
              style={{ marginTop: spacing.sm }}
              onPress={openEmailApp}
              disabled={!HAS_DEVELOPER_EMAIL}
            />
          </Card>
        )}

        {sent.length ? (
          <>
            <SectionTitle>Миний илгээсэн</SectionTitle>
            {sent.map((m) => (
              <Card key={m.id} style={styles.sentCard}>
                <View style={styles.sentHead}>
                  <Text style={styles.sentSubj}>{m.subject || 'Гарчиггүй'}</Text>
                  <Badge text={m.status === 'new' ? 'Шинэ' : 'Уншсан'} color={m.status === 'new' ? colors.warning : colors.textMuted} />
                </View>
                <Text style={styles.sentBody} numberOfLines={4}>{m.body}</Text>
                <Text style={styles.sentDate}>{new Date(m.created_at).toLocaleString('mn-MN')}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 40 },
  desc: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  emailRow: { marginBottom: spacing.sm },
  emailLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  emailValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  muted: { textAlign: 'center', color: colors.textMuted, marginTop: 12 },
  mutedSmall: { fontSize: 13, color: colors.textMuted },
  sentCard: { marginBottom: spacing.sm },
  sentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sentSubj: { fontWeight: '800', color: colors.text, flex: 1, marginRight: 8 },
  sentBody: { fontSize: 14, lineHeight: 20, color: colors.text },
  sentDate: { marginTop: 8, fontSize: 11, color: colors.textMuted },
});
