import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Modal,
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { Button, Field, ScreenHeader } from '../components/ui';
import { Box, Chip, EmptyBlock, FilterChips, PillButton } from '../components/ds';
import * as fieldApi from '../services/fieldWorkService';

const KINDS = fieldApi.FIELD_WORK_KINDS;
const EMPTY = { before: null, after: null, gps: null, code: '', note: '' };

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const openMap = (lat, lng) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);

/**
 * Боксны таг / Шилжүүлэг.
 *
 *   route.params.kind: 'box_tag' | 'transfer' | 'all' (удирдлагын тойм)
 *
 * Шинэ тэмдэглэл: өмнөх, дараах зургийг ЗААВАЛ камераар авна. Зураг авах
 * бүрд GPS автоматаар сонгогдоно (хоёр дахь зургийн байршлыг эцсийнх гэж
 * авна). Ахлах+ бүх ажилтны тэмдэглэлийг харна.
 */
export default function FieldWorkScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile, currentUser, isManager, isCloud } = useApp();
  const routeKind = route.params?.kind || 'all';
  const fixedKind = KINDS[routeKind] ? routeKind : null;

  const [filter, setFilter] = useState('all');
  const [records, setRecords] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // { kind, ...EMPTY }
  const [capturing, setCapturing] = useState(null); // 'before' | 'after'
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  const kind = fixedKind || filter;
  const user = useMemo(
    () => ({ id: authProfile?.id || currentUser?.id, name: authProfile?.name || currentUser?.name }),
    [authProfile?.id, authProfile?.name, currentUser?.id, currentUser?.name]
  );

  const load = useCallback(async () => {
    if (!isCloud) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fieldApi.fetchRecords({ kind });
      setRecords(rows);
      setUrls(await fieldApi.photoUrls(rows).catch(() => ({})));
      // Push («Энэ бокс дүүрэн байна») дээр дарж орсон бол тэр боксыг нээнэ.
      const openId = route.params?.recordId;
      if (openId) {
        const hit = rows.find((r) => r.id === openId);
        if (hit) setDetail(hit);
        navigation.setParams({ recordId: undefined });
      }
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Мэдээлэл татагдсангүй.');
    } finally {
      setLoading(false);
    }
  }, [isCloud, kind, route.params?.recordId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Камераар зураг авч, тэр мөчийн GPS-ийг автоматаар бүртгэнэ. */
  const capture = async (slot) => {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) return Alert.alert('Зөвшөөрөл', 'Камерт хандах зөвшөөрөл өгнө үү.');
      const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (res.canceled) return;
      const shot = { uri: res.assets[0].uri, takenAt: new Date().toISOString() };
      setForm((f) => ({ ...f, [slot]: shot }));
      setCapturing(slot);
      let gps = null;
      try {
        const loc = await Location.requestForegroundPermissionsAsync();
        if (loc.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        }
      } catch (e) {
        gps = null;
      }
      // Дараах зургийн байршил давуу; өмнөх нь нөөц.
      setForm((f) => (f && gps && (slot === 'after' || KINDS[f.kind].single || !f.gps) ? { ...f, gps } : f));
      if (!gps) Alert.alert('GPS', 'Байршил тодорхойлогдсонгүй. GPS асаалттай эсэхийг шалгаад зургаа дахин авна уу.');
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Зураг авч чадсангүй.');
    } finally {
      setCapturing(null);
    }
  };

  const submit = async () => {
    const single = KINDS[form.kind].single;
    if (!form.before || (!single && !form.after)) {
      return Alert.alert('Зураг дутуу', single ? 'Боксны зургийг авна уу.' : 'Өмнөх, дараах зургийг заавал авна уу.');
    }
    if (!form.gps) return Alert.alert('GPS', 'Байршил бүртгэгдээгүй байна. Зургаа GPS асаалттай үед дахин авна уу.');
    setSaving(true);
    try {
      await fieldApi.createRecord({ kind: form.kind, user, before: form.before, after: form.after, gps: form.gps, code: form.code, note: form.note });
      setForm(null);
      Alert.alert(
        'Илгээгдлээ',
        form.kind === 'box_full'
          ? 'Байршил хадгалагдлаа. Энэ байршилд ойртсон ажилтанд «Энэ бокс дүүрэн байна» гэж зурагтай мэдэгдэл очно.'
          : `${KINDS[form.kind].title} гэж тэмдэглэгдлээ.`
      );
      load();
    } catch (e) {
      Alert.alert('Илгээж чадсангүй', e?.message || 'Дахин оролдоно уу.');
    } finally {
      setSaving(false);
    }
  };

  const startNew = (k) => setForm({ kind: k, ...EMPTY });

  const remove = (rec) =>
    Alert.alert('Устгах уу?', 'Энэ тэмдэглэл, зургууд бүрмөсөн устна.', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await fieldApi.deleteRecord(rec);
            setDetail(null);
            load();
          } catch (e) {
            Alert.alert('Алдаа', e?.message || 'Устгаж чадсангүй.');
          }
        },
      },
    ]);

  const resolve = async (rec) => {
    try {
      await fieldApi.resolveFullBox(rec.id);
      setDetail(null);
      load();
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Хадгалж чадсангүй.');
    }
  };

  const title = fixedKind ? KINDS[fixedKind].label : 'Таг, шилжүүлэг, бокс';

  const renderPhotoSlot = (slot, label) => {
    const shot = form?.[slot];
    return (
      <Pressable style={styles.slot} onPress={() => capture(slot)} disabled={!!capturing || saving} accessibilityRole="button" accessibilityLabel={`${label} авах`}>
        {shot ? <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} /> : null}
        <View style={[styles.slotInner, shot && styles.slotInnerShot]}>
          {capturing === slot ? (
            <ActivityIndicator color={shot ? '#FFFFFF' : colors.brand} />
          ) : (
            <Ionicons name={shot ? 'refresh' : 'camera-outline'} size={shot ? 18 : 28} color={shot ? '#FFFFFF' : colors.brand} />
          )}
          <Text style={[styles.slotText, shot && { color: '#FFFFFF' }]}>{shot ? `${label} · дахин авах` : label}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={title}
        subtitle={isManager ? 'Бүх ажилтны тэмдэглэл' : 'Миний тэмдэглэл'}
        right={fixedKind ? <PillButton title="Шинэ" icon="add" onPress={() => startNew(fixedKind)} /> : null}
      />
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListHeaderComponent={
          !fixedKind ? (
            <FilterChips
              style={styles.chips}
              value={filter}
              onChange={setFilter}
              items={[
                { key: 'all', label: 'Бүгд' },
                { key: 'box_tag', label: KINDS.box_tag.label },
                { key: 'transfer', label: KINDS.transfer.label },
                { key: 'box_full', label: KINDS.box_full.label },
              ]}
            />
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyBlock
              ph={fixedKind ? KINDS[fixedKind].icon : 'map-pin'}
              title="Тэмдэглэл алга"
              text={
                fixedKind === 'box_full'
                  ? 'Дүүрсэн боксны зургийг авахад байршил шууд хадгалагдаж, тэнд ойртсон ажилтанд мэдэгдэл очно.'
                  : fixedKind
                    ? 'Өмнөх, дараах зургаа авч илгээхэд байршил автоматаар бүртгэгдэнэ.'
                    : 'Ажилтнууд илгээсэн тэмдэглэл энд гарна.'
              }
            />
          )
        }
        renderItem={({ item }) => {
          const k = KINDS[item.kind] || KINDS.box_tag;
          const code = item.box_code || item.customer;
          return (
            <Box style={styles.card} onPress={() => setDetail(item)}>
              <View style={styles.pair}>
                {[item.before_path, item.after_path].filter(Boolean).map((p, i) => (
                  <View key={p || i} style={styles.thumbWrap}>
                    {urls[p] ? <Image source={{ uri: urls[p] }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.field }]} />}
                    {item.after_path ? <Text style={styles.thumbTag}>{i === 0 ? 'Өмнө' : 'Дараа'}</Text> : null}
                  </View>
                ))}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{code || k.title}</Text>
                  {item.kind === 'box_full' ? (
                    <Chip text={item.resolved_at ? 'Шийдсэн' : 'Дүүрэн'} tone={item.resolved_at ? 'ok' : 'warn'} />
                  ) : (
                    <Chip text={k.label} tone={item.kind === 'transfer' ? 'blue' : 'ok'} />
                  )}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {[item.created_by_name, fmt(item.created_at)].filter(Boolean).join(' · ')}
                </Text>
                {item.latitude != null ? (
                  <Text style={styles.gpsLine} numberOfLines={1}>
                    <Ionicons name="location" size={12} color={colors.ok} /> {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </Text>
                ) : null}
              </View>
            </Box>
          );
        }}
      />

      {/* Шинэ тэмдэглэл */}
      <Modal visible={!!form} animationType="slide" onRequestClose={() => !saving && setForm(null)}>
        {form ? (
          <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.formHead}>
              <Pressable onPress={() => !saving && setForm(null)} hitSlop={10} accessibilityLabel="Хаах">
                <Ionicons name="close" size={26} color={colors.ink} />
              </Pressable>
              <Text style={styles.formTitle}>{KINDS[form.kind].title}</Text>
              <View style={{ width: 26 }} />
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Box pad>
                  <Text style={styles.secTitle}>Зураг (заавал)</Text>
                  <View style={styles.slots}>
                    {KINDS[form.kind].single ? (
                      renderPhotoSlot('before', 'Боксны зураг')
                    ) : (
                      <>
                        {renderPhotoSlot('before', 'Өмнөх зураг')}
                        {renderPhotoSlot('after', 'Дараах зураг')}
                      </>
                    )}
                  </View>
                  <View style={[styles.gps, { backgroundColor: form.gps ? colors.okSoft : colors.field }]}>
                    <Ionicons name={form.gps ? 'location' : 'location-outline'} size={18} color={form.gps ? colors.ok : colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.gpsTitle, { color: form.gps ? colors.ok : colors.muted }]}>
                        {form.gps ? 'GPS автоматаар сонгогдлоо' : 'Зураг авахад GPS автоматаар сонгогдоно'}
                      </Text>
                      {form.gps ? (
                        <Text style={styles.meta}>
                          {form.gps.latitude.toFixed(6)}, {form.gps.longitude.toFixed(6)}
                          {form.gps.accuracy ? ` · ±${Math.round(form.gps.accuracy)} м` : ''}
                        </Text>
                      ) : null}
                    </View>
                    {form.gps ? (
                      <Pressable onPress={() => openMap(form.gps.latitude, form.gps.longitude)} hitSlop={8}>
                        <Text style={styles.link}>Газрын зураг</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Box>
                <Box pad>
                  <Field
                    label={KINDS[form.kind].codeLabel}
                    value={form.code}
                    onChangeText={(code) => setForm((f) => ({ ...f, code }))}
                    placeholder={KINDS[form.kind].codePlaceholder}
                  />
                  <Field
                    label="Тайлбар"
                    multiline
                    value={form.note}
                    onChangeText={(note) => setForm((f) => ({ ...f, note }))}
                    placeholder="Нэмэлт мэдээлэл"
                  />
                </Box>
              </ScrollView>
            </KeyboardAvoidingView>
            <View style={styles.footbar}>
              <Button
                title="Илгээх"
                onPress={submit}
                loading={saving}
                disabled={saving || !!capturing || !form.before || (!KINDS[form.kind].single && !form.after)}
                style={{ flex: 1 }}
              />
            </View>
          </SafeAreaView>
        ) : null}
      </Modal>

      {/* Дэлгэрэнгүй */}
      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        {detail ? (
          <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.formHead}>
              <Pressable onPress={() => setDetail(null)} hitSlop={10} accessibilityLabel="Хаах">
                <Ionicons name="close" size={26} color={colors.ink} />
              </Pressable>
              <Text style={styles.formTitle}>{(KINDS[detail.kind] || KINDS.box_tag).title}</Text>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={styles.body}>
              {[
                [detail.after_path ? 'Өмнөх зураг' : 'Зураг', detail.before_path, detail.before_taken_at],
                ['Дараах зураг', detail.after_path, detail.after_taken_at],
              ]
                .filter(([, p]) => p)
                .map(([label, p, at]) => (
                <Box key={label} style={{ marginBottom: 12, overflow: 'hidden' }}>
                  {urls[p] ? <Image source={{ uri: urls[p] }} style={styles.big} resizeMode="cover" /> : <View style={[styles.big, { backgroundColor: colors.field }]} />}
                  <View style={styles.bigCap}>
                    <Text style={styles.cardTitle}>{label}</Text>
                    <Text style={styles.meta}>{fmt(at)}</Text>
                  </View>
                </Box>
              ))}
              <Box pad>
                {[
                  [(KINDS[detail.kind] || KINDS.box_tag).codeLabel, detail.box_code || detail.customer],
                  ['Ажилтан', detail.created_by_name],
                  ['Огноо', fmt(detail.created_at)],
                  ['Тайлбар', detail.note],
                  ['Шийдсэн', detail.resolved_at ? [detail.resolved_by_name, fmt(detail.resolved_at)].filter(Boolean).join(' · ') : ''],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <View key={k} style={styles.kv}>
                      <Text style={styles.kvLabel}>{k}</Text>
                      <Text style={styles.kvValue}>{v}</Text>
                    </View>
                  ))}
                {detail.latitude != null ? (
                  <Pressable style={styles.kv} onPress={() => openMap(detail.latitude, detail.longitude)}>
                    <Text style={styles.kvLabel}>Байршил</Text>
                    <Text style={[styles.kvValue, { color: colors.brand }]}>
                      {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)} ›
                    </Text>
                  </Pressable>
                ) : null}
              </Box>
              {detail.kind === 'box_full' && !detail.resolved_at ? (
                <Button title="Бокс хоосорсон — шийдсэн" variant="success" icon="checkmark-circle-outline" onPress={() => resolve(detail)} style={{ marginTop: 8 }} />
              ) : null}
              {authProfile?.role === 'admin' || authProfile?.role === 'superadmin' ? (
                <Button title="Устгах" variant="danger" onPress={() => remove(detail)} style={{ marginTop: 8 }} />
              ) : null}
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    body: { paddingHorizontal: 16, paddingBottom: 48 },
    chips: { marginHorizontal: -16, marginBottom: 14 },
    card: { flexDirection: 'row', gap: 12, padding: 12, marginBottom: 12 },
    pair: { flexDirection: 'row', gap: 6 },
    thumbWrap: { width: 58, height: 58, borderRadius: 12, overflow: 'hidden' },
    thumb: { width: 58, height: 58 },
    thumbTag: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 2, textAlign: 'center', color: '#FFFFFF', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.5)' },
    cardBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' },
    meta: { color: colors.muted, fontSize: 12.5, marginTop: 3 },
    gpsLine: { color: colors.ok, fontSize: 12, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] },
    formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    formTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 17, fontWeight: '700' },
    secTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 12 },
    slots: { flexDirection: 'row', gap: 10 },
    slot: { flex: 1, aspectRatio: 0.85, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.brandSoft },
    slotInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 },
    slotInnerShot: { justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
    slotText: { color: colors.brand, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    gps: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: 14 },
    gpsTitle: { fontSize: 13.5, fontWeight: '700' },
    link: { color: colors.brand, fontSize: 13, fontWeight: '700' },
    footbar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
    big: { width: '100%', aspectRatio: 4 / 3 },
    bigCap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
    kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
    kvLabel: { color: colors.muted, fontSize: 14 },
    kvValue: { color: colors.ink, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  });
