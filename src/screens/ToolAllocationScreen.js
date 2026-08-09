import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, ScreenHeader, EmptyState } from '../components/ui';
import InventoryThumb from '../components/InventoryThumb';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

import { computeHoldersByItem, movementDelta } from '../lib/stockBalance';
export default function ToolAllocationScreen() {
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const category = route.params?.category === 'material' ? 'material' : 'tool';
  const isTool = category === 'tool';
  const { inventory, isCloud, fetchStockMovements } = useApp();
  const [movements, setMovements] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      setMovements(await fetchStockMovements(false));
    } catch (e) {}
  }, [isCloud, fetchStockMovements]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Тухайн ангиллын бараа бүрээр: агуулахын үлдэгдэл + ажилтан бүрийн авсан нийлбэр
  const items = useMemo(() => {
    const list = inventory.filter((it) => (it.category || 'material') === category);
    return list.map((it) => {
      const holders = computeHoldersByItem(movements, it.id);
      const taken = holders.reduce((s, h) => s + h.qty, 0);
      return { ...it, holders: holders.map((h) => ({ name: h.name, qty: h.qty })), taken };
    });
  }, [inventory, movements, category]);

  const totalStock = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const totalTaken = items.reduce((s, it) => s + it.taken, 0);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isTool ? 'Багажийн бүртгэл' : 'Барааны бүртгэл'}
        subtitle={`Агуулахад ${totalStock} · Гарсан үлдэгдэл ${totalTaken}`}
      />
      {!isCloud ? (
        <EmptyState text="Supabase холбогдсон байх шаардлагатай."/>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.headRow}>
                <View style={styles.icon}>
                  <InventoryThumb name={item.name} category={category} size={44} imageUrl={item.image_url} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sub}>Ажилтны үлдэгдэл (авсан − хэрэглэсэн)</Text>
                </View>
                <View style={styles.stockPill}>
                  <Text style={styles.stockNum}>{item.quantity}</Text>
                  <Text style={styles.stockUnit}>агуулахад</Text>
                </View>
              </View>

              {item.holders.length > 0 ? (
                <View style={styles.holders}>
                  {item.holders.map((h, i) => (
                    <View key={i} style={styles.holderRow}>
                      <Text style={styles.holderName}>{h.name}</Text>
                      <Text style={styles.holderQty}>{h.qty} {item.unit}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.none}>Хэн ч аваагүй байна.</Text>
              )}
            </Card>
          )}
          ListEmptyComponent={<EmptyState text="Бүртгэл алга байна." />}
        />
      )}
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { marginBottom: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '800'},
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  stockPill: {
    backgroundColor: colors.primary + '18',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 64,
  },
  stockNum: { color: colors.primary, fontSize: 20, fontWeight: '900'},
  stockUnit: { color: colors.textMuted, fontSize: 9 },
  holders: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  holderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  holderName: { color: colors.text, fontSize: 14, fontWeight: '600'},
  holderQty: { color: colors.accent, fontSize: 14, fontWeight: '800'},
  none: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md, fontStyle: 'italic' },
});
