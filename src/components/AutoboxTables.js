import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../theme';

function buildAutoboxHtml(data, colors) {
  // Хүснэгт бүрийг хэвтээ гүйлгэдэг хайрцагт хийнэ.
  //
  // Багануудад `white-space: nowrap` тавьсан тул хүснэгт дэлгэцээс өргөн
  // болдог. Гүйлгэх хайрцаггүй үед баруун талын багана (Торгуулийн "Огноо",
  // "Төлөв") бүрмөсөн таслагдаж, хэрэглэгч харах ямар ч аргагүй байв.
  const section = (title, html) => {
    if (!html) return '';
    return `<h4>${title}</h4><div class="tw">${html}</div>`;
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
/* Хэвтээ гүйлгэх хайрцаг — багана багтахгүй үед таслахгүй, гүйлгэнэ */
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 4px;padding-bottom:6px}
.tw::-webkit-scrollbar{height:5px}
.tw::-webkit-scrollbar-thumb{background:${colors.borderHi};border-radius:3px}
/* Агуулгаараа өргөсөж, дэлгэцээс багагүй байна */
table{width:max-content;min-width:100%;border-collapse:collapse;margin:0;font-size:12px}
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
</style></head><body>${body}
<script>
  /**
   * Агуулгын БОДИТ өндрийг React тал руу мэдэгдэнэ.
   *
   * ⚠️ Эс бөгөөс WebView тогтмол өндөртэй үлдэж, доод хэсэг (Торгуулийн
   *    хүснэгт хамгийн сүүлд байдаг) таслагдана. Гадна ScrollView
   *    дотор байгаа тул WebView-ийн дотоод гүйлгэлт найдваргүй —
   *    хуруу аль давхаргад ажиллахыг OS шийддэг.
   */
  function reportHeight() {
    var h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ height: h }));
    }
  }
  window.addEventListener('load', reportHeight);
  // Хүснэгт хожуу байрлаж дуусах тохиолдол бий — хэд хэдэн удаа хэмжинэ.
  [80, 300, 800, 1600].forEach(function (t) { setTimeout(reportHeight, t); });
  if (window.ResizeObserver) new ResizeObserver(reportHeight).observe(document.body);
</script>
</body></html>`;
}

export default function AutoboxTables({ plate, data, loading, error, statusText, title = 'Машины мэдээлэл' }) {
  const { colors } = useTheme();
  const html = useMemo(() => (data ? buildAutoboxHtml(data, colors) : ''), [data, colors]);
  // Агуулгын өндөр — WebView дотроос ирнэ. Ирэх хүртэл түр өндөр.
  const [height, setHeight] = useState(320);

  // Шинэ машин сонгоход өндөр сэргэнэ — эс бөгөөс өмнөх машины
  // (магадгүй урт) өндөр наалдаж, доор нь хоосон зай үлдэнэ.
  useEffect(() => {
    setHeight(320);
  }, [plate, data]);

  const onMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      // Хэт багассан утгыг үл тоомсорлоно (зураг ачаалагдах зуурын хэмжилт).
      if (msg.height > 80) setHeight(Math.ceil(msg.height) + 16);
    } catch {
      /* хэмжилт ирээгүй — түр өндөр хэвээр */
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {statusText ? <Text style={[styles.status, { color: colors.textMuted }]}>{statusText}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
      ) : error ? (
        <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
      ) : data ? (
        <View
          style={[
            styles.webWrap,
            { borderColor: colors.border, backgroundColor: colors.bg, height },
          ]}
        >
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            // Бүх агуулга нэг дор харагдах тул дотоод гүйлгэлт хэрэггүй —
            // гадна ScrollView бүхнийг гүйлгэнэ.
            scrollEnabled={false}
            onMessage={onMessage}
            style={styles.web}
            androidLayerType="software"
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
  },
  web: { flex: 1, backgroundColor: 'transparent' },
});
