import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TextInput, RefreshControl, Alert, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Button, Field, ScreenHeader } from '../components/ui';
import { Avatar, Box, Chip, EmptyBlock, SectionHeader, Segmented } from '../components/ds';
import { roleLabel } from '../lib/roles';
import { togglePermission } from '../lib/permissions';
import * as authApi from '../services/authService';
import * as actApi from '../services/actService';

/**
 * Акт → Тохиргоо (зөвхөн sysadmin).
 *
 * «Ажилтанд эрх олгох» — хэн акт бичиж болохыг нэг бүрчлэн асаана. Эрх
 * түвшнээр (админ, менежер) автоматаар нээгдэхгүй: энгийн админ ч энд эрх
 * авсны дараа л өөрийн актаа бичиж, харна. Захирал үргэлж нээлттэй.
 */
export default function ActSettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile, fetchEmployees } = useApp();
  const isSysadmin = authProfile?.role === 'superadmin';

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');

  const load = useCallback(async () => {
    if (!isSysadmin) return;
    setLoading(true);
    try {
      const rows = await fetchEmployees();
      setPeople(rows.filter((p) => !p.pending && p.active !== false));
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Ажилтны жагсаалт татагдсангүй.');
    } finally {
      setLoading(false);
    }
  }, [fetchEmployees, isSysadmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const granted = (p) => actApi.isActDirector(p) || p.permissions?.['acts.create'] === true;

  const toggle = async (person, value) => {
    const next = togglePermission(person, 'acts.create', value);
    setBusyId(person.id);
    // Шууд харагдуулаад, алдаа гарвал буцаана.
    setPeople((list) => list.map((p) => (p.id === person.id ? { ...p, permissions: next } : p)));
    try {
      await authApi.adminSetUserPermissions(person.user_id || person.id, next);
    } catch (e) {
      setPeople((list) => list.map((p) => (p.id === person.id ? person : p)));
      Alert.alert('Хадгалж чадсангүй', e?.message || 'Дахин оролдоно уу.');
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      people
        .filter((p) => (tab === 'granted' ? granted(p) : true))
        .filter((p) => !q || `${p.last_name || ''} ${p.name || ''} ${p.email || ''} ${p.position || ''}`.toLowerCase().includes(q))
        .sort((a, b) => Number(granted(b)) - Number(granted(a)) || String(a.name || '').localeCompare(String(b.name || ''), 'mn')),
    [people, tab, q]
  );
  const grantedCount = people.filter(granted).length;
  const [mode, setMode] = useState('perm'); // 'perm' | 'recv'

  if (!isSysadmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Актын тохиргоо" back />
        <EmptyBlock ph="lock-key" title="Хандах эрхгүй" text="Энэ хэсэг зөвхөн sysadmin-д нээлттэй." />
      </View>
    );
  }

  const modeSwitch = (
    <Segmented
      style={{ marginTop: 4, marginBottom: 12 }}
      value={mode}
      onChange={setMode}
      options={[
        { key: 'perm', label: 'Эрх олгох' },
        { key: 'recv', label: 'Хүлээлцэх хүмүүс' },
      ]}
    />
  );

  if (mode === 'recv') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Актын тохиргоо" subtitle="Хүлээлцэх хүмүүс" back />
        <ReceiverContacts header={modeSwitch} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Актын тохиргоо" subtitle="Ажилтанд эрх олгох" back />
      <FlatList
        data={shown}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListHeaderComponent={
          <>
            {modeSwitch}
            <Box pad style={styles.intro}>
              <View style={styles.introRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.brand} />
                <Text style={styles.introTitle}>Акт бичих эрх</Text>
                <Chip text={`${grantedCount} хүн`} tone="blue" />
              </View>
              <Text style={styles.introText}>
                Эрх авсан хүн (админ ч гэсэн) зөвхөн өөрийн бичсэн актаа харж, Захиралд илгээнэ.
                Актыг зөвхөн Захирал ({actApi.DIRECTOR_EMAIL}) баталгаажуулж, тамга дарагдана.
              </Text>
            </Box>
            <SectionHeader title="Ажилтанд эрх олгох" />
            <View style={styles.search}>
              <Ionicons name="search" size={19} color={colors.faint} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Нэр, имэйл, албан тушаал хайх…"
                placeholderTextColor={colors.faint}
                autoCorrect={false}
              />
            </View>
            <Segmented
              style={{ marginBottom: 12 }}
              value={tab}
              onChange={setTab}
              options={[
                { key: 'all', label: `Бүгд · ${people.length}` },
                { key: 'granted', label: `Эрхтэй · ${grantedCount}` },
              ]}
            />
          </>
        }
        ListEmptyComponent={
          loading ? null : <EmptyBlock icon="people-outline" title="Хүн олдсонгүй" text={tab === 'granted' ? 'Одоогоор хэнд ч эрх олгоогүй байна.' : 'Хайлтаа өөрчилж үзнэ үү.'} />
        }
        renderItem={({ item, index }) => {
          const director = actApi.isActDirector(item);
          const on = granted(item);
          const fullName = [item.last_name, item.name].filter(Boolean).join(' ') || item.email;
          return (
            <View style={[styles.row, index === 0 && styles.rowFirst, index === shown.length - 1 && styles.rowLast]}>
              <Avatar uri={item.avatar_url} name={item.name || item.email} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[director ? 'Захирал · баталгаажуулна' : item.position, roleLabel(item.role)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Switch
                value={on}
                disabled={director || busyId === item.id}
                onValueChange={(v) => toggle(item, v)}
                accessibilityLabel={`${fullName} — акт бичих эрх`}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const EMPTY_CONTACT = { id: null, audience_type: 'organization', organization: '', name: '', position: '', is_active: true };

/**
 * Хүлээлцэх хүмүүсийн лавлах (sysadmin). Акт бичихэд эдгээр хүмүүс
 * захиалагчийн байгууллагаар автоматаар орно; бусад хэрэглэгч
 * чагтыг харахгүй. Унтраасан хүн баталгаажаагүй актуудаас хасагдана.
 */
function ReceiverContacts({ header }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await actApi.fetchReceiverContacts());
    } catch (e) {
      Alert.alert('Алдаа', actApi.actError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Байгууллагаар бүлэглэнэ (Женнетексийн хүлээлцэгчид эхэнд).
  const groups = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => {
      const key = c.organization.trim() || 'Байгууллагагүй';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return [...map.entries()].map(([title, data]) => ({ title, data }));
  }, [contacts]);

  const toggle = async (contact, value) => {
    setBusyId(contact.id);
    setContacts((list) => list.map((c) => (c.id === contact.id ? { ...c, is_active: value } : c)));
    try {
      await actApi.saveReceiverContact({ ...contact, is_active: value });
    } catch (e) {
      setContacts((list) => list.map((c) => (c.id === contact.id ? contact : c)));
      Alert.alert('Хадгалж чадсангүй', actApi.actError(e));
    } finally {
      setBusyId(null);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Нэр оруулна уу', 'Хүлээлцэх хүний нэрийг бичнэ үү.');
      return;
    }
    setSaving(true);
    try {
      await actApi.saveReceiverContact(form);
      setForm(null);
      await load();
    } catch (e) {
      Alert.alert('Хадгалж чадсангүй', actApi.actError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (contact) =>
    Alert.alert('Устгах уу?', `${contact.name} лавлахаас устгагдана. Баталгаажсан актуудад нэр нь хэвээр үлдэнэ.`, [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await actApi.deleteReceiverContact(contact.id);
            setForm(null);
            await load();
          } catch (e) {
            Alert.alert('Устгаж чадсангүй', actApi.actError(e));
          }
        },
      },
    ]);

  return (
    <>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.title}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListHeaderComponent={
          <>
            {header}
            <Box pad style={styles.intro}>
              <View style={styles.introRow}>
                <Ionicons name="people-outline" size={20} color={colors.brand} />
                <Text style={styles.introTitle}>Хүлээлцэх хүмүүс</Text>
                <Chip text={`${contacts.filter((c) => c.is_active).length} идэвхтэй`} tone="blue" />
              </View>
              <Text style={styles.introText}>
                Акт бичихэд захиалагчийн байгууллагын хүмүүс автоматаар орно. Чагтыг зөвхөн та (sysadmin) энд солино —
                бусад хүнд акт дээр харагдахгүй. Унтраасан хүн баталгаажаагүй актуудаас хасагдана.
              </Text>
              <Button title="+  Хүн нэмэх" size="sm" style={{ marginTop: 12 }} onPress={() => setForm({ ...EMPTY_CONTACT })} />
            </Box>
          </>
        }
        ListEmptyComponent={loading ? null : <EmptyBlock icon="people-outline" title="Хүн алга" text="«Хүн нэмэх»-ээр эхний хүнээ нэмнэ үү." />}
        renderItem={({ item: group }) => (
          <View style={{ marginBottom: 14 }}>
            <SectionHeader title={group.title} />
            {group.data.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => setForm({ ...c })}
                style={[styles.row, i === 0 && styles.rowFirst, i === group.data.length - 1 && styles.rowLast]}
                accessibilityRole="button"
                accessibilityLabel={`${c.name} засах`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, !c.is_active && { color: colors.faint }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{c.position || '—'}</Text>
                </View>
                <Switch
                  value={c.is_active}
                  disabled={busyId === c.id}
                  onValueChange={(v) => toggle(c, v)}
                  accessibilityLabel={`${c.name} — акт дээр гаргах`}
                />
              </Pressable>
            ))}
          </View>
        )}
      />

      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          {form ? (
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{form.id ? 'Хүн засах' : 'Хүн нэмэх'}</Text>
              <Segmented
                style={{ marginBottom: 12 }}
                value={form.audience_type}
                onChange={(v) => setForm((f) => ({ ...f, audience_type: v }))}
                options={[
                  { key: 'organization', label: 'Байгууллага' },
                  { key: 'household', label: 'Айл өрх' },
                ]}
              />
              <Field label="Байгууллага" value={form.organization} onChangeText={(v) => setForm((f) => ({ ...f, organization: v }))} placeholder="Жишээ: Юнивишн ХХК" />
              <Field label="Нэр" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Овог нэр" />
              <Field label="Албан тушаал" value={form.position} onChangeText={(v) => setForm((f) => ({ ...f, position: v }))} placeholder="Жишээ: Инженер" />
              <View style={styles.sheetActions}>
                {form.id ? <Button title="Устгах" variant="danger" style={{ flex: 1 }} onPress={() => remove(form)} /> : null}
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setForm(null)} />
                <Button title="Хадгалах" style={{ flex: 1.3 }} onPress={save} loading={saving} disabled={saving} />
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    body: { paddingHorizontal: 16, paddingBottom: 48 },
    intro: { marginBottom: 6 },
    introRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    introTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '700' },
    introText: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.card, marginBottom: 12, ...shadow.md },
    searchInput: { flex: 1, color: colors.ink, fontSize: 15, padding: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
    rowFirst: { borderTopWidth: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    rowLast: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    name: { color: colors.ink, fontSize: 15, fontWeight: '600' },
    meta: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
    modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,34,0.45)' },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
    sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginBottom: 14 },
    sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  });
