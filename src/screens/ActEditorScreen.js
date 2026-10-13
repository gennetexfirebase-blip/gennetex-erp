import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Field, ScreenHeader, Button, LoadingState } from '../components/ui';
import { Box, Segmented } from '../components/ds';
import { requestLibraryAccess } from '../lib/mediaLibraryAccess';
import * as actApi from '../services/actService';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Акт бичих / засах (зөвхөн ноорог үед).
 *
 * Хадгалах — ноорог. Илгээх — хадгалаад Захирал, sysadmin руу илгээнэ;
 * илгээсний дараа засах боломжгүй (Захирал буцаавал дахин засна).
 */
export default function ActEditorScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile } = useApp();

  const [actId, setActId] = useState(route.params?.id || null);
  const [act, setAct] = useState(null);
  const [draft, setDraft] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isSysadmin = authProfile?.role === 'superadmin';
  const canStamp = isSysadmin || authProfile?.permissions?.['acts.stamp'] === true;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const contactRows = await actApi.fetchReceiverContacts().catch(() => []);
        if (alive) setContacts(contactRows);
        // Вэбтэй ижил: Захирал үргэлж, захиалагч таарвал түүний бүрэлдэхүүн автоматаар.
        const withReceivers = (d) => {
          const hasCustomer = d.receivers.some((r) => r.type !== 'contractor');
          const org = hasCustomer ? '' : actApi.autoReceiverOrganization(contactRows, d.customer_name);
          const auto = actApi.receiversFor(contactRows, org, d.receivers, { canStamp });
          if (hasCustomer) {
            const missing = auto.filter((r) => !d.receivers.some((x) => x.contact_id === r.contact_id));
            return missing.length ? { ...d, receivers: [...d.receivers, ...missing] } : d;
          }
          return auto.length ? { ...d, receivers: auto } : d;
        };
        if (actId) {
          const row = await actApi.fetchAct(actId);
          if (!alive) return;
          setAct(row);
          const d = actApi.draftFromAct(row);
          setDraft(row.status === 'draft' ? withReceivers(d) : d);
        } else {
          const tpl = await actApi.fetchDefaultTemplate().catch(() => null);
          if (alive) setDraft(withReceivers(actApi.emptyDraft(tpl)));
        }
      } catch (e) {
        Alert.alert('Алдаа', actApi.actError(e));
        navigation.goBack();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading || !draft) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={actId ? 'Акт засах' : 'Шинэ акт'} />
        <LoadingState />
      </View>
    );
  }

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const customers = actApi.customerOptions(contacts);
  const chooseCustomer = (option) =>
    setDraft((d) => ({
      ...d,
      customer_name: option.label,
      receivers: actApi.receiversFor(contacts, option.organization, d.receivers, { canStamp }),
    }));
  const toggleReceiver = (i) => {
    if (!isSysadmin) return;
    setDraft((d) => ({ ...d, receivers: d.receivers.map((r, k) => (k === i ? { ...r, is_enabled: !r.is_enabled } : r)) }));
  };
  const setMaterial = (i, patch) =>
    setDraft((d) => ({ ...d, materials: d.materials.map((m, k) => (k === i ? { ...m, ...patch } : m)) }));
  const setCheck = (i, patch) =>
    setDraft((d) => ({ ...d, checklists: d.checklists.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));

  const validate = (forSubmit) => {
    if (!draft.project_name.trim()) return 'Ажлын нэрийг оруулна уу.';
    for (const k of ['start_date', 'end_date']) {
      if (draft[k] && !DATE_RE.test(draft[k])) return 'Огноог 2026-10-11 хэлбэрээр оруулна уу.';
    }
    if (draft.start_date && draft.end_date && draft.end_date < draft.start_date) return 'Дууссан огноо эхэлсэн огнооноос өмнө байна.';
    if (forSubmit) {
      if (!draft.work_description.trim()) return 'Хийсэн ажлын тайлбарыг бичнэ үү.';
      const missing = draft.checklists.find((c) => c.result === 'no' && !String(c.reason || '').trim());
      if (missing) return `«${missing.requirement}» — «Үгүй» шалтгааныг бичнэ үү.`;
    }
    return null;
  };

  const persist = async () => {
    const payload = {
      ...draft,
      materials: draft.materials
        .filter((m) => String(m.material_name || '').trim())
        .map((m) => ({ ...m, quantity: Number(String(m.quantity).replace(',', '.')) || 0 })),
    };
    const id = await actApi.saveAct(actId, payload);
    setActId(id);
    return id;
  };

  const save = async () => {
    const err = validate(false);
    if (err) return Alert.alert('Анхааруулга', err);
    setSaving(true);
    try {
      await persist();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Алдаа', actApi.actError(e));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const err = validate(true);
    if (err) return Alert.alert('Анхааруулга', err);
    Alert.alert('Илгээх', 'Актыг Захирал болон sysadmin руу илгээх үү? Илгээсний дараа засах боломжгүй.', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Илгээх',
        onPress: async () => {
          setSaving(true);
          try {
            const id = await persist();
            const row = await actApi.fetchAct(id);
            await actApi.submitAct(row, { authorName: authProfile?.name });
            Alert.alert('Илгээгдлээ', 'Акт Захиралд илгээгдлээ. Баталгаажмагц танд мэдэгдэнэ.');
            navigation.goBack();
          } catch (e) {
            Alert.alert('Алдаа', actApi.actError(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const addPhoto = async (fromCamera) => {
    try {
      const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await requestLibraryAccess();
      if (!perm.granted) return Alert.alert('Зөвшөөрөл', fromCamera ? 'Камерт хандах зөвшөөрөл өгнө үү.' : 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (res.canceled) return;
      setUploading(true);
      // Зураг актын хавтсанд хадгалагддаг тул шинэ актыг эхлээд ноорог болгоно.
      const id = actId || (await persist());
      const up = await actApi.uploadActPhoto(id, res.assets[0].uri);
      setDraft((d) => ({
        ...d,
        photos: [
          ...d.photos,
          {
            storage_path: up.storage_path,
            image_url: '',
            preview_url: up.preview_url,
            caption: '',
            taken_at: new Date().toISOString(),
            taken_by_employee_id: authProfile?.id || null,
            taken_by_employee_name: authProfile?.name || '',
            source_kind: 'upload',
            source_id: null,
          },
        ],
      }));
    } catch (e) {
      Alert.alert('Алдаа', actApi.actError(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={actId ? 'Акт засах' : 'Шинэ акт'} subtitle={act?.act_number || 'Ноорог'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Box pad>
            <Text style={styles.secTitle}>Толгой мэдээлэл</Text>
            <Field label="Ажлын нэр" required value={draft.project_name} onChangeText={(v) => set({ project_name: v })} placeholder="Ж: Сүлжээний угсралт" />
            {customers.length ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.label}>Захиалагч байгууллага</Text>
                <View style={styles.custRow}>
                  {customers.map((o) => {
                    const on = draft.customer_name === o.label;
                    return (
                      <Pressable
                        key={o.label}
                        onPress={() => chooseCustomer(o)}
                        style={[styles.cust, on && styles.custOn]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        {on ? <Ionicons name="checkmark-circle" size={16} color={colors.brand} /> : null}
                        <Text style={[styles.custText, on && { color: colors.brand }]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Field
              label={customers.length ? 'Эсвэл захиалагчийн нэр' : 'Захиалагч'}
              value={draft.customer_name}
              onChangeText={(v) => set({ customer_name: v })}
              placeholder="Байгууллага эсвэл хүний нэр"
            />
            <Field label="Байршил" value={draft.location} onChangeText={(v) => set({ location: v })} placeholder="Дүүрэг, хороо, хаяг" />
            <View style={styles.two}>
              <Field style={{ flex: 1 }} label="Эхэлсэн" value={draft.start_date} onChangeText={(v) => set({ start_date: v.trim() })} placeholder="2026-10-11" keyboardType="numbers-and-punctuation" />
              <Field style={{ flex: 1 }} label="Дууссан" value={draft.end_date} onChangeText={(v) => set({ end_date: v.trim() })} placeholder="2026-10-11" keyboardType="numbers-and-punctuation" />
            </View>
            <Field label="Хийсэн ажил" required multiline value={draft.work_description} onChangeText={(v) => set({ work_description: v })} placeholder="Ямар ажил гүйцэтгэснээ дэлгэрэнгүй бичнэ үү" />
          </Box>

          <Box pad>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>Бараа материал</Text>
              <Pressable onPress={() => set({ materials: [...draft.materials, { material_id: null, material_name: '', unit: 'ширхэг', quantity: 1 }] })} hitSlop={8}>
                <Text style={styles.link}>+ Мөр нэмэх</Text>
              </Pressable>
            </View>
            {draft.materials.length === 0 ? <Text style={styles.muted}>Материал ашиглаагүй бол хоосон үлдээнэ.</Text> : null}
            {draft.materials.map((m, i) => (
              <View key={i} style={styles.irow}>
                <View style={styles.secRow}>
                  <Text style={styles.irowTitle}>Материал {i + 1}</Text>
                  <Pressable onPress={() => set({ materials: draft.materials.filter((_, k) => k !== i) })} hitSlop={8}>
                    <Text style={styles.del}>Устгах</Text>
                  </Pressable>
                </View>
                <Field label="Нэр" value={m.material_name} onChangeText={(v) => setMaterial(i, { material_name: v })} />
                <View style={styles.two}>
                  <Field style={{ flex: 1 }} label="Тоо" value={String(m.quantity ?? '')} onChangeText={(v) => setMaterial(i, { quantity: v })} keyboardType="decimal-pad" />
                  <Field style={{ flex: 1 }} label="Нэгж" value={m.unit} onChangeText={(v) => setMaterial(i, { unit: v })} />
                </View>
              </View>
            ))}
          </Box>

          {draft.checklists.length ? (
            <Box pad>
              <Text style={styles.secTitle}>Шалгах хуудас</Text>
              {draft.checklists.map((c, i) => (
                <View key={i} style={[styles.check, i > 0 && styles.checkBorder]}>
                  <Text style={styles.checkText}>{c.requirement}</Text>
                  <Segmented
                    value={c.result}
                    onChange={(v) => setCheck(i, { result: v })}
                    options={[
                      { key: 'yes', label: 'Тийм' },
                      { key: 'no', label: 'Үгүй' },
                      { key: 'na', label: 'Х/Б' },
                    ]}
                  />
                  {c.result === 'no' ? (
                    <Field style={{ marginTop: 10, marginBottom: 0 }} placeholder="Шалтгаан" value={c.reason} onChangeText={(v) => setCheck(i, { reason: v })} />
                  ) : null}
                </View>
              ))}
            </Box>
          ) : null}

          <Box pad>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>Зураг</Text>
              {uploading ? <ActivityIndicator color={colors.brand} /> : null}
            </View>
            <View style={styles.photos}>
              {draft.photos.map((p, i) => (
                <View key={p.storage_path || i} style={styles.photo}>
                  {p.preview_url || p.image_url ? <Image source={{ uri: p.preview_url || p.image_url }} style={styles.photoImg} /> : <Ionicons name="image-outline" size={24} color={colors.faint} />}
                  <Pressable style={styles.photoDel} onPress={() => set({ photos: draft.photos.filter((_, k) => k !== i) })} hitSlop={6} accessibilityLabel="Зураг хасах">
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addPhoto} onPress={() => addPhoto(true)} disabled={uploading} accessibilityLabel="Камераар авах">
                <Ionicons name="camera-outline" size={22} color={colors.brand} />
                <Text style={styles.addPhotoText}>Камер</Text>
              </Pressable>
              <Pressable style={styles.addPhoto} onPress={() => addPhoto(false)} disabled={uploading} accessibilityLabel="Сангаас сонгох">
                <Ionicons name="images-outline" size={22} color={colors.brand} />
                <Text style={styles.addPhotoText}>Сангаас</Text>
              </Pressable>
            </View>
          </Box>

          {/* Хүлээлцэх хүмүүсийг зөвхөн sysadmin харж, чагт солино. Бусдад
              (энгийн админ, Захирал) нуугдана — жагсаалт нь Акт → Тохиргоо →
              «Хүлээлцэх хүмүүс»-ийн тохиргооноос автоматаар бөглөгдөнө. */}
          {isSysadmin ? (
          <Box style={{ paddingVertical: 4 }}>
            <Text style={[styles.secTitle, { paddingHorizontal: 16, paddingTop: 12, marginBottom: 4 }]}>Хүлээлцэх хүмүүс</Text>
            <Text style={[styles.muted, { paddingHorizontal: 16, marginBottom: 6 }]}>
              Захиалагч сонгоход тэр байгууллагын хүмүүс автоматаар орно. Чагтласан хүн л актад гарна.
            </Text>
            {draft.receivers.map((r, i) => (
              <Pressable key={r.contact_id || `${r.name}-${i}`} style={styles.recv} onPress={() => toggleReceiver(i)} accessibilityRole="checkbox" accessibilityState={{ checked: r.is_enabled }}>
                <Ionicons name={r.is_enabled ? 'checkbox' : 'square-outline'} size={22} color={r.is_enabled ? colors.brand : colors.faint} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.recvName} numberOfLines={1}>{r.name || '—'}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{[r.position, r.organization].filter(Boolean).join(' · ')}</Text>
                </View>
                {r.type === 'contractor' && /захирал/i.test(r.position || '') ? <Text style={styles.recvTag}>Тамга баталгаажуулахад</Text> : null}
              </Pressable>
            ))}
            {!draft.receivers.length ? <Text style={[styles.muted, { padding: 16 }]}>Хүлээлцэх хүн алга.</Text> : null}
          </Box>
          ) : null}

          <Text style={styles.note}>
            Илгээсний дараа Захирал баталгаажуулахад Женнетексийн тамга автоматаар дарагдана. PDF / Word-ийг akt.gennetex.com-оос гаргана.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.footbar}>
        <Button title="Хадгалах" variant="ghost" style={{ flex: 1 }} onPress={save} disabled={saving || uploading} />
        <Button title="Илгээх" style={{ flex: 1.4 }} onPress={submit} loading={saving} disabled={saving || uploading} />
      </SafeAreaView>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    body: { paddingHorizontal: 16, paddingBottom: 40 },
    secTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 14 },
    secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    two: { flexDirection: 'row', gap: 12 },
    link: { color: colors.brand, fontSize: 14, fontWeight: '600', marginBottom: 14 },
    muted: { color: colors.muted, fontSize: 13 },
    irow: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginTop: 4, marginBottom: 8 },
    irowTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 10 },
    del: { color: colors.bad, fontSize: 13, fontWeight: '600', marginBottom: 10 },
    check: { paddingVertical: 12 },
    checkBorder: { borderTopWidth: 1, borderTopColor: colors.line },
    checkText: { color: colors.ink, fontSize: 14, fontWeight: '600', marginBottom: 10 },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    photo: { width: 90, height: 90, borderRadius: 14, backgroundColor: colors.field, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photoImg: { width: '100%', height: '100%' },
    photoDel: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
    addPhoto: { width: 90, height: 90, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', gap: 4 },
    addPhotoText: { color: colors.brand, fontSize: 12, fontWeight: '600' },
    note: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginHorizontal: 4, marginTop: 4 },
    label: { color: colors.muted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    custRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cust: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
    custOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
    custText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    recv: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
    recvName: { color: colors.ink, fontSize: 14.5, fontWeight: '600' },
    recvTag: { color: colors.brand, fontSize: 11, fontWeight: '700', maxWidth: 90, textAlign: 'right' },
    footbar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  });
