import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, Field, Button } from '../components/ui';
import RequestTypeSheet from '../components/RequestTypeSheet';
import { useApp } from '../context/AppContext';
import { dayKey } from '../lib/workHours';
import { imageQuality } from '../lib/performanceMode';
import {
  attendanceRequestTypeLabel,
  attendanceRequestTypeMeta,
} from '../lib/attendanceRequestTypes';
import * as reqApi from '../services/attendanceRequestService';
import { friendlyError } from '../lib/erpMessages';
import { colors } from '../theme/attendanceLight';
import { spacing } from '../theme';

async function pickImage() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Зөвшөөрөл', 'Зургийн сан ашиглах зөвшөөрөл шаардлагатай.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: imageQuality(),
    allowsEditing: false,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

const MN_WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

/** `2026-08-31` дээр N хоног нэмнэ/хасна. */
function shiftDay(key, delta) {
  const [y, m, d] = String(key).split('-').map(Number);
  // ⚠️ Сарын зааг дээр өөрөө зөв шилжинэ (Date-ийн сарын арифметик).
  const dt = new Date(y, m - 1, d + delta);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** "Өчигдөр · Бямба" мэтээр — огноо таних амархан болно. */
function humanDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const today = dayKey();
  if (key === today) return 'Өнөөдөр';
  if (key === shiftDay(today, -1)) return `Өчигдөр · ${MN_WEEKDAYS[dt.getDay()]}`;
  return MN_WEEKDAYS[dt.getDay()];
}

export default function AttendanceRequestFormScreen() {
  const navigation = useNavigation();
  const { currentUser } = useApp();
  const profile = currentUser;

  const [sheetVisible, setSheetVisible] = useState(false);
  const [type, setType] = useState(null);
  const [direction, setDirection] = useState('check_in'); // remote_check_in/out хоёрын хооронд
  const [reason, setReason] = useState('');
  const [requestedTime, setRequestedTime] = useState('09:00');
  /**
   * Хүсэлт хамаарах ӨДӨР.
   *
   * ⚠️ Өмнө нь `dayKey()` гэж ҮРГЭЛЖ өнөөдрийг бичдэг байсан тул
   *    "нөхөж бүртгүүлэх" сонгосон ч өнөөдрийн ирц болж, утгаа
   *    алддаг байв — нөхөх гэдэг нь өнгөрсөн өдрийн ирц.
   */
  const [requestedDate, setRequestedDate] = useState(dayKey());
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  const meta = type ? attendanceRequestTypeMeta(type) : null;
  const isRemoteKind = type === 'remote_check_in' || type === 'remote_check_out';
  // Ирэх/Явах сонголт хэрэгтэй төрлүүд: зайнаас бүртгүүлэх (төрөл нь өөрөө
  // хоёр хуваагддаг) болон ирц засуулах (`direction` багана руу бичнэ).
  const needsDirection = isRemoteKind || !!meta?.needsDirection;

  const effectiveType = isRemoteKind
    ? direction === 'check_in'
      ? 'remote_check_in'
      : 'remote_check_out'
    : type;

  // Төрөл солиход огноог зохистой утга руу сэргээнэ: нөхөх бол
  // өчигдөр (хамгийн түгээмэл), бусад бол өнөөдөр.
  React.useEffect(() => {
    if (!meta) return;
    setRequestedDate(meta.needsPastDate ? shiftDay(dayKey(), -1) : dayKey());
  }, [type, meta]);

  const addPhoto = async () => {
    const uri = await pickImage();
    if (uri) setPhotos((prev) => [...prev, uri]);
  };

  const removePhoto = (uri) => setPhotos((prev) => prev.filter((p) => p !== uri));

  const submit = async () => {
    if (!type) {
      Alert.alert('Төрөл сонгоно уу', 'Хүсэлтийн төрлөө сонгоно уу.');
      return;
    }
    setBusy(true);
    try {
      const attachments = [];
      if (meta?.needsAttachment) {
        for (const uri of photos) {
          const url = await reqApi.uploadAttachment(uri, profile.id);
          attachments.push(url);
        }
      }
      await reqApi.submitAttendanceRequest({
        employeeId: profile.id,
        employeeName: profile.name,
        type: effectiveType,
        requestedDate,
        requestedTime: meta?.needsTimeRange ? requestedTime : null,
        direction: needsDirection ? direction : null,
        reason,
        attachments,
      });
      Alert.alert('Илгээгдлээ', 'Таны хүсэлт админд илгээгдлээ.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Хүсэлт илгээх" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <TouchableOpacity
          style={[styles.typeCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>Хүсэлтийн төрөл</Text>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {type ? attendanceRequestTypeLabel(effectiveType) : 'Хүсэлтийн төрөл сонгох'}
          </Text>
        </TouchableOpacity>

        {needsDirection ? (
          <View style={[styles.segmentRow, { borderColor: colors.border }]}>
            {['check_in', 'check_out'].map((d) => {
              const active = direction === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.segmentBtn,
                    active && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                  ]}
                  onPress={() => setDirection(d)}
                >
                  <Text style={{ color: active ? colors.primary : colors.textMuted, fontWeight: '700' }}>
                    {d === 'check_in' ? 'Ирэх' : 'Явах'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {meta?.needsPastDate ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
              Аль өдрийн ирц вэ?
            </Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.dateStep, { borderColor: colors.border }]}
                onPress={() => setRequestedDate((d) => shiftDay(d, -1))}
                hitSlop={8}
              >
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>‹</Text>
              </TouchableOpacity>

              <View style={[styles.dateValue, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                  {requestedDate}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {humanDay(requestedDate)}
                </Text>
              </View>

              {/* Ирээдүйн өдрийг нөхөж бүртгэх боломжгүй — товч идэвхгүй. */}
              <TouchableOpacity
                style={[
                  styles.dateStep,
                  { borderColor: colors.border },
                  requestedDate >= dayKey() && { opacity: 0.35 },
                ]}
                onPress={() => setRequestedDate((d) => (d < dayKey() ? shiftDay(d, 1) : d))}
                disabled={requestedDate >= dayKey()}
                hitSlop={8}
              >
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {meta?.needsTimeRange ? (
          <Field
            label="Цаг (HH:MM)"
            value={requestedTime}
            onChangeText={setRequestedTime}
            placeholder="09:00"
            style={{ marginTop: spacing.md }}
          />
        ) : null}

        <Field
          label="Тайлбар"
          placeholder="Тайлбараа бичнэ үү"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          style={{ marginTop: spacing.md, minHeight: 100, textAlignVertical: 'top' }}
        />

        {meta?.needsAttachment ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Хавсралт зургууд</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {photos.map((uri) => (
                <View key={uri} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity style={styles.photoDelete} onPress={() => removePhoto(uri)}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addPhotoBtn, { borderColor: colors.border }]}
                onPress={addPhoto}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Зураг нэмэх</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Button title="Цуцлах" variant="ghost" style={{ flex: 1 }} onPress={() => navigation.goBack()} />
        <Button
          title="Баталгаажуулах"
          style={{ flex: 1 }}
          onPress={submit}
          disabled={busy}
          loading={busy}
        />
      </View>

      <RequestTypeSheet
        visible={sheetVisible}
        colors={colors}
        selectedKey={type}
        onClose={() => setSheetVisible(false)}
        onSelect={(key) => {
          setType(key);
          setSheetVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  dateStep: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
  },
  dateValue: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  typeCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
  segmentRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoWrap: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoDelete: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
});
