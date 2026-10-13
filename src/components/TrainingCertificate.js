/**
 * Сургалтад суусны сертификат — сургалт өөрөө сертификат олгодоггүй үед
 * апп Женнетексийн загвараар (лого, компанийн тамга, Захирлын нэр) үүсгэнэ.
 *
 * Энэ нь хэвлэх баримт тул өнгө нь апп-ын горимоос (light/dark) үл хамаарч
 * тогтмол — цаасан дээр үргэлж цагаан дэвсгэртэй.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const LOGO = require('../../assets/logo.png');
const STAMP = require('../../assets/company-stamp.png');

const PAPER = '#FFFFFF';
const INK = '#3B3A36';
const NAME = '#5B3A9A';
const WAVE = '#4FA3E0';
const DIRECTOR = { name: 'Б.Баясгалан', position: 'Захирал' };

/** «Батболд», «Бат» овогтой → «Б.Батболд». */
export function certificateName(person) {
  const first = String(person?.name || '').trim();
  const last = String(person?.last_name || '').trim();
  if (!first) return String(person?.email || '').split('@')[0];
  return last ? `${last[0].toUpperCase()}.${first}` : first;
}

function fmtDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()} оны ${d.getMonth() + 1}-р сарын ${d.getDate()}`;
}

/** Нүдэнд харагдах сертификат. `width` — картын өргөн (харьцаа A4 хөндлөн). */
export function CertificateView({ name, training, date, width = 320 }) {
  const h = width / 1.414;
  const k = width / 842; // A4 хөндлөн (pt) → дэлгэц
  return (
    <View style={[styles.paper, { width, height: h }]}>
      <Svg width={width} height={h} viewBox="0 0 842 595" style={StyleSheet.absoluteFill}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Path key={`a${i}`} d={`M${560 + i * 6} 0 C ${640 + i * 4} ${120 + i * 6}, ${700 - i * 6} ${180 + i * 4}, 842 ${230 + i * 7}`} stroke={WAVE} strokeWidth={1} fill="none" opacity={0.45} />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <Path key={`b${i}`} d={`M0 ${380 + i * 7} C ${110 + i * 4} ${360 - i * 5}, ${150 - i * 4} ${520 + i * 3}, ${260 + i * 6} 595`} stroke={WAVE} strokeWidth={1} fill="none" opacity={0.45} />
        ))}
        {Array.from({ length: 30 }).map((_, i) => (
          <Circle key={`d${i}`} cx={30 + (i % 6) * 10} cy={30 + Math.floor(i / 6) * 10} r={1.4} fill={WAVE} opacity={0.35} />
        ))}
      </Svg>
      <Image source={LOGO} style={{ width: 70 * k, height: 70 * k, marginTop: 26 * k }} resizeMode="contain" />
      <Text style={[styles.h1, { fontSize: 64 * k, marginTop: 8 * k }]}>CERTIFICATE</Text>
      <Text style={[styles.h2, { fontSize: 26 * k }]}>OF APPRECIATION</Text>
      <Text style={[styles.lead, { fontSize: 13 * k, marginTop: 26 * k, letterSpacing: 2 * k }]}>ЭНЭХҮҮ СЕРТИФИКАТЫГ</Text>
      <View style={[styles.nameBox, { marginTop: 10 * k, paddingVertical: 6 * k, paddingHorizontal: 30 * k, borderWidth: Math.max(1, 1.6 * k), minWidth: 520 * k }]}>
        <Text style={[styles.name, { fontSize: 48 * k }]} numberOfLines={1} adjustsFontSizeToFit>
          {name}
        </Text>
      </View>
      <Text style={[styles.body, { fontSize: 15 * k, marginTop: 16 * k, maxWidth: 640 * k, lineHeight: 22 * k }]}>
        «{training}» сургалтад амжилттай суусан тул олгов.
      </Text>
      {date ? <Text style={[styles.date, { fontSize: 11 * k, marginTop: 4 * k }]}>{fmtDate(date)}</Text> : null}
      <View style={[styles.sign, { marginTop: 4 * k }]}>
        <Image source={STAMP} style={{ width: 92 * k, height: 92 * k, opacity: 0.9 }} resizeMode="contain" />
        <View style={[styles.line, { width: 200 * k, marginTop: -18 * k }]} />
        <Text style={[styles.director, { fontSize: 13 * k, marginTop: 4 * k }]}>
          {DIRECTOR.position.toUpperCase()} · {DIRECTOR.name.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

async function assetDataUri(mod) {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const b64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:image/png;base64,${b64}`;
}

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function waves() {
  const a = Array.from({ length: 9 }).map((_, i) => `<path d="M${560 + i * 6} 0 C ${640 + i * 4} ${120 + i * 6}, ${700 - i * 6} ${180 + i * 4}, 842 ${230 + i * 7}" />`).join('');
  const b = Array.from({ length: 9 }).map((_, i) => `<path d="M0 ${380 + i * 7} C ${110 + i * 4} ${360 - i * 5}, ${150 - i * 4} ${520 + i * 3}, ${260 + i * 6} 595" />`).join('');
  return `<svg viewBox="0 0 842 595" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><g stroke="${WAVE}" stroke-width="1" fill="none" opacity="0.45">${a}${b}</g></svg>`;
}

