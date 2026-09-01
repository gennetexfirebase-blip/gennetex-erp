import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import { spacing, radius, type } from '../theme';
import { useStyles, useTheme } from '../context/ThemeContext';

/**
 * Apple нэвтрэлт — ЗАЛХУУ ачаалалт.
 *
 * ⚠️ Expo Go нь тогтмол багц native модультай ирдэг. Дээд түвшинд
 *    import хийвэл тэнд байхгүй үед аппыг НЭЭХ ҮЕД унана. Төслийн
 *    бусад native модуль (WebRTC, Firebase, ONNX) бүгд ижил
 *    хэв маягаар ачаалагддаг.
 */
let AppleAuthentication;
try {
  AppleAuthentication = require('expo-apple-authentication');
} catch (e) {
  AppleAuthentication = null;
}

export default function LoginScreen() {
  const styles = useStyles(makeStyles);
  const { gradients, colors } = useTheme();
  const { signIn, signInWithGoogle, signInWithApple, authError, isCloud } = useApp();

  /**
   * Apple товч харуулах эсэх.
   *
   * `isAvailableAsync` нь iOS 13-аас доош, эсвэл simulator дээр `false`
   * буцаана. Байхгүй үед товчийг харуулбал дарахад алдаа өгнө.
   */
  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !AppleAuthentication) return;
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

  // ── Нэр / нууц үгээр нэвтрэх ────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordLogin = async () => {
    if (!identifier.trim() || !password) return;
    setError(null);
    setPwLoading(true);
    try {
      await signIn(identifier, password);
    } catch (e) {
      setError(mapError(e));
    } finally {
      setPwLoading(false);
    }
  };

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
          {/* Логог тойрсон хоёр цагираг — гүн өгч, төвд анхаарал татна */}
          <View style={styles.haloOuter}>
            <View style={styles.haloInner}>
              <View style={styles.logoTile}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logoImg}
                  resizeMode="contain"
                />
              </View>
            </View>
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
            <View style={styles.grip} />

            <Text style={styles.title}>Тавтай морил</Text>
            <Text style={styles.subtitle}>
              Нэвтрэх нэр эсвэл ажлын хаягаараа нэвтэрнэ үү
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
            {Platform.OS === 'ios' && appleReady && AppleAuthentication ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleBtn}
                onPress={handleApple}
              />
            ) : null}

            {Platform.OS === 'ios' && appleReady && AppleAuthentication ? (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>эсвэл</Text>
                <View style={styles.dividerLine} />
              </View>
            ) : null}

            {/* ── Нэвтрэх нэр / и-мэйл ────────────────────────────────
                ⚠️ Өмнө нь ЗӨВХӨН Google/Apple байсан. Дэлгүүрийн
                   шинжээч OAuth-ээр нэвтэрч чадахгүй (танай Google
                   Workspace-д хаяггүй) тул нэвтрэх боломжгүй байв —
                   энэ нь App Store-ын хамгийн түгээмэл татгалзлын
                   нэг. Нэр/нууц үгийн зам ЗААВАЛ хэрэгтэй. */}
            <View style={styles.field}>
              <Text style={styles.label}>Нэвтрэх нэр эсвэл и-мэйл</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Gennetex эсвэл ner@gennetex.mn"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Нууц үг</Text>
              <View style={styles.pwWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.pwInput]}
                  returnKeyType="go"
                  onSubmitEditing={handlePasswordLogin}
                />
                <Text
                  style={styles.pwToggle}
                  onPress={() => setShowPw((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPw ? 'Нууц үг нуух' : 'Нууц үг харуулах'}
                >
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textMuted} />
                </Text>
              </View>
            </View>

            <Button
              title={pwLoading ? 'Нэвтэрч байна…' : 'Нэвтрэх'}
              size="lg"
              onPress={handlePasswordLogin}
              loading={pwLoading}
              disabled={pwLoading || !identifier.trim() || !password}
              style={styles.cta}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>эсвэл</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title={loading ? 'Google нээгдэж байна…' : 'Google-ээр нэвтрэх'}
              icon={loading ? undefined : 'G'}
              size="lg"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.cta}
            />

            <View style={styles.hintRow}>
              <Ionicons
                name={isCloud ? 'shield-checkmark-outline' : 'warning-outline'}
                size={15}
                color={isCloud ? colors.textFaint : colors.warning}
                style={{ marginTop: 1.5 }}
              />
              <Text style={isCloud ? styles.hint : styles.note}>
                {isCloud
                  ? 'Зөвхөн байгууллагаас бүртгэсэн хаяг нэвтэрнэ. Хаягаа админаас лавлана уу.'
                  : 'Supabase холбогдоогүй байна. Нэвтрэлт ажиллахын тулд .env тохируулна уу.'}
              </Text>
            </View>
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
  // Логог тойрсон хоёр цагираг — гүн өгнө.
  haloOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  haloInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  // Хуудасны дээд ирмэг дэх бариул — доороос гарч ирсэн мэдрэмж өгнө.
  grip: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
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

  appleBtn: { height: 52, marginTop: spacing.xl },

  // Нэвтрэх хоёр аргын хооронд
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: -spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerText: { ...type.caption, color: colors.textFaint },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt || colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15.5,
    color: colors.text,
  },
  pwWrap: { position: 'relative', justifyContent: 'center' },
  pwInput: { paddingRight: 46 },
  pwToggle: { position: 'absolute', right: spacing.md, padding: 4 },

  cta: { marginTop: spacing.xl },

  hintRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  hint: {
    ...type.caption,
    flex: 1,
    color: colors.textFaint,
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
