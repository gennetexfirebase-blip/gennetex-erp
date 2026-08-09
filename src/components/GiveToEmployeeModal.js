import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as invApi from '../services/inventoryService';

export default function GiveToEmployeeModal({
  visible,
  item,
  employees = [],
  onClose,
  onSubmit,
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [employeeId, setEmployeeId] = useState('');
  const [qty, setQty] = useState('1');
  const [photoUri, setPhotoUri] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      employees
        .filter((e) => e.id)
        .map((e) => ({ id: e.id, name: e.name || e.email || 'Ажилтан' })),
    [employees]
  );

  const selected = options.find((e) => e.id === employeeId);
  const maxQty = item?.quantity || 0;

  useEffect(() => {
    if (!visible) return;
    setEmployeeId(options[0]?.id || '');
    setQty('1');
    setPhotoUri(null);
    setListOpen(false);
    setSaving(false);
  }, [visible, item?.id, options]);

  const pickPhoto = async (useCamera) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Камер эсвэл зургийн сан ашиглах зөвшөөрөл шаардлагатай.');
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const submit = async () => {
    if (!employeeId) {
      Alert.alert('Анхаар', 'Ажилтан сонгоно уу.');
      return;
    }
    const q = Number(qty) || 0;
    if (q <= 0) {
      Alert.alert('Анхаар', 'Тоо хэмжээ оруулна уу.');
      return;
    }
    if (q > maxQty) {
      Alert.alert('Хүрэлцэхгүй', `Агуулахад ${maxQty} ${item?.unit || 'ширхэг'} л байна.`);
      return;
    }
    const emp = options.find((e) => e.id === employeeId);
    setSaving(true);
    try {
      let photoUrl = null;
      if (photoUri) {
        photoUrl = await invApi.uploadMovementPhoto(photoUri);
      }
      await onSubmit({
        employee: { id: employeeId, name: emp?.name || 'Ажилтан' },
        qty: q,
        photoUrl,
      });
      onClose();
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Олгоход алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Ажилтанд олгох</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSub}>Агуулахын үлдэгдэл: {item.quantity} {item.unit}</Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Ажилтан</Text>
            <TouchableOpacity style={styles.select} onPress={() => setListOpen((v) => !v)}>
              <Text style={styles.selectText}>{selected?.name || 'Сонгох'}</Text>
              <Ionicons name={listOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {listOpen ? (
              <View style={styles.options}>
                {options.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.option}
                    onPress={() => {
                      setEmployeeId(e.id);
                      setListOpen(false);
                    }}
                  >
                    <Text style={styles.optionText}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Тоо хэмжээ ({item.unit})</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.hint}>Боломжит: {maxQty} {item.unit}</Text>

            <Text style={styles.label}>Баталгаа зураг (заавал биш)</Text>
            {photoUri ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotoUri(null)}>
                  <Ionicons name="close-circle" size={24} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoBtns}>
                <TouchableOpacity style={styles.photoBtn} onPress={() => pickPhoto(true)}>
                  <Ionicons name="camera" size={20} color={colors.primary} />
                  <Text style={styles.photoBtnText}>Камер</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={() => pickPhoto(false)}>
                  <Ionicons name="images" size={20} color={colors.primary} />
                  <Text style={styles.photoBtnText}>Зураг</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submit, saving && styles.submitDisabled]}
            onPress={submit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Олгох</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  itemName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  itemSub: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: spacing.md },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
  },
  selectText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  options: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { color: colors.text, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.bg,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  photoWrap: { position: 'relative', marginTop: spacing.sm },
  photo: { width: '100%', height: 140, borderRadius: radius.md },
  photoRemove: { position: 'absolute', top: 8, right: 8 },
  photoBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgAlt,
  },
  photoBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  submit: {
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
