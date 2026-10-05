import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { APP_VERSION_LABEL } from '../version';
import * as deviceApi from '../services/deviceAuthService';

// Шинэ төхөөрөмжөөр нэвтрэхэд системийн админы зөвшөөрөл хүлээх дэлгэц
export default function DeviceGateScreen({ deviceInfo, onApproved }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, signOut } = useApp();
  const [status, setStatus] = useState(deviceInfo?.status || 'pending');
  const row = deviceInfo?.row || {};
  const deviceId = deviceInfo?.deviceId;

  useEffect(() => {
    if (!currentUser?.id || !deviceId) return;
    let active = true;

    const check = async () => {
      const r = await deviceApi.fetchMyDeviceStatus(currentUser.id, deviceId);
      if (!active || !r) return;
      setStatus(r.status);
      if (r.status === 'approved') onApproved?.();
    };

    const unsub = deviceApi.subscribeMyDevice(currentUser.id, deviceId, (r) => {
      if (!active) return;
      if (r?.status) {
        setStatus(r.status);
        if (r.status === 'approved') onApproved?.();
      }
    });
    const timer = setInterval(check, 8000);
    check();

    return () => {
      active = false;
      clearInterval(timer);
      unsub?.();
    };
  }, [currentUser?.id, deviceId, onApproved]);

  const confirmSignOut = () => {
    Alert.alert('Гарах', 'Системээс гарах уу?', [
      { text: 'Болих', style: 'cancel' },
      { text: 'Гарах', style: 'destructive', onPress: signOut },
    ]);
  };

  const rejected = status === 'rejected';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.center}>
          <View style={[styles.iconWrap, rejected && styles.iconWrapDanger]}>
            <Text style={styles.icon}>{rejected ? '⛔' : '🔒'}</Text>
          </View>
          <Text style={styles.title}>
            {rejected ? 'Төхөөрөмж татгалзагдсан' : 'Шинэ төхөөрөмж илрлээ'}
          </Text>
          <Text style={styles.sub}>
            {rejected
              ? 'Хөгжүүлэгч энэ төхөөрөмжөөр нэвтрэхийг татгалзсан байна. Админтай холбогдоно уу.'
              : 'Аюулгүй байдлын үүднээс Хөгжүүлэгч таны шинэ төхөөрөмжийг зөвшөөрсний дараа апп нээгдэнэ.'}
          </Text>

          {!rejected ? (
            <View style={styles.waitRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.waitText}>Зөвшөөрөл хүлээж байна...</Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <Info k="Төхөөрөмж" v={`${row.device_brand || ''} ${row.device_model || deviceInfo?.row?.device_model || ''}`.trim() || '—'} styles={styles} />
            <Info k="Систем" v={`${row.os || ''} ${row.os_version || ''}`.trim() || '—'} styles={styles} />
            <Info k="IP хаяг" v={row.public_ip || '—'} styles={styles} />
            <Info k="Дотоод IP" v={row.local_ip || '—'} styles={styles} />
            <Info k="MAC" v={row.mac || '—'} styles={styles} />
          </View>
        </View>

        <TouchableOpacity style={styles.signOut} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Гарах</Text>
        </TouchableOpacity>
        <Text style={styles.version}>{APP_VERSION_LABEL}</Text>
      </SafeAreaView>
    </View>
  );
}

function Info({ k, v, styles }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoK}>{k}</Text>
      <Text style={styles.infoV} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconWrapDanger: { backgroundColor: colors.danger + '18' },
  icon: { fontSize: 40 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21, paddingHorizontal: spacing.md },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  waitText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  infoCard: {
    marginTop: spacing.xl,
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 8,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  infoK: { color: colors.textMuted, fontSize: 13 },
  infoV: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  signOut: {
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger + '55',
    backgroundColor: colors.danger + '15',
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  version: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
