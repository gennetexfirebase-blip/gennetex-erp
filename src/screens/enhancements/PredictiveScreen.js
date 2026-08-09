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
import { fetchPredictiveSites } from '../../services/predictiveService';

const LEVEL_COLOR = { high: '#dc2626', medium: '#d97706', low: '#16a34a' };

export default function PredictiveScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSites(await fetchPredictiveSites());
    } catch {
      setSites([]);
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
        <Text style={styles.title}>Урьдчилан таамаг</Text>
        <Text style={styles.sub}>Дахин эвдрэх магадлалтай хаяг</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={sites}
          keyExtractor={(s) => s.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>Хангалттай түүх алга (2+ visit хэрэгтэй)</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: (LEVEL_COLOR[item.riskLevel] || colors.primary) + '22' }]}>
                <Text style={{ color: LEVEL_COLOR[item.riskLevel], fontWeight: '900' }}>{item.risk}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.customer || item.address || item.phone}</Text>
                <Text style={styles.meta} numberOfLines={2}>
                  {item.address} · {item.visitCount} удаа · 90 хоногт {item.last90}
                </Text>
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
    sub: { color: colors.textMuted, marginTop: 2 },
    list: { padding: spacing.lg, paddingBottom: 60 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.sm,
    },
    badge: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { color: colors.text, fontWeight: '700' },
    meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  });
