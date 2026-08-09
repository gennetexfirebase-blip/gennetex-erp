import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { ScreenHeader, Card, Button } from '../../components/ui';
import * as aiApi from '../../services/aiInventoryService';
import { spacing, radius } from '../../theme';
import { useTheme, useStyles } from '../../context/ThemeContext';

export default function InventoryResultScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser } = useApp();
  const {
    summary = [],
    tracks = [],
    evidenceUrl = null,
    employeeId,
    employeeName,
  } = route.params || {};

  const [rows, setRows] = useState(() =>
    summary.map((s) => ({
      ...s,
      expected: 0,
      adjusted: String(s.quantity),
    }))
  );
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    aiApi
      .fetchProducts()
      .then((list) => {
        setProducts(list);
        setRows((prev) =>
          prev.map((r) => {
            const p = list.find((x) => x.id === r.productId);
            return { ...r, expected: Number(p?.stock) || 0 };
          })
        );
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const totals = useMemo(() => {
    const detected = rows.reduce((s, r) => s + (Number(r.adjusted) || 0), 0);
    const expected = rows.reduce((s, r) => s + (Number(r.expected) || 0), 0);
    return { detected, expected, diff: detected - expected };
  }, [rows]);

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const r of rows) {
        const adjusted = Number(r.adjusted) || 0;
        const productDetections = (tracks || []).filter(
          (t) => t.productId === r.productId || t.productName === r.productName
        );
        await aiApi.saveInventoryCount({
          productId: r.productId,
          productName: r.productName,
          expectedStock: r.expected,
          detectedStock: r.quantity,
          adjustedStock: adjusted,
          confidence: r.confidence,
          evidenceUrl,
          employeeId: employeeId || currentUser?.id,
          employeeName: employeeName || currentUser?.name,
          warehouse: products.find((p) => p.id === r.productId)?.warehouse,
          detections: productDetections,
        });
      }
      Alert.alert('Хадгалагдлаа', 'Тооллого Supabase-д хадгалагдлаа.', [
        { text: 'Түүх', onPress: () => navigation.replace('InventoryHistory') },
        { text: 'OK', onPress: () => navigation.navigate('AiInventoryHome') },
      ]);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Тооллогын үр дүн" subtitle="Expected vs Detected" />
      {!loaded ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.productId || r.productName}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {evidenceUrl ? (
                <Image source={{ uri: evidenceUrl }} style={styles.evidence} />
              ) : null}
              <Card style={styles.totalCard}>
                <View style={styles.totalRow}>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Expected</Text>
                    <Text style={styles.totalNum}>{totals.expected}</Text>
                  </View>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Detected</Text>
                    <Text style={[styles.totalNum, { color: colors.primary }]}>{totals.detected}</Text>
                  </View>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Difference</Text>
                    <Text
                      style={[
                        styles.totalNum,
                        { color: totals.diff === 0 ? colors.success : colors.danger },
                      ]}
                    >
                      {totals.diff > 0 ? `+${totals.diff}` : totals.diff}
                    </Text>
                  </View>
                </View>
                <View style={[styles.totalRow, { marginTop: spacing.md }]}>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Missing</Text>
                    <Text style={[styles.totalNum, { color: colors.danger }]}>
                      {Math.max(0, totals.expected - totals.detected)}
                    </Text>
                  </View>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Extra</Text>
                    <Text style={[styles.totalNum, { color: colors.warning }]}>
                      {Math.max(0, totals.detected - totals.expected)}
                    </Text>
                  </View>
                </View>
              </Card>
            </View>
          }
          renderItem={({ item, index }) => {
            const adjusted = Number(item.adjusted) || 0;
            const diff = adjusted - (Number(item.expected) || 0);
            return (
              <Card style={styles.card}>
                <Text style={styles.name}>{item.productName}</Text>
                <Text style={styles.meta}>
                  Confidence: {((item.confidence || 0) * 100).toFixed(0)}%
                </Text>
                <View style={styles.row}>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Expected</Text>
                    <Text style={styles.cellVal}>{item.expected}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Detected</Text>
                    <Text style={styles.cellVal}>{item.quantity}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Засах</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={String(item.adjusted)}
                      onChangeText={(t) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, adjusted: t } : r))
                        )
                      }
                    />
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.cellLabel}>Diff</Text>
                    <Text
                      style={[
                        styles.cellVal,
                        { color: diff === 0 ? colors.success : colors.danger },
                      ]}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          }}
          ListFooterComponent={
            <Button
              title={saving ? 'Хадгалж байна...' : 'Supabase-д хадгалах'}
              onPress={saveAll}
              disabled={saving || !rows.length}
              style={{ marginTop: spacing.md }}
            />
          }
        />
      )}
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  evidence: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  totalCard: { marginBottom: spacing.md },
  totalRow: { flexDirection: 'row' },
  totalBox: { flex: 1, alignItems: 'center' },
  totalLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  totalNum: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  card: { marginBottom: spacing.md },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', marginTop: spacing.md, gap: 6 },
  cell: { flex: 1, alignItems: 'center' },
  cellLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  cellVal: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  input: {
    marginTop: 4,
    width: '100%',
    backgroundColor: colors.bgAlt,
    borderRadius: 8,
    paddingVertical: 6,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '800',
  },
});
