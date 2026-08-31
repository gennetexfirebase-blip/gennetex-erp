import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import * as attApi from '../services/attendanceService';
import { dayKey, formatDuration, calculateDayWork } from '../lib/workHours';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

/** `2026-08-31T09:02:11Z` → `09:02` */
function hhmm(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Нүүр дэлгэцийн ирцийн карт.
 *
 * ⚠️ Өмнө нь "Өнөөдрийн ирц · Цаг бүртгэх" гэсэн ТӨЛӨВГҮЙ товч байв —
 *    ирсэн эсэхээ мэдэхийн тулд Ирц дэлгэц рүү орох шаардлагатай
 *    байлаа. Мөн `TodayDashboard` дотор «Ирц ✓/—» чип давхар байсан
 *    тул нэг зүйлийг хоёр газар, хоёр өөр нарийвчлалаар харуулж байв.
 *
 *    Одоо энэ карт төлөвөө өөрөө хэлнэ: хэдэн цагт ирсэн, хэр удаж
 *    байгаа, дараа нь юу хийхийг. Дараагийн үйлдэл нь товчны бичвэр
 *    дээр шууд гарна.
 */
export default function HomeAttendanceCard() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud, currentUser } = useApp();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!isCloud || !currentUser?.id) {
      setLoading(false);
      return;
    }
    try {
      const all = await attApi.fetchAttendance(80);
      setRows((all || []).filter((r) => String(r.staff_id) === String(currentUser.id)));
    } catch (e) {
      // Ачаалж чадаагүй бол карт "мэдэгдэхгүй" төлөвт үлдэнэ —
      // худал "ирээгүй" гэж хэлэхээс дээр.
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [isCloud, currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Ажиллаж буй хугацааг минут тутам шинэчилнэ.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const work = calculateDayWork({ attendance: rows || [], dateKey: dayKey() });
  const open = work.openCheckIn;
  const done = work.pairs.length > 0 && !open;

  // Явж буй ээлжийн хугацаа — `tick` нь дахин тооцоолол өдөөнө.
  const liveMs = open ? Date.now() - new Date(open.created_at).getTime() : 0;
  void tick;

  const state = loading
    ? 'loading'
    : rows === null
      ? 'unknown'
      : open
        ? 'working'
        : done
          ? 'done'
          : 'idle';

  // Идэвхтэй үед цэг зөөлөн анивчина — "яг одоо" гэдгийг илэрхийлнэ.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== 'working') return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const meta = {
    loading: { tone: colors.textMuted, label: 'Ачаалж байна…', sub: '' },
    unknown: { tone: colors.textMuted, label: 'Ирц уншигдсангүй', sub: 'Дэлгэцээ нээж шалгана уу' },
    idle: { tone: colors.warning, label: 'Ирцээ бүртгээгүй', sub: 'Ажлын байрандаа ирээд бүртгүүлнэ үү' },
    working: {
      tone: colors.success,
      label: `${formatDuration(liveMs)} ажиллаж байна`,
      sub: open ? `${hhmm(open.created_at)}-т ирсэн` : '',
    },
    done: {
      tone: colors.primary,
      label: `${formatDuration(work.grossMs)} ажилласан`,
      sub: work.pairs.length
        ? `${hhmm(work.pairs[0].checkIn.created_at)} – ${hhmm(work.pairs[work.pairs.length - 1].checkOut.created_at)}`
        : '',
    },
  }[state];

  const cta = { idle: 'Ирлээ', working: 'Явлаа', done: 'Дэлгэрэнгүй', loading: '', unknown: 'Нээх' }[state];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Attendance')}
      accessibilityRole="button"
      accessibilityLabel={`Ирц: ${meta.label}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.tone + '1F' }]}>
        {state === 'working' ? (
          <Animated.View
            style={[
              styles.liveDot,
              { backgroundColor: meta.tone, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) },
            ]}
          />
        ) : (
          <Ionicons
            name={state === 'done' ? 'checkmark-done' : state === 'idle' ? 'time-outline' : 'ellipse-outline'}
            size={21}
            color={meta.tone}
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.label} numberOfLines={1}>
          {meta.label}
        </Text>
        {meta.sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {meta.sub}
          </Text>
        ) : null}
      </View>

      {cta ? (
        <View style={[styles.cta, { backgroundColor: meta.tone }]}>
          <Text style={styles.ctaText}>{cta}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 13, height: 13, borderRadius: 7 },

  label: { color: colors.text, fontSize: 15.5, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },

  cta: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  ctaText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
});
