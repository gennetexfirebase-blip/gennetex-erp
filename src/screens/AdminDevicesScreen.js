import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Card, Button, Badge, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as deviceApi from '../services/deviceAuthService';

const STATUS_COLORS = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };
const STATUS_LABEL = { pending: 'Хүлээгдэж буй', approved: 'Зөвшөөрсөн', rejected: 'Татгалзсан' };

export default function AdminDevicesScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await deviceApi.fetchAllDevices());
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = deviceApi.subscribeDevices(load);
    return unsub;
  }, [load]);

  const decide = async (row, status) => {
    try {
      await deviceApi.decideDevice(row.id, status, {
        deciderId: authProfile?.id,
        deciderName: authProfile?.name,
        userId: row.user_id,
      });
      load();
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Шинэчилж чадсангүй');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Төхөөрөмж зөвшөөрөл" subtitle={`Нийт ${rows.length}`} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        {rows.length === 0 && !loading ? (
          <EmptyState text="Төхөөрөмжийн хүсэлт алга." />
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>{r.user_name || 'Ажилтан'}</Text>
                <Badge text={STATUS_LABEL[r.status] || r.status} color={STATUS_COLORS[r.status]} />
              </View>
              <Info k="Төхөөрөмж" v={`${r.device_brand || ''} ${r.device_model || ''}`.trim() || '—'} styles={styles} />
              <Info k="Систем" v={`${r.os || ''} ${r.os_version || ''}`.trim() || '—'} styles={styles} />
              <Info k="IP хаяг" v={r.public_ip || '—'} styles={styles} />
              <Info k="Дотоод IP" v={r.local_ip || '—'} styles={styles} />
              <Info k="MAC" v={r.mac || '—'} styles={styles} />
              <Info k="Огноо" v={new Date(r.requested_at).toLocaleString('mn-MN')} styles={styles} />
              {r.status === 'pending' ? (
                <View style={styles.actions}>
                  <Button title="Зөвшөөрөх" variant="success" onPress={() => decide(r, 'approved')} style={{ flex: 1 }} />
                  <Button title="Татгалзах" variant="danger" onPress={() => decide(r, 'rejected')} style={{ flex: 1 }} />
                </View>
              ) : (
                <View style={styles.actions}>
                  {r.status !== 'approved' ? (
                    <Button title="Зөвшөөрөх" variant="success" onPress={() => decide(r, 'approved')} style={{ flex: 1 }} />
                  ) : null}
                  {r.status !== 'rejected' ? (
                    <Button title="Татгалзах" variant="danger" onPress={() => decide(r, 'rejected')} style={{ flex: 1 }} />
                  ) : null}
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Info({ k, v, styles }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoK}>{k}</Text>
      <Text style={styles.infoV} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: 40 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 3 },
  infoK: { color: colors.textMuted, fontSize: 13 },
  infoV: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
