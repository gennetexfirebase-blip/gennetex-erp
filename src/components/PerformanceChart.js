/**
 * Гүйцэтгэлийн БАГАНАН ГРАФИК (мобайл).
 *
 * Яагаад сан ашиглаагүй вэ: аппд график зурдаг сан (victory, chart-kit) алга,
 * зөвхөн энэ нэг дэлгэцийн төлөө шинэ хамаарал нэмэх нь хэт өртөгтэй.
 * Багана нь энгийн `View` — өндрийг нь хувиар тооцно.
 *
 * Багана олон бол хэвтээ гүйлгэнэ. Сүүлийн багана нь хамгийн шинэ өдөр тул
 * ачаалахад БАРУУН ТИЙШ гүйлгэж, хамгийн сүүлийн үеийг эхэлж харуулна.
 */
import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const CHART_HEIGHT = 132;
const MIN_BAR_HEIGHT = 3;

/** Графикт харуулах хэмжигдэхүүнүүд. */
export const CHART_METRICS = [
  { key: 'work', label: 'Ажил' },
  { key: 'perTeam', label: '1 баг/өдөр' },
  { key: 'minutes', label: '1 айлын мин' },
];

function seriesFor(metric, colors) {
  if (metric === 'perTeam') {
    return [{ key: 'perTeam', label: '1 баг өдөрт айл', color: '#6d4aa8', decimals: 1 }];
  }
  if (metric === 'minutes') {
    return [{ key: 'minPerAil', label: '1 айлд ногдох минут', color: '#b45309', decimals: 0 }];
  }
  return [
    { key: 'ail', label: 'Айл', color: colors.primary, decimals: 0 },
    { key: 'baiguulga', label: 'Байгууллага', color: '#0b7a44', decimals: 0 },
  ];
}

const fmt = (v, decimals) => (decimals ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v)));

export default function PerformanceChart({ chart, metric = 'work', onMetricChange, title }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const scrollRef = useRef(null);

  const points = chart?.points || [];
  const series = seriesFor(metric, colors);

  const max = useMemo(() => {
    let m = 0;
    points.forEach((p) => series.forEach((s) => { if ((p[s.key] || 0) > m) m = p[s.key] || 0; }));
    return m;
  }, [points, series]);

  if (!points.length) return null;

  // Багана цөөн бол дэлгэцийг дүүргэж, олон бол гүйлгэнэ.
  const barGroupWidth = points.length <= 8 ? 44 : 34;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>{title || 'График'}</Text>
        {onMetricChange ? (
          <View style={styles.metricRow}>
            {CHART_METRICS.map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => onMetricChange(m.key)}
                style={[styles.metricBtn, metric === m.key && styles.metricBtnActive]}
              >
                <Text style={[styles.metricText, metric === m.key && styles.metricTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.plot}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {points.map((p, i) => (
          <View key={`${p.fullLabel || p.label}-${i}`} style={[styles.group, { width: barGroupWidth }]}>
            <Text style={styles.value} numberOfLines={1}>
              {fmt(series.reduce((sum, s) => sum + (p[s.key] || 0), 0), series[0].decimals)}
            </Text>
            <View style={styles.bars}>
              {series.map((s) => {
                const v = p[s.key] || 0;
                const h = max > 0 ? Math.max(v > 0 ? MIN_BAR_HEIGHT : 0, (v / max) * CHART_HEIGHT) : 0;
                return <View key={s.key} style={[styles.bar, { height: h, backgroundColor: s.color }]} />;
              })}
            </View>
            <Text style={styles.axis} numberOfLines={1}>{p.label}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.label}</Text>
          </View>
        ))}
        <Text style={styles.legendMax}>дээд: {fmt(max, series[0].decimals)}</Text>
      </View>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  head: { marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 13, fontWeight: '800' },
  metricRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  metricBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  metricText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  metricTextActive: { color: '#fff' },

  plot: { alignItems: 'flex-end', paddingTop: spacing.sm },
  group: { alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_HEIGHT },
  bar: { width: 11, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  value: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  axis: { color: colors.textFaint, fontSize: 10, marginTop: 5, maxWidth: '100%' },

  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { color: colors.textMuted, fontSize: 11 },
  legendMax: { color: colors.textFaint, fontSize: 11, marginLeft: 'auto' },
});
