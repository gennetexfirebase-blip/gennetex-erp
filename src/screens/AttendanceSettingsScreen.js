import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as attApi from '../services/attendanceService';
import * as deptApi from '../services/departmentService';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

/** Тохиргооны нэг мөр — өнгөт icon, гарчиг/тайлбар, badge, сум. */
function SettingRow({ icon, iconColor, title, subtitle, badge, badgeTone, onPress, isLast }) {
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.iconBox, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
        {badge ? (
          <View
            style={[
              styles.badge,
              { borderColor: badgeTone === 'muted' ? colors.outlineVariant : colors.primary },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: badgeTone === 'muted' ? colors.textMuted : colors.primary },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
      {!isLast ? <View style={styles.divider} /> : null}
    </>
  );
}

/** Admin Ирц модулийн тохиргооны төв. */
export default function AttendanceSettingsScreen() {
  const navigation = useNavigation();
  const [locationCount, setLocationCount] = useState(null);
  const [wifiCount, setWifiCount] = useState(null);
  const [deptCount, setDeptCount] = useState(null);

  // Тохиргоо хийгээд буцаж ирэхэд тоонууд шинэчлэгдэнэ.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [locs, wifi, depts] = await Promise.all([
          attApi.fetchAttendanceLocations().catch(() => []),
          attApi.fetchAttendanceWifi().catch(() => []),
          deptApi.fetchDepartments().catch(() => []),
        ]);
        if (cancelled) return;
        setLocationCount(locs.length);
        setWifiCount(wifi.length);
        setDeptCount(depts.length);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityLabel="Буцах"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Ирцийн тохиргоо</Text>
        <Text style={styles.subtitle}>Байгууллагын ирцийн тохиргоо</Text>

        {/* ── Байгууллагын тохиргоо ─────────────────────────────── */}
        <Text style={styles.groupLabel}>БАЙГУУЛЛАГЫН ТОХИРГОО</Text>
        <View style={styles.card}>
          <SettingRow
            icon="location"
            iconColor="#2f9fe0"
            title="Байршил"
            subtitle="Ирцийн байршлын цэг, радиус"
            badge={locationCount == null ? null : `${locationCount} цэг`}
            badgeTone={locationCount ? 'primary' : 'muted'}
            onPress={() => navigation.navigate('AttendanceLocations')}
          />
          <SettingRow
            icon="wifi"
            iconColor="#2f9fe0"
            title="Wi-Fi"
            subtitle="Сүлжээний хязгаарлалт"
            badge={wifiCount == null ? null : wifiCount > 0 ? 'Идэвхтэй' : 'Хоосон'}
            badgeTone={wifiCount ? 'primary' : 'muted'}
            onPress={() => navigation.navigate('AttendanceWifi')}
          />
          <SettingRow
            icon="business"
            iconColor="#2f9fe0"
            title="Алба хэлтэс"
            subtitle="Хэлтэс, бүтэц тохируулах"
            badge={deptCount ? `${deptCount}` : null}
            badgeTone="muted"
            onPress={() => navigation.navigate('Departments')}
            isLast
          />
        </View>

        {/* ── Байгууллагын дотоод цэс ───────────────────────────── */}
        <Text style={styles.groupLabel}>БАЙГУУЛЛАГЫН ДОТООД ЦЭС</Text>
        <View style={styles.card}>
          <SettingRow
            icon="map"
            iconColor="#2f9fe0"
            title="Илгээсэн байршил"
            subtitle="Ажилтны илгээсэн координат"
            onPress={() => navigation.navigate('AttendanceLocationSubmissions')}
          />
          <SettingRow
            icon="notifications"
            iconColor="#2f9fe0"
            title="Мэдэгдэл илгээх"
            subtitle="Сануулга, мэдэгдлийн тохиргоо"
            badge="ON"
            onPress={() => navigation.navigate('AttendanceNotificationComposer')}
            isLast
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 4 },

  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, marginLeft: spacing.md },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginLeft: 76,
  },
});
