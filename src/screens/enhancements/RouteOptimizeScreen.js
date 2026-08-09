import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useApp } from '../../context/AppContext';
import { optimizeCallRoute, buildGoogleMapsMultiStopUrl } from '../../lib/routeOptimize';
import * as serviceCallApi from '../../services/serviceCallService';

export default function RouteOptimizeScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, isAdmin } = useApp();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Зөвшөөрөл', 'Байршлын зөвшөөрөл хэрэгтэй');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };

      const calls = await serviceCallApi.fetchServiceCalls(
        isAdmin ? {} : { engineerId: currentUser?.id }
      );
      const open = (calls || []).filter(
        (c) => c.status !== 'Дууссан' && c.status !== 'Татгалзсан' && c.latitude != null
      );
      const opt = optimizeCallRoute(origin, open);
      setResult({ ...opt, origin });
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Тооцоолж чадсангүй');
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    if (!result?.order?.length) return;
    const url = buildGoogleMapsMultiStopUrl(result.origin, result.order);
    if (url) Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Замын оновчлол</Text>
        <Text style={styles.sub}>Олон дуудлагыг хамгийн богино дарааллаар</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity style={styles.btn} onPress={run} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.onPrimary || '#003'} /> : <Text style={styles.btnText}>Оновчлох</Text>}
        </TouchableOpacity>

        {result ? (
          <>
            <Text style={styles.total}>Нийт ≈ {result.totalKm} км · {result.order.length} цэг</Text>
            {result.order.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                style={styles.row}
                onPress={() => navigation.navigate('CallDetail', { callId: c.id, call: c })}
              >
                <Text style={styles.num}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.customer}</Text>
                  <Text style={styles.addr}>{c.address}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.maps} onPress={openMaps}>
              <Text style={styles.mapsText}>Google Maps-ээр нээх</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    sub: { color: colors.textMuted, marginTop: 2 },
    body: { padding: spacing.lg, paddingBottom: 60 },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    btnText: { color: colors.onPrimary || '#00363a', fontWeight: '800' },
    total: { color: colors.text, fontWeight: '700', marginBottom: spacing.md },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    num: { color: colors.primary, fontWeight: '900', fontSize: 18, width: 28 },
    name: { color: colors.text, fontWeight: '700' },
    addr: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    maps: {
      marginTop: spacing.lg,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    mapsText: { color: colors.primary, fontWeight: '800' },
  });
