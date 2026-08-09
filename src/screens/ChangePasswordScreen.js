import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Button, Field } from '../components/ui';
import { spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';

export default function ChangePasswordScreen() {
  const styles = useStyles(makeStyles);
  const { changePassword, signOut, currentUser } = useApp();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (pw.length < 6) {
      setError('Нууц үг доод тал нь 6 тэмдэгт байх ёстой.');
      return;
    }
    if (pw !== pw2) {
      setError('Нууц үг таарахгүй байна.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await changePassword(pw);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.bg}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <View style={styles.logo}>
                <Text style={styles.logoLetter}>PW</Text>
              </View>
              <Text style={styles.title}>Нууц үг солих</Text>
              <Text style={styles.sub}>
                Сайн байна уу{currentUser?.name ? `, ${currentUser.name}` : ''}! Анх нэвтэрсэн тул
                өөрийн шинэ нууц үгээ тохируулна уу.
              </Text>
            </View>

            <Field
              label="Шинэ нууц үг (6+ тэмдэгт)"
              placeholder="••••••••"
              secureTextEntry
              value={pw}
              onChangeText={setPw}
            />
            <Field
              label="Нууц үг давтах"
              placeholder="••••••••"
              secureTextEntry
              value={pw2}
              onChangeText={setPw2}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={loading ? 'Хадгалж байна...' : 'Хадгалах'}
              size="lg"
              onPress={handleSave}
              disabled={loading}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              title="Гарах"
              variant="ghost"
              onPress={signOut}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoLetter: { color: colors.primary, fontSize: 18, fontWeight: '800'},
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20, fontSize: 14 },
  error: {
    color: colors.danger,
    backgroundColor: '#fef2f2',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    fontSize: 13,
  },
});
