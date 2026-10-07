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
 * АУДИО: `expo-audio` — SDK 57-д `expo-av` бүрмөсөн хасагдсан тул
 * бичлэгийг `useAudioRecorder` дээр хийнэ.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import {
  RecordingPresets,
  useAudioRecorder,
} from 'expo-audio';
import { createVoiceRecordingSession } from '../services/voiceRecordingSession';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

/** Энэ зайнаас дээш гулсуулбал цуцална. */
const CANCEL_THRESHOLD = 90;
/** Хэт богино бичлэгийг илгээхгүй — санамсаргүй даралт. */
const VOICE_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1,
  android: { ...RecordingPresets.HIGH_QUALITY.android, audioSource: 'mic' } };

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

  // expo-audio-д бичигч нь тогтмол объект — идэвхтэй эсэхийг өөрсдөө хөтөлнө.
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const timerRef = useRef(null);
  const cancelRef = useRef(false);
  const latest = useRef({ onSend, disabled });
  latest.current = { onSend, disabled };

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

  const session = useMemo(() => createVoiceRecordingSession({
    recorder,
    onSend: clip => latest.current.onSend?.(clip),
    onError: error => Alert.alert('Дуут мессеж', error.message || 'Дуу бичиж чадсангүй. Дахин оролдоно уу.'),
    onRecording: active => {
      stopTimer();
      setRecording(active);
      setWillCancel(false);
      if (active) {
        setElapsed(0);
        Vibration.vibrate(Platform.OS === 'ios' ? 15 : 20);
        timerRef.current = setInterval(() => setElapsed(recorder.getStatus().durationMillis), 200);
      }
    },
  }), [recorder]);
  useEffect(() => () => { stopTimer(); session.dispose(); }, [session]);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        if (latest.current.disabled) return;
        cancelRef.current = false;
        setWillCancel(false);
        sessionRef.current.start();
      },
      onPanResponderMove: (_e, g) => {
        // Дээш гулсуулбал цуцлах горим
        const cancel = g.dy < -CANCEL_THRESHOLD;
        cancelRef.current = cancel;
        setWillCancel(cancel);
      },
      onPanResponderRelease: () => {
        sessionRef.current.release(cancelRef.current);
      },
      onPanResponderTerminate: () => {
        cancelRef.current = true;
        sessionRef.current.release(true);
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
