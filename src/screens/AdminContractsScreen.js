import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, RefreshControl, Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Card, Button, Field, Badge, EmptyState, SectionTitle } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as contractApi from '../services/contractService';

export default function AdminContractsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile, fetchEmployees } = useApp();

  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [emp, setEmp] = useState(null);
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [terms, setTerms] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, emps] = await Promise.all([
        contractApi.fetchContracts(),
        fetchEmployees().catch(() => []),
      ]);
      setRows(list);
      setEmployees((emps || []).filter((e) => e.id && (e.name || e.email)));
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, [fetchEmployees]);

  useEffect(() => {
    load();
    const unsub = contractApi.subscribeContracts(load);
    return unsub;
  }, [load]);

  const resetForm = () => {
    setEmp(null);
    setPosition('');
    setSalary('');
    setStartDate('');
    setEndDate('');
    setTerms('');
  };

  const submit = async () => {
    if (!emp) {
      Alert.alert('Анхаар', 'Ажилтан сонгоно уу.');
      return;
    }
    setSaving(true);
    try {
      await contractApi.createContract({
        employeeId: emp.id,
        employeeName: emp.name || emp.email,
        createdBy: authProfile?.id,
        createdByName: authProfile?.name,
        position,
        salary,
        startDate,
        endDate,
        terms,
      });
      resetForm();
      setShowForm(false);
      load();
      Alert.alert('Амжилттай', 'Гэрээ үүслээ. Ажилтанд мэдэгдэл илгээгдлээ.');
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Хадгалж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Хөдөлмөрийн гэрээ"
        subtitle={`Нийт ${rows.length}`}
        right={
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>
            <Text style={styles.addBtnText}>{showForm ? 'Хаах' : '+ Шинэ'}</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        {showForm ? (
          <Card>
            <SectionTitle>Шинэ гэрээ үүсгэх</SectionTitle>
            <Text style={styles.hint}>Ажилтан сонгоно уу:</Text>
            <View style={styles.empList}>
              {employees.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.empChip, emp?.id === e.id && styles.empChipActive]}
                  onPress={() => setEmp(e)}
                >
                  <Text style={[styles.empChipText, emp?.id === e.id && styles.empChipTextActive]}>
                    {e.name || e.email}
                  </Text>
                </TouchableOpacity>
              ))}
              {employees.length === 0 ? <Text style={styles.hint}>Ажилтан алга</Text> : null}
            </View>
            <Field label="Албан тушаал" value={position} onChangeText={setPosition} placeholder="Инженер" />
            <Field label="Цалин (₮)" value={salary} onChangeText={setSalary} keyboardType="numeric" placeholder="2500000" />
            <Field label="Эхлэх огноо" value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" />
            <Field label="Дуусах огноо (заавал биш)" value={endDate} onChangeText={setEndDate} placeholder="2027-01-01" />
            <Field
              label="Гэрээний нөхцөл"
              value={terms}
              onChangeText={setTerms}
              placeholder="Ажлын цаг, үүрэг, хариуцлага..."
              multiline
              inputStyle={{ height: 120, textAlignVertical: 'top' }}
            />
            <Button title={saving ? 'Хадгалж байна...' : 'Гэрээ үүсгэх'} onPress={submit} disabled={saving} />
          </Card>
        ) : null}

        {rows.length === 0 && !loading ? (
          <EmptyState text="Одоогоор гэрээ үүсгээгүй байна." />
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>{r.employee_name || '—'}</Text>
                <Badge
                  text={contractApi.contractStatusLabel(r.status)}
                  color={r.status === 'signed' ? '#16a34a' : '#d97706'}
                />
              </View>
              {r.position ? <Text style={styles.pos}>{r.position}</Text> : null}
              {r.salary != null ? <Text style={styles.salary}>{contractApi.formatMnt(r.salary)}</Text> : null}
              <Text style={styles.date}>
                Үүсгэсэн: {r.created_by_name || '—'} · {new Date(r.created_at).toLocaleDateString('mn-MN')}
              </Text>
              {r.signed_at ? (
                <Text style={styles.signed}>
                  ✓ Гарын үсэг зурсан: {new Date(r.signed_at).toLocaleString('mn-MN')}
                </Text>
              ) : null}
              {r.pdf_url ? (
                <TouchableOpacity onPress={() => Linking.openURL(r.pdf_url)}>
                  <Text style={styles.link}>Гэрээ (PDF) нээх</Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: 40 },
  addBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  empList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  empChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  empChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  empChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  empChipTextActive: { color: colors.primary },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  pos: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  salary: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  signed: { color: colors.success, fontSize: 12, fontWeight: '600', marginTop: 4 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 8 },
});
