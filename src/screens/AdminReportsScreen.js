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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Card, EmptyState } from '../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../theme';
import { FilterChips, ModuleTile, PillButton } from '../components/ds';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as reportApi from '../services/reportService';

const TYPE_LABEL = {
  material: 'Бараа материал',
  tool: 'Багаж',
  vehicle: 'Машин',
};

// Prototype: төрөл бүрийн icon хавтан [Phosphor icon, өнгө].
const TYPE_LOOK = {
  material: ['archive', 'blue'],
  tool: ['hammer', 'amber'],
  vehicle: ['car', 'slate'],
};

export default function AdminReportsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [rfilter, setRfilter] = useState('all');

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

  // Prototype «Тайлан»: ХАБЭА онцлох карт → шүүлтүүр → сараар бүлэглэсэн мөрүүд.
  const shownReports = rfilter === 'all' ? reports : reports.filter((r) => r.report_type === rfilter);
  const now = new Date();
  const groups = [];
  shownReports.forEach((r) => {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      ? 'Энэ сар'
      : `${d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()} оны `}${d.getMonth() + 1}-р сар`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label, rows: [] }));
    g.rows.push(r);
  });
  const p2 = (n) => String(n).padStart(2, '0');
  const stamp = (iso) => {
    const d = new Date(iso);
    return `${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Тайлан"
        subtitle="Илгээсэн тайлангууд"
        right={<PillButton title="Шинэ" icon="add" onPress={() => navigation.navigate('EmployeeReport')} />}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.brand} />
          }
        >
          <TouchableOpacity style={styles.feature} activeOpacity={0.85} onPress={() => navigation.navigate('WorkHeightRiskReport')}>
            <ModuleTile icon="hard-hat" tone="amber" size={48} radius={14} iconSize={24} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.featureTitle}>Өндөрт ажиллах ХАБЭА тайлан</Text>
              <Text style={styles.sub}>Эрсдэл · зөвшөөрөл · PPE · осол, зөрчил</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </TouchableOpacity>

          <FilterChips
            style={styles.chips}
            value={rfilter}
            onChange={setRfilter}
            items={[
              { key: 'all', label: 'Бүгд' },
              { key: 'vehicle', label: 'Машин' },
              { key: 'tool', label: 'Багаж' },
              { key: 'material', label: 'Бараа' },
            ]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && shownReports.length === 0 ? (
            <EmptyState text="Одоогоор тайлан ирээгүй байна." />
          ) : (
            groups.map((g) => (
              <View key={g.key}>
                <Text style={styles.datehd}>{g.label}</Text>
                <View style={styles.groupCard}>
                  {g.rows.map((r, i) => {
                    const [icon, tone] = TYPE_LOOK[r.report_type] || ['file-text', 'slate'];
                    return (
                      <TouchableOpacity key={r.id} style={[styles.reprow, i > 0 && styles.rowBorder]} activeOpacity={0.85} onPress={() => setSelected(r)}>
                        <ModuleTile icon={icon} tone={tone} size={42} radius={13} iconSize={22} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.title} numberOfLines={2}>{r.title}</Text>
                          <Text style={styles.sub} numberOfLines={1}>
                            {r.user_name || 'Ажилтан'} · {TYPE_LABEL[r.report_type] || r.report_type}
                          </Text>
                        </View>
                        <View style={styles.rightCol}>
                          {r.pdf_url || r.body_html ? <Text style={styles.ftag}>PDF</Text> : null}
                          <Text style={styles.time}>{stamp(r.created_at)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
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
  container: { flex: 1, backgroundColor: colors.ground },
  body: { paddingHorizontal: 16, paddingBottom: 40 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: colors.card, marginBottom: 12, ...shadow.md },
  featureTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  chips: { marginHorizontal: -16, marginBottom: 4 },
  datehd: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  groupCard: { backgroundColor: colors.card, borderRadius: 20, ...shadow.md },
  reprow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  ftag: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.field, color: colors.muted, overflow: 'hidden' },
  time: { color: colors.faint, fontSize: 12, fontVariant: ['tabular-nums'] },
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
  title: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
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
