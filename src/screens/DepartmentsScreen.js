/**
 * Хэлтэс — БАЙГУУЛЛАГА ба ӨРХ гэсэн хоёр хэсэгтэй.
 *
 * Хэлтэс нь эрхийн ХИЛ юм: ахлах (менежер) зөвхөн өөрийн хэлтсийн
 * хүн, бараа, багажийг харна, нэмнэ, хасна. Тиймээс хэлтэс үүсгэх нь
 * админаас дээш эрхтэй хүний ажил.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  Card,
  Button,
  Field,
  Badge,
  ScreenHeader,
  HeaderButton,
  EmptyState,
  SegmentTabs,
} from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { canManageDepartments } from '../lib/roles';
import * as deptApi from '../services/departmentService';

const EMPTY_FORM = { name: '', kind: 'org', note: '', parentId: null };

export default function DepartmentsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { authProfile } = useApp();

  const mayManage = canManageDepartments(authProfile?.role);

  const [kind, setKind] = useState('org');
  const [list, setList] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [rows, tally] = await Promise.all([
        deptApi.fetchDepartments(),
        deptApi.fetchDepartmentCounts().catch(() => ({})),
      ]);
      setList(rows);
      setCounts(tally);
      setError(null);
    } catch (e) {
      setError(deptApi.mapDepartmentError(e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Дэлгэц рүү буцаж ирэхэд гишүүдийн тоо шинэчлэгдсэн байх ёстой.
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Мод хэлбэр: эцэг хэлтэс, дараа нь түүний хүүхдүүд нь дор нь.
  const shown = useMemo(() => {
    const kindList = list.filter((d) => d.kind === kind);
    const byParent = {};
    kindList.forEach((d) => {
      const key = d.parent_id && kindList.some((p) => p.id === d.parent_id) ? d.parent_id : 'root';
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(d);
    });
    const ordered = [];
    (byParent.root || []).forEach((root) => {
      ordered.push({ ...root, depth: 0 });
      (byParent[root.id] || []).forEach((child) => ordered.push({ ...child, depth: 1 }));
    });
    return ordered;
  }, [list, kind]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, kind });
    setError(null);
    setModal(true);
  };

  const openEdit = (dept) => {
    if (!mayManage) return;
    setEditId(dept.id);
    setForm({ name: dept.name, kind: dept.kind, note: dept.note || '', parentId: dept.parent_id || null });
    setError(null);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Хэлтсийн нэр шаардлагатай.');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await deptApi.updateDepartment(editId, form);
      } else {
        await deptApi.createDepartment(form);
      }
      closeModal();
      setKind(form.kind);
      await load();
    } catch (e) {
      setError(deptApi.mapDepartmentError(e.message));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (dept) => {
    Alert.alert(
      'Хэлтэс устгах',
      `"${dept.name}" хэлтсийг устгах уу?\n\nЭнэ хэлтэст хамаарах бараа, багаж нийтийн болно.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Устгах',
          style: 'destructive',
          onPress: async () => {
            try {
              await deptApi.deleteDepartment(dept.id);
              await load();
            } catch (e) {
              Alert.alert('Устгаж чадсангүй', deptApi.mapDepartmentError(e.message));
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const tally = counts[item.id] || { members: 0, items: 0 };
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DepartmentDetail', { id: item.id, name: item.name })}
        onLongPress={mayManage ? () => openEdit(item) : undefined}
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${tally.members} хүн`}
        accessibilityHint={mayManage ? 'Дэлгэрэнгүй харах бол дарна. Засах бол удаан дарна.' : undefined}
      >
        <Card style={[styles.row, item.depth ? { marginLeft: spacing.xl } : null]}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{deptApi.kindIcon(item.kind)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>
              {tally.members} хүн · {tally.items} бараа/багаж
            </Text>
            {item.note ? <Text style={styles.note} numberOfLines={1}>{item.note}</Text> : null}
          </View>
          <Badge text={deptApi.kindLabel(item.kind)} color={colors.primary} />
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Хэлтэс"
        subtitle={`${shown.length} ${deptApi.kindLabel(kind).toLowerCase()}`}
        back
        right={mayManage ? <HeaderButton title="Нэмэх" onPress={openCreate} /> : null}
      />

      <SegmentTabs
        tabs={deptApi.DEPARTMENT_KINDS.map((k) => ({ key: k.key, label: k.label }))}
        value={kind}
        onChange={setKind}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={shown}
        keyExtractor={(d) => d.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              text={`${deptApi.kindLabel(kind)} хэсэгт хэлтэс алга.`}
              action={mayManage ? openCreate : undefined}
              actionLabel="Хэлтэс нэмэх"
            />
          )
        }
      />

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>{editId ? 'Хэлтэс засах' : 'Шинэ хэлтэс'}</Text>

              <Text style={styles.label}>Төрөл</Text>
              <View style={styles.kindList}>
                {deptApi.DEPARTMENT_KINDS.map((k) => {
                  const on = form.kind === k.key;
                  return (
                    <TouchableOpacity
                      key={k.key}
                      style={[styles.kindOption, on && styles.kindOptionOn]}
                      onPress={() => setForm({ ...form, kind: k.key })}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={styles.kindIcon}>{k.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.kindName, on && styles.kindNameOn]}>{k.label}</Text>
                        <Text style={styles.kindDesc}>{k.desc}</Text>
                      </View>
                      <View style={[styles.radio, on && styles.radioOn]} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Field
                label="Хэлтсийн нэр"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
              />

              <Text style={styles.label}>Эцэг хэлтэс (заавал биш)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <TouchableOpacity
                  style={[styles.parentChip, !form.parentId && styles.parentChipOn]}
                  onPress={() => setForm({ ...form, parentId: null })}
                >
                  <Text style={[styles.parentChipText, !form.parentId && styles.parentChipTextOn]}>Байхгүй</Text>
                </TouchableOpacity>
                {list
                  .filter((d) => d.kind === form.kind && d.id !== editId)
                  .map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.parentChip, form.parentId === d.id && styles.parentChipOn]}
                      onPress={() => setForm({ ...form, parentId: d.id })}
                    >
                      <Text style={[styles.parentChipText, form.parentId === d.id && styles.parentChipTextOn]}>
                        {d.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <Field
                label="Тэмдэглэл"
                value={form.note}
                onChangeText={(t) => setForm({ ...form, note: t })}
              />

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

              {editId ? (
                <Button
                  title="Хэлтсийг устгах"
                  variant="danger"
                  style={{ marginTop: spacing.md }}
                  onPress={() => {
                    const target = list.find((d) => d.id === editId);
                    closeModal();
                    if (target) confirmDelete(target);
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

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  note: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderHi,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  kindList: { gap: spacing.sm, marginBottom: spacing.md },
  kindOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  kindOptionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  kindIcon: { fontSize: 22 },
  kindName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  kindNameOn: { color: colors.primary },
  kindDesc: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.outline,
  },
  radioOn: { borderColor: colors.primary, borderWidth: 6 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  parentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginRight: spacing.sm,
  },
  parentChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  parentChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  parentChipTextOn: { color: colors.primary },
});
