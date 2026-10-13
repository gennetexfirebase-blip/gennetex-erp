import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Wordmark } from '../components/ds';
import { useApp } from '../context/AppContext';
import LegalLinks from '../components/LegalLinks';
import Svg, { Path } from 'react-native-svg';

/** Google-ийн албан ёсны олон өнгийн «G» лого. */
function GoogleLogo({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
    </Svg>
  );
}

let AppleAuthentication;
try { AppleAuthentication = require('expo-apple-authentication'); } catch { AppleAuthentication = null; }

export default function LoginScreen() {
  const passwordRef = useRef(null);
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const { signIn, signInWithGoogle, signInWithApple, authError, isCloud } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !AppleAuthentication) return;
    AppleAuthentication.isAvailableAsync().then(setAppleReady).catch(() => setAppleReady(false));
  }, []);

  const submitPassword = async () => {
    if (!identifier.trim() || !password || passwordLoading || googleLoading) return;
    setLocalError(null); setPasswordLoading(true);
    try { await signIn(identifier, password); } catch (error) { setLocalError(mapError(error)); } finally { setPasswordLoading(false); }
  };
  const submitGoogle = async () => {
    if (passwordLoading || googleLoading) return;
    setLocalError(null); setGoogleLoading(true);
    try { await signInWithGoogle(); } catch (error) { setLocalError(mapError(error)); } finally { setGoogleLoading(false); }
  };
  const submitApple = async () => {
    setLocalError(null);
    try { await signInWithApple(); } catch (error) { setLocalError(mapError(error)); }
  };

  const shownError = localError || authError;
  const disabled = passwordLoading || googleLoading;

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <Wordmark size={22} logoSize={36} sub="Ажлын нэгдсэн орчин" />
          </View>
          <Text style={styles.title} accessibilityRole="header">Нэвтрэх</Text>
          <Text style={styles.lead}>Ажилтны код эсвэл имэйл хаягаараа нэвтэрнэ үү.</Text>

          {shownError ? <View style={styles.errorBox} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={18} color={colors.bad} /><Text style={styles.errorText}>{mapError(shownError)}</Text></View> : null}

          <View style={styles.form}>
            <Text style={styles.label}>Ажилтны код эсвэл имэйл</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="name@gennetex.com"
              placeholderTextColor={colors.faint}
              style={[styles.input, focused === 'email' && styles.inputFocused]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!disabled}
            />

            <Text style={[styles.label, styles.passwordLabel]}>Нууц үг</Text>
            <View>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Нууц үгээ оруулна уу"
                placeholderTextColor={colors.faint}
                style={[styles.input, { paddingRight: 96 }, focused === 'password' && styles.inputFocused]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                onSubmitEditing={submitPassword}
                editable={!disabled}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.pwShow} accessibilityRole="button" accessibilityLabel={showPassword ? 'Нууц үг нуух' : 'Нууц үг харуулах'}>
                <Text style={styles.pwShowText}>{showPassword ? 'Нуух' : 'Харуулах'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setLocalError('Нууц үг сэргээх бол байгууллагын админтай холбогдоно уу.')} style={styles.forgot}>
              <Text style={styles.forgotText}>Нууц үгээ мартсан уу?</Text>
            </Pressable>

            <Pressable onPress={submitPassword} disabled={disabled || !identifier.trim() || !password} style={({ pressed }) => [styles.loginButton, (!identifier.trim() || !password) && styles.loginDisabled, pressed && styles.pressed]}>
              {passwordLoading ? <ActivityIndicator color={colors.brandInk} /> : <Text style={styles.loginText}>Нэвтрэх</Text>}
            </Pressable>

            <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>эсвэл</Text><View style={styles.dividerLine} /></View>
            <View style={styles.socialRow}>
              <Pressable onPress={submitGoogle} disabled={disabled} style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}>
                {googleLoading ? <ActivityIndicator color={colors.ink} /> : <><GoogleLogo size={22} /><Text style={styles.socialText}>Google-ээр нэвтрэх</Text></>}
              </Pressable>
              {/* Apple — Google-ийн доор. iPhone дээр Apple-ийн өөрийн товч, бусад дээр түр ижил загвартай товч. */}
              {Platform.OS === 'ios' && appleReady && AppleAuthentication ? (
                <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN} buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={16} style={styles.appleButton} onPress={submitApple} />
              ) : (
                <Pressable
                  onPress={() => (Platform.OS === 'ios' ? submitApple() : setLocalError('Apple-ээр нэвтрэх нь iPhone дээр ажиллана.'))}
                  disabled={disabled}
                  style={({ pressed }) => [styles.socialButton, styles.appleFallback, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Ionicons name="logo-apple" size={22} color={colors.bg} />
                  <Text style={[styles.socialText, { color: colors.bg }]}>Apple-ээр нэвтрэх</Text>
                </Pressable>
              )}
            </View>
            {!isCloud ? <Text style={styles.serviceNote}>Нэвтрэх үйлчилгээ түр боломжгүй байна. Сүлжээгээ шалгаад дахин оролдоно уу.</Text> : null}
          </View>
          <Text style={styles.smallFoot}>
            Бүртгэлгүй юу? <Text style={styles.smallFootStrong}>Хүний нөөцөд хандах</Text>
          </Text>
          <LegalLinks compact />
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function mapError(error = '') {
  const raw = String(typeof error === 'string' ? error : error?.message || '').trim();
  let decoded = raw;
  try { decoded = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch {}
  if (/not authorized|not registered|not allowed|gmail_not_authorized|бүртгэлгүй|зөвшөөрөгдөөгүй/i.test(decoded)) return 'Энэ и-мэйл бүртгэлгүй байна.';
  if (/invalid login|invalid credentials|password/i.test(decoded)) return 'И-мэйл эсвэл нууц үг буруу байна.';
  if (!decoded) return 'Нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу.';
  return decoded;
}

const makeStyles = ({ colors }) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  brandRow: { marginBottom: 22 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, marginBottom: 26 },
  form: { width: '100%' },
  errorBox: { width: '100%', flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: colors.badSoft, borderRadius: 14, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: colors.bad, fontSize: 13, lineHeight: 18 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600', marginBottom: 7 }, passwordLabel: { marginTop: 16 },
  input: { height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.field, color: colors.ink, fontSize: 16, paddingHorizontal: 16 },
  inputFocused: { borderColor: colors.ink, backgroundColor: colors.bg },
  pwShow: { position: 'absolute', right: 6, top: 7, height: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10 },
  pwShowText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  forgot: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', paddingLeft: 18 }, forgotText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
  loginButton: { height: 56, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  loginDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  loginText: { color: colors.brandInk, fontSize: 17, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 24 }, dividerLine: { flex: 1, height: 1, backgroundColor: colors.line }, dividerText: { color: colors.muted, fontSize: 14 },
  socialRow: { gap: 12 },
  socialButton: { height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  appleFallback: { backgroundColor: colors.ink, borderColor: colors.ink }, socialText: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  appleButton: { width: '100%', height: 56 }, serviceNote: { color: colors.warn, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  smallFoot: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 26, marginBottom: 8 },
  smallFootStrong: { color: colors.ink, fontWeight: '600' },
});