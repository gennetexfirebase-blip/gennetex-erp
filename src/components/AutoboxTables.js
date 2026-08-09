import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

function buildAutoboxHtml(data, colors) {
  const section = (title, html) => {
    if (!html) return '';
    return `<h4>${title}</h4>${html}`;
  };
  const body = [
    section('Ерөнхий мэдээлэл', data.general),
    section('Техникийн мэдээлэл', data.technical),
    section('Техникийн хяналтын үзлэг', data.diagnosis),
    section('Торгууль', data.fines),
  ].join('');
  if (!body) return '<p class="muted">Мэдээлэл алга</p>';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box}
body{margin:0;padding:4px 2px 12px;font-family:system-ui,sans-serif;font-size:13px;background:${colors.bg};color:${colors.text}}
h4{margin:14px 0 8px;font-size:14px;font-weight:800}
table{width:100%;border-collapse:collapse;margin:0 0 4px;font-size:12px}
/* break-word нь үсэг бүрээр (вертикаль) унагааж байсан — normal болгож, урт текстийг wrap */
th,td{border:1px solid ${colors.border};padding:7px 8px;text-align:left;vertical-align:top;white-space:normal;word-break:normal;overflow-wrap:break-word}
thead th,tbody th{background:${colors.bgAlt};font-weight:700}
.muted{color:${colors.textMuted}}
.badge{display:inline-block;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700}
.badge-success{background:#dcfce7;color:#15803d}
.badge-warning{background:#fef9c3;color:#a16207}
.badge-danger{background:#fee2e2;color:#b91c1c}
/* Огноо/дүн ихэвчлэн 3-5-р баганад байдаг — wrap болохоос сэргийлнэ */
table thead th:nth-child(1), table tbody td:nth-child(1){white-space:nowrap}
table thead th:nth-child(2), table tbody td:nth-child(2){white-space:nowrap} /* Арлын дугаар гэх мэт */
table thead th:nth-child(3), table tbody td:nth-child(3){white-space:nowrap}
table thead th:nth-child(4), table tbody td:nth-child(4){white-space:nowrap}
table thead th:nth-child(5), table tbody td:nth-child(5){white-space:nowrap}
table thead th:nth-child(6), table tbody td:nth-child(6){white-space:nowrap} /* Тэнцсэн/Төлсөн гэх мэт */
</style></head><body>${body}</body></html>`;
}

export default function AutoboxTables({ plate, data, loading, error, statusText, title = 'Машины мэдээлэл' }) {
  const { colors } = useTheme();
  const html = useMemo(() => (data ? buildAutoboxHtml(data, colors) : ''), [data, colors]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {statusText ? <Text style={[styles.status, { color: colors.textMuted }]}>{statusText}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
      ) : error ? (
        <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
      ) : data ? (
        <View style={[styles.webWrap, { borderColor: colors.border, backgroundColor: colors.bg }]}>
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            scrollEnabled
            style={styles.web}
            nestedScrollEnabled
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  status: { fontSize: 11, marginTop: 4, marginBottom: 6 },
  err: { fontSize: 13, marginVertical: spacing.sm },
  webWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    minHeight: 220,
  },
  web: { flex: 1, minHeight: 280, backgroundColor: 'transparent' },
});
