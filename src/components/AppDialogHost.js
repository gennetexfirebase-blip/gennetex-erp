import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { brand } from '../theme/tokens';
import { OriginalModal, registerDialogHost } from '../lib/appDialog';

/**
 * `Alert.alert`-ийн апп-ын загвартай хувилбар (src/lib/appDialog.js).
 * Дараалалтай — нэг цонх нээлттэй үед ирсэн дараагийнх нь хүлээнэ.
 */
export default function AppDialogHost() {
  const { colors, isDark } = useTheme();
  const [queue, setQueue] = useState([]);
  const [visible, setVisible] = useState(false);
  const pendingAction = useRef(null);
  const scale = useRef(new Animated.Value(0.92)).current;
  const current = queue[0] || null;

  useEffect(
    () =>
      registerDialogHost((dialog) => {
        setQueue((q) => [...q, dialog]);
      }),
    []
  );

  useEffect(() => {
    if (current && !visible && !closing.current) {
      scale.setValue(0.92);
      setVisible(true);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
    }
  }, [current, visible, scale]);

  // Цонх бүрэн хаагдсаны ДАРАА үйлдлийг ажиллуулна — эс бөгөөс iOS дээр
  // камер/зураг сонгогч зэрэг native цонх гарч чадахгүй.
  // `closing` нь зөвхөн нэг удаа дуусгахыг баталгаажуулна (onDismiss +
  // нөөц хугацаа хоёулаа дуудагдаж болно).
  const closing = useRef(false);
  const finish = useCallback(() => {
    if (!closing.current) return;
    closing.current = false;
    const run = pendingAction.current;
    pendingAction.current = null;
    setQueue((q) => q.slice(1));
    if (run) setTimeout(run, 0);
  }, []);

  const close = useCallback(
    (action) => {
      if (closing.current) return;
      closing.current = true;
      pendingAction.current = action || null;
      setVisible(false);
      // iOS-д Modal-ийн onDismiss дуудагдана (хаагдаж дууссаны дараа);
      // бусад платформд эсвэл onDismiss ирээгүй тохиолдолд нөөц хугацаа.
      setTimeout(finish, Platform.OS === 'ios' ? 600 : 180);
    },
    [finish]
  );

  if (!current) return null;

  const { title, message, options } = current;
  const buttons = current.buttons?.length ? current.buttons : [{ text: 'За' }];
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const tone = toneFor(title, buttons, colors);
  const stacked = buttons.length > 2 || buttons.some((b) => String(b.text || '').length > 14);
  // Хоёр товчтой үед цуцлах товчийг зүүн/дээр, үндсэн үйлдлийг баруун/доор.
  const ordered = stacked
    ? [...buttons.filter((b) => b.style !== 'cancel'), ...buttons.filter((b) => b.style === 'cancel')]
    : [...buttons.filter((b) => b.style === 'cancel'), ...buttons.filter((b) => b.style !== 'cancel')];
  const primaryIndex = ordered.findIndex((b) => b.style !== 'cancel');

  const onBackdrop = () => {
    if (options?.cancelable) close(() => options?.onDismiss?.());
  };
  const onRequestClose = () => {
    if (cancelBtn) close(cancelBtn.onPress);
    else if (options?.cancelable) close(() => options?.onDismiss?.());
  };

  return (
    <OriginalModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
      onDismiss={finish}
    >
      <Pressable style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.45)' }]} onPress={onBackdrop}>
        <Animated.View style={{ width: '100%', alignItems: 'center', transform: [{ scale }] }}>
          <Pressable
            style={[styles.card, { backgroundColor: isDark ? colors.surfaceContainerHigh : '#fff' }]}
            accessibilityViewIsModal
            accessibilityRole="alert"
          >
            <View style={[styles.iconWrap, { backgroundColor: tone.soft }]}>
              <Ionicons name={tone.icon} size={30} color={tone.color} />
            </View>
            {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
            {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}

            <View style={[styles.actions, stacked && styles.actionsStacked]}>
              {ordered.map((b, i) => {
                const isCancel = b.style === 'cancel';
                const isDanger = b.style === 'destructive';
                const isPrimary = i === primaryIndex && !isDanger;
                const label = b.text || 'За';
                const onPress = () => close(b.onPress);
                if (isPrimary) {
                  return (
                    <Pressable key={`${label}-${i}`} onPress={onPress} style={({ pressed }) => [stacked ? null : styles.flex, pressed && styles.pressed]} accessibilityRole="button">
                      <LinearGradient colors={[brand[500], brand[700]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                        <Text style={[styles.btnText, { color: '#fff' }]} numberOfLines={2}>{label}</Text>
                      </LinearGradient>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={`${label}-${i}`}
                    onPress={onPress}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.btn,
                      stacked ? null : styles.flex,
                      isDanger
                        ? { backgroundColor: colors.danger }
                        : { backgroundColor: isDark ? colors.surfaceContainerHighest : '#f1f5f9' },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.btnText, { color: isDanger ? '#fff' : isCancel ? colors.textMuted : colors.text }]} numberOfLines={2}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </OriginalModal>
  );
}

/** Гарчиг/товчноос цонхны өнгө, дүрсийг таана. */
function toneFor(title, buttons, colors) {
  const t = String(title || '').toLowerCase();
  if (/алдаа|амжилтгүй|болсонгүй|чадсангүй|олдсонгүй|error|failed/.test(t))
    return { icon: 'close-circle', color: colors.danger, soft: colors.danger + '1f' };
  if (buttons.some((b) => b.style === 'destructive') || /устгах|гарах|цуцлах/.test(t))
    return { icon: 'trash-outline', color: colors.danger, soft: colors.danger + '1f' };
  if (/анхаар|зөвшөөрөл|шаардлагатай|бүртгүүлнэ|warning/.test(t))
    return { icon: 'warning', color: colors.warning, soft: colors.warning + '24' };
  if (/амжилттай|бүртгэгдлээ|нэмэгдлээ|сонгогдлоо|хадгаллаа|илгээгдлээ|дууслаа|боллоо/.test(t))
    return { icon: 'checkmark-circle', color: colors.success, soft: colors.success + '1f' };
  if (/явлаа|ирлээ|зураг/.test(t)) return { icon: 'camera-outline', color: colors.primary, soft: colors.primarySoft };
  return { icon: 'information-circle', color: colors.primary, soft: colors.primarySoft };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 16,
  },
  iconWrap: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 22 },
  actionsStacked: { flexDirection: 'column' },
  flex: { flex: 1 },
  btn: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
