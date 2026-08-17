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
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, Field, Badge, ScreenHeader, HeaderButton, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import {
  ROLES,
  roleLabel,
  canManageProfile,
  canAssignRoles,
  canDeleteProfile,
  canManageDepartments,
  deleteBlockedReason,
  assignableRoles,
  isValidRole,
} from '../lib/roles';
import * as authApi from '../services/authService';
import * as deptApi from '../services/departmentService';
import * as localAccessApi from '../services/localAccessService';
import { callEdge } from '../lib/edgeFunction';

const EMPTY = {
  name: '',
  last_name: '',
  email: '',
  position: '',
  phone: '',
  address: '',
  role: 'employee',
  department_id: null,
};

export default function EmployeesScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const {
    isManager,
    isSuperAdmin: isSuperAdminUser,
    authProfile,
    departmentId: myDepartmentId,
    fetchEmployees,
    adminCreateEmployee,
    adminUpdateEmployee,
  } = useApp();
  const mayAssignRoles = canAssignRoles(authProfile?.role);
  // Тухайн хүн олгож болох эрхүүд — админ, ахлах зөвхөн "Ажилтан" нэмнэ
  const assignable = assignableRoles(authProfile?.role);
  // Хэлтэс үүсгэх нь ЗӨВХӨН хөгжүүлэгчийн эрх — хэлтэс бол эрхийн хил.
  const mayManageDepartments = canManageDepartments(authProfile?.role);
  const [departments, setDepartments] = useState([]);
  // Ажилтан нэмэх цонхон дотроос шинэ хэлтэс үүсгэх түр төлөв
  const [deptDraft, setDeptDraft] = useState(null); // { name, kind } | null
  const [deptSaving, setDeptSaving] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  // Устгах эрхийг шалгахад бүтэн мөр хэрэгтэй тул editId-аас гадна өөрийг нь хадгална.
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setList(await fetchEmployees());
    } catch (e) {
      setError(e.message);
    }
    // Хэлтсийн жагсаалт байхгүй ч ажилтны жагсаалт харагдах ёстой —
    // тиймээс тусад нь, алдааг нь дардаг байдлаар уншина.
    try {
      setDepartments(await deptApi.fetchDepartments());
    } catch (e) {
      setDepartments([]);
    }
  }, [fetchEmployees]);

  useEffect(() => {
    load();
  }, [load]);

  /** Хэлтсийн нэрийг id-аар нь олно (жагсаалт, дэлгэрэнгүйд). */
  const departmentName = useCallback(
    (id) => departments.find((d) => d.id === id)?.name || null,
    [departments]
  );

  /**
   * Google Sheet-ээс ажилтныг татаж бүртгэнэ.
   *
   * Sheet дээр шинэ мөр нэмэгдмэгц энд дарахад `authorized_users`-д
   * орж, тэр хүн Google хаягаараа нэвтрэх боломжтой болно.
   *
   * ЭРХИЙГ ДАРААХГҮЙ: аппаас админ болгосон хүнийг sheet дээрх хуучин
   * "Ажилтан" утга буцаагаад доошлуулбал эрх санамсаргүй алдагдана.
   */
  const syncFromSheet = async () => {
    setSyncing(true);
    try {
      const { data } = await callEdge('sync-employees-sheet', {});
      await load();
      const lines = [
        `Шинээр нэмэгдсэн: ${data.added}`,
        `Шинэчлэгдсэн: ${data.updated}`,
      ];
      if (data.skipped) lines.push(`Алгасагдсан: ${data.skipped}`);
      if (data.problems?.length) lines.push('\nАлдаа:\n' + data.problems.join('\n'));
      Alert.alert('Sheet-ээс татлаа', lines.join('\n'));
    } catch (e) {
      Alert.alert('Синхрончлол', e.message || 'Алдаа гарлаа.');
    } finally {
      setSyncing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /**
   * Хөгжүүлэгч: тухайн хүнээс PIN-ээ дахин тохируулахыг шаардах / цуцлах.
   *
   * PIN нь утсан дээр л байдаг тул эндээс "шинэ PIN тавьж өгөх" боломжгүй —
   * зөвхөн хуучныг нь хүчингүй болгож, өөрөөр нь дахин үүсгүүлнэ.
   */
  const togglePinReset = async () => {
    if (!editId || !editTarget) return;
    const next = !editTarget.pin_reset_required;
    setPinBusy(true);
    try {
      await localAccessApi.requirePinReset(editId, next);
      setEditTarget((t) => (t ? { ...t, pin_reset_required: next } : t));
      setList((prev) =>
        prev.map((p) => (p.id === editId ? { ...p, pin_reset_required: next } : p))
      );
      Alert.alert(
        next ? 'Шаардлаа' : 'Цуцаллаа',
        next
          ? 'Хэрэглэгч дараагийн удаа апп нээхэд шинэ PIN үүсгэнэ.'
          : 'PIN шинэчлэх шаардлагыг цуцаллаа.'
      );
    } catch (e) {
      Alert.alert('Боломжгүй', e.message);
    } finally {
      setPinBusy(false);
    }
  };

  /**
   * Ажилтан нэмэх цонхноос ШУУД шинэ хэлтэс үүсгэнэ.
   *
   * Хэлтсийг тусад нь дэлгэц дээр үүсгээд, буцаад ажилтан нэмэх рүү
   * орох нь хоёр алхам болдог. Хөгжүүлэгч энд шууд үүсгээд, тэр
   * хэлтэс нь сонгогдсон хэвээр үлдэнэ.
   */
  const createDepartment = async () => {
    const name = String(deptDraft?.name || '').trim();
    if (!name) {
      setError('Хэлтсийн нэр шаардлагатай.');
      return;
    }
    setDeptSaving(true);
    try {
      const created = await deptApi.createDepartment({ name, kind: deptDraft.kind });
      setDepartments((prev) =>
        [...prev, created].sort((a, b) => String(a.name).localeCompare(String(b.name)))
      );
      setForm((f) => ({ ...f, department_id: created.id }));
      setDeptDraft(null);
      setError(null);
    } catch (e) {
      setError(deptApi.mapDepartmentError(e.message));
    } finally {
      setDeptSaving(false);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setEditTarget(null);
    // Хэлтэстэй удирдагч (ахлах) шинэ ажилтнаа автоматаар өөрийн
    // хэлтэст нэмнэ — сервер тал ч мөн адил албадана.
    setForm({ ...EMPTY, department_id: myDepartmentId });
    setError(null);
    setModal(true);
  };

  /**
   * Хэрэглэгч устгах.
   * UI нь эрхийг урьдчилан шалгаж ойлгомжтой мессеж өгнө, гэхдээ эцсийн
   * шийдвэрийг SQL талын admin_delete_user функц гаргана.
   */
  const confirmDelete = (item) => {
    const blocked = deleteBlockedReason(authProfile, item);
    if (blocked) {
      Alert.alert('Боломжгүй', blocked);
      return;
    }
    const who = item.name || item.email || 'Энэ хэрэглэгч';
    Alert.alert(
      'Хэрэглэгч устгах',
      `${who}-ийг бүрмөсөн устгах уу?\n\nНэвтрэх эрх нь хаагдаж, зөвшөөрлийн жагсаалтаас хасагдана. Энэ үйлдлийг буцаах боломжгүй.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Устгах',
          style: 'destructive',
          onPress: async () => {
            try {
              await authApi.adminDeleteUser(item.id);
              setList((prev) => prev.filter((p) => p.id !== item.id));
            } catch (e) {
              Alert.alert('Устгаж чадсангүй', e.message);
            }
          },
        },
      ]
    );
  };

  const openEdit = (item) => {
    if (item.pending) {
      Alert.alert('Google нэвтрэлт хүлээгдэж байна', 'Хэрэглэгч энэ Gmail хаягаараа анх нэвтэрсний дараа профайлыг засах боломжтой.');
      return;
    }
    // Бүтэн профайл дамжуулснаар зэрэглэлээс гадна ХЭЛТЭС нь шалгагдана.
    if (!canManageProfile(authProfile, item)) {
      Alert.alert('Анхаар', 'Энэ хэрэглэгчийг засах эрхгүй.');
      return;
    }
    setEditId(item.id);
    setEditTarget(item);
    setForm({
      name: item.name || '',
      last_name: item.last_name || '',
      email: item.email || '',
      position: item.position || '',
      phone: item.phone || '',
      address: item.address || '',
      // Эрхийг хэвээр нь авна. Өмнө нь admin/superadmin-аас бусдыг бүгдийг
      // employee болгож хаядаг байсан тул нярав, ахлах, захирал зэрэг
      // эрхтэй хүнийг засахад эрх нь ажилтан болж бууж байв.
      role: isValidRole(item.role) ? item.role : ROLES.EMPLOYEE,
      department_id: item.department_id || null,
    });
    setError(null);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditId(null);
    setEditTarget(null);
    setForm(EMPTY);
    setDeptDraft(null);
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
          department_id: form.department_id || null,
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
        department_id: form.department_id || null,
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

  if (!isManager) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажилчид"/>
        <EmptyState text="Энэ хэсэг зөвхөн удирдлагад нээлттэй."/>
      </View>
    );
  }

  // Ахлах "миний хэлтэс"-ээ хардаг гэдгээ мэдэж байх ёстой — эс тэгвээс
  // "яагаад бүх ажилтан харагдахгүй байна вэ" гэсэн эргэлзээ төрнө.
  const scopeNote = myDepartmentId
    ? `${departmentName(myDepartmentId) || 'Миний хэлтэс'} · ${list.length} хүн`
    : `${list.length} бүртгэлтэй`;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ажилчид"
        subtitle={scopeNote}
        right={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <HeaderButton
              title={syncing ? 'Татаж...' : 'Sheet'}
              onPress={syncing ? undefined : syncFromSheet}
            />
            <HeaderButton title="Нэмэх" onPress={openCreate} />
          </View>
        }
      />
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openEdit(item)}
            onLongPress={canDeleteProfile(authProfile, item) ? () => confirmDelete(item) : undefined}
            delayLongPress={450}
            accessibilityRole="button"
            accessibilityLabel={`${item.name || item.email}, ${roleLabel(item.role)}`}
            accessibilityHint={
              canDeleteProfile(authProfile, item)
                ? 'Засах бол дарна. Устгах бол удаан дарна.'
                : 'Засах бол дарна.'
            }
          >
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
                {item.department_name || departmentName(item.department_id) ? (
                  <Text style={styles.dept}>
                    🏢 {item.department_name || departmentName(item.department_id)}
                  </Text>
                ) : null}
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

              {/* --- Хэлтэс --- */}
              {/* Хэлтэс нь эрхийн хил: тухайн хүн зөвхөн энэ хэлтсийн
                  хүн, бараа, багажийг харна. Харьяалалтай удирдагч
                  (менежер, ахлах) өөрийнхөөс өөр хэлтэс сонгож чадахгүй.
                  Шинэ хэлтсийг ЗӨВХӨН хөгжүүлэгч энэ хэсгээс үүсгэнэ. */}
              <Text style={styles.roleLabel}>Хэлтэс</Text>
              {myDepartmentId ? (
                <Text style={styles.otpHint}>
                  {departmentName(myDepartmentId) || 'Миний хэлтэс'} — та зөвхөн
                  өөрийн хэлтэст ажилтан нэмнэ.
                </Text>
              ) : (
                <>
                  {!departments.length && !mayManageDepartments ? (
                    <Text style={styles.otpHint}>
                      Хэлтэс бүртгэгдээгүй байна. Хөгжүүлэгч хэлтсийг үүсгэж,
                      менежерийг нь томилно.
                    </Text>
                  ) : (
                    <View style={styles.chipWrap}>
                      <TouchableOpacity
                        style={[styles.chip, !form.department_id && styles.chipOn]}
                        onPress={() => setForm({ ...form, department_id: null })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: !form.department_id }}
                      >
                        <Text style={[styles.chipText, !form.department_id && styles.chipTextOn]}>
                          Харьяалалгүй
                        </Text>
                      </TouchableOpacity>
                      {departments.map((d) => {
                        const on = form.department_id === d.id;
                        return (
                          <TouchableOpacity
                            key={d.id}
                            style={[styles.chip, on && styles.chipOn]}
                            onPress={() => setForm({ ...form, department_id: d.id })}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>
                              {deptApi.kindIcon(d.kind)} {d.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {mayManageDepartments && !deptDraft ? (
                        <TouchableOpacity
                          style={[styles.chip, styles.chipAdd]}
                          onPress={() => setDeptDraft({ name: '', kind: 'org' })}
                          accessibilityRole="button"
                          accessibilityLabel="Шинэ хэлтэс нэмэх"
                        >
                          <Text style={[styles.chipText, styles.chipTextOn]}>+ Шинэ хэлтэс</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}

                  {/* Хэлтсийн гишүүд, бараа, багажийг харах */}
                  {mayManageDepartments && departments.length > 0 && !deptDraft ? (
                    <TouchableOpacity
                      onPress={() => {
                        closeModal();
                        navigation.navigate('Departments');
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.deptLink}>Хэлтсүүдийг харах, засах →</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Шинэ хэлтэс — байгууллага эсвэл өрх */}
                  {deptDraft ? (
                    <View style={styles.deptBox}>
                      <Text style={styles.deptBoxTitle}>Шинэ хэлтэс</Text>
                      <View style={styles.chipWrap}>
                        {deptApi.DEPARTMENT_KINDS.map((k) => {
                          const on = deptDraft.kind === k.key;
                          return (
                            <TouchableOpacity
                              key={k.key}
                              style={[styles.chip, on && styles.chipOn]}
                              onPress={() => setDeptDraft({ ...deptDraft, kind: k.key })}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on }}
                            >
                              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                                {k.icon} {k.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Field
                        label="Хэлтсийн нэр"
                        value={deptDraft.name}
                        onChangeText={(t) => setDeptDraft({ ...deptDraft, name: t })}
                      />
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <Button
                          title="Болих"
                          variant="ghost"
                          style={{ flex: 1 }}
                          onPress={() => setDeptDraft(null)}
                        />
                        <Button
                          title="Үүсгэх"
                          style={{ flex: 1 }}
                          onPress={createDepartment}
                          loading={deptSaving}
                          disabled={deptSaving}
                        />
                      </View>
                    </View>
                  ) : null}
                </>
              )}

              <Text style={styles.roleLabel}>Эрх</Text>
              {mayAssignRoles ? (
                // Эрх бүрийг тайлбартай нь жагсаана. Товчны эгнээ болгосон
                // хуучин хувилбар нь 6 эрхэд багтахгүй, мөн нярав/ахлах
                // юу хийхийг тайлбарлахгүй байв.
                <View style={styles.roleList}>
                  {assignable.map((r) => {
                    const on = form.role === r.key;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        style={[styles.roleOption, on && styles.roleOptionOn]}
                        onPress={() => setForm({ ...form, role: r.key })}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <View style={[styles.roleDot, on && styles.roleDotOn]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.roleName, on && styles.roleNameOn]}>{r.label}</Text>
                          <Text style={styles.roleDesc}>{r.desc}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.otpHint}>Эрх өөрчлөхийг зөвхөн Хөгжүүлэгч хийнэ. Админ, ахлах нь ажилтны мэдээлэл засна.</Text>
              )}

              {/* --- Төхөөрөмжийн PIN — зөвхөн Хөгжүүлэгчид --- */}
              {/* PIN нь хэрэглэгчийн утсанд шифрлэгдэн хадгалагддаг тул
                  эндээс УНШИХ боломжгүй. Зөвхөн төлөвийг харж, мартсан
                  тохиолдолд "дахин тохируул" гэж шаардана. */}
              {editId && isSuperAdminUser && !editTarget?.pending ? (
                <View style={styles.pinBox}>
                  <Text style={styles.deptBoxTitle}>Төхөөрөмжийн PIN</Text>
                  <Text style={styles.pinState}>
                    {editTarget?.pin_reset_required
                      ? '⚠️ Дахин тохируулахыг шаардсан. Хэрэглэгч апп нээхэд хуучин PIN нь устаж, шинийг үүсгэнэ.'
                      : editTarget?.pin_set_at
                        ? `Тохируулсан · ${new Date(editTarget.pin_set_at).toLocaleDateString('mn-MN')}`
                        : 'Хараахан PIN тохируулаагүй байна.'}
                  </Text>
                  <Button
                    title={
                      editTarget?.pin_reset_required
                        ? 'Шаардлагыг цуцлах'
                        : 'PIN-ийг дахин тохируулуулах'
                    }
                    variant="ghost"
                    loading={pinBusy}
                    disabled={pinBusy}
                    onPress={togglePinReset}
                  />
                </View>
              ) : null}

              {/* Хөгжүүлэгч хүн тус бүрийн эрхийг нэг бүрчлэн нээж, хаана. */}
              {editId && isSuperAdminUser && !editTarget?.pending ? (
                <Button
                  title="Юу хийж чадахыг нь тохируулах"
                  variant="ghost"
                  style={{ marginBottom: spacing.md }}
                  onPress={() => {
                    const user = editTarget;
                    closeModal();
                    navigation.navigate('UserPermissions', { user });
                  }}
                />
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={closeModal} />
                <Button
                  title={editId ? 'Хадгалах' : 'Үүсгэх'}
                  style={{ flex: 1 }}
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                />
              </View>
              {/* Устгах нь эрсдэлтэй үйлдэл тул хадгалах товчноос тусад нь,
                  доор нь тавьж, санамсаргүй дарагдахаас сэргийлэв. */}
              {editId && canDeleteProfile(authProfile, editTarget) ? (
                <Button
                  title="Хэрэглэгчийг устгах"
                  variant="danger"
                  style={{ marginTop: spacing.md }}
                  onPress={() => {
                    closeModal();
                    confirmDelete(editTarget);
                  }}
                />
              ) : null}
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
  dept: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: '600' },
  phone: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipAdd: { borderStyle: 'dashed', borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.primary },
  deptLink: { color: colors.primary, fontSize: 13, fontWeight: '600', marginBottom: spacing.md },
  deptBox: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  deptBoxTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  pinBox: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pinState: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
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
  // Эрхийн жагсаалт — тайлбартай, 6 эрхэд багтана
  roleList: { gap: spacing.sm, marginBottom: spacing.md },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  roleOptionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.outline,
  },
  roleDotOn: { borderColor: colors.primary, borderWidth: 6 },
  roleName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  roleNameOn: { color: colors.primary },
  roleDesc: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  error: { color: colors.danger, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
