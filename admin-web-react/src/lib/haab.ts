import { supabase } from './supabase';

/**
 * haab.gennetex.com — ХААБ гарын үсгийн хуудасны нийтлэг логик:
 * админ хуудас (pages/Haab.tsx), нийтийн холбоос (pages/HaabPublic.tsx),
 * хэвлэх ба PDF ижил өгөгдлөөс.
 */

export type HaabInstruction = { title: string; body: string; updated_at: string | null };
export type HaabAck = {
  id: string;
  ack_date?: string;
  user_id: string;
  name: string;
  department: string | null;
  avatar_url?: string | null;
  signed_at: string | null;
  signature_url: string | null;
  instruction_updated_at: string | null;
};
/** date — эхлэх өдөр; date_to — дуусах өдөр (нэг өдөр бол ижил эсвэл байхгүй). */
export type HaabSheet = { date: string; date_to?: string; instruction: HaabInstruction; total: number; acks: HaabAck[] };
export const isRange = (s: Pick<HaabSheet, 'date' | 'date_to'>) => !!s.date_to && s.date_to !== s.date;
export const periodLabel = (s: Pick<HaabSheet, 'date' | 'date_to'>) => (isRange(s) ? `${s.date} — ${s.date_to}` : s.date);

export const ubToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
export const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit' }) : '—';
export const dayOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' }) : '');

/** Апп гарын үсгийг ижил нэрээр дардаг тул кэшээс хуучин зураг гарахгүйн тулд цаг нэмнэ. */
export const sigSrc = (a: Pick<HaabAck, 'signature_url' | 'signed_at'>) =>
  a.signature_url && /^https?:/.test(a.signature_url) ? `${a.signature_url}?v=${encodeURIComponent(a.signed_at || '')}` : a.signature_url || '';

export async function fetchInstruction(): Promise<HaabInstruction> {
  const { data, error } = await supabase.from('ohaab_instruction').select('title, body, updated_at').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return { title: data?.title || 'ХААБ заавар', body: data?.body || '', updated_at: data?.updated_at || null };
}

/**
 * Зааврын хамгийн гол заалтууд — дугаарласан/тэмдэглэгээтэй мөрүүдийг эхэлж,
 * байхгүй бол өгүүлбэрүүдийг авна. Хуудасны хажууд багтахаар max ширхэг.
 */
export function keyPoints(body: string, max = 8): string[] {
  const clean = (s: string) => s.replace(/^\s*(?:[-–—•*●▪]|\d+[.)]|[а-яөүa-z][.)])\s*/i, '').replace(/\s+/g, ' ').trim();
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const marked = lines.filter((l) => /^(?:[-–—•*●▪]|\d+[.)]|[а-яөүa-z][.)])\s+/i.test(l)).map(clean);
  let points = marked.length >= 2 ? marked : lines.map(clean);
  if (points.length < 3) points = body.split(/(?<=[.!?])\s+/).map(clean);
  return points.filter((p) => p.length > 3).map((p) => (p.length > 160 ? `${p.slice(0, 157)}…` : p)).slice(0, max);
}

/** Аль хувилбарын зааварт зурсан — одоогийнхтой ижил бол «Одоогийн», үгүй бол огноо. */
export function versionLabel(ack: HaabAck, current: HaabInstruction) {
  if (!ack.instruction_updated_at || !current.updated_at) return 'Одоогийн';
  return Math.abs(new Date(ack.instruction_updated_at).getTime() - new Date(current.updated_at).getTime()) < 1000
    ? 'Одоогийн'
    : `${dayOf(ack.instruction_updated_at)} хувилбар`;
}

/* ── Нийтийн холбоос ─────────────────────────────────────────── */
export const publicUrl = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/haab/s/${token}`;

export async function shareLink(from: string, to: string) {
  const { data, error } = await supabase.rpc('ohaab_share_link', { p_from: from, p_to: to });
  if (error) throw new Error(/forbidden/.test(error.message) ? 'Зөвхөн админ.' : /function .* does not exist|Could not find/.test(error.message) ? 'Хуваалцах функц серверт хараахан идэвхжээгүй (migration).' : error.message);
  return publicUrl(String(data));
}

export async function revokeShare(from: string, to: string) {
  const { error } = await supabase.rpc('ohaab_share_revoke', { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
}

export async function fetchShared(token: string): Promise<HaabSheet> {
  const { data, error } = await supabase.rpc('ohaab_share_view', { p_token: token });
  if (error) throw new Error(/not_found|invalid input syntax/.test(error.message) ? 'Холбоос хүчингүй эсвэл устгагдсан байна.' : error.message);
  const d = data as HaabSheet;
  return { ...d, total: Number(d.total) || 0, acks: d.acks || [] };
}

/**
 * Апп гарын үсгийг 600px өргөн, 2.8px зураасаар хадгалдаг — жижгэрүүлэхэд маш бүдэг.
 * Зураасыг 3 дахин зузаан (≥7), бараан болгоно.
 */
export function boldSvg(svg: string) {
  return svg
    .replace(/stroke-width="([\d.]+)"/g, (_, w) => `stroke-width="${Math.max(7, Number(w) * 3)}"`)
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="#0b0f0d"');
}

const boldCache = new Map<string, Promise<string>>();
/** Гарын үсгийг тодруулсан data URI (татаж чадаагүй бол анхны хаяг). */
export function boldSigSrc(a: Pick<HaabAck, 'signature_url' | 'signed_at'>) {
  const src = sigSrc(a);
  if (!src) return Promise.resolve('');
  if (!boldCache.has(src)) {
    boldCache.set(src, svgText(src).then((t) => (t ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(boldSvg(t))}` : src)));
  }
  return boldCache.get(src)!;
}

