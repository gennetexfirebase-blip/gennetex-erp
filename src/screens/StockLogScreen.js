import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, ScreenHeader, EmptyState, formatMNT } from '../components/ui';
import { movementTypeLabel } from '../lib/stockBalance';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

export default function StockLogScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, inventory, fetchStockMovements, reverseStockMovement } = useApp();
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reversingId, setReversingId] = useState(null);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      // Админ — бүгд, ажилтан — зөвхөн өөрийн
      setRows(await fetchStockMovements(!isAdmin));
    } catch (e) {}
  }, [isCloud, isAdmin, fetchStockMovements]);

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

  const totalQty = rows.reduce((s, r) => {
    const type = r.movement_type || 'withdraw';
    const q = Number(r.quantity) || 0;
    return s + (type === 'consume' || type === 'return' ? -q : q);
  }, 0);

  const reversedIds = new Set(rows.map((r) => r.reversed_movement_id).filter(Boolean));

  const amountFor = (row) => {
    const saved = Number(row.total_amount) || 0;
    if (saved > 0) return saved;
    const item = inventory.find((it) => it.id === row.item_id);
    return (Number(row.unit_price) || Number(item?.price) || 0) * (Number(row.quantity) || 0);
  };

  const confirmReverse = (row) => {
    Alert.alert(
      'Олголтыг буцаах уу?',
      `${row.user_name || 'Ажилтан'}-д олгосон ${row.quantity} ${row.unit || 'ш'} ${row.item_name}-ыг агуулахад буцааж нэмнэ.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Буцаах',
          style: 'destructive',
          onPress: async () => {
            setReversingId(row.id);
            try {
              await reverseStockMovement(row.id);
              await load();
            } catch (e) {
              Alert.alert('Буцааж чадсангүй', e?.message || 'Дахин оролдоно уу.');
            } finally {
              setReversingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={isAdmin ? 'Барааны хэрэглээ' : 'Миний авсан бараа'}
        subtitle={`${rows.length} гүйлгээ · ${totalQty} нэгж`}
      />
      {!isCloud ? (
        <EmptyState text="Supabase холбогдсон байх шаардлагатай."/>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const type = item.movement_type || 'withdraw';
            const isOut = type === 'consume' || type === 'return';
            const amount = amountFor(item);
            return (
            <Card style={styles.row}>
              <View style={styles.icon}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: isOut ? colors.danger : colors.primary }}>
                  {isOut ? '−' : '+'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.item_name}</Text>
                <Text style={styles.type}>{movementTypeLabel(type)}</Text>
                {isAdmin ? <Text style={styles.who}>{item.user_name || 'Тодорхойгүй'}</Text> : null}
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString('mn-MN')}</Text>
                {amount > 0 ? <Text style={styles.amount}>{formatMNT(amount)}</Text> : null}
                {isAdmin && type === 'withdraw' ? (
                  reversedIds.has(item.id) ? (
                    <Text style={styles.reversed}>Буцаагдсан</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.reverseBtn}
                      onPress={() => confirmReverse(item)}
                      disabled={reversingId === item.id}
                    >
                      {reversingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Text style={styles.reverseText}>Буруу олголт буцаах</Text>
                      )}
                    </TouchableOpacity>
                  )
                ) : null}
              </View>
              <View style={[styles.qtyPill, isOut && styles.qtyPillOut]}>
                <Text style={[styles.qtyNum, isOut && styles.qtyNumOut]}>{isOut ? '−' : '+'}{item.quantity}</Text>
                <Text style={styles.qtyUnit}>{item.unit || 'ш'}</Text>
              </View>
            </Card>
          );}}
          ListEmptyComponent={<EmptyState text="Олголтын бүртгэл алга байна." />}
        />
      )}
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '800'},
  type: { color: colors.textMuted, fontSize: 11, marginTop: 1, fontWeight: '600'},
  who: { color: colors.primary, fontSize: 13, marginTop: 2, fontWeight: '600'},
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  amount: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  reversed: { color: colors.success, fontSize: 12, fontWeight: '800', marginTop: 6 },
  reverseBtn: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.danger + '12',
    borderWidth: 1,
    borderColor: colors.danger + '44',
  },
  reverseText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  qtyPill: {
    backgroundColor: colors.primary + '18',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 56,
  },
  qtyPillOut: { backgroundColor: colors.danger + '18'},
  qtyNum: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  qtyNumOut: { color: colors.danger },
  qtyUnit: { color: colors.textMuted, fontSize: 10 },
});
