import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import { spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';
import AmbientBackground from '../components/AmbientBackground';

export default function LoginScreen() {
  const styles = useStyles(makeStyles);
  const { signInWithGoogle, authError, isCloud } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(mapError(e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.bg}>
      <AmbientBackground />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImg} resizeMode="contain"/>
              <Text style={styles.appName}>Gennetex ERP</Text>
              <Text style={styles.appSub}>Зөвшөөрөгдсөн Gmail хаягаараа нэвтэрнэ үү</Text>
            </View>

            {error || authError ? <Text style={styles.error}>{mapError(error || authError)}</Text> : null}
            <Button
              title={loading ? 'Google нээгдэж байна...' : 'G  Google-ээр нэвтрэх'}
              size="lg"
              onPress={handleLogin}
              disabled={loading}
              style={{ marginTop: spacing.sm }}
            />
            {!isCloud ? (
              <Text style={styles.note}>
                Supabase холбогдоогүй байна. Нэвтрэлт ажиллахын тулд .env тохируулна уу.
              </Text>
            ) : (
              <Text style={styles.hint}>
                Таны Gmail хаягийг энгийн админ эсвэл Хөгжүүлэгч урьдчилан бүртгэсэн байх шаардлагатай.
              </Text>
            )}
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

function mapError(msg = '') {
  if (/gmail_not_authorized|not authorized|зөвшөөрөгдөөгүй/i.test(msg)) return 'Энэ Gmail хаяг зөвшөөрөгдөөгүй байна. Админд хандана уу.';
  if (/unsupported provider|provider is not enabled/i.test(msg)) return 'Google нэвтрэлт Supabase дээр хараахан идэвхжээгүй байна.';
  return msg;
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
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
  logoImg: { width: 88, height: 88, marginBottom: spacing.md },
  appName: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  appSub: { color: colors.textMuted, marginTop: 6, fontSize: 14 },
  error: {
    color: colors.danger,
    backgroundColor: colors.danger + '1f',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    fontSize: 13,
  },
  note: { color: colors.warning, fontSize: 12, marginTop: spacing.md, textAlign: 'center', lineHeight: 18 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, textAlign: 'center', lineHeight: 18 },
});
