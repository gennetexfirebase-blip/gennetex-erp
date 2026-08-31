import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import { spacing, radius, type } from '../theme';
import { useStyles, useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const styles = useStyles(makeStyles);
  const { gradients } = useTheme();
  const { signInWithGoogle, signInWithApple, authError, isCloud } = useApp();

  /**
   * Apple товч харуулах эсэх.
   *
   * `isAvailableAsync` нь iOS 13-аас доош, эсвэл simulator дээр `false`
   * буцаана. Байхгүй үед товчийг харуулбал дарахад алдаа өгнө.
   */
  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleReady)
      .catch(() => setAppleReady(false));
  }, []);

  const handleApple = async () => {
    try {
      await signInWithApple();
    } catch (e) {
      // Алдааг `authError` дамжуулсан тул дэлгэц дээр өөрөө гарна.
    }
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  };

  const shown = error || authError;

  return (
    <View style={styles.root}>
      {/* Брэнд өнгөт дээд талбар — логоны цэнхэр */}
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.brandPanel}
      >
        <SafeAreaView edges={['top']} style={styles.brandInner}>
          <View style={styles.logoTile}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandName}>Gennetex ERP</Text>
          <Text style={styles.brandTag}>Generation of Network Experts</Text>
        </SafeAreaView>
      </LinearGradient>

      {/* Цагаан хуудас — дээд талбар дээр давхарлана */}
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sheet}>
            <Text style={styles.title}>Нэвтрэх</Text>
            <Text style={styles.subtitle}>
              Зөвшөөрөгдсөн Gmail хаягаараа нэвтэрнэ үү
            </Text>

            {shown ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{mapError(shown)}</Text>
              </View>
            ) : null}

            {/* ⚠️ Apple 4.8: гуравдагч талын нэвтрэлт санал болгосон апп нь
                тэнцэх хувийн нууцлалтай сонголтыг ЗААВАЛ өгөх ёстой.
                Apple нь энэ товчийг бусадтай ижил эрэмбэд, доогуур биш
                байрлуулахыг шаарддаг — тиймээс ДЭЭР нь тавив. */}
            {Platform.OS === 'ios' && appleReady ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleBtn}
                onPress={handleApple}
              />
            ) : null}

            <Button
              title={loading ? 'Google нээгдэж байна…' : 'Google-ээр нэвтрэх'}
              icon={loading ? undefined : 'G'}
              size="lg"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.cta}
            />

            <Text style={isCloud ? styles.hint : styles.note}>
              {isCloud
                ? 'Таны Gmail хаягийг админ эсвэл хөгжүүлэгч урьдчилан бүртгэсэн байх шаардлагатай.'
                : 'Supabase холбогдоогүй байна. Нэвтрэлт ажиллахын тулд .env тохируулна уу.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function mapError(error = '') {
  const raw = String(typeof error === 'string' ? error : error?.message || '').trim();
  const code = typeof error === 'string' ? '' : String(error?.code || '');
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch (e) {}

  const searchable = `${code} ${raw} ${decoded}`;
  if (
    /gmail_not_authorized|not authorized|unauthorized email|email[^\n]*(?:not registered|not allowed)|not[^\n]*allowlist|зөвшөөрөгдөөгүй|бүртгэлгүй|unexpected_failure|database error (?:saving|creating) new user|failed to create user/i.test(searchable)
    || /^%.*%$/s.test(raw)
  ) {
    return 'Энэ мэйл бүртгэлгүй байна.';
  }
  if (/unsupported provider|provider is not enabled/i.test(searchable))
    return 'Google нэвтрэлт Supabase дээр хараахан идэвхжээгүй байна.';
  if (!decoded || (!/\s/.test(decoded) && decoded.length > 64))
    return 'Нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу.';
  return decoded;
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  brandPanel: { paddingBottom: spacing.xxl * 2 },
  brandInner: { alignItems: 'center', paddingTop: spacing.xxl },
  logoTile: {
    width: 84,
    height: 84,
    borderRadius: radius.xl,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  logoImg: { width: '100%', height: '100%' },
  // Брэнд градиент дээрх текст — хоёр горимд ижил тул цагаан тогтмол.
  brandName: { ...type.h1, color: '#ffffff' },
  brandTag: {
    ...type.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    letterSpacing: 0.4,
  },

  sheetWrap: { flex: 1, marginTop: -spacing.xxl },
  sheetScroll: { flexGrow: 1, justifyContent: 'flex-start', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.lg,
  },
  title: { ...type.h2, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: 6 },

  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.danger + '1a',
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  errorText: { ...type.caption, fontSize: 13, color: colors.danger, lineHeight: 18 },

  appleBtn: { height: 52, marginBottom: spacing.md },
  cta: { marginTop: spacing.xl },

  hint: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 18,
  },
  note: {
    ...type.caption,
    color: colors.warning,
    marginTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 18,
  },
});
