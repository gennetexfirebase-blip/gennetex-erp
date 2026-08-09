import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import NavIcon from '../components/NavIcon';
import { requestAllAppPermissions, markOnboardingComplete } from '../services/permissionsService';
import { enablePushForUser } from '../services/notificationService';
import { colors as palette, spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';

const ITEMS = [
  { icon: 'chat', color: palette.primary, title: 'Мэдэгдэл', desc: 'Чат, ирц, дуудлагын мэдэгдэл хүлээн авах'},
  { icon: 'location', color: palette.success, title: 'Байршил', desc: 'Ажлын байршил real-time хянах'},
  { icon: 'attendance', color: '#db2777', title: 'Камер', desc: 'Ирц бүртгэх, баркод унших'},
];

export default function OnboardingPermissionsScreen({ onComplete }) {
  const styles = useStyles(makeStyles);
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(false);

  const finish = async () => {
    setLoading(true);
    try {
      await requestAllAppPermissions();
      if (currentUser?.id) {
        try {
          await enablePushForUser(currentUser.id);
        } catch (e) {}
      }
      await markOnboardingComplete();
      onComplete();
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
                <View style={[styles.iconWrap, { backgroundColor: it.color + '14'}]}>
                  <NavIcon name={it.icon} size={22} color={it.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{it.title}</Text>
                  <Text style={styles.rowDesc}>{it.desc}</Text>
                </View>
              </View>
            ))}
          </View>

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
            onPress={async () => {
              await markOnboardingComplete();
              onComplete();
            }}
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
});
