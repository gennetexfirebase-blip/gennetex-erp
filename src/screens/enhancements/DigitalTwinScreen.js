import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { fetchCallDigitalTwin, twinToHtml } from '../../services/digitalTwinService';

export default function DigitalTwinScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const callId = route.params?.callId;
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [twin, setTwin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!callId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setTwin(await fetchCallDigitalTwin(callId));
      } catch (e) {
        Alert.alert('Алдаа', e?.message || 'Ачаалж чадсангүй');
      } finally {
        setLoading(false);
      }
    })();
  }, [callId]);

  const exportPdf = async () => {
    if (!twin) return;
    try {
      const html = twinToHtml(twin);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: twin.displayId });
      } else {
        await Share.share({ message: twin.summaryText });
      }
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'PDF үүсгэж чадсангүй');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Digital Twin</Text>
        <Text style={styles.sub}>Ажлын бүрэн түүх</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !twin ? (
        <Text style={styles.empty}>callId шаардлагатай</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.id}>{twin.displayId}</Text>
          <Text style={styles.pre}>{twin.summaryText}</Text>
          <Text style={styles.section}>Workflow {twin.workflow?.percent}%</Text>
          <TouchableOpacity style={styles.btn} onPress={exportPdf}>
            <Text style={styles.btnText}>PDF / хуваалцах</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    sub: { color: colors.textMuted },
    body: { padding: spacing.lg },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    id: { color: colors.primary, fontWeight: '900', fontSize: 18, marginBottom: spacing.md },
    pre: {
      color: colors.text,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      lineHeight: 22,
      ...shadow.sm,
    },
    section: { color: colors.textMuted, marginTop: spacing.lg, fontWeight: '700' },
    btn: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    btnText: { color: colors.onPrimary || '#003', fontWeight: '800' },
  });