/* ── PDF (pdfmake — зөвхөн дарахад ачаална) ──────────────────── */
async function svgText(url: string | null) {
  if (!url) return null;
  try {
    if (url.startsWith('data:image/svg+xml')) {
      const [, meta, payload] = url.match(/^data:image\/svg\+xml([^,]*),(.*)$/) || [];
      return /base64/.test(meta || '') ? decodeURIComponent(escape(atob(payload))) : decodeURIComponent(payload || '');
    }
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const t = await r.text();
    return t.includes('<svg') ? t : null;
  } catch {
    return null;
  }
}

export async function downloadPdf(sheet: HaabSheet) {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  (pdfMake as unknown as { addVirtualFileSystem: (f: unknown) => void }).addVirtualFileSystem(pdfFonts);
  const svgs = (await Promise.all(sheet.acks.map((a) => svgText(a.signature_url)))).map((t) => (t ? boldSvg(t) : null));
  const points = keyPoints(sheet.instruction.body, 12);
  const n = sheet.acks.length;
  const multi = isRange(sheet);
  const head = ['№', 'Ажилтан', multi ? 'Огноо' : 'Цаг', `Заавар — ${sheet.instruction.title}`, 'Гарын үсэг'].map((t) => ({ text: t, bold: true, fillColor: '#eef3f0', fontSize: 8 }));
  const pointsCell = () => (points.length ? { ol: points, fontSize: 7, lineHeight: 1.15, color: '#45534d' } : { text: '—', color: '#888888' });
  const body = n
    ? sheet.acks.map((a, i) => [
        { text: String(i + 1), alignment: 'center', color: '#5f6d67' },
        { stack: [{ text: a.name, bold: true }, ...(a.department ? [{ text: a.department, fontSize: 7, color: '#5f6d67' }] : [])] },
        multi ? { stack: [a.ack_date || dayOf(a.signed_at), { text: timeOf(a.signed_at), color: '#5f6d67', fontSize: 7 }] } : timeOf(a.signed_at),
        pointsCell(),
        svgs[i] ? { svg: svgs[i], fit: [100, 30], alignment: 'center' } : { text: '—', alignment: 'center', color: '#888888' },
      ])
    : [[{ text: 'Энэ өдөр гарын үсэг зурсан ажилтан алга.', colSpan: 5, alignment: 'center', color: '#888888' }, {}, {}, {}, {}]];
  const doc = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [28, 28, 28, 30],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111111' },
    footer: (page: number, count: number) => ({ text: `GENNETEX ХХК · ${sheet.date} · ${page}/${count}`, alignment: 'center', fontSize: 7, color: '#777777', margin: [0, 8, 0, 0] }),
    content: [
      {
        columns: [
          { text: 'ХААБ зааврын танилцуулгын гарын үсэг', fontSize: 13, bold: true },
          { text: `${multi ? 'Хугацаа' : 'Огноо'}: ${periodLabel(sheet)}   ${multi ? `Гарын үсэг: ${n}` : `Зурсан: ${n} / ${sheet.total}`}`, alignment: 'right', fontSize: 9, color: '#45534d', margin: [0, 3, 0, 0] },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        table: { headerRows: 1, dontBreakRows: true, widths: [16, 110, multi ? 52 : 30, '*', 104], body: [head, ...body] },
        layout: { hLineColor: () => '#d9e1dd', vLineColor: () => '#d9e1dd', paddingTop: () => 3, paddingBottom: () => 3 },
      },
    ],
  };
  (pdfMake as unknown as { createPdf: (d: unknown) => { download: (n: string) => void } }).createPdf(doc).download(`haab_garyn_useg_${multi ? `${sheet.date}_${sheet.date_to}` : sheet.date}.pdf`);
}
