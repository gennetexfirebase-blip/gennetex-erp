import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { exportPayrollCsv } from '../../services/payrollExportService';

export default function PayrollExportScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [csv, setCsv] = useState('');

  const run = async () => {
    setLoading(true);
    try {
      const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const to = new Date().toISOString();
      const res = await exportPayrollCsv({ from, to });
      setRows(res.rows || []);
      setCsv(res.csv || '');
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Export амжилтгүй');
    } finally {
      setLoading(false);
    }
  };

  const share = async () => {
    if (!csv) return;
    try {
      const path = `${FileSystem.cacheDirectory}payroll_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Payroll CSV' });
      } else {
        await Share.share({ message: csv.slice(0, 3000) });
      }
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Хуваалцаж чадсангүй');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Цалингийн export</Text>
        <Text style={styles.sub}>Ирц + илүү цаг + чөлөө → CSV</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity style={styles.btn} onPress={run} disabled={loading}>
          {loading ? <ActivityIndicator color="#003" /> : <Text style={styles.btnText}>Энэ сарын тайлан бэлтгэх</Text>}
        </TouchableOpacity>

        {rows.length ? (
          <>
            <Text style={styles.meta}>{rows.length} ажилтан</Text>
            {rows.slice(0, 50).map((r) => (
              <View key={r.employee_id} style={styles.row}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.detail}>
                  {r.work_days} өдөр · {r.total_hours}ц · OT {r.overtime_hours} · leave {r.leave_days}
                </Text>
              </View>
            ))}
            <TouchableOpacity style={styles.share} onPress={share}>
              <Text style={styles.shareText}>CSV хуваалцах / татах</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    sub: { color: colors.textMuted, marginTop: 2 },
    body: { padding: spacing.lg, paddingBottom: 60 },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    btnText: { color: colors.onPrimary || '#00363a', fontWeight: '800' },
    meta: { color: colors.textMuted, marginBottom: spacing.sm },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    name: { color: colors.text, fontWeight: '700' },
    detail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    share: {
      marginTop: spacing.lg,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    shareText: { color: colors.primary, fontWeight: '800' },
  });
