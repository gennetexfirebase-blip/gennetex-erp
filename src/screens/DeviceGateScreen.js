import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
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
      <StatusBar style="dark" backgroundColor="#f6faff" />
      <View style={styles.glow} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.center}>
          <LinearGradient colors={rejected ? ['#ff7b72', '#e33737'] : ['#37c2ff', '#087cff']} style={styles.iconWrap}>
            <Ionicons name={rejected ? 'close-circle-outline' : 'shield-checkmark-outline'} size={42} color="#fff" />
          </LinearGradient>
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

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6faff' },
  glow: { position: 'absolute', width: 340, height: 340, borderRadius: 170, top: -210, right: -150, backgroundColor: '#e0f3ff' },
  safe: { flex: 1, paddingHorizontal: 20, paddingBottom: 14 },
  logo: { width: 142, height: 86, alignSelf: 'center', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 470, width: '100%', alignSelf: 'center', paddingBottom: 10 },
  iconWrap: {
    width: 82,
    height: 82,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#087cff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 15,
    elevation: 7,
  },
  title: { color: '#10213d', fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: '#61738a', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 21, paddingHorizontal: spacing.md, maxWidth: 390 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, backgroundColor: '#e8f5ff', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  waitText: { color: '#0075ad', fontSize: 13, fontWeight: '800' },
  infoCard: {
    marginTop: 22,
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dce7f2',
    padding: 16,
    gap: 2,
    shadowColor: '#15324d',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  infoRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e9eff5' },
  infoK: { color: '#71829b', fontSize: 12.5 },
  infoV: { color: '#10213d', fontSize: 12.5, fontWeight: '800', flex: 1, textAlign: 'right' },
  signOut: {
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#ffaaa5',
    backgroundColor: '#fff4f3',
  },
  retry: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  signOutText: { color: '#d92d20', fontWeight: '800', fontSize: 14 },
  version: { color: '#8a9aaf', fontSize: 11, textAlign: 'center', marginTop: 10 },
});
