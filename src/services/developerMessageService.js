import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';
import * as activityApi from './activityLogService';
import { DEVELOPER_EMAIL } from '../lib/developerConfig';

const TABLE = 'developer_messages';

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapPrintHtml(inner) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { margin: 18px; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; color: #111827; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; text-align: left; }
  .msg { white-space: pre-wrap; line-height: 1.5; }
</style></head><body>${inner}</body></html>`;
}

function messageTableRows(rows) {
  if (!rows?.length) return '<tr><td colspan="5">Илгээлт алга</td></tr>';
  return rows
    .map(
      (m) => `<tr>
        <td>${escHtml(m.user_name || '—')}</td>
        <td>${escHtml(m.user_email || '—')}</td>
        <td>${escHtml(m.subject || '—')}</td>
        <td class="msg">${escHtml(m.body || '')}</td>
        <td>${escHtml(new Date(m.created_at).toLocaleString('mn-MN'))}</td>
      </tr>`
    )
    .join('');
}

export function buildDeveloperMessagesPdfHtml(rows, { title = 'Хөгжүүлэгчид ирсэн мэдээ' } = {}) {
  const now = new Date().toLocaleString('mn-MN');
  return wrapPrintHtml(`
    <h1>Gennetex ERP — ${escHtml(title)}</h1>
    <div class="meta">Gmail: ${escHtml(DEVELOPER_EMAIL)} · Нийт ${rows?.length || 0} · ${escHtml(now)}</div>
    <table>
      <thead><tr><th>Илгээгч</th><th>Имэйл</th><th>Гарчиг</th><th>Агуулга</th><th>Огноо</th></tr></thead>
      <tbody>${messageTableRows(rows)}</tbody>
    </table>
  `);
}

export function buildSingleMessagePdfHtml(row) {
  if (!row) return wrapPrintHtml('<p>Мэдээ алга</p>');
  return wrapPrintHtml(`
    <h1>Gennetex ERP — Мэдээ</h1>
    <div class="meta">${escHtml(new Date(row.created_at).toLocaleString('mn-MN'))}</div>
    <p><b>Илгээгч:</b> ${escHtml(row.user_name || '—')}</p>
    <p><b>Имэйл:</b> ${escHtml(row.user_email || '—')}</p>
    <p><b>Гарчиг:</b> ${escHtml(row.subject || '—')}</p>
    <p class="msg"><b>Агуулга:</b><br>${escHtml(row.body || '')}</p>
  `);
}

async function sharePdf(html, filename) {
  const { uri } = await Print.printToFileAsync({ html });
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return uri;
  }
  await Share.share({ url: uri, title: filename, message: filename });
  return uri;
}

export async function exportDeveloperMessagesPdf(rows, { title } = {}) {
  const html = buildDeveloperMessagesPdfHtml(rows, { title });
  return sharePdf(html, `developer_messages_${Date.now()}.pdf`);
}

export async function exportSingleDeveloperMessagePdf(row) {
  const html = buildSingleMessagePdfHtml(row);
  return sharePdf(html, `developer_message_${Date.now()}.pdf`);
}

async function trySendDeveloperEmail(payload) {
  if (!supabase) return { emailSent: false, skipped: 'no_supabase' };
  try {
    const { data, error } = await supabase.functions.invoke('send-developer-email', { body: payload });
    if (error) {
      console.warn('[developer-email]', error.message);
      return { emailSent: false, error: error.message };
    }
    return data || { emailSent: false };
  } catch (e) {
    console.warn('[developer-email]', e?.message || e);
    return { emailSent: false, error: e?.message || String(e) };
  }
}

export async function submitDeveloperMessage({ userId, userName, userEmail, subject, body }) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Мессеж бичнэ үү.');
  const row = {
    user_id: userId || null,
    user_name: userName || 'Ажилтан',
    user_email: userEmail || null,
    subject: String(subject || '').trim() || null,
    body: text,
    status: 'new',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) {
    if (/developer_messages/i.test(error.message)) {
      throw new Error('developer_messages хүснэгт байхгүй. migration_developer_messages.sql ажиллуулна уu.');
    }
    throw error;
  }
  try {
    await notifyApi.notifyDeveloperMessage({
      fromName: row.user_name,
      subject: row.subject,
      preview: text.slice(0, 120),
      messageId: data.id,
    });
  } catch (e) {}
  const emailResult = await trySendDeveloperEmail({
    userName: row.user_name,
    userEmail: row.user_email,
    subject: row.subject,
    body: row.body,
    messageId: data.id,
  });
  activityApi.logActivity({
    userId,
    userName,
    action: 'other',
    screen: 'DeveloperContact',
    detail: `Хөгжүүлэгчид: ${text.slice(0, 80)}`,
  });
  return { ...data, emailSent: !!emailResult?.emailSent, emailTo: DEVELOPER_EMAIL };
}

export async function fetchDeveloperInbox(limit = 200) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchMyDeveloperMessages(userId, limit = 30) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function countNewDeveloperMessages() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) return 0;
  return count || 0;
}

export async function updateDeveloperMessageStatus(id, status) {
  const { data, error } = await supabase.from(TABLE).update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export function subscribeDeveloperMessages(onChange) {
  const channel = supabase
    .channel('developer-messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange?.())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
