import React, { useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import NavIcon from '../components/NavIcon';
import { requestAllAppPermissions, markOnboardingComplete } from '../services/permissionsService';
import { enablePushForUser } from '../services/notificationService';
import { spacing, radius } from '../theme';
import { accentMap } from '../theme/accents';
import { useStyles, useTheme } from '../context/ThemeContext';

/**
 * Зөвшөөрлийн ил тод мэдэгдэл (prominent disclosure).
 *
 * Google Play-ийн ACCESS_BACKGROUND_LOCATION шаардлага нь энэ текст дээр
 * ТУСГАЙ шаардлага тавьдаг:
 *   • "location" гэсэн үг заавал орно
 *   • "апп хаалттай эсвэл ашиглагдаагүй үед" гэсэн утга ЗААВАЛ орно
 *   • тухайн зөвшөөрлийг ашиглах БҮХ боломжийг жагсаана
 *   • runtime prompt-оос ӨМНӨ, цэсэнд нуугдаагүй байдлаар харагдана
 *
 * Өмнөх текст ("Ажлын байршил real-time хянах") нь эдгээрийн аль нь ч
 * биш байсан тул declaration татгалзах эрсдэлтэй байв.
 */
const ITEMS = [
  {
    icon: 'chat',
    accent: 'brand',
    title: 'Мэдэгдэл',
    desc: 'Чат, ирц, дуудлагын мэдэгдэл хүлээн авах',
  },
  {
    icon: 'location',
    accent: 'green',
    title: 'Байршил',
    desc:
      'Энэ апп нь ажлын цагийн туршид таны байршлыг цуглуулна — АПП ХААЛТТАЙ ' +
      'эсвэл ашиглагдаагүй үед ч. Үүнийг ирц бүртгэх, ажлын байрт хүрсэн эсэхийг ' +
      'баталгаажуулах, ажлын явцыг зохицуулах, аюулгүй байдалд ашиглах бөгөөд ' +
      'таны байгууллагын админ харна.',
  },
  {
    icon: 'attendance',
    accent: 'indigo',
    title: 'Камер',
    desc: 'Царайгаар ирц бүртгэх, барааны баркод унших, видео дуудлага хийх',
  },
];

export default function OnboardingPermissionsScreen({ onComplete }) {
  const styles = useStyles(makeStyles);
  const { isDark } = useTheme();
  const accents = accentMap(isDark);
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const completeOnboarding = async () => {
    try {
      await markOnboardingComplete();
    } catch (e) {
      console.warn('[permissions] onboarding state:', e?.message || e);
    }
    onComplete();
  };

  const finish = async () => {
    setLoading(true);
    setError('');
    try {
      const results = await requestAllAppPermissions();
      if (currentUser?.id && results.notifications) {
        try {
          await enablePushForUser(currentUser.id);
        } catch (e) {}
      }
      if (results.skipped) {
        await completeOnboarding();
        return;
      }

      const labels = {
        notifications: 'Мэдэгдэл',
        location: 'Байршил',
        camera: 'Камер',
        media: 'Зургийн сан',
        speech: 'Микрофон / яриа таних',
      };
      const denied = Object.keys(labels).filter((key) => !results[key]);
      if (denied.length === 0) {
        // Expo Go дээр зарим зөвшөөрөл зарчмын хувьд боломжгүй. Хэрэглэгчийг
        // хаахгүй, гэхдээ юу дутуу байгааг мэдэгдэнэ — эс бөгөөс "мэдэгдэл
        // ирэхгүй байна" гэж дараа нь гайхах болно.
        const na = results.unavailable || [];
        if (na.length) {
          Alert.alert(
            'Expo Go-гийн хязгаар',
            `${na.map((k) => labels[k]).join(', ')} — Expo Go дээр ажиллахгүй.\n\n` +
              'Эдгээр нь аппын өөрийн native хэсгийг шаарддаг. Бүрэн ажиллуулахын ' +
              'тулд development build (npx expo run:android) эсвэл APK ашиглана уу.',
            [{ text: 'Ойлголоо', onPress: completeOnboarding }]
          );
          return;
        }
        await completeOnboarding();
        return;
      }

      const message = `Дутуу зөвшөөрөл: ${denied.map((key) => labels[key]).join(', ')}.`;
      setError(`${message} Утасны тохиргооноос зөвшөөрөөд дахин оролдоно уу.`);
      Alert.alert('Зөвшөөрөл дутуу байна', message, [
        { text: 'Дараа', style: 'cancel', onPress: completeOnboarding },
        {
          text: 'Тохиргоо нээх',
          onPress: () => Linking.openSettings().catch(() => {
            setError('Утасны Settings → Apps → Gennetex ERP → Permissions хэсгийг нээнэ үү.');
          }),
        },
      ]);
    } catch (e) {
      setError(e?.message || 'Зөвшөөрөл авах үед алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.bg}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain"/>
          <Text style={styles.title}>Зөвшөөрөл олгох</Text>
          <Text style={styles.sub}>
            Gennetex ERP зөв ажиллахын тулд доорх зөвшөөрлүүд шаардлагатай. Тохиргооноос хүссэн үедээ өөрчилж болно.
          </Text>

          <View style={styles.list}>
            {ITEMS.map((it) => (
              <View key={it.title} style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: accents[it.accent] + '14'}]}>
                  <NavIcon name={it.icon} size={22} color={accents[it.accent]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{it.title}</Text>
                  <Text style={styles.rowDesc}>{it.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={loading ? 'Тохируулж байна...' : 'Зөвшөөрөх'}
            size="lg"
            onPress={finish}
            disabled={loading}
            style={{ marginTop: spacing.lg }}
          />
          <Button
            title="Дараа"
            variant="ghost"
            onPress={completeOnboarding}
            disabled={loading}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bgAlt },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  logo: { width: 72, height: 72, alignSelf: 'center', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  sub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: spacing.lg },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  error: {
    color: colors.danger,
    backgroundColor: colors.danger + '18',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.lg,
    fontSize: 12,
    lineHeight: 18,
  },
});
