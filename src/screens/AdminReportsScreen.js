import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Card, EmptyState } from '../components/ui';
import NavIcon from '../components/NavIcon';
import { colors as palette, spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as reportApi from '../services/reportService';

const TYPE_LABEL = {
  material: 'Бараа материал',
  tool: 'Багаж',
  vehicle: 'Машин',
};

const TYPE_COLOR = {
  material: palette.primary,
  tool: '#ea580c',
  vehicle: palette.warning,
};

export default function AdminReportsScreen() {
  const { colors, shadow } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const rows = await reportApi.fetchReports(150);
      setReports(rows);
    } catch (e) {
      setReports([]);
      setError(e.message || 'Тайлан ачаалахад алдаа гарлаа');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin && isCloud) load();
    }, [isAdmin, isCloud, load])
  );

  if (!isAdmin || !isCloud) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Тайлан"/>
        <EmptyState text="Зөвхөн админ харах боломжтой."/>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ажилтны тайлан" subtitle="Илгээсэн тайлангууд"/>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && reports.length === 0 ? (
            <EmptyState text="Одоогоор тайлан ирээгүй байна."/>
          ) : (
            reports.map((r) => (
              <TouchableOpacity key={r.id} style={styles.row} activeOpacity={0.85} onPress={() => setSelected(r)}>
                <View style={[styles.badge, { backgroundColor: (TYPE_COLOR[r.report_type] || colors.primary) + '18'}]}>
                  <NavIcon name="report" size={20} color={TYPE_COLOR[r.report_type] || colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{r.title}</Text>
                  <Text style={styles.sub}>
                    {r.user_name || 'Ажилтан'} · {TYPE_LABEL[r.report_type] || r.report_type}
                    {r.pdf_url ? '· PDF' : ''}
                  </Text>
                  <Text style={styles.date}>{new Date(r.created_at).toLocaleString('mn-MN')}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modal}>
          <View style={styles.modalBar}>
            <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
              <Text style={styles.back}>‹ Буцах</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center'}}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selected?.title}
              </Text>
              <Text style={styles.modalSub}>{selected?.user_name}</Text>
            </View>
            <View style={{ width: 60 }} />
          </View>
          {selected?.pdf_url ? (
            <>
              <TouchableOpacity
                style={styles.pdfBtn}
                onPress={() => Linking.openURL(selected.pdf_url)}
              >
                <Text style={styles.pdfBtnText}>PDF татах / нээх</Text>
              </TouchableOpacity>
              <WebView
                originWhitelist={['*']}
                source={{ uri: selected.pdf_url }}
                style={{ flex: 1, backgroundColor: '#fff'}}
              />
            </>
          ) : selected?.body_html ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: selected.body_html }}
              style={{ flex: 1, backgroundColor: '#fff'}}
            />
          ) : (
            <Card style={{ margin: spacing.lg }}>
              <Text>Тайлангийн агуулга алга.</Text>
            </Card>
          )}
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },
  body: { padding: spacing.lg, paddingBottom: 40 },
  error: { color: colors.danger, textAlign: 'center', marginBottom: spacing.md, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '800'},
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  arrow: { color: colors.textMuted, fontSize: 24, fontWeight: '300'},
  modal: { flex: 1, backgroundColor: colors.bg },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontWeight: '700', fontSize: 16, width: 60 },
  modalTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  modalSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  pdfBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  pdfBtnText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
});
