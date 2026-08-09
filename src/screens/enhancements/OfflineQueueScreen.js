import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { getQueue, flushQueue } from '../../services/offlineQueueService';

export default function OfflineQueueScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getQueue());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sync = async () => {
    const res = await flushQueue();
    Alert.alert('Синк', `Амжилт: ${res.ok}, алдаа: ${res.fail}`);
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Оффлайн queue</Text>
        <TouchableOpacity style={styles.sync} onPress={sync}>
          <Text style={styles.syncText}>Одоо синк хийх</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>Хүлээгдэж буй үйлдэл алга</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.type}>{item.type}</Text>
            <Text style={styles.meta}>{item.createdAt}</Text>
            {item.lastError ? <Text style={styles.err}>{item.lastError}</Text> : null}
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
    sync: {
      marginTop: spacing.md,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      padding: spacing.md,
      alignItems: 'center',
    },
    syncText: { color: colors.primary, fontWeight: '800' },
    list: { padding: spacing.lg },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    type: { color: colors.text, fontWeight: '700' },
    meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    err: { color: colors.danger, fontSize: 11, marginTop: 4 },
  });
