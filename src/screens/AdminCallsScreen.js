import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, Badge, ScreenHeader, EmptyState } from '../components/ui';
import { CALL_TYPES } from '../data/mockData';
import { STATUS_FILTERS, getCallStatusKey, callBadgeColor, callStatusLabelMn } from '../lib/callStatusColors';
import * as serviceCallApi from '../services/serviceCallService';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

function typeMeta(key) {
  return CALL_TYPES.find((t) => t.key === key) || CALL_TYPES[CALL_TYPES.length - 1];
}

export default function AdminCallsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud } = useApp();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!isCloud) return;
    setLoading(true);
    try {
      const rows = await serviceCallApi.fetchServiceCalls();
      setCalls(rows);
    } catch (e) {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [isCloud]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (!isCloud) return undefined;
      const unsub = serviceCallApi.subscribeServiceCalls(load);
      return () => unsub && unsub();
    }, [load, isCloud])
  );

  const filtered = useMemo(
    () => (statusFilter === 'all' ? calls : calls.filter((c) => getCallStatusKey(c) === statusFilter)),
    [calls, statusFilter]
  );

  const counts = useMemo(() => {
    const c = { all: calls.length, pending: 0, progress: 0, done: 0 };
    calls.forEach((call) => {
      const k = getCallStatusKey(call);
      if (k === 'pending') c.pending += 1;
      else if (k === 'progress') c.progress += 1;
      else if (k === 'done') c.done += 1;
    });
    return c;
  }, [calls]);

  const openMaps = (call) => {
    if (call.latitude == null || call.longitude == null) return;
    const url = Platform.select({
      ios: `maps://?q=${call.latitude},${call.longitude}`,
      android: `geo:${call.latitude},${call.longitude}?q=${call.latitude},${call.longitude}(${encodeURIComponent(call.customer || '')})`,
      default: `https://www.google.com/maps/search/?api=1&query=${call.latitude},${call.longitude}`,
    });
    Linking.openURL(url).catch(() => {});
  };

  const changeStatus = async (id, status) => {
    try {
      await serviceCallApi.updateServiceCallStatus(id, status);
      setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      setSelected((s) => (s && s.id === id ? { ...s, status } : s));
    } catch (e) {}
  };

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Бүх дуудлага" />
        <EmptyState text="Дуудлага харахын тулд Supabase холболт шаардлагатай." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Бүх дуудлага"
        subtitle={loading ? 'Шинэчилж байна...' : `Нийт ${counts.all} · ${counts.pending} хүлээгдэж буй · ${counts.progress} явж байгаа · ${counts.done} дууссан`}
      />

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STATUS_FILTERS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              color={s.color}
              active={statusFilter === s.key}
              onPress={() => setStatusFilter(s.key)}
            />
          ))}
        </ScrollView>
      </View>

      {filtered.length === 0 ? (
        <EmptyState text={loading ? 'Ачаалж байна...' : 'Дуудлага алга.'} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((call) => {
            const tm = typeMeta(call.type);
            return (
              <TouchableOpacity key={call.id} activeOpacity={0.85} onPress={() => setSelected(call)}>
                <Card style={styles.callCard}>
                  <View style={styles.cardTop}>
                    <Badge text={tm.label} color={tm.color} />
                    <Badge text={callStatusLabelMn(call)} color={callBadgeColor(call)} />
                  </View>
                  <Text style={styles.customer}>{call.customer || '—'}</Text>
                  {call.problem ? (
                    <Text style={styles.problem} numberOfLines={2}>{call.problem}</Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Инженер:</Text>
                    <Text style={styles.metaValue}>{call.engineer || '—'}</Text>
                  </View>
                  {call.address ? (
                    <Text style={styles.addr} numberOfLines={1}>{call.address}</Text>
                  ) : null}
                </Card>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>{selected.customer}</Text>
                <View style={styles.badgeRow}>
                  <Badge text={typeMeta(selected.type).label} color={typeMeta(selected.type).color} />
                  <Badge text={callStatusLabelMn(selected)} color={callBadgeColor(selected)} />
                </View>
                <Detail label="Инженер" value={selected.engineer || '—'} styles={styles} />
                <Detail label="Утас" value={selected.phone || '—'} styles={styles} />
                <Detail label="Хаяг" value={selected.address || '—'} styles={styles} />
                <Detail label="Асуудал" value={selected.problem || '—'} styles={styles} />

                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {selected.phone ? (
                    <Button title="Залгах" variant="success" onPress={() => Linking.openURL(`tel:${selected.phone}`)} />
                  ) : null}
                  {selected.latitude != null && selected.longitude != null ? (
                    <Button title="Google Maps-аар харах" onPress={() => openMaps(selected)} />
                  ) : null}
                  <View style={styles.statusBtns}>
                    <Button
                      title="Явж байгаа"
                      variant="ghost"
                      style={{ flex: 1 }}
                      onPress={() => changeStatus(selected.id, 'Явж байгаа')}
                    />
                    <Button
                      title="Дууссан"
                      variant="success"
                      style={{ flex: 1 }}
                      onPress={() => changeStatus(selected.id, 'Дууссан')}
                    />
                  </View>
                  <Button title="Хаах" variant="ghost" onPress={() => setSelected(null)} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Detail({ label, value, styles }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, color, onPress }) {
  const styles = useStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.chip, active && (color ? { backgroundColor: color, borderColor: color } : styles.chipActive)]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterWrap: { paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  chipRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  list: { padding: spacing.md, gap: spacing.md },
  callCard: { marginBottom: 0 },
  cardTop: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  customer: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: spacing.sm },
  problem: { color: colors.textMuted, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, alignItems: 'center' },
  metaLabel: { color: colors.textFaint, fontSize: 13 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  addr: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.md },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  detailLabel: { color: colors.textFaint, fontSize: 14, width: 72 },
  detailValue: { color: colors.text, fontSize: 15, flex: 1, fontWeight: '600' },
  statusBtns: { flexDirection: 'row', gap: spacing.sm },
});
