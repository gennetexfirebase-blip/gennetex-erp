/**
 * Дуут мессежийн бөмбөлөг — тоглуулах, үргэлжлэх хугацаа, долгион.
 *
 * WeChat шиг: тоглуулах товч + долгионы зураас + хугацаа. Тоглож байх
 * үед долгион нь ахиц дагаж өнгө солино.
 *
 * ⚠️ НЭГ Л ДУУ: шинэ бичлэг тоглуулахад өмнөх нь өөрөө зогсоно —
 *    эс тэгвээс хэд хэдэн дуу зэрэг сонсогдож эвгүй болно.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

/** Одоо тоглож буй дуу — модуль түвшинд, бүх бөмбөлөгт нийтлэг. */
let currentPlayer = null;
let currentStop = null;

const BARS = [8, 14, 20, 12, 18, 24, 10, 16, 22, 12, 18, 9, 15, 21, 11];

function fmt(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}"`;
}

export default function VoiceMessageBubble({ uri, durationMs, mine }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(durationMs || 0);
  const soundRef = useRef(null);

  useEffect(() => () => {
    // Дэлгэцээс гарахад дуугаа заавал суллана.
    if (soundRef.current) {
      try {
        soundRef.current.remove();
      } catch (e) {}
      soundRef.current = null;
    }
  }, []);

  const stop = async () => {
    setPlaying(false);
    setProgress(0);
    const player = soundRef.current;
    soundRef.current = null;
    if (player) {
      try {
        player.pause();
        player.remove();
      } catch (e) {}
    }
    if (currentPlayer === player) {
      currentPlayer = null;
      currentStop = null;
    }
  };

  const toggle = async () => {
    if (playing) {
      await stop();
      return;
    }
    // Өмнө тоглож байсныг зогсооно
    if (currentStop) {
      try {
        await currentStop();
      } catch (e) {}
    }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri });
      soundRef.current = player;
      currentPlayer = player;
      currentStop = stop;
      setPlaying(true);
      // expo-audio нь секундээр хэмждэг — UI нь миллисекунд хүлээдэг.
      player.addListener('playbackStatusUpdate', (status) => {
        if (!status?.isLoaded) return;
        if (status.duration) setTotal(Math.round(status.duration * 1000));
        setProgress(Math.round((status.currentTime || 0) * 1000));
        if (status.didJustFinish) stop();
      });
      player.play();
    } catch (e) {
      setPlaying(false);
    }
  };

  const ratio = total ? Math.min(1, progress / total) : 0;
  const activeBars = Math.round(ratio * BARS.length);

  return (
    <Pressable
      style={styles.wrap}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`Дуут мессеж, ${fmt(total)}. Тоглуулахын тулд дарна.`}
    >
      <Ionicons
        name={playing ? 'pause' : 'play'}
        size={18}
        color={mine ? colors.onPrimaryContainer : colors.primary}
      />
      <View style={styles.waveRow}>
        {BARS.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: h },
              {
                backgroundColor:
                  i < activeBars
                    ? mine
                      ? colors.onPrimaryContainer
                      : colors.primary
                    : mine
                      ? colors.onPrimaryContainer + '55'
                      : colors.textFaint,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.time, mine && { color: colors.onPrimaryContainer }]}>
        {fmt(playing ? total - progress : total)}
      </Text>
    </Pressable>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    minWidth: 150,
  },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 2.5, flex: 1, height: 26 },
  bar: { width: 2.5, borderRadius: 2 },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
});
