import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as tg from '../services/telegramUserService';
import { formatConvTime } from '../lib/formatTime';
import { avatarGradient, initials } from '../lib/telegram/avatarColor';

const TG_BLUE = '#229ED9';
const TG_BLUE_DARK = '#1C8CC2';

function LoginView({ onDone }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [via, setVia] = useState('app');
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const submitPhone = async () => {
    const p = phone.trim();
    if (!p.startsWith('+')) {
      setError('Улсын кодтой оруулна уу (ж: +976...)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { phoneCodeHash: hash, viaApp } = await tg.sendLoginCode(p);
      setPhoneCodeHash(hash);
      setVia(viaApp ? 'app' : 'sms');
      setStep('code');
      setResendIn(30);
    } catch (e) {
      setError(e.message || 'Код илгээхэд алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError(null);
    try {
      const { phoneCodeHash: hash, via: v } = await tg.resendLoginCode(phone.trim(), phoneCodeHash);
      setPhoneCodeHash(hash);
      setVia(v);
      setResendIn(30);
    } catch (e) {
      setError(e.message || 'Дахин илгээхэд алдаа гарлаа');
    } finally {
      setResending(false);
    }
  };

  const submitCode = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const res = await tg.signInWithCode({ phoneNumber: phone.trim(), phoneCodeHash, phoneCode: c });
      if (res.needPassword) setStep('password');
      else onDone();
    } catch (e) {
      setError(e.message || 'Код буруу байна');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await tg.signInWithPassword(password);
      onDone();
    } catch (e) {
      setError(e.message || 'Нууц үг буруу байна');
    } finally {
      setBusy(false);
    }
  };

  const codeHint =
    via === 'sms'
      ? 'Код SMS-ээр илгээгдлээ'
      : via === 'call'
      ? 'Автомат дуудлагаар код хэлнэ'
      : 'Код таны Telegram апп дотор (777000 чат) ирсэн';
  const stepMeta = {
    phone: { title: 'Утасны дугаар', hint: 'Telegram танд нэвтрэх код илгээнэ' },
    code: { title: 'Баталгаажуулах код', hint: codeHint },
    password: { title: '2FA нууц үг', hint: 'Хоёр шатлалт баталгаажуулалтын нууц үг' },
  }[step];

  return (
    <View style={styles.loginWrap}>
      <LinearGradient colors={[TG_BLUE, TG_BLUE_DARK]} style={styles.loginIcon}>
        <Ionicons name="paper-plane" size={44} color="#fff" />
      </LinearGradient>
      <Text style={styles.loginTitle}>Telegram-аар нэвтрэх</Text>
      <Text style={styles.loginSub}>Өөрийн акаунтаараа нэвтэрч бүх чатаа энд харна.</Text>

      <View style={styles.dots}>
        {['phone', 'code', 'password'].map((s) => (
          <View
            key={s}
            style={[
              styles.dot,
              (s === step) && styles.dotActive,
              (s === 'password' && step !== 'password') && styles.dotHidden,
            ]}
          />
        ))}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>{stepMeta.title}</Text>
        {step === 'phone' && (
          <TextInput
            style={styles.loginInput}
            placeholder="+976 99112233"
            placeholderTextColor={colors.textFaint}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
        )}
        {step === 'code' && (
          <TextInput
            style={[styles.loginInput, styles.codeInput]}
            placeholder="- - - - -"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
            autoFocus
          />
        )}
        {step === 'password' && (
          <TextInput
            style={styles.loginInput}
            placeholder="Нууц үг"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoFocus
          />
        )}
        <Text style={styles.fieldHint}>{stepMeta.hint}</Text>
      </View>

      {error ? (
        <View style={styles.loginErrBox}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.loginErr}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={step === 'phone' ? submitPhone : step === 'code' ? submitCode : submitPassword}
        disabled={busy}
        style={styles.btnWrap}
      >
        <LinearGradient colors={[TG_BLUE, TG_BLUE_DARK]} style={styles.loginBtn}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.loginBtnText}>
                {step === 'phone' ? 'Код авах' : step === 'code' ? 'Нэвтрэх' : 'Баталгаажуулах'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {step === 'code' ? (
        <TouchableOpacity onPress={resend} disabled={resendIn > 0 || resending} style={styles.resendLink}>
          {resending ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={[styles.resendText, resendIn > 0 && styles.resendDisabled]}>
              {resendIn > 0 ? `Дахин илгээх (${resendIn}сек)` : 'Код ирсэнгүй юу? Дахин илгээх (SMS/дуудлага)'}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {step !== 'phone' ? (
        <TouchableOpacity onPress={() => { setStep('phone'); setError(null); }} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Дугаар өөрчлөх</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function DialogRow({ item, onPress }) {
  const styles = useStyles(makeStyles);
  const grad = avatarGradient(item.title);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <LinearGradient colors={grad} style={styles.avatar}>
        {item.isChannel ? (
          <Ionicons name="megaphone" size={22} color="#fff" />
        ) : item.isGroup ? (
          <Ionicons name="people" size={22} color="#fff" />
        ) : (
          <Text style={styles.avatarText}>{initials(item.title)}</Text>
        )}
      </LinearGradient>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          {item.date ? <Text style={styles.rowTime}>{formatConvTime(item.date)}</Text> : null}
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowMsg} numberOfLines={1}>{item.lastMessage || 'Мессеж алга'}</Text>
          {item.unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MyTelegramScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const [authed, setAuthed] = useState(null);
  const [dialogs, setDialogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const configured = tg.isConfigured();

  const loadDialogs = useCallback(async () => {
    try {
      const data = await tg.fetchDialogs(60);
      setDialogs(data);
      setError(null);
    } catch (e) {
      setError(e.message || 'Чат ачаалахад алдаа гарлаа');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (!configured) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ok = await tg.isAuthorized();
    setAuthed(ok);
    if (ok) await loadDialogs();
    else setLoading(false);
  }, [configured, loadDialogs]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useFocusEffect(
    useCallback(() => {
      if (authed) loadDialogs();
    }, [authed, loadDialogs])
  );

  const onLogout = () => {
    Alert.alert('Гарах', 'Telegram-аас гарах уу?', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Гарах',
        style: 'destructive',
        onPress: async () => {
          await tg.logout();
          setAuthed(false);
          setDialogs([]);
        },
      },
    ]);
  };

  const Header = ({ right }) => (
    <LinearGradient colors={[TG_BLUE, TG_BLUE_DARK]} style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.headerLogo}>
          <Ionicons name="paper-plane" size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.title}>Миний Telegram</Text>
          <Text style={styles.sub}>{authed ? `${dialogs.length} чат` : 'Хувийн акаунт'}</Text>
        </View>
      </View>
      {right}
    </LinearGradient>
  );

  if (!configured) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />
        <Header />
        <View style={styles.center}>
          <Ionicons name="construct-outline" size={44} color={colors.textMuted} />
          <Text style={styles.notice}>
            Telegram API тохируулаагүй байна.{'\n\n'}
            my.telegram.org-оос api_id, api_hash авч .env дотор
            EXPO_PUBLIC_TELEGRAM_API_ID / _HASH болгон нэмнэ үү.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <Header
        right={
          authed ? (
            <TouchableOpacity onPress={onLogout} style={styles.headerBtn}>
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={TG_BLUE} size="large" />
          <Text style={styles.loadingText}>Ачаалж байна...</Text>
        </View>
      ) : authed ? (
        <FlatList
          data={dialogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DialogRow
              item={item}
              onPress={() => navigation.navigate('TelegramDialog', { id: item.id, title: item.title })}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={dialogs.length ? null : styles.flexGrow}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadDialogs(); }}
              tintColor={TG_BLUE}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textFaint} />
              <Text style={styles.empty}>{error || 'Чат алга байна.'}</Text>
            </View>
          }
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <LoginView onDone={checkAuth} />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    flexGrow: { flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 13 },
    notice: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 21 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerLogo: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
    },
    title: { color: '#fff', fontSize: 18, fontWeight: '800' },
    sub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
    headerBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
    },

    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 12, fontSize: 14 },
    sep: { height: 1, backgroundColor: colors.border, marginLeft: 82 },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 14 },
    avatar: {
      width: 54, height: 54, borderRadius: 27,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
    rowBody: { flex: 1 },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
    rowTime: { color: colors.textFaint, fontSize: 11, marginLeft: 8 },
    rowMsg: { color: colors.textMuted, fontSize: 14, flex: 1 },
    badge: {
      minWidth: 22, height: 22, borderRadius: 11,
      backgroundColor: TG_BLUE,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 7, marginLeft: 8,
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    // Login
    loginWrap: { padding: 24, alignItems: 'center', paddingTop: 36 },
    loginIcon: {
      width: 88, height: 88, borderRadius: 44,
      alignItems: 'center', justifyContent: 'center', marginBottom: 22,
      shadowColor: TG_BLUE, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    },
    loginTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
    loginSub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    dots: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { width: 24, backgroundColor: TG_BLUE },
    dotHidden: { opacity: 0.4 },
    formCard: {
      width: '100%',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: 18,
      padding: 18,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    loginInput: {
      width: '100%', height: 52, borderRadius: 12, paddingHorizontal: 16,
      backgroundColor: colors.surface, color: colors.text, fontSize: 17,
      borderWidth: 1, borderColor: colors.border,
    },
    codeInput: { textAlign: 'center', letterSpacing: 10, fontSize: 24, fontWeight: '700' },
    fieldHint: { color: colors.textFaint, fontSize: 12, marginTop: 10, lineHeight: 17 },
    loginErrBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 4 },
    loginErr: { color: colors.danger, fontSize: 13, flex: 1 },
    btnWrap: { width: '100%', marginTop: 18 },
    loginBtn: {
      width: '100%', height: 54, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'row', gap: 8,
    },
    loginBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    resendLink: { marginTop: 18, padding: 8, minHeight: 24, justifyContent: 'center' },
    resendText: { color: TG_BLUE, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    resendDisabled: { color: colors.textFaint },
    backLink: { marginTop: 8, padding: 8 },
    backLinkText: { color: TG_BLUE, fontSize: 14, fontWeight: '600' },
  });
