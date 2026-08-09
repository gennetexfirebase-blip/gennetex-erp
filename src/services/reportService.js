import { decode } from 'base64-arraybuffer';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { supabase } from '../lib/supabase';
import { computeBalances } from '../lib/stockBalance';
import * as invApi from './inventoryService';
import * as vehicleApi from './vehicleService';
import * as notifyApi from './notificationService';

function utf8ToBase64(str) {
  const escaped = unescape(encodeURIComponent(str));
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(escaped);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < escaped.length; ) {
    const c1 = escaped.charCodeAt(i++);
    const c2 = escaped.charCodeAt(i++);
    const c3 = escaped.charCodeAt(i++);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return output;
}

export function svgToDataUri(svgString) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

const TABLE = 'employee_reports';
const SIG_BUCKET = 'reports';

let logoDataUriCache = null;

async function getLogoDataUri() {
  if (logoDataUriCache) return logoDataUriCache;
  const [asset] = await Asset.loadAsync(require('../../assets/report-logo.png'));
  const localUri = asset.localUri || asset.uri;
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  logoDataUriCache = `data:image/png;base64,${base64}`;
  return logoDataUriCache;
}

function wrapPrintHtml(inner) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { margin: 20px; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 12px; color: #111827; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; font-size: 13px; }
  th { background: #f9fafb; font-weight: 600; }
</style></head><body>${inner}</body></html>`;
}

async function htmlToPdfFile(innerHtml) {
  const { uri } = await Print.printToFileAsync({
    html: wrapPrintHtml(innerHtml),
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
  });
  return uri;
}

async function uploadReportPdf(localUri, userId, reportId) {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${userId}/${reportId}.pdf`;
  const { error } = await supabase.storage.from(SIG_BUCKET).upload(path, decode(base64), {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(SIG_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const REPORT_TYPES = {
  material: { key: 'material', title: 'Бараа материалын тайлан', subtitle: 'Авсан бараа материал'},
  tool: { key: 'tool', title: 'Багажийн тайлан', subtitle: 'Авсан багаж'},
  vehicle: { key: 'vehicle', title: 'Машины аялалын тайлан', subtitle: 'Явсан зам, км'},
};

function aggregateMovements(movements, category) {
  const tagged = movements.map((m) => ({
    ...m,
    category: m.category || 'material',
  }));
  return computeBalances(tagged, { category }).map((b) => ({
    name: b.item_name,
    unit: b.unit,
    quantity: b.quantity,
  }));
}

async function movementsWithCategory(userId) {
  const [movements, inventory] = await Promise.all([
    invApi.fetchMyMovements(userId, 500),
    invApi.fetchInventory(),
  ]);
  const catMap = {};
  inventory.forEach((it) => {
    catMap[it.id] = it.category || 'material';
  });
  return movements.map((m) => ({
    ...m,
    category: catMap[m.item_id] || 'material',
  }));
}

export async function buildMaterialReport(userId) {
  const tagged = await movementsWithCategory(userId);
  const items = aggregateMovements(tagged, 'material');
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  return {
    type: 'material',
    title: REPORT_TYPES.material.title,
    payload: { items, totalQty, itemCount: items.length },
  };
}

export async function buildToolReport(userId) {
  const tagged = await movementsWithCategory(userId);
  const items = aggregateMovements(tagged, 'tool');
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  return {
    type: 'tool',
    title: REPORT_TYPES.tool.title,
    payload: { items, totalQty, itemCount: items.length },
  };
}

export async function buildVehicleReport(userId) {
  const trips = await vehicleApi.fetchMyTrips(userId, 100);
  const done = trips.filter((t) => t.status === 'done' || Number(t.distance_km) > 0);
  const totalKm = done.reduce((s, t) => s + Number(t.distance_km || 0), 0);
  const totalLiters = done.reduce((s, t) => s + Number(t.liters || 0), 0);
  const totalCost = done.reduce((s, t) => s + Number(t.cost || 0), 0);
  return {
    type: 'vehicle',
    title: REPORT_TYPES.vehicle.title,
    payload: {
      trips: done.map((t) => ({
        plate: t.plate_number,
        km: Number(t.distance_km || 0),
        liters: Number(t.liters || 0),
        cost: Number(t.cost || 0),
        date: t.started_at,
      })),
      totalKm,
      totalLiters,
      totalCost,
      tripCount: done.length,
    },
  };
}

export function renderReportHtml({ title, userName, payload, type, signatureUrl, logoDataUri }) {
  let body = '';
  if (type === 'material' || type === 'tool') {
    const rows = (payload.items || [])
      .map(
        (it) =>
          `<tr><td>${it.name}</td><td style="text-align:center">${it.quantity}</td><td>${it.unit || ''}</td></tr>`
      )
      .join('');
    body = `
      <p style="text-align:center;color:#6b7280">Нийт ${payload.itemCount || 0} нэр төрөл · ${payload.totalQty || 0} ширхэг/нэгж</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead><tr style="background:#f9fafb"><th style="padding:10px;text-align:left">Бараа</th><th style="padding:10px">Тоо</th><th style="padding:10px;text-align:left">Нэгж</th></tr></thead>
        <tbody>${rows || '<tr><td colspan=3 style="padding:20px;text-align:center;color:#9ca3af">Бүртгэл алга</td></tr>'}</tbody>
      </table>`;
  } else if (type === 'vehicle') {
    const rows = (payload.trips || [])
      .map(
        (t) =>
          `<tr><td>${t.plate || '—'}</td><td style="text-align:center">${t.km.toFixed(1)} км</td><td style="text-align:center">${t.liters.toFixed(1)} л</td><td style="text-align:right">${Math.round(t.cost).toLocaleString()}₮</td></tr>`
      )
      .join('');
    body = `
      <p style="text-align:center;color:#6b7280">Нийт ${payload.tripCount || 0} аялал · ${(payload.totalKm || 0).toFixed(1)} км</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead><tr style="background:#f9fafb"><th style="padding:10px;text-align:left">Машин</th><th style="padding:10px">Зам</th><th style="padding:10px">Түлш</th><th style="padding:10px;text-align:right">Зардал</th></tr></thead>
        <tbody>${rows || '<tr><td colspan=4 style="padding:20px;text-align:center;color:#9ca3af">Аялал алга</td></tr>'}</tbody>
      </table>
      <p style="text-align:center;margin-top:14px;font-weight:700">Нийт: ${(payload.totalKm || 0).toFixed(1)} км · ${(payload.totalLiters || 0).toFixed(1)} л</p>`;
  }

  const sig = signatureUrl
    ? `<div style="margin-top:28px;text-align:center"><p style="color:#6b7280;font-size:12px">Гарын үсэг</p><img src="${signatureUrl}" style="max-width:240px;height:90px;object-fit:contain"/></div>`
    : '';

  const logoBlock = logoDataUri
    ? `<img src="${logoDataUri}" alt="GENNETEX" style="height:88px;object-fit:contain;margin:0 auto 6px;display:block"/>
       <div style="font-size:11px;color:#6b7280;letter-spacing:.6px;text-transform:uppercase">Generation of Network Experts</div>`
    : `<div style="font-size:22px;font-weight:800;color:#2563eb;letter-spacing:1px">GENNETEX</div>
       <div style="font-size:10px;color:#6b7280;letter-spacing:.5px">GENERATION OF NETWORK EXPERTS</div>`;

  return `<div style="font-family:system-ui,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:8px">
    <div style="text-align:center;margin-bottom:24px">
      ${logoBlock}
      <h1 style="margin:18px 0 6px;font-size:22px;font-weight:800;text-align:center">${title}</h1>
      <p style="margin:0;color:#6b7280;text-align:center;font-size:14px">${userName || 'Ажилтан'} · ${new Date().toLocaleString('mn-MN')}</p>
    </div>
    ${body}
    ${sig}
    <p style="text-align:center;margin-top:28px;font-size:11px;color:#9ca3af">GENNETEX — Generation of Network Experts</p>
  </div>`;
}

export async function uploadSignatureSvg(svgString, userId) {
  const path = `${userId}/signature.svg`;
  try {
    const { error } = await supabase.storage.from(SIG_BUCKET).upload(path, decode(utf8ToBase64(svgString)), {
      contentType: 'image/svg+xml',
      upsert: true,
    });
    if (!error) {
      const { data } = supabase.storage.from(SIG_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
  } catch (e) {
    // Storage алдаа — data URI ашиглана
  }
  return svgToDataUri(svgString);
}

export async function saveUserSignature(userId, signatureUrl) {
  const { error } = await supabase.from('profiles').update({ report_signature_url: signatureUrl }).eq('id', userId);
  if (error) throw error;
}

export async function submitReport({ userId, userName, report, signatureUrl }) {
  const logoDataUri = await getLogoDataUri();
  const body_html = renderReportHtml({
    title: report.title,
    userName,
    payload: report.payload,
    type: report.type,
    signatureUrl,
    logoDataUri,
  });

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      user_name: userName,
      report_type: report.type,
      title: report.title,
      body_html,
      payload: report.payload,
      signature_url: signatureUrl || null,
      pdf_url: null,
    })
    .select()
    .single();
  if (error) throw error;

  try {
    const pdfUri = await htmlToPdfFile(body_html);
    const pdf_url = await uploadReportPdf(pdfUri, userId, data.id);
    await supabase.from(TABLE).update({ pdf_url }).eq('id', data.id);
    data.pdf_url = pdf_url;
  } catch (e) {
    // PDF үүсгэх алдаа — HTML тайлан хадгалагдсан
  }

  try {
    await notifyApi.notifyAdmins({
      title: 'Шинэ тайлан (PDF)',
      body: `${userName || 'Ажилтан'}: ${report.title}`,
      data: { type: 'report', reportId: data.id, pdfUrl: data.pdf_url },
    });
  } catch (e) {
    // Мэдэгдэл амжилтгүй ч тайлан хадгалагдсан
  }
  return data;
}

export async function fetchReports(limit = 100) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchMyReports(userId, limit = 50) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
