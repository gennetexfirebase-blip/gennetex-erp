import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, PanResponder, StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const H = 62;
const KNOB = 52;
const PAD = 5;
// Дизайн: 82%-иас цааш чирвэл бүртгэнэ, бусад үед буцаж ухарна.
const THRESHOLD = 0.82;

/**
 * Чирж баталгаажуулах товч (design §4 Ирц).
 *
 *   Ирлээ: ногоон, зүүнээс баруун →, «Чирж ирц бүртгэх ›››»
 *   Явлаа: улаан, баруун захаас зүүн ←, «‹‹‹ Чирж явлаа»
 *
 * Санамсаргүй дарж ирц бүртгэгдэхээс сэргийлнэ. VoiceOver/TalkBack-д
 * энгийн «activate» үйлдлээр ажиллана.
 *
 * direction: 'right' (Ирлээ) | 'left' (Явлаа)
 * `color`, `textColor`, `trackColor` — хуучин дуудлагад зориулж хүлээн
 * авна; өнгө нь одоо токеноос (brand / bad).
 */
export default function SlideToConfirm({ label, hint, direction = 'right', disabled, loading, onConfirm }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const travel = Math.max(0, width - KNOB - PAD * 2);
  const sign = direction === 'right' ? 1 : -1;
  const busyRef = useRef(false);
  const out = direction === 'left';
  const main = out ? colors.bad : colors.brand;
  const soft = out ? colors.badSoft : colors.brandSoft;
  const knobFg = out ? '#FFFFFF' : colors.brandInk;
  const text = hint || (out ? 'Чирж явлаа' : 'Чирж ирц бүртгэх');

  useEffect(() => {
    if (!loading) {
      busyRef.current = false;
      Animated.timing(x, { toValue: 0, duration: 300, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }).start();
    }
  }, [loading, x]);

  // Сумнууд зөөлөн «түлхэнэ» — чирэх чиглэлийг заана.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [nudge]);

  const back = () =>
    Animated.timing(x, { toValue: 0, duration: 300, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }).start();

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !loading,
        onMoveShouldSetPanResponder: (_, g) => !disabled && !loading && Math.abs(g.dx) > 4,
        // Чирж байх үед эцэг ScrollView хуудсыг гүйлгэхгүй.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          x.setValue(Math.max(0, Math.min(travel, g.dx * sign)));
        },
        onPanResponderRelease: (_, g) => {
          const d = Math.max(0, Math.min(travel, g.dx * sign));
          if (travel > 0 && d >= travel * THRESHOLD && !busyRef.current) {
            busyRef.current = true;
            Animated.timing(x, { toValue: travel, duration: 120, useNativeDriver: false }).start(() => {
              Promise.resolve(onConfirm?.()).finally(() => {
                busyRef.current = false;
                back();
              });
            });
          } else {
            back();
          }
        },
        onPanResponderTerminate: back,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, loading, travel, sign, x, onConfirm]
  );

  const knobX = x.interpolate({ inputRange: [0, Math.max(1, travel)], outputRange: [0, sign * Math.max(1, travel)], extrapolate: 'clamp' });
  const labelOpacity = x.interpolate({ inputRange: [0, Math.max(1, travel * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  const fillWidth = x.interpolate({ inputRange: [0, Math.max(1, travel)], outputRange: [H, Math.max(H, width)], extrapolate: 'clamp' });
  const arrowShift = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, 5 * sign] });
  const inactive = disabled || loading;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: soft, opacity: disabled ? 0.55 : 1 }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label || text}. Чирж баталгаажуулна`}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate' && !inactive) {
          AccessibilityInfo.announceForAccessibility?.(label || text);
          onConfirm?.();
        }
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: main, width: fillWidth }, out ? { right: 0 } : { left: 0 }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.labelWrap, out ? { paddingRight: 40 } : { paddingLeft: 40 }, { opacity: labelOpacity }]}
      >
        {out ? (
          <Animated.Text style={[styles.arrows, { color: main, transform: [{ translateX: arrowShift }] }]}>‹‹‹</Animated.Text>
        ) : null}
        <Text style={[styles.label, { color: main }]} numberOfLines={1}>
          {text}
        </Text>
        {!out ? (
          <Animated.Text style={[styles.arrows, { color: main, transform: [{ translateX: arrowShift }] }]}>›››</Animated.Text>
        ) : null}
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.knob,
          { backgroundColor: main, shadowColor: main, transform: [{ translateX: knobX }] },
          out ? { right: PAD } : { left: PAD },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={knobFg} />
        ) : (
          <Ionicons name={out ? 'arrow-back' : 'arrow-forward'} size={24} color={knobFg} />
        )}
      </Animated.View>
    </View>
  );
}

/** Дууссан төлөв: ногоон «Өнөөдрийн ирц бүрэн». */
export function SlideDone({ text = 'Өнөөдрийн ирц бүрэн' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, styles.done, { backgroundColor: colors.okSoft }]}>
      <Ionicons name="checkmark-circle" size={20} color={colors.ok} />
      <Text style={[styles.label, { color: colors.ok }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: H,
    borderRadius: 20,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  done: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 20, opacity: 0.18 },
  labelWrap: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 16, fontWeight: '700' },
  arrows: { fontSize: 16, fontWeight: '700', letterSpacing: -2, opacity: 0.8 },
  knob: {
    position: 'absolute',
    top: PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
});
