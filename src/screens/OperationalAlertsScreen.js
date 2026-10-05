import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Card, EmptyState, ErrorState, ScreenHeader } from '../components/ui';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing } from '../theme';
import { fetchOperationalAlerts } from '../services/companySettingsService';

const TYPE_LABEL = {
  low_stock: 'Агуулах',
  training: 'Сургалт',
  vehicle_inspection: 'Техникийн үзлэг',
  vehicle_insurance: 'Даатгал',
};

export default function OperationalAlertsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      setItems(await fetchOperationalAlerts());
    } catch (error) {
      setErrorMessage(error?.message || 'Анхааруулгын мэдээлэл ачаалж чадсангүй.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => filter === 'all' ? items : items.filter((item) => item.severity === filter),
    [filter, items]
  );
  const dangerCount = items.filter((item) => item.severity === 'danger').length;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Анхааруулгын төв"
        subtitle={errorMessage ? 'Мэдээлэл ачаалсангүй' : `${items.length} анхаарах зүйл`}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <View style={styles.filters}>
          {[
            ['all', `Бүгд ${errorMessage ? '—' : items.length}`],
            ['danger', `Яаралтай ${errorMessage ? '—' : dangerCount}`],
            ['warning', `Сануулах ${errorMessage ? '—' : Math.max(0, items.length - dangerCount)}`],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.filter, filter === key && styles.filterActive]}
              onPress={() => setFilter(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === key }}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!loading && errorMessage ? (
          <Card style={styles.errorCard}>
            <ErrorState text={errorMessage} onRetry={load} />
          </Card>
        ) : !loading && visible.length === 0 ? (
          <EmptyState text="Одоогоор анхаарах зүйл алга." icon="✓" />
        ) : visible.map((item) => {
          const danger = item.severity === 'danger';
          return (
            <Card key={`${item.alert_type}:${item.entity_id}:${item.due_date || ''}`} style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: (danger ? colors.danger : colors.warning) + '22' }]}>
                  <Text style={styles.iconText}>{danger ? '!' : '•'}</Text>
                </View>
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Badge text={TYPE_LABEL[item.alert_type] || item.alert_type} color={danger ? colors.danger : colors.warning} />
                  </View>
                  <Text style={styles.detail}>{item.detail}</Text>
                  {item.days_remaining != null ? (
                    <Text style={[styles.days, { color: danger ? colors.danger : colors.warning }]}>
                      {item.days_remaining < 0
                        ? `${Math.abs(item.days_remaining)} хоног хэтэрсэн`
                        : item.days_remaining === 0
                          ? 'Өнөөдөр дуусна'
                          : `${item.days_remaining} хоног үлдсэн`}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: 48 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  filter: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: colors.primary },
  errorCard: { padding: spacing.md },
  card: { padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.text, fontSize: 20, fontWeight: '900' },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { flex: 1, minWidth: 150, color: colors.text, fontSize: 15, fontWeight: '800' },
  detail: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  days: { fontSize: 12, fontWeight: '800', marginTop: 7 },
});
