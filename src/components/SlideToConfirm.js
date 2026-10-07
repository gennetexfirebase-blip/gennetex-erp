import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const KNOB = 56;
const PAD = 4;
// Дуусгах босго — замын 85%-д хүрвэл баталгаажна.
const THRESHOLD = 0.85;

/**
 * Гулсуулж баталгаажуулах товч («Ирлээ» → баруун, «Явлаа» ← зүүн).
 *
 * Энгийн товчийг санамсаргүй дарж ирц бүртгэгдэх нь элбэг байсан тул
 * зориуд гулсуулах үйлдэл шаардана. VoiceOver/TalkBack ашиглагч гулсуулж
 * чадахгүй тул accessibility горимд энгийн «activate» үйлдлээр ажиллана.
 *
 * direction: 'right' (бариул зүүнээс эхэлнэ) | 'left' (баруунаас эхэлнэ)
 * trackColor: өнгөт (gradient) дэвсгэр дээр замын өнгийг тусад нь өгнө
 */
export default function SlideToConfirm({ label, direction = 'right', color, textColor = '#fff', trackColor, disabled, loading, onConfirm }) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const travel = Math.max(0, width - KNOB - PAD * 2);
  const sign = direction === 'right' ? 1 : -1;
  const busyRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      busyRef.current = false;
      Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    }
  }, [loading, x]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !loading,
        onMoveShouldSetPanResponder: (_, g) => !disabled && !loading && Math.abs(g.dx) > 4,
        // Гулсуулж байх үед эцэг ScrollView хуудсыг гүйлгэхгүй.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const d = Math.max(0, Math.min(travel, g.dx * sign));
          x.setValue(d);
        },
        onPanResponderRelease: (_, g) => {
          const d = Math.max(0, Math.min(travel, g.dx * sign));
          if (travel > 0 && d >= travel * THRESHOLD && !busyRef.current) {
            busyRef.current = true;
            Animated.timing(x, { toValue: travel, duration: 120, useNativeDriver: true }).start(() => {
              Promise.resolve(onConfirm?.()).finally(() => {
                busyRef.current = false;
                Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
              });
            });
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [disabled, loading, travel, sign, x, onConfirm]
  );

  const knobX = x.interpolate({ inputRange: [0, Math.max(1, travel)], outputRange: [0, sign * Math.max(1, travel)], extrapolate: 'clamp' });
  const labelOpacity = x.interpolate({ inputRange: [0, Math.max(1, travel * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  const fillWidth = x.interpolate({ inputRange: [0, Math.max(1, travel)], outputRange: [KNOB + PAD * 2, Math.max(KNOB + PAD * 2, width)], extrapolate: 'clamp' });
  const inactive = disabled || loading;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, trackColor
        ? { backgroundColor: trackColor, borderColor: 'rgba(255,255,255,0.22)' }
        : { backgroundColor: color + (inactive ? '33' : '26'), borderColor: color + '55' }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}. Гулсуулж баталгаажуулна`}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate' && !inactive) {
          AccessibilityInfo.announceForAccessibility?.(label);
          onConfirm?.();
        }
      }}
    >
      {/* Гулсуулсан хэсэг өнгөөр дүүрнэ */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          { backgroundColor: color, width: fillWidth, opacity: inactive ? 0.45 : 1 },
          direction === 'right' ? { left: 0 } : { right: 0 },
        ]}
      />
      <Animated.View pointerEvents="none" style={[styles.labelWrap, { opacity: labelOpacity }]}>
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {direction === 'right' ? `${label}  ›››` : `‹‹‹  ${label}`}
        </Text>
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.knob,
          { backgroundColor: color, transform: [{ translateX: knobX }], opacity: inactive && !loading ? 0.5 : 1 },
          direction === 'right' ? { left: PAD } : { right: PAD },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Ionicons name={direction === 'right' ? 'arrow-forward' : 'arrow-back'} size={24} color={textColor} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: KNOB + PAD * 2,
    borderRadius: (KNOB + PAD * 2) / 2,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: (KNOB + PAD * 2) / 2 },
  labelWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: KNOB + 12 },
  label: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