export async function buildCertificateHtml({ name, training, date }) {
  const [logo, stamp] = await Promise.all([assetDataUri(LOGO), assetDataUri(STAMP)]);
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 0; }
html,body{margin:0;padding:0}
.page{position:relative;width:297mm;height:210mm;background:${PAPER};font-family:'Helvetica Neue',Arial,sans-serif;color:${INK};text-align:center;overflow:hidden}
.c{position:relative;padding-top:12mm}
h1{font-size:64pt;font-weight:900;letter-spacing:4pt;margin:2mm 0 0;color:${INK}}
h2{font-size:24pt;font-weight:400;letter-spacing:3pt;margin:0;color:${INK}}
.lead{margin-top:10mm;font-size:12pt;font-weight:700;letter-spacing:2pt}
.name{display:inline-block;margin-top:4mm;padding:2mm 14mm;min-width:170mm;border:1.5pt solid #8A5CF6;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:44pt;color:${NAME}}
.body{margin:7mm auto 0;max-width:220mm;font-size:15pt;line-height:1.5}
.date{font-size:11pt;color:#6B6B6B;margin-top:1mm}
.sign{margin-top:2mm}
.sign img{width:30mm;height:30mm;opacity:.92}
.line{width:70mm;height:1pt;background:${INK};margin:-6mm auto 0}
.dir{font-size:12pt;font-weight:700;margin-top:2mm;letter-spacing:1pt}
</style></head><body><div class="page">${waves()}<div class="c">
<img src="${logo}" style="width:24mm;height:24mm;object-fit:contain"/>
<h1>CERTIFICATE</h1><h2>OF APPRECIATION</h2>
<div class="lead">ЭНЭХҮҮ СЕРТИФИКАТЫГ</div>
<div class="name">${esc(name)}</div>
<div class="body">«${esc(training)}» сургалтад амжилттай суусан тул олгов.</div>
<div class="date">${esc(fmtDate(date))}</div>
<div class="sign"><img src="${stamp}"/><div class="line"></div>
<div class="dir">${esc(DIRECTOR.position.toUpperCase())} · ${esc(DIRECTOR.name.toUpperCase())}</div></div>
</div></div></body></html>`;
}

/** PDF болгож хуваалцана (имэйл, Telegram, хэвлэх). */
export async function shareCertificatePdf(data) {
  const html = await buildCertificateHtml(data);
  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Сертификат', UTI: 'com.adobe.pdf' });
  } else {
    await Print.printAsync({ uri });
  }
}

const styles = StyleSheet.create({
  paper: { backgroundColor: PAPER, alignItems: 'center', overflow: 'hidden', borderRadius: 6 },
  h1: { color: INK, fontWeight: '900', letterSpacing: 2 },
  h2: { color: INK, fontWeight: '400', letterSpacing: 2 },
  lead: { color: INK, fontWeight: '700' },
  nameBox: { borderColor: '#8A5CF6', alignItems: 'center' },
  name: { color: NAME, fontStyle: 'italic', fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  body: { color: INK, textAlign: 'center' },
  date: { color: '#6B6B6B' },
  sign: { alignItems: 'center' },
  line: { height: 1, backgroundColor: INK },
  director: { color: INK, fontWeight: '700', letterSpacing: 1 },
});
