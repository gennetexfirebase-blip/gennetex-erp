import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  SegmentTabs,
  LoadingState,
  formatMNT,
} from '../components/ui';
import * as payrollApi from '../services/payrollService';
import { spacing, radius, type } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const TABS = [
  { key: 'rates', label: 'Цалин тогтоох' },
  { key: 'hours', label: 'Цаг бүртгэх' },
  { key: 'requests', label: 'Хүсэлт' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function PayrollAdminScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, authProfile, fetchEmployees } = useApp();

  const [tab, setTab] = useState('rates');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [rates, setRates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [range] = useState(() => payrollApi.monthRange());
  const [summaries, setSummaries] = useState({});

  // Цалин тогтоох цонх
  const [rateModal, setRateModal] = useState(null); // { id, name }
  const [rateForm, setRateForm] = useState({ dailyRate: '', multiplier: '1.5', standardHours: '8' });
  const [savingRate, setSavingRate] = useState(false);

  // Цаг бичих цонх
  const [hoursModal, setHoursModal] = useState(null);
  const [hoursForm, setHoursForm] = useState({ workDate: today(), regular: '8', overtime: '0', note: '' });
  const [savingHours, setSavingHours] = useState(false);

  const load = useCallback(async () => {
    if (!isCloud || !isAdmin) return;
    try {
      const [emps, rateRows, reqRows] = await Promise.all([
        fetchEmployees().catch(() => []),
        payrollApi.fetchAllCurrentRates().catch(() => []),
        payrollApi.fetchOvertimeRequests().catch(() => []),
      ]);
      setEmployees(emps || []);
      setRates(rateRows || []);
      setRequests(reqRows || []);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoading(false);
    }
  }, [isCloud, isAdmin, fetchEmployees]);

  useEffect(() => {
    load();
    if (!isCloud || !isAdmin) return;
    return payrollApi.subscribeOvertimeRequests(load);
  }, [load, isCloud, isAdmin]);

  // Энэ сарын нэгтгэлийг ажилтан тус бүрээр
  useEffect(() => {
    if (!employees.length) return;
    let active = true;
    (async () => {
      const out = {};
      for (const e of employees) {
        try {
          out[e.id] = await payrollApi.fetchSummary({
            userId: e.id,
            from: range.from,
            to: range.to,
          });
        } catch (err) {}
      }
      if (active) setSummaries(out);
    })();
    return () => {
      active = false;
    };
  }, [employees, range.from, range.to]);

  const rateByUser = useMemo(() => {
    const m = {};
    for (const r of rates) m[r.user_id] = r;
    return m;
  }, [rates]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // --- Цалин тогтоох ---
  const openRate = (emp) => {
    const cur = rateByUser[emp.id];
    setRateForm({
      dailyRate: cur ? String(cur.daily_rate) : '',
      multiplier: cur ? String(cur.overtime_multiplier) : '1.5',
      standardHours: cur ? String(cur.standard_hours) : '8',
    });
    setRateModal(emp);
  };

  const saveRate = async () => {
    setSavingRate(true);
    try {
      await payrollApi.setRate({
        userId: rateModal.id,
        userName: rateModal.name,
        dailyRate: rateForm.dailyRate,
        overtimeMultiplier: rateForm.multiplier,
        standardHours: rateForm.standardHours,
        createdBy: authProfile?.id,
        createdByName: authProfile?.name,
      });
      setRateModal(null);
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSavingRate(false);
    }
  };

  // --- Цаг бичих ---
  const openHours = (emp) => {
    setHoursForm({ workDate: today(), regular: '8', overtime: '0', note: '' });
    setHoursModal(emp);
  };

  const saveHours = async () => {
    setSavingHours(true);
    try {
      await payrollApi.upsertHours({
        userId: hoursModal.id,
        userName: hoursModal.name,
        workDate: hoursForm.workDate,
        regularHours: hoursForm.regular,
        overtimeHours: hoursForm.overtime,
        note: hoursForm.note,
        createdBy: authProfile?.id,
        createdByName: authProfile?.name,
      });
      setHoursModal(null);
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSavingHours(false);
    }
  };

  // --- Хүсэлт шийдэх ---
  const decide = (req, approve) => {
    Alert.alert(
      approve ? 'Илүү цаг зөвшөөрөх' : 'Татгалзах',
      `${req.user_name || 'Ажилтан'} · ${req.date_from} · ${req.hours} цаг\n\n${req.reason || ''}`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: approve ? 'Зөвшөөрөх' : 'Татгалзах',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await payrollApi.reviewOvertime({
                requestId: req.id,
                approve,
                reviewerId: authProfile?.id,
                reviewerName: authProfile?.name,
              });
              await load();
            } catch (e) {
              Alert.alert('Алдаа', e.message);
            }
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Цалин" />
        <EmptyState text="Энэ хэсэг зөвхөн админд нээлттэй." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Цалин"
        subtitle={`${range.from} — ${range.to}`}
      />
      <SegmentTabs
        tabs={TABS.map((t) =>
          t.key === 'requests' && pendingCount
            ? { ...t, label: `${t.label} (${pendingCount})` }
            : t
        )}
        value={tab}
        onChange={setTab}
      />

      {loading ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {tab === 'rates' ? (
            <>
              <GroupLabel>Ажилтны өдрийн цалин</GroupLabel>
              {employees.length === 0 ? (
                <EmptyState text="Ажилтан олдсонгүй." />
              ) : (
                <ListGroup>
                  {employees.map((e) => {
                    const r = rateByUser[e.id];
                    return (
                      <ListRow
                        key={e.id}
                        label={e.name || e.email}
                        value={r ? `${formatMNT(r.daily_rate)} / өдөр` : 'Тогтоогоогүй'}
                        onPress={() => openRate(e)}
                      />
                    );
                  })}
                </ListGroup>
              )}
            </>
          ) : null}

          {tab === 'hours' ? (
            <>
              <GroupLabel>Энэ сарын нэгтгэл</GroupLabel>
              {employees.length === 0 ? (
                <EmptyState text="Ажилтан олдсонгүй." />
              ) : (
                employees.map((e) => {
                  const s = summaries[e.id];
                  return (
                    <View key={e.id} style={styles.payCard}>
                      <View style={styles.payHead}>
                        <Text style={styles.payName} numberOfLines={1}>
                          {e.name || e.email}
                        </Text>
                        <Text style={styles.payTotal}>{formatMNT(s?.total_pay || 0)}</Text>
                      </View>
                      <View style={styles.payMeta}>
                        <Text style={styles.payMetaText}>
                          {s?.days_worked || 0} өдөр · үндсэн {Number(s?.regular_hours || 0)}ц
                          {Number(s?.overtime_hours) ? ` · илүү ${Number(s.overtime_hours)}ц` : ''}
                        </Text>
                      </View>
                      <Button
                        title="Цаг бүртгэх"
                        variant="ghost"
                        size="sm"
                        onPress={() => openHours(e)}
                        style={{ marginTop: spacing.md }}
                      />
                    </View>
                  );
                })
              )}
            </>
          ) : null}

          {tab === 'requests' ? (
            <>
              <GroupLabel>Илүү цагийн хүсэлт</GroupLabel>
              {requests.length === 0 ? (
                <EmptyState text="Хүсэлт ирээгүй байна." />
              ) : (
                requests.map((r) => (
                  <View key={r.id} style={styles.reqCard}>
                    <View style={styles.reqHead}>
                      <Text style={styles.reqName} numberOfLines={1}>
                        {r.user_name || 'Ажилтан'}
                      </Text>
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
                    </View>
                    <Text style={styles.reqHours}>
                      {r.date_from} · {r.hours} цаг
                    </Text>
                    {r.reason ? <Text style={styles.reqReason}>{r.reason}</Text> : null}
                    {r.status === 'pending' ? (
                      <View style={styles.reqActions}>
                        <Button
                          title="Татгалзах"
                          variant="ghost"
                          size="sm"
                          style={{ flex: 1 }}
                          onPress={() => decide(r, false)}
                        />
                        <Button
                          title="Зөвшөөрөх"
                          size="sm"
                          style={{ flex: 1 }}
                          onPress={() => decide(r, true)}
                        />
                      </View>
                    ) : r.reviewed_by_name ? (
                      <Text style={styles.reqBy}>{r.reviewed_by_name} шийдвэрлэсэн</Text>
                    ) : null}
                  </View>
                ))
              )}
            </>
          ) : null}
        </ScrollView>
      )}

      {/* --- Цалин тогтоох --- */}
      <Modal visible={!!rateModal} transparent animationType="slide" onRequestClose={() => setRateModal(null)}>
        <View style={styles.shade}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Өдрийн цалин</Text>
            <Text style={styles.sheetSub}>{rateModal?.name || rateModal?.email}</Text>
            <Field
              label="Өдрийн цалин (₮)"
              keyboardType="numeric"
              placeholder="Ж: 80000"
              value={rateForm.dailyRate}
              onChangeText={(t) => setRateForm({ ...rateForm, dailyRate: t })}
            />
            <Field
              label="Өдрийн жишиг цаг"
              keyboardType="numeric"
              hint="Хэдэн цаг ажиллавал бүтэн өдөр гэж тооцох вэ"
              value={rateForm.standardHours}
              onChangeText={(t) => setRateForm({ ...rateForm, standardHours: t })}
            />
            <Field
              label="Илүү цагийн коэффициент"
              keyboardType="numeric"
              hint="1.5 = илүү цаг 1.5 дахин"
              value={rateForm.multiplier}
              onChangeText={(t) => setRateForm({ ...rateForm, multiplier: t })}
            />
            <Text style={styles.hintBox}>
              Хуучин цалинг дарж бичихгүй — шинэ мөр нэмнэ. Өнгөрсөн сарын
              тайлан тухайн үеийн цалингаараа тооцогдсон хэвээр үлдэнэ.
            </Text>
            <View style={styles.sheetActions}>
              <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setRateModal(null)} />
              <Button title="Хадгалах" style={{ flex: 1 }} onPress={saveRate} loading={savingRate} disabled={savingRate} />
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Цаг бүртгэх --- */}
      <Modal visible={!!hoursModal} transparent animationType="slide" onRequestClose={() => setHoursModal(null)}>
        <View style={styles.shade}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Ажилласан цаг</Text>
            <Text style={styles.sheetSub}>{hoursModal?.name || hoursModal?.email}</Text>
            <Field
              label="Огноо"
              placeholder="ЖЖЖЖ-СС-ӨӨ"
              value={hoursForm.workDate}
              onChangeText={(t) => setHoursForm({ ...hoursForm, workDate: t })}
            />
            <Field
              label="Үндсэн цаг"
              keyboardType="numeric"
              value={hoursForm.regular}
              onChangeText={(t) => setHoursForm({ ...hoursForm, regular: t })}
            />
            <Field
              label="Илүү цаг"
              keyboardType="numeric"
              value={hoursForm.overtime}
              onChangeText={(t) => setHoursForm({ ...hoursForm, overtime: t })}
            />
            <Field
              label="Тэмдэглэл"
              placeholder="Заавал биш"
              value={hoursForm.note}
              onChangeText={(t) => setHoursForm({ ...hoursForm, note: t })}
            />
            <View style={styles.sheetActions}>
              <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setHoursModal(null)} />
              <Button title="Хадгалах" style={{ flex: 1 }} onPress={saveHours} loading={savingHours} disabled={savingHours} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: 120 },

  payCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  payHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  payName: { ...type.bodyStrong, color: colors.text, flex: 1, minWidth: 0 },
  payTotal: { ...type.h3, color: colors.primary },
  payMeta: { marginTop: 4 },
  payMetaText: { ...type.caption, color: colors.textMuted },

  reqCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  reqName: { ...type.bodyStrong, color: colors.text, flex: 1, minWidth: 0 },
  reqHours: { ...type.body, color: colors.text, marginTop: 6, fontWeight: '700' },
  reqReason: { ...type.caption, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  reqBy: { ...type.caption, color: colors.textFaint, marginTop: spacing.sm },
  reqActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },

  shade: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.lg,
  },
  sheetTitle: { ...type.h2, color: colors.text },
  sheetSub: { ...type.caption, color: colors.textMuted, marginBottom: spacing.lg },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  hintBox: {
    ...type.caption,
    color: colors.textFaint,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.md,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
});
