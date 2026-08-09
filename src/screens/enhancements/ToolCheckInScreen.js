import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useApp } from '../../context/AppContext';
import {
  CONDITIONS,
  logToolCondition,
  requiresPhoto,
} from '../../services/toolConditionService';

export default function ToolCheckInScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile } = useApp();
  const [itemName, setItemName] = useState('');
  const [condition, setCondition] = useState('ok');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [direction, setDirection] = useState('in');
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!res.canceled && res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri);
  };

  const save = async () => {
    if (!itemName.trim()) {
      Alert.alert('Анхаар', 'Багажны нэр оруулна уу');
      return;
    }
    if (requiresPhoto(condition) && !photoUri) {
      Alert.alert('Анхаар', 'Гэмтэл/алдагдалд зураг заавал');
      return;
    }
    setSaving(true);
    try {
      await logToolCondition({
        itemName: itemName.trim(),
        userId: currentUser?.id,
        userName: authProfile?.name,
        direction,
        condition,
        note,
        photoUrl: photoUri,
      });
      Alert.alert('Амжилттай', 'Багажны нөхцөл бүртгэгдлээ');
      setItemName('');
      setNote('');
      setPhotoUri(null);
      setCondition('ok');
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Хадгалж чадсангүй (migration?)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Буцах</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Багаж буцаах / нөхцөл</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.dirRow}>
          {['in', 'out'].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dirBtn, direction === d && styles.dirOn]}
              onPress={() => setDirection(d)}
            >
              <Text style={[styles.dirText, direction === d && styles.dirTextOn]}>
                {d === 'in' ? 'Буцаах (in)' : 'Авах (out)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Багажны нэр</Text>
        <TextInput
          style={styles.input}
          value={itemName}
          onChangeText={setItemName}
          placeholder="Ж: Fusion splicer"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.label}>Нөхцөл</Text>
        <View style={styles.condRow}>
          {CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.cond, condition === c.key && { borderColor: c.color, backgroundColor: c.color + '22' }]}
              onPress={() => setCondition(c.key)}
            >
              <Text style={{ color: c.color, fontWeight: '700', fontSize: 12 }}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Тэмдэглэл</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          value={note}
          onChangeText={setNote}
          multiline
          placeholderTextColor={colors.textFaint}
        />

        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
          <Text style={styles.photoText}>{photoUri ? 'Зураг солих' : 'Зураг авах'}</Text>
        </TouchableOpacity>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}

        <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? '…' : 'Хадгалах'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    back: { color: colors.primary, fontWeight: '700', marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '800' },
    body: { padding: spacing.lg, paddingBottom: 60 },
    dirRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    dirBtn: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    dirOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    dirText: { color: colors.textMuted, fontWeight: '700' },
    dirTextOn: { color: colors.primary },
    label: { color: colors.textMuted, fontWeight: '700', marginBottom: 6, marginTop: spacing.sm },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      color: colors.text,
    },
    condRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cond: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      padding: spacing.md,
      alignItems: 'center',
    },
    photoText: { color: colors.primary, fontWeight: '800' },
    photo: { width: '100%', height: 200, borderRadius: radius.lg, marginTop: spacing.md },
    save: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.lg,
      alignItems: 'center',
    },
    saveText: { color: colors.onPrimary || '#003', fontWeight: '800' },
  });
