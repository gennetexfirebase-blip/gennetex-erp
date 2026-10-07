import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Button, Card, EmptyState, Field, HeaderButton, ScreenHeader } from '../components/ui';
import * as trainingApi from '../services/employeeTrainingService';
import { radius, spacing } from '../theme';

const EMPTY = { trainingName: '', dueDate: '', note: '' };

function validDate(value) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function trainingState(rows) {
  const completed = rows.filter((row) => row.status === trainingApi.TRAINING_STATUS.COMPLETED).length;
  const required = rows.length - completed;
  return { completed, required, complete: rows.length > 0 && required === 0 };
}

export default function EmployeeTrainingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile, isManager, isCloud, fetchEmployees } = useApp();
  const targetEmployee = route.params?.employee || null;
  const ownEmployee = useMemo(() => ({
    id: currentUser?.id || authProfile?.id || null,
    name: currentUser?.name || authProfile?.name || 'Миний сургалт',
    email: currentUser?.email || authProfile?.email || '',
  }), [authProfile?.email, authProfile?.id, authProfile?.name, currentUser?.email, currentUser?.id, currentUser?.name]);
  const employee = targetEmployee || ownEmployee;
  const overviewMode = isManager && !targetEmployee;
  const canManage = isManager && Boolean(targetEmployee);

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [overviewRows, setOverviewRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isCloud) {
      setLoading(false);
      return;
    }
    try {
      if (overviewMode) {
        const [employeeRows, trainingRows] = await Promise.all([
          fetchEmployees().catch(() => []),
          trainingApi.fetchTrainingOverview(),
        ]);
        setEmployees(employeeRows.filter((item) => item.active !== false));
        setOverviewRows(trainingRows);
      } else if (employee.email) {
        setRows(await trainingApi.fetchEmployeeTrainings(employee.email));
      }
    } catch (error) {
      Alert.alert('Авсан сургалт', error?.message || 'Сургалтын мэдээлэл татагдсангүй.');
    } finally {
      setLoading(false);
    }
  }, [employee.email, fetchEmployees, isCloud, overviewMode]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const add = async () => {
    if (!form.trainingName.trim()) return Alert.alert('Сургалт', 'Сургалтын нэрийг оруулна уу.');
    if (!validDate(form.dueDate.trim())) return Alert.alert('Сургалт', 'Хугацааг YYYY-MM-DD хэлбэрээр оруулна уу.');
    setSaving(true);
    try {
      await trainingApi.addEmployeeTraining({
        employee,
        trainingName: form.trainingName,
        dueDate: form.dueDate.trim() || null,
        note: form.note,
        assignedBy: currentUser?.id,
      });
      setModal(false);
      setForm(EMPTY);
      await load();
    } catch (error) {
      Alert.alert('Сургалт нэмэгдсэнгүй', error?.message || 'Дахин оролдоно уу.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row) => {
    if (!canManage) return;
    try {
      await trainingApi.setEmployeeTrainingCompleted(
        row.id,
        row.status !== trainingApi.TRAINING_STATUS.COMPLETED
      );
      await load();
    } catch (error) {
      Alert.alert('Сургалт', error?.message || 'Төлөв шинэчлэгдсэнгүй.');
    }
  };

  const remove = (row) => {
    if (!canManage) return;
    Alert.alert('Сургалт хасах уу?', row.training_name, [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Хасах',
        style: 'destructive',
        onPress: async () => {
          try {
            await trainingApi.deleteEmployeeTraining(row.id);
            await load();
          } catch (error) {
            Alert.alert('Сургалт', error?.message || 'Бүртгэлийг хассангүй.');
          }
        },
      },
    ]);
  };

  const trainingsByEmail = useMemo(() => {
    const grouped = new Map();
    overviewRows.forEach((row) => {
      const email = normalizeEmail(row.employee_email);
      if (!grouped.has(email)) grouped.set(email, []);
      grouped.get(email).push(row);
    });
    return grouped;
  }, [overviewRows]);

  if (overviewMode) {
    const completedPeople = employees.filter((item) => trainingState(trainingsByEmail.get(normalizeEmail(item.email)) || []).complete).length;
    return (
      <View style={styles.container}>
        <ScreenHeader title="Авсан сургалт" subtitle="Ажилтнуудын сургалтын нэгдсэн төлөв" />
        <View style={styles.summary}>
          <View style={styles.summaryBlock}>
            <Text style={[styles.summaryNumber, { color: colors.success }]}>{completedPeople}</Text>
            <Text style={styles.summaryLabel}>Бүрэн хамрагдсан</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryBlock}>
            <Text style={[styles.summaryNumber, { color: colors.danger }]}>{Math.max(0, employees.length - completedPeople)}</Text>
            <Text style={styles.summaryLabel}>Хамрагдаагүй</Text>
          </View>
        </View>
        <FlatList
          data={employees}
          keyExtractor={(item) => String(item.id || item.email)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const employeeRows = trainingsByEmail.get(normalizeEmail(item.email)) || [];
            const state = trainingState(employeeRows);
            const tone = state.complete ? colors.success : colors.danger;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.push('EmployeeTraining', { employee: item })}
                accessibilityRole="button"
                accessibilityLabel={`${item.name || item.email} сургалтын дэлгэрэнгүй`}
              >
                <Card style={[styles.personRow, { borderColor: tone + '66' }]}>
                  <View style={[styles.personDot, { backgroundColor: tone }]} />
                  <View style={styles.personBody}>
                    <Text style={[styles.personName, { color: tone }]}>{item.name || item.email}</Text>
                    <Text style={styles.personMeta}>
                      {state.complete
                        ? `${state.completed} сургалтад хамрагдсан`
                        : state.required > 0
                          ? `${state.required} сургалтад хамрагдаагүй · ${state.completed} хамрагдсан`
                          : 'Сургалт бүртгэгдээгүй'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Card>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<EmptyState text={loading ? 'Сургалтын мэдээлэл ачаалж байна.' : 'Ажилтан олдсонгүй.'} />}
        />
      </View>
    );
  }

  const state = trainingState(rows);
  return (
    <View style={styles.container}>
      <ScreenHeader
        title={targetEmployee ? 'Сургалтын дэлгэрэнгүй' : 'Авсан сургалт'}
        subtitle={employee.name || employee.email || 'Ажилтан'}
        right={canManage ? <HeaderButton title="Сургалт нэмэх" onPress={() => setModal(true)} /> : null}
      />
      <View style={styles.summary}>
        <View style={styles.summaryBlock}>
          <Text style={[styles.summaryNumber, { color: colors.danger }]}>{state.required}</Text>
          <Text style={styles.summaryLabel}>Хамрагдах</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryBlock}>
          <Text style={[styles.summaryNumber, { color: colors.success }]}>{state.completed}</Text>
          <Text style={styles.summaryLabel}>Хамрагдсан</Text>
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const done = item.status === trainingApi.TRAINING_STATUS.COMPLETED;
          const overdue = !done && item.due_date && new Date(`${item.due_date}T23:59:59`) < new Date();
          const statusColor = done ? colors.success : colors.danger;
          return (
            <Card style={[styles.row, { borderColor: statusColor + '66' }]}>
              <TouchableOpacity
                style={[styles.check, { borderColor: statusColor }, done && styles.checkDone]}
                onPress={() => void toggle(item)}
                disabled={!canManage}
                accessibilityRole={canManage ? 'checkbox' : 'image'}
                accessibilityState={canManage ? { checked: done, disabled: false } : undefined}
              >
                {done ? <Ionicons name="checkmark" size={18} color="#fff" /> : <Ionicons name="close" size={17} color={colors.danger} />}
              </TouchableOpacity>
              <View style={styles.personBody}>
                <Text style={[styles.name, { color: statusColor }]}>{item.training_name}</Text>
                <Text style={[styles.status, { color: overdue || !done ? colors.danger : colors.success }]}>
                  {done
                    ? `Хамрагдсан${item.completed_at ? ` · ${new Date(item.completed_at).toLocaleDateString('mn-MN')}` : ''}`
                    : item.due_date
                      ? `${overdue ? 'Хугацаа хэтэрсэн' : 'Хамрагдах хугацаа'} · ${item.due_date}`
                      : 'Хамрагдаагүй'}
                </Text>
                {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              </View>
              {canManage ? (
                <TouchableOpacity onPress={() => remove(item)} hitSlop={10} accessibilityLabel="Сургалт хасах">
                  <Ionicons name="trash-outline" size={19} color={colors.danger} />
                </TouchableOpacity>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={<EmptyState text={loading ? 'Сургалтын мэдээлэл ачаалж байна.' : 'Сургалт бүртгэгдээгүй байна.'} />}
      />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Заавал суух сургалт нэмэх</Text>
              <Text style={styles.employee}>{employee.name || employee.email}</Text>
              <Field
                label="Сургалтын нэр *"
                placeholder="Ж: ХАБЭА-н анхан шатны сургалт"
                value={form.trainingName}
                onChangeText={(trainingName) => setForm((current) => ({ ...current, trainingName }))}
              />
              <Field
                label="Хамрагдах хугацаа"
                placeholder="YYYY-MM-DD"
                value={form.dueDate}
                onChangeText={(dueDate) => setForm((current) => ({ ...current, dueDate }))}
              />
              <Field
                label="Тэмдэглэл"
                value={form.note}
                onChangeText={(note) => setForm((current) => ({ ...current, note }))}
                multiline
              />
              <View style={styles.actions}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setModal(false)} />
                <Button title="Нэмэх" style={{ flex: 1 }} onPress={add} loading={saving} disabled={saving} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  summary: { flexDirection: 'row', margin: spacing.lg, marginBottom: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  summaryBlock: { flex: 1, alignItems: 'center', padding: spacing.md },
  summaryNumber: { fontSize: 23, fontWeight: '900' },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  divider: { width: 1, backgroundColor: colors.border },
  list: { padding: spacing.lg, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, marginBottom: spacing.sm },
  personDot: { width: 12, height: 12, borderRadius: 6 },
  personBody: { flex: 1, minWidth: 0 },
  personName: { fontSize: 15, fontWeight: '900' },
  personMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkDone: { borderColor: colors.success, backgroundColor: colors.success },
  name: { fontSize: 15, fontWeight: '800' },
  status: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  note: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000bb' },
  sheet: { maxHeight: '90%', padding: spacing.xl, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: colors.borderHi, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  employee: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
});
