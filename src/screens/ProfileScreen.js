import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { uploadAvatar } from '../services/attendanceService';
import { Card, Button, Field, Badge, ScreenHeader, SectionTitle } from '../components/ui';
import QRCode from '../components/QRCode';
import { formatEmployeeBadge } from '../lib/employeeBadge';
import * as vehicleApi from '../services/vehicleService';
import { roleLabel } from '../lib/roles';
import { DEVELOPER_LABEL, SUPERADMIN_EMAIL, HAS_DEVELOPER_EMAIL } from '../lib/developerConfig';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const THEME_OPTIONS = [
  { key: 'light', label: 'Цайвар', icon: '☀' },
  { key: 'dark', label: 'Бараан', icon: '☾' },
  { key: 'system', label: 'Систем', icon: '⚙' },
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors, mode, setMode } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile, profile, isAdmin, isSuperAdmin, isCloud, signOut, updateMyProfile } = useApp();
  const canEdit = isAdmin;
  const canEditAvatar = !!authProfile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: authProfile?.name || '',
    position: authProfile?.position || '',
    phone: authProfile?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [withDriver, setWithDriver] = useState(null);

  useEffect(() => {
    if (!isCloud || !authProfile?.id || isAdmin) return;
    let active = true;
    (async () => {
      try {
        const row = await vehicleApi.fetchMyActivePassengerTrip(authProfile.id);
        if (active) setWithDriver(row?.trips || null);
      } catch (e) {}
    })();
    return () => {
      active = false;
    };
  }, [isCloud, authProfile?.id, isAdmin]);

  const name = authProfile?.name || profile?.name || 'Ажилтан';
  const email = authProfile?.email || '—';
  const avatarUrl = authProfile?.avatar_url;

  const applyPickedImage = async (uri) => {
    if (!canEditAvatar) return;
    if (!isCloud || !authProfile) {
      Alert.alert('Боломжгүй', 'Профайл зураг хадгалахад Supabase холболт шаардлагатай.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(uri, authProfile.id);
      await updateMyProfile({ avatar_url: url });
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled) applyPickedImage(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Камерт хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled) applyPickedImage(res.assets[0].uri);
  };

  const changeAvatar = () => {
    if (!canEditAvatar) return;
    Alert.alert('Профайл зураг', 'Зургаа хаанаас сонгох вэ?', [
      { text: 'Зургийн сангаас', onPress: pickFromLibrary },
      { text: 'Камераар авах', onPress: takePhoto },
      { text: 'Болих', style: 'cancel'},
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        name: form.name.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
      });
      setEditing(false);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Гарах', 'Та системээс гарахдаа итгэлтэй байна уу?', [
      { text: 'Болих', style: 'cancel'},
      { text: 'Гарах', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader back={false} title="Профайл" subtitle={isCloud ? 'Supabase холбогдсон' : 'Локал горим'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Card borderless style={styles.hero}>
          <TouchableOpacity
            activeOpacity={canEditAvatar ? 0.85 : 1}
            onPress={changeAvatar}
            disabled={uploading || !canEditAvatar}
          >
            <View style={styles.avatar}>
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            {canEditAvatar ? (
              <View style={styles.camBadge}>
                <Text style={{ fontSize: 14 }}></Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          <Badge
            text={roleLabel(authProfile?.role || 'employee')}
            color={isAdmin ? colors.accent : colors.primary}
          />
        </Card>

        {withDriver ? (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionTitle>Хамт яваа аялал</SectionTitle>
            <Text style={styles.withDriverLabel}>Жолооч</Text>
            <Text style={styles.withDriverName}>{withDriver.driver_name || '—'}</Text>
            <Text style={styles.withDriverSub}>
              {withDriver.plate_number || 'Машин'} · идэвхтэй аялал
            </Text>
          </Card>
        ) : null}

        {authProfile && !isAdmin ? (
          <Card style={{ marginTop: spacing.lg, alignItems: 'center'}}>
            <SectionTitle>Миний QR</SectionTitle>
            <Text style={styles.qrHint}>
              Жолооч хамт яваа хүн болгох эсвэл ганцаараа аялал эхлүүлэхэд энэ QR-ыг уншуулна
            </Text>
            <View style={styles.qrBox}>
              <QRCode value={formatEmployeeBadge(authProfile.id)} size={200} />
            </View>
          </Card>
        ) : null}

        {authProfile ? (
          canEdit && editing ? (
            <Card>
              <SectionTitle>Мэдээлэл засах</SectionTitle>
              <Field label="Нэр" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
              <Field label="Албан тушаал" value={form.position} onChangeText={(t) => setForm({ ...form, position: t })} />
              <Field label="Утас" keyboardType="phone-pad" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} />
              <View style={styles.row}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setEditing(false)} />
                <Button title={saving ? '...' : 'Хадгалах'} style={{ flex: 1 }} onPress={handleSave} disabled={saving} />
              </View>
            </Card>
          ) : (
            <Card>
              <InfoRow label="Нэр" value={authProfile.name || '—'} />
              <InfoRow label="Албан тушаал" value={authProfile.position || '—'} />
              <InfoRow label="Утас" value={authProfile.phone || '—'} />
              <InfoRow label="Эрх" value={roleLabel(authProfile?.role || 'employee')} last />
              {canEdit ? (
                <Button
                  title="Мэдээлэл засах" variant="ghost"
                  style={{ marginTop: spacing.md }}
                  onPress={() => {
                    setForm({
                      name: authProfile.name || '',
                      position: authProfile.position || '',
                      phone: authProfile.phone || '',
                    });
                    setEditing(true);
                  }}
                />
              ) : (
                <Text style={styles.lockedNote}>
                  Нэр, утас, албан тушаалыг админ засна. Профайл зураг дээр дарж солино.
                </Text>
              )}
            </Card>
          )
        ) : (
          <Text style={styles.note}>Нэвтэрсэн хэрэглэгчийн мэдээлэл энд харагдана.</Text>
        )}

        {authProfile ? (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionTitle>{DEVELOPER_LABEL}тэй холбогдох</SectionTitle>
            <InfoRow label="Холбоо барих имэйл" value={HAS_DEVELOPER_EMAIL ? SUPERADMIN_EMAIL : 'Тохируулаагүй'} />
            <Button
              title="Мэдээ илгээх"
              variant="ghost"
              style={{ marginTop: spacing.sm }}
              onPress={() => navigation.navigate('DeveloperContact')}
            />
            {isSuperAdmin ? (
              <Button
                title="Над руу ирсэн мэдээ"
                style={{ marginTop: spacing.sm }}
                onPress={() => navigation.navigate('DeveloperInbox')}
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>Харагдац</SectionTitle>
          <Text style={styles.themeHint}>Апп-ын өнгө горимыг сонгоно уу.</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = mode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.themeOption, active && styles.themeOptionActive]}
                  onPress={() => setMode(opt.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.themeIcon, active && styles.themeIconActive]}>{opt.icon}</Text>
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="Системээс гарах" variant="danger" size="lg" style={{ marginTop: spacing.lg }} onPress={confirmSignOut} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 44 },
  avatarLetter: { color: colors.primary, fontSize: 34, fontWeight: '800'},
  camBadge: {
    position: 'absolute',
    right: 0,
    bottom: spacing.md,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 22, fontWeight: '900'},
  email: { color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '700'},
  lockedNote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
    textAlign: 'center',
    backgroundColor: colors.bgAlt,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  note: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg },
  qrHint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: spacing.md },
  qrBox: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  withDriverLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  withDriverName: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  withDriverSub: { color: colors.primary, fontSize: 13, marginTop: 4, fontWeight: '600' },
  themeHint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    gap: 4,
  },
  themeOptionActive: {
    borderColor: colors.primaryContainer,
    backgroundColor: colors.primarySoft,
  },
  themeIcon: { fontSize: 20, color: colors.textMuted },
  themeIconActive: { color: colors.primary },
  themeLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  themeLabelActive: { color: colors.primary },
});
