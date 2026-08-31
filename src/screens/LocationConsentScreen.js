import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { ScreenHeader } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

export const LOCATION_CONSENT_KEY = '@gennetex_location_consent_v1';

/**
 * Байршлын зөвшөөрлийн тайлбар (rationale) дэлгэц.
 *
 * ⚠️ ЯАГААД ЗААВАЛ ХЭРЭГТЭЙ ВЭ:
 *    Google Play нь background байршил ашигладаг аппаас "системийн
 *    зөвшөөрөл асуухаас ӨМНӨ юунд хэрэглэхийг тайлбарласан дэлгэц"
 *    шаарддаг (Location Permissions policy). Тайлбаргүйгээр шууд
 *    зөвшөөрөл асуувал илгээлт татгалзагдана.
 *
 *    Apple тал дээр ч 5.1.1 нь ижил утгатай: цуглуулж буй өгөгдөл
 *    бүрийн зорилгыг хэрэглэгчид ойлгомжтой хэлсэн байх ёстой.
 *
 * ⚠️ Мөн ТАТГАЛЗАХ зам заавал байна. "Одоохондоо болъё" гэж сонгосон
 *    хүн аппыг үргэлжлүүлэн ашиглаж чадах ёстой — байршил шаарддаг
 *    хэсэг л хаагдана.
 */
export default function LocationConsentScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser } = useApp();
  const [busy, setBusy] = useState(false);

  const finish = async (granted) => {
    await AsyncStorage.setItem(
      LOCATION_CONSENT_KEY,
      JSON.stringify({
        granted,
        at: new Date().toISOString(),
        userId: currentUser?.id || null,
      })
    );
    navigation.goBack();
  };

  const accept = async () => {
    setBusy(true);
    try {
      // Эхлээд foreground — Android нь background-ыг үүнгүйгээр өгдөггүй.
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status === 'granted') {
        // Android 11+ дээр энэ нь Тохиргоо руу шилжүүлдэг. Хэрэглэгч
        // "Always allow" сонгохгүй бол зөвхөн апп нээлттэй үед ажиллана.
        await Location.requestBackgroundPermissionsAsync().catch(() => {});
      }
      await finish(fg.status === 'granted');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Байршлын зөвшөөрөл" back={false} />

      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.iconWrap}>
          <Ionicons name="location" size={34} color={colors.primary} />
        </View>

        <Text style={styles.title}>Таны байршлыг юунд ашиглах вэ</Text>

        <View style={styles.list}>
          <Row
            styles={styles}
            colors={colors}
            icon="time-outline"
            title="Ирц бүртгэх"
            body="Ажлын байрны бүсэд байгаа эсэхийг шалгаж, ирлээ/явлаа бүртгэнэ."
          />
          <Row
            styles={styles}
            colors={colors}
            icon="map-outline"
            title="Ажлын байрны хяналт"
            body="Ажлын цагт та хаана байгааг админ харна. Дуудлага, аялал бүртгэхэд ашиглана."
          />
          <Row
            styles={styles}
            colors={colors}
            icon="notifications-outline"
            title="Бүсээс гарах анхааруулга"
            body="Ирц бүртгэх бүсээс гарахад таньд сануулна."
          />
        </View>

        {/* ⚠️ Background цуглуулалтыг ИЛ хэлнэ. Нуувал Google-ийн
            бодлого зөрчсөнд тооцогдоно. */}
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>Аппыг хаасан үед ч цуглуулна</Text>
          <Text style={styles.warnBody}>
            Ажлын цагт та аппыг хаасан байсан ч байршил илгээгдэнэ. Энэ нь
            ирцийн бүртгэл тасалдахгүй байхад шаардлагатай.
          </Text>
        </View>

        <Text style={styles.note}>
          Байршлыг зөвхөн танай байгууллагын админ харна. Гуравдагч талд
          худалдахгүй, зар сурталчилгаанд ашиглахгүй. Та зөвшөөрлөө утасныхаа
          Тохиргооноос хэдийд ч цуцалж болно.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
          onPress={accept}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>Зөвшөөрөх</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => finish(false)}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text style={styles.ghostText}>Одоохондоо болъё</Text>
        </TouchableOpacity>

        <Text style={styles.declineNote}>
          Татгалзвал аппыг ашиглаж болно — зөвхөн байршлаар ирц бүртгэх
          боломжгүй болно.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ styles, colors, icon, title, body }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={19} color={colors.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  pad: { padding: spacing.lg, paddingBottom: 48 },

  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  list: { gap: spacing.lg, marginBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowTitle: { color: colors.text, fontSize: 15.5, fontWeight: '700', marginBottom: 2 },
  rowBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },

  warn: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft || '#FBF1DE',
    marginBottom: spacing.lg,
  },
  warnTitle: { color: colors.warning || '#B87400', fontSize: 14.5, fontWeight: '800', marginBottom: 4 },
  warnBody: { color: colors.warning || '#B87400', fontSize: 13.5, lineHeight: 19 },

  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.xl },

  primaryBtn: {
    paddingVertical: 15,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },

  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
  ghostText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },

  declineNote: { color: colors.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
