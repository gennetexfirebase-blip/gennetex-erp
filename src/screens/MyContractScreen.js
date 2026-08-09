import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Card, Button, Badge, EmptyState, SectionTitle } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as contractApi from '../services/contractService';

export default function MyContractScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile } = useApp();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(null);
  const [sigSvg, setSigSvg] = useState('');

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setRows(await contractApi.fetchMyContracts(currentUser.id));
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    load();
    const unsub = contractApi.subscribeContracts(load);
    return unsub;
  }, [load]);

  const sign = async (contract) => {
    if (!sigSvg.trim()) {
      Alert.alert('Анхаар', 'Гарын үсэг зурна уу.');
      return;
    }
    setSigning(contract.id);
    try {
      await contractApi.signContract(contract, sigSvg, { userName: authProfile?.name || currentUser?.name });
      setSigSvg('');
      load();
      Alert.alert('Амжилттай', 'Гэрээнд гарын үсэг зурлаа. Админд илгээгдлээ.');
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Хадгалж чадсангүй');
    } finally {
      setSigning(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Миний гэрээ" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Миний гэрээ" subtitle={`Нийт ${rows.length}`} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        {rows.length === 0 ? (
          <EmptyState text="Танд одоогоор хөдөлмөрийн гэрээ алга." />
        ) : (
          rows.map((c) => (
            <Card key={c.id}>
              <View style={styles.rowTop}>
                <SectionTitle style={{ marginBottom: 0 }}>Хөдөлмөрийн гэрээ</SectionTitle>
                <Badge
                  text={contractApi.contractStatusLabel(c.status)}
                  color={c.status === 'signed' ? '#16a34a' : '#d97706'}
                />
              </View>
              <View style={styles.meta}>
                <Row k="Албан тушаал" v={c.position || '—'} styles={styles} />
                <Row k="Цалин" v={c.salary != null ? contractApi.formatMnt(c.salary) : '—'} styles={styles} />
                <Row k="Эхлэх" v={c.start_date || '—'} styles={styles} />
                <Row k="Дуусах" v={c.end_date || 'Хугацаагүй'} styles={styles} />
              </View>
              {c.terms ? (
                <View style={styles.termsBox}>
                  <Text style={styles.termsLabel}>Гэрээний нөхцөл</Text>
                  <Text style={styles.termsText}>{c.terms}</Text>
                </View>
              ) : null}

              {c.status === 'signed' ? (
                <>
                  <Text style={styles.signed}>
                    ✓ {c.signed_at ? new Date(c.signed_at).toLocaleString('mn-MN') : ''} — гарын үсэг зурсан
                  </Text>
                  {c.pdf_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(c.pdf_url)}>
                      <Text style={styles.link}>Гэрээ (PDF) нээх</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <View style={styles.signWrap}>
                  <Text style={styles.signHint}>
                    Гэрээтэй бүрэн танилцсан бол доор гарын үсгээ зурж баталгаажуулна уу.
                  </Text>
                  <SignaturePad onChange={setSigSvg} />
                  <Button
                    title={signing === c.id ? 'Илгээж байна...' : 'Гарын үсэг зурж баталгаажуулах'}
                    onPress={() => sign(c)}
                    disabled={signing === c.id}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Row({ k, v, styles }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaK}>{k}</Text>
      <Text style={styles.metaV}>{v}</Text>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: 40 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  meta: { gap: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaK: { color: colors.textMuted, fontSize: 13 },
  metaV: { color: colors.text, fontSize: 13, fontWeight: '700' },
  termsBox: {
    marginTop: spacing.md,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  termsLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  termsText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  signWrap: { marginTop: spacing.lg },
  signHint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  signed: { color: colors.success, fontSize: 13, fontWeight: '700', marginTop: spacing.md },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: spacing.sm },
});
