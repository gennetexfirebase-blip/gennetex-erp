/**
 * Нэг хэлтсийн дэлгэрэнгүй — ГИШҮҮД ба БАРАА/БАГАЖ.
 *
 * Энэ дэлгэц нь "хэлтэс бүр өөрийнхөө хүн, эд хөрөнгийг л хардаг"
 * гэсэн дүрмийн харагдах тал юм. Ахлах энд орж:
 *   • гишүүдээ хармагц хэн нь ямар эрхтэйг мэднэ
 *   • хэлтсийнхээ бараа, багажийн үлдэгдлийг хардаг
 *
 * Жагсаалт нь ЗУРАГГҮЙ — нэр, тоо ширхэг. Зураг нь агуулахын
 * дэлгэрэнгүй цонхонд (InventoryScreen) харагдана.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  Card,
  Button,
  Badge,
  ScreenHeader,
  HeaderButton,
  EmptyState,
  SegmentTabs,
  formatMNT,
} from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { roleLabel, canManageEmployees, canManageInventory } from '../lib/roles';
import * as deptApi from '../services/departmentService';
import * as authApi from '../services/authService';

const TABS = [
  { key: 'members', label: 'Гишүүд' },
  { key: 'material', label: 'Бараа материал' },
  { key: 'tool', label: 'Багаж' },
];

export default function DepartmentDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { authProfile } = useApp();

  const departmentId = route.params?.id;
  const [dept, setDept] = useState(null);
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Нэмэх цонх — гишүүн эсвэл бараа сонгоно
  const [picker, setPicker] = useState(null); // 'member' | 'material' | 'tool'
  const [choices, setChoices] = useState([]);
  const [pickerBusy, setPickerBusy] = useState(false);

  const mayManageMembers = canManageEmployees(authProfile?.role);
  const mayManageItems = canManageInventory(authProfile?.role);

  const load = useCallback(async () => {
    if (!departmentId) return;
    try {
      const [all, people, stock] = await Promise.all([
        deptApi.fetchDepartments({ includeInactive: true }),
        deptApi.fetchDepartmentMembers(departmentId),
        deptApi.fetchDepartmentInventory(departmentId),
      ]);
      setDept(all.find((d) => d.id === departmentId) || null);
      setMembers(people);
      setItems(stock);
      setError(null);
    } catch (e) {
      setError(deptApi.mapDepartmentError(e.message));
    }
  }, [departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shownItems = useMemo(
    () => (tab === 'members' ? [] : items.filter((it) => (it.category || 'material') === tab)),
    [items, tab]
  );

  // -------------------------------------------------------------------------
  // Нэмэх
  // -------------------------------------------------------------------------
  const openPicker = async () => {
    const mode = tab === 'members' ? 'member' : tab;
    setPicker(mode);
    setPickerBusy(true);
    try {
      if (mode === 'member') {
        const all = await authApi.fetchEmployees();
        // Аль хэдийн энэ хэлтэст байгаа хүнийг дахин санал болгохгүй.
        setChoices(all.filter((p) => p.department_id !== departmentId && !p.pending));
      } else {
        setChoices(await deptApi.fetchUnassignedInventory({ category: mode }));
      }
    } catch (e) {
      Alert.alert('Алдаа', deptApi.mapDepartmentError(e.message));
      setPicker(null);
    } finally {
      setPickerBusy(false);
    }
  };

  const addMember = async (person) => {
    try {
      await deptApi.setUserDepartment(person.id, departmentId);
      setPicker(null);
      await load();
    } catch (e) {
      Alert.alert('Нэмж чадсангүй', deptApi.mapDepartmentError(e.message));
    }
  };

  const addItem = async (item) => {
    try {
      await deptApi.setItemDepartment(item.id, departmentId);
      setPicker(null);
      await load();
    } catch (e) {
      Alert.alert('Нэмж чадсангүй', deptApi.mapDepartmentError(e.message));
    }
  };

  // -------------------------------------------------------------------------
  // Хасах
  // -------------------------------------------------------------------------
  const removeMember = (person) => {
    Alert.alert(
      'Хэлтсээс хасах',
      `${person.name || person.email}-ийг "${dept?.name}" хэлтсээс хасах уу?\n\n` +
        'Хэрэглэгч устахгүй, зөвхөн харьяалалгүй болно. Хэлтсийн ахлах хасчихвал ' +
        'буцааж нэмэхийн тулд админд хандана.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Хасах',
          style: 'destructive',
          onPress: async () => {
            try {
              await deptApi.setUserDepartment(person.id, null);
              await load();
            } catch (e) {
              Alert.alert('Хасаж чадсангүй', deptApi.mapDepartmentError(e.message));
            }
          },
        },
      ]
    );
  };

  const removeItem = (item) => {
    Alert.alert(
      'Хэлтсээс хасах',
      `"${item.name}"-ийг хэлтсээс хасах уу?\n\nБараа устахгүй, нийтийн болно.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Хасах',
          style: 'destructive',
          onPress: async () => {
            try {
              await deptApi.setItemDepartment(item.id, null);
              await load();
            } catch (e) {
              Alert.alert('Хасаж чадсангүй', deptApi.mapDepartmentError(e.message));
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------------------
  const renderMember = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={mayManageMembers ? () => removeMember(item) : undefined}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={`${item.name || item.email}, ${roleLabel(item.role)}`}
      accessibilityHint={mayManageMembers ? 'Хэлтсээс хасах бол удаан дарна.' : undefined}
    >
      <Card style={styles.row}>
        <View style={styles.avatar}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarLetter}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name || '—'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.position || 'Ажилтан'} · {item.email}
          </Text>
        </View>
        <Badge text={roleLabel(item.role)} color={colors.primary} />
      </Card>
    </TouchableOpacity>
  );

  const renderItemRow = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={mayManageItems ? () => removeItem(item) : undefined}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
      accessibilityHint={mayManageItems ? 'Хэлтсээс хасах бол удаан дарна.' : undefined}
    >
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>
            {formatMNT(item.price)} / {item.unit}
          </Text>
        </View>
        <View style={styles.qtyWrap}>
          <Text style={[styles.qty, Number(item.quantity) <= 0 && { color: colors.danger }]}>
            {item.quantity}
          </Text>
          <Text style={styles.unit}>{item.unit}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const canAdd = tab === 'members' ? mayManageMembers : mayManageItems;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={dept?.name || route.params?.name || 'Хэлтэс'}
        subtitle={
          dept
            ? `${deptApi.kindLabel(dept.kind)} · ${members.length} хүн · ${items.length} бараа/багаж`
            : undefined
        }
        back
        right={canAdd ? <HeaderButton title="Нэмэх" onPress={openPicker} /> : null}
      />

      <SegmentTabs tabs={TABS} value={tab} onChange={setTab} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={tab === 'members' ? members : shownItems}
        keyExtractor={(x) => String(x.id)}
        renderItem={tab === 'members' ? renderMember : renderItemRow}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            text={
              tab === 'members'
                ? 'Энэ хэлтэст хүн бүртгэгдээгүй байна.'
                : 'Энэ хэлтэст хуваарилсан зүйл алга.'
            }
            action={canAdd ? openPicker : undefined}
            actionLabel="Нэмэх"
          />
        }
      />

      {/* Сонгох цонх — гишүүн эсвэл бараа */}
      <Modal visible={picker !== null} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>
              {picker === 'member' ? 'Хэлтэст хүн нэмэх' : 'Хэлтэст бараа/багаж нэмэх'}
            </Text>
            <Text style={styles.hint}>
              {picker === 'member'
                ? 'Танд харагдаж буй ажилтнуудаас сонгоно.'
                : 'Хэлтэст хуваарилаагүй (нийтийн) зүйлс жагсаж байна.'}
            </Text>

            <FlatList
              data={choices}
              keyExtractor={(x) => String(x.id)}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickRow}
                  activeOpacity={0.8}
                  onPress={() => (picker === 'member' ? addMember(item) : addItem(item))}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name || item.email}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {picker === 'member'
                        ? `${roleLabel(item.role)}${item.department_name ? ` · ${item.department_name}` : ''}`
                        : `${item.quantity} ${item.unit}`}
                    </Text>
                  </View>
                  <Text style={styles.plus}>+</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <EmptyState
                  text={
                    pickerBusy
                      ? 'Ачаалж байна…'
                      : picker === 'member'
                        ? 'Нэмэх боломжтой хүн алга.'
                        : 'Нийтийн бараа/багаж алга.'
                  }
                />
              }
            />

            <Button
              title="Хаах"
              variant="ghost"
              style={{ marginTop: spacing.md }}
              onPress={() => setPicker(null)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 21 },
  avatarLetter: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  qtyWrap: { alignItems: 'flex-end', minWidth: 56 },
  qty: { color: colors.text, fontSize: 17, fontWeight: '800' },
  unit: { color: colors.textFaint, fontSize: 11 },
  error: { color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderHi,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 4, marginBottom: spacing.md },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  plus: { color: colors.primary, fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.sm },
});
