import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Button, Field, ScreenHeader } from '../components/ui';
import { Avatar, Box, Chip, EmptyBlock, PillButton, Segmented, StatGrid } from '../components/ds';
import { CertificateView, certificateName, shareCertificatePdf } from '../components/TrainingCertificate';
import { requestLibraryAccess } from '../lib/mediaLibraryAccess';
import * as trainingApi from '../services/employeeTrainingService';

const EMPTY = { trainingName: '', dueDate: '', note: '' };
const DONE = trainingApi.TRAINING_STATUS.COMPLETED;

function validDate(value) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function trainingState(rows) {
  const completed = rows.filter((row) => row.status === DONE).length;
  const required = rows.length - completed;
  return { completed, required, complete: rows.length > 0 && required === 0 };
}

const fullName = (p) => [p?.last_name, p?.name].filter(Boolean).join(' ') || p?.email || 'Ажилтан';

/**
 * Авсан сургалт — УДИРДЛАГЫН хэсэг (ажилтны цэснээс шилжүүлсэн).
 *
 *   Тойм: ажилтан бүрийн хамрагдалт. Нэр дээр дарвал тухайн хүний суусан
 *   сургалт, бүх сертификат.
 *   Сертификат: сургалт өөрөө олгосон бол админ зургийг нь оруулна; эс бөгөөс
 *   хамрагдсан сургалтад апп Женнетексийн загвараар (тамга, Захирлын нэр)
 *   сертификат үүсгэнэ.
 */
