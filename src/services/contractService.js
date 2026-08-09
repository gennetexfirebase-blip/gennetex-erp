import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';

const TABLE = 'job_contracts';
const BUCKET = 'reports';

export const CONTRACT_STATUS = [
  { key: 'sent', label: 'Гарын үсэг хүлээж буй' },
  { key: 'signed', label: 'Гарын үсэг зурсан' },
];

export function contractStatusLabel(status) {
  return CONTRACT_STATUS.find((s) => s.key === status)?.label || status || '—';
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMnt(value) {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '₮';
}

/** Хөдөлмөрийн гэрээний PDF HTML — гарын үсэг (SVG) шингээнэ */
export function buildContractHtml(contract, { signatureSvg } = {}) {
  const terms = escHtml(contract.terms || '').replace(/\n/g, '<br/>');
  const sig = signatureSvg || contract.employee_signature_svg || '';
  const signedAt = contract.signed_at
    ? new Date(contract.signed_at).toLocaleString('mn-MN')
    : new Date().toLocaleString('mn-MN');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { margin: 40px; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #111827; line-height: 1.6; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 4px; }
  .sub { text-align: center; color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  table.meta { width: 100%; border-collapse: collapse; margin: 16px 0; }
  table.meta td { padding: 8px 10px; border: 1px solid #e5e7eb; font-size: 13px; }
  table.meta td.k { background: #f9fafb; font-weight: 600; width: 34%; }
  .terms { font-size: 13px; white-space: normal; margin-top: 12px; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 48px; }
  .sign-box { width: 46%; }
  .sign-box .line { border-top: 1px solid #111827; margin-top: 60px; padding-top: 6px; font-size: 12px; color: #6b7280; }
  .sig-svg { height: 90px; }
  .sig-svg svg { max-height: 90px; }
</style></head><body>
  <h1>Хөдөлмөрийн гэрээ</h1>
  <div class="sub">Gennetex ERP · ${escHtml(signedAt)}</div>
  <table class="meta">
    <tr><td class="k">Ажилтан</td><td>${escHtml(contract.employee_name || '—')}</td></tr>
    <tr><td class="k">Албан тушаал</td><td>${escHtml(contract.position || '—')}</td></tr>
    <tr><td class="k">Цалин</td><td>${contract.salary != null ? escHtml(formatMnt(contract.salary)) : '—'}</td></tr>
    <tr><td class="k">Эхлэх огноо</td><td>${escHtml(contract.start_date || '—')}</td></tr>
    <tr><td class="k">Дуусах огноо</td><td>${escHtml(contract.end_date || 'Хугацаагүй')}</td></tr>
    <tr><td class="k">Үүсгэсэн</td><td>${escHtml(contract.created_by_name || '—')}</td></tr>
  </table>
  <div class="terms"><b>Гэрээний нөхцөл:</b><br/>${terms || '—'}</div>
  <div class="sign-row">
    <div class="sign-box">
      <div class="line">Ажил олгогч (гарын үсэг)</div>
    </div>
    <div class="sign-box">
      <div class="sig-svg">${sig}</div>
      <div class="line">Ажилтан: ${escHtml(contract.employee_name || '')}</div>
    </div>
  </div>
</body></html>`;
}

/** Админ шинэ гэрээ үүсгэнэ (нөхцлийг зөвхөн системийн админ дараа нь засна) */
export async function createContract({ employeeId, employeeName, createdBy, createdByName, position, salary, startDate, endDate, terms }) {
  if (!employeeId) throw new Error('Ажилтан сонгоно уу.');
  const row = {
    employee_id: employeeId,
    employee_name: employeeName || null,
    created_by: createdBy || null,
    created_by_name: createdByName || null,
    position: String(position || '').trim() || null,
    salary: salary != null && salary !== '' ? Number(salary) : null,
    start_date: startDate || null,
    end_date: endDate || null,
    terms: String(terms || '').trim() || null,
    status: 'sent',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) {
    if (/job_contracts/i.test(error.message)) {
      throw new Error('job_contracts хүснэгт байхгүй. migration_job_contracts.sql ажиллуулна уу.');
    }
    throw error;
  }
  try {
    await notifyApi.notifyContractToEmployee(employeeId, {
      employeeName: employeeName,
      position: row.position,
      contractId: data.id,
    });
  } catch (e) {}
  return data;
}

export async function fetchContracts(limit = 200) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchMyContracts(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('employee_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function countPendingContracts(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('employee_id', userId)
    .eq('status', 'sent');
  if (error) return 0;
  return count || 0;
}

/** Ажилтан гэрээнд гарын үсэг зурж, PDF үүсгэн байршуулна */
export async function signContract(contract, signatureSvg, { userName } = {}) {
  if (!signatureSvg?.trim()) throw new Error('Гарын үсэг зурна уу.');
  const signedAt = new Date().toISOString();
  const signedContract = { ...contract, employee_signature_svg: signatureSvg, signed_at: signedAt };

  let pdfUrl = null;
  try {
    const html = buildContractHtml(signedContract, { signatureSvg });
    const { uri } = await Print.printToFileAsync({ html, margins: { top: 40, bottom: 40, left: 40, right: 40 } });
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const path = `contracts/${contract.employee_id}/${contract.id}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, decode(base64), {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (!upErr) {
      pdfUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
  } catch (e) {
    // PDF амжилтгүй бол гарын үсэг + төлөв хадгална
  }

  const patch = {
    employee_signature_svg: signatureSvg,
    signed_at: signedAt,
    status: 'signed',
  };
  if (pdfUrl) patch.pdf_url = pdfUrl;

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', contract.id)
    .select()
    .single();
  if (error) throw error;

  try {
    await notifyApi.notifyContractSignedToAdmins({
      employeeName: userName || contract.employee_name,
      contractId: contract.id,
    });
  } catch (e) {}
  return data;
}

export function subscribeContracts(onChange) {
  const channel = supabase
    .channel('job-contracts')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange?.())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
