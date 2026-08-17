/**
 * Төхөөрөмжийн түгжээ — 4 оронтой PIN.
 *
 * ХЭЛБЭР: гар утасны түгжээний стандарт харагдац —
 *   профайл зураг + нэр → "PIN код оруулна уу" → 4 цэг → 3×4 гар.
 * Системийн гар (keyboard) ашиглахгүй: өөрийн гараар бичихэд гар дэлгэц
 * рүү үсрэхгүй, 4 орон бөглөмөгц АВТОМАТААР шалгана.
 *
 * АЮУЛГҮЙ БАЙДАЛ:
 *   PIN-ийн hash нь ЗӨВХӨН энэ төхөөрөмжид (SecureStore) үлдэнэ. Сервер
 *   рүү зөвхөн "PIN тохируулсан эсэх" төлөв явна — хөгжүүлэгч хэн PIN-гүй
 *   яваа, хэн мартсаныг хараад "дахин тохируул" гэж шаардана, гэхдээ
 *   хэн нэгний PIN-ийг УНШИЖ чадахгүй.
 *   SQL: supabase/migrations/20260817120000_pin_oversight.sql
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AmbientBackground from '../components/AmbientBackground';
import { useStyles, useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import {
  clearLocalAccess,
  fetchPinPolicy,
  getBiometricCapability,
  getLocalAccessConfig,
  setupLocalAccess,
  verifyLocalPin,
  unlockWithBiometric,
} from '../services/localAccessService';

const PIN_LENGTH = 4;

/** Дэлгэцийн горим: түгжээ тайлах | шинэ PIN | PIN давтах */
const MODE = {
  UNLOCK: 'unlock',
  CREATE: 'create',
  CONFIRM: 'confirm',
};

