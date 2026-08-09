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
import { Card, Button, Field, ScreenHeader, SectionTitle, Badge, EmptyState } from '../components/ui';
import { spacing } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as ohaabApi from '../services/ohaabService';

export default function AdminOhaabScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, currentUser, authProfile } = useApp();
  const [title, setTitle] = useState('ХААБ заавар');
  const [body, setBody] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [todayAcks, setTodayAcks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inst, acks] = await Promise.all([
        ohaabApi.fetchInstruction(),
        ohaabApi.fetchTodayAcks(),
      ]);
      setTitle(inst?.title || 'ХААБ заавар');
      setBody(inst?.body || '');
      setUpdatedAt(inst?.updated_at || null);
      setTodayAcks(acks);
    } catch (e) {
      setTodayAcks([]);
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

  const save = async () => {
    if (!body.trim()) {
      Alert.alert('Анхаар', 'Зааврын агуулга оруулна уу.');
      return;
    }
    setSaving(true);
    try {
      const row = await ohaabApi.saveInstruction({
        title,
        body,
        userId: currentUser?.id,
        userName: authProfile?.name || currentUser?.name,
      });
      setUpdatedAt(row.updated_at);
      Alert.alert('Хадгалагдлаа', 'Бүх ажилтан шинэ зааврыг уншиж баталгаажуулах шаардлагатай.');
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Хадгалахад алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="ХААБ заавар" subtitle="Зөвхөн админ" />
        <EmptyState title="Эрх хүрэхгүй" subtitle="Админ эрх шаардлагатай." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="ХААБ заавар" subtitle="Агуулга оруулах · баталгаажуулалт харах" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
            }}
          />
        }
      >
        {!isCloud ? (
          <Text style={styles.muted}>Supabase холболт шаардлагатай.</Text>
        ) : (
          <>
            <Card>
              <SectionTitle>Зааврын агуулга</SectionTitle>
              {updatedAt ? (
                <Text style={styles.meta}>Сүүлд шинэчилсэн: {new Date(updatedAt).toLocaleString('mn-MN')}</Text>
              ) : null}
              <Field label="Гарчиг" value={title} onChangeText={setTitle} placeholder="ХААБ заавар" />
              <Field
                label="Агуулга"
                value={body}
                onChangeText={setBody}
                placeholder="Аюулгүй ажиллагааны заавар, дүрэм, анхааруулга..."
                multiline
                style={{ minHeight: 200, textAlignVertical: 'top' }}
              />
              <Text style={styles.hint}>
                Ажилтан өдөр бүр зааврыг бүрэн уншиж, гарын үсэг зурна. Баталгаажуулаагүй бол бараа материал, багаж шинээр бүртгэхгүй.
              </Text>
              <Button
                title={saving ? 'Хадгалж байна...' : 'Хадгалах'}
                onPress={save}
                disabled={saving}
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            <SectionTitle>Өнөөдөр баталгаажсан ({todayAcks.length})</SectionTitle>
            {loading ? (
              <Text style={styles.muted}>Ачаалж байна...</Text>
            ) : todayAcks.length === 0 ? (
              <EmptyState title="Одоогоор хэн ч баталгаажуулаагүй" subtitle={ohaabApi.todayAckDate()} />
            ) : (
              todayAcks.map((row) => (
                <Card key={row.id} style={styles.ackRow}>
                  <View style={styles.ackHead}>
                    <Text style={styles.ackName}>{row.user_name || 'Ажилтан'}</Text>
                    <Badge text="Баталсан" color={colors.success} />
                  </View>
                  <Text style={styles.ackTime}>{new Date(row.signed_at).toLocaleString('mn-MN')}</Text>
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
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
  meta: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  ackRow: { marginBottom: spacing.sm },
  ackHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ackName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  ackTime: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
