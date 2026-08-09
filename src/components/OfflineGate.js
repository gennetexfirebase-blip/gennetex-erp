import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useTheme, useStyles } from '../context/ThemeContext';
import { isFlagOn } from '../lib/featureFlags';

// Анхдагч: апп зөвхөн ОНЛАЙН (hard block).
// offlineFirst feature flag ON үед hard overlay-г алгасаж, OfflineSyncBanner + queue ашиглана.
// Хуучин UI/логикийг устгаагүй — зөвхөн нөхцөл нэмсэн.
export default function OfflineGate({ children }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const softOffline = isFlagOn('offlineFirst');

  const evaluate = (state) => {
    const ok = state?.isConnected && state?.isInternetReachable !== false;
    setOnline(!!ok);
  };

  useEffect(() => {
    NetInfo.fetch().then(evaluate).catch(() => setOnline(true));
    const unsub = NetInfo.addEventListener(evaluate);
    return unsub;
  }, []);

  useEffect(() => {
    if (!checking) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [checking, spin]);

  const retry = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const state = await NetInfo.refresh();
      evaluate(state);
    } catch (e) {
      // тодорхойгүй бол шалгах шаардлагагүй
    } finally {
      setTimeout(() => setChecking(false), 400);
    }
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.flex}>
      {children}
      {!online && !softOffline ? (
        <View style={styles.overlay}>
          <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
            <View style={styles.iconWrap}>
              <Ionicons name="cloud-offline-outline" size={64} color={colors.primary} />
            </View>
            <Text style={styles.title}>Интернэт холболт алга</Text>
            <Text style={styles.sub}>
              Энэ апп зөвхөн онлайн ажиллана.{'\n'}Интернэт холболтоо шалгаад дахин оролдоно уу.
            </Text>

            <TouchableOpacity style={styles.btn} onPress={retry} activeOpacity={0.85} disabled={checking}>
              {checking ? (
                <>
                  <Animated.View style={{ transform: [{ rotate }] }}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                  </Animated.View>
                  <Text style={styles.btnText}>Шалгаж байна...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.btnText}>Дахин оролдох</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.tips}>
              <Tip icon="wifi" text="Wi-Fi эсвэл дата асаалттай эсэхээ шалгана уу" styles={styles} color={colors.textMuted} />
              <Tip icon="airplane" text="Нислэгийн горим унтраасан эсэхээ шалгана уу" styles={styles} color={colors.textMuted} />
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </View>
  );
}

function Tip({ icon, text, styles, color }) {
  return (
    <View style={styles.tipRow}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    flex: { flex: 1 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
      zIndex: 9999,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    iconWrap: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
    },
    title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
    sub: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 999,
      marginTop: 32,
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    tips: { marginTop: 36, gap: 12 },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tipText: { color: colors.textMuted, fontSize: 13 },
  });
