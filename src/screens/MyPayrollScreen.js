import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl, Modal } from 'react-native';
import { useApp } from '../context/AppContext';
import {
  ScreenHeader,
  Button,
  Field,
  EmptyState,
  GroupLabel,
  ListGroup,
  ListRow,
  StatusPill,
  LoadingState,
  formatMNT,
} from '../components/ui';
import * as payrollApi from '../services/payrollService';
import { spacing, radius, type } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const today = () => new Date().toISOString().slice(0, 10);

export default function MyPayrollScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile, isCloud } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rate, setRate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hours, setHours] = useState([]);
  const [requests, setRequests] = useState([]);
  const [range] = useState(() => payrollApi.monthRange());

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ workDate: today(), hours: '', reason: '' });
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud || !authProfile?.id) {
      setLoading(false);
      return;
    }
    try {
      const [r, s, h, req] = await Promise.all([
        payrollApi.fetchCurrentRate(authProfile.id).catch(() => null),
        payrollApi.fetchSummary({ userId: authProfile.id, from: range.from, to: range.to }).catch(() => null),
        payrollApi.fetchHours({ userId: authProfile.id, from: range.from, to: range.to }).catch(() => []),
        payrollApi.fetchOvertimeRequests({ userId: authProfile.id }).catch(() => []),
      ]);
      setRate(r);
      setSummary(s);
      setHours(h || []);
      setRequests(req || []);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  }, [isCloud, authProfile?.id, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const send = async () => {
    setSending(true);
    try {
      await payrollApi.requestOvertime({
        userId: authProfile.id,
        userName: authProfile.name,
        workDate: form.workDate,
        hours: form.hours,
        reason: form.reason,
      });
      setModal(false);
      setForm({ workDate: today(), hours: '', reason: '' });
      await load();
      Alert.alert('Илгээгдлээ', 'Илүү цагийн хүсэлт админд очлоо.');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Миний цалин" />
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Миний цалин" subtitle={`${range.from} — ${range.to}`} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Энэ сарын нийлбэр */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Энэ сард</Text>
          <Text style={styles.totalValue}>{formatMNT(summary?.total_pay || 0)}</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalCol}>
              <Text style={styles.colValue}>{summary?.days_worked || 0}</Text>
              <Text style={styles.colLabel}>өдөр</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.colValue}>{Number(summary?.regular_hours || 0)}</Text>
              <Text style={styles.colLabel}>үндсэн цаг</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.colValue}>{Number(summary?.overtime_hours || 0)}</Text>
              <Text style={styles.colLabel}>илүү цаг</Text>
            </View>
          </View>
        </View>

        {/* Задаргаа */}
        {rate ? (
          <>
            <GroupLabel>Тооцоо</GroupLabel>
            <ListGroup>
              <ListRow label="Өдрийн цалин" value={formatMNT(rate.daily_rate)} chevron={false} />
              <ListRow label="Өдрийн жишиг цаг" value={`${rate.standard_hours} цаг`} chevron={false} />
              <ListRow label="Илүү цагийн коэффициент" value={`×${rate.overtime_multiplier}`} chevron={false} />
              <ListRow label="Үндсэн цалин" value={formatMNT(summary?.regular_pay || 0)} chevron={false} />
              <ListRow label="Илүү цагийн цалин" value={formatMNT(summary?.overtime_pay || 0)} chevron={false} />
            </ListGroup>
          </>
        ) : (
          <View style={styles.noRate}>
            <Text style={styles.noRateText}>
              Танд өдрийн цалин хараахан тогтоогоогүй байна. Админд хандана уу.
            </Text>
          </View>
        )}

        {/* Илүү цагийн хүсэлт */}
        <GroupLabel>Илүү цагийн хүсэлт</GroupLabel>
        <Button title="Шинэ хүсэлт илгээх" onPress={() => setModal(true)} />

        {requests.length ? (
          <View style={{ marginTop: spacing.md }}>
            <ListGroup>
              {requests.slice(0, 20).map((r) => (
                <ListRow
                  key={r.id}
                  label={`${r.date_from} · ${r.hours} цаг`}
                  chevron={false}
                  right={
                    <StatusPill
                      text={
                        r.status === 'approved'
                          ? 'Зөвшөөрсөн'
                          : r.status === 'rejected'
                            ? 'Татгалзсан'
                            : 'Хүлээгдэж буй'
                      }
                      tone={
                        r.status === 'approved'
                          ? 'success'
                          : r.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  }
                />
              ))}
            </ListGroup>
          </View>
        ) : null}

        {/* Өдрийн бичилтүүд */}
        <GroupLabel>Ажилласан өдрүүд</GroupLabel>
        {hours.length === 0 ? (
          <EmptyState text="Энэ сард бичилт алга." />
        ) : (
          <ListGroup>
            {hours.map((h) => (
              <ListRow
                key={h.id}
                label={h.work_date}
                value={
                  Number(h.overtime_hours)
                    ? `${h.regular_hours}ц + ${h.overtime_hours}ц илүү`
                    : `${h.regular_hours}ц`
                }
                chevron={false}
              />
            ))}
          </ListGroup>
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.shade}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Илүү цагийн хүсэлт</Text>
            <Field
              label="Огноо"
              placeholder="ЖЖЖЖ-СС-ӨӨ"
              value={form.workDate}
              onChangeText={(t) => setForm({ ...form, workDate: t })}
            />
            <Field
              label="Хэдэн цаг"
              keyboardType="numeric"
              placeholder="Ж: 3"
              required
              value={form.hours}
              onChangeText={(t) => setForm({ ...form, hours: t })}
            />
            <Field
              label="Шалтгаан"
              placeholder="Ямар ажил хийсэн бэ"
              required
              multiline
              numberOfLines={3}
              inputStyle={{ minHeight: 76, textAlignVertical: 'top' }}
              value={form.reason}
              onChangeText={(t) => setForm({ ...form, reason: t })}
            />
            <View style={styles.sheetActions}>
              <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setModal(false)} />
              <Button title="Илгээх" style={{ flex: 1 }} onPress={send} loading={sending} disabled={sending} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors, shadow, gradients }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: 120 },

  totalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.sm,
  },
  totalLabel: { ...type.caption, color: colors.textMuted },
  totalValue: { ...type.display, color: colors.primary, marginTop: 4 },
  totalRow: { flexDirection: 'row', marginTop: spacing.lg, alignSelf: 'stretch' },
  totalCol: { flex: 1, alignItems: 'center' },
  colValue: { ...type.h3, color: colors.text },
  colLabel: { ...type.caption, color: colors.textFaint, marginTop: 2 },

  noRate: {
    backgroundColor: colors.warning + '14',
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  noRateText: { ...type.caption, color: colors.warning, lineHeight: 18 },

  shade: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.lg,
  },
  sheetTitle: { ...type.h2, color: colors.text, marginBottom: spacing.lg },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
