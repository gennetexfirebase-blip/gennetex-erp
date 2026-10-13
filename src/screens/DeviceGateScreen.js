import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wordmark } from '../components/ds';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { APP_VERSION_LABEL } from '../version';
import * as deviceApi from '../services/deviceAuthService';

// Шинэ төхөөрөмжөөр нэвтрэхэд системийн админы зөвшөөрөл хүлээх дэлгэц
export default function DeviceGateScreen({ deviceInfo, onApproved }) {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, signOut } = useApp();
  const [info, setInfo] = useState(deviceInfo || {});
  const [status, setStatus] = useState(deviceInfo?.status || 'pending');
  const [retrying, setRetrying] = useState(false);
  const row = info.row || {};
  const deviceId = info.deviceId;

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

  const retry = async () => {
    if (!currentUser?.id || retrying) return;
    setRetrying(true);
    try {
      const next = await deviceApi.ensureDeviceApproval(currentUser);
      setInfo(next);
      setStatus(next.status);
      if (next.status === 'approved') onApproved?.();
    } catch {
      setInfo({ status: 'pending', error: true });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.logo}><Wordmark sub="Ажлын нэгдсэн орчин" /></View>
        <View style={styles.center}>
          <View style={[styles.iconWrap, { backgroundColor: rejected ? colors.badSoft : colors.brandSoft }]}>
            <Ionicons name={rejected ? 'close-circle-outline' : 'shield-checkmark-outline'} size={40} color={rejected ? colors.bad : colors.brand} />
          </View>
          <Text style={styles.title}>
            {rejected ? 'Төхөөрөмж татгалзагдсан' : 'Шинэ төхөөрөмж илрлээ'}
          </Text>
          <Text style={styles.sub}>
            {rejected
              ? 'Хөгжүүлэгч энэ төхөөрөмжөөр нэвтрэхийг татгалзсан байна. Админтай холбогдоно уу.'
              : info.error
                ? 'Төхөөрөмжийн хүсэлтийг шалгаж чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу.'
                : 'Аюулгүй байдлын үүднээс Хөгжүүлэгч таны шинэ төхөөрөмжийг зөвшөөрсний дараа апп нээгдэнэ.'}
          </Text>

          {!rejected && !info.error ? (
            <View style={styles.waitRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.waitText}>Зөвшөөрөл хүлээж байна...</Text>
            </View>
          ) : null}

          {info.error ? (
            <TouchableOpacity style={styles.retry} onPress={retry} disabled={retrying}>
              <Text style={styles.retryText}>{retrying ? 'Шалгаж байна…' : 'Дахин оролдох'}</Text>
            </TouchableOpacity>
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

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  safe: { flex: 1, paddingHorizontal: 20, paddingBottom: 14 },
  logo: { alignSelf: 'center', marginTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 470, width: '100%', alignSelf: 'center', paddingBottom: 10 },
  iconWrap: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: -0.4 },
  sub: { color: colors.muted, fontSize: 14.5, textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: spacing.md, maxWidth: 360 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, backgroundColor: colors.brandSoft, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  waitText: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  infoCard: { marginTop: 22, width: '100%', backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, ...shadow.md },
  infoRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  infoK: { color: colors.muted, fontSize: 13.5 },
  infoV: { color: colors.ink, fontSize: 13.5, fontWeight: '600', flex: 1, textAlign: 'right' },
  signOut: { alignSelf: 'center', paddingHorizontal: spacing.xl, height: 44, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.badSoft },
  retry: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, height: 48, justifyContent: 'center', borderRadius: 16, backgroundColor: colors.brand },
  retryText: { color: colors.brandInk, fontWeight: '600', fontSize: 15 },
  signOutText: { color: colors.bad, fontWeight: '600', fontSize: 14 },
  version: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 10 },
});