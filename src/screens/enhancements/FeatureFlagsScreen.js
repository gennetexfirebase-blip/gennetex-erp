import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import {
  DEFAULT_FLAGS,
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlags,
  loadFeatureFlagOverrides,
} from '../../lib/featureFlags';

const LABELS = {
  offlineFirst: 'Оффлайн-first sync',
  forceUpdate: 'Force / soft update',
  crashReporting: 'Crash reporting',
  smartToday: 'Өнөөдөр самбар',
  callWorkflowStrict: 'Strict call workflow',
  routeOptimize: 'Замын оновчлол',
  customerNotify: 'Харилцагч мэдэгдэл',
  materialSuggest: 'Бараа санал',
  lowStockAlerts: 'Бага үлдэгдэл',
  callCost: 'Дуудлагын өртөг',
  toolCondition: 'Багажны нөхцөл',
  liveOps: 'Live Ops',
  slaReports: 'SLA тайлан',
  autoDispatch: 'Автомат оноолт',
  payrollExport: 'Цалин export',
  knowledgeBase: 'Мэдлэгийн сан',
  multiBranch: 'Олон салбар',
  predictive: 'Predictive',
  digitalTwin: 'Digital twin',
  subcontractorMode: 'Туслан горим flag',
  barcodeScanMode: 'Barcode горим',
  publicTickets: 'Public tickets',
};

export default function FeatureFlagsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [flags, setFlags] = useState(getFeatureFlags());

  useEffect(() => {
    loadFeatureFlagOverrides().then(setFlags);
  }, []);

  const toggle = async (key, value) => {
    const next = await setFeatureFlag(key, value);
    setFlags(next);
  };

  const reset = async () => {
    const next = await resetFeatureFlags();
    setFlags(next);
    Alert.alert('Сэргээлээ', 'Env default-руу буцлаа');
  };

  const keys = Object.keys(DEFAULT_FLAGS);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Feature flags</Text>
        <TouchableOpacity onPress={reset}>
          <Text style={styles.reset}>Reset defaults</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={keys}
        keyExtractor={(k) => k}
        contentContainerStyle={styles.list}
        renderItem={({ item: key }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{LABELS[key] || key}</Text>
              <Text style={styles.key}>{key}</Text>
            </View>
            <Switch
              value={!!flags[key]}
              onValueChange={(v) => toggle(key, v)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    reset: { color: colors.warning, fontWeight: '700', marginTop: 8 },
    list: { padding: spacing.lg, paddingBottom: 60 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    name: { color: colors.text, fontWeight: '700' },
    key: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  });
