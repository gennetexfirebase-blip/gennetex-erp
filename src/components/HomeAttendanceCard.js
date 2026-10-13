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

  // Дизайн: icon хавтан (warn = бүртгээгүй, ok = бүртгэсэн), гарчиг,
  // тайлбар, баруун талд brand товч (дууссан бол `field`).
  const meta = {
    loading: { fg: colors.muted, bg: colors.field, icon: 'ellipsis-horizontal', label: 'Ачаалж байна…', sub: '' },
    unknown: { fg: colors.muted, bg: colors.field, icon: 'help-circle-outline', label: 'Ирц уншигдсангүй', sub: 'Дэлгэцээ нээж шалгана уу' },
    idle: { fg: colors.warn, bg: colors.warnSoft, icon: 'alarm-outline', label: 'Ирцээ бүртгээгүй байна', sub: 'Ажлын байрандаа ирээд бүртгүүлнэ үү' },
    working: {
      fg: colors.ok,
      bg: colors.okSoft,
      icon: null,
      label: `${formatDuration(liveMs)} ажиллаж байна`,
      sub: open ? `${hhmm(open.created_at)}-д ирсэн` : '',
    },
    done: {
      fg: colors.ok,
      bg: colors.okSoft,
      icon: 'checkmark-done',
      label: `${formatDuration(work.grossMs)} ажилласан`,
      sub: work.pairs.length
        ? `${hhmm(work.pairs[0].checkIn.created_at)} – ${hhmm(work.pairs[work.pairs.length - 1].checkOut.created_at)}`
        : '',
    },
  }[state];

  const cta = { idle: 'Ирлээ', working: 'Явлаа', done: 'Дэлгэрэнгүй', loading: '', unknown: 'Нээх' }[state];
  const quiet = state === 'done' || state === 'unknown';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Attendance')}
      accessibilityRole="button"
      accessibilityLabel={`Ирц: ${meta.label}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        {state === 'working' ? (
          <Animated.View
            style={[
              styles.liveDot,
              { backgroundColor: meta.fg, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) },
            ]}
          />
        ) : (
          <Ionicons name={meta.icon} size={22} color={meta.fg} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
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
        <View style={[styles.cta, { backgroundColor: quiet ? colors.field : colors.brand }]}>
          <Text style={[styles.ctaText, { color: quiet ? colors.ink : colors.brandInk }]}>{cta}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 13, height: 13, borderRadius: 7 },

  label: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },

  cta: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '700' },
});