export default function EmployeeTrainingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const { currentUser, authProfile, isManager, isCloud, fetchEmployees } = useApp();
  const targetEmployee = route.params?.employee || null;
  const ownEmployee = useMemo(
    () => ({
      id: currentUser?.id || authProfile?.id || null,
      name: authProfile?.name || currentUser?.name || '',
      last_name: authProfile?.last_name || '',
      email: currentUser?.email || authProfile?.email || '',
    }),
    [authProfile?.email, authProfile?.id, authProfile?.name, authProfile?.last_name, currentUser?.email, currentUser?.id, currentUser?.name]
  );
  const employee = targetEmployee || ownEmployee;
  const overviewMode = isManager && !targetEmployee;
  const canManage = isManager && Boolean(targetEmployee);

  const [rows, setRows] = useState([]);
  const [certUrls, setCertUrls] = useState({});
  const [employees, setEmployees] = useState([]);
  const [overviewRows, setOverviewRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(route.params?.tab || 'trainings');
  const [viewer, setViewer] = useState(null); // { row, url } | { row, generated: true }
  const [sharing, setSharing] = useState(false);
  const [query, setQuery] = useState('');

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
        const list = await trainingApi.fetchEmployeeTrainings(employee.email);
        setRows(list);
        setCertUrls(await trainingApi.certificateUrls(list).catch(() => ({})));
      }
    } catch (error) {
      Alert.alert('Авсан сургалт', error?.message || 'Сургалтын мэдээлэл татагдсангүй.');
    } finally {
      setLoading(false);
    }
  }, [employee.email, fetchEmployees, isCloud, overviewMode]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

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
      await trainingApi.setEmployeeTrainingCompleted(row.id, row.status !== DONE);
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
            if (row.certificate_path) await trainingApi.removeCertificate(row).catch(() => null);
            await trainingApi.deleteEmployeeTraining(row.id);
            await load();
          } catch (error) {
            Alert.alert('Сургалт', error?.message || 'Бүртгэлийг хассангүй.');
          }
        },
      },
    ]);
  };

  /** Сургалтын олгосон сертификатын зургийг оруулна (камер эсвэл сан). */
  const pickCertificate = (row) => {
    const run = async (fromCamera) => {
      try {
        const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await requestLibraryAccess();
        if (!perm.granted) return Alert.alert('Зөвшөөрөл', fromCamera ? 'Камерт хандах зөвшөөрөл өгнө үү.' : 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
        const res = fromCamera
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (res.canceled) return;
        setBusyId(row.id);
        await trainingApi.uploadCertificate(row, res.assets[0].uri);
        await load();
      } catch (error) {
        Alert.alert('Сертификат', error?.message || 'Зураг оруулж чадсангүй.');
      } finally {
        setBusyId(null);
      }
    };
    Alert.alert('Сертификат оруулах', `«${row.training_name}» сургалтын сертификатын зураг`, [
      { text: 'Камер', onPress: () => run(true) },
      { text: 'Зургийн сан', onPress: () => run(false) },
      { text: 'Болих', style: 'cancel' },
    ]);
  };

  const dropCertificate = (row) =>
    Alert.alert('Сертификат хасах уу?', 'Оруулсан зургийг устгана. Хамрагдсан бол апп өөрөө сертификат үүсгэнэ.', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Хасах',
        style: 'destructive',
        onPress: async () => {
          try {
            await trainingApi.removeCertificate(row);
            setViewer(null);
            await load();
          } catch (error) {
            Alert.alert('Сертификат', error?.message || 'Хасаж чадсангүй.');
          }
        },
      },
    ]);

  const certData = (row) => ({ name: certificateName(employee), training: row.training_name, date: row.completed_at });

  const share = async (row) => {
    setSharing(true);
    try {
      await shareCertificatePdf(certData(row));
    } catch (error) {
      Alert.alert('Сертификат', error?.message || 'PDF үүсгэж чадсангүй.');
    } finally {
      setSharing(false);
    }
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

  // ---------------------------------------------------------------------
  // Тойм — ажилтны жагсаалт
  // ---------------------------------------------------------------------
  if (overviewMode) {
    const q = query.trim().toLowerCase();
    const list = employees.filter((p) => !q || `${fullName(p)} ${p.position || ''}`.toLowerCase().includes(q));
    const completedPeople = employees.filter((item) => trainingState(trainingsByEmail.get(normalizeEmail(item.email)) || []).complete).length;
    const certCount = overviewRows.filter((r) => r.status === DONE).length;
    return (
      <View style={styles.container}>
        <ScreenHeader title="Авсан сургалт" subtitle="Ажилтнуудын сургалт, сертификат" />
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id || item.email)}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />}
          ListHeaderComponent={
            <>
              <Box style={{ marginBottom: 12 }}>
                <StatGrid
                  size={22}
                  items={[
                    { label: 'Бүрэн хамрагдсан', value: String(completedPeople), color: colors.ok },
                    { label: 'Хамрагдаагүй', value: String(Math.max(0, employees.length - completedPeople)), color: colors.bad },
                    { label: 'Сертификат', value: String(certCount) },
                  ]}
                />
              </Box>
              <View style={styles.search}>
                <Ionicons name="search" size={19} color={colors.faint} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Ажилтан хайх…"
                  placeholderTextColor={colors.faint}
                  autoCorrect={false}
                />
              </View>
            </>
          }
          renderItem={({ item, index }) => {
            const employeeRows = trainingsByEmail.get(normalizeEmail(item.email)) || [];
            const state = trainingState(employeeRows);
            return (
              <Pressable
                onPress={() => navigation.push('EmployeeTraining', { employee: item })}
                style={({ pressed }) => [styles.person, index === 0 && styles.first, index === list.length - 1 && styles.last, pressed && { backgroundColor: colors.field }]}
                accessibilityRole="button"
                accessibilityLabel={`${fullName(item)} — суусан сургалт, сертификат`}
              >
                <Avatar uri={item.avatar_url} name={item.name || item.email} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.personName} numberOfLines={1}>{fullName(item)}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {employeeRows.length
                      ? `${state.completed} хамрагдсан${state.required ? ` · ${state.required} хүлээгдэж буй` : ''}`
                      : 'Сургалт бүртгэгдээгүй'}
                  </Text>
                </View>
                {employeeRows.length ? (
                  <Chip text={state.complete ? 'Бүрэн' : `${state.required} дутуу`} tone={state.complete ? 'ok' : 'bad'} />
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            loading ? null : <EmptyBlock ph="graduation-cap" title="Ажилтан олдсонгүй" text="Хайлтаа өөрчилж үзнэ үү." />
          }
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // Нэг ажилтан — суусан сургалт, бүх сертификат
  // ---------------------------------------------------------------------
  const state = trainingState(rows);
  const certRows = rows.filter((r) => r.status === DONE || r.certificate_path);
  const thumbW = Math.floor((width - 32 - 12) / 2);

  const renderTraining = (item) => {
    const done = item.status === DONE;
    const overdue = !done && item.due_date && new Date(`${item.due_date}T23:59:59`) < new Date();
    const url = certUrls[item.id];
    return (
      <Box key={item.id} pad style={{ marginBottom: 12 }}>
        <View style={styles.tRow}>
          <Pressable
            style={[styles.check, { borderColor: done ? colors.ok : colors.bad }, done && { backgroundColor: colors.ok }]}
            onPress={() => void toggle(item)}
            disabled={!canManage}
            hitSlop={6}
            accessibilityRole={canManage ? 'checkbox' : 'image'}
            accessibilityState={canManage ? { checked: done } : undefined}
            accessibilityLabel={done ? 'Хамрагдсан' : 'Хамрагдаагүй'}
          >
            <Ionicons name={done ? 'checkmark' : 'close'} size={17} color={done ? '#FFFFFF' : colors.bad} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tName}>{item.training_name}</Text>
            <Text style={[styles.tStatus, { color: done ? colors.ok : colors.bad }]}>
              {done
                ? `Хамрагдсан${item.completed_at ? ` · ${String(item.completed_at).slice(0, 10)}` : ''}`
                : item.due_date
                  ? `${overdue ? 'Хугацаа хэтэрсэн' : 'Хамрагдах хугацаа'} · ${item.due_date}`
                  : 'Хамрагдаагүй'}
            </Text>
            {item.note ? <Text style={styles.meta}>{item.note}</Text> : null}
          </View>
          {canManage ? (
            <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityLabel="Сургалт хасах">
              <Ionicons name="trash-outline" size={19} color={colors.bad} />
            </Pressable>
          ) : null}
        </View>

        {done || url ? (
          <View style={styles.certRow}>
            {url ? (
              <Pressable onPress={() => setViewer({ row: item, url })} style={styles.certThumbWrap} accessibilityLabel="Сертификат харах">
                <Image source={{ uri: url }} style={styles.certThumb} />
              </Pressable>
            ) : (
              <Pressable onPress={() => setViewer({ row: item, generated: true })} style={styles.certThumbWrap} accessibilityLabel="Сертификат харах">
                <CertificateView {...certData(item)} width={96} />
              </Pressable>
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={styles.certLabel}>{url ? 'Сургалтын сертификат' : 'Женнетексийн сертификат'}</Text>
              <Text style={styles.meta}>{url ? 'Сургалтаас олгосон, оруулсан зураг' : 'Сургалт сертификат олгоогүй тул автоматаар үүссэн'}</Text>
            </View>
          </View>
        ) : null}

        {canManage ? (
          <View style={styles.tActions}>
            {busyId === item.id ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <PillButton title={url ? 'Сертификат солих' : 'Сертификат оруулах'} icon="cloud-upload-outline" soft onPress={() => pickCertificate(item)} />
            )}
          </View>
        ) : null}
      </Box>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={fullName(employee)}
        subtitle={targetEmployee ? 'Суусан сургалт, сертификат' : 'Миний сургалт'}
        right={canManage ? <PillButton title="Нэмэх" icon="add" onPress={() => setModal(true)} /> : null}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />}
      >
        <Box style={{ marginBottom: 12 }}>
          <StatGrid
            size={22}
            items={[
              { label: 'Хамрагдах', value: String(state.required), color: colors.bad },
              { label: 'Хамрагдсан', value: String(state.completed), color: colors.ok },
              { label: 'Сертификат', value: String(certRows.length) },
            ]}
          />
        </Box>
        <Segmented
          style={{ marginBottom: 12 }}
          value={tab}
          onChange={setTab}
          options={[
            { key: 'trainings', label: `Сургалт · ${rows.length}` },
            { key: 'certs', label: `Сертификат · ${certRows.length}` },
          ]}
        />

        {tab === 'trainings' ? (
          rows.length ? (
            rows.map(renderTraining)
          ) : loading ? null : (
            <EmptyBlock
              ph="graduation-cap"
              title="Сургалт бүртгэгдээгүй"
              text={canManage ? 'Суусан эсвэл суух сургалтыг нэмнэ үү.' : 'Танд бүртгэлтэй сургалт алга.'}
              actionLabel={canManage ? 'Сургалт нэмэх' : null}
              onAction={() => setModal(true)}
            />
          )
        ) : certRows.length ? (
          <View style={styles.grid}>
            {certRows.map((row) => {
              const url = certUrls[row.id];
              return (
                <Pressable
                  key={row.id}
                  style={[styles.gridCell, { width: thumbW }]}
                  onPress={() => setViewer(url ? { row, url } : { row, generated: true })}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.training_name} сертификат`}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={{ width: thumbW, height: thumbW / 1.414, borderRadius: 8, backgroundColor: colors.field }} />
                  ) : (
                    <CertificateView {...certData(row)} width={thumbW} />
                  )}
                  <Text style={styles.gridLabel} numberOfLines={2}>{row.training_name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : loading ? null : (
          <EmptyBlock ph="graduation-cap" title="Сертификат алга" text="Хамрагдсан сургалт бүрт сертификат энд гарна." />
        )}
      </ScrollView>

      {/* Сертификат томоор */}
      <Modal visible={!!viewer} animationType="fade" onRequestClose={() => setViewer(null)}>
        <SafeAreaView style={styles.viewer} edges={['top', 'bottom']}>
          <View style={styles.viewerHead}>
            <Text style={styles.viewerTitle} numberOfLines={1}>{viewer?.row?.training_name}</Text>
            <Pressable onPress={() => setViewer(null)} hitSlop={10} accessibilityLabel="Хаах">
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.viewerBody}>
            {viewer?.url ? (
              <Image source={{ uri: viewer.url }} style={{ width: width - 24, height: (width - 24) * 1.2 }} resizeMode="contain" />
            ) : viewer ? (
              <CertificateView {...certData(viewer.row)} width={width - 24} />
            ) : null}
          </View>
          <View style={styles.viewerFoot}>
            {viewer?.generated ? (
              <Button title="PDF болгож хуваалцах" icon="share-outline" onPress={() => share(viewer.row)} loading={sharing} disabled={sharing} style={{ flex: 1 }} />
            ) : null}
            {viewer?.url && canManage ? (
              <Button title="Сертификат хасах" variant="danger" onPress={() => dropCertificate(viewer.row)} style={{ flex: 1 }} />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Сургалт нэмэх */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Сургалт нэмэх</Text>
              <Text style={styles.employee}>{fullName(employee)}</Text>
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
              <Text style={styles.meta}>
                Сургалт сертификат олгосон бол нэмсний дараа «Сертификат оруулах»-аар зургийг нь оруулна.
              </Text>
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

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    body: { paddingHorizontal: 16, paddingBottom: 48 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.card, marginBottom: 12, ...shadow.md },
    searchInput: { flex: 1, color: colors.ink, fontSize: 15, padding: 0 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
    first: { borderTopWidth: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    last: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    personName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
    meta: { color: colors.muted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
    tRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    tName: { color: colors.ink, fontSize: 15.5, fontWeight: '700' },
    tStatus: { fontSize: 12.5, fontWeight: '600', marginTop: 3 },
    certRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
    certThumbWrap: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
    certThumb: { width: 96, height: 68, backgroundColor: colors.field },
    certLabel: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    tActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridCell: { gap: 6 },
    gridLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    viewer: { flex: 1, backgroundColor: '#000000' },
    viewerHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    viewerTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    viewerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    viewerFoot: { flexDirection: 'row', gap: 10, padding: 16 },
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: { maxHeight: '90%', padding: 20, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: colors.line, marginBottom: 16 },
    title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
    employee: { color: colors.brand, fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 16 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  });
