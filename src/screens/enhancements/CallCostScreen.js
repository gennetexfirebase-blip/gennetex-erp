import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { fetchClosedCallsWithCost, aggregateCostReport } from '../../services/callCostService';

export default function CallCostScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [rows, setRows] = useState([]);
  const [agg, setAgg] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const data = await fetchClosedCallsWithCost({ from });
      setRows(data);
      setAgg(aggregateCostReport(data));
    } catch {
      setRows([]);
      setAgg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Дуудлагын өртөг</Text>
        <Text style={styles.sub}>Материал + шатахуун · сүүлийн 30 хоног</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => r.callId || String(i)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListHeaderComponent={
            agg ? (
              <View style={styles.agg}>
                <Text style={styles.aggTitle}>{agg.count} дуудлага</Text>
                <Text style={styles.aggLine}>Материал: {agg.totalMaterial.toLocaleString()}₮</Text>
                <Text style={styles.aggLine}>Шатахуун: {agg.totalFuel.toLocaleString()}₮</Text>
                <Text style={styles.aggTotal}>Нийт: {agg.totalCost.toLocaleString()}₮ · дундаж {agg.avgCost.toLocaleString()}₮</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>Өгөгдөл алга</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('DigitalTwin', { callId: item.callId })}
            >
              <Text style={styles.name}>{item.customer || item.callId}</Text>
              <Text style={styles.meta}>
                {item.engineer || '—'} · мат {item.materialCost}₮ · шат {item.fuelCost}₮
              </Text>
              <Text style={styles.total}>{item.totalCost.toLocaleString()}₮</Text>
            </TouchableOpacity>
          )}
        />
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
    sub: { color: colors.textMuted, marginTop: 2 },
    list: { padding: spacing.lg, paddingBottom: 60 },
    agg: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    aggTitle: { color: colors.text, fontWeight: '800', marginBottom: 6 },
    aggLine: { color: colors.textMuted, fontSize: 13 },
    aggTotal: { color: colors.primary, fontWeight: '800', marginTop: 8 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    name: { color: colors.text, fontWeight: '700' },
    meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    total: { color: colors.primary, fontWeight: '800', marginTop: 4 },
  });
