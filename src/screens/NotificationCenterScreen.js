import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Card, EmptyState, HeaderButton, ScreenHeader } from '../components/ui';
import { spacing } from '../theme';
import { navigateFromNotification } from '../lib/navigationRef';
import * as notificationApi from '../services/notificationCenterService';

const TYPE_ICONS = { message: '💬', chat: '💬', order: '📦', payment: '💳', task: '✅', admin: '📣', system: '⚙️', urgent: '⚠️' };

export default function NotificationCenterScreen() {
  const { currentUser } = useApp();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try { setRows(await notificationApi.fetchNotifications(currentUser.id)); }
    catch (error) { Alert.alert('Алдаа', error.message || 'Мэдэгдэл ачаалж чадсангүй'); }
    finally { setLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    load();
    return notificationApi.subscribeNotifications(currentUser?.id, load);
  }, [load, currentUser?.id]);

  const open = async (row) => {
    try {
      if (!row.is_read) await notificationApi.markNotificationRead(row.id, currentUser.id);
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, is_read: true } : item));
      navigateFromNotification({ type: row.type, ...(row.data || {}) });
    } catch (error) { Alert.alert('Алдаа', error.message); }
  };

  const markAll = async () => {
    try { await notificationApi.markAllNotificationsRead(currentUser.id); setRows((items) => items.map((item) => ({ ...item, is_read: true }))); }
    catch (error) { Alert.alert('Алдаа', error.message); }
  };

  const unread = rows.filter((row) => !row.is_read).length;
  return (
    <View style={styles.container}>
      <ScreenHeader title="Мэдэгдэл" subtitle={`${unread} уншаагүй`} right={<HeaderButton icon="⚙" onPress={() => navigation.navigate('NotificationSettings')} />} />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}>
        {unread ? <TouchableOpacity onPress={markAll} style={styles.markAll}><Text style={[styles.markAllText, { color: colors.primary }]}>Бүгдийг уншсанд тооцох</Text></TouchableOpacity> : null}
        {!rows.length && !loading ? <EmptyState text="Одоогоор мэдэгдэл алга." /> : rows.map((row) => (
          <TouchableOpacity key={row.id} activeOpacity={0.82} onPress={() => open(row)}>
            <Card style={[styles.card, !row.is_read && { borderColor: colors.primary }] }>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}><Text style={styles.iconText}>{TYPE_ICONS[row.type] || '🔔'}</Text></View>
                <View style={styles.content}>
                  <View style={styles.titleRow}><Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{row.title}</Text>{!row.is_read ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}</View>
                  <Text style={[styles.message, { color: colors.textMuted }]}>{row.body}</Text>
                  <Text style={[styles.date, { color: colors.textFaint }]}>{new Date(row.created_at).toLocaleString('mn-MN')}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, body: { padding: spacing.lg, paddingBottom: 130 },
  markAll: { alignSelf: 'flex-end', paddingVertical: spacing.sm, marginBottom: spacing.sm }, markAllText: { fontWeight: '800', fontSize: 13 },
  card: { padding: spacing.md }, row: { flexDirection: 'row', gap: spacing.md }, icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, iconText: { fontSize: 21 },
  content: { flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontSize: 15, fontWeight: '900' }, dot: { width: 8, height: 8, borderRadius: 4 },
  message: { fontSize: 13, lineHeight: 19, marginTop: 4 }, date: { fontSize: 11, marginTop: 8 },
});
