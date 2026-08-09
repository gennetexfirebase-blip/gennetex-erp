import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader, Card, EmptyState } from '../../components/ui';
import * as aiApi from '../../services/aiInventoryService';
import { spacing, radius } from '../../theme';
import { useTheme, useStyles } from '../../context/ThemeContext';

export default function InventoryHistoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await aiApi.fetchInventoryHistory());
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Тооллогын түүх" subtitle={`${rows.length} бүртгэл`} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={<EmptyState text="Түүх алга." />}
          renderItem={({ item }) => {
            const diff = Number(item.difference) || 0;
            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  {item.evidence_url ? (
                    <TouchableOpacity onPress={() => setPreview(item.evidence_url)}>
                      <Image source={{ uri: item.evidence_url }} style={styles.thumb} />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.product_name || '—'}</Text>
                    <Text style={styles.meta}>{item.employee_name || 'Ажилтан'}</Text>
                    <Text style={styles.meta}>
                      {new Date(item.created_at).toLocaleString('mn-MN')}
                    </Text>
                    <Text style={styles.meta}>
                      Expected {item.expected_stock} · Detected {item.detected_stock}
                      {item.adjusted_stock != null ? ` · Adjusted ${item.adjusted_stock}` : ''}
                    </Text>
                  </View>
                  <View style={styles.diffPill}>
                    <Text
                      style={[
                        styles.diffText,
                        { color: diff === 0 ? colors.success : colors.danger },
                      ]}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </Text>
                    <Text style={styles.diffLabel}>ялгаа</Text>
                  </View>
                </View>
                {item.evidence_url ? (
                  <TouchableOpacity onPress={() => setPreview(item.evidence_url)}>
                    <Text style={styles.photoLink}>Зураг харах</Text>
                  </TouchableOpacity>
                ) : null}
              </Card>
            );
          }}
        />
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBg} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  diffPill: { alignItems: 'center', minWidth: 48 },
  diffText: { fontSize: 18, fontWeight: '900' },
  diffLabel: { color: colors.textMuted, fontSize: 10 },
  photoLink: { color: colors.primary, fontWeight: '700', marginTop: spacing.sm },
  previewBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  previewImg: { width: '100%', height: '80%' },
});
