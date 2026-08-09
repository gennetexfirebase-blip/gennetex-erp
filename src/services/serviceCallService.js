import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';

const TABLE = 'service_calls';

export const SITE_KINDS = [
  { key: 'ail', label: 'Айл' },
  { key: 'baiguulga', label: 'Байгууллага' },
];

export function siteKindMeta(key) {
  return SITE_KINDS.find((s) => s.key === (key || 'ail')) || SITE_KINDS[0];
}

export function mapServiceCallRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    customer: r.customer,
    phone: r.phone || '',
    address: r.address || '',
    problem: r.problem || '',
    type: r.call_type || 'other',
    site_kind: r.site_kind || 'ail',
    engineer: r.engineer_name || '',
    engineer_id: r.engineer_id,
    partner_engineer_id: r.partner_engineer_id || null,
    partner_engineer_name: r.partner_engineer_name || null,
    team_name: r.team_name || null,
    latitude: r.latitude,
    longitude: r.longitude,
    status: r.status || 'Хүлээгдэж буй',
    close_meta: r.close_meta || null,
    scheduled_at: r.scheduled_at || null,
    sla_deadline: r.sla_deadline || null,
    created_by: r.created_by || null,
    created_by_name: r.created_by_name || null,
    created_at: r.created_at,
    updated_at: r.updated_at || null,
  };
}

export async function fetchServiceCalls({ engineerId, engineerName } = {}) {
  if (engineerId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('engineer_id', engineerId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    let rows = (data || []).map(mapServiceCallRow);
    if (!rows.length && engineerName) {
      const { data: byName, error: nameErr } = await supabase
        .from(TABLE)
        .select('*')
        .ilike('engineer_name', engineerName.trim())
        .order('created_at', { ascending: false })
        .limit(300);
      if (nameErr) throw nameErr;
      rows = (byName || []).map(mapServiceCallRow);
    }
    return rows;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  let rows = (data || []).map(mapServiceCallRow);
  if (engineerName) {
    const n = engineerName.trim().toLowerCase();
    rows = rows.filter((c) => (c.engineer || '').trim().toLowerCase() === n);
  }
  return rows;
}

export async function createServiceCall(payload) {
  const row = {
    customer: String(payload.customer || '').trim(),
    phone: payload.phone?.trim() || null,
    address: payload.address?.trim() || null,
    problem: payload.problem?.trim() || null,
    call_type: payload.type || payload.call_type || 'other',
    engineer_id: payload.engineer_id || null,
    engineer_name: payload.engineer_name || payload.engineer?.trim() || null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    status: 'Хүлээгдэж буй',
    created_by: payload.created_by || null,
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  const call = mapServiceCallRow(data);

  if (call.engineer_id) {
    try {
      await notifyApi.notifyUsers([call.engineer_id], {
        title: 'Шинэ дуудлага',
        body: `${call.customer}${call.address ? ` · ${call.address}` : ''}`,
        data: { type: 'service_call', callId: call.id },
        channelId: 'chat',
      });
    } catch (e) {}
  }

  return call;
}

export async function updateServiceCallStatus(id, status) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapServiceCallRow(data);
}

/** Дурын багана шинэчлэх (status, close_meta, scheduled_at гэх мэт) */
export async function updateServiceCall(id, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapServiceCallRow(data);
}

export function subscribeServiceCalls(onChange) {
  // Суваг бүр өвөрмөц нэртэй — олон дэлгэц/context зэрэг subscribe хийхэд
  // "cannot add postgres_changes callbacks after subscribe()" алдаа гарахгүй.
  const topic = `service-calls-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(topic)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
