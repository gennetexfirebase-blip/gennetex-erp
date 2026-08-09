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
import { fetchOpenTickets, updateTicketStatus } from '../../services/publicTicketService';

export default function PublicTicketsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchOpenTickets());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id, status) => {
    try {
      await updateTicketStatus(id, status);
      load();
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Шинэчилж чадсангүй');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Public tickets</Text>
        <Text style={styles.sub}>Вэб сайтаас ирсэн дуудлага</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>Нээлттэй ticket алга</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.customer_name}</Text>
              <Text style={styles.meta}>{item.phone} · {item.address || ''}</Text>
              <Text style={styles.problem}>{item.problem}</Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setStatus(item.id, 'in_progress')}>
                  <Text style={styles.link}>Хийгдэж буй</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStatus(item.id, 'closed')}>
                  <Text style={styles.link}>Хаах</Text>
                </TouchableOpacity>
              </View>
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
    sub: { color: colors.textMuted },
    list: { padding: spacing.lg, paddingBottom: 60 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    name: { color: colors.text, fontWeight: '800' },
    meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    problem: { color: colors.text, marginTop: 8, lineHeight: 20 },
    actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
    link: { color: colors.primary, fontWeight: '700' },
  });
