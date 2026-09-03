import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, RefreshControl, Alert, Modal, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Card, Badge, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as appApi from '../services/jobApplicationService';
import { openApplicationPdf, plainMessage } from '../lib/applicationPdf';
import { accentMap } from '../theme/accents';
import NativeSignaturePad from '../components/NativeSignaturePad';

// Төлвийн өнгө нь theme/accents.js-ийн багцтай нийцнэ.
const STATUS_ACCENT = {
  new: 'brand',
  reviewing: 'amber',
  contacted: 'violet',
  hired: 'green',
  rejected: 'rose',
};

export default function AdminApplicationsScreen() {
  const { currentUser } = useApp();
  const { colors, isDark } = useTheme();
  const accents = accentMap(isDark);
  const styles = useStyles(makeStyles);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingRow, setSigningRow] = useState(null);
  const [adminSignature, setAdminSignature] = useState('');
  const [savingSignature, setSavingSignature] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState(null);

  /** Анкетыг PDF болгож системийн нээх/хуваалцах цонхыг гаргана. */
  const openPdf = async (row) => {
    setPdfBusyId(row.id);
    try {
      await openApplicationPdf(row);
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'PDF үүсгэж чадсангүй');
    } finally {
      setPdfBusyId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setRows(await appApi.fetchApplications());
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = appApi.subscribeApplications(load);
    return unsub;
  }, [load]);

  const cycleStatus = (row) => {
    const keys = appApi.APPLICATION_STATUS.map((s) => s.key);
    Alert.alert('Төлөв солих', row.name, [
      ...keys.map((k) => ({
        text: appApi.applicationStatusLabel(k),
        onPress: async () => {
          try {
            await appApi.updateApplicationStatus(row.id, k);
            load();
          } catch (e) {
            Alert.alert('Алдаа', e.message);
          }
        },
      })),
      { text: 'Болих', style: 'cancel' },
    ]);
  };

  const saveApproval = async () => {
    if (!adminSignature) {
      Alert.alert('Анхааруулга', 'Гарын үсгээ зурна уу.');
      return;
    }
    setSavingSignature(true);
    try {
      await appApi.approveApplication(signingRow.id, {
        signatureSvg: adminSignature,
        adminId: currentUser?.id,
        adminName: currentUser?.name,
      });
      setSigningRow(null);
      setAdminSignature('');
      await load();
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Баталж чадсангүй');
    } finally {
      setSavingSignature(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ажлын байрны анкет" subtitle={`Нийт ${rows.length}`} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        {rows.length === 0 && !loading ? (
          <EmptyState text="Одоогоор анкет ирээгүй байна." />
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>
                  {r.name} {r.last_name || ''}
                </Text>
                <TouchableOpacity onPress={() => cycleStatus(r)}>
                  <Badge text={appApi.applicationStatusLabel(r.status)} color={accents[STATUS_ACCENT[r.status]]} />
                </TouchableOpacity>
              </View>
              {r.position ? <Text style={styles.pos}>{r.position}</Text> : null}
              {/* Вэб талаас ирсэн анкет нь бүтэн JSON-оо `message` дотор
                  `[[GENNETEX_FORM]]` тэмдэгийн ард шахаж явуулдаг. Түүхий
                  утгыг шууд хэвлэхэд картан дээр «код» болж харагдаж байсан. */}
              {plainMessage(r) ? <Text style={styles.msg}>{plainMessage(r)}</Text> : null}
              <View style={styles.metaRow}>
                {r.phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${r.phone}`)}>
                    <Text style={styles.link}>{r.phone}</Text>
                  </TouchableOpacity>
                ) : null}
                {r.email ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`mailto:${r.email}`)}>
                    <Text style={styles.link}>{r.email}</Text>
                  </TouchableOpacity>
                ) : null}
                {r.cv_url ? (
                  <TouchableOpacity onPress={() => Linking.openURL(r.cv_url)}>
                    <Text style={styles.link}>Хавсаргасан CV</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Бүтэн анкетыг PDF болгож харуулна. Өмнө нь зөвхөн хавсаргасан
                  файлын холбоос байсан тул боловсрол, ажлын туршлага, гэр бүл
                  зэрэг анкетын үндсэн агуулгыг мобайлаас харах боломжгүй байв. */}
              <TouchableOpacity
                style={[styles.pdfButton, { borderColor: colors.primary }]}
                onPress={() => openPdf(r)}
                disabled={pdfBusyId === r.id}
                accessibilityRole="button"
                accessibilityLabel="Анкетыг PDF болгож харах"
              >
                {pdfBusyId === r.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.pdfButtonText, { color: colors.primary }]}>
                    Анкет PDF харах
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={styles.date}>{new Date(r.created_at).toLocaleString('mn-MN')}</Text>
              <View style={styles.approvalRow}>
                <Text style={[styles.approvalText, { color: r.admin_signature_svg ? colors.success : colors.textMuted }]}>
                  {r.admin_signature_svg ? `✓ ${r.admin_signed_by_name || 'Админ'} баталсан` : 'Баталгаажаагүй'}
                </Text>
                <TouchableOpacity style={[styles.signButton, { borderColor: colors.primary }]} onPress={() => { setAdminSignature(''); setSigningRow(r); }}>
                  <Text style={[styles.signButtonText, { color: colors.primary }]}>{r.admin_signature_svg ? 'Дахин зурах' : 'Баталж зурах'}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
      <Modal visible={!!signingRow} transparent animationType="slide" onRequestClose={() => setSigningRow(null)}>
        <View style={styles.modalShade}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Анкет батлах</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>{signingRow?.name || ''} · {currentUser?.name || 'Админ'}</Text>
            <NativeSignaturePad onChange={setAdminSignature} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.surfaceAlt }]} onPress={() => setSigningRow(null)}>
                <Text style={{ color: colors.text }}>Болих</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={savingSignature} style={[styles.modalButton, { backgroundColor: colors.primaryContainer }]} onPress={saveApproval}>
                <Text style={{ color: colors.onPrimaryContainer, fontWeight: '800' }}>{savingSignature ? 'Хадгалж байна...' : 'Баталж хадгалах'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pdfButton: {
    marginTop: spacing.md,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pdfButtonText: { fontSize: 14, fontWeight: '700' },
  body: { padding: spacing.lg, paddingBottom: 40 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  pos: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  msg: { color: colors.text, fontSize: 14, marginTop: 8, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 10 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 10 },
  approvalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.md },
  approvalText: { flex: 1, fontSize: 12, fontWeight: '700' },
  signButton: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  signButtonText: { fontSize: 12, fontWeight: '800' },
  modalShade: { flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' },
  modalCard: { borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 34 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalSub: { fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  modalButton: { flex: 1, minHeight: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
});
