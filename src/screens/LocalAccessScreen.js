import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field } from '../components/ui';
import AmbientBackground from '../components/AmbientBackground';
import { useStyles } from '../context/ThemeContext';
import { radius, spacing } from '../theme';
import {
  getBiometricCapability,
  getLocalAccessConfig,
  setupLocalAccess,
  unlockWithBiometric,
  verifyLocalPin,
} from '../services/localAccessService';

export default function LocalAccessScreen({ userId, onUnlocked, onSignOut }) {
  const styles = useStyles(makeStyles);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const autoPrompted = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [saved, capability] = await Promise.all([
        getLocalAccessConfig(userId),
        getBiometricCapability().catch(() => ({ available: false })),
      ]);
      if (!active) return;
      setConfig(saved);
      setBiometricAvailable(!!capability.available);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (loading || !config?.biometricEnabled || autoPrompted.current) return;
    autoPrompted.current = true;
    handleBiometric();
  }, [loading, config]);

  const handleBiometric = async () => {
    setError('');
    const result = await unlockWithBiometric(userId);
    if (result.success) onUnlocked();
    else if (result.reason === 'not_available') setError('Биометр ашиглах боломжгүй байна. 4 оронтой PIN-ээ оруулна уу.');
  };

  const handlePinUnlock = async () => {
    if (!(await verifyLocalPin(userId, pin))) {
      setError('PIN код буруу байна.');
      setPin('');
      return;
    }
    onUnlocked();
  };

  const handleSetup = async (enableBiometric) => {
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN 4 оронтой тоо байна.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PIN кодууд ижил биш байна.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await setupLocalAccess(userId, pin, enableBiometric);
      onUnlocked();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const isSetup = !config;
  return (
    <SafeAreaView style={styles.bg}>
      <AmbientBackground />
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{isSetup ? 'Төхөөрөмжийн нэвтрэлт' : 'Gennetex ERP түгжээтэй'}</Text>
          <Text style={styles.subtitle}>
            {isSetup
              ? 'Дараагийн удаа нууц үг шаардахгүй. 4 оронтой PIN үүсгээд биометрээ холбоно уу.'
              : config?.biometricEnabled
                ? 'Биометр эсвэл нөөц 4 оронтой PIN-ээр нээнэ.'
                : '4 оронтой PIN-ээр нээнэ.'}
          </Text>

          <Field
            label={isSetup ? 'Шинэ 4 оронтой PIN' : '4 оронтой PIN'}
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />
          {isSetup ? (
            <Field
              label="PIN давтах"
              value={confirmPin}
              onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {isSetup ? (
            <>
              {biometricAvailable ? (
                <Button title={loading ? 'Түр хүлээнэ үү...' : 'Биометр + PIN идэвхжүүлэх'} onPress={() => handleSetup(true)} disabled={loading} />
              ) : null}
              <Button
                title={biometricAvailable ? 'Зөвхөн PIN ашиглах' : loading ? 'Түр хүлээнэ үү...' : 'PIN хадгалах'}
                variant={biometricAvailable ? 'ghost' : 'primary'}
                onPress={() => handleSetup(false)}
                disabled={loading}
                style={styles.secondary}
              />
            </>
          ) : (
            <>
              <Button title="PIN-ээр нээх" onPress={handlePinUnlock} disabled={pin.length !== 4} />
              {config?.biometricEnabled && biometricAvailable ? (
                <Button title="Биометрээр нээх" variant="ghost" onPress={handleBiometric} style={styles.secondary} />
              ) : null}
            </>
          )}
          <Button title="Google бүртгэлээс гарах" variant="ghost" onPress={onSignOut} style={styles.signOut} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadow.md },
  logo: { width: 76, height: 76, alignSelf: 'center', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.danger + '1f', padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md },
  secondary: { marginTop: spacing.sm },
  signOut: { marginTop: spacing.lg },
});
