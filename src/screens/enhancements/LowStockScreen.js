import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useApp } from '../../context/AppContext';
import {
  fetchLowStockFromCloud,
  buildReorderDraft,
  saveReorderRequest,
  alertAdminsLowStock,
} from '../../services/lowStockService';

export default function LowStockScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const low = await fetchLowStockFromCloud();
      setItems(low);
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const createReorder = async () => {
    try {
      const draft = buildReorderDraft(items);
      await saveReorderRequest(draft, {
        userId: currentUser?.id,
        userName: authProfile?.name,
      });
      await alertAdminsLowStock(items, []);
      Alert.alert('Амжилттай', `Шаардах draft үүслээ (${draft.length} мөр)`);
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Хадгалж чадсангүй (migration ажиллуулсан эсэх?)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Бага үлдэгдэл</Text>
        <Text style={styles.sub}>{items.length} бараа босгоос доогуур</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>Бүх бараа хэвийн үлдэгдэлтэй</Text>}
          ListFooterComponent={
            items.length ? (
              <TouchableOpacity style={styles.btn} onPress={createReorder}>
                <Text style={styles.btnText}>Reorder draft үүсгэх</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  Үлдэгдэл: {item.quantity} {item.unit || ''} · босго: {item.threshold}
                </Text>
              </View>
              <Text style={styles.deficit}>−{item.deficit}</Text>
            </View>
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
    sub: { color: colors.textMuted, marginTop: 4 },
    list: { padding: spacing.lg, paddingBottom: 80 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    name: { color: colors.text, fontWeight: '700' },
    meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    deficit: { color: colors.danger, fontWeight: '800', fontSize: 16 },
    btn: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    btnText: { color: colors.onPrimary || '#00363a', fontWeight: '800' },
  });
