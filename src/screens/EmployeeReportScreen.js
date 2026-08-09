import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Button, Card } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import NavIcon from '../components/NavIcon';
import { colors as palette, spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';
import * as reportApi from '../services/reportService';

const TYPES = [
  { key: 'material', icon: 'inventory', color: palette.primary },
  { key: 'tool', icon: 'tools', color: '#ea580c'},
  { key: 'vehicle', icon: 'vehicle', color: palette.warning },
];

function previewLines(report) {
  if (!report?.payload) return ['Мэдээлэл ачаалж байна...'];
  const p = report.payload;
  if (report.type === 'vehicle') {
    return [
      `Нийт аялал: ${p.tripCount || 0}`,
      `Явсан зам: ${(p.totalKm || 0).toFixed(1)} км`,
      `Түлш: ${(p.totalLiters || 0).toFixed(1)} л`,
    ];
  }
  return [
    `Нэр төрөл: ${p.itemCount || 0}`,
    `Нийт тоо: ${p.totalQty || 0}`,
    ...(p.items || []).slice(0, 4).map((it) => `• ${it.name} — ${it.quantity} ${it.unit}`),
  ];
}

export default function EmployeeReportScreen() {
  const styles = useStyles(makeStyles);
  const { authProfile, currentUser, isCloud, updateMyProfile } = useApp();
  const [preview, setPreview] = useState(null);
  const [loadingType, setLoadingType] = useState(null);
  const [sending, setSending] = useState(false);
  const [sigSvg, setSigSvg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const hasSignature = !!authProfile?.report_signature_url;

  const openPreview = async (key) => {
    if (!currentUser?.id) return;
    setLoadingType(key);
    try {
      let report;
      if (key === 'material') report = await reportApi.buildMaterialReport(currentUser.id);
      else if (key === 'tool') report = await reportApi.buildToolReport(currentUser.id);
      else report = await reportApi.buildVehicleReport(currentUser.id);
      setPreview(report);
      setSigSvg('');
      setModalOpen(true);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setLoadingType(null);
    }
  };

  const sendReport = async (report) => {
    if (!currentUser?.id) throw new Error('Нэвтрээгүй байна');
    let signatureUrl = authProfile?.report_signature_url || null;
    if (!signatureUrl) {
      if (!sigSvg || !sigSvg.includes('<path')) {
        throw new Error('Анхны тайландаа гарын үсгээ зурна уу.');
      }
      signatureUrl = await reportApi.uploadSignatureSvg(sigSvg, currentUser.id);
      try {
        await reportApi.saveUserSignature(currentUser.id, signatureUrl);
        await updateMyProfile({ report_signature_url: signatureUrl });
      } catch (e) {
        // Профайл шинэчлэх алдаа — тайлан илгээхэд саад болохгүй
      }
    }
    await reportApi.submitReport({
      userId: currentUser.id,
      userName: authProfile?.name || currentUser.name,
      report,
      signatureUrl,
    });
  };

  const handleSendOne = async () => {
    if (!preview) return;
    setSending(true);
    try {
      await sendReport(preview);
      setModalOpen(false);
      Alert.alert('Амжилттай', 'PDF тайлан админд илгээгдлээ.');
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Тайлан илгээхэд алдаа гарлаа');
    } finally {
      setSending(false);
    }
  };

  const handleSendAll = async () => {
    if (!currentUser?.id) return;
    setSending(true);
    try {
      const [mat, tool, veh] = await Promise.all([
        reportApi.buildMaterialReport(currentUser.id),
        reportApi.buildToolReport(currentUser.id),
        reportApi.buildVehicleReport(currentUser.id),
      ]);
      const signatureUrl = authProfile?.report_signature_url || null;
      if (!signatureUrl) {
        Alert.alert('Гарын үсэг', 'Эхлээд нэг тайлан сонгож гарын үсгээ зурна уу.');
        setSending(false);
        return;
      }
      for (const r of [mat, tool, veh]) {
        await reportApi.submitReport({
          userId: currentUser.id,
          userName: authProfile?.name || currentUser.name,
          report: r,
          signatureUrl,
        });
      }
      Alert.alert('Амжилттай', 'Бүх PDF тайлан админд илгээгдлээ.');
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSending(false);
    }
  };

  if (!isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Ажилтан тайлан"/>
        <Text style={styles.note}>Тайлан илгээхэд Supabase холболт шаардлагатай.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ажилтан тайлан" subtitle="Тайлан сонгоод шууд илгээнэ"/>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/report-logo.png')} style={styles.logo} resizeMode="contain"/>
          <Text style={styles.brand}>GENNETEX</Text>
          <Text style={styles.brandSub}>GENERATION OF NETWORK EXPERTS</Text>
        </View>

        <Text style={styles.section}>Тайлан сонгох</Text>
        {TYPES.map((t) => {
          const meta = reportApi.REPORT_TYPES[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.typeCard}
              activeOpacity={0.85}
              onPress={() => openPreview(t.key)}
              disabled={loadingType === t.key}
            >
              <View style={[styles.typeIcon, { backgroundColor: t.color + '18'}]}>
                {loadingType === t.key ? (
                  <ActivityIndicator color={t.color} />
                ) : (
                  <NavIcon name={t.icon} size={24} color={t.color} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeTitle}>{meta.title}</Text>
                <Text style={styles.typeSub}>{meta.subtitle}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          );
        })}

        <Button
          title={sending ? 'Илгээж байна...' : 'Бүх тайлан шууд илгээх'}
          size="lg"
          onPress={handleSendAll}
          disabled={sending}
          style={{ marginTop: spacing.lg }}
        />
        {!hasSignature ? (
          <Text style={styles.hint}>Анх удаа нэг тайлан сонгож гарын үсгээ зурна уу.</Text>
        ) : (
          <Text style={styles.hint}></Text>
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.previewHead}>
              <Image source={require('../../assets/report-logo.png')} style={styles.logoSm} resizeMode="contain"/>
              <Text style={styles.previewTitle}>{preview?.title}</Text>
              <Text style={styles.previewSub}>{authProfile?.name || 'Ажилтан'}</Text>
            </View>
            <ScrollView style={styles.previewScroll} nestedScrollEnabled={false} keyboardShouldPersistTaps="handled">
              <Card borderless style={styles.previewCard}>
                {previewLines(preview).map((line, i) => (
                  <Text key={i} style={styles.previewLine}>
                    {line}
                  </Text>
                ))}
              </Card>
            </ScrollView>
            {!hasSignature ? (
              <View style={styles.sigWrap}>
                <SignaturePad onChange={setSigSvg} />
              </View>
            ) : null}
            <View style={styles.actions}>
              <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setModalOpen(false)} />
              <Button
                title={sending ? '...' : 'Илгээх'}
                style={{ flex: 1 }}
                onPress={handleSendOne}
                disabled={sending}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },
  body: { padding: spacing.lg, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { width: 88, height: 88 },
  brand: { color: colors.primary, fontSize: 18, fontWeight: '800', letterSpacing: 1, marginTop: 8 },
  brandSub: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.4, marginTop: 2 },
  section: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#111827',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: { color: '#fff', fontSize: 16, fontWeight: '800'},
  typeSub: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  arrow: { color: '#6b7280', fontSize: 20, fontWeight: '800'},
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
  note: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '94%',
  },
  previewScroll: { maxHeight: 140, marginBottom: spacing.md },
  sigWrap: { marginBottom: spacing.md },
  previewHead: { alignItems: 'center', marginBottom: spacing.md },
  logoSm: { width: 64, height: 64 },
  previewTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  previewSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  previewCard: { marginBottom: spacing.lg },
  previewLine: { color: colors.text, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
