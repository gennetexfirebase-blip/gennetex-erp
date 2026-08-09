import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Card, ScreenHeader } from '../components/ui';
import { spacing } from '../theme';
import * as notificationApi from '../services/notificationCenterService';

const OPTIONS = [
  ['push_enabled', 'Push Notifications', 'Бүх remote push мэдэгдэл'],
  ['messages_enabled', 'Messages', 'Чат болон шинэ мессеж'],
  ['orders_enabled', 'Orders', 'Шинэ захиалга, төлөвийн өөрчлөлт'],
  ['payments_enabled', 'Payments', 'Төлбөр амжилттай/амжилтгүй'],
  ['tasks_enabled', 'Tasks', 'Шинэ task болон deadline'],
  ['system_enabled', 'System Notifications', 'Админ болон системийн мэдэгдэл'],
];

export default function NotificationSettingsScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [settings, setSettings] = useState(notificationApi.DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => { notificationApi.fetchNotificationSettings(currentUser?.id).then(setSettings).catch(() => {}); }, [currentUser?.id]);
  const toggle = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try { await notificationApi.saveNotificationSettings(currentUser.id, { [key]: value }); }
    catch (error) { setSettings(settings); Alert.alert('Алдаа', error.message); }
  };
  return (
    <View style={styles.container}>
      <ScreenHeader title="Notification Settings" subtitle="Мэдэгдлийн төрлөө удирдах" />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          {OPTIONS.map(([key, title, subtitle], index) => (
            <View key={key} style={[styles.option, index < OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{title}</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text></View>
              <Switch value={!!settings[key]} onValueChange={(value) => toggle(key, value)} disabled={key !== 'push_enabled' && !settings.push_enabled} trackColor={{ false: colors.surfaceAlt, true: colors.primary + '88' }} thumbColor={settings[key] ? colors.primary : colors.textFaint} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, body: { padding: spacing.lg }, option: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }, copy: { flex: 1 }, title: { fontSize: 15, fontWeight: '800' }, subtitle: { fontSize: 12, marginTop: 3, lineHeight: 17 },
});
