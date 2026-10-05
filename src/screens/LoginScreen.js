import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../context/AppContext';
import LegalLinks from '../components/LegalLinks';

let AppleAuthentication;
try { AppleAuthentication = require('expo-apple-authentication'); } catch { AppleAuthentication = null; }

export default function LoginScreen() {
  const passwordRef = useRef(null);
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
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" backgroundColor="#f6f8fa" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Gennetex" />
          </View>
          <View style={styles.intro}>
            <Text style={styles.kicker}>Ажлын нэгдсэн орчин</Text>
            <Text style={styles.title} accessibilityRole="header">Gennetex ERP-д нэвтрэх</Text>
            <Text style={styles.subtitle}>Ирц, ажил, бараа материал болон багийн мэдээллээ нэг дор удирдана.</Text>
          </View>

          {shownError ? <View style={styles.errorBox} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={18} color="#d92d20" /><Text style={styles.errorText}>{mapError(shownError)}</Text></View> : null}

          <View style={styles.form}>
            <Text style={styles.label}>И-мэйл</Text>
            <View style={[styles.inputShell, focused === 'email' && styles.inputFocused]}>
              <Ionicons name="mail-outline" size={20} color="#61738a" />
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="name@gennetex.com"
                placeholderTextColor="#94a3b8"
                style={styles.input}
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
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>Нууц үг</Text>
            <View style={[styles.inputShell, focused === 'password' && styles.inputFocused]}>
              <Ionicons name="lock-closed-outline" size={20} color="#61738a" />
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Нууц үгээ оруулна уу"
                placeholderTextColor="#94a3b8"
                style={styles.input}
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
              <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showPassword ? 'Нууц үг нуух' : 'Нууц үг харуулах'}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={21} color="#536581" />
              </Pressable>
            </View>
            <Pressable onPress={() => setLocalError('Нууц үг сэргээх бол байгууллагын админтай холбогдоно уу.')} style={styles.forgot}>
              <Text style={styles.forgotText}>Нууц үгээ мартсан уу?</Text>
            </Pressable>

            <Pressable onPress={submitPassword} disabled={disabled || !identifier.trim() || !password} style={({ pressed }) => [styles.loginButton, (!identifier.trim() || !password) && styles.loginDisabled, pressed && styles.pressed]}>
                {passwordLoading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.loginText}>Нэвтрэх</Text><Ionicons name="arrow-forward" size={20} color="#fff" /></>}
            </Pressable>

            <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>эсвэл</Text><View style={styles.dividerLine} /></View>
            <View style={styles.socialRow}>
              <Pressable onPress={submitGoogle} disabled={disabled} style={styles.socialButton}>
                {googleLoading ? <ActivityIndicator color="#0369a1" /> : <><Text style={styles.googleMark}>G</Text><Text style={styles.socialText}>Google-ээр нэвтрэх</Text></>}
              </Pressable>
              {Platform.OS === 'ios' && appleReady && AppleAuthentication ? (
                <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE} cornerRadius={24} style={styles.appleButton} onPress={submitApple} />
              ) : null}
            </View>
            {!isCloud ? <Text style={styles.serviceNote}>Нэвтрэх үйлчилгээ түр боломжгүй байна. Сүлжээгээ шалгаад дахин оролдоно уу.</Text> : null}
          </View>
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={17} color="#047857" />
            <Text style={styles.securityText}>Зөвхөн байгууллагаас эрх олгосон ажилтан нэвтрэх боломжтой.</Text>
          </View>
          <LegalLinks compact />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8fa' }, flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  brandRow: { minHeight: 104, alignItems: 'flex-start', justifyContent: 'center' },
  logo: { width: 142, height: 82, marginLeft: -9 },
  intro: { marginTop: 8, marginBottom: 24 },
  kicker: { color: '#0369a1', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  title: { color: '#0f172a', fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.65, marginTop: 6 },
  subtitle: { maxWidth: 390, color: '#475569', fontSize: 15, lineHeight: 22, marginTop: 8 },
  form: { width: '100%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, backgroundColor: '#fff', padding: 18, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  errorBox: { width: '100%', flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: '#fff1f2', borderLeftWidth: 3, borderLeftColor: '#b91c1c', borderRadius: 8, padding: 11, marginBottom: 16 },
  errorText: { flex: 1, color: '#7f1d1d', fontSize: 13, lineHeight: 18 },
  label: { color: '#334155', fontSize: 13, lineHeight: 18, fontWeight: '600', marginBottom: 7 }, passwordLabel: { marginTop: 15 },
  inputShell: { minHeight: 52, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  inputFocused: { borderWidth: 2, borderColor: '#0369a1' }, input: { flex: 1, height: 50, color: '#0f172a', fontSize: 16, paddingHorizontal: 11 },
  eyeButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingLeft: 18 }, forgotText: { color: '#0369a1', fontSize: 13, fontWeight: '600' },
  loginButton: { minHeight: 52, borderRadius: 10, backgroundColor: '#0369a1', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, loginDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  loginText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }, dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#cbd5e1' }, dividerText: { color: '#64748b', fontSize: 12 },
  socialRow: { gap: 10 },
  socialButton: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  googleMark: { color: '#4285f4', fontSize: 20, fontWeight: '800' }, socialText: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  appleButton: { width: '100%', height: 50 }, serviceNote: { color: '#92400e', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 6, marginTop: 18, marginBottom: 8 },
  securityText: { flex: 1, color: '#64748b', fontSize: 12, lineHeight: 18 },
});
