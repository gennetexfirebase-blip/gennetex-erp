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
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

/** Одоо тоглож буй дуу — модуль түвшинд, бүх бөмбөлөгт нийтлэг. */
let currentSound = null;
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
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  }, []);

  const stop = async () => {
    setPlaying(false);
    setProgress(0);
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
    if (currentSound === soundRef.current) {
      currentSound = null;
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
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      currentSound = sound;
      currentStop = stop;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.durationMillis) setTotal(status.durationMillis);
        setProgress(status.positionMillis || 0);
        if (status.didJustFinish) stop();
      });
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
