import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing, radius, type } from '../theme';
import { runStoreReadinessChecks, STATUS_LABELS } from '../services/storeReadinessService';

const ICON = { passed: '✓', warning: '!', failed: '×', manual: '?' };
const COLOR = { passed: '#0b7a44', warning: '#b45309', failed: '#d92d20', manual: '#5f7086' };

export default function StoreReadinessScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [report, setReport] = useState(() => runStoreReadinessChecks());
  const [platform, setPlatform] = useState('apple');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const refresh = useCallback(() => { setReport(runStoreReadinessChecks()); setExpanded(null); }, []);
  const checks = useMemo(() => report.checks.filter(c => (c.platform === platform || c.platform === 'both') && (!onlyProblems || c.status !== 'passed')), [report, platform, onlyProblems]);
  const platformChecks = useMemo(() => report.checks.filter(c => c.platform === platform || c.platform === 'both'), [report, platform]);
  const ready = Math.round((platformChecks.filter(c => c.status === 'passed').length / Math.max(platformChecks.length, 1)) * 100);
  const counts = useMemo(() => platformChecks.reduce((a, c) => { a[c.status] += 1; return a; }, { passed: 0, warning: 0, failed: 0, manual: 0 }), [platformChecks]);

  const exportReport = async () => {
    try {
      const uri = `${FileSystem.cacheDirectory}store-readiness-report.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(report, null, 2));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Store readiness report' });
      else await Share.share({ message: JSON.stringify(report, null, 2), title: 'store-readiness-report.json' });
    } catch (e) { Alert.alert('Экспорт амжилтгүй', e?.message || 'Report үүсгэж чадсангүй.'); }
  };

  return <SafeAreaView style={styles.container} edges={['top']}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}><Text style={styles.backText}>‹</Text></TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.kicker}>RELEASE GATE</Text><Text style={styles.title}>Store шалгалт</Text></View><TouchableOpacity onPress={refresh} style={styles.refresh}><Text style={styles.refreshText}>↻</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.notice}><Text style={styles.noticeIcon}>i</Text><Text style={styles.noticeText}>Энэ шалгалт нь урьдчилсан техникийн шалгалт бөгөөд Apple/Google-ийн албан ёсны review-г орлохгүй.</Text></View>
      <View style={styles.summary}><Text style={styles.summaryLabel}>Нийт бэлэн байдал</Text><Text style={styles.percent}>{ready}%</Text><View style={styles.progressTrack}><View style={[styles.progress, { width: `${ready}%`, backgroundColor: ready >= 80 ? colors.success : colors.warning }]} /></View><View style={styles.statusRow}>{Object.keys(STATUS_LABELS).map(s => <Text key={s} style={{ color: COLOR[s], fontSize: 12 }}>{ICON[s]} {counts[s]}</Text>)}</View></View>
      <View style={styles.tabs}>{[['apple', 'Apple App Store'], ['google', 'Google Play']].map(([key, label]) => <TouchableOpacity key={key} onPress={() => { setPlatform(key); setExpanded(null); }} style={[styles.tab, platform === key && styles.tabActive]}><Text style={[styles.tabText, platform === key && styles.tabTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <View style={styles.actions}><TouchableOpacity onPress={refresh} style={styles.secondaryButton}><Text style={styles.secondaryText}>↻ Дахин шалгах</Text></TouchableOpacity><TouchableOpacity onPress={() => setOnlyProblems(v => !v)} style={[styles.filter, onlyProblems && styles.filterActive]}><Text style={[styles.filterText, onlyProblems && styles.filterTextActive]}>{onlyProblems ? 'Бүгдийг харах' : 'Зөвхөн алдааг харах'}</Text></TouchableOpacity></View>
      <View style={styles.cards}><SummaryCard title={platform === 'apple' ? 'App Store-д бэлэн' : 'Google Play-д бэлэн'} percent={ready} color={ready >= 80 ? colors.success : colors.warning} /><SummaryCard title="Дутуу шалгалт" percent={counts.failed + counts.manual} color={counts.failed ? colors.danger : colors.textMuted} suffix=" item" /></View>
      <Text style={styles.sectionTitle}>{platform === 'apple' ? 'Apple App Store шалгалт' : 'Google Play шалгалт'} · {checks.length}</Text>
      {checks.map(check => <CheckRow key={check.id} check={check} expanded={expanded === check.id} onPress={() => setExpanded(expanded === check.id ? null : check.id)} styles={styles} />)}
      {!checks.length && <Text style={styles.empty}>Энэ filter-т тохирох зүйл алга.</Text>}
      <TouchableOpacity onPress={exportReport} style={styles.export}><Text style={styles.exportText}>↓ store-readiness-report.json экспортлох</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function SummaryCard({ title, percent, color, suffix = '%' }) { return <View style={cardStyles.card}><Text style={cardStyles.title}>{title}</Text><Text style={[cardStyles.value, { color }]}>{percent}{suffix}</Text></View>; }
function CheckRow({ check, expanded, onPress, styles }) { const color = COLOR[check.status]; return <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.row, expanded && styles.rowExpanded]}><View style={[styles.statusIcon, { backgroundColor: `${color}18` }]}><Text style={[styles.statusGlyph, { color }]}>{ICON[check.status]}</Text></View><View style={styles.rowMain}><View style={styles.rowTitleLine}><Text style={styles.rowTitle}>{check.title}</Text><Text style={[styles.statusLabel, { color }]}>{STATUS_LABELS[check.status]}</Text></View>{expanded && <View style={styles.detail}><Text style={styles.detailText}>{check.description}</Text><Text style={styles.detailMeta}>Илэрсэн: {check.detectedValue}</Text><Text style={styles.detailMeta}>Хүлээгдсэн: {check.expectedValue}</Text><Text style={styles.fix}>Засах: {check.fixSuggestion}</Text>{check.status === 'failed' && <TouchableOpacity onPress={() => Alert.alert('Засах заавар', check.fixSuggestion)} style={styles.fixButton}><Text style={styles.fixButtonText}>Засах</Text></TouchableOpacity>}</View>}</View><Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text></TouchableOpacity>; }

const cardStyles = StyleSheet.create({ card: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#dfe6ef' }, title: { color: '#5f7086', fontSize: 12, marginBottom: 8 }, value: { fontSize: 23, fontWeight: '700' } });
function makeStyles(c) { return StyleSheet.create({ container: { flex: 1, backgroundColor: c.background }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, backText: { color: c.text, fontSize: 34, fontWeight: '300' }, kicker: { color: c.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }, title: { ...type.h2, color: c.text }, refresh: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: c.surfaceContainerLow }, refreshText: { color: c.primary, fontSize: 24 }, body: { padding: 16, gap: 16, paddingBottom: 40 }, notice: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: 12, backgroundColor: c.secondaryContainer }, noticeIcon: { color: c.secondary, fontWeight: '700', fontSize: 14 }, noticeText: { flex: 1, color: c.onSecondaryContainer, fontSize: 12, lineHeight: 18 }, summary: { backgroundColor: c.surface, borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }, summaryLabel: { color: c.textMuted, fontSize: 13 }, percent: { color: c.text, fontSize: 40, fontWeight: '700', marginTop: 2 }, progressTrack: { height: 9, borderRadius: 5, backgroundColor: c.surfaceContainerHigh, overflow: 'hidden', marginTop: 10 }, progress: { height: 9, borderRadius: 5 }, statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, tabs: { flexDirection: 'row', backgroundColor: c.surfaceContainerLow, borderRadius: 12, padding: 4 }, tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, tabActive: { backgroundColor: c.surface }, tabText: { color: c.textMuted, fontSize: 13, fontWeight: '600' }, tabTextActive: { color: c.text }, actions: { flexDirection: 'row', gap: 8 }, secondaryButton: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primaryContainer }, secondaryText: { color: c.onPrimaryContainer, fontSize: 13, fontWeight: '700' }, filter: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, filterActive: { borderColor: c.warning, backgroundColor: c.warning + '15' }, filterText: { color: c.textMuted, fontSize: 12, fontWeight: '600' }, filterTextActive: { color: c.warning }, cards: { flexDirection: 'row', gap: 10 }, sectionTitle: { ...type.h3, color: c.text, marginTop: 4 }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }, rowExpanded: { borderColor: c.primary, backgroundColor: c.surfaceContainerLow }, statusIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, statusGlyph: { fontSize: 17, fontWeight: '800' }, rowMain: { flex: 1 }, rowTitleLine: { gap: 4 }, rowTitle: { color: c.text, fontSize: 14, fontWeight: '700' }, statusLabel: { fontSize: 11, fontWeight: '600' }, detail: { marginTop: 10, gap: 7 }, detailText: { color: c.textMuted, fontSize: 13, lineHeight: 19 }, detailMeta: { color: c.textFaint, fontSize: 11 }, fix: { color: c.text, fontSize: 12, lineHeight: 18, fontWeight: '600' }, fixButton: { alignSelf: 'flex-start', paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', borderRadius: 9, backgroundColor: c.primaryContainer }, fixButtonText: { color: c.onPrimaryContainer, fontSize: 12, fontWeight: '700' }, chevron: { color: c.textMuted, fontSize: 22, paddingTop: 3 }, empty: { color: c.textMuted, textAlign: 'center', marginVertical: 30 }, export: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: c.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, exportText: { color: c.primary, fontWeight: '700', fontSize: 13 } }); }
