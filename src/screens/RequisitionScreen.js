import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Button, Field } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import { spacing, radius } from '../theme';
import { useStyles, useTheme } from '../context/ThemeContext';
import * as requisitionApi from '../services/requisitionService';

const emptyItem = () => ({
  name: '',
  need: '',
  regNo: '',
  techCode: '',
  oldLoc: '',
  unit: 'ш',
  qty: '',
  newLoc: '',
});

const ITEM_FIELDS = [
  { key: 'name', label: 'Нэр төрөл: Бараа материал', full: true },
  { key: 'need', label: 'Хэрэгцээ' },
  { key: 'regNo', label: 'Бүртгэлийн дугаар' },
  { key: 'techCode', label: 'Техникийн код' },
  { key: 'oldLoc', label: 'Хуучин байршил' },
  { key: 'unit', label: 'Х.Н (нэгж)' },
  { key: 'qty', label: 'Одоогийн тоо хэмжээ', numeric: true },
  { key: 'newLoc', label: 'Шинэ байршил' },
];

export default function RequisitionScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { authProfile, currentUser, isAdmin } = useApp();

  const [companyName, setCompanyName] = useState('Юнивишн ХХК');
  const [docNo, setDocNo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [partner, setPartner] = useState('');
  const [name, setName] = useState(authProfile?.name || currentUser?.name || '');
  const [position, setPosition] = useState('');
  const [company, setCompany] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [receiverName, setReceiverName] = useState('');
  const [receiverSig, setReceiverSig] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [directorSig, setDirectorSig] = useState('');
  const [pageSize, setPageSize] = useState('A5');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const autoFillShortage = async () => {
    setAiBusy(true);
    try {
      const rows = await requisitionApi.computeShortageSuggestions({ useAi: true });
      if (!rows.length) {
        Alert.alert('Хангалттай', 'Одоогоор дутагдаж буй бараа материал алга байна.');
        return;
      }
      setItems(rows.map((r) => ({ ...emptyItem(), ...r })));
      if (!purpose.trim()) setPurpose('Дутагдалтай бараа материал нөхөх');
      Alert.alert('AI', `${rows.length} дутагдалтай бараа материалыг тооцож бөглөлөө. Шалгаад засварлаж болно.`);
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'AI тооцоолол амжилтгүй боллоо');
    } finally {
      setAiBusy(false);
    }
  };

  const generate = async () => {
    // Заавал бөглөх шаардлагагүй — ядаж нэг мөрөнд тоо хэмжээ эсвэл нэр байхад л болно
    const hasAny = items.some((it) => String(it.qty).trim() || it.name.trim());
    if (!hasAny) {
      Alert.alert('Дутуу', 'Дор хаяж нэг мөрөнд олгосон тоо хэмжээ эсвэл нэр оруулна уу.');
      return;
    }
    if (!directorSig.includes('<path') && !receiverSig.includes('<path')) {
      Alert.alert('Гарын үсэг', 'Гарын үсэг заавал зурна уу (Хүлээлгэн өгсөн эсвэл Хүлээн авсан).');
      return;
    }
    setBusy(true);
    try {
      await requisitionApi.exportRequisitionPdf({
        companyName,
        docNo,
        purpose,
        partner,
        name,
        position,
        company,
        items,
        receiverName,
        receiverSig,
        directorName,
        directorSig,
        pageSize,
      });
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'PDF үүсгэхэд алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Шаардах хуудас" />
        <View style={styles.denied}>
          <Text style={styles.deniedText}>Энэ хэсэг зөвхөн админд зориулагдсан.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Шаардах хуудас" subtitle="Төхөөрөмж / бараа материал шаардах · PDF" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Толгой мэдээлэл</Text>
          <Field label="Компаний нэр" value={companyName} onChangeText={setCompanyName} placeholder="Юнивишн ХХК" />
          <View style={styles.row}>
            <Field label="№ (дугаар)" value={docNo} onChangeText={setDocNo} placeholder="20-02-2607-00246" style={styles.half} />
            <View style={[styles.half, styles.dateBox]}>
              <Text style={styles.dateLabel}>Огноо</Text>
              <Text style={styles.dateValue}>{new Date().toLocaleDateString('en-CA')}</Text>
            </View>
          </View>
          <Field label="Зорилулт" value={purpose} onChangeText={setPurpose} placeholder="Төхөөрөмж захиалга" />
          <Field label="Партнер / байршил" value={partner} onChangeText={setPartner} placeholder="Партнер, байршил" />
          <Field label="Нэр" value={name} onChangeText={setName} placeholder="Овог нэр" />
          <View style={styles.row}>
            <Field label="Албан тушаал" value={position} onChangeText={setPosition} placeholder="Мэргэжилтэн" style={styles.half} />
            <Field label="Компани" value={company} onChangeText={setCompany} placeholder="Компани" style={styles.half} />
          </View>

          <View style={styles.itemsHead}>
            <Text style={styles.section}>Бараа материал</Text>
            <TouchableOpacity style={styles.addBtn} onPress={addItem} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>+ Мөр нэмэх</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.aiBtn, aiBusy && { opacity: 0.6 }]}
            onPress={autoFillShortage}
            disabled={aiBusy}
            activeOpacity={0.85}
          >
            <Text style={styles.aiBtnText}>
              {aiBusy ? 'AI тооцоолж байна...' : 'AI-аар дутагдалтай бараа автоматаар бөглөх'}
            </Text>
          </TouchableOpacity>

          {items.map((it, idx) => (
            <View key={idx} style={styles.itemCard}>
              <View style={styles.itemTopRow}>
                <Text style={styles.itemNo}>Мөр {idx + 1}</Text>
                {items.length > 1 ? (
                  <TouchableOpacity onPress={() => removeItem(idx)} hitSlop={8}>
                    <Text style={styles.removeText}>Устгах</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {ITEM_FIELDS.map((f) => (
                <View key={f.key} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.itemInput}
                    value={it[f.key]}
                    onChangeText={(v) => updateItem(idx, f.key, v)}
                    placeholder={f.label}
                    placeholderTextColor={colors.textFaint}
                    keyboardType={f.numeric ? 'numeric' : 'default'}
                  />
                </View>
              ))}
            </View>
          ))}

          <Text style={styles.section}>Гарын үсэг</Text>

          <Field label="Хүлээн авсан (нэр)" value={receiverName} onChangeText={setReceiverName} placeholder="Санхүүгийн алба" />
          <Text style={styles.sigLabel}>Хүлээн авсан — гарын үсэг</Text>
          <View style={styles.sigWrap}>
            <SignaturePad onChange={setReceiverSig} />
          </View>

          <Field label="Хүлээлгэн өгсөн (нэр)" value={directorName} onChangeText={setDirectorName} placeholder="Захирал / өгсөн хүн" />
          <Text style={styles.sigLabel}>Хүлээлгэн өгсөн — гарын үсэг (заавал)</Text>
          <View style={styles.sigWrap}>
            <SignaturePad onChange={setDirectorSig} />
          </View>

          <Text style={styles.section}>Цаасны хэмжээ</Text>
          <View style={styles.sizeRow}>
            {['A5', 'A6', 'A7'].map((sz) => (
              <TouchableOpacity
                key={sz}
                style={[styles.sizeChip, pageSize === sz && styles.sizeChipActive]}
                onPress={() => setPageSize(sz)}
                activeOpacity={0.85}
              >
                <Text style={[styles.sizeChipText, pageSize === sz && styles.sizeChipTextActive]}>{sz}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sizeHint}>Хэвлэхдээ энэ хэмжээгээр (хэвтээ) сонгоно уу — цаасан дээр яг таарна.</Text>

          <Button
            title={busy ? 'Үүсгэж байна...' : `PDF гаргах (${pageSize}) / хуваалцах`}
            size="lg"
            variant="primary"
            onPress={generate}
            disabled={busy}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },
  body: { padding: spacing.lg, paddingBottom: 60 },
  section: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  dateBox: { marginBottom: spacing.md, justifyContent: 'flex-end' },
  dateLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  dateValue: {
    color: colors.text,
    fontSize: 15,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  itemsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow.sm,
  },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  itemNo: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  removeText: { color: colors.danger || '#dc2626', fontSize: 13, fontWeight: '700' },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  itemInput: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.text,
    fontSize: 15,
  },
  sigLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  sigWrap: { marginBottom: spacing.md },
  aiBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  aiBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sizeRow: { flexDirection: 'row', gap: spacing.sm },
  sizeChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  sizeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sizeChipText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  sizeChipTextActive: { color: '#fff' },
  sizeHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  deniedText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
});
