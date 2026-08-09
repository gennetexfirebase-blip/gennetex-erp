/**
 * Public customer tickets — вэб портал + апп.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';

export async function createPublicTicket(payload) {
  if (!isFlagOn('publicTickets')) throw new Error('Public tickets disabled');
  if (!supabase) throw new Error('Cloud required');

  const row = {
    customer_name: String(payload.customer_name || payload.name || '').trim(),
    phone: String(payload.phone || '').trim(),
    address: payload.address?.trim() || null,
    problem: payload.problem?.trim() || payload.message?.trim() || null,
    status: 'open',
    source: payload.source || 'public_web',
    call_type: payload.call_type || 'gombol',
  };
  if (!row.customer_name || !row.phone) {
    throw new Error('Нэр болон утас заавал');
  }

  const { data, error } = await supabase.from('public_tickets').insert(row).select().single();
  if (error) throw error;

  // Optionally mirror into service_calls for dispatch
  if (payload.createServiceCall !== false) {
    try {
      await supabase.from('service_calls').insert({
        customer: row.customer_name,
        phone: row.phone,
        address: row.address,
        problem: row.problem,
        call_type: row.call_type,
        status: 'Хүлээгдэж буй',
        close_meta: { public_ticket_id: data.id, source: 'public_ticket' },
      });
    } catch {}
  }

  return data;
}

export async function fetchTicketStatus({ phone, id } = {}) {
  if (!supabase) return null;
  if (id) {
    const { data, error } = await supabase.from('public_tickets').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }
  if (phone) {
    const { data, error } = await supabase
      .from('public_tickets')
      .select('*')
      .eq('phone', phone.trim())
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data;
  }
  return null;
}

export async function fetchOpenTickets(limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('public_tickets')
    .select('*')
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function updateTicketStatus(id, status) {
  if (!supabase) throw new Error('Cloud required');
  const { data, error } = await supabase
    .from('public_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
