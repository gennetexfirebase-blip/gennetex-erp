import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Card, Button, Field, Badge, ScreenHeader, HeaderButton, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { ROLES, roleLabel, canManageProfile, canAssignRoles } from '../lib/roles';

const EMPTY = { name: '', last_name: '', email: '', position: '', phone: '', address: '', role: 'employee' };

export default function EmployeesScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isSuperAdmin: isSuperAdminUser, authProfile, fetchEmployees, adminCreateEmployee, adminUpdateEmployee } = useApp();
  const mayAssignRoles = canAssignRoles(authProfile?.role);
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setList(await fetchEmployees());
    } catch (e) {
      setError(e.message);
    }
  }, [fetchEmployees]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY);
    setError(null);
    setModal(true);
  };

  const openEdit = (item) => {
    if (item.pending) {
      Alert.alert('Google нэвтрэлт хүлээгдэж байна', 'Хэрэглэгч энэ Gmail хаягаараа анх нэвтэрсний дараа профайлыг засах боломжтой.');
      return;
    }
    if (!canManageProfile(authProfile?.role, item.role)) {
      Alert.alert('Анхаар', 'Энэ хэрэглэгчийг засах эрхгүй.');
      return;
    }
    setEditId(item.id);
    setForm({
      name: item.name || '',
      last_name: item.last_name || '',
      email: item.email || '',
      position: item.position || '',
      phone: item.phone || '',
      address: item.address || '',
      role: item.role === ROLES.ADMIN ? ROLES.ADMIN : item.role === ROLES.SUPERADMIN ? ROLES.SUPERADMIN : ROLES.EMPLOYEE,
    });
    setError(null);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditId(null);
    setForm(EMPTY);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Нэр шаардлагатай.');
      return;
    }
    if (!editId && !form.email.trim()) {
      setError('Нэр болон имэйл шаардлагатай.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (editId) {
        await adminUpdateEmployee(editId, {
          name: form.name.trim(),
          last_name: form.last_name.trim(),
          position: form.position.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          ...(mayAssignRoles ? { role: form.role } : {}),
        });
        closeModal();
        Alert.alert('Амжилттай', 'Ажилтны мэдээлэл шинэчлэгдлээ.');
        await load();
        return;
      }
      await adminCreateEmployee({
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        role: mayAssignRoles ? form.role : ROLES.EMPLOYEE,
      });
      const email = form.email.trim().toLowerCase();
      closeModal();
      Alert.alert(
        'Gmail зөвшөөрөгдлөө',
        `${email}\n\nХэрэглэгч mobile app дээр “Google-ээр нэвтрэх” товчоор шууд орно. Нууц үг өгөх шаардлагагүй.`
      );
      await load();
    } catch (e) {
      setError(mapError(e.message));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажилчид"/>
        <EmptyState text="Энэ хэсэг зөвхөн админд нээлттэй."/>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ажилчид"
        subtitle={`${list.length} бүртгэлтэй`}
        right={<HeaderButton title="Нэмэх" onPress={openCreate} />}
      />
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} onPress={() => openEdit(item)}>
            <Card style={styles.row}>
              <View style={styles.avatar}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>{(item.name || ' ?').charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || '—'}</Text>
                <Text style={styles.sub}>{item.position || 'Ажилтан'} · {item.email}</Text>
                {item.pending ? <Text style={styles.pending}>Google нэвтрэлт хүлээгдэж байна</Text> : null}
                {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
              </View>
              <Badge text={roleLabel(item.role)} color={item.role === ROLES.ADMIN || item.role === ROLES.SUPERADMIN ? colors.accent : colors.primary} />
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState text="Ажилтан бүртгэгдээгүй байна."/>}
      />

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>{editId ? 'Ажилтан засах' : 'Шинэ ажилтан нэмэх'}</Text>
              <Field label="Овог" value={form.last_name} onChangeText={(t) => setForm({ ...form, last_name: t })} />
              <Field label="Нэр" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
              {editId ? (
                <Field label="Gmail" value={form.email} editable={false} style={{ opacity: 0.7 }} />
              ) : (
                <>
                  <Field label="Gmail" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} />
                  <Text style={styles.otpHint}>Нууц үг үүсгэхгүй. Энэ Gmail хаяг Google Sign-In-д зөвшөөрөгдөнө.</Text>
                </>
              )}
              <Field label="Албан тушаал" value={form.position} onChangeText={(t) => setForm({ ...form, position: t })} />
              <Field label="Утас" keyboardType="phone-pad" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} />
              <Field label="Хаяг" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} />
              <Text style={styles.roleLabel}>Эрх</Text>
              {mayAssignRoles ? (
                <View style={styles.roleRow}>
                  <Button title="Ажилтан" variant={form.role === ROLES.EMPLOYEE ? 'primary' : 'ghost'} style={{ flex: 1 }} onPress={() => setForm({ ...form, role: ROLES.EMPLOYEE })} />
                  <Button title="Админ" variant={form.role === ROLES.ADMIN ? 'primary' : 'ghost'} style={{ flex: 1 }} onPress={() => setForm({ ...form, role: ROLES.ADMIN })} />
                  {isSuperAdminUser ? (
                    <Button title="Хөгжүүлэгч" variant={form.role === ROLES.SUPERADMIN ? 'primary' : 'ghost'} style={{ flex: 1 }} onPress={() => setForm({ ...form, role: ROLES.SUPERADMIN })} />
                  ) : null}
                </View>
              ) : (
                <Text style={styles.otpHint}>Эрх өөрчлөхийг зөвхөн Хөгжүүлэгч хийнэ. Энгийн админ ажилтны мэдээлэл засна.</Text>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={closeModal} />
                <Button title={saving ? '...' : editId ? 'Хадгалах' : 'Үүсгэх'} style={{ flex: 1 }} onPress={handleSave} disabled={saving} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function mapError(msg = '') {
  if (/already registered|already exists/i.test(msg)) return 'Энэ имэйл бүртгэлтэй байна.';
  if (/forbidden|role_forbidden/i.test(msg)) return 'Энэ үйлдлийг хийх эрх хүрэлцэхгүй байна.';
  if (/invalid_email/i.test(msg)) return 'Gmail хаягаа зөв оруулна уу.';
  if (/name_required/i.test(msg)) return 'Нэр шаардлагатай.';
  if (/user_not_found/i.test(msg)) return 'Хэрэглэгч олдсонгүй.';
  if (/Could not find the function/i.test(msg)) return 'Gmail authorization migration ажиллуулаагүй байна.';
  return msg;
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 23 },
  avatarLetter: { color: colors.primary, fontSize: 18, fontWeight: '800'},
  name: { color: colors.text, fontSize: 16, fontWeight: '800'},
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  phone: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  pending: { color: colors.warning, fontSize: 11, marginTop: 3, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderHi, alignSelf: 'center', marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.lg },
  otpHint: { color: colors.textFaint, fontSize: 12, marginBottom: spacing.md, marginTop: -spacing.xs, lineHeight: 17 },
  roleLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
