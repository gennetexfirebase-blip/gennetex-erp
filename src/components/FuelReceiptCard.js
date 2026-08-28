import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Card, SectionTitle } from './ui';
import * as receiptApi from '../services/fuelReceiptService';
import { friendlyError } from '../lib/erpMessages';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

/**
 * Бензиний баримт илгээх — ажилтны талд.
 *
 * Илгээхэд БҮХ админ руу ажилтны ӨӨРИЙНХ НЬ аккаунтаас чат мессеж
 * очно (зураг хавсаргасан). Тиймээс админ тодруулах зүйл гарвал тэр
 * даруй эргэж бичих боломжтой.
 */
export default function FuelReceiptCard({ sender, plate }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const [imageUri, setImageUri] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const pick = async (useCamera) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Камер эсвэл зургийн сан ашиглах зөвшөөрөл шаардлагатай.');
      return;
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });
    if (!res.canceled && res.assets?.[0]?.uri) setImageUri(res.assets[0].uri);
  };

  const send = async () => {
    if (!imageUri) {
      Alert.alert('Анхаар', 'Баримтын зургаа авна уу.');
      return;
    }
    setSending(true);
    try {
      const r = await receiptApi.sendFuelReceipt({
        sender,
        imageUri,
        amount: amount ? Number(amount) : null,
        plate,
        note: note.trim() || null,
      });
      setImageUri(null);
      setAmount('');
      setNote('');
      Alert.alert(
        'Илгээгдлээ',
        `${r.sent} админд баримт очлоо.` +
          (r.failed ? `\n${r.failed} админд илгээгдсэнгүй.` : '')
      );
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Бензиний баримт илгээх</SectionTitle>
      <Text style={styles.hint}>
        Баримтаа зурагдаад илгээхэд бүх админд таны нэрээс чат мессеж очно.
      </Text>

      {imageUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          <TouchableOpacity style={styles.remove} onPress={() => setImageUri(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={26} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickBtn} onPress={() => pick(true)}>
            <Ionicons name="camera" size={22} color={colors.primary} />
            <Text style={styles.pickText}>Зураг авах</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickBtn} onPress={() => pick(false)}>
            <Ionicons name="images" size={22} color={colors.primary} />
            <Text style={styles.pickText}>Сангаас</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
        placeholder="Дүн (₮) — заавал биш"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="Тэмдэглэл — заавал биш"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <TouchableOpacity
        style={[styles.send, (sending || !imageUri) && styles.sendOff]}
        onPress={send}
        disabled={sending || !imageUri}
        activeOpacity={0.85}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="paper-plane" size={17} color="#fff" />
            <Text style={styles.sendText}>Админд илгээх</Text>
          </>
        )}
      </TouchableOpacity>
    </Card>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.md },

  pickRow: { flexDirection: 'row', gap: spacing.sm },
  pickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  pickText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  previewWrap: { position: 'relative' },
  preview: { width: '100%', height: 190, borderRadius: radius.md },
  remove: { position: 'absolute', top: 6, right: 6 },

  input: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  noteInput: { minHeight: 66, textAlignVertical: 'top' },

  send: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sendOff: { opacity: 0.5 },
  sendText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