export default function LocalAccessScreen({ userId, name, avatarUrl, onUnlocked, onSignOut }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(MODE.UNLOCK);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const shake = useRef(new Animated.Value(0)).current;
  const autoPrompted = useRef(false);

  // -------------------------------------------------------------------------
  // Ачаалах
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      const [saved, capability, policy] = await Promise.all([
        getLocalAccessConfig(userId),
        getBiometricCapability().catch(() => ({ available: false })),
        fetchPinPolicy(),
      ]);
      if (!active) return;

      let config = saved;
      // Хөгжүүлэгч "PIN-ээ дахин тохируул" гэж шаардсан бол хуучныг устгана.
      if (policy?.reset_required && saved) {
        await clearLocalAccess(userId);
        config = null;
        setNotice('Хөгжүүлэгч PIN-ээ шинэчлэхийг хүссэн байна. Шинэ PIN үүсгэнэ үү.');
      }

      setBiometricAvailable(!!capability.available);
      setBiometricEnabled(!!config?.biometricEnabled);
      setMode(config ? MODE.UNLOCK : MODE.CREATE);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // Биометр асаалттай бол дэлгэц нээгдэнгүүт нэг удаа асууна.
  useEffect(() => {
    if (loading || mode !== MODE.UNLOCK || !biometricEnabled || autoPrompted.current) return;
    autoPrompted.current = true;
    handleBiometric();
  }, [loading, mode, biometricEnabled]);

  const failShake = useCallback(() => {
    try {
      Vibration.vibrate(Platform.OS === 'ios' ? 100 : 60);
    } catch {}
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  // -------------------------------------------------------------------------
  // Үйлдлүүд
  // -------------------------------------------------------------------------
  const handleBiometric = async () => {
    setError('');
    const result = await unlockWithBiometric(userId);
    if (result?.success) onUnlocked();
  };

  /** 4 орон бөглөгдмөгц горимоосоо хамааран шалгана. */
  const submit = useCallback(
    async (value) => {
      if (busy) return;
      setBusy(true);
      try {
        if (mode === MODE.UNLOCK) {
          const ok = await verifyLocalPin(userId, value);
          if (!ok) {
            failShake();
            setError('PIN код буруу байна.');
            setPin('');
            return;
          }
          onUnlocked();
          return;
        }

        if (mode === MODE.CREATE) {
          setFirstPin(value);
          setPin('');
          setError('');
          setNotice('');
          setMode(MODE.CONFIRM);
          return;
        }

        // CONFIRM
        if (value !== firstPin) {
          failShake();
          setError('PIN кодууд таарахгүй байна. Дахин эхэлнэ үү.');
          setPin('');
          setFirstPin('');
          setMode(MODE.CREATE);
          return;
        }

        // Биометр боломжтой бол санал болгоно — сонгосон хариугаар хадгална.
        if (biometricAvailable) {
          Alert.alert(
            'Биометр холбох уу?',
            'Царай эсвэл хурууны хээгээр түргэн нээх боломжтой. PIN нь нөөц хувилбар болж үлдэнэ.',
            [
              { text: 'Зөвхөн PIN', style: 'cancel', onPress: () => finishSetup(value, false) },
              { text: 'Холбох', onPress: () => finishSetup(value, true) },
            ]
          );
          return;
        }
        await finishSetup(value, false);
      } finally {
        setBusy(false);
      }
    },
    [busy, mode, userId, firstPin, biometricAvailable, failShake, onUnlocked]
  );

  const finishSetup = async (value, withBiometric) => {
    try {
      await setupLocalAccess(userId, value, withBiometric);
      onUnlocked();
    } catch (e) {
      failShake();
      setError(e.message || 'PIN хадгалахад алдаа гарлаа.');
      setPin('');
      setFirstPin('');
      setMode(MODE.CREATE);
    }
  };

  const press = (digit) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setError('');
    setPin(next);
    if (next.length === PIN_LENGTH) {
      // Сүүлийн цэг дүүрсэн нь харагдахын тулд багахан хүлээнэ.
      setTimeout(() => submit(next), 120);
    }
  };

  const backspace = () => {
    if (busy) return;
    setError('');
    setPin((p) => p.slice(0, -1));
  };

  /**
   * PIN мартсан.
   *
   * PIN нь зөвхөн энэ утсанд, hash хэлбэрээр байдаг тул СЭРГЭЭХ АРГАГҮЙ.
   * Google бүртгэлээсээ гараад дахин нэвтэрвэл шинэ PIN үүсгэнэ.
   */
  const forgot = () => {
    Alert.alert(
      'PIN мартсан уу?',
      'PIN-ийг сэргээх боломжгүй — зөвхөн энэ утсанд шифрлэгдэн хадгалагддаг.\n\n' +
        'Бүртгэлээсээ гараад Google-ээр дахин нэвтэрч, шинэ PIN үүсгэнэ үү.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Гарч, дахин нэвтрэх',
          style: 'destructive',
          onPress: async () => {
            await clearLocalAccess(userId);
            onSignOut();
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------------------
  // Харагдац
  // -------------------------------------------------------------------------
  const title =
    mode === MODE.UNLOCK
      ? 'PIN код оруулна уу'
      : mode === MODE.CREATE
        ? 'Шинэ PIN үүсгэнэ үү'
        : 'PIN-ээ давтана уу';

  const subtitle =
    mode === MODE.UNLOCK
      ? null
      : mode === MODE.CREATE
        ? 'Дараагийн удаа нууц үг шаардахгүй — 4 оронтой кодоор нээнэ.'
        : 'Санахад амархан, бусдад таамаглахад хэцүү код сонгоорой.';

  const displayName = String(name || '').trim();
  const letter = (displayName || 'G').charAt(0).toUpperCase();

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] });

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  if (loading) {
    return (
      <SafeAreaView style={styles.bg}>
        <AmbientBackground />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.bg}>
      <AmbientBackground />

      <View style={styles.top}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />

        <View style={styles.user}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>{letter}</Text>
            )}
          </View>
          {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
        </View>

        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {/* 4 цэг */}
        <Animated.View style={[styles.dots, { transform: [{ translateX: shakeX }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  filled && styles.dotFilled,
                  !!error && styles.dotError,
                ]}
              />
            );
          })}
        </Animated.View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : notice ? (
          <Text style={styles.notice}>{notice}</Text>
        ) : (
          <Text style={styles.spacerText}> </Text>
        )}
      </View>

      {/* Гар */}
      <View style={styles.pad}>
        {KEYS.map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} styles={styles} />
        ))}

        {/* Зүүн доод нүд: биометр эсвэл "Код мартсан" */}
        {mode === MODE.UNLOCK && biometricEnabled && biometricAvailable ? (
          <Pressable
            style={styles.keyGhost}
            onPress={handleBiometric}
            accessibilityRole="button"
            accessibilityLabel="Биометрээр нээх"
          >
            <Ionicons name="finger-print-outline" size={28} color={colors.primary} />
          </Pressable>
        ) : mode === MODE.UNLOCK ? (
          <Pressable
            style={styles.keyGhost}
            onPress={forgot}
            accessibilityRole="button"
            accessibilityLabel="PIN мартсан"
          >
            <Text style={styles.keyGhostText}>Код{'\n'}мартсан</Text>
          </Pressable>
        ) : (
          <View style={styles.keyGhost} />
        )}

        <Key label="0" onPress={() => press('0')} styles={styles} />

        <Pressable
          style={styles.keyGhost}
          onPress={backspace}
          onLongPress={() => setPin('')}
          disabled={!pin.length}
          accessibilityRole="button"
          accessibilityLabel="Устгах"
        >
          <Ionicons
            name="backspace-outline"
            size={26}
            color={pin.length ? colors.text : colors.textFaint}
          />
        </Pressable>
      </View>

      <View style={styles.bottom}>
        {mode === MODE.CONFIRM ? (
          <Pressable
            onPress={() => {
              setMode(MODE.CREATE);
              setFirstPin('');
              setPin('');
              setError('');
            }}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Буцах</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onSignOut} accessibilityRole="button">
            <Text style={styles.link}>Гарах</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Тоон товч — дарахад бага зэрэг агшина. */
function Key({ label, onPress, styles }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

const KEY_SIZE = 76;
const KEY_GAP = 18;

const makeStyles = ({ colors }) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },
  // Дээд блок үлдсэн зайг эзэлж, төвдөө байрлана — ингэснээр цэг ба
  // гарын хооронд хэт том хоосон зай үлдэхгүй.
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.lg },
  logo: { width: 120, height: 34, marginBottom: spacing.lg },
  user: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: spacing.xl },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    lineHeight: 19,
  },

  dots: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderHi,
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotError: { borderColor: colors.danger, backgroundColor: colors.danger },

  error: { color: colors.danger, fontSize: 13, marginTop: spacing.lg, textAlign: 'center', paddingHorizontal: spacing.xl },
  notice: { color: colors.warning, fontSize: 13, marginTop: spacing.lg, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 19 },
  spacerText: { fontSize: 13, marginTop: spacing.lg },

  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    // ⚠️ ӨРГӨНИЙГ ТОГТМОЛ БАРИНА. Зөвхөн `flexWrap` дээр найдвал өргөн
    //    дэлгэц дээр 4 товч нэг мөрөнд багтаж, гар эвдэрнэ. Яг 3 багана
    //    багтах өргөн өгснөөр төхөөрөмж бүр дээр 3×4 хэвээр байна.
    width: KEY_SIZE * 3 + KEY_GAP * 2,
    alignSelf: 'center',
    rowGap: KEY_GAP,
    columnGap: KEY_GAP,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: colors.primary + '33', transform: [{ scale: 0.96 }] },
  keyText: { color: colors.primary, fontSize: 28, fontWeight: '500' },
  keyGhost: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGhostText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 16 },

  bottom: { alignItems: 'center', paddingBottom: spacing.xl, paddingTop: spacing.lg },
  link: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
    padding: spacing.sm,
  },
});
