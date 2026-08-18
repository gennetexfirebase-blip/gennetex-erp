/**
 * Дуут мессеж бичих — WeChat маягийн "Дарж хэлнэ үү".
 *
 * ХЭРЭГЛЭЭ: товчийг ДАРЖ БАРИНА → бичлэг эхэлнэ → тавихад илгээгдэнэ.
 * Хуруугаа ДЭЭШ гулсуулбал цуцлах бүсэд орж, тавихад устгана.
 *
 * ⚠️ Энэ нь ярианы бичвэр (STT) БИШ. STT нь яриаг текст болгодог бол
 *    энэ нь ДУУГ өөрийг нь дуут мессеж болгож илгээнэ. Хоёулаа зэрэг
 *    байна — хэрэглэгч аль хэрэгтэйг нь сонгоно.
 *
 * ЯАГААД `expo-av` ВЭ: төсөлд аль хэдийн суусан (дуудлагын хонхонд
 * ашиглаж байгаа). `expo-audio` руу шилжихэд native дахин build хийх
 * шаардлагатай тул одоохондоо үүнийг ашиглав.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

/** Энэ зайнаас дээш гулсуулбал цуцална. */
const CANCEL_THRESHOLD = 90;
/** Хэт богино бичлэгийг илгээхгүй — санамсаргүй даралт. */
const MIN_DURATION_MS = 700;

const fmt = (ms) => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function VoiceRecorderBar({ onSend, onSwitchToKeyboard, disabled }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [recording, setRecording] = useState(false);
  const [willCancel, setWillCancel] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recRef = useRef(null);
  const startedAt = useRef(0);
  const timerRef = useRef(null);
  const cancelRef = useRef(false);
  const busyRef = useRef(false);

  // Долгионы хөдөлгөөн — бичиж байгааг харуулна
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!recording) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recording, wave]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  /** Бичлэгийг зогсоож, файлын замыг буцаана (эсвэл null). */
  const finishRecording = async () => {
    stopTimer();
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return null;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      return rec.getURI();
    } catch (e) {
      return null;
    }
  };

  const start = async () => {
    if (disabled || busyRef.current || recRef.current) return;
    busyRef.current = true;
    cancelRef.current = false;
    setWillCancel(false);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        busyRef.current = false;
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recRef.current = rec;
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      try {
        Vibration.vibrate(Platform.OS === 'ios' ? 15 : 20);
      } catch {}
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt.current), 200);
    } catch (e) {
      recRef.current = null;
    } finally {
      busyRef.current = false;
    }
  };

  const stop = async () => {
    if (!recRef.current) {
      setRecording(false);
      return;
    }
    const duration = Date.now() - startedAt.current;
    const uri = await finishRecording();
    setRecording(false);
    setWillCancel(false);

    if (cancelRef.current || !uri) return;
    if (duration < MIN_DURATION_MS) return; // санамсаргүй товшилт
    onSend?.({ uri, durationMs: duration });
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start();
      },
      onPanResponderMove: (_e, g) => {
        // Дээш гулсуулбал цуцлах горим
        const cancel = g.dy < -CANCEL_THRESHOLD;
        cancelRef.current = cancel;
        setWillCancel(cancel);
      },
      onPanResponderRelease: () => {
        stop();
      },
      onPanResponderTerminate: () => {
        cancelRef.current = true;
        stop();
      },
    })
  ).current;

  const waveScale = wave.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <>
      {/* Бичиж байх үеийн бүрхүүл */}
      {recording ? (
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.bubble, willCancel && styles.bubbleCancel]}>
            <View style={styles.waveRow}>
              {[10, 18, 26, 20, 14, 22, 12].map((h, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    { height: h, transform: [{ scaleY: waveScale }] },
                    willCancel && { backgroundColor: '#fff' },
                  ]}
                />
              ))}
            </View>
          </View>

          <Text style={styles.hint}>
            {willCancel ? 'Тавихад цуцална' : 'Тавихад илгээнэ · дээш гулсуулж цуцлана'}
          </Text>
          <Text style={styles.timer}>{fmt(elapsed)}</Text>
        </View>
      ) : null}

      <View style={styles.bar}>
        <Pressable
          onPress={onSwitchToKeyboard}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Гар нээх"
        >
          <Ionicons name="keypad-outline" size={22} color={colors.textMuted} />
        </Pressable>

        <View
          {...responder.panHandlers}
          style={[styles.talkBtn, recording && styles.talkBtnActive]}
          accessibilityRole="button"
          accessibilityLabel="Дарж дуут мессеж бичих"
        >
          <Text style={[styles.talkText, recording && styles.talkTextActive]}>
            {recording ? (willCancel ? 'Тавихад цуцална' : 'Тавихад илгээнэ') : 'Дарж хэлнэ үү'}
          </Text>
        </View>
      </View>
    </>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkBtnActive: { backgroundColor: colors.borderHi },
  talkText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  talkTextActive: { color: colors.text },

  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 70,
    alignItems: 'center',
    zIndex: 30,
  },
  bubble: {
    minWidth: 130,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleCancel: { backgroundColor: '#ef4444' },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 28 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: '#ffffff' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
  timer: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
});
