import { supabase } from '../lib/supabase';
import * as Print from 'expo-print';
import { Platform, Share } from 'react-native';
import * as notifyApi from './notificationService';
import * as activityApi from './activityLogService';

const TABLE = 'employee_feedback';

export const FEEDBACK_KINDS = [
  { key: 'gomdol', label: 'Гомдол' },
  { key: 'sanal', label: 'Санал' },
];

export function kindLabel(kind) {
  return FEEDBACK_KINDS.find((k) => k.key === kind)?.label || kind || '—';
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapFeedbackPrintHtml(inner) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { margin: 18px; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; color: #111827; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 20px 0 8px; color: #374151; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; text-align: left; }
  .empty { color: #9ca3af; font-style: italic; padding: 12px 0; }
</style></head><body>${inner}</body></html>`;
}

function feedbackTableRows(rows) {
  if (!rows?.length) return '<tr><td colspan="6" class="empty">Илгээлт алга</td></tr>';
  return rows
    .map(
      (f) => `<tr>
        <td>${escHtml(f.user_name || '—')}</td>
        <td>${escHtml(kindLabel(f.kind))}</td>
        <td>${escHtml(f.subject || '—')}</td>
        <td>${escHtml(f.body || '')}</td>
        <td>${escHtml((f.mentioned_employee_names || []).join(', ') || '—')}</td>
        <td>${escHtml(new Date(f.created_at).toLocaleString('mn-MN'))}</td>
      </tr>`
    )
    .join('');
}

/** PDF/HTML тайлан — гомдол + санал тусдаа хэсэг */
export function buildFeedbackPdfHtml(rows, { title = 'Санал гомдол' } = {}) {
  const gomdol = (rows || []).filter((r) => r.kind !== 'sanal');
  const sanal = (rows || []).filter((r) => r.kind === 'sanal');
  const now = new Date().toLocaleString('mn-MN');
  return wrapFeedbackPrintHtml(`
    <h1>Gennetex ERP — ${escHtml(title)}</h1>
    <div class="meta">Нийт ${rows?.length || 0} · Гомдол ${gomdol.length} · Санал ${sanal.length} · ${escHtml(now)}</div>
    <h2>📛 Гомдол (${gomdol.length})</h2>
    <table>
      <thead><tr><th>Ажилтан</th><th>Төрөл</th><th>Гарчиг</th><th>Агуулга</th><th>Дурдсан</th><th>Огноо</th></tr></thead>
      <tbody>${feedbackTableRows(gomdol)}</tbody>
    </table>
    <h2>💡 Санал (${sanal.length})</h2>
    <table>
      <thead><tr><th>Ажилтан</th><th>Төрөл</th><th>Гарчиг</th><th>Агуулга</th><th>Дурдсан</th><th>Огноо</th></tr></thead>
      <tbody>${feedbackTableRows(sanal)}</tbody>
    </table>
  `);
}

export async function exportFeedbackPdf(rows, { title = 'Санал гомдол' } = {}) {
  const html = buildFeedbackPdfHtml(rows, { title });
  const { uri } = await Print.printToFileAsync({ html });
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanal_gomdol_${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return uri;
  }
  await Share.share({ url: uri, title, message: title });
  return uri;
}

export async function fetchEmployeeProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('role', 'employee')
    .order('name');
  if (error) throw error;
  return (data || []).filter((p) => p.id && (p.name || p.email));
}

/** Текстээс ажилтны нэр олно */
export function findMentionedEmployees(body, employees = []) {
  const text = String(body || '').toLowerCase();
  const found = [];
  const seen = new Set();
  (employees || []).forEach((e) => {
    const name = (e.name || e.email || '').trim();
    if (!name || name.length < 2) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    if (text.includes(key)) {
      seen.add(key);
      found.push({ id: e.id, name: e.name || e.email });
    }
  });
  return found;
}

export async function submitFeedback({ userId, userName, kind, subject, body }) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Агуулга бичнэ үү.');
  const employees = await fetchEmployeeProfiles();
  const mentions = findMentionedEmployees(text, employees);
  const row = {
    user_id: userId || null,
    user_name: userName || 'Ажилтан',
    kind: kind === 'sanal' ? 'sanal' : 'gomdol',
    subject: String(subject || '').trim() || null,
    body: text,
    mentioned_employee_ids: mentions.map((m) => m.id),
    mentioned_employee_names: mentions.map((m) => m.name),
    status: 'new',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) {
    if (/employee_feedback/i.test(error.message)) {
      throw new Error('employee_feedback хүснэгт байхгүй. migration_feedback_performance.sql ажиллуулна уу.');
    }
    throw error;
  }
  const kindL = kindLabel(row.kind);
  const mentionTxt = mentions.length ? `\nДурдсан: ${mentions.map((m) => m.name).join(', ')}` : '';
  try {
    await notifyApi.notifyFeedbackToAdmins({
      fromName: row.user_name,
      kind: kindL,
      preview: text.slice(0, 120),
      feedbackId: data.id,
      mentionedNames: mentions.map((m) => m.name),
    });
  } catch (e) {}
  activityApi.logActivity({
    userId,
    userName,
    action: 'feedback',
    screen: 'Feedback',
    detail: `${kindL}: ${text.slice(0, 80)}`,
  });
  return data;
}

export async function fetchMyFeedback(userId, limit = 50) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchAllFeedback(limit = 200) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function countNewFeedback() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) return 0;
  return count || 0;
}

export async function updateFeedbackStatus(id, status) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function subscribeFeedback(onChange) {
  const channel = supabase
    .channel('employee-feedback')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange?.())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
